// ------------------------------------------------------
//  SCRIPT DE RAPPORT GLOBAL POUR L'AUDIT A11Y
//  Avec date + tendance d'évolution
// ------------------------------------------------------

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------
// CONFIG
// ------------------------------------------------------
const INPUT_FILE = 'results.json';
const REPORTS_DIR = './reports';
const TOP_PAGES = 20;
const TOP_PROBLEMS = 50;

// ------------------------------------------------------
// CRÉATION DU DOSSIER DES RAPPORTS SI NÉCESSAIRE
// ------------------------------------------------------
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR);
}

// ------------------------------------------------------
// GÉNÉRATION DU NOM DE FICHIER DATÉ
// ------------------------------------------------------
const now = new Date();
const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

const OUTPUT_FILE = path.join(REPORTS_DIR, `report-${date}-${time}.json`);

// ------------------------------------------------------
// CHARGEMENT DES DONNÉES
// ------------------------------------------------------
const results = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

console.log(`➡️  Analyse de ${results.length} pages\n`);

// ------------------------------------------------------
// 1. TOTAL PAR CRITICITÉ
// ------------------------------------------------------
const totals = { 1: 0, 2: 0, 3: 0 };

results.forEach(r => {
  totals[1] += r.criticity[1].length;
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
      count: r.criticity[level].length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_PAGES);
}

const topPages = {
  criticity1: topPagesForCriticity(1),
  criticity2: topPagesForCriticity(2),
  criticity3: topPagesForCriticity(3)
};

// ------------------------------------------------------
// 3. CLASSEMENT DES PROBLÈMES LES PLUS FRÉQUENTS
// ------------------------------------------------------
const problemCounter = {};

results.forEach(r => {
  [1, 2, 3].forEach(level => {
    r.criticity[level].forEach(p => {
      const normalizedMessage = normalizeProblemMessage(p.message);
	  const normalizedCode = cleanCode(p.code);
	  const key = `${normalizedCode}::${normalizedMessage}`;

      if (!problemCounter[key]) {
        problemCounter[key] = {
          code: normalizedCode,
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
  
function normalizeProblemMessage(message) {
  const prefix = "Absence de bouton pour déplier le sous-menu";
  if (message.startsWith(prefix)) {
    return prefix; // on regroupe toutes les variantes
  }
  return message;
}

function cleanCode(code) {
  if (!code) return null;
  const forbidden = ["Color Orange", "Color Yellow", "Color Red", "Color Gray"];
  if (forbidden.includes(code)) {
    return null; // on supprime complètement
  }
  return code;
}

// ------------------------------------------------------
// 4. CHARGER LE RAPPORT PRÉCÉDENT
// ------------------------------------------------------
function getPreviousReport() {
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('report-') && f.endsWith('.json'))
    .sort(); // tri chronologique

  if (files.length < 1) return null;

  const previousFile = files[files.length - 1];
  return JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, previousFile), 'utf8'));
}

const previousReport = getPreviousReport();

// ------------------------------------------------------
// 5. CALCUL DE LA TENDANCE
// ------------------------------------------------------
function computeTrend(current, previous) {
  const trend = {};

  [1, 2, 3].forEach(level => {
    const diff = current[level] - previous[level];

    trend[level] = {
      previous: previous[level],
      current: current[level],
      diff,
      direction:
        diff > 0 ? '↑ augmentation' :
        diff < 0 ? '↓ diminution' :
        '= stable'
    };
  });

  return trend;
}

let trend = null;

if (previousReport && previousReport.totals) {
  trend = computeTrend(totals, previousReport.totals);
}

// ------------------------------------------------------
// 6. STRUCTURE DU RAPPORT FINAL
// ------------------------------------------------------
const report = {
  generatedAt: `${date} ${time}`,
  totals,
  topPages,
  topProblems,
  trend
};

// ------------------------------------------------------
// 7. SAUVEGARDE
// ------------------------------------------------------
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));

console.log(`✅ Rapport généré`);
console.log(`📁 Fichier : ${OUTPUT_FILE}`);
