import React from 'react';
import { cn } from '../../utils/cn';

export const Input = React.forwardRef(
  ({ className, type = 'text', label, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'flex h-10 w-full rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm text-text-primary dark:text-text-darkPrimary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-status-error focus:ring-status-error',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-status-error font-medium">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-text-secondary dark:text-text-darkSecondary">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

