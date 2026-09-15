import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { ThemeType, getStoredTheme, setStoredTheme } from '../services/storage';
import { applyThemeToDOM } from './ThemeModeMenu';

/**
 * Self-contained theme toggle.
 * Cycles between dark and light, compatible with extended themes.
 */
export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<ThemeType>(() => getStoredTheme());

  const handleToggle = () => {
    const newTheme: ThemeType = theme === 'light' ? 'dark' : 'light';
    applyThemeToDOM(newTheme);
    setStoredTheme(newTheme);
    setTheme(newTheme);
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
