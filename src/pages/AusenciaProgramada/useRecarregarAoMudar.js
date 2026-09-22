import { useEffect } from 'react';

// Recarrega a tela quando um pedido muda em outra tela aberta. `evento` é o do
// módulo (config/modulosAusencia.js): a ausência não recarrega por causa de uma
// folga de campo, e vice-versa.
export function useRecarregarAoMudar(evento, carregar) {
  useEffect(() => {
    window.addEventListener(evento, carregar);
    return () => window.removeEventListener(evento, carregar);
  }, [evento, carregar]);
}
