// State management, toolbar bindings, keyboard
// shortcuts, and application initialization

import './style.css';
import {
  initCanvas,
  setTool,
  undo,
  redo,
  deleteSelected,
  ensureFontLoaded,
  hexToRgba,
  parseColorAndOpacity,
  applyOutwardStrokeWidth,
  toggleUnderline,
  encloseSelectedText,
  setCanvasChangeCallback,
  getObjectDimensions,
  applyObjectDimensions,
  groupSelected,
  ungroupSelected,
  duplicateSelected,
  selectAllObjects,
  toggleBold,
  toggleItalic,
} from './canvas.js';
import { initIconPanel } from './icons.js';
import { exportToPDF } from './pdf.js';
import { initPages, saveCurrentPage } from './pages.js';
import { initTheme } from './theme.js';
import { initResizers } from './resizer.js';
import { initFloatingBar, showTablePopup } from './floatingBar.js';
import { createTable, setupTableCellEditing } from './table.js';
import {
  loadSavedSettings,
  saveSettings,
  saveDocument,
  saveAll,
  scheduleAutoSave,
} from './storage.js';
import { initAiPanel } from './aiPanel.js';

const state = {
  currentTool: 'select',
  textColor: '#1c1917',
  textOpacity: 100,
  textBgColor: '#fef08a',
  textBgOpacity: 45,
  noTextBg: true,
  textSize: 24,
  fontFamily: 'Caveat',
  strokeColor: '#1c1917',
  fillColor: '#ffffff',
  fillOpacity: 100,
  noFill: true,
  strokeWidth: 2,
  frameType: 'none',
  documentName: 'Untitled Document',
  pages: [],
  currentPage: 0,
  canvas: null,
  currentZoom: 1.0,
};

let currentZoom = 1.0;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

export function setZoom(zoom, persist = true) {
  currentZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 10) / 10));
  state.currentZoom = currentZoom;
  const wrapper = document.getElementById('canvas-wrapper');
  const zoomLevel = document.getElementById('zoom-level');
  if (wrapper) {
    wrapper.style.transform = `scale(${currentZoom})`;
  }
  if (zoomLevel) {
    zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
  }
  if (persist) {
    saveSettings(state);
  }
}

async function init() {
  const loader = document.getElementById('loading');

  // 1. Load saved user settings (font, colors, sizes, opacities, tool, zoom)
  window.__inkpad_state = state;
  const savedSettings = loadSavedSettings(state);
  Object.assign(state, savedSettings);
  if (state.currentZoom) currentZoom = state.currentZoom;

  try {
    // Load the custom handwriting fonts
    const hindiFont = new FontFace('Hindi Type', 'url(/fonts/Hindi_Type.ttf)');
    await hindiFont.load();
    document.fonts.add(hindiFont);
    console.log('✓ Hindi Type font loaded');
  } catch (err) {
    console.warn('⚠ Could not load Hindi Type font:', err);
  }

  try {
    const krutiFont = new FontFace('Kruti Dev', 'url(/fonts/Kruti_Dev.ttf)');
    await krutiFont.load();
    document.fonts.add(krutiFont);
    console.log('✓ Kruti Dev font loaded');
  } catch (err) {
    console.warn('⚠ Could not load Kruti Dev font:', err);
  }

  // Preload saved/default handwriting font
  await ensureFontLoaded(state.fontFamily, state.textSize);

  // Initialize canvas
  initCanvas(state);
  console.log('✓ Canvas initialized');

  // Hook canvas state changes directly to auto-save
  setCanvasChangeCallback(() => {
    saveCurrentPage(state);
    scheduleAutoSave(state);
  });

  // Initialize pages (restores saved document pages & title)
  initPages(state);
  console.log('✓ Pages initialized');

  // Initialize icon panel
  initIconPanel(state);
  console.log('✓ Icon panel initialized');

  // Initialize theme (Light by default, switchable to Dark)
  initTheme();
  console.log('✓ Theme initialized');

  // Initialize resizable sidebars
  initResizers();
  console.log('✓ Resizers initialized');

  // Initialize floating context menu (right-click)
  initFloatingBar(state);
  console.log('✓ Floating bar initialized');

  // Initialize table cell editing
  setupTableCellEditing(state.canvas);
  console.log('✓ Table editing initialized');

  // Initialize AI assistant panel (EDITH)
  initAiPanel();
  console.log('✓ AI Assistant initialized');

  // Bind toolbar
  setupToolbar();

  // Bind property controls
  setupControls();

  // Bind keyboard shortcuts
  setupKeyboard();

  // Bind top bar actions
  setupTopBar();

  // Bind zoom controls
  setupZoom();

  // Bind shortcuts modal
  setupShortcutsModal();

  // Bind dimension controls (Canva-style W/H)
  setupDimensionControls();

  // Bind table insert button
  setupTableInsert();

  // Synchronize all UI inputs/swatches/buttons with restored settings
  syncUIFromSettings(state);

  // Immediately save state before page refresh or unload
  window.addEventListener('beforeunload', () => {
    saveAll(state);
  });

  // Hide loading screen
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 600);
  }

  console.log('✓ InkPad ready');
}

export function syncUIFromSettings(state) {
  // Document name
  const docNameInput = document.getElementById('doc-name');
  if (docNameInput) docNameInput.value = state.documentName || 'Untitled Document';
  document.title = `${state.documentName || 'Untitled Document'} — InkPad`;

  // Active Tool Button
  document.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === state.currentTool);
  });
  setTool(state.currentTool, state);

  // Font Family & Preview
  const fontSelect = document.getElementById('font-family');
  if (fontSelect) fontSelect.value = state.fontFamily;
  const fontPreview = document.getElementById('font-preview');
  if (fontPreview) fontPreview.style.fontFamily = `"${state.fontFamily}", cursive, sans-serif`;

  // Text Size & Presets
  const sizeSlider = document.getElementById('text-size');
  const sizeInput = document.getElementById('text-size-input');
  if (sizeSlider) sizeSlider.value = state.textSize;
  if (sizeInput) sizeInput.value = state.textSize;
  document.querySelectorAll('.size-preset').forEach((btn) => {
    btn.classList.toggle('active', parseInt(btn.dataset.size) === state.textSize);
  });

  // Text Color & Opacity
  const textColorInput = document.getElementById('text-color');
  const textOpacitySlider = document.getElementById('text-opacity');
  const textOpacityVal = document.getElementById('text-opacity-val');
  if (textColorInput) textColorInput.value = state.textColor;
  if (textOpacitySlider) textOpacitySlider.value = state.textOpacity;
  if (textOpacityVal) textOpacityVal.textContent = `${state.textOpacity}%`;
  document.querySelectorAll('.color-swatch[data-target="text"]').forEach((s) => {
    s.classList.toggle('active', s.dataset.color.toLowerCase() === state.textColor.toLowerCase());
  });

  // Text Fill (Highlight) & Opacity
  const textBgColorInput = document.getElementById('text-bg-color');
  const textBgOpacitySlider = document.getElementById('text-bg-opacity');
  const textBgOpacityVal = document.getElementById('text-bg-opacity-val');
  const noTextBgBtn = document.getElementById('no-text-bg-btn');
  if (textBgColorInput) textBgColorInput.value = state.textBgColor;
  if (textBgOpacitySlider) textBgOpacitySlider.value = state.textBgOpacity;
  if (textBgOpacityVal) textBgOpacityVal.textContent = `${state.textBgOpacity}%`;
  if (noTextBgBtn) noTextBgBtn.classList.toggle('active', !!state.noTextBg);
  document.querySelectorAll('.color-swatch[data-target="text-bg"]').forEach((s) => {
    s.classList.toggle('active', !state.noTextBg && s.dataset.color.toLowerCase() === state.textBgColor.toLowerCase());
  });

  // Stroke Color & Swatches
  const strokeColorInput = document.getElementById('stroke-color');
  if (strokeColorInput) strokeColorInput.value = state.strokeColor;
  document.querySelectorAll('.color-swatch[data-target="stroke"]').forEach((s) => {
    s.classList.toggle('active', s.dataset.color.toLowerCase() === state.strokeColor.toLowerCase());
  });

  // Shape Fill & Opacity
  const fillColorInput = document.getElementById('fill-color');
  const fillOpacitySlider = document.getElementById('fill-opacity');
  const fillOpacityVal = document.getElementById('fill-opacity-val');
  const noFillBtn = document.getElementById('no-fill-btn');
  if (fillColorInput) fillColorInput.value = state.fillColor;
  if (fillOpacitySlider) fillOpacitySlider.value = state.fillOpacity;
  if (fillOpacityVal) fillOpacityVal.textContent = `${state.fillOpacity}%`;
  if (noFillBtn) noFillBtn.classList.toggle('active', !!state.noFill);

  // Stroke Width
  const widthSlider = document.getElementById('stroke-width');
  const widthInput = document.getElementById('stroke-width-input');
  if (widthSlider) widthSlider.value = state.strokeWidth;
  if (widthInput) widthInput.value = state.strokeWidth;

  // Frame Type
  document.querySelectorAll('#frame-type-group .frame-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.frame === state.frameType);
  });

  // Zoom
  setZoom(currentZoom, false);
}

function setupToolbar() {
  // Tool buttons
  document.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tool === 'table') {
        showTablePopup();
        return;
      }
      setTool(btn.dataset.tool, state);
      saveSettings(state);
    });
  });

  // Delete button
  document.getElementById('delete-btn').addEventListener('click', deleteSelected);
}

function setupControls() {
  // ─ Font Family Selector ─
  const fontSelect = document.getElementById('font-family');
  const fontPreview = document.getElementById('font-preview');
  if (fontSelect) {
    fontSelect.addEventListener('change', async (e) => {
      state.fontFamily = e.target.value;
      if (fontPreview) {
        fontPreview.style.fontFamily = `"${state.fontFamily}", cursive, sans-serif`;
      }
      await ensureFontLoaded(state.fontFamily, state.textSize);
      applyToSelectedText('fontFamily', state.fontFamily);
      saveSettings(state);
    });
  }

  // ─ Text Size (Slider + Number Input, 1 to 1000) ─
  const sizeSlider = document.getElementById('text-size');
  const sizeInput = document.getElementById('text-size-input');

  const updateTextSize = (newSize) => {
    let size = parseInt(newSize);
    if (isNaN(size)) return;
    size = Math.max(1, Math.min(1000, size));
    state.textSize = size;
    if (sizeSlider) sizeSlider.value = size;
    if (sizeInput) sizeInput.value = size;
    applyToSelectedText('fontSize', size);

    // Sync preset buttons
    document.querySelectorAll('.size-preset').forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.size) === size);
    });
    saveSettings(state);
  };

  if (sizeSlider) {
    sizeSlider.addEventListener('input', (e) => {
      updateTextSize(e.target.value);
    });
  }

  if (sizeInput) {
    sizeInput.addEventListener('input', (e) => {
      updateTextSize(e.target.value);
    });
    sizeInput.addEventListener('change', (e) => {
      let val = parseInt(e.target.value);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 1000) val = 1000;
      updateTextSize(val);
    });
  }

  // ─ Size Preset Buttons ─
  document.querySelectorAll('.size-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateTextSize(btn.dataset.size);
    });
  });

  // ─ Text Color & Opacity ─
  const textColorInput = document.getElementById('text-color');
  const textOpacitySlider = document.getElementById('text-opacity');
  const textOpacityVal = document.getElementById('text-opacity-val');

  const applyTextColorAndOpacity = () => {
    const rgba = hexToRgba(state.textColor, state.textOpacity);
    applyToSelectedText('fill', rgba);
    applyToSelectedText('cursorColor', state.textColor);
  };

  if (textColorInput) {
    textColorInput.addEventListener('input', (e) => {
      state.textColor = e.target.value;
      applyTextColorAndOpacity();
      document.querySelectorAll('.color-swatch[data-target="text"]').forEach((s) => {
        s.classList.toggle('active', s.dataset.color.toLowerCase() === state.textColor.toLowerCase());
      });
      saveSettings(state);
    });
  }

  if (textOpacitySlider) {
    textOpacitySlider.addEventListener('input', (e) => {
      state.textOpacity = parseInt(e.target.value);
      if (textOpacityVal) textOpacityVal.textContent = `${state.textOpacity}%`;
      applyTextColorAndOpacity();
      saveSettings(state);
    });
  }

  // ─ Text Fill (Highlight / Background Fill) & Opacity ─
  const textBgColorInput = document.getElementById('text-bg-color');
  const textBgOpacitySlider = document.getElementById('text-bg-opacity');
  const textBgOpacityVal = document.getElementById('text-bg-opacity-val');
  const noTextBgBtn = document.getElementById('no-text-bg-btn');

  const applyTextBgColorAndOpacity = () => {
    const rgba = state.noTextBg ? '' : hexToRgba(state.textBgColor, state.textBgOpacity);
    applyToSelectedText('textBackgroundColor', rgba);
  };

  if (textBgColorInput) {
    textBgColorInput.addEventListener('input', (e) => {
      state.textBgColor = e.target.value;
      state.noTextBg = false;
      if (noTextBgBtn) noTextBgBtn.classList.remove('active');
      applyTextBgColorAndOpacity();
      document.querySelectorAll('.color-swatch[data-target="text-bg"]').forEach((s) => {
        s.classList.toggle('active', s.dataset.color.toLowerCase() === state.textBgColor.toLowerCase());
      });
      saveSettings(state);
    });
  }

  if (textBgOpacitySlider) {
    textBgOpacitySlider.addEventListener('input', (e) => {
      state.textBgOpacity = parseInt(e.target.value);
      if (textBgOpacityVal) textBgOpacityVal.textContent = `${state.textBgOpacity}%`;
      state.noTextBg = false;
      if (noTextBgBtn) noTextBgBtn.classList.remove('active');
      applyTextBgColorAndOpacity();
      saveSettings(state);
    });
  }

  if (noTextBgBtn) {
    noTextBgBtn.addEventListener('click', () => {
      state.noTextBg = !state.noTextBg;
      noTextBgBtn.classList.toggle('active', state.noTextBg);
      applyTextBgColorAndOpacity();
      if (state.noTextBg) {
        document.querySelectorAll('.color-swatch[data-target="text-bg"]').forEach((s) => s.classList.remove('active'));
      }
      saveSettings(state);
    });
  }

  // ─ Color Swatches (Text, Text Fill, Stroke) ─
  document.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      const target = swatch.dataset.target;

      if (target === 'text') {
        state.textColor = color;
        if (textColorInput) textColorInput.value = color;
        applyTextColorAndOpacity();
        document.querySelectorAll('.color-swatch[data-target="text"]').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
      } else if (target === 'text-bg') {
        state.textBgColor = color;
        state.noTextBg = false;
        if (textBgColorInput) textBgColorInput.value = color;
        if (noTextBgBtn) noTextBgBtn.classList.remove('active');
        applyTextBgColorAndOpacity();
        document.querySelectorAll('.color-swatch[data-target="text-bg"]').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
      } else if (target === 'stroke') {
        state.strokeColor = color;
        document.getElementById('stroke-color').value = color;
        applyToSelectedObject('stroke', color);
        document.querySelectorAll('.color-swatch[data-target="stroke"]').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');

        // Update freehand brush color
        if (state.canvas && state.canvas.isDrawingMode) {
          state.canvas.freeDrawingBrush.color = color;
        }
      }
      saveSettings(state);
    });
  });

  // ─ Stroke Color ─
  document.getElementById('stroke-color').addEventListener('input', (e) => {
    state.strokeColor = e.target.value;
    applyToSelectedObject('stroke', state.strokeColor);
    document.querySelectorAll('.color-swatch[data-target="stroke"]').forEach((s) => {
      s.classList.toggle('active', s.dataset.color.toLowerCase() === state.strokeColor.toLowerCase());
    });

    if (state.canvas && state.canvas.isDrawingMode) {
      state.canvas.freeDrawingBrush.color = state.strokeColor;
    }
    saveSettings(state);
  });

  // ─ Shape Fill & Opacity ─
  const fillColorInput = document.getElementById('fill-color');
  const fillOpacitySlider = document.getElementById('fill-opacity');
  const fillOpacityVal = document.getElementById('fill-opacity-val');
  const noFillBtn = document.getElementById('no-fill-btn');

  const applyShapeFillAndOpacity = () => {
    const rgba = state.noFill ? 'transparent' : hexToRgba(state.fillColor, state.fillOpacity);
    const obj = state.canvas?.getActiveObject();
    if (obj && obj.type !== 'i-text' && obj.type !== 'textbox') {
      obj.set('fill', rgba);
      state.canvas.renderAll();
    }
  };

  if (fillColorInput) {
    fillColorInput.addEventListener('input', (e) => {
      state.fillColor = e.target.value;
      state.noFill = false;
      if (noFillBtn) noFillBtn.classList.remove('active');
      applyShapeFillAndOpacity();
      saveSettings(state);
    });
  }

  if (fillOpacitySlider) {
    fillOpacitySlider.addEventListener('input', (e) => {
      state.fillOpacity = parseInt(e.target.value);
      if (fillOpacityVal) fillOpacityVal.textContent = `${state.fillOpacity}%`;
      state.noFill = false;
      if (noFillBtn) noFillBtn.classList.remove('active');
      applyShapeFillAndOpacity();
      saveSettings(state);
    });
  }

  // ─ No Fill Toggle ─
  if (noFillBtn) {
    noFillBtn.addEventListener('click', () => {
      state.noFill = !state.noFill;
      noFillBtn.classList.toggle('active', state.noFill);
      applyShapeFillAndOpacity();
      saveSettings(state);
    });
  }

  // ─ Stroke Width (Slider + Number Input, 1 to 100) ─
  const widthSlider = document.getElementById('stroke-width');
  const widthInput = document.getElementById('stroke-width-input');

  const updateStrokeWidth = (newWidth) => {
    let width = parseInt(newWidth);
    if (isNaN(width)) return;
    width = Math.max(1, Math.min(100, width));
    state.strokeWidth = width;
    if (widthSlider) widthSlider.value = width;
    if (widthInput) widthInput.value = width;

    const obj = state.canvas?.getActiveObject();
    if (obj) {
      if (obj.frameShape) {
        applyOutwardStrokeWidth(obj.frameShape, width);
      } else {
        applyOutwardStrokeWidth(obj, width);
      }
    }

    if (state.canvas && state.canvas.isDrawingMode) {
      state.canvas.freeDrawingBrush.width = width;
    }
    saveSettings(state);
  };

  if (widthSlider) {
    widthSlider.addEventListener('input', (e) => {
      updateStrokeWidth(e.target.value);
    });
  }

  if (widthInput) {
    widthInput.addEventListener('input', (e) => {
      updateStrokeWidth(e.target.value);
    });
    widthInput.addEventListener('change', (e) => {
      let val = parseInt(e.target.value);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 100) val = 100;
      updateStrokeWidth(val);
    });
  }

  // ─ Underline Button ─
  const underlineBtn = document.getElementById('underline-btn');
  if (underlineBtn) {
    underlineBtn.addEventListener('click', () => {
      toggleUnderline();
    });
  }

  // ─ Note Enclosing Frame (Box, Circle, Cloud) ─
  document.querySelectorAll('#frame-type-group .frame-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const frameType = btn.dataset.frame;
      state.frameType = frameType;
      document.querySelectorAll('#frame-type-group .frame-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      encloseSelectedText(frameType, state);
      saveSettings(state);
    });
  });

  // ─ Toggle Icon Panel (Close / Open / Top Button) ─
  setupIconPanelToggle();
}

export function toggleIconPanel(forceOpen) {
  const panel = document.getElementById('icon-panel');
  const resizer = document.getElementById('resizer-right');
  const expandTab = document.getElementById('open-icons-btn');
  const topBtn = document.getElementById('toggle-icons-top');
  if (!panel) return;

  const willCollapse = forceOpen === undefined
    ? !panel.classList.contains('collapsed')
    : !forceOpen;

  if (willCollapse) {
    panel.classList.add('collapsed');
    if (resizer) resizer.style.display = 'none';
    if (expandTab) expandTab.classList.remove('hidden');
    if (topBtn) topBtn.classList.remove('active');
  } else {
    panel.classList.remove('collapsed');
    if (resizer) resizer.style.display = 'flex';
    if (expandTab) expandTab.classList.add('hidden');
    if (topBtn) topBtn.classList.add('active');
  }
}

function setupIconPanelToggle() {
  const closeBtn = document.getElementById('close-icons');
  const openTab = document.getElementById('open-icons-btn');
  const topBtn = document.getElementById('toggle-icons-top');

  if (closeBtn) closeBtn.addEventListener('click', () => toggleIconPanel(false));
  if (openTab) openTab.addEventListener('click', () => toggleIconPanel(true));
  if (topBtn) topBtn.addEventListener('click', () => toggleIconPanel());
}

function setupTopBar() {
  // Document name
  const docNameInput = document.getElementById('doc-name');
  docNameInput.addEventListener('input', (e) => {
    state.documentName = e.target.value || 'Untitled Document';
    document.title = `${state.documentName} — InkPad`;
    saveSettings(state);
    saveDocument(state);
  });

  // Undo / Redo buttons
  document.getElementById('undo-btn').addEventListener('click', undo);
  document.getElementById('redo-btn').addEventListener('click', redo);

  // Export PDF
  document.getElementById('export-pdf').addEventListener('click', async () => {
    const btn = document.getElementById('export-pdf');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg>
      Exporting…
    `;

    try {
      await exportToPDF(state);
      showToast('PDF exported successfully!');
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast('Export failed — see console for details');
    }

    btn.disabled = false;
    btn.innerHTML = originalHTML;
  });
}

function setupZoom() {
  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');
  const zoomReset = document.getElementById('zoom-reset');
  const zoomLevel = document.getElementById('zoom-level');

  if (zoomIn) zoomIn.addEventListener('click', () => setZoom(currentZoom + ZOOM_STEP));
  if (zoomOut) zoomOut.addEventListener('click', () => setZoom(currentZoom - ZOOM_STEP));
  if (zoomReset) zoomReset.addEventListener('click', () => setZoom(1.0));
  if (zoomLevel) zoomLevel.addEventListener('click', () => setZoom(1.0));
}

function setupShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  const openBtn = document.getElementById('shortcuts-btn');
  const closeBtn = document.getElementById('modal-close');
  const backdrop = document.getElementById('modal-backdrop');

  const openModal = () => {
    if (modal) {
      modal.classList.remove('hidden');
      requestAnimationFrame(() => modal.classList.add('open'));
    }
  };

  const closeModal = () => {
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.classList.add('hidden'), 220);
    }
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  window.openShortcutsModal = openModal;
  window.closeShortcutsModal = closeModal;
}

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('shortcuts-modal');
    const isModalOpen = modal && modal.classList.contains('open');

    // Escape handling
    if (e.key === 'Escape') {
      if (isModalOpen && window.closeShortcutsModal) {
        window.closeShortcutsModal();
        return;
      }
      state.canvas?.discardActiveObject();
      state.canvas?.renderAll();
      setTool('select', state);
      return;
    }

    // Question mark (?) opens shortcuts cheat sheet
    if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const tag = e.target.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        const activeObj = state.canvas?.getActiveObject();
        if (!activeObj || !activeObj.isEditing) {
          e.preventDefault();
          if (window.openShortcutsModal) window.openShortcutsModal();
          return;
        }
      }
    }

    // Zoom shortcuts (Ctrl + Plus, Ctrl + Minus, Ctrl + 0)
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom(currentZoom + ZOOM_STEP);
        return;
      }
      if (e.key === '-') {
        e.preventDefault();
        setZoom(currentZoom - ZOOM_STEP);
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        setZoom(1.0);
        return;
      }
    }

    // Text Formatting Shortcuts (Ctrl + B, Ctrl + I, Ctrl + U)
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'b' || key === 'i' || key === 'u') {
        const isExcluded = e.target.id === 'doc-name' ||
          (e.target.closest && (e.target.closest('#table-popup') || e.target.closest('#shortcuts-modal') || e.target.closest('.modal')));
        if (!isExcluded) {
          e.preventDefault();
          if (key === 'b') toggleBold();
          else if (key === 'i') toggleItalic();
          else if (key === 'u') toggleUnderline();
          return;
        }
      }
    }

    // Don't intercept when editing text on canvas for other shortcuts
    const activeObj = state.canvas?.getActiveObject();
    if (activeObj && activeObj.isEditing) return;

    // Don't intercept when typing in input fields
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    // Delete selected
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
      return;
    }

    // Undo
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
      return;
    }

    // Redo
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
      e.preventDefault();
      redo();
      return;
    }

    // Prevent save shortcut from triggering browser save dialog
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      return;
    }

    // Tool shortcuts: require Shift (Shift+V, Shift+T, Shift+R, Shift+C, Shift+L, Shift+A, Shift+P)
    if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'v': e.preventDefault(); setTool('select', state); break;
        case 't': e.preventDefault(); setTool('text', state); break;
        case 'r': e.preventDefault(); setTool('rect', state); break;
        case 'c': e.preventDefault(); setTool('circle', state); break;
        case 'l': e.preventDefault(); setTool('line', state); break;
        case 'a': e.preventDefault(); setTool('arrow', state); break;
        case 'p': e.preventDefault(); setTool('draw', state); break;
        case 'i': {
          e.preventDefault();
          const toggleAiBtn = document.getElementById('toggle-ai-top');
          if (toggleAiBtn) toggleAiBtn.click();
          break;
        }
      }
    }

    // Ctrl shortcuts (beyond the ones already handled above)
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();

      // Ctrl+G = Group
      if (key === 'g' && !e.shiftKey) {
        e.preventDefault();
        groupSelected();
        return;
      }

      // Ctrl+Shift+G = Ungroup
      if (key === 'g' && e.shiftKey) {
        e.preventDefault();
        ungroupSelected();
        return;
      }

      // Ctrl+D = Duplicate
      if (key === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // Ctrl+A = Select All
      if (key === 'a') {
        e.preventDefault();
        selectAllObjects();
        return;
      }
    }
  });
}

function applyToSelectedText(prop, value) {
  const canvas = state.canvas;
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (obj && (obj.type === 'i-text' || obj.type === 'textbox')) {
    obj.set(prop, value);
    obj.cursorOffsetCache = {};
    obj._forceClearCache = true;
    obj.initDimensions();
    obj.setCoords();
    canvas.requestRenderAll();
  }
}

function applyToSelectedObject(prop, value) {
  const canvas = state.canvas;
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (obj) {
    obj.set(prop, value);
    canvas.renderAll();
  }
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 2500);
}

function setupDimensionControls() {
  const dimW = document.getElementById('dim-width');
  const dimH = document.getElementById('dim-height');
  const lockBtn = document.getElementById('aspect-lock-btn');
  let aspectLocked = false;
  let aspectRatio = 1;

  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      aspectLocked = !aspectLocked;
      lockBtn.classList.toggle('active', aspectLocked);
      if (aspectLocked) {
        const w = parseInt(dimW?.value) || 1;
        const h = parseInt(dimH?.value) || 1;
        aspectRatio = w / h;
      }
    });
  }

  const applyDims = (source) => {
    const canvas = state.canvas;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;

    let w = parseInt(dimW?.value) || 1;
    let h = parseInt(dimH?.value) || 1;

    if (aspectLocked) {
      if (source === 'w') {
        h = Math.round(w / aspectRatio);
        if (dimH) dimH.value = h;
      } else {
        w = Math.round(h * aspectRatio);
        if (dimW) dimW.value = w;
      }
    }

    applyObjectDimensions(obj, Math.max(1, w), Math.max(1, h));
  };

  if (dimW) {
    dimW.addEventListener('change', () => applyDims('w'));
    dimW.addEventListener('keydown', (e) => e.stopPropagation());
  }
  if (dimH) {
    dimH.addEventListener('change', () => applyDims('h'));
    dimH.addEventListener('keydown', (e) => e.stopPropagation());
  }

  // Sync dimensions when selection changes
  if (state.canvas) {
    const syncDims = () => {
      const obj = state.canvas?.getActiveObject();
      if (obj) {
        const dims = getObjectDimensions(obj);
        if (dimW) dimW.value = dims.w;
        if (dimH) dimH.value = dims.h;
      }
    };

    state.canvas.on('selection:created', syncDims);
    state.canvas.on('selection:updated', syncDims);
    state.canvas.on('object:scaling', syncDims);
    state.canvas.on('object:resizing', syncDims);
    state.canvas.on('object:modified', syncDims);
    state.canvas.on('selection:cleared', () => {
      if (dimW) dimW.value = 0;
      if (dimH) dimH.value = 0;
    });
  }
}

function setupTableInsert() {
  const insertBtn = document.getElementById('insert-table-btn');
  if (insertBtn) {
    insertBtn.addEventListener('click', () => {
      showTablePopup();
    });
  }

  // Handle table tool button click — opens floating table popup with editable preview
  const tableToolBtn = document.querySelector('.tool-btn[data-tool="table"]');
  if (tableToolBtn) {
    tableToolBtn.addEventListener('click', () => {
      showTablePopup();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
