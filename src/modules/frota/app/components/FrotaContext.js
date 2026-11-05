import { createContext, useContext } from 'react';

export const FrotaContext = createContext(null);

export const useFrota = () => useContext(FrotaContext);
