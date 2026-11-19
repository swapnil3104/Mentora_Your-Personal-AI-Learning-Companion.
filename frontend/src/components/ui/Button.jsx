import React from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';

export const Button = React.forwardRef(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-lg';

    const variants = {
      default:
        'bg-primary hover:bg-primary-hover text-white shadow-sm',
      secondary:
        'bg-secondary/15 text-primary dark:text-primary-dark hover:bg-secondary/25 border border-transparent',
      outline:
        'border border-border-light dark:border-border-dark bg-transparent hover:bg-surface-light dark:hover:bg-surface-dark text-text-primary dark:text-text-darkPrimary',
      ghost:
        'hover:bg-black/5 dark:hover:bg-white/5 text-text-primary dark:text-text-darkPrimary',
      destructive:
        'bg-status-error text-white hover:bg-red-700 shadow-sm',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 py-2 text-sm',
      lg: 'h-12 px-6 text-base',
      icon: 'h-10 w-10',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

