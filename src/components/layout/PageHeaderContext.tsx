"use client";

import { createContext, useContext, useMemo, useState } from "react";

type PageHeaderContextValue = {
  pageHeader: React.ReactNode | null;
  setPageHeader: (node: React.ReactNode | null) => void;
};

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [pageHeader, setPageHeader] = useState<React.ReactNode | null>(null);

  const value = useMemo(
    () => ({
      pageHeader,
      setPageHeader,
    }),
    [pageHeader]
  );

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeader() {
  const context = useContext(PageHeaderContext);

  if (!context) {
    throw new Error("usePageHeader must be used within a PageHeaderProvider");
  }

  return context;
}
