import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle = ({ className }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`p-2 rounded-lg transition-colors border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark hover:bg-black/5 dark:hover:bg-white/5 text-text-primary dark:text-text-darkPrimary ${className || ''}`}
      aria-label="Toggle Theme"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="w-5 h-5 text-primary hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
};

