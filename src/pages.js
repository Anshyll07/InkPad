// Page creation, switching, and tab rendering

import { loadSavedDocument, saveDocument } from './storage.js';
import { CUSTOM_FABRIC_PROPERTIES, resetUndoStack } from './canvas.js';

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

export function addPage(state) {
  const s = state || window.__inkpad_state;
  if (!s || !s.canvas) return 0;
  const canvas = s.canvas;

  // Discard active selection
  canvas.discardActiveObject();

  // Save current page content
  s.pages[s.currentPage] = canvas.toJSON(CUSTOM_FABRIC_PROPERTIES);

  // Create a new blank page
  s.pages.push({ version: canvas.toJSON(CUSTOM_FABRIC_PROPERTIES).version, objects: [] });
  s.currentPage = s.pages.length - 1;

  // Clear the canvas for the new page
  canvas.clear();
  canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));

  resetUndoStack();
  renderPageTabs(s);
  saveDocument(s);
  return s.currentPage;
}

export async function switchPage(state, pageIndex) {
  const s = state || window.__inkpad_state;
  if (!s || !s.canvas) return;
  if (pageIndex === s.currentPage) return;
  if (pageIndex < 0 || pageIndex >= s.pages.length) return;

  const canvas = s.canvas;

  // Discard any active editing
  canvas.discardActiveObject();

  // Save current page state
  s.pages[s.currentPage] = canvas.toJSON(CUSTOM_FABRIC_PROPERTIES);

  // Switch to target page
  s.currentPage = pageIndex;
  renderPageTabs(s);

  const pageData = s.pages[pageIndex];

  try {
    if (pageData && pageData.objects && pageData.objects.length > 0) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          console.warn('loadFromJSON timed out, rendering canvas');
          canvas.renderAll();
          resolve();
        }, 1200);

        try {
          canvas.loadFromJSON(pageData, () => {
            clearTimeout(timer);
            canvas.renderAll();
            resolve();
          });
        } catch (loadErr) {
          clearTimeout(timer);
          console.warn('loadFromJSON error:', loadErr);
          canvas.renderAll();
          resolve();
        }
      });
    } else {
      canvas.clear();
      canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
    }
  } catch (switchErr) {
    console.warn('Error during page switch:', switchErr);
  }

  resetUndoStack();
  saveDocument(s);
}

export function saveCurrentPage(state) {
  const s = state || window.__inkpad_state;
  if (s && s.canvas && s.pages && s.pages.length > 0) {
    s.pages[s.currentPage] = s.canvas.toJSON(CUSTOM_FABRIC_PROPERTIES);
    saveDocument(s);
  }
}

export function renderPageTabs(state) {
  const s = state || window.__inkpad_state;
  if (!s || !s.pages) return;
  const container = document.getElementById('page-tabs');
  if (!container) return;
  container.innerHTML = '';

  s.pages.forEach((_, index) => {
    const tab = document.createElement('button');
    tab.className = `page-tab${index === s.currentPage ? ' active' : ''}`;
    tab.textContent = `Page ${index + 1}`;
    tab.addEventListener('click', () => switchPage(s, index));
    container.appendChild(tab);
  });
}

