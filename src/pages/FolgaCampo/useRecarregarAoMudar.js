import { useEffect } from 'react';
import { FOLGA_CAMPO_EVENT } from '../../services/folgaCampo';

// Recarrega a tela quando um registro muda em outra tela aberta. Em arquivo
// próprio porque um .jsx que exporta hook junto com componente quebra o fast
// refresh do Vite (mesma razão do hook gêmeo da Ausência Programada).
export function useRecarregarAoMudar(carregar) {
  useEffect(() => {
    window.addEventListener(FOLGA_CAMPO_EVENT, carregar);
    return () => window.removeEventListener(FOLGA_CAMPO_EVENT, carregar);
  }, [carregar]);
}
