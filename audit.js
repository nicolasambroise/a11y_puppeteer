const pluginUrl = 'https://webux.gouv.etat.lu/a11y/a11y_renowify';

async function run_renowify_static(debug = false, redac = false, nc = true, panel = false) {
  // inject JS
  await loadScript(pluginUrl)

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

  await Promise.allSettled(checkPartFunctions.map(partPromiseResolve));

  const response = createResultResponse()
  return response;
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

function partPromiseResolve(check_part_function) {
  return new Promise((resolve) => {
    check_part_function();
    setTimeout(resolve, 1);
  });
}