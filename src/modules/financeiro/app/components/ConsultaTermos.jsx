import { useMemo, useState } from 'react';
import { ScrollText, X, Search, AlertTriangle, SearchX } from 'lucide-react';
import { listarTermosFin } from '../../../../config/financeiroTermos';

/**
 * Consulta dos Termos de Uso e Responsabilidade do Financeiro.
 *
 * O aceite acontece uma vez, no envio da solicitação — depois disso a pessoa
 * não tinha por onde reler o que aceitou. Aqui ficam TODOS os termos do módulo,
 * com busca por palavra (ex.: "prestação", "auditoria", "vigência"), aberta
 * pelo botão ao lado do "?" da barra superior.
 *
 * As cláusulas destacadas (config/financeiroTermos.js) mantêm o destaque, como
 * no popup do aceite.
 */

// Busca sem acento e sem caixa: "prestacao" acha "Prestação de contas diária".
const normalizar = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export default function ConsultaTermos() {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const termos = useMemo(() => listarTermosFin(), []);

  // Filtra por cláusula (título + texto) e também pelo título do termo, para
  // "cartão" trazer o documento inteiro em vez de nada.
  const resultado = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return termos;
    return termos
      .map((t) => {
        if (normalizar(t.titulo).includes(q)) return t;
        return { ...t, itens: t.itens.filter(([tit, txt]) => normalizar(`${tit} ${txt}`).includes(q)) };
      })
      .filter((t) => t.itens.length > 0);
  }, [termos, busca]);

  const nada = resultado.length === 0;

  const fechar = () => { setAberto(false); setBusca(''); };

  return (
    <>
      <button
        type="button"
        className="portal-header-help"
        onClick={() => setAberto(true)}
        aria-label="Consultar os Termos de Uso e Responsabilidade"
        title="Termos de uso"
      >
        <ScrollText size={20} />
      </button>

      {aberto && (
        <div className="guia-overlay" onClick={fechar}>
          <div
            className="guia-modal fin-termos-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fin-termos-tit"
          >
            <div className="guia-head">
              <span className="guia-eyebrow">Termos de uso</span>
              <button className="guia-close" onClick={fechar} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="fin-termos-corpo">
              <h3 id="fin-termos-tit">Termos de Uso e Responsabilidade do Financeiro</h3>
              <p className="fin-termos-intro">
                O que você aceita ao enviar cada solicitação. Continua valendo depois do
                aceite — use a busca para achar uma cláusula específica.
              </p>

              <div className="fin-termos-busca">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por palavra (ex.: prestação de contas, auditoria, vigência)"
                  aria-label="Buscar nos termos"
                />
              </div>

              {nada ? (
                <div className="fin-termos-vazio">
                  <SearchX size={15} /> Nenhuma cláusula encontrada para “{busca.trim()}”.
                </div>
              ) : (
                resultado.map((t) => (
                  <section key={t.tipo} className="fin-termos-doc">
                    <h4>{t.titulo}</h4>
                    <ul className="fin-termos-lista">
                      {t.itens.map(([tit, txt, destaque]) => (
                        <li key={tit} className={destaque ? 'is-destaque' : ''}>
                          {destaque && <AlertTriangle size={13} aria-hidden="true" />}
                          <span><strong>{tit}:</strong> {txt}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
