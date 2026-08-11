import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
  className?: string;
}

export const SidebarTooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'right',
  disabled = false,
  className
}) => {
  const [isVisible, setIsVisible] = useState(false);

  if (disabled || !content) {
    return <>{children}</>;
  }

  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-3',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3'
  };

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-[9999] whitespace-nowrap rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95 dark:bg-zinc-100 dark:text-zinc-900 border border-white/10 dark:border-zinc-800',
            sideClasses[side],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};
