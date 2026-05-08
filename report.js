// ------------------------------------------------------
//  REPORT.JS — VERSION COMPLÈTE AVEC TENDANCES PAR PAGE
//  ET PAR PROBLÈME + NETTOYAGE + FUSION + INDEX.JSON
// ------------------------------------------------------

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------
// CONFIG
// ------------------------------------------------------
const INPUT_FILE = 'results.json';
const REPORTS_DIR = './reports';
const TOP_PAGES = 50;
const TOP_PROBLEMS = 50;

// ------------------------------------------------------
// UTILITAIRES
// ------------------------------------------------------
function normalizeProblemMessage(message) {
  const prefix = "Absence de bouton pour déplier le sous-menu pour l'élément de menu";
  if (message.startsWith(prefix)) return prefix;
  return message;
}

function cleanCode(code) {
  if (!code) return null;
  const forbidden = ["Color Orange", "Color Yellow", "Color Red"];
  if (forbidden.includes(code)) return null;
  return code;
}

// ------------------------------------------------------
// CRÉATION DU DOSSIER DES RAPPORTS
// ------------------------------------------------------
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR);
}

// ------------------------------------------------------
// GÉNÉRATION DU NOM DE FICHIER DATÉ
// ------------------------------------------------------
const now = new Date();
const date = now.toISOString().split('T')[0];
const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');

const OUTPUT_FILE = path.join(REPORTS_DIR, `report-${date}-${time}.json`);

// ------------------------------------------------------
// CHARGEMENT DES DONNÉES
// ------------------------------------------------------
const results = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

console.log(`➡️ Analyse de ${results.length} pages`);

// ------------------------------------------------------
// 1. TOTAL PAR CRITICITÉ
// ------------------------------------------------------
const totals = { 2: 0, 3: 0 };

results.forEach(r => {
  totals[2] += r.criticity[2].length;
  totals[3] += r.criticity[3].length;
});

// ------------------------------------------------------
// 2. TOP PAGES PAR CRITICITÉ
// ------------------------------------------------------
function topPagesForCriticity(level) {
  return [...results]
    .map(r => ({
      id: r.id,
      url: r.url,
      iso: r.iso,
      title: r.originalTitle,
      count: r.criticity[level].length,
      criticity: r.criticity
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_PAGES);
}

const topPages = {
  criticity2: topPagesForCriticity(2),
  criticity3: topPagesForCriticity(3)
};

// ------------------------------------------------------
// 3. TOP PROBLÈMES (fusion + nettoyage)
// ------------------------------------------------------
const problemCounter = {};

results.forEach(r => {
  [2, 3].forEach(level => {
    r.criticity[level].forEach(p => {
      const normalizedMessage = normalizeProblemMessage(p.message);
      const cleanedCode = cleanCode(p.code);

      const key = `${cleanedCode}::${normalizedMessage}`;

      if (!problemCounter[key]) {
        problemCounter[key] = {
          code: cleanedCode,
          message: normalizedMessage,
          criticity: level,
          count: 0
        };
      }

      problemCounter[key].count++;
    });
  });
});

const topProblems = Object.values(problemCounter)
  .sort((a, b) => b.count - a.count)
  .slice(0, TOP_PROBLEMS);

// ------------------------------------------------------
// 4. CHARGER LE RAPPORT PRÉCÉDENT
// ------------------------------------------------------
function getPreviousReport() {
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('report-') && f.endsWith('.json'))
    .sort();

  if (files.length < 1) return null;

  const previousFile = files[files.length - 1];
  return JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, previousFile), 'utf8'));
}

const previousReport = getPreviousReport();

// ------------------------------------------------------
// 5. TENDANCE GLOBALE
// ------------------------------------------------------
function computeTrend(current, previous) {
  const trend = {};
  [2, 3].forEach(level => {
    const diff = current[level] - previous[level];
    trend[level] = { previous: previous[level], current: current[level], diff };
  });
  return trend;
}

let trend = null;
if (previousReport?.totals) {
  trend = computeTrend(totals, previousReport.totals);
}

// ------------------------------------------------------
// 6. TENDANCE PAR PAGE (criticity 2 & 3)
// ------------------------------------------------------
function computePageTrend(currentResults, previousResults) {
  const trend = {};

  currentResults.forEach(page => {
    const prev = previousResults.find(p => p.id === page.id);
    if (!prev) return;

    trend[page.id] = {
      criticity2: page.criticity[2].length - prev.criticity[2].length,
      criticity3: page.criticity[3].length - prev.criticity[3].length
    };
  });

  return trend;
}

let pageTrend = null;
if (previousReport?.results) {
  pageTrend = computePageTrend(results, previousReport.results);
}

// ------------------------------------------------------
// 7. TENDANCE PAR PROBLÈME
// ------------------------------------------------------
function computeProblemTrend(currentProblems, previousProblems) {
  const trend = {};

  currentProblems.forEach(p => {
    const prev = previousProblems?.find(
      x => x.code === p.code && x.message === p.message
    );

    trend[`${p.code}::${p.message}`] = prev
      ? p.count - prev.count
      : 0;
  });

  return trend;
}

let problemTrend = null;
if (previousReport?.topProblems) {
  problemTrend = computeProblemTrend(topProblems, previousReport.topProblems);
}

// ------------------------------------------------------
// 8. STRUCTURE DU RAPPORT FINAL
// ------------------------------------------------------
const report = {
  generatedAt: `${date} ${time}`,
  totals,
  topPages,
  topProblems,
  trend,
  pageTrend,
  problemTrend,
  results
};

// ------------------------------------------------------
// 9. SAUVEGARDE DU RAPPORT
// ------------------------------------------------------
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
console.log(`✅ Rapport généré : ${OUTPUT_FILE}`);

// ------------------------------------------------------
// 10. GÉNÉRATION DE index.json POUR LE DASHBOARD
// ------------------------------------------------------
const reportFiles = fs.readdirSync(REPORTS_DIR)
  .filter(f => f.startsWith('report-') && f.endsWith('.json'))
  .sort();

fs.writeFileSync(
  path.join(REPORTS_DIR, 'index.json'),
  JSON.stringify(reportFiles, null, 2)
);

console.log(`📁 index.json mis à jour`);
