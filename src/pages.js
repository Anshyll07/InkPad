// Page creation, switching, and tab rendering

import { loadSavedDocument, saveDocument } from './storage.js';
import { CUSTOM_FABRIC_PROPERTIES } from './canvas.js';

let pagesInitialized = false;

export function initPages(state) {
  if (pagesInitialized) return;
  pagesInitialized = true;

  const canvas = state.canvas;
  const savedDoc = loadSavedDocument();

  if (savedDoc && Array.isArray(savedDoc.pages) && savedDoc.pages.length > 0) {
    state.pages = savedDoc.pages;
    state.currentPage = Math.min(state.pages.length - 1, Math.max(0, savedDoc.currentPage || 0));
    if (savedDoc.documentName) {
      state.documentName = savedDoc.documentName;
      const nameInput = document.getElementById('doc-name');
      if (nameInput) nameInput.value = state.documentName;
      document.title = `${state.documentName} — InkPad`;
    }

    const activePage = state.pages[state.currentPage];
    if (activePage && activePage.objects && activePage.objects.length > 0) {
      canvas.loadFromJSON(activePage, () => {
        canvas.renderAll();
      });
    }
  } else {
    // Start with one page (save current blank canvas as page 0)
    state.pages = [canvas.toJSON(CUSTOM_FABRIC_PROPERTIES)];
    state.currentPage = 0;
  }

  renderPageTabs(state);

  // Add page button
  document.getElementById('add-page').addEventListener('click', () => {
    addPage(state);
  });
}

function addPage(state) {
  const canvas = state.canvas;

  // Save current page content
  state.pages[state.currentPage] = canvas.toJSON(CUSTOM_FABRIC_PROPERTIES);

  // Create a new blank page
  state.pages.push({ version: canvas.toJSON(CUSTOM_FABRIC_PROPERTIES).version, objects: [] });
  state.currentPage = state.pages.length - 1;

  // Clear the canvas for the new page
  canvas.clear();
  canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));

  renderPageTabs(state);
  saveDocument(state);
}

export function switchPage(state, pageIndex) {
  if (pageIndex === state.currentPage) return;
  if (pageIndex < 0 || pageIndex >= state.pages.length) return;

  const canvas = state.canvas;

  // Discard any active editing
  canvas.discardActiveObject();

  // Save current page state
  state.pages[state.currentPage] = canvas.toJSON(CUSTOM_FABRIC_PROPERTIES);

  // Switch to target page
  state.currentPage = pageIndex;

  const pageData = state.pages[pageIndex];

  if (pageData && pageData.objects && pageData.objects.length > 0) {
    canvas.loadFromJSON(pageData, () => {
      canvas.renderAll();
    });
  } else {
    canvas.clear();
    canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
  }

  renderPageTabs(state);
  saveDocument(state);
}

export function saveCurrentPage(state) {
  if (state.canvas && state.pages && state.pages.length > 0) {
    state.pages[state.currentPage] = state.canvas.toJSON(CUSTOM_FABRIC_PROPERTIES);
    saveDocument(state);
  }
}

function renderPageTabs(state) {
  const container = document.getElementById('page-tabs');
  container.innerHTML = '';

  state.pages.forEach((_, index) => {
    const tab = document.createElement('button');
    tab.className = `page-tab${index === state.currentPage ? ' active' : ''}`;
    tab.textContent = `Page ${index + 1}`;
    tab.addEventListener('click', () => switchPage(state, index));
    container.appendChild(tab);
  });
}
