import { prisma } from '../db/client.js';

export interface BrandingData {
  appName: string;
  primaryColor: string;
  primaryHover: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
}

const DEFAULTS: BrandingData = {
  appName: 'AssistSphere',
  primaryColor: '#4f46e5',
  primaryHover: '#4338ca',
  logoUrl: null,
  logoDarkUrl: null,
};

const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string) {
  return HEX_COLOR.test(value);
}

export async function getBranding(): Promise<BrandingData> {
  const row = await prisma.brandingSettings.findUnique({ where: { id: 'default' } });
  if (!row) return { ...DEFAULTS };
  return {
    appName: row.appName,
    primaryColor: row.primaryColor,
    primaryHover: row.primaryHover,
    logoUrl: row.logoUrl,
    logoDarkUrl: row.logoDarkUrl,
  };
}

export async function updateBranding(data: Partial<BrandingData>): Promise<BrandingData> {
  if (data.primaryColor && !isValidHexColor(data.primaryColor)) {
    throw new Error('INVALID_PRIMARY_COLOR');
  }
  if (data.primaryHover && !isValidHexColor(data.primaryHover)) {
    throw new Error('INVALID_PRIMARY_HOVER');
  }
  if (data.appName !== undefined && !data.appName.trim()) {
    throw new Error('INVALID_APP_NAME');
  }

  const row = await prisma.brandingSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      appName: data.appName?.trim() || DEFAULTS.appName,
      primaryColor: data.primaryColor || DEFAULTS.primaryColor,
      primaryHover: data.primaryHover || DEFAULTS.primaryHover,
      logoUrl: data.logoUrl ?? null,
      logoDarkUrl: data.logoDarkUrl ?? null,
    },
    update: {
      ...(data.appName !== undefined ? { appName: data.appName.trim() } : {}),
      ...(data.primaryColor !== undefined ? { primaryColor: data.primaryColor } : {}),
      ...(data.primaryHover !== undefined ? { primaryHover: data.primaryHover } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl || null } : {}),
      ...(data.logoDarkUrl !== undefined ? { logoDarkUrl: data.logoDarkUrl || null } : {}),
    },
  });

  return {
    appName: row.appName,
    primaryColor: row.primaryColor,
    primaryHover: row.primaryHover,
    logoUrl: row.logoUrl,
    logoDarkUrl: row.logoDarkUrl,
  };
}
