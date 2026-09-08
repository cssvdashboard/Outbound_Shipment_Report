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
    // 1. Instantly update <html> class — CSS repaints with no React involvement
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(newTheme);
    // 2. Persist
    setStoredTheme(newTheme);
    // 3. Update local state (only re-renders THIS tiny component, not the whole app)
    setTheme(newTheme);
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
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
