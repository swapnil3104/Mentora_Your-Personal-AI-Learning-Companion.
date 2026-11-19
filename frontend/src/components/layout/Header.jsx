import React from 'react';
import { Menu, Sparkles, User } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

export const Header = ({ onOpenSidebar }) => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border-light dark:border-border-dark bg-white/80 dark:bg-surface-dark/80 px-4 sm:px-6 backdrop-blur-md transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-lg text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1">
            <Sparkles className="h-3 w-3 text-primary dark:text-primary-dark" />
            <span className="font-medium">Mentora v1.0 Foundation</span>
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Light/Dark Theme Switch */}
        <ThemeToggle />

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-border-light dark:border-border-dark">
          <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary dark:text-primary-dark font-medium text-xs">
            {user?.name ? user.name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
          </div>
          <span className="hidden md:inline-block text-xs font-semibold text-text-primary dark:text-text-darkPrimary">
            {user?.name || 'Student'}
          </span>
        </div>
      </div>
    </header>
  );
};

