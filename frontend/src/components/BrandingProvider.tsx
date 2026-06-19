'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { API_URL } from '@/lib/utils';

export interface Branding {
  appName: string;
  primaryColor: string;
  primaryHover: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
}

const DEFAULT_BRANDING: Branding = {
  appName: 'AssistSphere',
  primaryColor: '#4f46e5',
  primaryHover: '#4338ca',
  logoUrl: null,
  logoDarkUrl: null,
};

interface BrandingContextValue {
  branding: Branding;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  refreshBranding: async () => {},
});

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function applyBrandingToDocument(branding: Branding) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', branding.primaryColor);
  root.style.setProperty('--color-primary-hover', branding.primaryHover);

  const rgb = hexToRgb(branding.primaryColor);
  root.style.setProperty('--color-primary-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

  async function refreshBranding() {
    try {
      const res = await fetch(`${API_URL}/branding`);
      if (!res.ok) return;
      const data = (await res.json()) as Branding;
      setBranding(data);
      applyBrandingToDocument(data);
    } catch {
      applyBrandingToDocument(DEFAULT_BRANDING);
    }
  }

  useEffect(() => {
    refreshBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
