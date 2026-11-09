const Dash = (() => {
  const palette = [
    '#4da3ff', '#2dd4bf', '#a78bfa', '#38bdf8', '#fbbf24', '#93c5fd',
    '#f472b6', '#22d3ee', '#86efac', '#fca5a5', '#c4b5fd',
  ];

  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.json();
  }

  async function loadText(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.text();
  }

  // Simple CSV parser: no quoted fields, so values must not contain commas.
  function parseCSV(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const head = lines[0].split(',').map(s => s.trim());
    return lines.slice(1).map(line => {
      const cells = line.split(',').map(s => s.trim());
      return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
    });
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function fmt(n, digits = 0) {
    if (n == null || Number.isNaN(Number(n))) return '–';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });
  }

  function compact(n) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }

  // Most recent non-null value in a {year: value} series.
  function latest(series, minYear) {
    let best = null;
    for (const [year, value] of Object.entries(series || {})) {
      if (value == null || (minYear && +year < minYear)) continue;
      if (!best || +year > best.year) best = { year: +year, value };
    }
    return best;
  }

  function showError(container, err) {
    container.innerHTML = `<p class="empty">Data not available yet. ${esc(err?.message || '')}</p>`;
  }

  // Highlight the current page in the nav.
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === page) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });

  // Dark theme defaults for Chart.js.
  if (window.Chart) {
    Chart.defaults.color = '#8ea5c3';
    Chart.defaults.borderColor = 'rgba(30, 58, 100, 0.6)';
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  }

  return { palette, loadJSON, loadText, parseCSV, esc, fmt, compact, latest, showError };
})();
