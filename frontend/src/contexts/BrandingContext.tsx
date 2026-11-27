import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';

export interface OrgBranding {
  name: string;
  logoUrl: string;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<OrgBranding>({
  name: '',
  logoUrl: '',
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

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/public/branding');
      const nextName = res.data?.name || '';
      const nextLogo = res.data?.logoUrl || '';
      setName(nextName);
      setLogoUrl(nextLogo);
      if (nextLogo) applyFavicon(nextLogo);
      if (nextName) {
        document.title = `${nextName} — Quản lý tài sản CNTT`;
      }
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
    <BrandingContext.Provider value={{ name, logoUrl, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
