import React, { useState, useRef, useEffect } from 'react';
import { 
  Palette, 
  Sun, 
  Moon, 
  Tv, 
  Rows3, 
  SlidersHorizontal, 
  AlertTriangle, 
  Check, 
  Sparkles,
  Zap,
  TreePine,
  Compass
} from 'lucide-react';
import { 
  ThemeType, 
  DisplayMode, 
  getStoredTheme, 
  setStoredTheme, 
  getStoredDisplayMode, 
  setStoredDisplayMode 
} from '../services/storage';

interface ThemeModeMenuProps {
  currentMode: DisplayMode;
  onModeChange: (mode: DisplayMode) => void;
}

interface ThemeOption {
  id: ThemeType;
  label: string;
  tagline: string;
  swatchBg: string;
  swatchBorder: string;
  swatchAccent: string;
  icon: React.ReactNode;
}

interface ModeOption {
  id: DisplayMode;
  label: string;
  tagline: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'nordic',
    label: 'Nordic Sage',
    tagline: 'Forest pine & eye-comfort mint',
    swatchBg: 'bg-[#0a1412]',
    swatchBorder: 'border-emerald-800',
    swatchAccent: 'bg-emerald-400',
    icon: <TreePine className="w-3.5 h-3.5 text-emerald-400" />
  },
  {
    id: 'teal',
    label: 'Calm Oceanic',
    tagline: 'Deep soothing nautical teal',
    swatchBg: 'bg-[#07151e]',
    swatchBorder: 'border-teal-800',
    swatchAccent: 'bg-teal-400',
    icon: <Compass className="w-3.5 h-3.5 text-teal-400" />
  },
  {
    id: 'dark',
    label: 'Slate Dark',
    tagline: 'Deep slate & indigo accent',
    swatchBg: 'bg-[#0b0f19]',
    swatchBorder: 'border-slate-700',
    swatchAccent: 'bg-indigo-500',
    icon: <Moon className="w-3.5 h-3.5 text-indigo-400" />
  },
  {
    id: 'midnight',
    label: 'Midnight Navy',
    tagline: 'Executive oceanic sapphire',
    swatchBg: 'bg-[#070d1e]',
    swatchBorder: 'border-blue-900',
    swatchAccent: 'bg-cyan-400',
    icon: <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
  },
  {
    id: 'amoled',
    label: 'AMOLED Black',
    tagline: 'True #000000 pitch black',
    swatchBg: 'bg-black',
    swatchBorder: 'border-zinc-800',
    swatchAccent: 'bg-emerald-400',
    icon: <Zap className="w-3.5 h-3.5 text-emerald-400" />
  },
  {
    id: 'light',
    label: 'Clean Light',
    tagline: 'Crisp alabaster & slate',
    swatchBg: 'bg-slate-50',
    swatchBorder: 'border-slate-300',
    swatchAccent: 'bg-blue-600',
    icon: <Sun className="w-3.5 h-3.5 text-amber-500" />
  },
  {
    id: 'warm',
    label: 'Warm Sepia',
    tagline: 'Paper cream for zero eye-strain',
    swatchBg: 'bg-[#fbf8f2]',
    swatchBorder: 'border-amber-200',
    swatchAccent: 'bg-amber-700',
    icon: <Sun className="w-3.5 h-3.5 text-amber-600" />
  }
];

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'standard',
    label: 'Standard View',
    tagline: 'Balanced responsive layout',
    icon: <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
  },
  {
    id: 'compact',
    label: 'Compact Dense',
    tagline: 'Max visible rows for power users',
    icon: <Rows3 className="w-3.5 h-3.5 text-emerald-500" />,
    badge: '25+ Rows'
  },
  {
    id: 'tv',
    label: 'Operations TV',
    tagline: 'Auto-rotates tabs on 15s timer',
    icon: <Tv className="w-3.5 h-3.5 text-sky-400" />,
    badge: 'Wallboard',
    badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/40'
  },
  {
    id: 'incident',
    label: 'Incident Focus',
    tagline: 'Isolate active delays & RTS',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
    badge: 'Triage',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40'
  }
];

export const applyThemeToDOM = (newTheme: ThemeType) => {
  const root = document.documentElement;

  // 1. Freeze transitions so browser repaints immediately without transition lag
  root.classList.add('no-transitions');

  // 2. Remove all theme classes
  root.classList.remove('dark', 'light', 'midnight', 'warm', 'amoled', 'nordic', 'teal');

  // 3. Apply base dark or light plus optional variant
  if (newTheme === 'light') {
    root.classList.add('light');
  } else if (newTheme === 'warm') {
    root.classList.add('light', 'warm');
  } else if (newTheme === 'midnight') {
    root.classList.add('dark', 'midnight');
  } else if (newTheme === 'amoled') {
    root.classList.add('dark', 'amoled');
  } else if (newTheme === 'nordic') {
    root.classList.add('dark', 'nordic');
  } else if (newTheme === 'teal') {
    root.classList.add('dark', 'teal');
  } else {
    // Standard dark
    root.classList.add('dark');
  }

  // 4. Restore transitions on the next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove('no-transitions');
    });
  });
};

export const ThemeModeMenu: React.FC<ThemeModeMenuProps> = ({ currentMode, onModeChange }) => {
  const [theme, setTheme] = useState<ThemeType>(() => getStoredTheme());
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTheme = (selectedTheme: ThemeType) => {
    applyThemeToDOM(selectedTheme);
    setStoredTheme(selectedTheme);
    setTheme(selectedTheme);
  };

  const handleSelectMode = (selectedMode: DisplayMode) => {
    setStoredDisplayMode(selectedMode);
    onModeChange(selectedMode);
  };

  // Find current theme representation
  const activeThemeMeta = THEME_OPTIONS.find(t => t.id === theme) || THEME_OPTIONS[0];
  const activeModeMeta = MODE_OPTIONS.find(m => m.id === currentMode) || MODE_OPTIONS[0];

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 transition-all cursor-pointer shadow-xs ${
          isOpen
            ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-sky-400'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
        }`}
        title="Themes & Display Modes"
      >
        <div className="flex items-center gap-1">
          {activeThemeMeta.icon}
          {currentMode !== 'standard' && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          )}
        </div>
        <span className="text-xs font-bold hidden lg:inline">
          {activeThemeMeta.label}
        </span>
        {currentMode !== 'standard' && (
          <span className="hidden xl:inline text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-700 dark:text-sky-300 border border-blue-400/30">
            {activeModeMeta.label}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-[#0d1322] border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-fade-in">
          
          {/* SECTION 1: VISUAL THEMES */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Visual Theme
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                7 Palettes
              </span>
            </div>

            <div className="space-y-1">
              {THEME_OPTIONS.map((opt) => {
                const isSelected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectTheme(opt.id)}
                    type="button"
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-slate-800/80 border border-blue-400 dark:border-sky-500/50 shadow-xs'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Color Preview Pill */}
                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center relative overflow-hidden ${opt.swatchBg} ${opt.swatchBorder}`}>
                        <span className={`w-2 h-2 rounded-full ${opt.swatchAccent}`} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          {opt.label}
                          {isSelected && (
                            <span className="text-[10px] text-blue-600 dark:text-sky-400 font-semibold">(Active)</span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                          {opt.tagline}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: FUNCTIONAL MODES */}
          <div className="p-3 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Display Mode
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                Workflows
              </span>
            </div>

            <div className="space-y-1">
              {MODE_OPTIONS.map((m) => {
                const isSelected = currentMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMode(m.id)}
                    type="button"
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-slate-800/80 border border-blue-400 dark:border-sky-500/50 shadow-xs'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 rounded-lg bg-slate-200/60 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                        {m.icon}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          {m.label}
                          {m.badge && (
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                              m.badgeColor || 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            }`}>
                              {m.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                          {m.tagline}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
