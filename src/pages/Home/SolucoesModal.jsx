import { useEffect } from 'react';
import { Blocks, X, ArrowUpRight } from 'lucide-react';
import { SOLUCOES_INTEGRADAS, SOLUCAO_DESTAQUE } from '../../config/solucoesIntegradas';
import './SolucoesModal.css';

/** "https://phdengenharia.milldesk.com/x" -> "phdengenharia.milldesk.com" */
function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Popup com os atalhos para as ferramentas externas da empresa.
 * Abre pelo card "Soluções Integradas" da Home; a lista vem de
 * src/config/solucoesIntegradas.js (fonte única).
 */
export default function SolucoesModal({ onClose }) {
  // Esc fecha e a página atrás não rola enquanto o popup está aberto.
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

  const DestaqueIcon = SOLUCAO_DESTAQUE?.icon;

  return (
    <div className="solmodal-overlay" onClick={onClose}>
      <div
        className="solmodal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="solmodal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="solmodal-head">
          <span className="solmodal-head-icon">
            <Blocks size={20} />
          </span>
          <div className="solmodal-head-txt">
            <h2 id="solmodal-titulo">Soluções Integradas</h2>
            <p>Acesso rápido às ferramentas usadas na empresa. Cada sistema tem o próprio login.</p>
          </div>
          <button type="button" className="solmodal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="solmodal-body">
          {SOLUCAO_DESTAQUE && (
            <a
              className="solmodal-destaque"
              href={SOLUCAO_DESTAQUE.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="solmodal-destaque-icon">
                <DestaqueIcon size={22} />
              </span>
              <span className="solmodal-destaque-txt">
                <strong>{SOLUCAO_DESTAQUE.nome}</strong>
                <small>{SOLUCAO_DESTAQUE.desc}</small>
              </span>
              <span className="solmodal-destaque-cta">
                Acessar <ArrowUpRight size={15} />
              </span>
            </a>
          )}

          <p className="solmodal-secao">Ferramentas</p>

          <ul className="solmodal-lista">
            {SOLUCOES_INTEGRADAS.map((s) => {
              const SIcon = s.icon;
              const conteudo = (
                <>
                  <span className="solmodal-item-icon">
                    <SIcon size={18} />
                  </span>
                  <span className="solmodal-item-txt">
                    <strong>{s.nome}</strong>
                    <small>{s.desc}</small>
                    {s.url && <span className="solmodal-item-dominio">{dominio(s.url)}</span>}
                  </span>
                </>
              );

              // Sem url: item aparece esmaecido, como "Em breve".
              if (!s.url) {
                return (
                  <li key={s.nome}>
                    <span className="solmodal-item solmodal-item-breve" aria-disabled="true">
                      {conteudo}
                      <em>Em breve</em>
                    </span>
                  </li>
                );
              }

              return (
                <li key={s.nome}>
                  <a className="solmodal-item" href={s.url} target="_blank" rel="noopener noreferrer">
                    {conteudo}
                    <ArrowUpRight size={15} className="solmodal-item-seta" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
