import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Sparkles,
  LogOut,
  X,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      name: 'Dashboard',
      to: '/',
      icon: LayoutDashboard,
    },
    {
      name: 'Study Materials',
      to: '/materials',
      icon: BookOpen,
    },
    {
      name: 'AI Study Chat',
      to: '/chat',
      icon: MessageSquare,
    },
    {
      name: 'Visual Learning Studio',
      to: '/studio',
      icon: Sparkles,
      badge: '6 Types',
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-border-light dark:border-border-dark bg-white dark:bg-surface-dark transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-border-light dark:border-border-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/25">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-text-primary dark:text-text-darkPrimary">
                Mentora
              </span>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-primary dark:text-primary-dark">
                AI Study Assistant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-text-secondary hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1.5 px-3 py-6 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary">
            Main Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => onClose?.()}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                    isActive
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'text-text-secondary dark:text-text-darkSecondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary dark:hover:text-text-darkPrimary'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          'h-4 w-4 transition-transform group-hover:scale-110',
                          isActive ? 'text-white' : 'text-primary dark:text-primary-dark'
                        )}
                      />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-primary/10 text-primary dark:text-primary-dark'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-border-light dark:border-border-dark">
          <div className="flex items-center justify-between rounded-xl bg-background-light dark:bg-surface-elevated p-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary dark:text-primary-dark font-bold text-xs uppercase">
                {user?.name?.slice(0, 2) || 'ST'}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-text-primary dark:text-text-darkPrimary truncate">
                  {user?.name || 'Student'}
                </p>
                <p className="text-[11px] text-text-secondary dark:text-text-darkSecondary truncate">
                  {user?.email || 'student@mentora.edu'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-text-secondary hover:text-status-error hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Log Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

