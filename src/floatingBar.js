// Right-click / context menu with dynamic
// sections for text, shapes, groups, tables
// + High-End Table Creation Popup

import {
  deleteSelected,
  duplicateSelected,
  groupSelected,
  ungroupSelected,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  selectAllObjects,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  setTextAlign,
  setTool,
  isShape,
  getCanvas,
  hexToRgba,
  getObjectDimensions,
  applyObjectDimensions,
} from './canvas.js';
import {
  createTable,
  updateTable,
  addRow,
  removeRow,
  addColumn,
  removeColumn,
  setColumnColor,
  setUniversalTableStyle,
  isTable,
} from './table.js';

const ICONS = {
  bold:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>`,
  italic:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>`,
  underline:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>`,
  alignLeft:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>`,
  alignCenter: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>`,
  alignRight:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg>`,
  copy:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
  forward:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>`,
  backward:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>`,
  toFront:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/></svg>`,
  toBack:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><line x1="12" y1="18" x2="12" y2="6"/></svg>`,
  trash:       `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`,
  group:       `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><path d="M10 6h4m-4 12h4M6 10v4m12-4v4"/></svg>`,
  ungroup:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/></svg>`,
  text:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  rect:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
  circle:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  table:       `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  selectAll:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>`,
  zoom:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  addRow:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="15" x2="12" y2="21"/></svg>`,
  removeRow:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`,
  addCol:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="15" y1="12" x2="21" y2="12"/></svg>`,
  removeCol:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="15" y1="12" x2="19" y2="12"/></svg>`,
  palette:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>`,
  border:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
  close:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  plus:        `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  minus:       `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
};

let floatingBar = null;
let tablePopup = null;
let currentState = null;

export function initFloatingBar(state) {
  currentState = state;
  createFloatingBarElement();
  createTablePopup();
  bindRightClick();
  blockBrowserContextMenu();
}

function blockBrowserContextMenu() {
  // Capture phase listener ensures the native context menu never fires anywhere near canvas
  window.addEventListener('contextmenu', (e) => {
    const canvasArea = document.getElementById('canvas-area');
    const floatingBarEl = document.getElementById('floating-bar');
    const tablePopupEl = document.getElementById('table-popup');

    const isInsideCanvas = canvasArea && (canvasArea.contains(e.target) || e.target.closest('#canvas-area'));
    const isInsideFloatingBar = floatingBarEl && (floatingBarEl.contains(e.target) || e.target.closest('#floating-bar'));
    const isInsideTablePopup = tablePopupEl && (tablePopupEl.contains(e.target) || e.target.closest('#table-popup'));
    const isInsideCanvasContainer = e.target && e.target.closest && e.target.closest('.canvas-container');

    if (isInsideCanvas || isInsideFloatingBar || isInsideTablePopup || isInsideCanvasContainer) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);
}

function createFloatingBarElement() {
  if (floatingBar) floatingBar.remove();

  floatingBar = document.createElement('div');
  floatingBar.id = 'floating-bar';
  floatingBar.className = 'floating-bar hidden';
  document.body.appendChild(floatingBar);

  // Prevent clicking buttons in floatingBar from stealing focus or blurring text selection
  floatingBar.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
    }
  });

  // Close on outside click
  document.addEventListener('mousedown', (e) => {
    if (floatingBar && !floatingBar.contains(e.target) && !floatingBar.classList.contains('hidden')) {
      hideFloatingBar();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && floatingBar && !floatingBar.classList.contains('hidden')) {
      hideFloatingBar();
    }
  });
}

function createTablePopup() {
  if (tablePopup) tablePopup.remove();

  tablePopup = document.createElement('div');
  tablePopup.id = 'table-popup';
  tablePopup.className = 'table-popup hidden';
  document.body.appendChild(tablePopup);

  // Close on outside click
  document.addEventListener('mousedown', (e) => {
    if (tablePopup && !tablePopup.contains(e.target) && !tablePopup.classList.contains('hidden')) {
      const tableBtn = document.querySelector('.tool-btn[data-tool="table"]');
      const insertTableSidebarBtn = document.getElementById('insert-table-btn');
      if (tableBtn && tableBtn.contains(e.target)) return;
      if (insertTableSidebarBtn && insertTableSidebarBtn.contains(e.target)) return;
      hideTablePopup();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tablePopup && !tablePopup.classList.contains('hidden')) {
      hideTablePopup();
    }
  });
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}

export function showTablePopup(opts = {}) {
  if (!tablePopup) return;

  const isEdit = !!(opts && opts.mode === 'edit' && opts.table && opts.table.isTable);
  const targetTable = isEdit ? opts.table : null;
  const tableData = isEdit ? (targetTable._tableData || {}) : {};

  let selectedRows = isEdit ? Math.max(1, tableData.rows || 3) : 3;
  let selectedCols = isEdit ? Math.max(1, tableData.cols || 3) : 3;
  const cellValues = isEdit && tableData.cellContents
    ? { ...tableData.cellContents }
    : {};

  if (!isEdit) {
    // Pre-seed default column headers
    for (let c = 0; c < 8; c++) {
      cellValues[`0_${c}`] = `Column ${c + 1}`;
    }
  }

  const renderPopup = () => {
    const maxGridRows = Math.max(8, selectedRows);
    const maxGridCols = Math.max(8, selectedCols);

    // 1. Grid selector
    let gridHTML = '';
    for (let r = 0; r < maxGridRows; r++) {
      for (let c = 0; c < maxGridCols; c++) {
        const isActive = r < selectedRows && c < selectedCols;
        gridHTML += `<div class="tp-cell ${isActive ? 'active' : ''}" data-r="${r}" data-c="${c}"></div>`;
      }
    }

    // 2. Editable Preview Table
    let previewHTML = '<table class="tp-preview-table">';
    for (let r = 0; r < selectedRows; r++) {
      previewHTML += '<tr>';
      for (let c = 0; c < selectedCols; c++) {
        const key = `${r}_${c}`;
        const currentVal = cellValues[key] !== undefined ? cellValues[key] : (r === 0 ? `Column ${c + 1}` : '');
        const isHeader = r === 0;
        const cls = isHeader ? 'tp-header-cell' : 'tp-data-cell';
        const placeholder = isHeader ? `Col ${c + 1}` : `Value`;
        previewHTML += `
          <td class="${cls}">
            <input type="text"
                   class="tp-cell-input ${isHeader ? 'tp-header-input' : ''}"
                   data-r="${r}"
                   data-c="${c}"
                   value="${escapeHtml(currentVal)}"
                   placeholder="${placeholder}"
                   spellcheck="false">
          </td>`;
      }
      previewHTML += '</tr>';
    }
    previewHTML += '</table>';

    const titleText = isEdit ? 'Edit Table' : 'Insert Table';
    const badgeHtml = isEdit ? `<span class="tp-mode-badge">Edit Mode</span>` : '';
    const btnText = isEdit
      ? `Update Table (${selectedRows} × ${selectedCols})`
      : `Insert ${selectedRows} × ${selectedCols} Table`;
    const hintText = isEdit
      ? 'Type in any cell or header to update its value. Use steppers or buttons to add or remove rows and columns.'
      : 'Type inside column headers and cells above to prefill your table.';

    tablePopup.innerHTML = `
      <div class="tp-header">
        <div class="tp-title-row">
          <span class="tp-title-icon">${ICONS.table}</span>
          <span class="tp-title">${titleText}</span>
          ${badgeHtml}
        </div>
        <button class="tp-close" title="Close">${ICONS.close}</button>
      </div>

      <div class="tp-body">
        <!-- Size Counter & Grid -->
        <div class="tp-size-section">
          <div class="tp-dimension-steppers">
            <div class="tp-stepper-field">
              <label>Rows</label>
              <div class="tp-stepper">
                <button class="tp-step-btn" data-step="row-dec" title="Decrease Rows">${ICONS.minus}</button>
                <input type="number" id="tp-rows-input" class="tp-num-input" value="${selectedRows}" min="1" max="25">
                <button class="tp-step-btn" data-step="row-inc" title="Increase Rows">${ICONS.plus}</button>
              </div>
            </div>
            <div class="tp-stepper-field">
              <label>Columns</label>
              <div class="tp-stepper">
                <button class="tp-step-btn" data-step="col-dec" title="Decrease Columns">${ICONS.minus}</button>
                <input type="number" id="tp-cols-input" class="tp-num-input" value="${selectedCols}" min="1" max="20">
                <button class="tp-step-btn" data-step="col-inc" title="Increase Columns">${ICONS.plus}</button>
              </div>
            </div>
          </div>

          <div class="tp-grid-wrap">
            <span class="tp-subheading">Quick Select Grid (${selectedRows} × ${selectedCols})</span>
            <div class="tp-grid" style="grid-template-columns: repeat(${maxGridCols}, 1fr);">${gridHTML}</div>
          </div>
        </div>

        <!-- Editable Preview -->
        <div class="tp-preview-section">
          <div class="tp-preview-header-bar">
            <span class="tp-subheading">Table Preview & Editable Values</span>
            <div class="tp-quick-actions">
              <button class="tp-action-tag" data-quick="add-row" title="Add Row">${ICONS.plus} Row</button>
              <button class="tp-action-tag tp-action-tag-sub" data-quick="remove-row" title="Remove Last Row">${ICONS.minus} Row</button>
              <button class="tp-action-tag" data-quick="add-col" title="Add Column">${ICONS.plus} Col</button>
              <button class="tp-action-tag tp-action-tag-sub" data-quick="remove-col" title="Remove Last Column">${ICONS.minus} Col</button>
            </div>
          </div>
          <div class="tp-preview-scroll-area">
            ${previewHTML}
          </div>
          <span class="tp-hint-text">${hintText}</span>
        </div>
      </div>

      <div class="tp-footer">
        <button class="tp-cancel-btn">Cancel</button>
        <button class="tp-insert-btn ${isEdit ? 'tp-update-btn' : ''}">
          ${ICONS.table}
          <span>${btnText}</span>
        </button>
      </div>
    `;

    // ── Bind Events ──

    const syncCurrentInputValues = () => {
      tablePopup.querySelectorAll('.tp-cell-input').forEach((inp) => {
        const r = inp.dataset.r;
        const c = inp.dataset.c;
        cellValues[`${r}_${c}`] = inp.value;
      });
    };

    // Save cell inputs on the fly so values are preserved, and auto-select on focus
    tablePopup.querySelectorAll('.tp-cell-input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const r = inp.dataset.r;
        const c = inp.dataset.c;
        cellValues[`${r}_${c}`] = e.target.value;
      });
      inp.addEventListener('focus', () => {
        inp.select();
      });
      inp.addEventListener('keydown', (e) => e.stopPropagation());
    });

    // Grid Hover & Selection
    tablePopup.querySelectorAll('.tp-cell').forEach((cell) => {
      cell.addEventListener('mouseenter', () => {
        const hoverR = parseInt(cell.dataset.r) + 1;
        const hoverC = parseInt(cell.dataset.c) + 1;
        tablePopup.querySelectorAll('.tp-cell').forEach((cc) => {
          const cr = parseInt(cc.dataset.r);
          const ccol = parseInt(cc.dataset.c);
          cc.classList.toggle('hover', cr < hoverR && ccol < hoverC);
        });
      });

      cell.addEventListener('mouseleave', () => {
        tablePopup.querySelectorAll('.tp-cell').forEach((cc) => {
          cc.classList.remove('hover');
        });
      });

      cell.addEventListener('click', () => {
        syncCurrentInputValues();
        selectedRows = parseInt(cell.dataset.r) + 1;
        selectedCols = parseInt(cell.dataset.c) + 1;
        renderPopup();
      });
    });

    // Steppers
    const rowsInput = tablePopup.querySelector('#tp-rows-input');
    const colsInput = tablePopup.querySelector('#tp-cols-input');

    if (rowsInput) {
      rowsInput.addEventListener('change', () => {
        syncCurrentInputValues();
        selectedRows = Math.max(1, Math.min(25, parseInt(rowsInput.value) || 1));
        renderPopup();
      });
      rowsInput.addEventListener('keydown', (e) => e.stopPropagation());
    }

    if (colsInput) {
      colsInput.addEventListener('change', () => {
        syncCurrentInputValues();
        selectedCols = Math.max(1, Math.min(20, parseInt(colsInput.value) || 1));
        renderPopup();
      });
      colsInput.addEventListener('keydown', (e) => e.stopPropagation());
    }

    tablePopup.querySelectorAll('.tp-step-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncCurrentInputValues();
        const step = btn.dataset.step;
        if (step === 'row-inc') selectedRows = Math.min(25, selectedRows + 1);
        if (step === 'row-dec') selectedRows = Math.max(1, selectedRows - 1);
        if (step === 'col-inc') selectedCols = Math.min(20, selectedCols + 1);
        if (step === 'col-dec') selectedCols = Math.max(1, selectedCols - 1);
        renderPopup();
      });
    });

    // Quick Action Tags
    const addRowBtn = tablePopup.querySelector('[data-quick="add-row"]');
    if (addRowBtn) {
      addRowBtn.addEventListener('click', () => {
        syncCurrentInputValues();
        selectedRows = Math.min(25, selectedRows + 1);
        renderPopup();
      });
    }

    const removeRowBtn = tablePopup.querySelector('[data-quick="remove-row"]');
    if (removeRowBtn) {
      removeRowBtn.addEventListener('click', () => {
        if (selectedRows > 1) {
          syncCurrentInputValues();
          selectedRows = Math.max(1, selectedRows - 1);
          renderPopup();
        }
      });
    }

    const addColBtn = tablePopup.querySelector('[data-quick="add-col"]');
    if (addColBtn) {
      addColBtn.addEventListener('click', () => {
        syncCurrentInputValues();
        selectedCols = Math.min(20, selectedCols + 1);
        renderPopup();
      });
    }

    const removeColBtn = tablePopup.querySelector('[data-quick="remove-col"]');
    if (removeColBtn) {
      removeColBtn.addEventListener('click', () => {
        if (selectedCols > 1) {
          syncCurrentInputValues();
          selectedCols = Math.max(1, selectedCols - 1);
          renderPopup();
        }
      });
    }

    // Close & Cancel
    const closeBtn = tablePopup.querySelector('.tp-close');
    if (closeBtn) closeBtn.addEventListener('click', hideTablePopup);

    const cancelBtn = tablePopup.querySelector('.tp-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', hideTablePopup);

    // Primary Action Button (Insert or Update)
    const actionBtn = tablePopup.querySelector('.tp-insert-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        const canvas = getCanvas();
        if (!canvas) return;

        // Commit all current input values
        syncCurrentInputValues();

        if (isEdit && targetTable) {
          updateTable(canvas, targetTable, {
            rows: selectedRows,
            cols: selectedCols,
            cellContents: cellValues,
          });
          showToast(`Updated Table (${selectedRows} × ${selectedCols})`);
        } else {
          if (!currentState) return;
          const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
          const zoom = canvas.getZoom() || 1;
          const spawnX = Math.max(60, Math.round((-vpt[4] + 160) / zoom));
          const spawnY = Math.max(60, Math.round((-vpt[5] + 160) / zoom));

          createTable(canvas, {
            rows: selectedRows,
            cols: selectedCols,
            x: spawnX,
            y: spawnY,
            fontFamily: currentState.fontFamily || 'Caveat',
            cellContents: cellValues,
          });
          showToast(`Inserted ${selectedRows} × ${selectedCols} Table`);
        }

        hideTablePopup();
      });
    }
  };

  renderPopup();

  // Position nicely in workspace
  if (isEdit && targetTable) {
    const tBound = targetTable.getBoundingRect ? targetTable.getBoundingRect() : null;
    let targetLeft = Math.max(260, Math.round((window.innerWidth - 440) / 2));
    let targetTop = 100;
    if (tBound) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const popupW = 420;
      const popupH = 540;
      let x = tBound.left + tBound.width + 24;
      let y = tBound.top;
      if (x + popupW > vw - 20) {
        x = tBound.left - popupW - 24;
      }
      if (x < 240 || x + popupW > vw - 20) {
        x = Math.max(260, Math.round((vw - popupW) / 2));
      }
      if (y + popupH > vh - 20) {
        y = Math.max(20, vh - popupH - 20);
      }
      targetLeft = x;
      targetTop = Math.max(20, y);
    }
    tablePopup.style.left = `${targetLeft}px`;
    tablePopup.style.top = `${targetTop}px`;
  } else {
    const tableBtn = document.querySelector('.tool-btn[data-tool="table"]');
    if (tableBtn) {
      const btnRect = tableBtn.getBoundingClientRect();
      let topPos = Math.max(20, btnRect.top - 40);
      if (topPos + 500 > window.innerHeight) {
        topPos = Math.max(20, window.innerHeight - 520);
      }
      tablePopup.style.left = `${Math.min(window.innerWidth - 440, btnRect.right + 14)}px`;
      tablePopup.style.top = `${topPos}px`;
    } else {
      tablePopup.style.left = '260px';
      tablePopup.style.top = '120px';
    }
  }

  tablePopup.classList.remove('hidden');
  requestAnimationFrame(() => tablePopup.classList.add('visible'));
}

export function hideTablePopup() {
  if (!tablePopup) return;
  tablePopup.classList.remove('visible');
  tablePopup.classList.add('hidden');
}

function showFloatingBar(x, y, html) {
  if (!floatingBar) return;
  floatingBar.innerHTML = html;
  floatingBar.classList.remove('hidden');

  requestAnimationFrame(() => {
    const rect = floatingBar.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let posX = x;
    let posY = y;

    if (posX + rect.width > vw - 12) posX = vw - rect.width - 12;
    if (posY + rect.height > vh - 12) posY = vh - rect.height - 12;
    if (posX < 12) posX = 12;
    if (posY < 12) posY = 12;

    floatingBar.style.left = `${posX}px`;
    floatingBar.style.top = `${posY}px`;
    floatingBar.classList.add('visible');
  });

  bindActions();
}

export function hideFloatingBar() {
  if (!floatingBar) return;
  floatingBar.classList.remove('visible');
  floatingBar.classList.add('hidden');
}

function bindRightClick() {
  const canvas = getCanvas();
  if (!canvas) return;

  canvas.on('mouse:down', (opt) => {
    // Check for right click (opt.button === 3)
    if (opt.button !== 3) {
      if (floatingBar && !floatingBar.classList.contains('hidden')) {
        hideFloatingBar();
      }
      return;
    }

    if (opt.e) {
      opt.e.preventDefault();
      opt.e.stopPropagation();
      if (opt.e.stopImmediatePropagation) opt.e.stopImmediatePropagation();
    }

    const pointer = opt.e;
    const x = pointer.clientX || pointer.pageX;
    const y = pointer.clientY || pointer.pageY;

    const target = opt.target;

    if (!target) {
      showFloatingBar(x, y, buildCanvasMenu());
    } else if (target.isTable) {
      canvas.setActiveObject(target);
      showFloatingBar(x, y, buildTableMenu(target));
    } else if (target.type === 'activeSelection') {
      showFloatingBar(x, y, buildMultiSelectMenu());
    } else if (target.type === 'group') {
      showFloatingBar(x, y, buildGroupMenu());
    } else if (target.type === 'i-text' || target.type === 'textbox') {
      if (target.selectionStart !== undefined && target.selectionStart !== target.selectionEnd) {
        target._lastSelectionStart = target.selectionStart;
        target._lastSelectionEnd = target.selectionEnd;
      }
      if (canvas.getActiveObject() !== target) {
        canvas.setActiveObject(target);
      }
      showFloatingBar(x, y, buildTextMenu(target));
    } else if (isShape(target) || target.type === 'line' || target.isArrow) {
      canvas.setActiveObject(target);
      showFloatingBar(x, y, buildShapeMenu(target));
    } else {
      canvas.setActiveObject(target);
      showFloatingBar(x, y, buildGenericMenu());
    }
  });

  // Also support right clicking on the canvas container background
  const canvasArea = document.getElementById('canvas-area');
  if (canvasArea) {
    canvasArea.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // If right click was outside the active fabric object, show canvas menu
      const activeObj = canvas.getActiveObject();
      if (!activeObj) {
        showFloatingBar(e.clientX, e.clientY, buildCanvasMenu());
      }
    });
  }
}

function menuItem(iconHtml, label, action, cls = '') {
  return `<button class="fb-item ${cls}" data-action="${action}" title="${label}"><span class="fb-icon">${iconHtml}</span><span>${label}</span></button>`;
}

function menuDivider() {
  return `<div class="fb-divider"></div>`;
}

function menuLabel(text) {
  return `<div class="fb-label">${text}</div>`;
}

function buildTextMenu(obj) {
  let isBold = obj.fontWeight === 'bold' || obj.fontWeight === 700;
  let isItalic = obj.fontStyle === 'italic';
  let isUnderline = !!obj.underline;

  const selStart = (obj.selectionStart !== undefined && obj.selectionStart !== obj.selectionEnd)
    ? obj.selectionStart
    : obj._lastSelectionStart;
  const selEnd = (obj.selectionEnd !== undefined && obj.selectionStart !== obj.selectionEnd)
    ? obj.selectionEnd
    : obj._lastSelectionEnd;

  if (selStart !== undefined && selEnd !== undefined && selStart !== selEnd) {
    const start = Math.min(selStart, selEnd);
    const end = Math.max(selStart, selEnd);
    const styles = (obj.getSelectionStyles && obj.getSelectionStyles(start, end, true)) || [];
    if (styles.length > 0) {
      isBold = styles.every((s) => s && (s.fontWeight === 'bold' || s.fontWeight === 700 || s.fontWeight === '700'));
      isItalic = styles.every((s) => s && s.fontStyle === 'italic');
      isUnderline = styles.every((s) => s && !!s.underline);
    }
  }

  return `
    ${menuLabel('Text Format')}
    <div class="fb-row">
      ${menuItem(ICONS.bold, 'Bold (Ctrl+B)', 'bold', isBold ? 'active' : '')}
      ${menuItem(ICONS.italic, 'Italic (Ctrl+I)', 'italic', isItalic ? 'active' : '')}
      ${menuItem(ICONS.underline, 'Underline (Ctrl+U)', 'underline', isUnderline ? 'active' : '')}
    </div>
    ${menuDivider()}
    ${menuLabel('Alignment')}
    <div class="fb-row">
      ${menuItem(ICONS.alignLeft, 'Left', 'align-left')}
      ${menuItem(ICONS.alignCenter, 'Center', 'align-center')}
      ${menuItem(ICONS.alignRight, 'Right', 'align-right')}
    </div>
    ${menuDivider()}
    ${menuLabel('Layer')}
    <div class="fb-row">
      ${menuItem(ICONS.toFront, 'To Front', 'bring-front')}
      ${menuItem(ICONS.toBack, 'To Back', 'send-back')}
    </div>
    <div class="fb-row">
      ${menuItem(ICONS.forward, 'Forward', 'bring-forward')}
      ${menuItem(ICONS.backward, 'Backward', 'send-backward')}
    </div>
    ${menuDivider()}
    ${menuLabel('Actions')}
    ${menuItem(ICONS.copy, 'Duplicate (Ctrl+D)', 'duplicate')}
    ${menuItem(ICONS.trash, 'Delete', 'delete', 'fb-danger')}
  `;
}

function buildShapeMenu(obj) {
  const dims = getObjectDimensions(obj);
  return `
    ${menuLabel('Dimensions')}
    <div class="fb-dims-row">
      <label>W</label><input type="number" class="fb-dim-input" data-dim="w" value="${dims.w}" min="1">
      <label>H</label><input type="number" class="fb-dim-input" data-dim="h" value="${dims.h}" min="1">
    </div>
    ${menuDivider()}
    ${menuLabel('Layer')}
    <div class="fb-row">
      ${menuItem(ICONS.toFront, 'Bring to Front', 'bring-front')}
      ${menuItem(ICONS.toBack, 'Send to Back', 'send-back')}
    </div>
    <div class="fb-row">
      ${menuItem(ICONS.forward, 'Bring Forward', 'bring-forward')}
      ${menuItem(ICONS.backward, 'Send Backward', 'send-backward')}
    </div>
    ${menuDivider()}
    ${menuItem(ICONS.copy, 'Duplicate (Ctrl+D)', 'duplicate')}
    ${menuItem(ICONS.trash, 'Delete', 'delete', 'fb-danger')}
  `;
}

function buildMultiSelectMenu() {
  return `
    ${menuLabel('Selection')}
    ${menuItem(ICONS.group, 'Group Objects (Ctrl+G)', 'group')}
    ${menuDivider()}
    ${menuLabel('Layer')}
    <div class="fb-row">
      ${menuItem(ICONS.toFront, 'Bring to Front', 'bring-front')}
      ${menuItem(ICONS.toBack, 'Send to Back', 'send-back')}
    </div>
    ${menuDivider()}
    ${menuItem(ICONS.copy, 'Duplicate All', 'duplicate')}
    ${menuItem(ICONS.trash, 'Delete All', 'delete', 'fb-danger')}
  `;
}

function buildGroupMenu() {
  return `
    ${menuLabel('Group')}
    ${menuItem(ICONS.ungroup, 'Ungroup (Ctrl+Shift+G)', 'ungroup')}
    ${menuDivider()}
    ${menuLabel('Layer')}
    <div class="fb-row">
      ${menuItem(ICONS.toFront, 'Bring to Front', 'bring-front')}
      ${menuItem(ICONS.toBack, 'Send to Back', 'send-back')}
    </div>
    <div class="fb-row">
      ${menuItem(ICONS.forward, 'Bring Forward', 'bring-forward')}
      ${menuItem(ICONS.backward, 'Send Backward', 'send-backward')}
    </div>
    ${menuDivider()}
    ${menuItem(ICONS.copy, 'Duplicate (Ctrl+D)', 'duplicate')}
    ${menuItem(ICONS.trash, 'Delete', 'delete', 'fb-danger')}
  `;
}

function buildTableMenu(table) {
  const d = table._tableData || {};
  let colOptions = '';
  for (let c = 0; c < (d.cols || 3); c++) {
    const sel = c === 0 ? 'selected' : '';
    const colName = (d.cellContents && d.cellContents[`0_${c}`]) ? d.cellContents[`0_${c}`] : `Col ${c + 1}`;
    colOptions += `<option value="${c}" ${sel}>${escapeHtml(colName)}</option>`;
  }

  return `
    ${menuLabel('Table')}
    ${menuItem(ICONS.table, 'Edit Table…', 'table-edit-popup', 'fb-primary-item')}
    ${menuDivider()}
    ${menuLabel('Table Structure')}
    <div class="fb-row">
      ${menuItem(ICONS.addRow, 'Add Row', 'table-add-row')}
      ${menuItem(ICONS.removeRow, 'Remove Row', 'table-remove-row')}
    </div>
    <div class="fb-row">
      ${menuItem(ICONS.addCol, 'Add Column', 'table-add-col')}
      ${menuItem(ICONS.removeCol, 'Remove Column', 'table-remove-col')}
    </div>
    ${menuDivider()}
    ${menuLabel('Column Fill Color')}
    <div class="fb-table-col-fill">
      <select class="fb-col-select">${colOptions}</select>
      <input type="color" class="fb-col-color" value="#fef08a" title="Column fill color">
      <button class="fb-item" data-action="table-col-fill" style="flex:0;padding:5px 9px">Apply</button>
    </div>
    ${menuDivider()}
    ${menuLabel('Border Style')}
    <div class="fb-table-border-row">
      <input type="color" class="fb-table-border-color" value="${d.strokeColor || '#1c1917'}" title="Border color">
      <input type="number" class="fb-table-border-width" value="${d.strokeWidth || 1.5}" min="0.5" max="10" step="0.5" title="Border width">
      <button class="fb-item" data-action="table-apply-border" style="flex:0;padding:5px 9px">Apply</button>
    </div>
    ${menuDivider()}
    ${menuLabel('Layer (Send to Back / Front)')}
    <div class="fb-row">
      ${menuItem(ICONS.toFront, 'Bring to Front', 'bring-front')}
      ${menuItem(ICONS.toBack, 'Send to Back', 'send-back')}
    </div>
    <div class="fb-row">
      ${menuItem(ICONS.forward, 'Bring Forward', 'bring-forward')}
      ${menuItem(ICONS.backward, 'Send Backward', 'send-backward')}
    </div>
    ${menuDivider()}
    ${menuItem(ICONS.copy, 'Duplicate Table', 'duplicate')}
    ${menuItem(ICONS.trash, 'Delete Table', 'delete', 'fb-danger')}
  `;
}

function buildCanvasMenu() {
  return `
    ${menuLabel('Add Elements')}
    ${menuItem(ICONS.text, 'Add Text', 'canvas-add-text')}
    ${menuItem(ICONS.rect, 'Add Rectangle', 'canvas-add-rect')}
    ${menuItem(ICONS.circle, 'Add Circle', 'canvas-add-circle')}
    ${menuItem(ICONS.table, 'Insert Table…', 'canvas-add-table')}
    ${menuDivider()}
    ${menuItem(ICONS.selectAll, 'Select All (Ctrl+A)', 'select-all')}
    ${menuItem(ICONS.zoom, 'Reset Zoom', 'reset-zoom')}
  `;
}

function buildGenericMenu() {
  return `
    ${menuLabel('Object')}
    <div class="fb-row">
      ${menuItem(ICONS.toFront, 'Bring to Front', 'bring-front')}
      ${menuItem(ICONS.toBack, 'Send to Back', 'send-back')}
    </div>
    <div class="fb-row">
      ${menuItem(ICONS.forward, 'Bring Forward', 'bring-forward')}
      ${menuItem(ICONS.backward, 'Send Backward', 'send-backward')}
    </div>
    ${menuDivider()}
    ${menuItem(ICONS.copy, 'Duplicate (Ctrl+D)', 'duplicate')}
    ${menuItem(ICONS.trash, 'Delete', 'delete', 'fb-danger')}
  `;
}

function bindActions() {
  if (!floatingBar) return;
  const canvas = getCanvas();

  floatingBar.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      handleAction(action, canvas);
    });
  });

  floatingBar.querySelectorAll('.fb-dim-input').forEach((input) => {
    input.addEventListener('change', () => {
      const obj = canvas.getActiveObject();
      if (!obj) return;
      const wInput = floatingBar.querySelector('.fb-dim-input[data-dim="w"]');
      const hInput = floatingBar.querySelector('.fb-dim-input[data-dim="h"]');
      const w = parseInt(wInput?.value) || 1;
      const h = parseInt(hInput?.value) || 1;
      applyObjectDimensions(obj, w, h);
    });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());
  });

  floatingBar.querySelectorAll('select, input').forEach((el) => {
    el.addEventListener('keydown', (e) => e.stopPropagation());
  });
}

function handleAction(action, canvas) {
  switch (action) {
    case 'bold': toggleBold(); break;
    case 'italic': toggleItalic(); break;
    case 'underline': toggleUnderline(); break;
    case 'align-left': setTextAlign('left'); break;
    case 'align-center': setTextAlign('center'); break;
    case 'align-right': setTextAlign('right'); break;
    case 'duplicate': duplicateSelected(); break;
    case 'delete': deleteSelected(); break;
    case 'bring-forward': bringForward(); break;
    case 'send-backward': sendBackward(); break;
    case 'bring-front': bringToFront(); break;
    case 'send-back': sendToBack(); break;
    case 'group': groupSelected(); break;
    case 'ungroup': ungroupSelected(); break;

    case 'table-edit-popup': {
      const t = canvas.getActiveObject();
      if (t && t.isTable) {
        showTablePopup({ mode: 'edit', table: t });
      }
      break;
    }

    case 'table-add-row': {
      const t = canvas.getActiveObject();
      if (t && t.isTable) addRow(canvas, t);
      break;
    }
    case 'table-remove-row': {
      const t = canvas.getActiveObject();
      if (t && t.isTable) removeRow(canvas, t);
      break;
    }
    case 'table-add-col': {
      const t = canvas.getActiveObject();
      if (t && t.isTable) addColumn(canvas, t);
      break;
    }
    case 'table-remove-col': {
      const t = canvas.getActiveObject();
      if (t && t.isTable) removeColumn(canvas, t);
      break;
    }
    case 'table-col-fill': {
      const t = canvas.getActiveObject();
      if (t && t.isTable) {
        const colSel = floatingBar.querySelector('.fb-col-select');
        const colColor = floatingBar.querySelector('.fb-col-color');
        if (colSel && colColor) {
          setColumnColor(canvas, t, parseInt(colSel.value), colColor.value);
        }
      }
      break;
    }
    case 'table-apply-border': {
      const t = canvas.getActiveObject();
      if (t && t.isTable) {
        const borderColor = floatingBar.querySelector('.fb-table-border-color');
        const borderWidth = floatingBar.querySelector('.fb-table-border-width');
        setUniversalTableStyle(canvas, t, {
          strokeColor: borderColor?.value,
          strokeWidth: parseFloat(borderWidth?.value) || 1.5,
        });
      }
      break;
    }

    case 'canvas-add-text':
      if (currentState) setTool('text', currentState);
      break;
    case 'canvas-add-rect':
      if (currentState) setTool('rect', currentState);
      break;
    case 'canvas-add-circle':
      if (currentState) setTool('circle', currentState);
      break;
    case 'canvas-add-table':
      showTablePopup();
      break;
    case 'select-all':
      selectAllObjects();
      break;
    case 'reset-zoom': {
      const resetBtn = document.getElementById('zoom-reset');
      if (resetBtn) resetBtn.click();
      break;
    }
  }

  hideFloatingBar();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
