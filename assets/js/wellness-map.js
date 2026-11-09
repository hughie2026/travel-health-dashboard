(async () => {
  const CATS = {
    hospital:   { label: 'Hospitals',                  color: '#4da3ff' },
    clinic:     { label: 'Clinics',                    color: '#93c5fd' },
    hot_spring: { label: 'Hot springs & public baths', color: '#2dd4bf' },
    spa:        { label: 'Spas',                       color: '#a78bfa' },
    fitness:    { label: 'Fitness & yoga',             color: '#fbbf24' },
  };

  const mapEl = document.getElementById('map');
  let O;
  try {
    O = await Dash.loadJSON('data/wellness_osm.json');
  } catch (err) {
    Dash.showError(mapEl, err);
    return;
  }

  const map = L.map('map', { preferCanvas: true });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  const layers = Object.fromEntries(Object.keys(CATS).map(k => [k, L.layerGroup().addTo(map)]));
  const visible = Object.fromEntries(Object.keys(CATS).map(k => [k, true]));

  const citySel = document.getElementById('city');
  citySel.innerHTML = Object.entries(O.cities)
    .map(([key, c]) => `<option value="${Dash.esc(key)}">${Dash.esc(c.name)}</option>`).join('');

  const legend = document.getElementById('legend');

  function renderLegend(counts) {
    legend.innerHTML = Object.entries(CATS).map(([key, c]) => `
      <label>
        <input type="checkbox" data-cat="${key}" ${visible[key] ? 'checked' : ''}>
        <span class="dot" style="background:${c.color}"></span>
        ${c.label} (${Dash.fmt(counts[key] || 0)})
      </label>`).join('');
    legend.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        const cat = input.dataset.cat;
        visible[cat] = input.checked;
        if (input.checked) map.addLayer(layers[cat]);
        else map.removeLayer(layers[cat]);
      });
    });
  }

  function showCity(key) {
    const city = O.cities[key];
    Object.values(layers).forEach(layer => layer.clearLayers());
    const counts = {};

    for (const p of city.places) {
      const cat = CATS[p.cat];
      if (!cat) continue;
      counts[p.cat] = (counts[p.cat] || 0) + 1;
      L.circleMarker([p.lat, p.lon], {
        radius: 5,
        color: cat.color,
        fillColor: cat.color,
        fillOpacity: 0.75,
        weight: 1,
      })
        .bindPopup(`<strong>${Dash.esc(p.name || 'Unnamed')}</strong><br>${cat.label}`)
        .addTo(layers[p.cat]);
    }

    const [s, w, n, e] = city.bbox;
    map.fitBounds([[s, w], [n, e]]);
    renderLegend(counts);
  }

  citySel.addEventListener('change', () => showCity(citySel.value));
  showCity(citySel.value);

  document.getElementById('map-updated').textContent =
    `OpenStreetMap extract refreshed ${O.generated.slice(0, 10)}.`;
})();
