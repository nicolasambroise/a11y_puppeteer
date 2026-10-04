// ---------------------------------------------
//  CRAWLER COMPLET POUR 3000 PAGES
//  Node.js + Puppeteer + p-limit
// ---------------------------------------------

const fs = require("fs");
const path = require("path");
const pLimit = require("p-limit");
const puppeteer = require("puppeteer");

// ---------------------------------------------
// CONFIG
// ---------------------------------------------
const INPUT_FILE = path.resolve(
  __dirname,
  process.argv[2] || "prodV3detailled.json",
); // 'prodV3Main.json' , 'prodV3Custom.json';
const OUTPUT_FILE = path.join(__dirname, "results.json");
const CONCURRENCY = 5; // nombre de pages en parallèle
const TIMEOUT = 120000; // timeout navigation = 2min

// ---------------------------------------------
// CHARGEMENT DES DONNÉES
// ---------------------------------------------
const pages = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
const pagesObj = "data" in pages ? pages.data : pages;
const validPages = pagesObj.filter((p) => {
  if (p.status !== 200) return false;

  try {
    const url = new URL(p.url);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
});

console.log(`➡️  ${validPages.length} pages à analyser\n`);

// ---------------------------------------------
// CHARGEMENT DU SCRIPT D'AUDIT
// ---------------------------------------------
const auditScript = fs.readFileSync(path.join(__dirname, "audit.js"), "utf8");

// ---------------------------------------------
// EXTRACTEUR DOM (exécuté dans la page)
// ---------------------------------------------
function getExtractor() {
  return () => {
    // Récupère tous les <li> du panneau
    const items = [...document.querySelectorAll("#checkA11YPanel li")];
    const url = document.querySelector("#site_url")?.textContent.trim();
    const lang = document.querySelector("#site_lang")?.textContent.trim();
    const title = document.querySelector("#site_title")?.textContent.trim();

    const result = {
      url: url,
      lang: lang,
      title: title,

      criticity: {
        1: [], // yellow
        2: [], // orange
        3: [], // red
      },
    };

    // Check Cloudflare
    const clf = document.querySelectorAll(
      "div#cf-error-details, form#challenge-form",
    );
    if (clf.length > 0 || title === "Vérification de sécurité - V2") {
      console.log("⚠️ Cloudflare détecté sur", url);
      result.criticity[3].push({
        CLF: "Captcha Cloudflare",
      });

      return result;
    }

    items.forEach((li) => {
      const a = li.querySelector(".result-focus");
      const msg = li.querySelector(".result-msg");

      const code = a?.textContent.trim() || null;
      const message = msg?.textContent.trim() || null;

      let criticity = null;

      if (a?.classList.contains("label-yellow")) criticity = 1;
      if (a?.classList.contains("label-orange")) criticity = 2;
      if (a?.classList.contains("label-red")) criticity = 3;

      if (criticity) {
        result.criticity[criticity].push({
          code,
          message,
        });
      }
    });

    return result;
  };
}

// ---------------------------------------------
// FONCTION D'AUDIT D'UNE PAGE
// ---------------------------------------------
async function auditPage(browser, pageInfo) {
  //, stealthMode
  let page;

  const allowedMsg = [
    "[FRC Agent] IndexedDB",
    "Access to fetch at",
    "has been blocked by CORS policy",
    "chat-window-messages",
    "Slow network is detected",
    "font-size:0;color:transparent",
    "Mixed Content",
    "Failed to execute 'postMessage' on 'DOMWindow'",
    "window.ReadSpeaker",
    "An iframe which has both allow-scripts and allow-same-origin",
    "Geometry exceeds allowed extent",
  ];
  const allowedType = [
    "LOG",
    "COU",
    "DEB",
    "DIR",
    "END",
    "INF",
    "TAB",
    "TRA",
    "STA",
  ];
  const allowedErr = ["TypeError: Cannot read properties of"];
  const allowedStatus = [200, 201, 202, 203, 204, 205, 206, 301, 302, 303, 304];
  const allowedFailed = [
    "https://etat.kiss.lu",
    "https://eu.frcapi.com/api/v2/captcha",
  ];

  try {
    page = await browser.newPage();

    page
      .on("console", (message) => {
        if (
          !containsExpression(
            message.type().substr(0, 3).toUpperCase(),
            allowedType,
          ) &&
          !containsExpression(message.text(), allowedMsg)
        ) {
          console.log(
            `- ${message.type().substr(0, 3).toUpperCase()} ${message.text()} (${pageInfo.url})`,
          );
        }
      })
      .on("pageerror", (message) => {
        if (!containsExpression(message, allowedErr)) {
          console.log(`- ERROR ${message} (${pageInfo.url})`);
        }
      })
      .on("response", (response) => {
        if (!containsExpression(response.status(), allowedStatus)) {
          console.log(
            `- STATUS ${response.status()} ${response.url()}  (${pageInfo.url})`,
          );
        }
      })
      .on("requestfailed", (request) => {
        if (!containsExpression(request.url(), allowedFailed)) {
          console.log(
            `- FAIL ${request.failure().errorText} ${request.url()}  (${pageInfo.url})`,
          );
        }
      });

    await page.setViewport({
      width: 1920,
      height: 1080,
    });

    const response = await page.goto(pageInfo.url, {
      waitUntil: "networkidle2",
      timeout: TIMEOUT,
    });

    //console.log(`- LOAD ${pageInfo.url}`);
    await page.evaluate(auditScript);
    //await page.addScriptTag({ content: auditScript });

    await page.waitForFunction(
      () =>
        window.__renowifyAuditStatus === "done" ||
        window.__renowifyAuditStatus === "error",
      { timeout: 60_000 },
    );

    const auditStatus = await page.evaluate(() => ({
      status: window.__renowifyAuditStatus,
      error: window.__renowifyAuditError,
    }));

    if (auditStatus.status === "error") {
      throw new Error(`Échec de l’audit : ${auditStatus.error}`);
    }

    await page.waitForSelector("#checkA11YPanel", { timeout: 20000 }); // 20 secondes

    const statusCode = response?.status() ?? 0;

    const result = await page.evaluate(getExtractor());

    console.error(`✅ ${pageInfo.url}`);

    return {
      id: pageInfo.id,
      url: pageInfo.url,
      iso: pageInfo.iso,
      status: statusCode,
      originalTitle: pageInfo.title,
      ...result,
    };
  } catch (err) {
    //await page.screenshot({ path: `debug/debug-${pageInfo.id}.png` });
    console.error(`❌ Erreur sur ${pageInfo.url}:`, err.message);

    return {
      id: pageInfo.id,
      url: pageInfo.url,
      iso: pageInfo.iso,
      originalTitle: pageInfo.title,
      error: err.message,
      criticity: { 1: [], 2: [], 3: [] },
    };
  } finally {
    if (page) {
      await page.close().catch((err) => {
        console.error(`Erreur fermeture page ${pageInfo.url}:`, err.message);
      });
    }
  }
}

function containsExpression(sentence, expressions) {
  return expressions.some((expr) => sentence.toString().includes(expr));
}

function requiresHeadful(url) {
  // URLs exactes - Element bloqué par WAF/Cloudflare sur ces sites (iframe, script, ...)
  const exactUrls = [
    "https://armee.public.lu/fr.html",
    "https://armee.public.lu/fr/missions/operations-en-cours/eumam-ua.html",
    "https://luxembourg.public.lu/fr/societe-et-culture/creation-artistique/film-fund.html",
    "https://logement.public.lu/fr/observatoire-habitat/prix-de-vente/prix-de-vente-des-logements.html",
    "https://fluvial.public.lu/fr.html",
    "https://fonds-europeens.public.lu/fr/projets.html",
    "https://transports.public.lu/fr/plus/publications.html",
  ];

  // Site Complet - Présence d'une sécurité WAF/Cloudflare/TAM sur ces sites
  const patterns = ["lu-alert.lu", "cyberfortress.lu"];

  // Test exact
  if (exactUrls.includes(url)) return true;

  // Test partiel
  return patterns.some((pattern) => url.includes(pattern));
}

// ---------------------------------------------
// PIPELINE PRINCIPAL
// ---------------------------------------------
(async () => {
  /*const browserArgs = [
    '--lang=fr',
    '--disable-features=LocalNetworkAccess',
    '--allow-insecure-localhost',
    '--disable-web-security'];*/

  const browserArgs = ["--lang=fr"];

  const browserHeadless = await puppeteer.launch({
    headless: true,
    args: browserArgs,
  });

  const browserHeadful = await puppeteer.launch({
    headless: false,
    args: browserArgs,
  });

  const limit = pLimit(CONCURRENCY);

  const tasks = validPages.map((pageInfo) => {
    const useHeadful = requiresHeadful(pageInfo.url);

    const browser = useHeadful ? browserHeadful : browserHeadless;
    if (useHeadful) console.log("> use Headful browser for " + pageInfo.url);
    return limit(() => auditPage(browser, pageInfo));
  });

  try {
    const results = await Promise.all(tasks);
    console.log(`\n✅ Audit terminé`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`📁 Résultats enregistrés dans ${OUTPUT_FILE}`);
  } finally {
    await Promise.allSettled([browserHeadless.close(), browserHeadful.close()]);
  }
})();
