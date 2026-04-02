#!/usr/bin/env node
// build-ui.js
// Reads every SVG from assets/, base64-encodes each one,
// injects them as window.ASSETS into ui.src.html → ui.html.

const fs   = require('fs');
const path = require('path');

const ASSETS_DIR  = path.join(__dirname, 'assets');
const TEMPLATE    = path.join(__dirname, 'ui.src.html');
const OUTPUT      = path.join(__dirname, 'ui.html');
const PLACEHOLDER = '/* ASSETS_INJECT */';

// ── Walk assets/, build lowercase-keyed base64 map ───────────────────────
function buildAssetMap(dir) {
  const map = {};

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.svgg?$/i.test(entry.name)) {
        // key = lowercase relative path, no extension, forward slashes
        const key = path
          .relative(ASSETS_DIR, full)
          .replace(/\\/g, '/')
          .replace(/\.svgg?$/i, '')
          .toLowerCase();
        map[key] = Buffer.from(fs.readFileSync(full, 'utf8')).toString('base64');
      }
    }
  }

  walk(dir);
  return map;
}

// ── Main ─────────────────────────────────────────────────────────────────
const map   = buildAssetMap(ASSETS_DIR);
const count = Object.keys(map).length;

if (count === 0) {
  console.error('✗ No SVG files found in assets/');
  process.exit(1);
}

const template = fs.readFileSync(TEMPLATE, 'utf8');

if (!template.includes(PLACEHOLDER)) {
  console.error(`✗ Placeholder "${PLACEHOLDER}" not found in ui.src.html`);
  process.exit(1);
}

const injection = `window.ASSETS = ${JSON.stringify(map)};`;
const output    = template.replace(PLACEHOLDER, injection);

fs.writeFileSync(OUTPUT, output, 'utf8');

const kb = (Buffer.byteLength(output, 'utf8') / 1024).toFixed(1);
console.log(`✓  Bundled ${count} SVGs`);
console.log(`✓  Written ui.html (${kb} KB)`);
