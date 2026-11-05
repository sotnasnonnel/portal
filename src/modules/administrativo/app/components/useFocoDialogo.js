import { useEffect, useRef } from 'react';

const FOCAVEIS = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Teclado em diálogo: o foco entra quando abre, não vaza para a página de trás
 * e volta para quem abriu quando fecha. Sem isso, quem navega por teclado abria
 * o modal e continuava andando pelos cards escondidos atrás dele.
 *
 * `aoFechar` não precisa ser estável; `seletorInicial` escolhe onde o foco
 * nasce, e sem ele nasce no primeiro controle.
 */
export function useFocoDialogo(aberto, aoFechar, seletorInicial) {
  const refDialogo = useRef(null);
  const refFechar = useRef(aoFechar);
  useEffect(() => { refFechar.current = aoFechar; }, [aoFechar]);

  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.activeElement;
    const dialogo = refDialogo.current;
    const focaveis = () => (dialogo ? [...dialogo.querySelectorAll(FOCAVEIS)] : []);

    const inicial = (seletorInicial && dialogo?.querySelector(seletorInicial)) || focaveis()[0];
    inicial?.focus({ preventScroll: true });

    const aoTeclar = (e) => {
      if (e.key === 'Escape') { refFechar.current?.(); return; }
      if (e.key !== 'Tab') return;
      const lista = focaveis();
      if (!lista.length) return;
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      anterior?.focus?.({ preventScroll: true });
    };
  }, [aberto, seletorInicial]);

  return refDialogo;
}
