import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function Card({ children, className, glow }: CardProps) {
  return (
    <div className={cn('card p-6 md:p-8', glow && 'card-elevated', className)}>
      {children}
    </div>
  );
}
