import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  HUMORES, MINIMO_ANONIMATO, resumoPeriodo, diaComDistribuicao, veResumoHumor, veResumoEmpresa,
} from '../../config/humor';
import { diaISO } from '../../config/horasExtras';
import { resumoHumor } from '../../services/humor';
import './PainelHumor.css';

const PERIODOS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']];
const dataCurta = (iso) => String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7);

/** Os dias do período, inclusive os sem resposta — buraco no eixo engana. */
function diasDoPeriodo(n) {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    out.push(diaISO(x));
  }
  return out;
}

// Painel do humor: SÓ números agregados, sem nome (decisão do usuário,
// 30/09/2026). O banco esconde a distribuição dos dias com menos de
// MINIMO_ANONIMATO respostas; aqui eles aparecem só com o total.
export default function PainelHumor() {
  const { user } = useAuth();
  const podeEmpresa = veResumoEmpresa(user);
  const [escopo, setEscopo] = useState(podeEmpresa ? 'todos' : 'equipe');
  const [periodo, setPeriodo] = useState(30);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [foco, setFoco] = useState(null); // dia com o tooltip aberto

  const dias = useMemo(() => diasDoPeriodo(periodo), [periodo]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setLinhas(await resumoHumor({ de: dias[0], ate: dias[dias.length - 1], escopo }));
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar o resumo.');
    } finally {
      setCarregando(false);
    }
  }, [dias, escopo]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!veResumoHumor(user)) return <Navigate to="/home" replace />;

  const porDia = new Map(linhas.map((l) => [String(l.dia).slice(0, 10), l]));
  const r = resumoPeriodo(linhas);
  const maxDia = Math.max(1, ...linhas.map((l) => l.total || 0));

  return (
    <div className="hum-page">
      <header className="hum-header">
        <Link to="/home" className="hum-back"><ArrowLeft size={18} /> Portal</Link>
        <div className="hum-titulos">
          <h1>Humor {escopo === 'todos' ? 'da empresa' : 'da equipe'}</h1>
          <p>Como as pessoas marcaram o dia na tela inicial. Só números: ninguém vê a resposta de outra pessoa.</p>
        </div>
      </header>

      <div className="hum-filtros">
        {podeEmpresa && (
          <div className="hum-grupo" role="group" aria-label="De quem">
            {[['todos', 'Empresa'], ['equipe', 'Minha equipe']].map(([v, l]) => (
              <button key={v} type="button" className={`hum-chip ${escopo === v ? 'is-on' : ''}`}
                aria-pressed={escopo === v} onClick={() => setEscopo(v)}>{l}</button>
            ))}
          </div>
        )}
        <div className="hum-grupo" role="group" aria-label="Período">
          {PERIODOS.map(([v, l]) => (
            <button key={v} type="button" className={`hum-chip ${periodo === v ? 'is-on' : ''}`}
              aria-pressed={periodo === v} onClick={() => setPeriodo(v)}>{l}</button>
          ))}
        </div>
      </div>

      {erro && <div className="hum-aviso"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="hum-vazio"><Loader2 size={20} className="hum-spin" /> Carregando…</div>
      ) : r.respostas === 0 ? (
        <div className="hum-vazio">Ninguém marcou o humor neste período ainda.</div>
      ) : (
        <>
          {/* Os números são a leitura principal: tiles, não gráfico. */}
          <div className="hum-tiles">
            <div className="hum-tile">
              <span className="hum-tile-rot">Respostas</span>
              <strong className="hum-tile-num">{r.respostas}</strong>
              <span className="hum-tile-pe">nos últimos {periodo} dias</span>
            </div>
            <div className="hum-tile">
              <span className="hum-tile-rot">Humor médio</span>
              <strong className="hum-tile-num">{r.media === null ? '—' : String(r.media).replace('.', ',')}</strong>
              <span className="hum-tile-pe">de 1 (muito mal) a 5 (muito feliz)</span>
            </div>
            <div className="hum-tile">
              <span className="hum-tile-rot">Feliz ou muito feliz</span>
              <strong className="hum-tile-num">{r.pctBem === null ? '—' : `${r.pctBem}%`}</strong>
              <span className="hum-tile-pe">das respostas contadas</span>
            </div>
            <div className="hum-tile">
              <span className="hum-tile-rot">Triste ou muito mal</span>
              <strong className="hum-tile-num">{r.pctMal === null ? '—' : `${r.pctMal}%`}</strong>
              <span className="hum-tile-pe">das respostas contadas</span>
            </div>
          </div>

          {r.contados > 0 && (
            <section className="hum-card">
              <h2>Distribuição no período</h2>
              <div className="hum-dist" role="img"
                aria-label={r.distribuicao.map((h) => `${h.rotulo}: ${h.total}`).join(', ')}>
                {r.distribuicao.filter((h) => h.total > 0).map((h) => (
                  <span key={h.chave} className="hum-dist-seg"
                    style={{ flexGrow: h.total, background: h.cor }}
                    title={`${h.rotulo}: ${h.total} (${Math.round((h.total / r.contados) * 100)}%)`} />
                ))}
              </div>
              <ul className="hum-legenda">
                {r.distribuicao.map((h) => (
                  <li key={h.chave}>
                    <i style={{ background: h.cor }} aria-hidden="true" />
                    {h.emoji} {h.rotulo}
                    <strong>{Math.round((h.total / r.contados) * 100)}%</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="hum-card">
            <h2>Dia a dia</h2>
            <p className="hum-nota">
              <Lock size={12} /> Dias com menos de {MINIMO_ANONIMATO} respostas aparecem só com o total, em
              cinza tracejado: com tão poucas, daria para saber quem respondeu o quê.
            </p>
            <div className="hum-barras" role="img" aria-label="Respostas por dia; a tabela abaixo tem os números">
              {dias.map((d) => {
                const l = porDia.get(d);
                const altura = l ? (l.total / maxDia) * 100 : 0;
                const aberto = l && diaComDistribuicao(l);
                return (
                  <div key={d} className="hum-barra-col"
                    onMouseEnter={() => setFoco(d)} onMouseLeave={() => setFoco(null)}
                    onFocus={() => setFoco(d)} onBlur={() => setFoco(null)} tabIndex={l ? 0 : -1}>
                    <div className={`hum-barra ${l && !aberto ? 'is-oculta' : ''}`} style={{ height: `${altura}%` }}>
                      {aberto && [...HUMORES].reverse().map((h) => (l[h.chave] > 0 ? (
                        <span key={h.chave} style={{ flexGrow: l[h.chave], background: h.cor }} />
                      ) : null))}
                    </div>
                    {foco === d && l && (
                      <div className="hum-tip" role="tooltip">
                        <strong>{dataCurta(d)} · {l.total} resposta{l.total === 1 ? '' : 's'}</strong>
                        {aberto
                          ? HUMORES.map((h) => <span key={h.chave}>{h.emoji} {h.rotulo}: {l[h.chave]}</span>)
                          : <span>Poucas respostas: distribuição oculta.</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="hum-eixo" aria-hidden="true">
              <span>{dataCurta(dias[0])}</span><span>{dataCurta(dias[dias.length - 1])}</span>
            </div>

            <details className="hum-tabela">
              <summary>Ver os números em tabela</summary>
              <div className="hum-tabela-scroll">
                <table>
                  <thead>
                    <tr><th>Dia</th><th>Respostas</th>{HUMORES.map((h) => <th key={h.chave}>{h.rotulo}</th>)}</tr>
                  </thead>
                  <tbody>
                    {[...linhas].reverse().map((l) => (
                      <tr key={l.dia}>
                        <td>{dataCurta(l.dia)}</td>
                        <td>{l.total}</td>
                        {HUMORES.map((h) => <td key={h.chave}>{diaComDistribuicao(l) ? l[h.chave] : '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
