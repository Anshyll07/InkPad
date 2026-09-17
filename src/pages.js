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

  // Delete page button
  const deleteBtn = document.getElementById('delete-page');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      deletePage(state);
    });
  }
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

export async function deletePage(state, pageIndex) {
  const s = state || window.__inkpad_state;
  if (!s || !s.pages || s.pages.length <= 1) {
    return false;
  }

  const targetIndex = (typeof pageIndex === 'number') ? pageIndex : s.currentPage;
  if (targetIndex < 0 || targetIndex >= s.pages.length) return false;

  const canvas = s.canvas;
  const pageData = targetIndex === s.currentPage
    ? canvas.toJSON(CUSTOM_FABRIC_PROPERTIES)
    : s.pages[targetIndex];

  const hasContent = pageData && Array.isArray(pageData.objects) && pageData.objects.length > 0;
  if (hasContent) {
    const confirmed = window.confirm(`Delete Page ${targetIndex + 1}? This action cannot be undone.`);
    if (!confirmed) return false;
  }

  canvas.discardActiveObject();

  // If deleting another page, save current page content first
  if (targetIndex !== s.currentPage) {
    s.pages[s.currentPage] = canvas.toJSON(CUSTOM_FABRIC_PROPERTIES);
  }

  // Remove targeted page
  s.pages.splice(targetIndex, 1);

  // Compute new active page index
  let nextIndex = s.currentPage;
  if (targetIndex === s.currentPage) {
    nextIndex = Math.min(s.pages.length - 1, targetIndex);
  } else if (targetIndex < s.currentPage) {
    nextIndex = s.currentPage - 1;
  }

  s.currentPage = nextIndex;
  renderPageTabs(s);

  // Load new active page onto canvas
  const nextPageData = s.pages[nextIndex];
  try {
    if (nextPageData && nextPageData.objects && nextPageData.objects.length > 0) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          canvas.renderAll();
          resolve();
        }, 1200);

        try {
          canvas.loadFromJSON(nextPageData, () => {
            clearTimeout(timer);
            canvas.renderAll();
            resolve();
          });
        } catch {
          clearTimeout(timer);
          canvas.renderAll();
          resolve();
        }
      });
    } else {
      canvas.clear();
      canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
    }
  } catch (err) {
    console.warn('Error loading page after deletion:', err);
  }

  resetUndoStack();
  saveDocument(s);
  return true;
}

export function renderPageTabs(state) {
  const s = state || window.__inkpad_state;
  if (!s || !s.pages) return;
  const container = document.getElementById('page-tabs');
  if (!container) return;
  container.innerHTML = '';

  const deleteBtn = document.getElementById('delete-page');
  if (deleteBtn) {
    deleteBtn.disabled = s.pages.length <= 1;
    deleteBtn.title = s.pages.length <= 1
      ? 'Cannot delete the only page'
      : `Delete Page ${s.currentPage + 1}`;
  }

  s.pages.forEach((_, index) => {
    const tab = document.createElement('button');
    tab.className = `page-tab${index === s.currentPage ? ' active' : ''}`;
    tab.title = `Switch to Page ${index + 1}`;

    const label = document.createElement('span');
    label.textContent = `Page ${index + 1}`;
    tab.appendChild(label);

    if (s.pages.length > 1) {
      const closeBtn = document.createElement('span');
      closeBtn.className = 'page-tab-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.title = `Delete Page ${index + 1}`;
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePage(s, index);
      });
      tab.appendChild(closeBtn);
    }

    tab.addEventListener('click', () => switchPage(s, index));
    container.appendChild(tab);
  });
}

