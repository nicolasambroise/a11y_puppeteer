async function loadReports() {
  const files = await fetch('../reports/')
    .then(r => r.text());

  const jsonFiles = [...files.matchAll(/report-[\d\-]+\.json/g)]
    .map(m => m[0])
    .sort();

  const reports = [];
  //console.log(jsonFiles.length);
  //console.log(uniq(jsonFiles).lenght);

  for (const file of uniq(jsonFiles)) {
    const data = await fetch('../reports/' + file).then(r => r.json());
    reports.push({ file, ...data });
  }

  //console.log(reports.length);
  return reports;
}

function uniq(a) {
  return Array.from(new Set(a));
}

function renderLatestDate(latest){
  //console.log(latest);
  const container = document.getElementById('latest');
  container.innerHTML = `<p>Dernier run : ${latest.generatedAt} sur ${latest.totalPages} pages (Version : ${latest.pluginVersion})</p>`;
}

function trendColor(diff) {
  if (diff > 0) return `<span class="trend-up">↑ (+${diff})</span>`;
  if (diff < 0) return `<span class="trend-down">↓ (${diff})</span>`;
  return `<span class="trend-equal">= (0)</span>`;
}

function renderSummary(latest, previous) {
  const container = document.getElementById('summary');

  const lt2 = latest.totals[2];
  const lt3 = latest.totals[3];
  const pt2 = previous.totals[2];
  const pt3 = previous.totals[3];
  const diff_t2 = pt2 ? lt2 - pt2 : 0;
  const diff_t3 = pt3 ? lt3 - pt3 : 0;


  container.innerHTML = `
    <div class="card">
      <h3 class="criticity-box orange">🟠 Alertes</h3>
      <ul>
		  <li>Total : <strong>${lt2}</strong></li>
		  <li>Tendance : ${trendColor(diff_t2)}</li>
		  <li>Ratio : <strong>${(Math.round(lt2/latest.totalPages * 1000) / 1000).toFixed(3)} %</strong></li>
	  </ul>
    </div>

    <div class="card">
      <h3 class="criticity-box red">🔴 Erreurs</h3>
	  <ul>
		<li>Total : <strong>${lt3}</strong></li>
        <li>Tendance : ${trendColor(diff_t3)}</li>
	    <li>Ratio : <strong>${(Math.round(lt3/latest.totalPages * 1000) / 1000).toFixed(3)} %</strong></li>
    </div>
  `;
}

function renderTopPages(latest, previous) {
  const container = document.getElementById('topPages');

  function tableFor(list_latest, list_previous, criticityLevel, colorClass, picto, title) {
    return `
      <div class="card">
        <h3 class="criticity-box ${colorClass}">${picto} ${title}</h3>
        <table>
          <tr>
            <th>Page</th>
            <th>Nb</th>
            <th>Tendance</th>
          </tr>
          ${list_latest.slice(0, 10).map(p => {
      const prev = list_previous.find(x => x.id === p.id);
      const diff = prev ? p.count - prev.count : 0;
      return `
			<tr>
              <td>${p.title}<br><small>${p.url}</small></td>
              <td><strong>${p.count}</strong></td>
              <td>${trendColor(diff)}</td>
            </tr>
          `;
    }).join('')}
        </table>
      </div>
    `;
  }

  const lc2 = latest.topPages.criticity2;
  const lc3 = latest.topPages.criticity3;
  const pc2 = previous.topPages.criticity2;
  const pc3 = previous.topPages.criticity3;

  container.innerHTML = `
    ${tableFor(lc2, pc2, 2, "orange", "🟠", "Alertes")}
    ${tableFor(lc3, pc3, 3, "red", "🔴", "Erreurs")}
  `;
}

function renderTopProblems(latest, previous) {
  const container = document.getElementById('topProblemsContainer');
  console.log(previous)
  console.log(latest);
  function tableFor(list_latest, list_previous, criticityLevel, colorClass, picto, title) {

    return `
      <div class="card">
        <h3 class="criticity-box ${colorClass}">${picto} ${title}</h3>
        <table>
          <tr>
            <th>Code</th>
            <th>Message</th>
            <th>Nb</th>
            <th>Tendance</th>
          </tr>
          ${list_latest.slice(0, 10).map(p => {
      const prev = list_previous.find(x => x.code === p.code && x.message === p.message);
      const diff = prev ? p.count - prev.count : 0;
      const codeCleaned = (p.code).replace("Color orange","").replace("Color red","").trim();
      return `
              <tr>
                <td>${codeCleaned}</td>
                <td>${p.message}</td>
                <td><strong>${p.count}</strong></td>
                <td>${trendColor(diff)}</td>
              </tr>
            `;
    }).join('')}
        </table>
      </div>
    `;
  }

  const lc2 = latest.topProblems.filter(p => p.criticity === 2);
  const lc3 = latest.topProblems.filter(p => p.criticity === 3);
  const pc2 = previous.topProblems.filter(p => p.criticity === 2);
  const pc3 = previous.topProblems.filter(p => p.criticity === 3);

  container.innerHTML = `
    ${tableFor(lc2, pc2, 2, "orange", "🟠", "Alertes")}
    ${tableFor(lc3, pc3, 3, "red", "🔴", "Erreurs")}
  `;
}


function renderEvolution(reports) {
  const labels = reports.map(r => r.generatedAt);
  const c2AllPagesNb = reports.map(r => r.totals[2]);
  const c2 = reports.map(r => (Math.round(r.totals[2]/r.totalPages * 1000) / 1000).toFixed(3));
  const c3AllPagesNb = reports.map(r => r.totals[3]);
  const c3 = reports.map(r => (Math.round(r.totals[3]/r.totalPages * 1000) / 1000).toFixed(3));
  const version = reports.map(r => r.pluginVersion);
  console.log(version);

  const tooltipSum = (tooltipItems) => {
    let sum = 0;
    tooltipItems.forEach(function(tooltipItem) {
      sum += tooltipItem.parsed.y;
    });
    return 'Sum ratio: ' + (Math.round(sum * 1000) / 1000).toFixed(3) + ' %';
  };

  const tooltipVersion = (tooltipItems) => {
    const dataIndex = tooltipItems[0]["dataIndex"];
    const currentVersion = version[dataIndex];
    return 'Version: '+ currentVersion;
  };

  const tooltipPages = (tooltipItems) => {
    const dataIndex = tooltipItems[0]["dataIndex"];
    const c2pagesNb = c2AllPagesNb[dataIndex];
    const c3pagesNb = c3AllPagesNb[dataIndex];
    return 'Erreurs: '+ c3pagesNb+ ' | Alertes: '+c2pagesNb;
  };

  new Chart(document.getElementById('chartEvolution'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Alertes (%)', data: c2, borderColor: '#FF9800',  pointStyle: 'circle', backgroundColor: '#FF980066', tension: .2 },
        { label: 'Erreurs (%)', data: c3, borderColor: '#F44336',  pointStyle: 'triangle', backgroundColor: '#F4433666', tension: .2 }
      ],
    },
    options: {
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        tooltip: {
          callbacks: {
            beforeFooter : tooltipSum,
            footer : tooltipPages,
            afterFooter : tooltipVersion,
          }
        }
      }
    }
  });
}



(async () => {
  const reports = await loadReports();
  const latest = reports[reports.length - 1];
  const previous = reports[reports.length - 2];
  renderLatestDate(latest);
  renderSummary(latest, previous);
  renderTopPages(latest, previous);
  renderTopProblems(latest, previous);
  renderEvolution(reports);
})();