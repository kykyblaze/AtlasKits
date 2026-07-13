#!/usr/bin/env node
// build-ui.js
// Assembles ui.html from separate source files:
//   src/ui.css   → inlined into <style>
//   src/data.json → injected as JS globals (ORGANIZATIONS, COUNTRIES, CONTINENTS)
//   src/ui.js    → inlined into <script>
//   assets/**/*.svg → minified with svgo, stored as raw SVG strings in window.ASSETS
//
// Output: ui.html (single self-contained file for Figma)

const fs   = require('fs');
const path = require('path');
const { optimize } = require('svgo');

// ── Paths ────────────────────────────────────────────────────────────────
const ASSETS_DIR  = path.join(__dirname, 'assets');
const SRC_DIR     = path.join(__dirname, 'src');
const TEMPLATE    = path.join(__dirname, 'ui.src.html');
const OUTPUT      = path.join(__dirname, 'ui.html');

// ── Placeholders in ui.src.html ──────────────────────────────────────────
const PH_ASSETS = '/* ASSETS_INJECT */';
const PH_CSS    = '/* CSS_INJECT */';
const PH_DATA   = '/* DATA_INJECT */';
const PH_JS     = '/* JS_INJECT */';

// ── svgo configuration ───────────────────────────────────────────────────
// Note: removeViewBox is not an override inside preset-default in svgo v3+;
// preset-default already preserves viewBox by default.
const SVGO_CONFIG = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Keep IDs that may be referenced by gradients, clip-paths, etc.
          cleanupIds: false,
        },
      },
    },
  ],
};

// Folders to skip: Circle and Square flag variants are reproduced via CSS
// from the Rectangle SVG, so we only need to bundle Rectangle + Organizations.
// This eliminates ~492 duplicate SVGs (~21 MB raw).
const SKIP_DIRS = new Set([
  path.join(ASSETS_DIR, 'flags', 'Countries', 'Circle'),
  path.join(ASSETS_DIR, 'flags', 'Countries', 'Square'),
  path.join(ASSETS_DIR, 'flags', 'Organizations', 'Circle'),
  path.join(ASSETS_DIR, 'flags', 'Organizations', 'Square'),
]);

// ── Walk assets/, minify each SVG, build raw-string map ──────────────────
function buildAssetMap(dir) {
  const map = {};
  let skipped = 0;

  function walk(current) {
    // Skip Circle/Square flag folders — CSS handles those shapes
    if (SKIP_DIRS.has(current)) return;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.svg$/i.test(entry.name)) {
        // key = lowercase relative path, no extension, forward slashes
        const key = path
          .relative(ASSETS_DIR, full)
          .replace(/\\/g, '/')
          .replace(/\.svg$/i, '')
          .toLowerCase();

        const raw = fs.readFileSync(full, 'utf8');

        // Minify with svgo; fall back to raw string on error
        let minified = raw;
        try {
          const result = optimize(raw, { path: full, ...SVGO_CONFIG });
          minified = result.data;
        } catch (err) {
          console.warn(`⚠  svgo failed on ${full}: ${err.message}`);
          skipped++;
        }

        map[key] = minified;
      }
    }
  }

  walk(dir);
  if (skipped > 0) console.warn(`⚠  svgo skipped ${skipped} files (used raw fallback)`);
  return map;
}

// ── Read a source file or exit with a clear error ────────────────────────
function readSource(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Source file not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// ── Build data injection string from data.json ───────────────────────────
function buildDataInjection() {
  const data = JSON.parse(readSource(path.join(SRC_DIR, 'data.json')));
  const lines = [];
  lines.push(`const ORGANIZATIONS = ${JSON.stringify(data.organizations)};`);
  lines.push(`const COUNTRIES = ${JSON.stringify(data.countries)};`);
  lines.push(`const CONTINENTS = ${JSON.stringify(data.continents)};`);
  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────
console.log('Minifying SVGs with svgo…');
const assetMap   = buildAssetMap(ASSETS_DIR);
const assetCount = Object.keys(assetMap).length;

if (assetCount === 0) {
  console.error('✗ No SVG files found in assets/');
  process.exit(1);
}

let template = readSource(TEMPLATE);

// Verify all placeholders exist
const placeholders = [PH_ASSETS, PH_CSS, PH_DATA, PH_JS];
for (const ph of placeholders) {
  if (!template.includes(ph)) {
    console.error(`✗ Placeholder "${ph}" not found in ui.src.html`);
    process.exit(1);
  }
}

// Inject CSS
const css = readSource(path.join(SRC_DIR, 'ui.css'));
template = template.replace(PH_CSS, css);

// Inject asset map — raw SVG strings, NOT base64
// JSON.stringify handles all necessary escaping for the JS string values
const assetsInjection = `window.ASSETS = ${JSON.stringify(assetMap)};`;
template = template.replace(PH_ASSETS, assetsInjection);

// Inject data
const dataInjection = buildDataInjection();
template = template.replace(PH_DATA, dataInjection);

// Inject JS
const js = readSource(path.join(SRC_DIR, 'ui.js'));
template = template.replace(PH_JS, js);

// Write output
fs.writeFileSync(OUTPUT, template, 'utf8');

const bytes = Buffer.byteLength(template, 'utf8');
const kb = (bytes / 1024).toFixed(1);
const mb = (bytes / 1024 / 1024).toFixed(2);
console.log(`✓  Bundled ${assetCount} SVGs (raw strings, svgo-minified)`);
console.log(`✓  Inlined: ui.css (${(Buffer.byteLength(css, 'utf8') / 1024).toFixed(1)} KB)`);
console.log(`✓  Inlined: data.json → JS globals`);
console.log(`✓  Inlined: ui.js (${(Buffer.byteLength(js, 'utf8') / 1024).toFixed(1)} KB)`);
console.log(`✓  Written ui.html → ${kb} KB (${mb} MB)`);

if (parseFloat(mb) > 15) {
  console.warn(`ui.html is ${mb} MB — still exceeds Figma's 15 MB publish limit!`);
} else {
  console.log(`Under Figma's 15 MB limit ✓`);
}
