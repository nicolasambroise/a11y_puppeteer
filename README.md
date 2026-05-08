📘 README.md
markdown
# Audit Automatisé A11Y – Crawler + Dashboard

Ce projet permet d’auditer automatiquement plusieurs milliers de pages web en :

1. parcourant chaque URL via Puppeteer  
2. injectant un script d’audit (`audit.js`)  
3. extrayant les problèmes d’accessibilité  
4. générant un rapport daté  
5. affichant un dashboard interactif avec graphiques

---

## 🚀 Fonctionnalités

- Analyse automatique de milliers de pages
- Extraction des problèmes classés par criticité (1 = jaune, 2 = orange, 3 = rouge)
- Génération d’un fichier `results.json`
- Génération d’un rapport daté dans `reports/`
- Calcul de la tendance d’évolution par rapport au rapport précédent
- Dashboard HTML interactif (Chart.js)
- Visualisation :
  - Totaux par criticité
  - Top pages les plus problématiques
  - Top problèmes les plus fréquents
  - Courbe d’évolution historique

---

## 📁 Structure du projet

```bash
project/
│
├── crawler.js
├── report.js
├── audit.js
├── pages.json
│
├── results.json
├── reports/
│     └── report-YYYY-MM-DD-HH-MM-SS.json
│
└── dashboard/
	  └── index.html
```


---

## 📦 Installation

```bash
npm install
npm install puppeteer p-limit
```

🔍 Lancer le crawler
```bash
node crawler.js
```
Ce script :
- lit pages.json
- ouvre chaque page
- injecte renowify.js
- extrait les problèmes
- génère results.json

📊 Générer un rapport daté
```bash
node report.js
```

Le rapport est enregistré dans :
```Code
/reports/report-YYYY-MM-DD-HH-MM-SS.json
```
📈 Afficher le dashboard
Le dashboard se trouve dans :

```Code
dashboard/index.html
```

---

📜 Licence
Projet interne – usage réservé.