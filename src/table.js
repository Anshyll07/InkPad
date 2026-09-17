import { pauseHistory, resumeHistory, saveState } from './canvas.js';

const { fabric } = window;

const TABLE_DEFAULTS = {
  cellWidth: 120,
  cellHeight: 36,
  fontSize: 18,
  fontFamily: 'Caveat',
  strokeColor: '#1c1917',
  strokeWidth: 1.5,
  headerBg: '#f5f5f4',
  cellBg: '#ffffff',
  textColor: '#1c1917',
};

export function createTable(canvas, {
  rows = 3,
  cols = 3,
  x = 100,
  y = 100,
  scaleX = 1,
  scaleY = 1,
  angle = 0,
  cellWidth = TABLE_DEFAULTS.cellWidth,
  cellHeight = TABLE_DEFAULTS.cellHeight,
  fontFamily = TABLE_DEFAULTS.fontFamily,
  fontSize = TABLE_DEFAULTS.fontSize,
  strokeColor = TABLE_DEFAULTS.strokeColor,
  strokeWidth = TABLE_DEFAULTS.strokeWidth,
  headerBg = TABLE_DEFAULTS.headerBg,
  cellBg = TABLE_DEFAULTS.cellBg,
  textColor = TABLE_DEFAULTS.textColor,
  colFills = {},
  cellContents = {},
} = {}) {
  if (!canvas) return null;

  const objects = [];
  const totalW = cols * cellWidth;
  const totalH = rows * cellHeight;
  const resolvedContents = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}_${c}`;
      if (cellContents && cellContents[key] !== undefined) {
        resolvedContents[key] = cellContents[key];
      } else if (r === 0) {
        resolvedContents[key] = `Col ${c + 1}`;
      } else {
        resolvedContents[key] = '';
      }
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * cellWidth;
      const cy = r * cellHeight;
      const key = `${r}_${c}`;
      let fill = cellBg;
      if (r === 0 && headerBg) fill = headerBg;
      if (colFills[c]) fill = colFills[c];
      const cellRect = new fabric.Rect({
        left: cx,
        top: cy,
        width: cellWidth,
        height: cellHeight,
        fill: fill,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeUniform: true,
      });
      cellRect._tableCell = true;
      cellRect._row = r;
      cellRect._col = c;
      objects.push(cellRect);
      const cellText = new fabric.IText(resolvedContents[key] || '', {
        left: cx + 6,
        top: cy + (cellHeight - fontSize) / 2,
        fontSize: fontSize,
        fontFamily: fontFamily,
        fill: textColor,
        editable: false, // Editable via double-click handler
        width: cellWidth - 12,
        selectable: false,
        evented: false,
      });
      cellText._tableText = true;
      cellText._row = r;
      cellText._col = c;
      objects.push(cellText);
    }
  }
  const tableGroup = new fabric.Group(objects, {
    left: x,
    top: y,
    scaleX: scaleX || 1,
    scaleY: scaleY || 1,
    angle: angle || 0,
    objectCaching: true,
    strokeUniform: true,
    subTargetCheck: true,
  });
  tableGroup.isTable = true;
  tableGroup._tableData = {
    rows, cols, cellWidth, cellHeight,
    fontFamily, fontSize,
    strokeColor, strokeWidth,
    headerBg, cellBg, textColor,
    colFills: { ...colFills },
    cellContents: resolvedContents,
  };

  canvas.add(tableGroup);
  canvas.setActiveObject(tableGroup);
  canvas.requestRenderAll();

  return tableGroup;
}

function rebuildTableGroup(canvas, table) {
  const d = table._tableData;
  const pos = { left: table.left, top: table.top };
  const scaleX = table.scaleX || 1;
  const scaleY = table.scaleY || 1;
  const angle = table.angle || 0;

  pauseHistory();
  canvas.remove(table);
  resumeHistory();

  const newTable = createTable(canvas, {
    rows: d.rows,
    cols: d.cols,
    x: pos.left,
    y: pos.top,
    scaleX,
    scaleY,
    angle,
    cellWidth: d.cellWidth,
    cellHeight: d.cellHeight,
    fontFamily: d.fontFamily,
    fontSize: d.fontSize,
    strokeColor: d.strokeColor,
    strokeWidth: d.strokeWidth,
    headerBg: d.headerBg,
    cellBg: d.cellBg,
    textColor: d.textColor,
    colFills: d.colFills || {},
    cellContents: d.cellContents || {},
  });

  return newTable;
}

export function updateTable(canvas, table, {
  rows,
  cols,
  cellContents,
  cellWidth,
  cellHeight,
  strokeColor,
  strokeWidth,
  headerBg,
  cellBg,
  textColor,
  colFills,
  fontFamily,
  fontSize,
} = {}) {
  if (!table || !table.isTable) return;
  const d = table._tableData;

  if (rows !== undefined) d.rows = rows;
  if (cols !== undefined) d.cols = cols;
  if (cellContents !== undefined) {
    d.cellContents = { ...cellContents };
  }
  if (cellWidth !== undefined) d.cellWidth = cellWidth;
  if (cellHeight !== undefined) d.cellHeight = cellHeight;
  if (strokeColor !== undefined) d.strokeColor = strokeColor;
  if (strokeWidth !== undefined) d.strokeWidth = strokeWidth;
  if (headerBg !== undefined) d.headerBg = headerBg;
  if (cellBg !== undefined) d.cellBg = cellBg;
  if (textColor !== undefined) d.textColor = textColor;
  if (colFills !== undefined) d.colFills = { ...colFills };
  if (fontFamily !== undefined) d.fontFamily = fontFamily;
  if (fontSize !== undefined) d.fontSize = fontSize;

  return rebuildTableGroup(canvas, table);
}

export function addRow(canvas, table) {
  if (!table || !table.isTable) return;
  const d = table._tableData;
  d.rows++;
  return rebuildTableGroup(canvas, table);
}

export function removeRow(canvas, table) {
  if (!table || !table.isTable) return;
  const d = table._tableData;
  if (d.rows <= 1) return;
  for (let c = 0; c < d.cols; c++) {
    delete d.cellContents[`${d.rows - 1}_${c}`];
  }
  d.rows--;
  return rebuildTableGroup(canvas, table);
}

export function addColumn(canvas, table) {
  if (!table || !table.isTable) return;
  const d = table._tableData;
  d.cellContents[`0_${d.cols}`] = `Col ${d.cols + 1}`;
  d.cols++;
  return rebuildTableGroup(canvas, table);
}

export function removeColumn(canvas, table) {
  if (!table || !table.isTable) return;
  const d = table._tableData;
  if (d.cols <= 1) return;
  for (let r = 0; r < d.rows; r++) {
    delete d.cellContents[`${r}_${d.cols - 1}`];
  }
  delete d.colFills[d.cols - 1];
  d.cols--;
  return rebuildTableGroup(canvas, table);
}

export function setColumnColor(canvas, table, colIndex, color) {
  if (!table || !table.isTable) return;
  const d = table._tableData;
  if (colIndex < 0 || colIndex >= d.cols) return;
  d.colFills[colIndex] = color;
  const objs = table.getObjects();
  for (const obj of objs) {
    if (obj._tableCell && obj._col === colIndex) {
      obj.set('fill', color);
    }
  }
  table.dirty = true;
  canvas.requestRenderAll();
}

export function setUniversalTableStyle(canvas, table, {
  strokeColor, strokeWidth, headerBg, cellBg,
} = {}) {
  if (!table || !table.isTable) return;
  const d = table._tableData;

  if (strokeColor !== undefined) d.strokeColor = strokeColor;
  if (strokeWidth !== undefined) d.strokeWidth = strokeWidth;
  if (headerBg !== undefined) d.headerBg = headerBg;
  if (cellBg !== undefined) d.cellBg = cellBg;
  const objs = table.getObjects();
  for (const obj of objs) {
    if (obj._tableCell) {
      if (strokeColor !== undefined) obj.set('stroke', d.strokeColor);
      if (strokeWidth !== undefined) obj.set('strokeWidth', d.strokeWidth);
      let fill = d.cellBg;
      if (obj._row === 0 && d.headerBg) fill = d.headerBg;
      if (d.colFills[obj._col]) fill = d.colFills[obj._col];
      obj.set('fill', fill);
    }
  }
  table.dirty = true;
  canvas.requestRenderAll();
}

export function setupTableCellEditing(canvas) {
  canvas.on('mouse:dblclick', (opt) => {
    const target = opt.target;
    if (!target || !target.isTable) return;
    const pointer = canvas.getPointer(opt.e);
    const d = target._tableData;
    const localPoint = target.toLocalPoint(
      new fabric.Point(pointer.x, pointer.y),
      'center',
      'center'
    );

    const totalW = d.cols * d.cellWidth;
    const totalH = d.rows * d.cellHeight;
    const lx = localPoint.x + totalW / 2;
    const ly = localPoint.y + totalH / 2;

    const col = Math.floor(lx / d.cellWidth);
    const row = Math.floor(ly / d.cellHeight);

    if (col < 0 || col >= d.cols || row < 0 || row >= d.rows) return;
    const key = `${row}_${col}`;
    const currentText = d.cellContents[key] || '';
    const cellWorldX = target.left + (col * d.cellWidth * (target.scaleX || 1)) -
      ((totalW / 2) * (target.scaleX || 1)) + (6 * (target.scaleX || 1));
    const cellWorldY = target.top + (row * d.cellHeight * (target.scaleY || 1)) -
      ((totalH / 2) * (target.scaleY || 1)) + ((d.cellHeight - d.fontSize) / 2 * (target.scaleY || 1));

    const editText = new fabric.IText(currentText, {
      left: cellWorldX,
      top: cellWorldY,
      fontSize: d.fontSize * (target.scaleX || 1),
      fontFamily: d.fontFamily,
      fill: d.textColor,
      editable: true,
      objectCaching: false,
      padding: 2,
    });

    editText._isTableCellEdit = true;
    editText._tableRef = target;
    editText._cellRow = row;
    editText._cellCol = col;

    canvas.add(editText);
    canvas.setActiveObject(editText);
    editText.enterEditing();
    editText.selectAll();

    editText.on('editing:exited', () => {
      const newText = editText.text || '';
      d.cellContents[key] = newText;
      const objs = target.getObjects();
      for (const obj of objs) {
        if (obj._tableText && obj._row === row && obj._col === col) {
          obj.set('text', newText);
          obj.dirty = true;
          break;
        }
      }

      target.dirty = true;
      canvas.remove(editText);
      canvas.setActiveObject(target);
      canvas.requestRenderAll();
    });
  });
}

export function isTable(obj) {
  return obj && obj.isTable === true;
}
