(async () => {
  const scatterBox = document.getElementById('scatter-box');
  let W;
  try {
    W = await Dash.loadJSON('data/worldbank.json');
  } catch (err) {
    Dash.showError(scatterBox, err);
    document.getElementById('scatter-count').textContent = '';
    return;
  }

  const minYear = new Date().getFullYear() - 10;
  const label = key => W.indicators[key].label;
  const group = new Set(W.groups?.china_lusophone?.members || []);
  const groupLabel = W.groups?.china_lusophone?.label || 'Highlighted group';

  const xSel = document.getElementById('x-select');
  const ySel = document.getElementById('y-select');
  const regionSel = document.getElementById('region-select');
  const logX = document.getElementById('log-x');
  const highlight = document.getElementById('highlight');

  const keys = Object.keys(W.indicators).filter(k => k !== 'population');
  const options = keys.map(k => `<option value="${k}">${Dash.esc(label(k))}</option>`).join('');
  xSel.innerHTML = options;
  ySel.innerHTML = options;
  xSel.value = 'health_exp_per_capita';
  ySel.value = 'life_expectancy';

  const regions = [...new Set(Object.values(W.countries).map(c => c.region))].sort();
  regionSel.innerHTML += regions.map(r => `<option value="${Dash.esc(r)}">${Dash.esc(r)}</option>`).join('');
  const regionColor = r => Dash.palette[regions.indexOf(r) % Dash.palette.length];

  // Most recent year (>= minYear) where both series have a value.
  function pairPoint(sx, sy) {
    if (!sx || !sy) return null;
    const years = Object.keys(sx).filter(y => +y >= minYear && sx[y] != null && sy[y] != null).sort();
    if (!years.length) return null;
    const y = years.at(-1);
    return { year: y, x: sx[y], y: sy[y] };
  }

  let chart;
  function renderScatter() {
    const xk = xSel.value, yk = ySel.value, region = regionSel.value;
    const hl = highlight.checked;
    const byRegion = {};
    const highlighted = [];
    let count = 0;

    for (const [iso, d] of Object.entries(W.data)) {
      const c = W.countries[iso];
      if (!c || (region !== 'all' && c.region !== region)) continue;
      const p = pairPoint(d[xk], d[yk]);
      if (!p || (logX.checked && p.x <= 0)) continue;
      const point = { x: p.x, y: p.y, name: c.name, year: p.year };
      if (hl && group.has(iso)) highlighted.push(point);
      else (byRegion[c.region] ||= []).push(point);
      count++;
    }

    const datasets = Object.entries(byRegion).map(([r, points]) => ({
      label: r,
      data: points,
      backgroundColor: regionColor(r) + (hl ? '66' : 'cc'),
      borderColor: regionColor(r),
      pointRadius: 5,
      pointHoverRadius: 7,
    }));
    if (highlighted.length) {
      // Added last so it is drawn on top.
      datasets.push({
        label: groupLabel,
        data: highlighted,
        backgroundColor: '#f5b041',
        borderColor: '#ffffff',
        borderWidth: 1.5,
        pointRadius: 7,
        pointHoverRadius: 9,
      });
    }

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('scatter-chart'), {
      type: 'scatter',
      data: { datasets },
      options: {
        maintainAspectRatio: false,
        scales: {
          x: {
            type: logX.checked ? 'logarithmic' : 'linear',
            title: { display: true, text: label(xk) },
            ticks: { callback: v => Dash.compact(v) },
          },
          y: { title: { display: true, text: label(yk) } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.raw.name} (${ctx.raw.year}): X ${Dash.fmt(ctx.raw.x, 1)}, Y ${Dash.fmt(ctx.raw.y, 1)}`,
            },
          },
        },
      },
    });

    document.getElementById('scatter-count').textContent =
      `${count} countries · latest year with both values, ${minYear} or later`;
  }

  [xSel, ySel, regionSel, logX, highlight].forEach(el => el.addEventListener('change', renderScatter));
  renderScatter();

  // Hospital beds per 1,000 international arrivals
  const bedRows = [];
  for (const [iso, d] of Object.entries(W.data)) {
    const c = W.countries[iso];
    const beds = Dash.latest(d.beds_per_1000, minYear);
    const pop = Dash.latest(d.population, minYear);
    const arr = Dash.latest(d.arrivals, minYear);
    if (!c || !beds || !pop || !arr || arr.value < 100000) continue;
    const totalBeds = beds.value * pop.value / 1000;
    bedRows.push({ iso, name: c.name, ratio: totalBeds / arr.value * 1000, beds, arr });
  }

  const scopeSel = document.getElementById('beds-scope');
  const orderSel = document.getElementById('beds-order');
  const tbody = document.querySelector('#beds-table tbody');

  function renderBeds() {
    const asc = orderSel.value === 'asc';
    const pool = scopeSel.value === 'group' ? bedRows.filter(r => group.has(r.iso)) : bedRows;
    const rows = [...pool].sort((a, b) => asc ? a.ratio - b.ratio : b.ratio - a.ratio).slice(0, 15);
    tbody.innerHTML = rows.length
      ? rows.map(r => `
          <tr${group.has(r.iso) ? ' class="hl"' : ''}>
            <td>${Dash.esc(r.name)}</td>
            <td class="num">${Dash.fmt(r.ratio, 2)}</td>
            <td class="num">${Dash.fmt(r.beds.value, 1)}<span class="yr">${r.beds.year}</span></td>
            <td class="num">${Dash.fmt(r.arr.value)}<span class="yr">${r.arr.year}</span></td>
          </tr>`).join('')
      : '<tr><td colspan="4" class="empty">No countries have all three indicators.</td></tr>';
  }

  [scopeSel, orderSel].forEach(el => el.addEventListener('change', renderBeds));
  renderBeds();
})();
