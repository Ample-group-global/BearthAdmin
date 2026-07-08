'use client';
import { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

interface LayerFilesCtx {
  getBlobUrl: (rel: string) => string | null;
  storeFiles: (fileMap: Map<string, File>) => void;
  hasFiles: () => boolean;
}

const Ctx = createContext<LayerFilesCtx>({
  getBlobUrl: () => null,
  storeFiles: () => {},
  hasFiles: () => false,
});

export function LayerFilesProvider({ children }: { children: ReactNode }) {
  const urlMap = useRef(new Map<string, string>());

  const storeFiles = useCallback((fileMap: Map<string, File>) => {
    urlMap.current.forEach(u => URL.revokeObjectURL(u));
    urlMap.current.clear();
    fileMap.forEach((file, rel) => {
      urlMap.current.set(rel, URL.createObjectURL(file));
    });
  }, []);

  const getBlobUrl = useCallback((rel: string) => urlMap.current.get(rel) ?? null, []);
  const hasFiles   = useCallback(() => urlMap.current.size > 0, []);

  return (
    <Ctx.Provider value={{ getBlobUrl, storeFiles, hasFiles }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLayerFiles = () => useContext(Ctx);
