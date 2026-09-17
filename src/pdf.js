// Exports all pages as an A4 PDF using jsPDF

import { saveCurrentPage } from './pages.js';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

export async function exportToPDF(state) {
  const { jsPDF } = window.jspdf;
  const canvas = state.canvas;

  if (!jsPDF) {
    alert('PDF library not loaded. Please check your internet connection.');
    return;
  }

  // Save the current page before export
  saveCurrentPage(state);

  // Create PDF document (A4 in pixels)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [A4_WIDTH, A4_HEIGHT],
    hotfixes: ['px_scaling'],
    compress: true,
  });

  const originalPage = state.currentPage;

  // Ensure fonts are loaded before rendering
  await document.fonts.ready;

  for (let i = 0; i < state.pages.length; i++) {
    if (i > 0) pdf.addPage();

    // Load the page onto the canvas if it's not already active
    if (i !== originalPage) {
      await loadPageOnCanvas(canvas, state.pages[i]);
    }

    // Small delay to ensure rendering is complete
    await new Promise((r) => setTimeout(r, 50));

    // Capture canvas at 2x resolution for crisp PDF output
    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, A4_WIDTH, A4_HEIGHT);
  }

  // Restore the original page
  if (state.currentPage !== originalPage) {
    await loadPageOnCanvas(canvas, state.pages[originalPage]);
  }

  // Set PDF metadata
  pdf.setProperties({
    title: state.documentName || 'Untitled Document',
    subject: 'Created with InkPad',
    creator: 'InkPad — Handwriting Document Editor',
  });

  // Download the PDF
  const filename = (state.documentName || 'Untitled Document')
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .trim();
  pdf.save(`${filename}.pdf`);
}

function loadPageOnCanvas(canvas, pageData) {
  return new Promise((resolve) => {
    if (pageData && pageData.objects && pageData.objects.length > 0) {
      canvas.loadFromJSON(pageData, () => {
        canvas.renderAll();
        resolve();
      });
    } else {
      canvas.clear();
      canvas.setBackgroundColor('#ffffff', () => {
        canvas.renderAll();
        resolve();
      });
    }
  });
}
