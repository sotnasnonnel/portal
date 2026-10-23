import { createContext, useContext, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// Contexto das fotos de perfil do feed (o provider está em FotosFeed.jsx).
export const FotosCtx = createContext({ fotos: {}, pedir: () => {} });

/** URL da foto de um colaborador (null enquanto não chega ou se não tiver). */
export function useFotoFeed(id) {
  const { fotos, pedir } = useContext(FotosCtx);
  // A própria foto já está na sessão (a mesma da bolinha do menu, ver
  // services/fotoMicrosoft.js): vem do login e cobre quem o hub não tem.
  const { user, fotoUrl } = useAuth();
  const eu = !!id && id === user?.id;
  useEffect(() => { if (!(eu && fotoUrl)) pedir(id); }, [id, eu, fotoUrl, pedir]);
  if (eu && fotoUrl) return fotoUrl;
  return id ? fotos[id] || null : null;
}
