// Saves and restores document progress, pages,
// and all tool / style settings across page reloads

import { CUSTOM_FABRIC_PROPERTIES } from './canvas.js';

const STORAGE_SETTINGS_KEY = 'inkpad_user_settings';
const STORAGE_DOC_KEY = 'inkpad_saved_document';

let autoSaveTimer = null;

/**
 * Load user settings from localStorage and merge with default state
 */
export function loadSavedSettings(defaultState) {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return defaultState;
    const saved = JSON.parse(raw);
    return {
      ...defaultState,
      ...saved,
    };
  } catch (err) {
    console.warn('Could not load saved settings:', err);
    return defaultState;
  }
}

/**
 * Save current tool, style, and general settings to localStorage
 */
export function saveSettings(state) {
  try {
    const settings = {
      currentTool: state.currentTool,
      textColor: state.textColor,
      textOpacity: state.textOpacity,
      textBgColor: state.textBgColor,
      textBgOpacity: state.textBgOpacity,
      noTextBg: state.noTextBg,
      textSize: state.textSize,
      fontFamily: state.fontFamily,
      strokeColor: state.strokeColor,
      fillColor: state.fillColor,
      fillOpacity: state.fillOpacity,
      noFill: state.noFill,
      strokeWidth: state.strokeWidth,
      frameType: state.frameType,
      documentName: state.documentName,
    };
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Could not save settings:', err);
  }
}

/**
 * Load saved document (all pages, active page index, title)
 */
export function loadSavedDocument() {
  try {
    const raw = localStorage.getItem(STORAGE_DOC_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Could not load saved document:', err);
    return null;
  }
}

/**
 * Save document pages and current page index to localStorage
 */
export function saveDocument(state) {
  if (!state.canvas || !Array.isArray(state.pages)) return;
  try {
    // Ensure active page is up-to-date in pages array
    if (state.pages.length > 0 && state.currentPage >= 0) {
      state.pages[state.currentPage] = state.canvas.toJSON(CUSTOM_FABRIC_PROPERTIES);
    }

    const docData = {
      documentName: state.documentName || 'Untitled Document',
      currentPage: state.currentPage || 0,
      pages: state.pages,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_DOC_KEY, JSON.stringify(docData));
  } catch (err) {
    console.warn('Could not save document:', err);
  }
}

/**
 * Save everything (both settings and document)
 */
export function saveAll(state) {
  saveSettings(state);
  saveDocument(state);
}

/**
 * Debounced auto-save function to prevent rapid JSON serialization
 */
export function scheduleAutoSave(state, delay = 350) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveAll(state);
  }, delay);
}
