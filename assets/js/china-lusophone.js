(async () => {
  let W;
  try {
    W = await Dash.loadJSON('data/worldbank.json');
  } catch (err) {
    Dash.showError(document.getElementById('bar-box'), err);
    document.getElementById('bar-sub').textContent = '';
    document.getElementById('line-sub').textContent = '';
    return;
  }

  const allMembers = W.groups?.china_lusophone?.members || [];
  const members = allMembers.filter(iso => W.countries[iso]);
  const minYear = new Date().getFullYear() - 10;
  const label = k => W.indicators[k].label;
  const name = iso => W.countries[iso].name;
  const color = iso => Dash.palette[allMembers.indexOf(iso) % Dash.palette.length];

  const indSel = document.getElementById('indicator');
  const logY = document.getElementById('log-y');
  const keys = Object.keys(W.indicators).filter(k => k !== 'population');
  indSel.innerHTML = keys.map(k => `<option value="${k}">${Dash.esc(label(k))}</option>`).join('');
  indSel.value = 'arrivals';
  logY.checked = true;

  let bar, line;
  function renderCharts() {
    const k = indSel.value;
    const log = logY.checked;
    const scaleType = log ? 'logarithmic' : 'linear';

    // Bar: latest value per country
    const rows = members
      .map(iso => ({ iso, p: Dash.latest(W.data[iso]?.[k], minYear) }))
      .filter(r => r.p && (!log || r.p.value > 0))
      .sort((a, b) => b.p.value - a.p.value);
    const missing = members.filter(iso => !rows.some(r => r.iso === iso));
    document.getElementById('bar-sub').textContent =
      `${label(k)}, latest year ${minYear} or later.` +
      (missing.length ? ` No data${log ? ' or zero' : ''}: ${missing.map(name).join(', ')}.` : '');

    if (bar) bar.destroy();
    bar = new Chart(document.getElementById('bar-chart'), {
      type: 'bar',
      data: {
        labels: rows.map(r => name(r.iso)),
        datasets: [{
          data: rows.map(r => r.p.value),
          backgroundColor: rows.map(r => color(r.iso)),
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        scales: { x: { type: scaleType, ticks: { callback: v => Dash.compact(v) } } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => `${Dash.fmt(c.raw, 2)} (${rows[c.dataIndex].p.year})` } },
        },
      },
    });

    // Line: trend since 2000
    const withData = members.filter(iso => W.data[iso]?.[k]);
    const allYears = withData.flatMap(iso => Object.keys(W.data[iso][k]).map(Number));
    const years = [];
    if (allYears.length) {
      for (let y = Math.min(...allYears); y <= Math.max(...allYears); y++) years.push(String(y));
    }
    document.getElementById('line-sub').textContent =
      `${label(k)}, ${withData.length} of ${members.length} countries have data.`;

    if (line) line.destroy();
    line = new Chart(document.getElementById('line-chart'), {
      type: 'line',
      data: {
        labels: years,
        datasets: withData.map(iso => ({
          label: name(iso),
          data: years.map(y => {
            const v = W.data[iso][k][y];
            return v == null || (log && v <= 0) ? null : v;
          }),
          borderColor: color(iso),
          backgroundColor: color(iso),
          borderWidth: iso === 'MAC' ? 3 : 2,
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
        })),
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: { y: { type: scaleType, ticks: { callback: v => Dash.compact(v) } } },
        plugins: {
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${Dash.fmt(c.raw, 2)}` } },
        },
      },
    });
  }

  [indSel, logY].forEach(el => el.addEventListener('change', renderCharts));
  renderCharts();

  // Tables
  function cell(iso, k, digits) {
    const p = Dash.latest(W.data[iso]?.[k], minYear);
    return p ? `${Dash.fmt(p.value, digits)}<span class="yr">${p.year}</span>` : '–';
  }

  function fillTable(id, cols) {
    const table = document.getElementById(id);
    table.querySelector('thead').innerHTML =
      `<tr><th>Country</th>${cols.map(([k]) => `<th class="num">${Dash.esc(label(k))}</th>`).join('')}</tr>`;
    table.querySelector('tbody').innerHTML = members.map(iso => `
      <tr${iso === 'MAC' ? ' class="hl"' : ''}>
        <td>${Dash.esc(name(iso))}</td>
        ${cols.map(([k, d]) => `<td class="num">${cell(iso, k, d)}</td>`).join('')}
      </tr>`).join('');
  }

  fillTable('profile-table', [
    ['arrivals', 0], ['departures', 0], ['health_exp_per_capita', 0],
    ['physicians_per_1000', 2], ['beds_per_1000', 1], ['life_expectancy', 1],
  ]);
  fillTable('risk-table', [
    ['malaria_incidence', 1], ['tb_incidence', 0], ['hiv_prevalence', 1], ['measles_immunization', 0],
  ]);

  // Optional manual file: year,origin,visitors
  try {
    const rows = Dash.parseCSV(await Dash.loadText('data/manual/macao_visitors.csv'))
      .filter(r => r.year && r.origin && r.visitors !== '' && !Number.isNaN(Number(r.visitors)));
    if (rows.length) {
      const years = [...new Set(rows.map(r => r.year))].sort();
      const origins = [...new Set(rows.map(r => r.origin))];
      const value = new Map(rows.map(r => [`${r.origin}|${r.year}`, Number(r.visitors)]));
      const table = document.getElementById('visitors-table');
      table.querySelector('thead').innerHTML =
        `<tr><th>Place of residence</th>${years.map(y => `<th class="num">${Dash.esc(y)}</th>`).join('')}</tr>`;
      table.querySelector('tbody').innerHTML = origins.map(o => `
        <tr>
          <td>${Dash.esc(o)}</td>
          ${years.map(y => `<td class="num">${Dash.fmt(value.get(`${o}|${y}`))}</td>`).join('')}
        </tr>`).join('');
      document.getElementById('visitors-note').hidden = true;
    }
  } catch { /* file missing or empty: note stays visible */ }
})();
