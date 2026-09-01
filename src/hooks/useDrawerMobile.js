import { useCallback, useEffect, useState } from 'react';

// Estado do drawer da sidebar no mobile (<=768px, mesmo breakpoint em que o
// PortalHeader mostra o botao de menu). Fica fora das Sidebars porque quem abre
// o drawer e o PortalHeader, renderizado pelos shells — e porque varios shells
// compartilham esta logica: AppShell do Financeiro, AppLayout do Reembolso e
// AppShell da Gestão de Horas.
export function useDrawerMobile() {
  const [aberto, setAberto] = useState(false);

  const alternar = useCallback(() => setAberto((v) => !v), []);
  const fechar = useCallback(() => setAberto(false), []);

  // Trava o scroll do conteudo enquanto o drawer cobre a tela.
  useEffect(() => {
    document.body.style.overflow = aberto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [aberto]);

  // Ao voltar para desktop a sidebar reaparece fixa: se o drawer tivesse ficado
  // "aberto", o overlay continuaria por cima da tela.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setAberto(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return { aberto, alternar, fechar };
}
