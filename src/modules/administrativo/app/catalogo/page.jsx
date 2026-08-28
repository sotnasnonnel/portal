import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronRight } from 'lucide-react';
import { CLASSES_ADM, TODOS_SERVICOS } from '../../../../config/administrativo';

// Busca tolerante a acento e caixa: "manutencao" acha "Manutenção".
const normalizar = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function CatalogoAdm() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  // Classe escolhida no grid -> lista de serviços em MODAL. Antes era uma
  // sanfona: o card crescia no meio do grid, empurrava os vizinhos e a lista
  // nascia embaixo da dobra nas classes com muitos serviços.
  const [classeAberta, setClasseAberta] = useState(null);

  // Esc fecha o modal, como nos outros diálogos do portal.
  useEffect(() => {
    if (!classeAberta) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setClasseAberta(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [classeAberta]);

  const termo = normalizar(busca);
  const resultados = useMemo(() => {
    if (!termo) return [];
    return TODOS_SERVICOS.filter(
      (s) => normalizar(s.label).includes(termo) || normalizar(s.classeLabel).includes(termo)
    );
  }, [termo]);

  const abrir = (classeSlug, servicoSlug) =>
    navigate(`/administrativo/novo/${classeSlug}/${servicoSlug}`);

  // Classe com um serviço só não tem o que escolher: clicar nela vai direto ao
  // formulário, em vez de abrir uma lista com uma opção única.
  const clicarClasse = (c) => {
    if (c.servicos.length === 1) return abrir(c.slug, c.servicos[0].slug);
    return setClasseAberta(c);
  };

  const fechar = () => setClasseAberta(null);

  return (
    <div className="adm-page">
      <h1 className="adm-title">Abrir chamado</h1>
      <p className="adm-sub">Escolha a classe de solicitação e depois o serviço desejado.</p>

      <div className="adm-busca">
        <Search size={18} />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar serviço (ex.: uber, EPI, veículo)"
          aria-label="Buscar serviço"
        />
        {busca && (
          <button type="button" className="adm-busca-limpa" onClick={() => setBusca('')} title="Limpar busca">
            <X size={16} />
          </button>
        )}
      </div>

      {termo ? (
        resultados.length ? (
          <div className="adm-busca-res">
            <ul className="adm-serv-list">
              {resultados.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={`${s.classeSlug}/${s.slug}`}>
                    <button type="button" className="adm-serv" onClick={() => abrir(s.classeSlug, s.slug)}>
                      <span className="adm-serv-ico"><Icon size={18} /></span>
                      <span className="adm-serv-txt">
                        <strong>{s.label}</strong>
                        <small>{s.classeLabel}</small>
                      </span>
                      <ChevronRight className="adm-serv-seta" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="adm-vazio">Nenhum serviço encontrado para “{busca}”.</div>
        )
      ) : (
        <div className="adm-cat-grid">
          {CLASSES_ADM.map((c) => {
            const Icon = c.icon;
            const unico = c.servicos.length === 1;
            return (
              <div key={c.slug} className="adm-cat-card">
                <button
                  type="button"
                  className="adm-cat-head"
                  onClick={() => clicarClasse(c)}
                  aria-haspopup={unico ? undefined : 'dialog'}
                >
                  <span className="adm-cat-ico"><Icon size={22} /></span>
                  <span className="adm-cat-txt">
                    <strong>{c.label}</strong>
                    <small>{unico ? 'Abrir direto' : `${c.servicos.length} serviços`}</small>
                  </span>
                  <ChevronRight className="adm-cat-chev" size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Serviços da classe: modal em vez de sanfona. Reusa a casca do
          GuiaModal (guia-overlay/guia-modal), como a ajuda de prazos. */}
      {classeAberta && (
        <div className="guia-overlay" onClick={fechar}>
          <div
            className="guia-modal adm-serv-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adm-serv-modal-tit"
          >
            <div className="guia-head">
              <span className="guia-eyebrow">Abrir chamado</span>
              <button className="guia-close" onClick={fechar} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="adm-serv-modal-corpo">
              <div className="adm-serv-modal-cab">
                <span className="adm-cat-ico"><classeAberta.icon size={22} /></span>
                <div>
                  <h3 id="adm-serv-modal-tit">{classeAberta.label}</h3>
                  <p>Escolha o serviço desejado.</p>
                </div>
              </div>

              <ul className="adm-serv-list">
                {classeAberta.servicos.map((s) => (
                  <li key={s.slug}>
                    <button
                      type="button"
                      className="adm-serv"
                      onClick={() => abrir(classeAberta.slug, s.slug)}
                    >
                      <span className="adm-serv-txt"><strong>{s.label}</strong></span>
                      <ChevronRight className="adm-serv-seta" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
