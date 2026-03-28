// ─────────────────────────────────────────────────────────────────
// AtlasKits – Figma Plugin (code.js)
// Supports: Figma Design, FigJam, Figma Slides
// SVGs are fetched from a remote CDN/hosted URL.
// ─────────────────────────────────────────────────────────────────

const PLUGIN_WIDTH  = 320;
const PLUGIN_HEIGHT = 560;

// Shape dimensions (px) matching the UI filter
const SHAPE_SIZES = {
  rect: { w: 180, h: 120 },
  sq:   { w: 120, h: 120 },
  circ: { w: 120, h: 120 },
};

const DEFAULT_SIZE  = { w: 160, h: 160 };
const COAT_SIZE     = { w: 140, h: 160 };
const MAP_SIZE      = { w: 240, h: 180 };
const ITEM_SPACING  = 24; // gap between placed nodes

// ─────────────────────────────────────────
// Boot – show UI
// ─────────────────────────────────────────
figma.showUI(__html__, {
  width:  PLUGIN_WIDTH,
  height: PLUGIN_HEIGHT,
  title:  "Country Assets",
  themeColors: true,
});

// ─────────────────────────────────────────
// Message handler
// ─────────────────────────────────────────
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'add-assets') {
    await handleAddAssets(msg.items);
  }
};

// ─────────────────────────────────────────
// Core: fetch SVG from CDN → place on canvas
// ─────────────────────────────────────────
async function handleAddAssets(items) {
  if (!items || items.length === 0) return;

  const nodes   = [];
  const failed  = [];

  for (const item of items) {
    try {
      const node = await placeAsset(item);
      if (node) {
        nodes.push(node);
      } else {
        failed.push(item.name);
      }
    } catch (err) {
      console.error(`Failed to place "${item.name}":`, err);
      failed.push(item.name);
    }
  }

  if (nodes.length === 0) {
    figma.ui.postMessage({
      type: 'add-error',
      message: 'Could not load any SVG files. Check your CDN URL and network access settings in manifest.json.'
    });
    return;
  }

  await arrangeNodes(nodes);

  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);

  figma.ui.postMessage({ type: 'add-success', count: nodes.length });

  if (failed.length > 0) {
    console.warn('Some items failed to load:', failed);
  }
}

// ─────────────────────────────────────────
// Fetch SVG text from CDN and create a node
// ─────────────────────────────────────────
async function placeAsset(item) {
  // Fetch SVG from hosted CDN URL
  let svgText = null;

  try {
    const response = await fetch(item.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${item.url}`);
    }
    const text = await response.text();
    // Basic SVG validation
    if (!text.includes('<svg')) {
      throw new Error('Response does not appear to be an SVG');
    }
    svgText = text;
  } catch (err) {
    console.error(`Fetch failed for "${item.name}" (${item.url}):`, err);
    return createPlaceholder(item);
  }

  // Create Figma node from SVG string
  let svgNode;
  try {
    svgNode = figma.createNodeFromSvg(svgText);
  } catch (err) {
    console.error(`createNodeFromSvg failed for "${item.name}":`, err);
    return createPlaceholder(item);
  }

  svgNode.name = item.name;

  // Resize to target dimensions
  const size = getSize(item);
  svgNode.resize(size.w, size.h);

  // Wrap in a clipping frame for circle flags
  if (item.tab === 'flags' && item.shape === 'circ') {
    return applyCircleClip(svgNode, size);
  }

  return svgNode;
}

// ─────────────────────────────────────────
// Wrap node in a circle clip mask
// ─────────────────────────────────────────
function applyCircleClip(innerNode, size) {
  const frame = figma.createFrame();
  frame.name = innerNode.name;
  frame.resize(size.w, size.h);
  frame.clipsContent = true;
  frame.cornerRadius = size.w / 2;
  frame.fills = [];
  innerNode.x = 0;
  innerNode.y = 0;
  frame.appendChild(innerNode);
  return frame;
}

// ─────────────────────────────────────────
// Placeholder when SVG cannot be loaded
// ─────────────────────────────────────────
async function createPlaceholder(item) {
  const size = getSize(item);
  const frame = figma.createFrame();
  frame.name = item.name + ' (missing SVG)';
  frame.resize(size.w, size.h);
  frame.fills = [{ type: 'SOLID', color: { r: 0.18, g: 0.18, b: 0.22 } }];

  if (item.tab === 'flags' && item.shape === 'circ') {
    frame.cornerRadius = size.w / 2;
  }

  // Load default font before creating text
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const text = figma.createText();
  text.fontName = { family: 'Inter', style: 'Regular' };
  text.characters = item.iso || item.name.substring(0, 2).toUpperCase();
  text.fontSize = Math.max(8, Math.round(size.h * 0.3));
  text.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.7 } }];
  text.textAlignHorizontal = 'CENTER';
  text.textAlignVertical = 'CENTER';
  text.resize(size.w, size.h);
  frame.appendChild(text);

  return frame;
}

// ─────────────────────────────────────────
// Determine target size for item
// ─────────────────────────────────────────
function getSize(item) {
  if (item.tab === 'flags') return SHAPE_SIZES[item.shape] || SHAPE_SIZES.rect;
  if (item.tab === 'coats') return COAT_SIZE;
  if (item.tab === 'maps')  return MAP_SIZE;
  return DEFAULT_SIZE;
}

// ─────────────────────────────────────────
// Arrange placed nodes on canvas
// ─────────────────────────────────────────
async function arrangeNodes(nodes) {
  // Place inside a selected frame/component if one is active
  const selection  = figma.currentPage.selection;
  const targetFrame =
    selection.length === 1 &&
    (selection[0].type === 'FRAME' || selection[0].type === 'COMPONENT' || selection[0].type === 'GROUP')
      ? selection[0]
      : null;

  const vp = figma.viewport.bounds;
  const totalW = nodes.reduce((sum, n) => sum + n.width + ITEM_SPACING, -ITEM_SPACING);
  const maxH   = Math.max(...nodes.map(n => n.height));

  let x = targetFrame ? 16 : vp.x + (vp.width  - totalW) / 2;
  let y = targetFrame ? 16 : vp.y + (vp.height - maxH)   / 2;

  for (const node of nodes) {
    if (targetFrame) {
      targetFrame.appendChild(node);
    } else {
      figma.currentPage.appendChild(node);
    }
    node.x = Math.round(x);
    node.y = Math.round(y);
    x += node.width + ITEM_SPACING;
  }
}
