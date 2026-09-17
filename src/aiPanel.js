import {
  sendChatMessage,
  resetChatHistory,
  getAiConfig,
  setAiConfig,
} from './ai.js';

let isPanelOpen = true;

export function initAiPanel() {
  const panel = document.getElementById('ai-panel');
  const toggleBtn = document.getElementById('toggle-ai-top');
  const closeBtn = document.getElementById('close-ai');
  const openBtn = document.getElementById('open-ai-btn');
  const clearBtn = document.getElementById('ai-clear-btn');
  const settingsBtn = document.getElementById('ai-settings-btn');
  const sendBtn = document.getElementById('ai-send-btn');
  const inputEl = document.getElementById('ai-input');
  const chatMessages = document.getElementById('ai-chat-messages');
  const statusBar = document.getElementById('ai-status-bar');
  const statusText = document.getElementById('ai-status-text');
  const promptStrip = document.getElementById('ai-prompts-strip');

  // Settings Modal Elements
  const settingsModal = document.getElementById('ai-settings-modal');
  const settingsClose = document.getElementById('ai-settings-close');
  const settingsBackdrop = document.getElementById('ai-settings-backdrop');
  const settingsSave = document.getElementById('ai-settings-save');
  const apiKeyInput = document.getElementById('ai-api-key-input');
  const modelInput = document.getElementById('ai-model-input');

  if (!panel) return;

  function updatePanelState(open) {
    isPanelOpen = open;
    if (isPanelOpen) {
      panel.classList.remove('hidden');
      if (toggleBtn) toggleBtn.classList.add('active');
      if (openBtn) openBtn.classList.add('hidden');
    } else {
      panel.classList.add('hidden');
      if (toggleBtn) toggleBtn.classList.remove('active');
      if (openBtn) openBtn.classList.remove('hidden');
    }
  }

  function toggleAiPanel() {
    updatePanelState(!isPanelOpen);
  }

  window.toggleAiPanel = toggleAiPanel;

  // Initial state: open
  updatePanelState(true);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => updatePanelState(!isPanelOpen));
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => updatePanelState(false));
  }
  if (openBtn) {
    openBtn.addEventListener('click', () => updatePanelState(true));
  }

  // Clear Chat
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      resetChatHistory();
      if (chatMessages) {
        chatMessages.innerHTML = `
          <div class="ai-msg ai-msg-assistant">
            <div class="ai-msg-bubble">
              <p>Chat cleared! How can I assist with your notes today?</p>
            </div>
          </div>
        `;
      }
    });
  }

  // Settings Modal Handlers
  function openSettingsModal() {
    const config = getAiConfig();
    if (apiKeyInput) apiKeyInput.value = config.apiKey || '';
    if (modelInput) modelInput.value = config.model || '';
    if (settingsModal) {
      settingsModal.classList.remove('hidden');
      settingsModal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeSettingsModal() {
    if (settingsModal) {
      settingsModal.classList.add('hidden');
      settingsModal.setAttribute('aria-hidden', 'true');
    }
  }

  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
  if (settingsClose) settingsClose.addEventListener('click', closeSettingsModal);
  if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettingsModal);

  if (settingsSave) {
    settingsSave.addEventListener('click', () => {
      const newKey = apiKeyInput ? apiKeyInput.value.trim() : '';
      const newModel = modelInput ? modelInput.value.trim() : '';
      setAiConfig({ apiKey: newKey, model: newModel });
      closeSettingsModal();
      appendAssistantMessage('Settings saved. Ready to assist!');
    });
  }

  // Quick Prompt Chips
  if (promptStrip) {
    promptStrip.addEventListener('click', (e) => {
      const chip = e.target.closest('.ai-prompt-chip');
      if (!chip) return;
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        handleUserSubmit(prompt);
      }
    });
  }

  // Auto-resize textarea
  if (inputEl) {
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = inputEl.value.trim();
        if (text) {
          handleUserSubmit(text);
          inputEl.value = '';
          inputEl.style.height = 'auto';
        }
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const text = inputEl ? inputEl.value.trim() : '';
      if (text) {
        handleUserSubmit(text);
        if (inputEl) {
          inputEl.value = '';
          inputEl.style.height = 'auto';
        }
      }
    });
  }

  async function handleUserSubmit(message) {
    appendUserMessage(message);

    if (sendBtn) sendBtn.disabled = true;
    if (inputEl) inputEl.disabled = true;

    const typingEl = appendTypingIndicator();

    try {
      const result = await sendChatMessage(message, {
        onStatus: (st) => {
          if (statusText) statusText.textContent = st;
        },
      });

      if (typingEl) typingEl.remove();

      appendAssistantMessage(result.reply, result.actionSummary);
    } catch (err) {
      if (typingEl) typingEl.remove();
      appendErrorMessage(err.message || 'An error occurred while communicating with EDITH.');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (inputEl) {
        inputEl.disabled = false;
        inputEl.focus();
      }
      if (statusText) statusText.textContent = 'Ready';
    }
  }

  function appendUserMessage(text) {
    if (!chatMessages) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg ai-msg-user';
    msgDiv.innerHTML = `<div class="ai-msg-bubble"><p>${escapeHtml(text)}</p></div>`;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
  }

  function appendAssistantMessage(replyText, actionSummary = '') {
    if (!chatMessages) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg ai-msg-assistant';

    let actionBadgeHtml = '';
    if (actionSummary) {
      actionBadgeHtml = `
        <div class="ai-action-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>${escapeHtml(actionSummary)}</span>
        </div>
      `;
    }

    const formattedContent = formatMarkdown(replyText);

    msgDiv.innerHTML = `
      <div class="ai-msg-bubble">
        ${formattedContent}
        ${actionBadgeHtml}
      </div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
  }

  function appendErrorMessage(errorText) {
    if (!chatMessages) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg ai-msg-error';
    msgDiv.innerHTML = `
      <div class="ai-msg-bubble">
        <p><strong>Notice:</strong> ${escapeHtml(errorText)}</p>
      </div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
  }

  function appendTypingIndicator() {
    if (!chatMessages) return null;
    const div = document.createElement('div');
    div.className = 'ai-msg ai-msg-assistant ai-typing-indicator';
    div.innerHTML = `
      <div class="ai-msg-bubble">
        <div class="ai-typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    chatMessages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    const s = typeof str === 'string' ? str : (Array.isArray(str) ? str.join('\n') : String(str));
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMarkdown(text) {
    if (text == null) return '';
    const raw = typeof text === 'string' ? text : (Array.isArray(text) ? text.join('\n') : String(text));
    let out = escapeHtml(raw);

    // Bold **text**
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code `code`
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Paragraphs
    const paragraphs = (out || '').split(/\n\n+/);
    return paragraphs.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }
}
