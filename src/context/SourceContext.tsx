import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { SOURCES, type SourceConfig } from '../api';
import { useAuth } from './AuthContext';

interface SourceContextType {
  sourceKey: string;
  source: SourceConfig;
  availableSources: SourceConfig[];
  setSourceKey: (key: string) => void;
}

const SourceContext = createContext<SourceContextType>({
  sourceKey: SOURCES[0].key,
  source: SOURCES[0],
  availableSources: SOURCES,
  setSourceKey: () => {},
});

export const SourceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  const availableSources = useMemo(() => {
    if (user) {
      // 只有 qishuo 账户能看到 'x' 资源站
      if (user.username === 'qishuo') {
        return SOURCES;
      }
      // 其他已登录用户看到除 'x' 以外的所有资源站
      return SOURCES.filter(s => s.key !== 'x');
    }
    // 未登录用户只能看到 'dytt'
    return SOURCES.filter(s => s.key === 'dytt');
  }, [user]);

  const [sourceKey, setSourceKey] = useState(() => {
    const saved = localStorage.getItem('qstv_source');
    return saved || 'dytt';
  });

  // Ensure selected source is valid within available sources
  useEffect(() => {
    if (loading) return; // Wait until auth state is fully initialized to avoid resetting on refresh
    if (!availableSources.some(s => s.key === sourceKey)) {
      setSourceKey(availableSources[0]?.key || 'dytt');
    }
  }, [loading, availableSources, sourceKey]);

  const handleSetSource = (key: string) => {
    if (availableSources.some(s => s.key === key)) {
      setSourceKey(key);
      localStorage.setItem('qstv_source', key);
    }
  };

  const source = availableSources.find(s => s.key === sourceKey) || availableSources[0] || SOURCES[0];

  return (
    <SourceContext.Provider value={{ sourceKey, source, availableSources, setSourceKey: handleSetSource }}>
      {children}
    </SourceContext.Provider>
  );
};

export const useSource = () => useContext(SourceContext);
