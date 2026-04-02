// ─────────────────────────────────────────────────────────────────
// AtlasKits – Figma Plugin (code.js)
// Supports: Figma Design, FigJam, Figma Slides
// SVGs are bundled locally — no network requests needed.
// ─────────────────────────────────────────────────────────────────

const PLUGIN_WIDTH  = 320;
const PLUGIN_HEIGHT = 560;

// Shape dimensions (px) matching the UI filter
const SHAPE_SIZES = {
  rect: { w: 75,  h: 50  },
  sq:   { w: 50,  h: 50  },
  circ: { w: 50,  h: 50  },
};

const COAT_SIZE    = { w: 140, h: 160 };
const MAP_SIZE     = { w: 240, h: 180 };
const ITEM_SPACING = 24; // gap between placed nodes

// ─────────────────────────────────────────
// Boot – show UI
// ─────────────────────────────────────────
figma.showUI(__html__, {
  width:       PLUGIN_WIDTH,
  height:      PLUGIN_HEIGHT,
  title:       "AtlasKits",
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
// Core: place each SVG on the canvas
// ─────────────────────────────────────────
async function handleAddAssets(items) {
  if (!items || items.length === 0) return;

  const nodes  = [];
  const failed = [];

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
    figma.ui.postMessage({ type: 'add-error', message: 'Could not place any SVG nodes.' });
    return;
  }

  await arrangeNodes(nodes);
  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);
  figma.ui.postMessage({ type: 'add-success', count: nodes.length });

  if (failed.length > 0) {
    console.warn('Some items failed to place:', failed);
  }
}

// ─────────────────────────────────────────
// Create a Figma node from the bundled SVG text
// ─────────────────────────────────────────
async function placeAsset(item) {
  const svgText = item.svgText;

  if (!svgText || !svgText.includes('<svg')) {
    return createPlaceholder(item);
  }

  let svgNode;
  try {
    svgNode = figma.createNodeFromSvg(svgText);
  } catch (err) {
    console.error(`createNodeFromSvg failed for "${item.name}":`, err);
    return createPlaceholder(item);
  }

  svgNode.name = item.name;

  const size = getSize(item);
  svgNode.resize(size.w, size.h);

  // Wrap circle flags in a clipping frame
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
  frame.name         = innerNode.name;
  frame.resize(size.w, size.h);
  frame.clipsContent = true;
  frame.cornerRadius = size.w / 2;
  frame.fills        = [];
  innerNode.x        = 0;
  innerNode.y        = 0;
  frame.appendChild(innerNode);
  return frame;
}

// ─────────────────────────────────────────
// Placeholder when SVG is unavailable
// ─────────────────────────────────────────
async function createPlaceholder(item) {
  const size  = getSize(item);
  const frame = figma.createFrame();
  frame.name   = `${item.name} (missing SVG)`;
  frame.resize(size.w, size.h);
  frame.fills  = [{ type: 'SOLID', color: { r: 0.18, g: 0.18, b: 0.22 } }];

  if (item.tab === 'flags' && item.shape === 'circ') {
    frame.cornerRadius = size.w / 2;
  }

  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const text = figma.createText();
  text.fontName              = { family: 'Inter', style: 'Regular' };
  text.characters            = item.iso || item.name.substring(0, 2).toUpperCase();
  text.fontSize              = Math.max(8, Math.round(size.h * 0.3));
  text.fills                 = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.7 } }];
  text.textAlignHorizontal   = 'CENTER';
  text.textAlignVertical     = 'CENTER';
  text.resize(size.w, size.h);
  frame.appendChild(text);

  return frame;
}

// ─────────────────────────────────────────
// Determine target size for an item
// ─────────────────────────────────────────
function getSize(item) {
  if (item.tab === 'flags') return SHAPE_SIZES[item.shape] || SHAPE_SIZES.rect;
  if (item.tab === 'coats') return COAT_SIZE;
  if (item.tab === 'maps')  return MAP_SIZE;
  return SHAPE_SIZES.rect;
}

// ─────────────────────────────────────────
// Arrange placed nodes on the canvas
// ─────────────────────────────────────────
async function arrangeNodes(nodes) {
  const selection   = figma.currentPage.selection;
  const targetFrame =
    selection.length === 1 &&
    (selection[0].type === 'FRAME' || selection[0].type === 'COMPONENT' || selection[0].type === 'GROUP')
      ? selection[0]
      : null;

  const vp     = figma.viewport.bounds;
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
