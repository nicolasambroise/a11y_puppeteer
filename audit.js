/* Script Check A11Y Renowify Manual*/
// Note : Préfix NIA pour "Navigator Inspector for Accessibility" à modifier par qqch en rapport avec Renow
const pluginUrl = 'https://webux.gouv.etat.lu/a11y/a11y_renowify';

function run_renowify_static(debug = false, redac = true, nc = false) {
  /*- -------------------------------------------------------------------------------- */
  // clean console
  console.clear();
  console.log('== Init Plugin Renowify');

  /*- -------------------------------------------------------------------------------- */
  // Add JS
  // - double sécurité pour que ce sript puisse également être appelé par l'extention chrome
  if (!document.body.classList.contains('renowify-script-injected')) {
    /* Pour le bookmarklet */
    console.log('== Start Bookmarklet Renowify ==');
    console.time('Renowify');
    const style_loaded = loadStyle(pluginUrl);
    const script_loaded = loadScript(pluginUrl);

    Promise.all([style_loaded, script_loaded]).then(function () {
      // Open Accordion before running check
      beforeCheck();

      const checkPartFunctions = [
        check_part_01,
        check_part_02,
        check_part_03,
        check_part_04,
        check_part_05,
        check_part_06,
        check_part_07,
        check_part_08,
        check_part_09,
        check_part_10,
        check_part_11,
        check_part_12,
        check_part_13,
        check_part_14,
        check_part_15
      ];
      const partPromises = checkPartFunctions.map(partPromiseResolve);

      Promise.allSettled(partPromises)
        .then((promisesResults) => logPromisesResult(promisesResults))
        .then(function () {
          setTimeout(() => createResultPanel(), 100);
        })
        .then(function () {
          setTimeout(() => activateCheckA11YPanel(), 100);
        })
        .then(function () {
          console.log('== End Plugin Renowify ==');
          console.timeEnd('Renowify');
        });
    });
  }
}

// END
/*- -------------------------------------------------------------------------------- */

// fonction pour charger les scripts
function loadScript(pluginUrl) {
  return new Promise(function (resolve, reject) {
    let script = document.createElement('script');
    script.id = 'renowify-script-injected';
    script.src = pluginUrl + '/assets/index.js?v=' + Date.now();

    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error(`Script load error`));

    if (document.getElementById('renowify-script-injected') === null)
      document.head.append(script);
  });
}

// fonction pour charger le style
function loadStyle(pluginUrl) {
  return new Promise(function (resolve, reject) {
    let style = document.createElement('link');
    style.id = 'injected-css';
    style.rel = 'stylesheet';
    style.href = pluginUrl + '/assets/index.css?v=' + Date.now();

    style.onload = () => resolve(style);
    style.onerror = () => reject(new Error(`Style load error`));

    if (document.getElementById('renowify-style-injected') === null)
      document.head.append(style);
  });
}

function partPromiseResolve(check_part_function) {
  return new Promise((resolve) => {
    check_part_function();
    setTimeout(resolve, 1);
  });
}

function logPromisesResult(promisesResults) {
  promisesResults.forEach((result, index) => {
    const partIndex = `0${index + 1}`.slice(-2);
    console.log(`- Part ${partIndex} : ${result.status}`);
    if (result.status !== 'fulfilled') {
      alert(`- Part ${partIndex} : ${result.status}`);
    }
  });
}

if (!document.body.classList.contains('renowify-script-injected')) {
  // Environnement
  setTimeout(run_renowify_static(false, false, true), 1);
} else {
  alert("Merci de recharger la page avant d'effectuer un nouveau check !");
}
