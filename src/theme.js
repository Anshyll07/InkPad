const THEME_KEY = 'inkpad_theme';

export function initTheme() {
  // Default to light theme as requested, or load user's saved preference
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  setTheme(saved);

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      setTheme(next);
    });
  }
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    const isLight = theme === 'light';
    toggleBtn.title = isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    toggleBtn.setAttribute('aria-label', toggleBtn.title);
  }
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}
