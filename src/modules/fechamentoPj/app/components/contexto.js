import { createContext, useContext } from 'react';

// Fora do Shell para não quebrar o fast refresh.
export const FechamentoPjContext = createContext(null);

export function useFechamentoPj() {
  const ctx = useContext(FechamentoPjContext);
  if (!ctx) throw new Error('useFechamentoPj fora do FechamentoPjShell');
  return ctx;
}
