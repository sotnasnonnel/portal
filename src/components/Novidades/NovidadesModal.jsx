import { useEffect } from 'react';
import { Megaphone, X, Sparkles, ArrowRight, MousePointerClick } from 'lucide-react';
import { formatarData } from '../../utils/formatters';
import { tutorialDasNovidades } from '../../config/novidades';
import './Novidades.css';

/**
 * "O que mudou na plataforma", aberto pela Home.
 *
 * Duas entradas, o mesmo componente:
 * - sozinho, no primeiro acesso depois de uma versão nova (só o que a pessoa
 *   ainda não viu), e aí fechar carimba a versão como vista;
 * - pelo botão "Novidades" da barra, que reabre o histórico a qualquer momento.
 *
 * É um aviso que aparece UMA vez: quem fecha sem entender não volta. Por isso
 * cada mudança é MOSTRADA além de escrita — a fita "PMO → Dados" e os
 * mini-cartões das áreas dizem em um olhar o que o parágrafo leva três linhas
 * para dizer. O conteúdo vem de config/novidades.js; aqui só se desenha.
 *
 * Versão com `tutorial` (um passo a passo na tela): no aviso automático o
 * botão do rodapé vira "Ver como funciona", mas fechar continua sendo só
 * `onClose` — é a Home que emenda o passo a passo, por qualquer caminho de
 * fechar. No histórico, a versão ganha o botão "Ver o passo a passo", que
 * chama `onTutorial(id)`.
 */
export default function NovidadesModal({ novidades = [], historico = false, onClose, onTutorial }) {
  // Esc fecha e a página atrás não rola enquanto o aviso está aberto.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowAnterior;
    };
  }, [onClose]);

  if (!novidades.length) return null;

  // Com UMA versão (o caso normal), a data dela é a manchete: resumir num
  // título o que a lista logo abaixo já mostra era dizer a mesma coisa duas
  // vezes. Com várias (histórico), o hero fica genérico e cada versão leva a
  // sua data no corpo.
  const unica = novidades.length === 1 ? novidades[0] : null;
  const totalItens = novidades.reduce((n, v) => n + v.itens.length, 0);
  // Só o aviso que abriu sozinho emenda no passo a passo ao fechar.
  const tutorial = historico ? null : tutorialDasNovidades(novidades);

  return (
    <div className="novid-overlay" onClick={onClose}>
      <div
        className="novid-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="novid-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="novid-hero">
          <button type="button" className="novid-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>

          <span className="novid-hero-icon">
            <Megaphone size={17} />
          </span>

          {/* Data e contagem na MESMA linha: são duas etiquetas do mesmo fato,
              e empilhadas viravam três alturas de cabeçalho antes da primeira
              mudança — que é o que a pessoa abriu o aviso para ler. */}
          <div className="novid-hero-txt">
            <span className="novid-eyebrow">Novidades</span>
            <div className="novid-hero-linha">
              <h2 id="novid-titulo">{unica ? formatarData(unica.data) : 'O que mudou por aqui'}</h2>
              <span className="novid-hero-sub">
                {totalItens} {totalItens === 1 ? 'mudança' : 'mudanças'}
              </span>
            </div>
          </div>
        </header>

        <div className="novid-body">
          {novidades.map((versao) => (
            <section key={versao.id} className="novid-versao">
              {/* Só no histórico: com uma versão só, a data já está no hero. */}
              {!unica && (
                <div className="novid-versao-head">
                  <h3>{formatarData(versao.data)}</h3>
                  <span className="novid-data">
                    {versao.itens.length} {versao.itens.length === 1 ? 'mudança' : 'mudanças'}
                  </span>
                </div>
              )}

              <ul className="novid-itens">
                {versao.itens.map((item) => {
                  const Icon = item.icon || Sparkles;
                  return (
                    <li key={item.titulo} className="novid-item">
                      <span className="novid-item-icon">
                        <Icon size={20} />
                      </span>

                      <div className="novid-item-txt">
                        {/* Título e os dois selos na MESMA linha: em linhas
                            separadas eram dois blocos de badge empilhados, e o
                            texto começava três alturas abaixo do título. */}
                        <div className="novid-item-head">
                          <strong>{item.titulo}</strong>
                          {item.marca && <span className="novid-marca">{item.marca}</span>}
                          {item.modulo && <span className="novid-chip">{item.modulo}</span>}
                        </div>
                        <p>{item.texto}</p>

                        {/* Renomeação: os dois nomes lado a lado. */}
                        {item.de && item.para && (
                          <div className="novid-de-para">
                            <span className="novid-nome novid-nome-antes">{item.de}</span>
                            <ArrowRight size={15} className="novid-seta" aria-label="virou" />
                            <span className="novid-nome novid-nome-depois">{item.para}</span>
                          </div>
                        )}

                        {/* Prévia do que a pessoa vai encontrar na tela. */}
                        {item.opcoes?.length > 0 && (
                          <div className="novid-opcoes">
                            {item.opcoes.map((op) => {
                              const OpIcon = op.icon || Sparkles;
                              return (
                                <span key={op.label} className="novid-opcao">
                                  <OpIcon size={16} />
                                  {op.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Fora do cabeçalho da versão, que some quando a lista tem
                  uma versão só: o botão tem de aparecer nos dois casos. */}
              {historico && versao.tutorial && onTutorial && (
                <button type="button" className="novid-tutorial" onClick={() => onTutorial(versao.tutorial)}>
                  <MousePointerClick size={15} aria-hidden="true" />
                  Ver o passo a passo do Feed
                </button>
              )}
            </section>
          ))}
        </div>

        <footer className="novid-footer">
          {/* O rodapé avisa o que vem depois de fechar: quem esperava só um
              "Entendi" não leva susto com o destaque na tela. */}
          {tutorial && <span className="novid-footer-dica">Um passo a passo mostra onde clicar.</span>}
          <button type="button" className="novid-btn" onClick={onClose}>
            {tutorial ? <>Ver como funciona <ArrowRight size={16} aria-hidden="true" /></> : historico ? 'Fechar' : 'Entendi'}
          </button>
        </footer>
      </div>
    </div>
  );
}
