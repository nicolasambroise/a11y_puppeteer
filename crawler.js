// ---------------------------------------------
//  CRAWLER COMPLET POUR 3000 PAGES
//  Node.js + Puppeteer + p-limit
// ---------------------------------------------

const fs = require('fs');
const pLimit = require('p-limit');
const puppeteer = require('puppeteer');

// ---------------------------------------------
// CONFIG
// ---------------------------------------------
const INPUT_FILE = 'prodV3MainData.json';
const OUTPUT_FILE = 'results.json';
const CONCURRENCY = 5; // nombre de pages en parallèle
const TIMEOUT = 60000; // timeout navigation

// ---------------------------------------------
// CHARGEMENT DES DONNÉES
// ---------------------------------------------
const pages = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const validPages = pages.filter(p => p.status === 200);

console.log(`➡️  ${validPages.length} pages à analyser\n`);

// ---------------------------------------------
// CHARGEMENT DU SCRIPT D'AUDIT
// ---------------------------------------------
const auditScript = fs.readFileSync('./audit.js', 'utf8');

// ---------------------------------------------
// EXTRACTEUR DOM (exécuté dans la page)
// ---------------------------------------------
function getExtractor() {
  return () => {
    // Récupère tous les <li> du panneau
    const items = [...document.querySelectorAll('#checkA11YPanel li')];

    const result = {
      url: document.querySelector('#site_url')?.textContent.trim(),
      lang: document.querySelector('#site_lang')?.textContent.trim(),
      title: document.querySelector('#site_title')?.textContent.trim(),
      criticity: {
        1: [], // yellow
        2: [], // orange
        3: []  // red
      }
    };

    items.forEach(li => {
      const a = li.querySelector('a');
      const msg = li.querySelector('.result-msg');

      const code = a?.textContent.trim() || null;
      const message = msg?.textContent.trim() || null;

      let criticity = null;

      if (a?.classList.contains('label-yellow')) criticity = 1;
      if (a?.classList.contains('label-orange')) criticity = 2;
      if (a?.classList.contains('label-red')) criticity = 3;

      if (criticity) {
        result.criticity[criticity].push({
          code,
          message
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
  const page = await browser.newPage();

  const allowedMsg = ['[FRC Agent] IndexedDB', 'Access to fetch at', 'has been blocked by CORS policy','chat-window-messages'];
  const allowedErr = ['TypeError: Cannot read properties of'];
  const allowedStatus = [200,201,206,301,302,303,304]
  const allowedFailed = ['https://etat.kiss.lu', 'https://eu.frcapi.com/api/v2/captcha']

  page
    .on('console', message => {
      if(!containsExpression(message.text(),allowedMsg)){
        console.log(`- ${message.type().substr(0, 3).toUpperCase()} ${message.text()} (${pageInfo.url})`);
      }
    })
    .on('pageerror', message => {
      if(!containsExpression(message,allowedErr)){
        console.log(`- ERROR ${message} (${pageInfo.url})`);
      }
    })
    .on('response', response => {
      if(!containsExpression(response.status(),allowedStatus)){
        console.log(`- STATUS ${response.status()} ${response.url()}  (${pageInfo.url})`);
      }
    })
    .on('requestfailed', request => {
      if(!containsExpression(request.url(), allowedFailed)){
        console.log(`- FAIL ${request.failure().errorText} ${request.url()}  (${pageInfo.url})`);
      }
    })

  try {
	await page.setViewport({
	  width: 1920,
	  height: 1080
	});  
	  
    await page.goto(pageInfo.url, {
      waitUntil: 'networkidle0',
      timeout: TIMEOUT
    });

	//console.log(`- LOAD ${pageInfo.url}`);
    await page.evaluate(auditScript);
	//await page.addScriptTag({ content: auditScript });

	await page.waitForSelector('#checkA11YPanel', { timeout: 20000 }); // 20 secondes

    const result = await page.evaluate(getExtractor());

    console.error(`✅ ${pageInfo.url}`);

    return {
      id: pageInfo.id,
      url: pageInfo.url,
      iso: pageInfo.iso,
      originalTitle: pageInfo.title,
      ...result
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
      criticity: { 1: [], 2: [], 3: [] }
    };

  } finally {
    await page.close();
  }
}

function containsExpression(sentence, expressions) {
  return expressions.some(expr => sentence.toString().includes(expr));
}

// ---------------------------------------------
// PIPELINE PRINCIPAL
// ---------------------------------------------
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--lang=fr'] });
  const limit = pLimit(CONCURRENCY);

  const tasks = validPages.map(pageInfo =>
    limit(() => auditPage(browser, pageInfo))
  );

  const results = await Promise.all(tasks);

  await browser.close();

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  console.log(`\n✅ Audit terminé`);
  console.log(`📁 Résultats enregistrés dans ${OUTPUT_FILE}`);
})();