import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SearchX, X, ChevronRight } from 'lucide-react';
import { CLASSES_ADM, TODOS_SERVICOS } from '../../../../config/administrativo';
import { useFocoDialogo } from '../components/useFocoDialogo';
import { Vazio } from '../components/ui';

// Busca tolerante a acento e caixa: "manutencao" acha "Manutenção".
const normalizar = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// A saída de quem não acha o que procura: existe para isso.
const SERVICO_GENERICO = { classe: 'outras-demandas', servico: 'outras-demandas' };

export default function CatalogoAdm() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const inputBusca = useRef(null);
  // Classe escolhida no grid -> lista de serviços em MODAL. Antes era uma
  // sanfona: o card crescia no meio do grid, empurrava os vizinhos e a lista
  // nascia embaixo da dobra nas classes com muitos serviços.
  const [classeAberta, setClasseAberta] = useState(null);

  const fechar = () => setClasseAberta(null);
  // Esc fecha o modal, como nos outros diálogos do portal.
  const refModal = useFocoDialogo(!!classeAberta, fechar, '.adm-serv');

  // Quem chega aqui já sabe o que quer: dá para digitar direto. Só onde há
  // teclado físico; no celular o foco abriria o teclado por cima dos cards.
  useEffect(() => {
    if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
      inputBusca.current?.focus({ preventScroll: true });
    }
  }, []);

  const termo = normalizar(busca);
  const resultados = useMemo(() => {
    if (!termo) return [];
    // Palavra a palavra: "reserva veiculo" acha "Reserva de veículos", que como
    // texto corrido não bateria por causa do "de" no meio.
    const palavras = termo.split(/\s+/);
    return TODOS_SERVICOS.filter((s) => {
      const alvo = `${normalizar(s.label)} ${normalizar(s.classeLabel)}`;
      return palavras.every((p) => alvo.includes(p));
    });
  }, [termo]);

  const abrir = (classeSlug, servicoSlug) =>
    navigate(`/administrativo/novo/${classeSlug}/${servicoSlug}`);

  // Classe com um serviço só não tem o que escolher: clicar nela vai direto ao
  // formulário, em vez de abrir uma lista com uma opção única.
  const clicarClasse = (c) => {
    if (c.servicos.length === 1) return abrir(c.slug, c.servicos[0].slug);
    return setClasseAberta(c);
  };

  // Enter abre o primeiro resultado: "uber" + Enter já é o caminho inteiro.
  const enviarBusca = (e) => {
    e.preventDefault();
    if (resultados[0]) abrir(resultados[0].classeSlug, resultados[0].slug);
  };

  const limpar = () => {
    setBusca('');
    inputBusca.current?.focus();
  };

  return (
    <div className="adm-page">
      <h1 className="adm-title">Abrir chamado</h1>
      <p className="adm-sub">Busque pelo que você precisa ou escolha uma área.</p>

      <form className="adm-busca" role="search" onSubmit={enviarBusca}>
        <Search size={18} aria-hidden="true" />
        <input
          ref={inputBusca}
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' && busca) limpar(); }}
          placeholder="Buscar serviço (ex.: uber, EPI, veículo)"
          aria-label="Buscar serviço"
        />
        {busca && (
          <button type="button" className="adm-busca-limpa" onClick={limpar} aria-label="Limpar busca" title="Limpar busca">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </form>

      {/* A lista troca enquanto a pessoa digita: quem usa leitor de tela só
          sabe que algo mudou se a contagem for anunciada. */}
      {termo && resultados.length > 0 && (
        <p className="adm-busca-cont" role="status">
          {resultados.length === 1 ? '1 serviço encontrado' : `${resultados.length} serviços encontrados`}
          <span className="adm-busca-dica"> · Enter abre o primeiro</span>
        </p>
      )}

      {termo ? (
        resultados.length ? (
          <div className="adm-busca-res">
            <ul className="adm-serv-list">
              {resultados.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={`${s.classeSlug}/${s.slug}`}>
                    <button type="button" className="adm-serv" onClick={() => abrir(s.classeSlug, s.slug)}>
                      <span className="adm-serv-ico"><Icon size={18} aria-hidden="true" /></span>
                      <span className="adm-serv-txt">
                        <strong>{s.label}</strong>
                        <small>{s.classeLabel}</small>
                      </span>
                      <ChevronRight className="adm-serv-seta" size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <Vazio
            Icon={SearchX}
            titulo={`Nada encontrado para “${busca.trim()}”`}
            acao={(
              <button
                type="button"
                className="adm-btn adm-btn-ghost"
                onClick={() => abrir(SERVICO_GENERICO.classe, SERVICO_GENERICO.servico)}
              >
                Abrir em Outras demandas
              </button>
            )}
          >
            Tente outra palavra. Se o pedido não for nenhum serviço do catálogo, abra em Outras
            demandas e descreva o que precisa.
          </Vazio>
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
                  <span className="adm-cat-ico"><Icon size={22} aria-hidden="true" /></span>
                  <span className="adm-cat-txt">
                    <strong>{c.label}</strong>
                    {/* Os nomes, e não "5 serviços": a contagem não ajuda a
                        decidir se o que a pessoa procura está ali dentro. */}
                    <small>{unico ? 'Abre o formulário direto' : c.servicos.map((s) => s.label).join(' · ')}</small>
                  </span>
                  <ChevronRight className="adm-cat-chev" size={18} aria-hidden="true" />
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
            ref={refModal}
            className="guia-modal adm-serv-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adm-serv-modal-tit"
          >
            <div className="guia-head">
              <span className="guia-eyebrow">Abrir chamado</span>
              <button type="button" className="guia-close" onClick={fechar} aria-label="Fechar">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="adm-serv-modal-corpo">
              <div className="adm-serv-modal-cab">
                <span className="adm-cat-ico"><classeAberta.icon size={22} aria-hidden="true" /></span>
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
                      <ChevronRight className="adm-serv-seta" size={16} aria-hidden="true" />
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
