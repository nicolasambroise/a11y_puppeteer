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
  process.argv[2] || "input/prodV3detailled.json",
); // 'input/prodV3Main.json';
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
//const auditScript = "https://webux.gouv.etat.lu/a11y/a11y_renowify/static/renowify_api_test.js"
const auditScript = fs.readFileSync(path.join(__dirname, "audit.js"), "utf8");

// ---------------------------------------------
// FONCTION D'AUDIT D'UNE PAGE
// ---------------------------------------------
async function auditPage(browser, pageInfo) {
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
    "https://remap.jrc.ec.europa.eu/Consent/Simple.aspx",
    "https://www.eurisportal.eu/"
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

    await page.evaluate(auditScript);

    const renowifyResult = await page.evaluate(() => {
      return window.run_renowify_static(false,false, true, false);
    });

    const statusCode = response?.status() ?? 0;

    console.error(`✅ ${pageInfo.url}`);

    return {
      id: pageInfo.id,
      url: pageInfo.url,
      iso: pageInfo.iso,
      status: statusCode,
      originalTitle: pageInfo.title,
      ...renowifyResult,
      ...convertResults(renowifyResult)
    };
  } catch (err) {
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

function convertResults(data) {
  const criticity = {
    1: [],
    2: [],
    3: []
  };

  Object.values(data.results).forEach(items => {
    items.forEach(item => {
      const [level, rest] = item.split("|");
      const [code, ...messageParts] = rest.split(" ");

      criticity[level].push({
        code,
        message: messageParts.join(" ")
      });
    });
  });

  return { criticity };
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
  const browserArgs = [
    '--lang=fr',
    '--disable-web-security'];

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
    //if (useHeadful) console.log("> use Headful browser for " + pageInfo.url);
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
