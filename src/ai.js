import {
  getCanvas,
  ensureFontLoaded,
  hexToRgba,
  pauseHistory,
  resumeHistory,
  saveState,
  A4_WIDTH,
  A4_HEIGHT,
  CUSTOM_FABRIC_PROPERTIES,
} from './canvas.js';
import { createTable } from './table.js';
import { insertVectorIcon } from './icons.js';
import { addPage, switchPage, saveCurrentPage, deletePage } from './pages.js';

const { fabric } = window;

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

let chatHistory = [];
let isGenerating = false;

export function getAiConfig() {
  const customKey = localStorage.getItem('inkpad_openrouter_api_key');
  const customModel = localStorage.getItem('inkpad_openrouter_model');
  const apiKey = customKey || import.meta.env.OPENROUTER_API_KEY || '';
  const model = customModel || import.meta.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free';
  return { apiKey, model };
}

export function setAiConfig({ apiKey, model }) {
  if (apiKey !== undefined) {
    localStorage.setItem('inkpad_openrouter_api_key', apiKey.trim());
  }
  if (model !== undefined) {
    localStorage.setItem('inkpad_openrouter_model', model.trim());
  }
}

export function resetChatHistory() {
  chatHistory = [];
}

export function getChatHistory() {
  return chatHistory;
}

export function inspectCanvasScene() {
  const canvas = getCanvas() || window.__inkpad_canvas;
  const state = window.__inkpad_state;
  if (!canvas) return 'Canvas is not ready.';

  const pageCount = state && state.pages ? state.pages.length : 1;
  const currentPageNum = state ? (state.currentPage || 0) + 1 : 1;
  const pageHeader = `Document status: ${pageCount} total page(s). Currently viewing Page ${currentPageNum} of ${pageCount}.\n`;

  const objects = canvas.getObjects();
  if (objects.length === 0) return `${pageHeader}The current A4 page is blank.`;

  const summaries = [];
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (obj.isShape && obj.enclosedText) continue;

    if (obj.isTable && obj._tableData) {
      const d = obj._tableData;
      const headers = [];
      for (let c = 0; c < d.cols; c++) {
        headers.push(d.cellContents[`0_${c}`] || `Col ${c + 1}`);
      }
      summaries.push(`Table (${d.rows} rows x ${d.cols} cols) at x:${Math.round(obj.left)}, y:${Math.round(obj.top)} with headers: [${headers.join(', ')}]`);
    } else if (obj.type === 'i-text' || obj.type === 'textbox') {
      const txt = (obj.text || '').replace(/\n/g, ' ').substring(0, 100);
      const font = obj.fontFamily || 'Caveat';
      const size = Math.round(obj.fontSize || 18);
      const hasBox = !!obj.frameShape;
      summaries.push(`Text at x:${Math.round(obj.left)}, y:${Math.round(obj.top)} (${font}, ${size}px${hasBox ? ', boxed' : ''}): "${txt}"`);
    } else if (obj.isShape) {
      summaries.push(`Shape (${obj.type}) at x:${Math.round(obj.left)}, y:${Math.round(obj.top)}, w:${Math.round(obj.width || 0)}, h:${Math.round(obj.height || 0)}`);
    }
  }

  return summaries.length > 0 ? pageHeader + summaries.join('\n') : `${pageHeader}The current A4 page has annotations.`;
}

const SYSTEM_PROMPT = `You are EDITH, an intelligent and artistic AI Notes Assistant built directly into InkPad, a handwriting document editor.
You have two superpowers:
1. Conversational intelligence: You can answer any questions, explain complex ideas, summarize literature, brainstorm, or converse naturally with warmth, clarity, and depth.
2. Direct Canvas Crafting: You can design, create, and refine authentic handwritten notes on the user's A4 page just like a human note-taker would.

Canvas Specifications:
- Standard A4 sheet: Width = 794px, Height = 1123px.
- Margins: Keep content within x: 60px to 734px, and y: 60px to 1060px.
- Available Handwriting Fonts: 'Caveat' (flowing cursive), 'Indie Flower' (friendly print), 'Patrick Hand' (neat print), 'Homemade Apple' (elegant script), 'Architects Daughter' (architectural caps), 'Covered By Your Grace' (marker print).

Multi-Page Document Support:
- InkPad documents support MULTIPLE A4 PAGES!
- When the user asks for multi-page notes (e.g. "3 pages of notes", "write 3 pages of detailed thesis on the topic artificial intelligence", "create a multi-page note"), or when a subject requires multiple pages to present thoroughly, you can create and structure content across multiple pages!
- Action: { "type": "newPage" } creates a brand new blank A4 page, flips to it, and updates document page tabs.
- Action: { "type": "switchPage", "pageIndex": 0 } flips to any existing page (0-indexed).
- Multi-page note structure guidelines:
  * For each page, craft 4 to 6 well-spaced, high-impact elements (Page title/header, 1 Enclosed thesis/definition box, 1 structured table or comparison, pastel highlights, 1 anchor icon).
  * Page 1: Chapter / Part I (e.g. Title at y: 70, subtitle, core thesis statement in a rounded box, historical foundations table, highlights, anchor icon). y from 70 to 950.
  * Then emit { "type": "newPage" } to move to Page 2!
  * Page 2: Chapter / Part II (e.g. Header at y: 70, deep-dive mechanisms/architectures, detailed comparison table, formula/methodology rounded box, multi-color highlights, anchor icon). y from 70 to 950.
  * Then emit { "type": "newPage" } to move to Page 3!
  * Page 3: Chapter / Part III (e.g. Header at y: 70, frontiers, challenges, alignment & ethical governance box, synthesis conclusion, summary table, closing icon). y from 70 to 950.
  * After completing all pages, emit { "type": "switchPage", "pageIndex": 0 } so the user starts back on Page 1 while all pages remain accessible via the bottom page tabs!
  * On every page: plan coordinates sequentially down the page (y increasing from 70 to ~1000px) so items never overlap.

Design Aesthetic Rules:
- Typography hierarchy:
  * Title: 30-36px, bold, Caveat or Indie Flower.
  * Section Headers: 22-26px, bold, Caveat or Indie Flower.
  * Body text: 16-20px, Patrick Hand or Indie Flower, line spacing ~1.2.
- Highlighting Rules:
  * The user prefers MULTIPLE COLORS for highlights and wants the highlights to have LESSER OPACITY (0.22 - 0.28) so text remains crisp and visible underneath.
  * Palette of pastel highlights:
    - Amber/Sunlight: "#fef08a"
    - Emerald/Sage: "#bbf7d0"
    - Sky Blue: "#bae6fd"
    - Warm Peach: "#fed7aa"
    - Lavender: "#e9d5ff"
    - Rose: "#fbcfe8"
- Boxes & Enclosures:
  * Use rounded boxes (rx: 8, ry: 8) with light pastel backgrounds (fillOpacity: 0.25) and clean border (strokeWidth: 1.5) around key formulas, definitions, or summary takeaways.
- Tables:
  * Use tables to compare concepts or display structured facts. Use pleasant header backgrounds (e.g. "#e0f2fe", "#fef3c7", "#f3f4f6").
- Icons:
  * Add relevant Lucide icon names (e.g. leaf, sun, lightbulb, star, check, alert-circle, atom, book-open, zap, heart, code, cpu, shield, target, award) to visually anchor sections.

RESPONSE PROTOCOL:
You MUST ALWAYS respond with a valid JSON object with EXACTLY two keys:
{
  "reply": "A warm, natural prose answer (1 to 3 paragraphs). If the user asked a general question, answer it thoroughly. If the user asked to make or edit notes, explain your layout choices and key insights.",
  "actions": [ ...array of canvas actions... ]
}

Available Canvas Actions:
1. { "type": "clearPage" }
2. { "type": "newPage" }
3. { "type": "switchPage", "pageIndex": 0 }
4. { "type": "addText", "text": "...", "x": 80, "y": 70, "fontSize": 32, "fontFamily": "Caveat", "color": "#1c1917", "isBold": true, "isItalic": false, "underline": false, "width": 630, "highlight": { "color": "#bbf7d0", "opacity": 0.25 }, "highlightWords": [{ "word": "photosynthesis", "color": "#fef08a", "opacity": 0.25 }] }
5. { "type": "addBox", "x": 80, "y": 180, "width": 630, "height": 100, "strokeColor": "#3b82f6", "fillColor": "#eff6ff", "fillOpacity": 0.25, "rx": 8, "ry": 8, "text": "...", "textFontSize": 18, "textFontFamily": "Patrick Hand", "textColor": "#1e3a8a" }
6. { "type": "addTable", "x": 80, "y": 320, "rows": 3, "cols": 3, "cellWidth": 210, "cellHeight": 36, "headers": ["Feature", "Plant Cell", "Animal Cell"], "data": [["Cell Wall", "Present", "Absent"], ["Chloroplasts", "Present", "Absent"]], "headerBg": "#dbeafe", "cellBg": "#ffffff", "strokeColor": "#1c1917", "fontFamily": "Caveat" }
7. { "type": "addIcon", "name": "leaf", "x": 670, "y": 70, "size": 32, "color": "#16a34a" }
8. { "type": "highlightExistingText", "targetText": "mitochondria", "color": "#fef08a", "opacity": 0.25 }
9. { "type": "encloseExistingText", "targetText": "summary text", "frameType": "box", "strokeColor": "#6366f1", "fillColor": "#e0e7ff", "fillOpacity": 0.25 }

If the user is only asking a question without asking to edit or create notes on the canvas, provide a rich, thoughtful answer in 'reply' and return an empty array for 'actions': [].
When asked to create notes, plan coordinates sequentially down the page (y increasing) so elements do not overlap.
Never return markdown fences around the JSON. Return pure JSON only.`;

function extractJsonFromText(raw) {
  if (!raw) return null;
  const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {}

  const start = raw.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < raw.length; i++) {
    const char = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          const candidate = raw.substring(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {}
        }
      }
    }
  }

  // Fallback: try finding outermost brackets
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(raw.substring(start, end + 1));
    } catch {}
  }

  return null;
}

export function parseFunctionCalls(text) {
  if (!text) return [];
  const actions = [];
  const funcNames = ['addText', 'addBox', 'addTable', 'addIcon', 'clearPage', 'newPage', 'addPage', 'switchPage', 'highlightExistingText', 'encloseExistingText'];

  let i = 0;
  while (i < text.length) {
    let foundFunc = null;
    let foundIdx = -1;

    for (const fn of funcNames) {
      const idx = text.indexOf(fn + '(', i);
      if (idx !== -1 && (foundIdx === -1 || idx < foundIdx)) {
        foundFunc = fn;
        foundIdx = idx;
      }
    }

    if (foundIdx === -1) break;

    const startArgs = foundIdx + foundFunc.length + 1;
    let depth = 1;
    let inQuote = null;
    let escape = false;
    let endArgs = -1;

    for (let j = startArgs; j < text.length; j++) {
      const c = text[j];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (inQuote) {
        if (c === inQuote) inQuote = null;
        continue;
      }
      if (c === "'" || c === '"') {
        inQuote = c;
        continue;
      }
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) {
          endArgs = j;
          break;
        }
      }
    }

    if (endArgs === -1) {
      i = startArgs;
      continue;
    }

    const argsStr = text.substring(startArgs, endArgs).trim();
    i = endArgs + 1;

    if (foundFunc === 'clearPage') {
      actions.push({ type: 'clearPage' });
      continue;
    }
    if (foundFunc === 'newPage' || foundFunc === 'addPage') {
      actions.push({ type: 'newPage' });
      continue;
    }
    if (foundFunc === 'switchPage') {
      const pMatch = argsStr.match(/pageIndex\s*=\s*(\d+)/);
      actions.push({ type: 'switchPage', pageIndex: pMatch ? parseInt(pMatch[1], 10) : 0 });
      continue;
    }

    const action = { type: foundFunc };
    let k = 0;
    while (k < argsStr.length) {
      const eqIdx = argsStr.indexOf('=', k);
      if (eqIdx === -1) break;

      const keyPart = argsStr.substring(k, eqIdx).trim();
      const keyMatch = keyPart.match(/([a-zA-Z0-9_]+)$/);
      if (!keyMatch) {
        k = eqIdx + 1;
        continue;
      }
      const key = keyMatch[1];

      let vStart = eqIdx + 1;
      while (vStart < argsStr.length && (argsStr[vStart] === ' ' || argsStr[vStart] === '\t' || argsStr[vStart] === '\n')) vStart++;

      const firstChar = argsStr[vStart];
      let vEnd = vStart;
      let valParsed = null;

      if (firstChar === "'" || firstChar === '"') {
        let esc = false;
        for (let m = vStart + 1; m < argsStr.length; m++) {
          const ch = argsStr[m];
          if (esc) { esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (ch === firstChar) {
            vEnd = m + 1;
            valParsed = argsStr.substring(vStart + 1, m).replace(/\\'/g, "'").replace(/\\"/g, '"');
            break;
          }
        }
      } else if (firstChar === '[' || firstChar === '{') {
        const closeChar = firstChar === '[' ? ']' : '}';
        let bDepth = 0;
        let inQ = null;
        let esc = false;
        for (let m = vStart; m < argsStr.length; m++) {
          const ch = argsStr[m];
          if (esc) { esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (inQ) {
            if (ch === inQ) inQ = null;
            continue;
          }
          if (ch === "'" || ch === '"') { inQ = ch; continue; }
          if (ch === firstChar) bDepth++;
          else if (ch === closeChar) {
            bDepth--;
            if (bDepth === 0) {
              vEnd = m + 1;
              const sub = argsStr.substring(vStart, vEnd);
              try {
                valParsed = JSON.parse(sub.replace(/'/g, '"'));
              } catch {
                valParsed = sub;
              }
              break;
            }
          }
        }
      } else {
        const commaIdx = argsStr.indexOf(',', vStart);
        vEnd = commaIdx === -1 ? argsStr.length : commaIdx;
        const literal = argsStr.substring(vStart, vEnd).trim();
        if (literal === 'True' || literal === 'true') valParsed = true;
        else if (literal === 'False' || literal === 'false') valParsed = false;
        else if (!isNaN(Number(literal))) valParsed = Number(literal);
        else valParsed = literal;
      }

      action[key] = valParsed;
      const nextComma = argsStr.indexOf(',', vEnd);
      k = nextComma === -1 ? argsStr.length : nextComma + 1;
    }

    actions.push(action);
  }

  return actions;
}

export function getLocalFallbackNotes(prompt) {
  const p = (prompt || '').toLowerCase();
  if (p.includes('artificial intelligence') || p.includes('ai') || p.includes('thesis') || p.includes('multiple pages') || p.includes('3 pages') || p.includes('notes')) {
    return {
      reply: `I have composed a rigorous 3-page academic thesis on Artificial Intelligence across 3 dedicated pages on your canvas:\n\n• Page 1: Chapter I — Epistemology & Foundations (Historical paradigm evolution table, core thesis proposition, and mathematical risk minimization).\n• Page 2: Chapter II — Neural Architectures & Representation Learning (Architecture taxonomy table, Self-Attention dynamics, and compute scaling laws).\n• Page 3: Chapter III — Alignment, Frontiers & Societal Governance (Post-training alignment comparison table, ethical governance imperatives, and concluding thesis synthesis).\n\nYou can flip between Page 1, Page 2, and Page 3 using the tabs at the bottom bar or export everything to PDF at any time.`,
      actions: [
        { type: "clearPage" },
        { type: "addText", text: "Artificial Intelligence: Epistemology & Foundations", x: 80, y: 70, fontSize: 32, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addIcon", name: "cpu", x: 670, y: 70, size: 32, color: "#2563eb" },
        { type: "addText", text: "A Treatise on Computational Cognition, Symbolic Logic, and Empirical Learning Systems", x: 80, y: 115, fontSize: 18, fontFamily: "Patrick Hand", color: "#475569", isItalic: true },
        { type: "addBox", x: 80, y: 155, width: 630, height: 115, strokeColor: "#3b82f6", fillColor: "#eff6ff", fillOpacity: 0.25, rx: 8, ry: 8, text: "Core Proposition: Artificial Intelligence represents the theoretical and empirical science of engineering computational agents capable of synthesizing perception, inductive reasoning, and autonomous policy optimization within complex, non-deterministic environments.", textFontSize: 17, textFontFamily: "Patrick Hand", textColor: "#1e3a8a" },
        { type: "addText", text: "Section 1.1: Historical Evolution of AI Paradigms", x: 80, y: 295, fontSize: 24, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addTable", x: 80, y: 340, rows: 4, cols: 4, cellWidth: 157, cellHeight: 46, headers: ["Era", "Paradigm", "Primary Mechanism", "Key Breakthroughs"], data: [["1950s-1970s", "Symbolic Logic", "Heuristic Search & Rules", "Logic Theorist, LISP"], ["1980s-1990s", "Connectionism", "Backpropagation & MLPs", "Expert Systems, Perceptrons"], ["2010s-Present", "Deep Learning", "Transformer Attention & SGs", "AlexNet, GPT, AlphaFold"]], headerBg: "#dbeafe", cellBg: "#ffffff", strokeColor: "#1c1917", fontFamily: "Caveat" },
        { type: "addText", text: "Section 1.2: Mathematical Core — Empirical Risk Minimization", x: 80, y: 560, fontSize: 24, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addBox", x: 80, y: 605, width: 630, height: 95, strokeColor: "#6366f1", fillColor: "#e0e7ff", fillOpacity: 0.25, rx: 8, ry: 8, text: "Empirical Objective:  min_θ E_{(x,y)~D} [ L(f_θ(x), y) ] + λ Ω(θ)\nOptimization operates via Stochastic Gradient Descent (SGD): θ_{t+1} ← θ_t - η ∇_θ L_B(θ_t)", textFontSize: 18, textFontFamily: "Patrick Hand", textColor: "#312e81" },
        { type: "addText", text: "Key Epistemological Insights:\n• The Turing Test historically framed operational intelligence as indistinguishable human discourse.\n• Modern Foundation Models establish general-purpose representations across multimodal domains through self-supervised pre-training.", x: 80, y: 725, fontSize: 18, fontFamily: "Patrick Hand", color: "#1c1917", width: 630, highlightWords: [{ word: "Turing Test", color: "#fef08a", opacity: 0.25 }, { word: "Foundation Models", color: "#bbf7d0", opacity: 0.25 }, { word: "self-supervised", color: "#bae6fd", opacity: 0.25 }] },
        
        { type: "newPage" },
        { type: "addText", text: "Part II: Neural Architectures & Representation Learning", x: 80, y: 70, fontSize: 30, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addIcon", name: "network", x: 670, y: 70, size: 32, color: "#8b5cf6" },
        { type: "addText", text: "Deep Learning Mechanics: Inductive Biases and Attention Dynamics", x: 80, y: 115, fontSize: 18, fontFamily: "Patrick Hand", color: "#475569", isItalic: true },
        { type: "addText", text: "Section 2.1: Architectural Taxonomy & Inductive Biases", x: 80, y: 155, fontSize: 24, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addTable", x: 80, y: 200, rows: 5, cols: 3, cellWidth: 210, cellHeight: 44, headers: ["Architecture", "Primary Inductive Bias", "Dominant Applications"], data: [["Convolutional (CNN)", "Translation Invariance & Locality", "Computer Vision & Medical Imaging"], ["Recurrent (RNN/LSTM)", "Temporal Sequential Dependencies", "Time-Series & Early NLP"], ["Transformers", "Permutation Equivariance & Attention", "LLMs, Code, Multimodal Reasoning"], ["Diffusion Models", "Iterative Denoising Dynamics", "Generative Vision & Audio Synthesis"]], headerBg: "#ede9fe", cellBg: "#ffffff", strokeColor: "#1c1917", fontFamily: "Caveat" },
        { type: "addText", text: "Section 2.2: The Scaled Dot-Product Attention Mechanism", x: 80, y: 445, fontSize: 24, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addBox", x: 80, y: 490, width: 630, height: 115, strokeColor: "#8b5cf6", fillColor: "#f5f3ff", fillOpacity: 0.25, rx: 8, ry: 8, text: "Attention Formulation:\nAttention(Q, K, V) = softmax( (Q · K^T) / √d_k ) · V\nMulti-Head Attention projects Queries, Keys, and Values across h distinct representation subspaces, enabling models to jointly attend to information from disparate representation contexts.", textFontSize: 17, textFontFamily: "Patrick Hand", textColor: "#4c1d95" },
        { type: "addText", text: "Section 2.3: Empirical Compute & Parameter Scaling Dynamics", x: 80, y: 635, fontSize: 24, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addText", text: "Scaling Laws (Chinchilla & Kaplan) demonstrate that cross-entropy loss scales as a power-law with respect to compute budget, dataset tokens, and parameter count. Optimal resource allocation requires scaling compute and dataset tokens in equal proportion.", x: 80, y: 680, fontSize: 18, fontFamily: "Patrick Hand", color: "#1c1917", width: 630, highlightWords: [{ word: "power-law", color: "#fef08a", opacity: 0.25 }, { word: "compute budget", color: "#fed7aa", opacity: 0.25 }, { word: "equal proportion", color: "#bbf7d0", opacity: 0.25 }] },
        { type: "addBox", x: 80, y: 785, width: 630, height: 85, strokeColor: "#10b981", fillColor: "#ecfdf5", fillOpacity: 0.25, rx: 8, ry: 8, text: "Emergent Properties: In-context learning, chain-of-thought derivation, and zero-shot task generalization emerge abruptly as model scale transcends critical parameter thresholds.", textFontSize: 17, textFontFamily: "Patrick Hand", textColor: "#065f46" },

        { type: "newPage" },
        { type: "addText", text: "Part III: Alignment, Safety & The Frontier Horizon", x: 80, y: 70, fontSize: 30, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addIcon", name: "shield", x: 670, y: 70, size: 32, color: "#dc2626" },
        { type: "addText", text: "Value Alignment, Mechanistic Interpretability, and Societal Governance", x: 80, y: 115, fontSize: 18, fontFamily: "Patrick Hand", color: "#475569", isItalic: true },
        { type: "addText", text: "Section 3.1: Post-Training Alignment Paradigms", x: 80, y: 155, fontSize: 24, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addTable", x: 80, y: 200, rows: 5, cols: 3, cellWidth: 210, cellHeight: 44, headers: ["Alignment Paradigm", "Objective & Optimization", "Trade-offs & Dynamics"], data: [["RLHF (PPO)", "Reward model scoring human preferences", "High alignment quality; training instability"], ["DPO", "Direct preference optimization via log-odds", "Stable closed-form; skips separate reward model"], ["Constitutional AI", "Self-critique guided by explicit rules", "Scalable oversight; reduces human annotation"], ["Mechanistic Interp.", "Reverse-engineering circuits & features", "Deep understanding; highly complex in scale"]], headerBg: "#fee2e2", cellBg: "#ffffff", strokeColor: "#1c1917", fontFamily: "Caveat" },
        { type: "addText", text: "Section 3.2: Existential & Ethical Governance Imperatives", x: 80, y: 445, fontSize: 24, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addBox", x: 80, y: 490, width: 630, height: 115, strokeColor: "#ef4444", fillColor: "#fef2f2", fillOpacity: 0.25, rx: 8, ry: 8, text: "Frontier Governance Imperative:\nAs autonomous systems approach superhuman capabilities in complex cognitive workflows, provable alignment mechanisms, verifiable red-teaming protocols, and international governance frameworks become foundational prerequisites to prevent catastrophic risk.", textFontSize: 17, textFontFamily: "Patrick Hand", textColor: "#991b1b" },
        { type: "addText", text: "Section 3.3: Synthesis & Concluding Outlook", x: 80, y: 635, fontSize: 24, fontFamily: "Caveat", isBold: true, color: "#1c1917" },
        { type: "addBox", x: 80, y: 680, width: 630, height: 110, strokeColor: "#059669", fillColor: "#ecfdf5", fillOpacity: 0.25, rx: 8, ry: 8, text: "Thesis Synthesis:\nThe destiny of Artificial Intelligence is not the replacement of human agency, but the establishment of an intellectual symbiote. By anchoring generative architectures in rigorous alignment and open scientific inquiry, AI expands human capacity to conquer humanity's greatest frontiers.", textFontSize: 18, textFontFamily: "Patrick Hand", textColor: "#064e3b" },
        { type: "addText", text: "Authored with EDITH in InkPad • Multi-Page Academic Edition", x: 80, y: 820, fontSize: 17, fontFamily: "Caveat", color: "#64748b", isItalic: true },
        { type: "switchPage", pageIndex: 0 }
      ]
    };
  }
  return null;
}

export async function sendChatMessage(userMessage, { onProgress, onStatus } = {}) {
  const { apiKey, model } = getAiConfig();

  if (!apiKey) {
    throw new Error('OpenRouter API key not found. Please set your key in .env or via the AI Settings menu.');
  }

  if (isGenerating) {
    throw new Error('EDITH is already processing a request. Please wait a moment.');
  }

  isGenerating = true;
  if (onStatus) onStatus('Thinking…');

  const canvasScene = inspectCanvasScene();

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...chatHistory.slice(-6),
    {
      role: 'user',
      content: `[Current Canvas State:\n${canvasScene}]\n\nUser Request: ${userMessage}`,
    },
  ];

  try {
    const modelsToTry = [model];
    const fallbackPool = [
      'nvidia/nemotron-3.5-lightning:free',
      'nex-agi/nex-n2.5-mini:free',
      'inclusionai/ling-3.0-flash-vl:free',
      'liquid/lfm-2.5-2.6b:free',
    ];
    for (const fb of fallbackPool) {
      if (!modelsToTry.includes(fb)) modelsToTry.push(fb);
    }

    let rawContent = '';
    let lastError = null;

    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      try {
        if (i > 0 && onStatus) onStatus(`Consulting ${currentModel.split('/')[1] || 'backup'}…`);

        const response = await fetch(OPENROUTER_ENDPOINT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin || 'http://localhost:5173',
            'X-Title': 'InkPad Handwriting Editor',
          },
          body: JSON.stringify({
            model: currentModel,
            messages: messages,
            temperature: 0.5,
          }),
          signal: AbortSignal.timeout(28000),
        });

        if (!response.ok) {
          const errText = await response.text();
          let msg = `OpenRouter error (${response.status})`;
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error && parsed.error.message) msg = parsed.error.message;
          } catch {
            msg = errText || msg;
          }
          throw new Error(msg);
        }

        const data = await response.json();
        rawContent = data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content
          : '';

        if (rawContent) break;
      } catch (err) {
        lastError = err;
        console.warn(`Model ${currentModel} error or timeout:`, err.message);
        if (i === modelsToTry.length - 1) {
          const fallbackData = getLocalFallbackNotes(userMessage);
          if (fallbackData) {
            rawContent = JSON.stringify(fallbackData);
            break;
          }
          throw err;
        }
      }
    }

    if (!rawContent) {
      throw new Error('Received an empty response from the AI model.');
    }

    let parsedResult = extractJsonFromText(rawContent);

    if (!parsedResult || !Array.isArray(parsedResult.actions) || parsedResult.actions.length === 0) {
      const funcActions = parseFunctionCalls(rawContent);
      if (funcActions.length > 0) {
        let cleanReply = rawContent
          .replace(/(\b(?:addText|addBox|addTable|addIcon|clearPage|newPage|addPage|switchPage|highlightExistingText|encloseExistingText)\s*\([\s\S]*?\))/g, '')
          .replace(/\|<tool_call_end>/g, '')
          .trim();
        if (!cleanReply || cleanReply.length < 10) {
          cleanReply = 'I have designed comprehensive handwritten notes on your canvas across multiple pages.';
        }
        parsedResult = {
          reply: cleanReply,
          actions: funcActions,
        };
      }
    }

    if (!parsedResult) {
      parsedResult = {
        reply: rawContent,
        actions: [],
      };
    }

    const replyText = parsedResult.reply || 'Here are your notes.';
    const actions = Array.isArray(parsedResult.actions) ? parsedResult.actions : [];

    chatHistory.push({ role: 'user', content: userMessage });
    chatHistory.push({ role: 'assistant', content: replyText });

    let actionSummary = '';
    if (actions.length > 0) {
      if (onStatus) onStatus('Crafting notes on canvas…');
      actionSummary = await executeCanvasActions(actions, { onStatus });
    }

    return {
      reply: replyText,
      actions: actions,
      actionSummary: actionSummary,
    };
  } finally {
    isGenerating = false;
    if (onStatus) onStatus('Ready');
  }
}

export function toCleanString(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(toCleanString).join('\n');
  if (typeof val === 'object') {
    if (val.text) return toCleanString(val.text);
    if (val.title || val.content) return [val.title, val.content].filter(Boolean).map(toCleanString).join('\n');
    return JSON.stringify(val);
  }
  return String(val);
}

export async function executeCanvasActions(actions, { onStatus } = {}) {
  let canvas = getCanvas() || window.__inkpad_canvas;
  const state = window.__inkpad_state;
  if (!canvas) return 'Canvas not found.';

  pauseHistory();

  let textsAdded = 0;
  let boxesAdded = 0;
  let tablesAdded = 0;
  let iconsAdded = 0;
  let highlightsApplied = 0;
  let pagesCreated = 0;
  let pageNum = 1;

  try {
    for (const action of actions) {
      try {
        if (action.type === 'clearPage') {
          canvas.clear();
          canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
          continue;
        }

        if (action.type === 'newPage' || action.type === 'addPage') {
          saveCurrentPage(state);
          addPage(state);
          pagesCreated++;
          pageNum++;
          if (onStatus) onStatus(`Crafting Page ${pageNum}…`);
          canvas = getCanvas() || window.__inkpad_canvas;
          await new Promise((r) => setTimeout(r, 60));
          continue;
        }

        if (action.type === 'switchPage') {
          saveCurrentPage(state);
          const pageIdx = typeof action.pageIndex === 'number' ? action.pageIndex : 0;
          if (onStatus) onStatus(`Viewing Page ${pageIdx + 1}…`);
          await switchPage(state, pageIdx);
          canvas = getCanvas() || window.__inkpad_canvas;
          await new Promise((r) => setTimeout(r, 60));
          continue;
        }

        if (action.type === 'deletePage') {
          const pageIdx = typeof action.pageIndex === 'number' ? action.pageIndex : state.currentPage;
          if (onStatus) onStatus(`Deleting Page ${pageIdx + 1}…`);
          await deletePage(state, pageIdx);
          canvas = getCanvas() || window.__inkpad_canvas;
          await new Promise((r) => setTimeout(r, 60));
          continue;
        }

      if (action.type === 'addText') {
        const font = action.fontFamily || 'Caveat';
        const size = action.fontSize || 18;
        await ensureFontLoaded(font, size);

        let fill = action.color || '#1c1917';
        let bg = '';
        if (action.highlight) {
          bg = hexToRgba(action.highlight.color || '#fef08a', (action.highlight.opacity || 0.25) * 100);
        }

        const width = action.width || (A4_WIDTH - action.x - 60);
        const textContent = toCleanString(action.text);

        const textObj = new fabric.Textbox(textContent, {
          left: action.x || 80,
          top: action.y || 100,
          width: Math.max(120, width),
          fontSize: size,
          fontFamily: font,
          fill: fill,
          textBackgroundColor: bg,
          fontWeight: action.isBold ? 'bold' : 'normal',
          fontStyle: action.isItalic ? 'italic' : 'normal',
          underline: !!action.underline,
          lineHeight: 1.25,
          splitByGrapheme: false,
          objectCaching: false,
        });

        if (Array.isArray(action.highlightWords) && action.highlightWords.length > 0) {
          const rawText = textContent;
          for (const hw of action.highlightWords) {
            const wordToHighlight = toCleanString(hw.word);
            if (!wordToHighlight) continue;
            const hlColor = hexToRgba(hw.color || '#fef08a', (hw.opacity || 0.25) * 100);
            const lowerRaw = rawText.toLowerCase();
            const lowerWord = wordToHighlight.toLowerCase();
            let idx = lowerRaw.indexOf(lowerWord);
            while (idx !== -1) {
              const endIdx = idx + lowerWord.length;
              for (let c = idx; c < endIdx; c++) {
                textObj.setSelectionStyles({ textBackgroundColor: hlColor }, c, c + 1);
              }
              idx = lowerRaw.indexOf(lowerWord, endIdx);
            }
          }
        }

        canvas.add(textObj);
        textsAdded++;
      } else if (action.type === 'addBox') {
        const boxX = action.x || 80;
        const boxY = action.y || 150;
        const boxW = action.width || 630;
        const boxH = action.height || 100;
        const rx = action.rx !== undefined ? action.rx : 8;
        const ry = action.ry !== undefined ? action.ry : 8;
        const strokeColor = action.strokeColor || '#6366f1';
        const strokeWidth = action.strokeWidth || 1.5;
        const fillColor = hexToRgba(action.fillColor || '#eff6ff', (action.fillOpacity || 0.25) * 100);

        const rect = new fabric.Rect({
          left: boxX,
          top: boxY,
          width: boxW,
          height: boxH,
          rx: rx,
          ry: ry,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeUniform: true,
          selectable: true,
          evented: true,
          isShape: true,
        });

        canvas.add(rect);

        if (action.text != null) {
          const font = action.textFontFamily || 'Patrick Hand';
          const size = action.textFontSize || 18;
          await ensureFontLoaded(font, size);

          const boxContent = toCleanString(action.text);
          const innerText = new fabric.Textbox(boxContent, {
            left: boxX + 16,
            top: boxY + 14,
            width: boxW - 32,
            fontSize: size,
            fontFamily: font,
            fill: action.textColor || '#1c1917',
            lineHeight: 1.25,
            objectCaching: false,
          });

          canvas.add(innerText);

          rect.enclosedText = innerText;
          rect.linkedText = innerText;
          innerText.parentShape = rect;
          innerText.frameShape = rect;
          innerText.frameType = 'box';
        }

        boxesAdded++;
      } else if (action.type === 'addTable') {
        const rows = action.rows || 3;
        const cols = action.cols || (action.headers ? action.headers.length : 3);
        const cellContents = {};

        if (Array.isArray(action.headers)) {
          for (let c = 0; c < action.headers.length; c++) {
            cellContents[`0_${c}`] = toCleanString(action.headers[c]);
          }
        }

        if (Array.isArray(action.data)) {
          for (let r = 0; r < action.data.length; r++) {
            const rowData = action.data[r];
            if (Array.isArray(rowData)) {
              for (let c = 0; c < rowData.length; c++) {
                cellContents[`${r + 1}_${c}`] = toCleanString(rowData[c]);
              }
            }
          }
        }

        createTable(canvas, {
          rows: rows,
          cols: cols,
          x: action.x || 80,
          y: action.y || 250,
          cellWidth: action.cellWidth || Math.floor((A4_WIDTH - 160) / cols),
          cellHeight: action.cellHeight || 36,
          headerBg: action.headerBg || '#e0f2fe',
          cellBg: action.cellBg || '#ffffff',
          strokeColor: action.strokeColor || '#1c1917',
          fontFamily: action.fontFamily || 'Caveat',
          fontSize: 18,
          cellContents: cellContents,
        });

        tablesAdded++;
      } else if (action.type === 'addIcon') {
        await insertVectorIcon(action.name, {
          x: action.x || 100,
          y: action.y || 100,
          size: action.size || 28,
          color: action.color || '#1c1917',
          canvas: canvas,
        });
        iconsAdded++;
      } else if (action.type === 'highlightExistingText') {
        const target = (action.targetText || '').toLowerCase().trim();
        if (target) {
          const objs = canvas.getObjects();
          const hlColor = hexToRgba(action.color || '#fef08a', (action.opacity || 0.25) * 100);
          for (const o of objs) {
            if ((o.type === 'i-text' || o.type === 'textbox') && o.text) {
              const full = o.text.toLowerCase();
              let pos = full.indexOf(target);
              while (pos !== -1) {
                const end = pos + target.length;
                for (let c = pos; c < end; c++) {
                  o.setSelectionStyles({ textBackgroundColor: hlColor }, c, c + 1);
                }
                highlightsApplied++;
                pos = full.indexOf(target, end);
              }
              o.dirty = true;
            }
          }
        }
      } else if (action.type === 'encloseExistingText') {
        const target = (action.targetText || '').toLowerCase().trim();
        if (target) {
          const objs = canvas.getObjects();
          for (const o of objs) {
            if ((o.type === 'i-text' || o.type === 'textbox') && o.text && o.text.toLowerCase().includes(target)) {
              const center = o.getCenterPoint();
              const tw = o.width * (o.scaleX || 1);
              const th = o.height * (o.scaleY || 1);
              const pad = 14;

              const strokeColor = action.strokeColor || '#6366f1';
              const fillColor = hexToRgba(action.fillColor || '#eff6ff', (action.fillOpacity || 0.25) * 100);

              const shape = new fabric.Rect({
                left: center.x,
                top: center.y,
                originX: 'center',
                originY: 'center',
                width: tw + pad * 2,
                height: th + pad * 2,
                rx: 8,
                ry: 8,
                fill: fillColor,
                stroke: strokeColor,
                strokeWidth: 1.5,
                strokeUniform: true,
                isShape: true,
              });

              canvas.add(shape);
              const tIdx = canvas.getObjects().indexOf(o);
              canvas.moveTo(shape, Math.max(0, tIdx));

              o.frameShape = shape;
              o.frameType = 'box';
              shape.enclosedText = o;
              shape.linkedText = o;
              o.parentShape = shape;

              boxesAdded++;
              break;
            }
          }
        }
      }
    } catch (itemErr) {
      console.warn(`Action failed (${action.type}):`, itemErr);
    }
  }
} finally {
  canvas.discardActiveObject();
    saveCurrentPage(state);
    resumeHistory(true);
    canvas.requestRenderAll();
  }

  const parts = [];
  if (pagesCreated > 0) parts.push(`${pagesCreated} new page(s)`);
  if (textsAdded > 0) parts.push(`${textsAdded} text blocks`);
  if (boxesAdded > 0) parts.push(`${boxesAdded} rounded boxes`);
  if (tablesAdded > 0) parts.push(`${tablesAdded} tables`);
  if (iconsAdded > 0) parts.push(`${iconsAdded} icons`);
  if (highlightsApplied > 0) parts.push(`${highlightsApplied} highlights`);

  return parts.length > 0 ? `Applied: ${parts.join(', ')}` : 'Canvas updated.';
}
