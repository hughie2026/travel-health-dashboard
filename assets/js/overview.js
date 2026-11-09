(async () => {
  const [wbRes, osmRes] = await Promise.allSettled([
    Dash.loadJSON('data/worldbank.json'),
    Dash.loadJSON('data/wellness_osm.json'),
  ]);
  const W = wbRes.status === 'fulfilled' ? wbRes.value : null;
  const O = osmRes.status === 'fulfilled' ? osmRes.value : null;

  const setKPI = (id, value, note) => {
    const el = document.getElementById(id);
    el.querySelector('.kpi-value').textContent = value;
    el.querySelector('.kpi-note').textContent = note;
  };

  if (W) {
    const n = Object.values(W.data)
      .filter(d => Dash.latest(d.arrivals) && Dash.latest(d.health_exp_per_capita)).length;
    setKPI('kpi-countries', Dash.fmt(n), 'with tourism and health-spending data');
    const mac = Dash.latest(W.data.MAC?.arrivals);
    setKPI('kpi-macao', mac ? Dash.compact(mac.value) : '–',
      mac ? `international arrivals in ${mac.year}` : 'no World Bank value');
  } else {
    setKPI('kpi-countries', '–', 'World Bank data not loaded');
    setKPI('kpi-macao', '–', 'World Bank data not loaded');
  }

  if (O) {
    const cities = Object.values(O.cities);
    const total = cities.reduce((sum, c) => sum + c.places.length, 0);
    setKPI('kpi-places', Dash.fmt(total), `medical and wellness places in ${cities.length} cities`);
  } else {
    setKPI('kpi-places', '–', 'OpenStreetMap data not loaded');
  }

  const dates = [W, O].filter(Boolean).map(x => x.generated).sort();
  setKPI('kpi-updated', dates.length ? dates[0].slice(0, 10) : '–',
    dates.length ? 'oldest refresh among sources' : 'no data loaded');

  const box = document.getElementById('arrivals-box');
  if (!W) { Dash.showError(box, wbRes.reason); return; }

  const allMembers = W.groups?.china_lusophone?.members || [];
  const members = allMembers.filter(iso => W.countries[iso] && W.data[iso]?.arrivals);
  const color = iso => Dash.palette[allMembers.indexOf(iso) % Dash.palette.length];
  const years = [...new Set(members.flatMap(iso => Object.keys(W.data[iso].arrivals)))].sort();

  new Chart(document.getElementById('arrivals-chart'), {
    type: 'line',
    data: {
      labels: years,
      datasets: members.map(iso => ({
        label: W.countries[iso].name,
        data: years.map(y => W.data[iso].arrivals[y] ?? null),
        borderColor: color(iso),
        backgroundColor: color(iso),
        borderWidth: iso === 'MAC' ? 3 : 2,
        tension: 0.25,
        pointRadius: 0,
        spanGaps: true,
      })),
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: { y: { type: 'logarithmic', ticks: { callback: v => Dash.compact(v) } } },
      plugins: {
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${Dash.fmt(c.raw)}` } },
      },
    },
  });
})();
