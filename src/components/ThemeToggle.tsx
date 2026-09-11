import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getStoredTheme, setStoredTheme } from '../services/storage';

/**
 * Self-contained theme toggle.
 * Manages its own state — does NOT cause App or any dashboard component to re-render.
 * The DOM class change on <html> is what drives all visual theming via CSS.
 */
export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getStoredTheme());

  const handleToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;

    // 1. Freeze transitions so browser paints new colors in 0ms without running transitions
    root.classList.add('no-transitions');

    // 2. Instantly swap theme class
    root.classList.remove('dark', 'light');
    root.classList.add(newTheme);

    // 3. Persist
    setStoredTheme(newTheme);

    // 4. Update local icon state
    setTheme(newTheme);

    // 5. Restore transitions on the next frame after DOM has repainted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('no-transitions');
      });
    });
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 cursor-pointer"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
};
