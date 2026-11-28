import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { BUILD_VERSION } from '../version';

export interface OrgBranding {
  name: string;
  logoUrl: string;
  appName: string;
  version: string;
  developedBy: string;
  idleTimeoutMin: number;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<OrgBranding>({
  name: '',
  logoUrl: '',
  appName: 'Quản lý tài sản',
  version: BUILD_VERSION,
  developedBy: 'Phòng Công nghệ Thông tin',
  idleTimeoutMin: 30,
  refresh: async () => {},
});

function applyFavicon(logoUrl: string) {
  if (!logoUrl) return;
  let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = logoUrl;
}

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [appName, setAppName] = useState('Quản lý tài sản');
  const [version, setVersion] = useState(BUILD_VERSION);
  const [developedBy, setDevelopedBy] = useState('Phòng Công nghệ Thông tin');
  const [idleTimeoutMin, setIdleTimeoutMin] = useState(30);

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/public/branding');
      const nextName = res.data?.name || '';
      const nextLogo = res.data?.logoUrl || '';
      const nextAppName = (res.data?.appName || '').trim() || 'Quản lý tài sản';
      const nextVersion = (res.data?.version || '').trim() || BUILD_VERSION;
      const nextDevelopedBy = (res.data?.developedBy || '').trim() || 'Phòng Công nghệ Thông tin';
      const rawTimeout = Number(res.data?.idleTimeoutMin);
      const nextIdleTimeout = Number.isFinite(rawTimeout) && rawTimeout >= 0 ? rawTimeout : 30;

      setName(nextName);
      setLogoUrl(nextLogo);
      setAppName(nextAppName);
      setVersion(nextVersion);
      setDevelopedBy(nextDevelopedBy);
      setIdleTimeoutMin(nextIdleTimeout);

      if (nextLogo) applyFavicon(nextLogo);
      document.title = nextName ? `${nextName} — ${nextAppName}` : nextAppName;
    } catch {
      // keep defaults silently
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUpdated = () => refresh();
    window.addEventListener('itam:branding-updated', onUpdated);
    return () => window.removeEventListener('itam:branding-updated', onUpdated);
  }, [refresh]);

  return (
    <BrandingContext.Provider value={{ name, logoUrl, appName, version, developedBy, idleTimeoutMin, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
