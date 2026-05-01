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
const TIMEOUT = 25000; // timeout navigation

// ---------------------------------------------
// CHARGEMENT DES DONNÉES
// ---------------------------------------------
const pages = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const validPages = pages.filter(p => p.status === 200);

console.log(`➡️  ${validPages.length} pages à analyser\n`);

// ---------------------------------------------
// CHARGEMENT DU SCRIPT D'AUDIT
// ---------------------------------------------
//const auditScript = fs.readFileSync('Z:\\a11y\\a11y_renowify\\assets\\index.js', 'utf8');
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

  try {
	await page.setViewport({
	  width: 1920,
	  height: 1080
	});  
	  
    await page.goto(pageInfo.url, {
      waitUntil: 'networkidle0',
      timeout: TIMEOUT
    });

	console.log(`- ${pageInfo.url}`);
    await page.evaluate(auditScript);
	//await page.addScriptTag({ content: auditScript });

	await page.waitForSelector('#checkA11YPanel', { timeout: 5000 });

    const result = await page.evaluate(getExtractor());

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

// ---------------------------------------------
// PIPELINE PRINCIPAL
// ---------------------------------------------
(async () => {
  const browser = await puppeteer.launch({ headless: true });
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