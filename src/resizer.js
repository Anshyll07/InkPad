// Left Toolbar & Right Icon Panel Splitters

const STORAGE_LEFT_WIDTH = 'inkpad_toolbar_width';
const STORAGE_RIGHT_WIDTH = 'inkpad_icon_panel_width';
const STORAGE_AI_WIDTH = 'inkpad_ai_panel_width';

const LEFT_MIN = 180;
const LEFT_MAX = 420;
const LEFT_DEFAULT = 220;

const RIGHT_MIN = 200;
const RIGHT_MAX = 550;
const RIGHT_DEFAULT = 270;

const AI_MIN = 280;
const AI_MAX = 800;
const AI_DEFAULT = 340;

export function initResizers() {
  const toolbar = document.getElementById('toolbar');
  const iconPanel = document.getElementById('icon-panel');
  const aiPanel = document.getElementById('ai-panel');
  const resizerLeft = document.getElementById('resizer-left');
  const resizerRight = document.getElementById('resizer-right');
  const resizerAi = document.getElementById('resizer-ai');
  const toggleIconsBtn = document.getElementById('close-icons') || document.getElementById('toggle-icons');

  if (toolbar && resizerLeft) {
    const savedLeft = localStorage.getItem(STORAGE_LEFT_WIDTH);
    if (savedLeft) {
      const width = Math.max(LEFT_MIN, Math.min(LEFT_MAX, parseInt(savedLeft)));
      toolbar.style.width = `${width}px`;
    }
    setupLeftResizer(toolbar, resizerLeft);
  }

  if (iconPanel && resizerRight) {
    const savedRight = localStorage.getItem(STORAGE_RIGHT_WIDTH);
    if (savedRight) {
      const width = Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, parseInt(savedRight)));
      iconPanel.style.width = `${width}px`;
    }
    setupRightResizer(iconPanel, resizerRight, toggleIconsBtn);
  }

  if (aiPanel && resizerAi) {
    const savedAi = localStorage.getItem(STORAGE_AI_WIDTH);
    if (savedAi) {
      const width = Math.max(AI_MIN, Math.min(AI_MAX, parseInt(savedAi)));
      aiPanel.style.width = `${width}px`;
    }
    setupAiResizer(aiPanel, resizerAi);
  }
}

function setupLeftResizer(toolbar, resizer) {
  let isDragging = false;

  const onStart = (clientX) => {
    isDragging = true;
    resizer.classList.add('active');
    document.body.classList.add('resizing');
  };

  const onMove = (clientX) => {
    if (!isDragging) return;
    const newWidth = Math.max(LEFT_MIN, Math.min(LEFT_MAX, clientX));
    toolbar.style.width = `${newWidth}px`;
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    resizer.classList.remove('active');
    document.body.classList.remove('resizing');
    const finalWidth = parseInt(toolbar.style.width) || LEFT_DEFAULT;
    localStorage.setItem(STORAGE_LEFT_WIDTH, finalWidth);
  };

  // Mouse events
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onStart(e.clientX);

    const moveHandler = (e) => onMove(e.clientX);
    const upHandler = () => {
      onEnd();
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', upHandler);
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
  });

  // Touch events for mobile/tablet
  resizer.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    onStart(e.touches[0].clientX);

    const touchMoveHandler = (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX);
    };
    const touchEndHandler = () => {
      onEnd();
      window.removeEventListener('touchmove', touchMoveHandler);
      window.removeEventListener('touchend', touchEndHandler);
    };

    window.addEventListener('touchmove', touchMoveHandler, { passive: true });
    window.addEventListener('touchend', touchEndHandler);
  });

  // Double-click to reset
  resizer.addEventListener('dblclick', () => {
    toolbar.style.width = `${LEFT_DEFAULT}px`;
    localStorage.removeItem(STORAGE_LEFT_WIDTH);
  });
}

function setupRightResizer(iconPanel, resizer, toggleBtn) {
  let isDragging = false;

  const onStart = () => {
    if (iconPanel.classList.contains('collapsed')) return;
    isDragging = true;
    resizer.classList.add('active');
    document.body.classList.add('resizing');
  };

  const onMove = (clientX) => {
    if (!isDragging) return;
    const newWidth = Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, window.innerWidth - clientX));
    iconPanel.style.width = `${newWidth}px`;
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    resizer.classList.remove('active');
    document.body.classList.remove('resizing');
    const finalWidth = parseInt(iconPanel.style.width) || RIGHT_DEFAULT;
    localStorage.setItem(STORAGE_RIGHT_WIDTH, finalWidth);
  };

  // Mouse events
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onStart();

    const moveHandler = (e) => onMove(e.clientX);
    const upHandler = () => {
      onEnd();
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', upHandler);
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
  });

  // Touch events
  resizer.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    onStart();

    const touchMoveHandler = (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX);
    };
    const touchEndHandler = () => {
      onEnd();
      window.removeEventListener('touchmove', touchMoveHandler);
      window.removeEventListener('touchend', touchEndHandler);
    };

    window.addEventListener('touchmove', touchMoveHandler, { passive: true });
    window.addEventListener('touchend', touchEndHandler);
  });

  // Double-click to reset
  resizer.addEventListener('dblclick', () => {
    iconPanel.style.width = `${RIGHT_DEFAULT}px`;
    localStorage.removeItem(STORAGE_RIGHT_WIDTH);
  });

  // Toggle button coordination: hide resizer when collapsed
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      setTimeout(() => {
        const isCollapsed = iconPanel.classList.contains('collapsed');
        resizer.style.display = isCollapsed ? 'none' : 'flex';
      }, 50);
    });
  }
}

function setupAiResizer(aiPanel, resizer) {
  let isDragging = false;

  const onStart = () => {
    if (aiPanel.classList.contains('hidden')) return;
    isDragging = true;
    resizer.classList.add('active');
    document.body.classList.add('resizing');
  };

  const onMove = (clientX) => {
    if (!isDragging) return;
    const rect = aiPanel.getBoundingClientRect();
    const newWidth = Math.max(AI_MIN, Math.min(AI_MAX, rect.right - clientX));
    aiPanel.style.width = `${newWidth}px`;
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    resizer.classList.remove('active');
    document.body.classList.remove('resizing');
    const finalWidth = parseInt(aiPanel.style.width) || AI_DEFAULT;
    localStorage.setItem(STORAGE_AI_WIDTH, finalWidth);
  };

  // Mouse events
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onStart();

    const moveHandler = (e) => onMove(e.clientX);
    const upHandler = () => {
      onEnd();
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', upHandler);
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
  });

  // Touch events
  resizer.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    onStart();

    const touchMoveHandler = (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX);
    };
    const touchEndHandler = () => {
      onEnd();
      window.removeEventListener('touchmove', touchMoveHandler);
      window.removeEventListener('touchend', touchEndHandler);
    };

    window.addEventListener('touchmove', touchMoveHandler, { passive: true });
    window.addEventListener('touchend', touchEndHandler);
  });

  // Double-click to reset
  resizer.addEventListener('dblclick', () => {
    aiPanel.style.width = `${AI_DEFAULT}px`;
    localStorage.removeItem(STORAGE_AI_WIDTH);
  });
}
