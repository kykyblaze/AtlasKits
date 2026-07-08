# FlagMap

A Figma plugin for browsing and inserting country flags, maps, and continent maps as SVG nodes onto the canvas.

**Supports:** Figma Design, FigJam, Figma Slides

## Features

- 🏳 **Flags** — 196 countries + 7 organizations in rectangle, square, and circle shapes
- 🗺 **Maps** — Country outlines and continent silhouettes
- Search by country name or ISO code
- Multi-select and batch-insert onto the canvas
- Auto-arrangement in viewport or within a selected frame

## Project Structure

```
├── src/
│   ├── ui.css        # All UI styles
│   ├── ui.js         # UI logic (state, render, events)
│   └── data.json     # Country/org/continent data
├── assets/           # SVG source files (flags + maps)
├── ui.src.html       # HTML template with placeholders
├── build-ui.js       # Build script — assembles ui.html
├── code.js           # Figma sandbox (node creation)
├── manifest.json     # Figma plugin manifest
└── package.json      # npm config
```

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Build the UI:
   ```
   npm run build
   ```
   This reads SVGs from `assets/`, inlines `src/ui.css`, `src/data.json`, and `src/ui.js` into `ui.src.html`, and outputs a self-contained `ui.html`.

3. Load the plugin in Figma:
   - Open Figma → Plugins → Development → Import plugin from manifest
   - Select `manifest.json` from this directory

## Development

- **Edit styles** in `src/ui.css`
- **Edit logic** in `src/ui.js`
- **Edit data** in `src/data.json`
- **Rebuild** with `npm run build` after any change
- **Lint** with `npm run lint`
