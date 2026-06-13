import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function Card({ children, className, glow }: CardProps) {
  return (
    <div
      className={cn(
        'glass rounded-2xl p-6 md:p-8',
        glow && 'shadow-2xl shadow-indigo-500/10',
        className
      )}
    >
      {children}
    </div>
  );
}
