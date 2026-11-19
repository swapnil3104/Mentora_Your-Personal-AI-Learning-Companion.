import React from 'react';
import { cn } from '../../utils/cn';

export const Badge = ({ className, variant = 'default', children, ...props }) => {
  const variants = {
    default:
      'bg-primary/10 text-primary dark:text-primary-dark border-transparent',
    secondary:
      'bg-secondary/15 text-secondary dark:text-secondary border-transparent',
    success:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    error:
      'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    outline:
      'border-border-light dark:border-border-dark text-text-secondary dark:text-text-darkSecondary',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

