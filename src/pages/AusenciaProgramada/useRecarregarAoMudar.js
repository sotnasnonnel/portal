import { useEffect } from 'react';
import { AUSENCIA_EVENT } from '../../services/ausenciaProgramada';

// Recarrega a tela quando um pedido muda em outra tela aberta.
export function useRecarregarAoMudar(carregar) {
  useEffect(() => {
    window.addEventListener(AUSENCIA_EVENT, carregar);
    return () => window.removeEventListener(AUSENCIA_EVENT, carregar);
  }, [carregar]);
}
