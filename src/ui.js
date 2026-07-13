// ─────────────────────────────────────────
// FlagMap – UI Logic
// Data (ORGANIZATIONS, COUNTRIES, CONTINENTS) is injected by build-ui.js
// Assets (window.ASSETS) is injected by build-ui.js as raw SVG strings
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// ASSET KEY BUILDERS
// Keys are lowercase paths matching the assets/ folder structure (no extension).
// ─────────────────────────────────────────
function flagKey(name, shape, section) {
  // Circle and Square SVGs are NOT bundled — CSS handles those shapes via
  // border-radius / aspect-ratio on the <img> wrapper. We always load the
  // rectangle asset and let CSS do the visual transformation.
  void shape; // shape param kept for call-site compatibility
  return `flags/${section.toLowerCase()}/rectangle/${name.toLowerCase()}`;
}
function mapKey(name) {
  const normalized = name.toLowerCase().trim();

  // Try direct path first
  const directKey = `maps/countries/${normalized}`;
  if (window.ASSETS && window.ASSETS[directKey]) return directKey;

  // Search keys if there's any encoding or accent mismatch
  if (window.ASSETS) {
    const clean = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const key of Object.keys(window.ASSETS)) {
      if (key.startsWith("maps/countries/")) {
        const keyParts = key.split('/');
        const keyName = keyParts[keyParts.length - 1];
        const cleanKeyName = keyName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (cleanKeyName === clean) {
          return key;
        }
      }
    }
  }

  // Fallback
  return `maps/countries/${normalized}`;
}
function continentKey(name) {
  return `maps/continents/${name.toLowerCase()}`;
}

function assetPathKey(item) {
  if (state.tab === 'flags') {
    const section = item.type === 'organization' ? 'Organizations' : 'Countries';
    return flagKey(item.name, state.shape, section);
  }
  if (state.tab === 'maps') {
    return item.type === 'continent' ? continentKey(item.name) : mapKey(item.name);
  }
  return '';
}

// ─────────────────────────────────────────
// DERIVED DATA
// ─────────────────────────────────────────
const MAP_COUNTRIES = COUNTRIES.map(c => ({ name: c.name, iso: c.iso, iso3: c.iso3, type: 'country' }));

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────

let state = {
  tab: 'flags',  // 'flags' | 'maps'
  shape: 'rect',   // 'rect' | 'sq' | 'circ'
  query: '',
  selected: new Set(), // Set of item keys e.g. "flags:country:US"
};

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function selectionKey(tab, item) {
  const id = item.iso || item.name;
  const typePrefix = item.type ? `${item.type}:` : '';
  return `${tab}:${typePrefix}${id}`;
}

function filterItems(items, query, hasIso = true) {
  if (!query) return items;
  const q = query.toLowerCase().trim();
  return items.filter(i => {
    const nameMatch = i.name.toLowerCase().includes(q);
    const isoMatch = hasIso && (
      (i.iso && i.iso.toLowerCase().includes(q)) ||
      (i.iso3 && i.iso3.toLowerCase().includes(q))
    );
    return nameMatch || isoMatch;
  });
}

function imgClass() {
  if (state.tab === 'flags') return state.shape;
  return 'map';
}

// ─────────────────────────────────────────
// RENDER HELPERS
// ─────────────────────────────────────────
function renderImg(item) {
  const cls = imgClass();
  const key = assetPathKey(item);
  const svgRaw = (window.ASSETS && window.ASSETS[key]) || '';

  if (!svgRaw) {
    return `<div class="item-img-wrap ${cls}">
      <div class="img-placeholder ${cls}">${escapeHtml(item.iso || '?')}</div>
    </div>`;
  }

  // Use a URL-encoded data URI — no base64 overhead, works in all browsers
  const dataUri = 'data:image/svg+xml,' + encodeURIComponent(svgRaw);
  return `<div class="item-img-wrap ${cls}">
    <img src="${dataUri}" alt="${escapeHtml(item.name)}">
  </div>`;
}

function renderItem(item) {
  const key = selectionKey(state.tab, item);
  const sel = state.selected.has(key) ? 'selected' : '';
  return `<div class="item ${sel}" data-key="${escapeHtml(key)}" data-name="${escapeHtml(item.name)}">
    ${renderImg(item)}
    <div class="item-name">${escapeHtml(item.name)}</div>
    <div class="item-check">
      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
        <path d="M1 3L3 5L7 1" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>`;
}

function renderSection(label, items) {
  if (!items.length) return '';
  return `
    <div class="section-label">${label} <span style="color:var(--accent);font-weight:700">${items.length}</span></div>
    <div class="grid">${items.map(renderItem).join('')}</div>
  `;
}

function emptyHTML() {
  return `<div class="empty">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5"/>
      <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    No results found
  </div>`;
}

// ─────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────
function render() {
  const content = document.getElementById('contentArea');
  const q = state.query;

  document.getElementById('filterBar').classList.toggle('visible', state.tab === 'flags');

  let html = '';

  if (state.tab === 'flags') {
    const organizations = filterItems(ORGANIZATIONS, q);
    const countries = filterItems(COUNTRIES.map(c => ({ ...c, type: 'country' })), q);
    if (!organizations.length && !countries.length) {
      html = emptyHTML();
    } else {
      html += renderSection('Organizations', organizations);
      html += renderSection('Countries', countries);
    }
  } else {
    const continents = filterItems(CONTINENTS, q, false);
    const countries = filterItems(MAP_COUNTRIES, q);
    if (!continents.length && !countries.length) {
      html = emptyHTML();
    } else {
      html += renderSection('Continents', continents);
      html += renderSection('Countries', countries);
    }
  }

  content.innerHTML = html;
  updateFooter();
  bindItemClicks();
}

function updateFooter() {
  const count = state.selected.size;
  const badge = document.getElementById('countBadge');
  const btn = document.getElementById('btnAdd');
  if (count === 0) {
    badge.innerHTML = 'No items selected';
    btn.textContent = 'Add';
    btn.disabled = true;
  } else {
    badge.innerHTML = `<span>${count}</span> item${count !== 1 ? 's' : ''} selected`;
    btn.textContent = `Add ${count}`;
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────
function bindItemClicks() {
  document.querySelectorAll('.item').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      if (state.selected.has(key)) {
        state.selected.delete(key);
        el.classList.remove('selected');
      } else {
        state.selected.add(key);
        el.classList.add('selected');
      }
      updateFooter();
    });
  });
}

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const t = tab.dataset.tab;
    if (t === state.tab) return;
    state.tab = t;
    state.query = '';
    state.selected.clear();
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    render();
  });
});

// Search
document.getElementById('searchInput').addEventListener('input', e => {
  state.query = e.target.value;
  render();
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.shape = btn.dataset.shape;
    state.selected.clear();
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

// Add button — resolves each selected key to its SVG text, sends to code.js
document.getElementById('btnAdd').addEventListener('click', () => {
  if (state.selected.size === 0) return;

  const items = [];

  state.selected.forEach(key => {
    // Parse key: "tab:type:id"
    const [tab, ...rest] = key.split(':');
    const id = rest.slice(1).join(':');
    const type = rest[0];

    let found = null;

    if (tab === 'flags') {
      const pool = type === 'organization' ? ORGANIZATIONS : COUNTRIES;
      found = pool.find(i => i.iso === id || i.name === id);
      if (found) found = { ...found, type: type || 'country' };
    } else {
      const pool = type === 'continent' ? CONTINENTS : MAP_COUNTRIES;
      found = pool.find(i => i.iso === id || i.name === id);
    }

    if (!found) return;

    // Build the asset key and decode SVG text
    let assetKey = '';
    // Always resolve to the rectangle asset key — circle/square are CSS-only
    if (tab === 'flags') {
      const section = found.type === 'organization' ? 'Organizations' : 'Countries';
      assetKey = flagKey(found.name, 'rect', section);
    } else {
      assetKey = found.type === 'continent' ? continentKey(found.name) : mapKey(found.name);
    }

    // window.ASSETS now stores raw SVG strings — no atob() needed
    const svgText = (window.ASSETS && window.ASSETS[assetKey]) || '';

    items.push({
      name: found.name,
      iso: found.iso || '',
      svgText,
      tab,
      shape: tab === 'flags' ? state.shape : null,
    });
  });

  parent.postMessage({ pluginMessage: { type: 'add-assets', items } }, '*');
  state.selected.clear();
  showToast(`Added ${items.length} item${items.length !== 1 ? 's' : ''}`);
  render();
});

// Toast
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// Messages from plugin
window.addEventListener('message', e => {
  const msg = e.data.pluginMessage;
  if (!msg) return;
  if (msg.type === 'add-success') showToast(`Added ${msg.count} item${msg.count !== 1 ? 's' : ''} ✓`);
  if (msg.type === 'add-error') showToast('Error: ' + msg.message);
});

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
render();
