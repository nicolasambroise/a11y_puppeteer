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
// 4. STRUCTURE DU RAPPORT FINAL
// ------------------------------------------------------
const report = {
  generatedAt: `${date} ${time}`,
  pluginVersion: "2.5.0",
  totalPages: results.length,   
  totals,
  topPages,
  topProblems,
  results
};


// SAUVEGARDE DU RAPPORT
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
console.log(`✅ Rapport généré : ${OUTPUT_FILE}`);

// ------------------------------------------------------
// 5. GÉNÉRATION DE index.json POUR LE DASHBOARD
// ------------------------------------------------------
const reportFiles = fs.readdirSync(REPORTS_DIR)
  .filter(f => f.startsWith('report-') && f.endsWith('.json'))
  .sort();

fs.writeFileSync(
  path.join(REPORTS_DIR, 'index.json'),
  JSON.stringify(reportFiles, null, 2)
);

console.log(`📁 index.json mis à jour`);
