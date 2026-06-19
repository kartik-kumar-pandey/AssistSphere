'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CallControlProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
  off?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

export function CallControl({
  label,
  children,
  onClick,
  active,
  off,
  danger,
  disabled,
}: CallControlProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-1 min-w-[52px] px-1 py-0.5 rounded-xl transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        active && !off && !danger && 'text-indigo-600 dark:text-indigo-400'
      )}
    >
      <span
        className={cn(
          'w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-sm',
          danger
            ? 'bg-red-500 text-white hover:bg-red-600'
            : off
              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 ring-2 ring-red-500/20'
              : active
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/30'
                : 'bg-[var(--color-surface-muted)] text-[var(--color-text)] hover:bg-[var(--color-border)]'
        )}
      >
        {children}
      </span>
      <span className="text-[10px] font-semibold text-[var(--color-text-muted)] leading-none truncate max-w-[56px]">
        {label}
      </span>
    </button>
  );
}
