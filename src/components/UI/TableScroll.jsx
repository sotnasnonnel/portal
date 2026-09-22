import { useEffect, useRef, useState } from 'react';

/**
 * Contêiner de tabela com rolagem horizontal e uma segunda barra espelhada
 * ACIMA da tabela.
 *
 * Numa tabela larga, a barra de baixo só aparece depois de rolar a página até o
 * fim — quem está lendo o cabeçalho não tem como saber que existem colunas à
 * direita. A barra de cima resolve isso sem duplicar a tabela: ela é uma div
 * vazia com a largura do conteúdo real, e os dois lados trocam `scrollLeft`.
 *
 * A barra de cima só é montada quando há transbordo de verdade, então tabela
 * que cabe na tela continua exatamente como era.
 *
 * Substitui a div de classe `table-scroll`. Aceita className extra e demais
 * props, que vão para o contêiner de baixo (o que realmente rola).
 */
export default function TableScroll({ children, className = '', ...resto }) {
  const cimaRef = useRef(null);
  const baixoRef = useRef(null);
  const [larguraConteudo, setLarguraConteudo] = useState(0); // 0 = sem transbordo, barra oculta

  useEffect(() => {
    const el = baixoRef.current;
    if (!el) return undefined;
    const medir = () => setLarguraConteudo(el.scrollWidth > el.clientWidth ? el.scrollWidth : 0);
    medir();
    // Observa o contêiner e a tabela: a largura muda ao filtrar, ao trocar de
    // aba e ao redimensionar a janela.
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [children]);

  // Cada lado só empurra o outro; o onScroll que isso dispara reescreve o mesmo
  // valor e para aí, sem laço.
  const daCima = () => {
    if (baixoRef.current && cimaRef.current) baixoRef.current.scrollLeft = cimaRef.current.scrollLeft;
  };
  const daBaixo = () => {
    if (baixoRef.current && cimaRef.current) cimaRef.current.scrollLeft = baixoRef.current.scrollLeft;
  };

  return (
    <>
      {larguraConteudo > 0 && (
        <div className="table-scroll-top" ref={cimaRef} onScroll={daCima} aria-hidden="true">
          <div style={{ width: larguraConteudo }} />
        </div>
      )}
      <div className={`table-scroll ${className}`.trim()} ref={baixoRef} onScroll={daBaixo} {...resto}>
        {children}
      </div>
    </>
  );
}
