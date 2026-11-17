import { createContext, useContext } from 'react';

export const TiContext = createContext(null);

export const useTi = () => useContext(TiContext);
