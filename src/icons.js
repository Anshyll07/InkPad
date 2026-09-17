// Lucide icon browsing, search, and canvas insertion

import { icons } from 'lucide';

const BATCH_SIZE = 48;

let allIconNames = [];
let filteredIcons = [];
let loadedCount = 0;

export function initIconPanel(state) {
  // Get sorted icon names
  allIconNames = Object.keys(icons).sort();
  filteredIcons = [...allIconNames];
  loadedCount = 0;

  // Update count display
  updateCount();

  // Search input
  const searchInput = document.getElementById('icon-search');
  let debounceTimer = null;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = searchInput.value.toLowerCase().trim();
      filteredIcons = query
        ? allIconNames.filter((name) => name.toLowerCase().includes(query))
        : [...allIconNames];
      loadedCount = 0;
      renderIcons(state);
    }, 200);
  });

  // Initial render
  renderIcons(state);
}

function renderIcons(state) {
  const grid = document.getElementById('icon-grid');
  grid.innerHTML = '';
  loadedCount = 0;
  appendBatch(state);
}

function appendBatch(state) {
  const grid = document.getElementById('icon-grid');

  // Remove existing "load more" button
  const existingBtn = grid.querySelector('.load-more-btn');
  if (existingBtn) existingBtn.remove();

  const end = Math.min(loadedCount + BATCH_SIZE, filteredIcons.length);

  // Use DocumentFragment for performance
  const fragment = document.createDocumentFragment();

  for (let i = loadedCount; i < end; i++) {
    const name = filteredIcons[i];
    const item = document.createElement('div');
    item.className = 'icon-item';
    item.title = formatIconName(name);
    item.innerHTML = `
      ${buildSvgString(name)}
      <span>${formatIconName(name)}</span>
    `;
    item.addEventListener('click', () => insertIconOnCanvas(name, state));
    fragment.appendChild(item);
  }

  loadedCount = end;
  grid.appendChild(fragment);

  // "Load more" button if there are remaining icons
  if (loadedCount < filteredIcons.length) {
    const remaining = filteredIcons.length - loadedCount;
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'load-more-btn';
    loadMoreBtn.textContent = `Load ${Math.min(remaining, BATCH_SIZE)} more (${remaining} left)`;
    loadMoreBtn.addEventListener('click', () => appendBatch(state));
    grid.appendChild(loadMoreBtn);
  }

  updateCount();
}

function updateCount() {
  const countEl = document.getElementById('icon-count');
  if (countEl) {
    countEl.textContent = `${filteredIcons.length} icons`;
  }
}

function buildSvgString(iconName) {
  const iconData = icons[iconName];
  if (!iconData) return '';

  // Lucide structure: ["svg", {svgAttrs}, [[childTag, {childAttrs}], ...]]
  const childNodes = iconData[2];
  if (!childNodes || !Array.isArray(childNodes)) return '';

  let children = '';
  for (const node of childNodes) {
    const tag = node[0];
    const attrs = node[1] || {};
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    children += `<${tag} ${attrStr}/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

function insertIconOnCanvas(iconName, state) {
  // Build SVG with explicit stroke color (not "currentColor")
  const iconData = icons[iconName];
  if (!iconData) return;

  const childNodes = iconData[2];
  if (!childNodes || !Array.isArray(childNodes)) return;

  let children = '';
  for (const node of childNodes) {
    const tag = node[0];
    const attrs = node[1] || {};
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    children += `<${tag} ${attrStr}/>`;
  }

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${state.strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;

  const { fabric } = window;

  fabric.loadSVGFromString(svgString, (objects, options) => {
    const group = fabric.util.groupSVGElements(objects, options);

    // Place at visible area center
    const canvas = state.canvas;
    const vpt = canvas.viewportTransform;
    const centerX = (canvas.width / 2 - (vpt ? vpt[4] : 0)) / (vpt ? vpt[0] : 1);
    const centerY = (canvas.height / 2 - (vpt ? vpt[5] : 0)) / (vpt ? vpt[3] : 1);

    group.set({
      left: centerX - 30,
      top: centerY - 30,
      scaleX: 2.5,
      scaleY: 2.5,
      strokeUniform: true,
      objectCaching: false,
    });

    // Ensure all sub-paths inside the icon vector group render at 8K vector fidelity
    group.forEachObject((o) => {
      o.objectCaching = false;
      o.strokeUniform = true;
    });

    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();

    showToast(`Added "${formatIconName(iconName)}" icon`);
  });
}

function formatIconName(name) {
  // Convert kebab-case or camelCase to Title Case
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function showToast(message) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
