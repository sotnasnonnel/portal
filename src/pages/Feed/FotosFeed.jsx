import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fotosDoFeed } from '../../services/feed';
import { FotosCtx } from './fotosFeedCtx';

// Fotos de quem aparece no feed (posts, comentários e o próprio leitor), vindas
// do hub/Microsoft 365 pela Edge Function fotos-aniversariantes ({ feed: ids }).
// Cada avatar pede a sua; os pedidos que chegam juntos viram UMA chamada, e
// quem já foi perguntado (com ou sem foto) não é pedido de novo.

export function FotosFeedProvider({ children }) {
  const [fotos, setFotos] = useState({});
  const perguntados = useRef(new Set());
  const fila = useRef(new Set());
  const timer = useRef(null);

  const descarregar = useCallback(async () => {
    timer.current = null;
    const ids = [...fila.current];
    fila.current.clear();
    for (let i = 0; i < ids.length; i += 60) {
      const lote = ids.slice(i, i + 60);
      const r = await fotosDoFeed(lote);
      if (Object.keys(r).length) setFotos((v) => ({ ...v, ...r }));
    }
  }, []);

  const pedir = useCallback((id) => {
    if (!id || perguntados.current.has(id)) return;
    perguntados.current.add(id);
    fila.current.add(id);
    if (!timer.current) timer.current = setTimeout(descarregar, 60);
  }, [descarregar]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const valor = useMemo(() => ({ fotos, pedir }), [fotos, pedir]);
  return <FotosCtx.Provider value={valor}>{children}</FotosCtx.Provider>;
}
