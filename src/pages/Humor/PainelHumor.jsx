import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Lock, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  HUMORES, MINIMO_ANONIMATO, resumoPeriodo, diaComDistribuicao, veResumoHumor, veResumoEmpresa,
  veRespostasHumor, filtrarRespostas, humorPorValor,
} from '../../config/humor';
import { diaISO } from '../../config/horasExtras';
import { resumoHumor, respostasHumor } from '../../services/humor';
import CarinhaHumor from '../../components/UI/CarinhaHumor';
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

// Painel do humor. O gestor vê SÓ números da equipe, e o banco esconde a
// distribuição dos dias com menos de MINIMO_ANONIMATO respostas. O RH vê
// também a resposta e o comentário de cada pessoa (desde 02/10/2026) — só as
// marcadas depois que a tela inicial passou a avisar isso; o banco é quem corta.
export default function PainelHumor() {
  const { user } = useAuth();
  const podeEmpresa = veResumoEmpresa(user);
  const [escopo, setEscopo] = useState(podeEmpresa ? 'todos' : 'equipe');
  const [periodo, setPeriodo] = useState(30);
  const [linhas, setLinhas] = useState([]);
  const [respostas, setRespostas] = useState([]);
  const [busca, setBusca] = useState('');
  const [soComentario, setSoComentario] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [foco, setFoco] = useState(null); // dia com o tooltip aberto
  // Filtro do gráfico: clicar numa barra escolhe o dia; num humor da
  // distribuição, o humor. Valem para a tabela e para a lista por pessoa.
  const [diaSel, setDiaSel] = useState(null);
  const [humorSel, setHumorSel] = useState(null);

  const dias = useMemo(() => diasDoPeriodo(periodo), [periodo]);
  // A lista por pessoa é da empresa inteira: em "Minha equipe" ela destoaria
  // dos números acima.
  const verPessoas = veRespostasHumor(user) && escopo === 'todos';

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const intervalo = { de: dias[0], ate: dias[dias.length - 1] };
      const [resumo, pessoas] = await Promise.all([
        resumoHumor({ ...intervalo, escopo }),
        verPessoas ? respostasHumor(intervalo) : [],
      ]);
      setLinhas(resumo);
      setRespostas(pessoas);
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar o resumo.');
    } finally {
      setCarregando(false);
    }
  }, [dias, escopo, verPessoas]);

  useEffect(() => { carregar(); }, [carregar]);
  // Trocou o recorte: o dia escolhido pode nem estar mais no eixo.
  useEffect(() => { setDiaSel(null); setHumorSel(null); }, [periodo, escopo]);

  if (!veResumoHumor(user)) return <Navigate to="/home" replace />;

  const porDia = new Map(linhas.map((l) => [String(l.dia).slice(0, 10), l]));
  const r = resumoPeriodo(linhas);
  const maxDia = Math.max(1, ...linhas.map((l) => l.total || 0));
  const pessoasVisiveis = filtrarRespostas(respostas, { busca, soComentario, dia: diaSel, humor: humorSel });
  const linhasTabela = diaSel ? linhas.filter((l) => String(l.dia).slice(0, 10) === diaSel) : linhas;
  const humorFiltro = humorPorValor(humorSel);
  const temFiltro = !!(diaSel || humorSel);
  const alternarDia = (d) => setDiaSel((v) => (v === d ? null : d));
  const alternarHumor = (valor) => setHumorSel((v) => (v === valor ? null : valor));
  // Dia com respostas mas fora da lista: gravadas quando a tela prometia
  // "só você vê" — continuam só nos números (supabase_migration_humor_individual.sql).
  const diaSoNumeros = !!diaSel && (porDia.get(diaSel)?.total || 0) > 0
    && !respostas.some((p) => String(p.dia).slice(0, 10) === diaSel);
  const chipsFiltro = temFiltro && (
    <div className="hum-filtro-ativo">
      <span>Filtrando pelo gráfico:</span>
      {diaSel && (
        <button type="button" className="hum-chip is-on" onClick={() => setDiaSel(null)}
          aria-label={`Tirar o filtro do dia ${dataCurta(diaSel)}`}>
          Dia {dataCurta(diaSel)} <X size={14} />
        </button>
      )}
      {humorFiltro && (
        <button type="button" className="hum-chip is-on" onClick={() => setHumorSel(null)}
          aria-label={`Tirar o filtro ${humorFiltro.rotulo}`}>
          <CarinhaHumor valor={humorFiltro.valor} size={14} /> {humorFiltro.rotulo} <X size={14} />
        </button>
      )}
      <button type="button" className="hum-limpar" onClick={() => { setDiaSel(null); setHumorSel(null); }}>
        Limpar
      </button>
    </div>
  );

  return (
    <div className="hum-page">
      <header className="hum-header">
        <Link to="/home" className="hum-back"><ArrowLeft size={18} /> Portal</Link>
        <div className="hum-titulos">
          <h1>Humor {escopo === 'todos' ? 'da empresa' : 'da equipe'}</h1>
          <p>
            Como as pessoas marcaram o dia na tela inicial.{' '}
            {verPessoas
              ? 'Os números da empresa e, no fim da página, a resposta de cada pessoa.'
              : 'Aqui só números: a resposta de cada pessoa fica entre ela e o RH.'}
          </p>
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
                  <span key={h.chave}
                    className={`hum-dist-seg ${humorSel && humorSel !== h.valor ? 'is-apagado' : ''}`}
                    style={{ flexGrow: h.total, background: h.cor }}
                    onClick={() => alternarHumor(h.valor)}
                    title={`${h.rotulo}: ${h.total} (${Math.round((h.total / r.contados) * 100)}%) · clique para filtrar`} />
                ))}
              </div>
              <ul className="hum-legenda">
                {r.distribuicao.map((h) => (
                  <li key={h.chave}>
                    <button type="button"
                      className={`hum-legenda-item ${humorSel === h.valor ? 'is-on' : ''} ${humorSel && humorSel !== h.valor ? 'is-apagado' : ''}`}
                      aria-pressed={humorSel === h.valor} onClick={() => alternarHumor(h.valor)}>
                      <CarinhaHumor valor={h.valor} size={18} />
                      {h.rotulo}
                      <strong>{Math.round((h.total / r.contados) * 100)}%</strong>
                    </button>
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
            <div className="hum-barras" role="group" aria-label="Respostas por dia; clique num dia para filtrar">
              {dias.map((d) => {
                const l = porDia.get(d);
                const altura = l ? (l.total / maxDia) * 100 : 0;
                const aberto = l && diaComDistribuicao(l);
                return (
                  <div key={d}
                    className={`hum-barra-col ${l ? 'is-clicavel' : ''} ${diaSel === d ? 'is-sel' : ''} ${diaSel && diaSel !== d ? 'is-apagado' : ''}`}
                    role={l ? 'button' : undefined} aria-pressed={l ? diaSel === d : undefined}
                    aria-label={l ? `${dataCurta(d)}: ${l.total} resposta(s). Clique para filtrar` : undefined}
                    onClick={() => l && alternarDia(d)}
                    onKeyDown={(e) => {
                      if (l && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); alternarDia(d); }
                    }}
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
                          ? HUMORES.map((h) => <span key={h.chave} className="hum-tip-linha"><CarinhaHumor valor={h.valor} size={14} /> {h.rotulo}: {l[h.chave]}</span>)
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

            {chipsFiltro}

            <details className="hum-tabela" open={diaSel ? true : undefined}>
              <summary>Ver os números em tabela</summary>
              <div className="hum-tabela-scroll">
                <table>
                  <thead>
                    <tr><th>Dia</th><th>Respostas</th>{HUMORES.map((h) => <th key={h.chave}>{h.rotulo}</th>)}</tr>
                  </thead>
                  <tbody>
                    {[...linhasTabela].reverse().map((l) => (
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

          {verPessoas && (
            <section className="hum-card">
              <h2>Respostas por pessoa</h2>
              <p className="hum-nota">
                <Lock size={12} /> Só o RH vê esta lista. Entram as respostas marcadas depois que a tela
                inicial passou a avisar que o RH vê a resposta; as anteriores continuam só nos números.
              </p>
              {chipsFiltro}
              {diaSoNumeros && (
                <p className="hum-nota">
                  <Lock size={12} /> As respostas de {dataCurta(diaSel)} foram dadas quando a tela inicial dizia
                  {' '}&quot;Só você vê&quot;: aparecem só nos números do gráfico.
                </p>
              )}
              {respostas.length === 0 ? (
                <p className="hum-sem">Ainda não há respostas por pessoa neste período.</p>
              ) : (
                <>
                  <div className="hum-pessoas-filtros">
                    <input
                      type="search"
                      className="hum-busca"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome"
                      aria-label="Buscar por nome"
                    />
                    <button type="button" className={`hum-chip ${soComentario ? 'is-on' : ''}`}
                      aria-pressed={soComentario} onClick={() => setSoComentario((v) => !v)}>
                      Só com comentário
                    </button>
                  </div>
                  {pessoasVisiveis.length === 0 ? (
                    <p className="hum-sem">Nenhuma resposta com esse filtro.</p>
                  ) : (
                    <div className="hum-tabela-scroll">
                      <table className="hum-pessoas">
                        <thead>
                          <tr><th>Dia</th><th>Pessoa</th><th>Humor</th><th>Comentário</th></tr>
                        </thead>
                        <tbody>
                          {pessoasVisiveis.map((p) => {
                            const h = humorPorValor(p.humor);
                            return (
                              <tr key={`${p.dia}-${p.colaborador_id}`}>
                                <td className="hum-pessoas-dia">{dataCurta(p.dia)}</td>
                                <td>
                                  <strong>{p.nome}</strong>
                                  {p.funcao && <span className="hum-pessoas-funcao">{p.funcao}</span>}
                                </td>
                                <td className="hum-pessoas-humor">
                                  {h && <CarinhaHumor valor={h.valor} size={18} />}
                                  {h?.rotulo}
                                </td>
                                <td className="hum-pessoas-coment">{p.comentario || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
