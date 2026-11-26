import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

export interface AssetStatusItem {
  id: string;
  code: string;
  name: string;
  bgColor: string;
  textColor: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  assetCount?: number;
}

interface AssetStatusContextValue {
  statuses: AssetStatusItem[];
  activeStatuses: AssetStatusItem[];
  statusMap: Record<string, AssetStatusItem>;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AssetStatusContext = createContext<AssetStatusContextValue>({
  statuses: [],
  activeStatuses: [],
  statusMap: {},
  loading: false,
  refresh: async () => {},
});

export const AssetStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<AssetStatusItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatuses([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/admin/asset-statuses');
      setStatuses(Array.isArray(res.data) ? res.data : []);
    } catch {
      // keep existing state on transient errors
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeStatuses = useMemo(
    () => statuses.filter((s) => s.isActive),
    [statuses],
  );

  const statusMap = useMemo(() => {
    const map: Record<string, AssetStatusItem> = {};
    for (const s of statuses) {
      map[s.code] = s;
    }
    return map;
  }, [statuses]);

  const value = useMemo(
    () => ({ statuses, activeStatuses, statusMap, loading, refresh }),
    [statuses, activeStatuses, statusMap, loading, refresh],
  );

  return <AssetStatusContext.Provider value={value}>{children}</AssetStatusContext.Provider>;
};

export const useAssetStatuses = () => useContext(AssetStatusContext);
