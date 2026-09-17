// Fabric.js canvas, text/shape/draw tools, undo/redo

const { fabric } = window;

// A4 dimensions at 96 DPI
export const A4_WIDTH = 794;
export const A4_HEIGHT = 1123;

let canvas = null;

// Shape drawing state
let isDrawingShape = false;
let shapeStartPoint = null;
let tempShape = null;

// Undo/Redo
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;
let skipHistory = false;

export function pauseHistory() {
  skipHistory = true;
}

export function resumeHistory(andSave = false) {
  skipHistory = false;
  if (andSave) saveState();
}

export function hexToRgba(hex, opacityPercent = 100) {
  if (!hex || hex === 'transparent') return 'transparent';
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.substring(0, 2), 16) || 0;
  const g = parseInt(c.substring(2, 4), 16) || 0;
  const b = parseInt(c.substring(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(1, Math.round((opacityPercent / 100) * 100) / 100));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function parseColorAndOpacity(colorStr) {
  if (!colorStr || colorStr === 'transparent') {
    return { hex: '#1c1917', opacity: 100, isTransparent: true };
  }
  if (typeof colorStr !== 'string') {
    return { hex: '#1c1917', opacity: 100, isTransparent: false };
  }
  const rgbaMatch = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
    const a = rgbaMatch[4] !== undefined ? Math.round(parseFloat(rgbaMatch[4]) * 100) : 100;
    return { hex: `#${r}${g}${b}`, opacity: a, isTransparent: a === 0 };
  }
  if (colorStr.startsWith('#')) {
    let h = colorStr;
    if (h.length === 4) {
      h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    }
    return { hex: h, opacity: 100, isTransparent: false };
  }
  return { hex: colorStr, opacity: 100, isTransparent: false };
}

export async function ensureFontLoaded(fontFamily, fontSize = 24) {
  if (!fontFamily) return;
  const clean = fontFamily.replace(/['"]/g, '');
  try {
    if (document.fonts) {
      await Promise.all([
        document.fonts.load(`${fontSize}px "${clean}"`),
        document.fonts.load(`400px "${clean}"`),
      ]);
      await document.fonts.ready;
    }
    if (window.fabric && window.fabric.util && window.fabric.util.clearFabricFontCache) {
      window.fabric.util.clearFabricFontCache();
    }
  } catch (e) {
    console.warn('Font load check:', e);
  }
}

// Guide Canvas & Canvas HUD
let guideCanvas = null;
let guideCtx = null;
let canvasHud = null;
let hudIcon = null;
let hudText = null;

const HUD_ICONS = {
  target: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  ruler: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3l-6.6 6.6a2 2 0 0 1-2.8 0L2.7 12.7a2 2 0 0 1 0-2.8l6.6-6.6a2 2 0 0 1 2.8 0l9.2 9.2a2 2 0 0 1 0 2.8z"/><line x1="8.5" y1="8.5" x2="10" y2="7"/><line x1="12" y1="12" x2="13.5" y2="10.5"/><line x1="15.5" y1="15.5" x2="17" y2="14"/></svg>`,
};

function initGuidesAndHUD() {
  guideCanvas = document.getElementById('guide-canvas');
  if (guideCanvas) {
    const dpr = fabric.devicePixelRatio || window.devicePixelRatio || 1;
    guideCanvas.width = A4_WIDTH * dpr;
    guideCanvas.height = A4_HEIGHT * dpr;
    guideCanvas.style.width = `${A4_WIDTH}px`;
    guideCanvas.style.height = `${A4_HEIGHT}px`;
    guideCtx = guideCanvas.getContext('2d');
    guideCtx.scale(dpr, dpr);
    guideCtx.imageSmoothingEnabled = true;
    guideCtx.imageSmoothingQuality = 'high';
  }
  canvasHud = document.getElementById('canvas-hud');
  hudIcon = document.getElementById('hud-icon');
  hudText = document.getElementById('hud-text');
}

export function showHUD(x, y, icon, text) {
  if (!canvasHud) return;
  canvasHud.style.left = `${Math.round(x)}px`;
  canvasHud.style.top = `${Math.round(y)}px`;
  if (hudIcon) {
    if (typeof icon === 'string' && icon.startsWith('<svg')) {
      hudIcon.innerHTML = icon;
    } else if (icon === '🎯') {
      hudIcon.innerHTML = HUD_ICONS.target;
    } else if (icon === '📐') {
      hudIcon.innerHTML = HUD_ICONS.ruler;
    } else {
      hudIcon.textContent = icon;
    }
  }
  if (hudText) hudText.textContent = text;
  canvasHud.classList.remove('hidden');
}

export function hideHUD() {
  if (!canvasHud) return;
  canvasHud.classList.add('hidden');
}

export function clearGuideLines() {
  if (guideCtx) {
    guideCtx.clearRect(0, 0, A4_WIDTH, A4_HEIGHT);
  }
}

export function drawGuideLine(x1, y1, x2, y2, color = '#6366f1') {
  if (!guideCtx) return;
  guideCtx.save();
  guideCtx.beginPath();
  guideCtx.setLineDash([5, 4]);
  guideCtx.lineWidth = 1.2;
  guideCtx.strokeStyle = color;
  guideCtx.moveTo(x1, y1);
  guideCtx.lineTo(x2, y2);
  guideCtx.stroke();
  guideCtx.restore();
}

export function isShape(obj) {
  if (!obj) return false;
  if (obj.type === 'i-text' || obj.type === 'textbox') return false;
  if (obj.isArrow) return false;
  return obj.type === 'rect' || obj.type === 'circle' || obj.type === 'ellipse' || (obj.type === 'path' && obj.isCloud) || !!obj.isShape;
}

export function initCanvas(state) {
  // Ultra-crisp High-DPI / 8K Pixel-Level Clarity:
  // 1. Set retina scaling factor to 3x (or devicePixelRatio * 2),
  // providing 2382 x 3369 physical pixels (300+ DPI print-grade clarity).
  const highDpr = Math.max((window.devicePixelRatio || 1) * 2, 3);
  fabric.devicePixelRatio = highDpr;

  // 2. Globally disable low-res offscreen raster caching across all Fabric objects.
  // This guarantees text, boxes, circles, clouds, arrows, and icons are rendered
  // directly as pristine vector paths into the ultra-high-resolution canvas context.
  fabric.Object.prototype.objectCaching = false;
  fabric.Object.prototype.noScaleCache = false;
  fabric.Object.prototype.strokeUniform = true;

  // Patch Fabric font cache so fallback fonts don't corrupt measurements
  if (fabric && fabric.Text) {
    const origGetFontCache = fabric.Text.prototype.getFontCache;
    fabric.Text.prototype.getFontCache = function(decl) {
      const fontDecl = this._getFontDeclaration(decl);
      if (document.fonts && !document.fonts.check(fontDecl)) {
        if (fabric.charWidthsCache) {
          delete fabric.charWidthsCache[fontDecl];
        }
      }
      return origGetFontCache.call(this, decl);
    };
  }

  canvas = new fabric.Canvas('main-canvas', {
    width: A4_WIDTH,
    height: A4_HEIGHT,
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true,
    stopContextMenu: true,
    fireRightClick: true,
    enableRetinaScaling: true,
    imageSmoothingEnabled: true,
  });
  window.__inkpad_canvas = canvas;
  window.__inkpad_state = state;

  if (canvas.contextContainer) {
    canvas.contextContainer.imageSmoothingEnabled = true;
    canvas.contextContainer.imageSmoothingQuality = 'high';
  }
  if (canvas.contextTop) {
    canvas.contextTop.imageSmoothingEnabled = true;
    canvas.contextTop.imageSmoothingQuality = 'high';
  }

  initGuidesAndHUD();

  // Keep cursor position synchronized during typing
  canvas.on('text:changed', (e) => {
    const text = e.target;
    if (text) {
      text.cursorOffsetCache = {};
      text._forceClearCache = true;
      text.initDimensions();
      text.setCoords();
      syncLinkedObjects(text);
      canvas.requestRenderAll();
    }
  });

  // Track selection range inside active text object
  canvas.on('text:selection:changed', (e) => {
    const text = e.target;
    if (text && text.selectionStart !== undefined && text.selectionStart !== text.selectionEnd) {
      text._lastSelectionStart = text.selectionStart;
      text._lastSelectionEnd = text.selectionEnd;
    }
  });

  // Save initial blank state
  saveState();

  // Mouse event handlers
  canvas.on('mouse:down', (opt) => handleMouseDown(opt, state));
  canvas.on('mouse:move', (opt) => handleMouseMove(opt, state));
  canvas.on('mouse:up', (opt) => handleMouseUp(opt, state));

  // Alignment, Angle, and Resize Guides during movement / rotation / scaling
  canvas.on('object:moving', (opt) => handleObjectMoving(opt));
  canvas.on('object:rotating', (opt) => handleObjectRotating(opt));
  canvas.on('object:scaling', (opt) => handleObjectScaling(opt));
  canvas.on('object:resizing', (opt) => handleObjectScaling(opt));

  // Track modifications for undo
  canvas.on('object:modified', () => {
    clearGuideLines();
    hideHUD();
    saveState();
  });
  canvas.on('object:added', () => {
    if (!skipHistory) saveState();
  });
  canvas.on('object:removed', (opt) => {
    if (opt.target) {
      if (opt.target.linkedText && canvas.contains(opt.target.linkedText)) {
        canvas.remove(opt.target.linkedText);
      }
      if (opt.target.frameShape && canvas.contains(opt.target.frameShape)) {
        canvas.remove(opt.target.frameShape);
      }
      if (opt.target.parentShape && opt.target.parentShape.linkedText === opt.target) {
        opt.target.parentShape.linkedText = null;
      }
      if (opt.target.enclosedText && opt.target.enclosedText.frameShape === opt.target) {
        opt.target.enclosedText.frameShape = null;
      }
    }
    if (!skipHistory) saveState();
  });

  // When drawing mode ends (path created), save state
  canvas.on('path:created', () => saveState());

  // Update property controls when selection changes
  canvas.on('selection:created', (e) => syncControlsFromObject(e, state));
  canvas.on('selection:updated', (e) => syncControlsFromObject(e, state));
  canvas.on('selection:cleared', () => {
    clearGuideLines();
    hideHUD();
  });

  state.canvas = canvas;
  return canvas;
}

function handleMouseDown(opt, state) {
  // If clicking on an existing object and using select tool, let Fabric handle it
  if (opt.target && state.currentTool === 'select') return;

  const pointer = canvas.getPointer(opt.e);

  switch (state.currentTool) {
    case 'select':
      break;

    case 'text':
      if (!opt.target) {
        createTextAtPoint(pointer, state);
      }
      break;

    case 'rect':
    case 'circle':
    case 'line':
    case 'dotted-line':
    case 'arrow':
      if (!opt.target) {
        startShapeDraw(pointer, state);
      }
      break;

    case 'cloud':
      if (!opt.target) {
        placeCloud(pointer, state);
      }
      break;

    case 'bullet':
      if (!opt.target) {
        placeBullet(pointer, state);
      }
      break;

    // 'draw' mode is handled natively by Fabric's isDrawingMode
  }
}

function handleMouseMove(opt, state) {
  if (!isDrawingShape || !tempShape) return;
  const pointer = canvas.getPointer(opt.e);
  updateShapePreview(pointer, state);
  canvas.renderAll();
}

function handleMouseUp(opt, state) {
  clearGuideLines();
  hideHUD();

  if (!isDrawingShape) return;

  if (tempShape) {
    // Finalize arrow with arrowhead
    if (state.currentTool === 'arrow') {
      finalizeArrow(state);
    } else {
      tempShape.set({ selectable: true, evented: true });
      canvas.setActiveObject(tempShape);
    }
    saveState();
  }

  isDrawingShape = false;
  tempShape = null;
  shapeStartPoint = null;

  // Auto-switch to select after drawing a shape
  setTool('select', state);
}

function handleObjectMoving(opt) {
  const obj = opt.target;
  if (!obj) return;

  clearGuideLines();
  syncLinkedObjects(obj);

  // Snap to Canvas Center
  const SNAP = 5;
  const center = obj.getCenterPoint();
  const cX = A4_WIDTH / 2; // 397
  const cY = A4_HEIGHT / 2; // 561.5

  let snappedX = false;
  let snappedY = false;

  if (Math.abs(center.x - cX) <= SNAP) {
    obj.setPositionByOrigin(new fabric.Point(cX, center.y), 'center', 'center');
    drawGuideLine(cX, 0, cX, A4_HEIGHT, '#6366f1');
    snappedX = true;
  }

  if (Math.abs(center.y - cY) <= SNAP) {
    obj.setPositionByOrigin(new fabric.Point(snappedX ? cX : center.x, cY), 'center', 'center');
    drawGuideLine(0, cY, A4_WIDTH, cY, '#6366f1');
    snappedY = true;
  }

  // Object-to-object center snapping (skip once both axes are resolved)
  if (!snappedX || !snappedY) {
    const allObjects = canvas.getObjects();
    for (let i = 0; i < allObjects.length; i++) {
      const other = allObjects[i];
      if (other === obj || other === obj.linkedText || other === obj.parentShape || other === obj.frameShape || other === obj.enclosedText) continue;

      const otherCenter = other.getCenterPoint();

      if (!snappedX && Math.abs(center.x - otherCenter.x) <= SNAP) {
        obj.setPositionByOrigin(new fabric.Point(otherCenter.x, obj.getCenterPoint().y), 'center', 'center');
        drawGuideLine(otherCenter.x, 0, otherCenter.x, A4_HEIGHT, '#ec4899');
        snappedX = true;
      }

      if (!snappedY && Math.abs(center.y - otherCenter.y) <= SNAP) {
        obj.setPositionByOrigin(new fabric.Point(obj.getCenterPoint().x, otherCenter.y), 'center', 'center');
        drawGuideLine(0, otherCenter.y, A4_WIDTH, otherCenter.y, '#ec4899');
        snappedY = true;
      }

      // Both axes resolved — no need to keep iterating
      if (snappedX && snappedY) break;
    }
  }

  obj.setCoords();

  const curCenter = obj.getCenterPoint();
  const alignLabel = snappedX && snappedY ? 'Centered' : (snappedX ? 'Aligned X' : (snappedY ? 'Aligned Y' : ''));
  const textLabel = alignLabel ? `X: ${Math.round(curCenter.x)} Y: ${Math.round(curCenter.y)} (${alignLabel})` : `X: ${Math.round(curCenter.x)} Y: ${Math.round(curCenter.y)}`;

  // Use lightweight top estimate instead of expensive getBoundingRect for HUD placement
  const objH = (obj.height || 0) * (obj.scaleY || 1);
  const hudTop = curCenter.y - objH / 2 - 12;
  showHUD(curCenter.x, hudTop, '🎯', textLabel);
}

function handleObjectRotating(opt) {
  const obj = opt.target;
  if (!obj) return;

  syncLinkedObjects(obj);

  let angle = (Math.round(obj.angle) % 360 + 360) % 360;
  const SNAP_THRESHOLD = 3;
  const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];

  for (const snap of snapAngles) {
    if (Math.abs(angle - snap) <= SNAP_THRESHOLD) {
      angle = snap === 360 ? 0 : snap;
      obj.set('angle', angle);
      break;
    }
  }

  let desc = `${angle}°`;
  if (angle === 0) desc = '0° Straight Horizontal';
  else if (angle === 90) desc = '90° Straight Vertical';
  else if (angle === 180) desc = '180° Inverted Horizontal';
  else if (angle === 270) desc = '270° Straight Vertical';
  else if (angle % 45 === 0) desc = `${angle}° Diagonal`;
  else desc = `${angle}° Tilted`;

  const center = obj.getCenterPoint();
  const b = obj.getBoundingRect(true, true);
  showHUD(center.x, b.top - 14, '📐', desc);
}

function handleObjectScaling(opt) {
  const obj = opt.target;
  if (!obj) return;

  syncLinkedObjects(obj);

  const dims = getObjectDimensions(obj);
  const center = obj.getCenterPoint();
  const b = obj.getBoundingRect(true, true);
  showHUD(center.x, b.top - 14, '📐', `W: ${dims.w}  H: ${dims.h}`);
}

export function getObjectDimensions(obj) {
  let w = 0;
  let h = 0;
  const sx = Math.abs(obj.scaleX || 1);
  const sy = Math.abs(obj.scaleY || 1);

  if (obj.type === 'rect') {
    w = Math.round((obj.width || 0) * sx);
    h = Math.round((obj.height || 0) * sy);
  } else if (obj.type === 'ellipse') {
    w = Math.round((obj.rx || 0) * 2 * sx);
    h = Math.round((obj.ry || 0) * 2 * sy);
  } else if (obj.type === 'circle') {
    w = Math.round((obj.radius || 0) * 2 * sx);
    h = Math.round((obj.radius || 0) * 2 * sy);
  } else if (obj.type === 'line') {
    w = Math.round(Math.abs(obj.x2 - obj.x1) * sx);
    h = Math.round(Math.abs(obj.y2 - obj.y1) * sy);
  } else {
    const b = obj.getBoundingRect(true, false);
    w = Math.round(b.width || (obj.width || 0) * sx);
    h = Math.round(b.height || (obj.height || 0) * sy);
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

export function syncLinkedObjects(obj) {
  if (!obj || !canvas) return;

  // If text with enclosing frame moved/changed
  if (obj.frameShape && canvas.contains(obj.frameShape)) {
    const center = obj.getCenterPoint();
    const pad = 14;
    const tw = obj.width * (obj.scaleX || 1);
    const th = obj.height * (obj.scaleY || 1);

    if (obj.frameShape.type === 'rect') {
      obj.frameShape.set({
        width: tw + pad * 2,
        height: th + pad * 2,
        angle: obj.angle,
      });
      obj.frameShape.setPositionByOrigin(center, 'center', 'center');
    } else if (obj.frameShape.type === 'ellipse' || obj.frameShape.type === 'circle') {
      obj.frameShape.set({
        rx: (tw / 2) + pad,
        ry: (th / 2) + pad,
        angle: obj.angle,
      });
      obj.frameShape.setPositionByOrigin(center, 'center', 'center');
    } else if (obj.frameShape.type === 'path') {
      obj.frameShape.scaleToWidth(tw + pad * 2 + 28);
      obj.frameShape.scaleToHeight(th + pad * 2 + 22);
      obj.frameShape.set('angle', obj.angle);
      obj.frameShape.setPositionByOrigin(center, 'center', 'center');
    }
    obj.frameShape.setCoords();
  }
}

async function createTextAtPoint(pointer, state) {
  const font = state.fontFamily || 'Caveat';
  await ensureFontLoaded(font, state.textSize);

  skipHistory = true;

  const textColor = hexToRgba(state.textColor, state.textOpacity);
  const textBgColor = state.noTextBg ? '' : hexToRgba(state.textBgColor, state.textBgOpacity);

  const text = new fabric.IText('', {
    left: pointer.x,
    top: pointer.y,
    fontFamily: font,
    fontSize: state.textSize,
    fill: textColor,
    textBackgroundColor: textBgColor,
    editable: true,
    cursorColor: state.textColor,
    cursorWidth: 2,
    padding: 4,
    objectCaching: false,
  });

  text.on('changed', () => {
    text.cursorOffsetCache = {};
    text._forceClearCache = true;
    text.initDimensions();
    text.setCoords();
    canvas.requestRenderAll();
  });

  canvas.add(text);
  canvas.setActiveObject(text);
  text.enterEditing();
  skipHistory = false;

  // Remove empty texts when editing finishes
  text.on('editing:exited', () => {
    if (text.text.trim() === '') {
      canvas.remove(text);
    } else {
      saveState();
    }
  });
}

function startShapeDraw(pointer, state) {
  isDrawingShape = true;
  shapeStartPoint = { x: pointer.x, y: pointer.y };
  skipHistory = true;

  const fill = state.noFill ? 'transparent' : hexToRgba(state.fillColor, state.fillOpacity);
  const base = {
    fill: fill,
    stroke: state.strokeColor,
    strokeWidth: state.strokeWidth,
    strokeUniform: true,
    selectable: false,
    evented: false,
  };

  switch (state.currentTool) {
    case 'rect':
      tempShape = new fabric.Rect({
        ...base,
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
      });
      tempShape.isShape = true;
      break;

    case 'circle':
      tempShape = new fabric.Ellipse({
        ...base,
        left: pointer.x,
        top: pointer.y,
        rx: 0,
        ry: 0,
      });
      tempShape.isShape = true;
      break;

    case 'line':
      tempShape = new fabric.Line(
        [pointer.x, pointer.y, pointer.x, pointer.y],
        { ...base, fill: '' }
      );
      break;

    case 'dotted-line':
      tempShape = new fabric.Line(
        [pointer.x, pointer.y, pointer.x, pointer.y],
        { ...base, fill: '', strokeDashArray: [10, 6] }
      );
      break;

    case 'arrow':
      tempShape = new fabric.Line(
        [pointer.x, pointer.y, pointer.x, pointer.y],
        { ...base, fill: '' }
      );
      tempShape.isArrow = true;
      break;
  }

  if (tempShape) {
    canvas.add(tempShape);
  }
  skipHistory = false;
}

function updateShapePreview(pointer, state) {
  if (!tempShape || !shapeStartPoint) return;

  const sx = shapeStartPoint.x;
  const sy = shapeStartPoint.y;
  const dx = pointer.x - sx;
  const dy = pointer.y - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  switch (state.currentTool) {
    case 'rect': {
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      tempShape.set({
        left: Math.min(sx, pointer.x),
        top: Math.min(sy, pointer.y),
        width: w,
        height: h,
      });
      showHUD(pointer.x, pointer.y - 14, '📐', `W: ${Math.round(w)}  H: ${Math.round(h)}`);
      break;
    }

    case 'circle': {
      const rx = Math.abs(dx) / 2;
      const ry = Math.abs(dy) / 2;
      tempShape.set({
        left: Math.min(sx, pointer.x),
        top: Math.min(sy, pointer.y),
        rx: rx,
        ry: ry,
      });
      showHUD(pointer.x, pointer.y - 14, '📐', `W: ${Math.round(rx * 2)}  H: ${Math.round(ry * 2)}`);
      break;
    }

    case 'line':
    case 'dotted-line':
    case 'arrow': {
      let rad = Math.atan2(dy, dx);
      let deg = (rad * 180 / Math.PI);
      let absDeg = Math.abs(deg);
      let snapX = pointer.x;
      let snapY = pointer.y;
      let hudDesc = '';

      // Horizontal snap (0° or 180° within ±4°)
      if (absDeg <= 4 || Math.abs(absDeg - 180) <= 4) {
        snapY = sy;
        hudDesc = '0° Straight Horizontal';
      }
      // Vertical snap (90° or -90° within ±4°)
      else if (Math.abs(absDeg - 90) <= 4) {
        snapX = sx;
        hudDesc = '90° Straight Vertical';
      }
      // 45° Diagonals within ±4°
      else if (Math.abs(absDeg - 45) <= 4) {
        const snapRad = (deg < 0 ? -45 : 45) * Math.PI / 180;
        snapX = sx + dist * Math.cos(snapRad);
        snapY = sy + dist * Math.sin(snapRad);
        hudDesc = `${deg < 0 ? '315°' : '45°'} Diagonal`;
      }
      else if (Math.abs(absDeg - 135) <= 4) {
        const snapRad = (deg < 0 ? -135 : 135) * Math.PI / 180;
        snapX = sx + dist * Math.cos(snapRad);
        snapY = sy + dist * Math.sin(snapRad);
        hudDesc = `${deg < 0 ? '225°' : '135°'} Diagonal`;
      } else {
        const normDeg = Math.round((deg % 360 + 360) % 360);
        hudDesc = `${normDeg}° Tilted`;
      }

      tempShape.set({ x2: snapX, y2: snapY });
      showHUD(snapX, snapY - 14, '📐', hudDesc);
      break;
    }
  }
}

function finalizeArrow(state) {
  if (!tempShape) return;

  const x1 = tempShape.x1;
  const y1 = tempShape.y1;
  const x2 = tempShape.x2;
  const y2 = tempShape.y2;

  // Remove the preview line
  canvas.remove(tempShape);

  // Calculate arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 14;

  const ax1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
  const ay1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
  const ax2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
  const ay2 = y2 - headLen * Math.sin(angle + Math.PI / 6);

  const pathStr = [
    `M ${x1} ${y1} L ${x2} ${y2}`,
    `M ${x2} ${y2} L ${ax1} ${ay1}`,
    `M ${x2} ${y2} L ${ax2} ${ay2}`,
  ].join(' ');

  skipHistory = true;
  const arrow = new fabric.Path(pathStr, {
    fill: '',
    stroke: state.strokeColor,
    strokeWidth: state.strokeWidth,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    selectable: true,
    evented: true,
    strokeUniform: true,
  });
  arrow.isArrow = true;

  canvas.add(arrow);
  canvas.setActiveObject(arrow);
  tempShape = arrow;
  skipHistory = false;
}

function placeCloud(pointer, state) {
  skipHistory = true;

  const cloudPath = 'M 30,75 Q 5,75 5,55 Q 5,35 20,30 Q 15,5 40,5 Q 58,-5 70,12 Q 82,2 95,15 Q 115,15 115,38 Q 115,58 100,63 Q 102,75 80,75 Z';

  const cloud = new fabric.Path(cloudPath, {
    left: pointer.x - 60,
    top: pointer.y - 40,
    fill: state.noFill ? 'transparent' : hexToRgba(state.fillColor, state.fillOpacity),
    stroke: state.strokeColor,
    strokeWidth: state.strokeWidth,
    strokeUniform: true,
  });

  cloud.isShape = true;
  cloud.isCloud = true;
  cloud.cloudOriginalScale = true;

  canvas.add(cloud);
  canvas.setActiveObject(cloud);
  skipHistory = false;
  saveState();

  // Auto-switch to select
  setTool('select', state);
}

async function placeBullet(pointer, state) {
  const font = state.fontFamily || 'Caveat';
  await ensureFontLoaded(font, state.textSize);

  skipHistory = true;

  const textColor = hexToRgba(state.textColor, state.textOpacity);
  const textBgColor = state.noTextBg ? '' : hexToRgba(state.textBgColor, state.textBgOpacity);

  const text = new fabric.IText('• ', {
    left: pointer.x,
    top: pointer.y,
    fontFamily: font,
    fontSize: state.textSize,
    fill: textColor,
    textBackgroundColor: textBgColor,
    editable: true,
    cursorColor: state.textColor,
    cursorWidth: 2,
    padding: 4,
    objectCaching: false,
  });

  text.on('changed', () => {
    text.cursorOffsetCache = {};
    text._forceClearCache = true;
    text.initDimensions();
    text.setCoords();
    canvas.requestRenderAll();
  });

  canvas.add(text);
  canvas.setActiveObject(text);
  text.enterEditing();
  // Place cursor after bullet character
  text.setSelectionStart(2);
  text.setSelectionEnd(2);
  skipHistory = false;

  text.on('editing:exited', () => {
    if (text.text.trim() === '' || text.text.trim() === '•') {
      canvas.remove(text);
    } else {
      saveState();
    }
  });
}

export function setTool(tool, state) {
  state.currentTool = tool;

  // Update toolbar button states
  document.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });

  // Configure canvas mode
  if (tool === 'select') {
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
    canvas.forEachObject((o) => {
      o.selectable = true;
      o.evented = true;
    });
  } else if (tool === 'text' || tool === 'bullet') {
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'text';
    canvas.hoverCursor = 'text';
  } else if (tool === 'draw') {
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush.color = state.strokeColor;
    canvas.freeDrawingBrush.width = state.strokeWidth;
    canvas.freeDrawingBrush.decimate = 4;
    canvas.defaultCursor = 'crosshair';
  } else {
    // Shape tools (rect, circle, line, dotted-line, arrow, cloud)
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor = 'crosshair';
  }
}

function syncControlsFromObject(e, state) {
  const obj = canvas.getActiveObject();
  if (!obj) return;

  // Text properties
  if (obj.type === 'i-text' || obj.type === 'textbox') {
    const colorInput = document.getElementById('text-color');
    const opacitySlider = document.getElementById('text-opacity');
    const opacityVal = document.getElementById('text-opacity-val');
    const sizeSlider = document.getElementById('text-size');
    const sizeInput = document.getElementById('text-size-input');

    if (obj.fill && typeof obj.fill === 'string') {
      const parsed = parseColorAndOpacity(obj.fill);
      if (colorInput) colorInput.value = parsed.hex;
      if (opacitySlider) opacitySlider.value = parsed.opacity;
      if (opacityVal) opacityVal.textContent = `${parsed.opacity}%`;
      state.textColor = parsed.hex;
      state.textOpacity = parsed.opacity;
      document.querySelectorAll('.color-swatch[data-target="text"]').forEach((s) => {
        s.classList.toggle('active', s.dataset.color.toLowerCase() === parsed.hex.toLowerCase());
      });
    }

    // Text Fill / Background (Highlight)
    const bgInput = document.getElementById('text-bg-color');
    const bgOpacitySlider = document.getElementById('text-bg-opacity');
    const bgOpacityVal = document.getElementById('text-bg-opacity-val');
    const noBgBtn = document.getElementById('no-text-bg-btn');

    if (obj.textBackgroundColor && obj.textBackgroundColor !== '') {
      const parsed = parseColorAndOpacity(obj.textBackgroundColor);
      if (bgInput) bgInput.value = parsed.hex;
      if (bgOpacitySlider) bgOpacitySlider.value = parsed.opacity;
      if (bgOpacityVal) bgOpacityVal.textContent = `${parsed.opacity}%`;
      if (noBgBtn) noBgBtn.classList.remove('active');
      state.textBgColor = parsed.hex;
      state.textBgOpacity = parsed.opacity;
      state.noTextBg = false;
      document.querySelectorAll('.color-swatch[data-target="text-bg"]').forEach((s) => {
        s.classList.toggle('active', s.dataset.color.toLowerCase() === parsed.hex.toLowerCase());
      });
    } else {
      if (noBgBtn) noBgBtn.classList.add('active');
      state.noTextBg = true;
      document.querySelectorAll('.color-swatch[data-target="text-bg"]').forEach((s) => {
        s.classList.remove('active');
      });
    }

    if (obj.fontSize) {
      if (sizeSlider) sizeSlider.value = obj.fontSize;
      if (sizeInput) sizeInput.value = obj.fontSize;
      state.textSize = obj.fontSize;

      // Update size preset buttons
      document.querySelectorAll('.size-preset').forEach((btn) => {
        btn.classList.toggle('active', parseInt(btn.dataset.size) === obj.fontSize);
      });
    }

    if (obj.fontFamily) {
      const fontSelect = document.getElementById('font-family');
      const fontPreview = document.getElementById('font-preview');
      if (fontSelect) {
        fontSelect.value = obj.fontFamily;
        state.fontFamily = obj.fontFamily;
        if (fontPreview) {
          fontPreview.style.fontFamily = `"${obj.fontFamily}", cursive, sans-serif`;
        }
      }
    }

    // Underline
    const underlineBtn = document.getElementById('underline-btn');
    if (underlineBtn) underlineBtn.classList.toggle('active', !!obj.underline);

    // Frame Type
    const frameType = obj.frameType || 'none';
    document.querySelectorAll('.frame-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.frame === frameType);
    });
  } else {
    // If shape encloses text, sync frame controls as well
    if (obj.enclosedText) {
      const text = obj.enclosedText;
      const underlineBtn = document.getElementById('underline-btn');
      if (underlineBtn) underlineBtn.classList.toggle('active', !!text.underline);

      const frameType = text.frameType || 'none';
      document.querySelectorAll('.frame-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.frame === frameType);
      });
    } else {
      const underlineBtn = document.getElementById('underline-btn');
      if (underlineBtn) underlineBtn.classList.remove('active');
      document.querySelectorAll('.frame-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.frame === 'none');
      });
    }

    // Shape fill properties
    if (obj.fill && typeof obj.fill === 'string') {
      const parsed = parseColorAndOpacity(obj.fill);
      const fillInput = document.getElementById('fill-color');
      const fillOpacitySlider = document.getElementById('fill-opacity');
      const fillOpacityVal = document.getElementById('fill-opacity-val');
      const noFillBtn = document.getElementById('no-fill-btn');
      if (parsed.isTransparent || obj.fill === 'transparent') {
        if (noFillBtn) noFillBtn.classList.add('active');
        state.noFill = true;
      } else {
        if (fillInput) fillInput.value = parsed.hex;
        if (fillOpacitySlider) fillOpacitySlider.value = parsed.opacity;
        if (fillOpacityVal) fillOpacityVal.textContent = `${parsed.opacity}%`;
        if (noFillBtn) noFillBtn.classList.remove('active');
        state.fillColor = parsed.hex;
        state.fillOpacity = parsed.opacity;
        state.noFill = false;
      }
    }
  }

  // Stroke properties
  if (obj.stroke && typeof obj.stroke === 'string' && obj.stroke !== '') {
    document.getElementById('stroke-color').value = obj.stroke;
    state.strokeColor = obj.stroke;
    document.querySelectorAll('.color-swatch[data-target="stroke"]').forEach((s) => {
      s.classList.toggle('active', s.dataset.color.toLowerCase() === obj.stroke.toLowerCase());
    });
  }

  // Stroke width
  if (obj.strokeWidth !== undefined) {
    const widthSlider = document.getElementById('stroke-width');
    const widthInput = document.getElementById('stroke-width-input');
    if (widthSlider) widthSlider.value = obj.strokeWidth;
    if (widthInput) widthInput.value = obj.strokeWidth;
    state.strokeWidth = obj.strokeWidth;
  }
}

export function applyOutwardStrokeWidth(obj, newStrokeWidth) {
  if (!obj) return;
  if (obj.type === 'activeSelection') {
    obj.forEachObject((o) => applyOutwardStrokeWidth(o, newStrokeWidth));
    canvas?.requestRenderAll();
    return;
  }
  const oldWidth = obj.strokeWidth !== undefined ? obj.strokeWidth : 1;
  const d = newStrokeWidth - oldWidth;

  obj.set('strokeWidth', newStrokeWidth);

  if (d !== 0) {
    if (obj.type === 'rect') {
      const center = obj.getCenterPoint();
      const currentW = obj.width * (obj.scaleX || 1);
      const currentH = obj.height * (obj.scaleY || 1);
      const newW = Math.max(2, currentW + d);
      const newH = Math.max(2, currentH + d);
      obj.set({
        width: newW / (obj.scaleX || 1),
        height: newH / (obj.scaleY || 1),
      });
      obj.setPositionByOrigin(center, 'center', 'center');
      obj.setCoords();
    } else if (obj.type === 'circle' || obj.type === 'ellipse') {
      const center = obj.getCenterPoint();
      if (obj.type === 'circle') {
        const currentR = obj.radius * (obj.scaleX || 1);
        const newR = Math.max(1, currentR + d / 2);
        obj.set({
          radius: newR / (obj.scaleX || 1),
        });
      } else {
        const currentRx = obj.rx * (obj.scaleX || 1);
        const currentRy = obj.ry * (obj.scaleY || 1);
        const newRx = Math.max(1, currentRx + d / 2);
        const newRy = Math.max(1, currentRy + d / 2);
        obj.set({
          rx: newRx / (obj.scaleX || 1),
          ry: newRy / (obj.scaleY || 1),
        });
      }
      obj.setPositionByOrigin(center, 'center', 'center');
      obj.setCoords();
    } else if (obj.type === 'path' && obj.isCloud) {
      const center = obj.getCenterPoint();
      const factor = 1 + (d / 240);
      obj.scaleX = Math.max(0.1, obj.scaleX * factor);
      obj.scaleY = Math.max(0.1, obj.scaleY * factor);
      obj.setPositionByOrigin(center, 'center', 'center');
      obj.setCoords();
    }
  }

  syncLinkedObjects(obj);
  canvas.requestRenderAll();
}

function getActiveTextObject() {
  let obj = canvas ? canvas.getActiveObject() : null;
  if (!obj) return null;
  if (obj.linkedText) obj = obj.linkedText;
  if (obj.type !== 'i-text' && obj.type !== 'textbox') return null;
  return obj;
}

export function toggleUnderline() {
  const obj = getActiveTextObject();
  if (!obj) return;

  const selStart = (obj.selectionStart !== undefined && obj.selectionStart !== obj.selectionEnd)
    ? obj.selectionStart
    : obj._lastSelectionStart;
  const selEnd = (obj.selectionEnd !== undefined && obj.selectionStart !== obj.selectionEnd)
    ? obj.selectionEnd
    : obj._lastSelectionEnd;

  const hasSelection = selStart !== undefined && selEnd !== undefined && selStart !== selEnd;
  let isUnderlinedResult = false;

  if (hasSelection) {
    const start = Math.min(selStart, selEnd);
    const end = Math.max(selStart, selEnd);
    const styles = (obj.getSelectionStyles && obj.getSelectionStyles(start, end, true)) || [];
    const allUnderline = styles.length > 0 && styles.every((s) => s && !!s.underline);
    const newUnderline = !allUnderline;
    isUnderlinedResult = newUnderline;

    obj.setSelectionStyles({ underline: newUnderline }, start, end);
    if (obj.isEditing) {
      obj.selectionStart = start;
      obj.selectionEnd = end;
    }
  } else {
    const isUnderlined = !obj.underline;
    isUnderlinedResult = isUnderlined;
    obj.set('underline', isUnderlined);
    if (obj.styles) {
      Object.keys(obj.styles).forEach((line) => {
        Object.keys(obj.styles[line]).forEach((char) => {
          if (obj.styles[line][char]) {
            delete obj.styles[line][char].underline;
          }
        });
      });
    }
  }

  obj.dirty = true;
  obj._forceClearCache = true;
  if (obj.cursorOffsetCache) obj.cursorOffsetCache = {};
  obj.initDimensions();
  obj.setCoords();
  canvas.requestRenderAll();
  saveState();

  const underlineBtn = document.getElementById('underline-btn');
  if (underlineBtn) underlineBtn.classList.toggle('active', isUnderlinedResult);
}

export function encloseSelectedText(frameType, state) {
  let active = canvas.getActiveObject();
  if (!active) return;
  if (active.enclosedText) active = active.enclosedText;
  if (active.linkedText) active = active.linkedText;

  if (active.type !== 'i-text' && active.type !== 'textbox') return;

  if (active.frameShape && canvas.contains(active.frameShape)) {
    canvas.remove(active.frameShape);
    active.frameShape = null;
  }

  if (frameType === 'none') {
    active.frameType = 'none';
    canvas.requestRenderAll();
    saveState();
    return;
  }

  active.initDimensions();
  active.setCoords();
  const center = active.getCenterPoint();
  const tw = active.width * (active.scaleX || 1);
  const th = active.height * (active.scaleY || 1);
  const pad = 14; // Standard clean padding

  const fill = state.noFill ? 'transparent' : hexToRgba(state.fillColor, state.fillOpacity);
  const base = {
    fill: fill === 'transparent' ? '#ffffff' : fill,
    stroke: state.strokeColor || '#1c1917',
    strokeWidth: state.strokeWidth || 2,
    strokeUniform: true,
    selectable: true,
    evented: true,
    isShape: true,
  };

  let shape = null;

  if (frameType === 'box') {
    shape = new fabric.Rect({
      ...base,
      left: center.x,
      top: center.y,
      originX: 'center',
      originY: 'center',
      width: tw + pad * 2,
      height: th + pad * 2,
      rx: 8,
      ry: 8,
      angle: active.angle || 0,
    });
  } else if (frameType === 'circle') {
    shape = new fabric.Ellipse({
      ...base,
      left: center.x,
      top: center.y,
      originX: 'center',
      originY: 'center',
      rx: (tw / 2) + pad,
      ry: (th / 2) + pad,
      angle: active.angle || 0,
    });
  } else if (frameType === 'cloud') {
    const cloudPath = 'M 30,75 Q 5,75 5,55 Q 5,35 20,30 Q 15,5 40,5 Q 58,-5 70,12 Q 82,2 95,15 Q 115,15 115,38 Q 115,58 100,63 Q 102,75 80,75 Z';
    shape = new fabric.Path(cloudPath, {
      ...base,
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      isCloud: true,
      angle: active.angle || 0,
    });
    shape.scaleToWidth(tw + pad * 2 + 28);
    shape.scaleToHeight(th + pad * 2 + 22);
    shape.setPositionByOrigin(center, 'center', 'center');
  }

  if (shape) {
    skipHistory = true;
    canvas.add(shape);
    const textIdx = canvas.getObjects().indexOf(active);
    canvas.moveTo(shape, Math.max(0, textIdx));

    active.frameShape = shape;
    active.frameType = frameType;
    active.framePadding = pad;
    shape.enclosedText = active;
    shape.linkedText = active;
    active.parentShape = shape;

    skipHistory = false;
    canvas.requestRenderAll();
    saveState();
  }
}

let onCanvasChangeCallback = null;

export const CUSTOM_FABRIC_PROPERTIES = [
  'isTable',
  '_tableData',
  '_tableCell',
  '_tableText',
  '_row',
  '_col',
  'isShape',
  'isCloud',
  'cloudOriginalScale',
  'isArrow',
  'isInkpadGroup',
  'linkedText',
  'frameShape',
  'frameType',
  'framePadding',
  'parentShape',
  'enclosedText',
];

export function setCanvasChangeCallback(cb) {
  onCanvasChangeCallback = cb;
}

export function saveState() {
  if (skipHistory || !canvas) return;
  const json = JSON.stringify(canvas.toJSON(CUSTOM_FABRIC_PROPERTIES));
  undoStack.push(json);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0; // Clear redo on new action
  if (onCanvasChangeCallback) {
    onCanvasChangeCallback();
  }
}
export function resetUndoStack() {
  undoStack.length = 0;
  redoStack.length = 0;
  const wasPaused = skipHistory;
  skipHistory = false;
  saveState();
  skipHistory = wasPaused;
}


export function undo() {
  if (undoStack.length <= 1) return; // Keep at least the initial state
  redoStack.push(undoStack.pop());
  const prevState = undoStack[undoStack.length - 1];
  skipHistory = true;
  canvas.loadFromJSON(prevState, () => {
    canvas.renderAll();
    skipHistory = false;
    if (onCanvasChangeCallback) onCanvasChangeCallback();
  });
}

export function redo() {
  if (redoStack.length === 0) return;
  const nextState = redoStack.pop();
  undoStack.push(nextState);
  skipHistory = true;
  canvas.loadFromJSON(nextState, () => {
    canvas.renderAll();
    skipHistory = false;
    if (onCanvasChangeCallback) onCanvasChangeCallback();
  });
}

export function deleteSelected() {
  const active = canvas.getActiveObject();
  if (!active) return;

  if (active.type === 'activeSelection') {
    active.forEachObject((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
  } else {
    canvas.remove(active);
  }

  canvas.renderAll();
  saveState();
}

export function groupSelected() {
  const active = canvas.getActiveObject();
  if (!active || active.type !== 'activeSelection') return;

  const objects = active.getObjects();
  if (objects.length < 2) return;

  const group = active.toGroup();
  group.set({
    objectCaching: false,
    strokeUniform: true,
  });
  group.isInkpadGroup = true;
  canvas.setActiveObject(group);
  canvas.requestRenderAll();
  saveState();
}

export function ungroupSelected() {
  const active = canvas.getActiveObject();
  if (!active || active.type !== 'group') return;

  const selection = active.toActiveSelection();
  canvas.requestRenderAll();
  saveState();
}

export function bringForward() {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  canvas.bringForward(obj, true);
  canvas.requestRenderAll();
  saveState();
}

export function sendBackward() {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  canvas.sendBackwards(obj, true);
  canvas.requestRenderAll();
  saveState();
}

export function bringToFront() {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  canvas.bringToFront(obj);
  canvas.requestRenderAll();
  saveState();
}

export function sendToBack() {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  canvas.sendToBack(obj);
  canvas.requestRenderAll();
  saveState();
}

export function selectAllObjects() {
  canvas.discardActiveObject();
  const objs = canvas.getObjects();
  if (objs.length === 0) return;
  const sel = new fabric.ActiveSelection(objs, { canvas });
  canvas.setActiveObject(sel);
  canvas.requestRenderAll();
}

export function duplicateSelected() {
  const active = canvas.getActiveObject();
  if (!active) return;

  active.clone((cloned) => {
    cloned.set({
      left: (cloned.left || 0) + 20,
      top: (cloned.top || 0) + 20,
      evented: true,
      objectCaching: false,
    });
    if (cloned.type === 'activeSelection') {
      cloned.canvas = canvas;
      cloned.forEachObject((obj) => {
        obj.objectCaching = false;
        canvas.add(obj);
      });
      cloned.setCoords();
    } else {
      canvas.add(cloned);
    }
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    saveState();
  });
}

export function toggleBold() {
  const obj = getActiveTextObject();
  if (!obj) return;

  const selStart = (obj.selectionStart !== undefined && obj.selectionStart !== obj.selectionEnd)
    ? obj.selectionStart
    : obj._lastSelectionStart;
  const selEnd = (obj.selectionEnd !== undefined && obj.selectionStart !== obj.selectionEnd)
    ? obj.selectionEnd
    : obj._lastSelectionEnd;

  const hasSelection = selStart !== undefined && selEnd !== undefined && selStart !== selEnd;

  if (hasSelection) {
    const start = Math.min(selStart, selEnd);
    const end = Math.max(selStart, selEnd);
    const styles = (obj.getSelectionStyles && obj.getSelectionStyles(start, end, true)) || [];
    const allBold = styles.length > 0 && styles.every((s) => s && (s.fontWeight === 'bold' || s.fontWeight === 700 || s.fontWeight === '700'));
    const newWeight = allBold ? 'normal' : 'bold';

    obj.setSelectionStyles({ fontWeight: newWeight }, start, end);
    if (obj.isEditing) {
      obj.selectionStart = start;
      obj.selectionEnd = end;
    }
  } else {
    const isBold = obj.fontWeight === 'bold' || obj.fontWeight === 700 || obj.fontWeight === '700';
    const newWeight = isBold ? 'normal' : 'bold';
    obj.set('fontWeight', newWeight);
    if (obj.styles) {
      Object.keys(obj.styles).forEach((line) => {
        Object.keys(obj.styles[line]).forEach((char) => {
          if (obj.styles[line][char]) {
            delete obj.styles[line][char].fontWeight;
          }
        });
      });
    }
  }

  obj.dirty = true;
  obj._forceClearCache = true;
  if (obj.cursorOffsetCache) obj.cursorOffsetCache = {};
  obj.initDimensions();
  obj.setCoords();
  canvas.requestRenderAll();
  saveState();
}

export function toggleItalic() {
  const obj = getActiveTextObject();
  if (!obj) return;

  const selStart = (obj.selectionStart !== undefined && obj.selectionStart !== obj.selectionEnd)
    ? obj.selectionStart
    : obj._lastSelectionStart;
  const selEnd = (obj.selectionEnd !== undefined && obj.selectionStart !== obj.selectionEnd)
    ? obj.selectionEnd
    : obj._lastSelectionEnd;

  const hasSelection = selStart !== undefined && selEnd !== undefined && selStart !== selEnd;

  if (hasSelection) {
    const start = Math.min(selStart, selEnd);
    const end = Math.max(selStart, selEnd);
    const styles = (obj.getSelectionStyles && obj.getSelectionStyles(start, end, true)) || [];
    const allItalic = styles.length > 0 && styles.every((s) => s && s.fontStyle === 'italic');
    const newStyle = allItalic ? 'normal' : 'italic';

    obj.setSelectionStyles({ fontStyle: newStyle }, start, end);
    if (obj.isEditing) {
      obj.selectionStart = start;
      obj.selectionEnd = end;
    }
  } else {
    const isItalic = obj.fontStyle === 'italic';
    const newStyle = isItalic ? 'normal' : 'italic';
    obj.set('fontStyle', newStyle);
    if (obj.styles) {
      Object.keys(obj.styles).forEach((line) => {
        Object.keys(obj.styles[line]).forEach((char) => {
          if (obj.styles[line][char]) {
            delete obj.styles[line][char].fontStyle;
          }
        });
      });
    }
  }

  obj.dirty = true;
  obj._forceClearCache = true;
  if (obj.cursorOffsetCache) obj.cursorOffsetCache = {};
  obj.initDimensions();
  obj.setCoords();
  canvas.requestRenderAll();
  saveState();
}

export function setTextAlign(align) {
  let obj = canvas.getActiveObject();
  if (!obj) return;
  if (obj.linkedText) obj = obj.linkedText;
  if (obj.type !== 'i-text' && obj.type !== 'textbox') return;

  obj.set('textAlign', align);
  obj.dirty = true;
  obj.initDimensions();
  obj.setCoords();
  canvas.requestRenderAll();
  saveState();
}

export function applyObjectDimensions(obj, width, height) {
  if (!obj || !canvas) return;

  const center = obj.getCenterPoint();

  if (obj.type === 'rect') {
    obj.set({
      width: width / (obj.scaleX || 1),
      height: height / (obj.scaleY || 1),
    });
  } else if (obj.type === 'ellipse') {
    obj.set({
      rx: (width / 2) / (obj.scaleX || 1),
      ry: (height / 2) / (obj.scaleY || 1),
    });
  } else if (obj.type === 'circle') {
    obj.set({
      radius: (width / 2) / (obj.scaleX || 1),
    });
  } else {
    // Generic: scale to desired dimensions
    const curW = (obj.width || 1) * (obj.scaleX || 1);
    const curH = (obj.height || 1) * (obj.scaleY || 1);
    obj.set({
      scaleX: (obj.scaleX || 1) * (width / curW),
      scaleY: (obj.scaleY || 1) * (height / curH),
    });
  }

  obj.setPositionByOrigin(center, 'center', 'center');
  obj.setCoords();
  syncLinkedObjects(obj);
  canvas.requestRenderAll();
  saveState();
}

export function getCanvas() {
  return canvas;
}
