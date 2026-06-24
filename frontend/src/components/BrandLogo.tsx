'use client';

import { Video } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useBranding } from '@/components/BrandingProvider';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-base' },
  md: { box: 'w-12 h-12', icon: 'w-6 h-6', text: 'text-lg' },
  lg: { box: 'w-14 h-14', icon: 'w-7 h-7', text: 'text-xl' },
};

export function BrandLogo({ size = 'md', showName = true, className }: BrandLogoProps) {
  const { branding } = useBranding();
  const { theme } = useTheme();
  const s = sizes[size];

  const logoSrc =
    theme === 'dark' && branding.logoDarkUrl
      ? branding.logoDarkUrl
      : branding.logoUrl;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(s.box, 'flex items-center justify-center overflow-hidden shrink-0 bg-transparent')}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt={branding.appName} className="w-full h-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/icon.png" alt={branding.appName} className="w-full h-full object-cover" />
        )}
      </div>
      {showName && <span className={cn(s.text, 'font-bold')}>{branding.appName}</span>}
    </div>
  );
}
