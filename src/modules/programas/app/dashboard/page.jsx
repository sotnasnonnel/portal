import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, LayoutDashboard, Loader2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  CATEGORIAS, CATEGORIA_LABEL, SETORES, SITUACOES, SITUACAO_LABEL,
  corDoSetor, ehAdminProgramas,
} from '../../../../config/programas';
import { COR_FORMA } from '../../lib/paleta';
import { listarIdeias, atualizarSituacao, atualizarIdeia } from '../../lib/ideias';
import { resumoIdeias } from '../../lib/indicadores';
import { DetalheIdeia } from '../components/Detalhe';

/**
 * Dashboard do Campo de Ideias — item 4 da planilha, "Liberado para todos".
 *
 * Tela de LEITURA: os números do programa inteiro, de todo mundo. Quem quer
 * registrar vai em "Campo de Ideias", que é a tela de participação — mesma
 * divisão do outro programa ("Alavanca PHD" x "Painel da Alavanca"). Misturar
 * as duas faz "Dashboard" virar ao mesmo tempo onde se olha e onde se cadastra.
 *
 * Os quatro blocos da planilha, na ordem dela: card, gráfico por setor, kanban
 * por tipo (com as duas legendas) e o mapa com atualizar status.
 *
 * Os FILTROS (setor, tipo e situação) valem para os quatro ao mesmo tempo: um
 * filtro que muda a tabela mas não o gráfico faz os dois se contradizerem na
 * mesma tela. O card mostra o recorte e diz de quanto ele saiu.
 */

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export default function DashboardIdeias() {
  const { user, modules } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState('');
  const [detalhe, setDetalhe] = useState(null);

  const [fSetor, setFSetor] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fSituacao, setFSituacao] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setLinhas(await listarIdeias());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => linhas.filter(
    (l) => (!fSetor || l.setor === fSetor)
      && (!fTipo || l.categoria === fTipo)
      && (!fSituacao || l.situacao === fSituacao)
  ), [linhas, fSetor, fTipo, fSituacao]);

  const r = useMemo(() => resumoIdeias(filtradas), [filtradas]);
  const maiorSetor = Math.max(1, ...r.porSetor.map((s) => s.total));
  const souAdmin = ehAdminProgramas(modules);
  const filtrando = Boolean(fSetor || fTipo || fSituacao);

  const salvarEdicao = async (registro, valores) => {
    const atualizado = await atualizarIdeia(registro, valores, user.id);
    setLinhas((atual) => atual.map((l) => (l.id === registro.id ? atualizado : l)));
    // O popup continua aberto mostrando o registro salvo, não o antigo.
    setDetalhe(atualizado);
  };

  const trocarSituacao = async (registro, nova) => {
    setSalvando(registro.id);
    setErro('');
    try {
      const atualizado = await atualizarSituacao(registro, nova, user.id);
      setLinhas((atual) => atual.map((l) => (l.id === registro.id ? atualizado : l)));
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando('');
    }
  };

  return (
    <div className="pg-page pg-page-full">
      <h1 className="pg-title"><LayoutDashboard size={24} /> Dashboard</h1>
      <p className="pg-sub">Campo de Ideias — o que a PHD está inventando.</p>


      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="pg-vazio">
          Nada registrado ainda.{' '}
          <Link className="pg-link" to="/programas/ideias">Registrar a primeira ideia</Link>.
        </div>
      ) : (
        <>
          {/* ---- filtros: valem para todos os blocos abaixo ---- */}
          <div className="pg-filtros">
            <div className="pg-filtro">
              <label htmlFor="f-setor">Setor</label>
              <select id="f-setor" className="pg-select" value={fSetor} onChange={(e) => setFSetor(e.target.value)}>
                <option value="">Todos</option>
                {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="pg-filtro">
              <label htmlFor="f-tipo">Tipo</label>
              <select id="f-tipo" className="pg-select" value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
                <option value="">Todos</option>
                {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
              </select>
            </div>
            <div className="pg-filtro">
              <label htmlFor="f-situacao">Status</label>
              <select id="f-situacao" className="pg-select" value={fSituacao} onChange={(e) => setFSituacao(e.target.value)}>
                <option value="">Todos</option>
                {SITUACOES.map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}
              </select>
            </div>
            {filtrando && (
              <button
                type="button" className="pg-btn pg-btn-ghost pg-filtro-limpa"
                onClick={() => { setFSetor(''); setFTipo(''); setFSituacao(''); }}
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* ---- card: Quantidade de iniciativas ---- */}
          <div className="pg-tiles">
            <div className="pg-card pg-tile is-destaque">
              <span className="pg-tile-rot">Quantidade de iniciativas</span>
              <strong className="pg-tile-num">{r.total}</strong>
              <span className="pg-tile-pe">
                {r.iniciativas} iniciativa(s) · {r.ideias} ideia(s)
                {filtrando ? ` — de ${linhas.length} no total` : ''}
              </span>
            </div>
          </div>

          {r.total === 0 ? (
            <div className="pg-vazio">Nenhum registro com esse filtro.</div>
          ) : (
            <>
              {/* ---- gráfico: quantidade por setor, separando ideia de iniciativa ---- */}
              <div className="pg-card">
                <h2 className="pg-card-tit">Quantidade de iniciativas por setor</h2>
                <p className="pg-campo-dica">
                  Cada barra separa o que já está sendo construído do que ainda é ideia.
                </p>

                <p className="pg-legenda-serie">
                  <span><i style={{ background: COR_FORMA.iniciativa }} /> Iniciativas</span>
                  <span><i style={{ background: COR_FORMA.ideia }} /> Ideias</span>
                </p>

                {/* Oculto para leitor de tela: o mapa no fim da página tem os
                    mesmos dados em tabela, que lê melhor do que um gráfico narrado. */}
                <div
                  className="pg-barras"
                  role="img"
                  aria-label={`Quantidade por setor. ${r.porSetor.map((s) => `${s.nome}: ${s.iniciativas} iniciativas e ${s.ideias} ideias`).join('. ')}.`}
                >
                  {r.porSetor.map((s) => (
                    <div className="pg-barra-linha" key={s.nome} aria-hidden="true">
                      <span className="pg-barra-nome" title={s.nome}>{s.nome}</span>
                      {/* Empilhada: a pergunta é o volume do setor, e a divisão
                          entre as duas formas é a leitura secundária. */}
                      <span className="pg-barra-trilho">
                        {s.iniciativas > 0 && (
                          <span
                            className="pg-barra"
                            title={`${s.iniciativas} iniciativa(s)`}
                            style={{ width: `${(s.iniciativas / maiorSetor) * 100}%`, background: COR_FORMA.iniciativa }}
                          />
                        )}
                        {s.ideias > 0 && (
                          <span
                            className="pg-barra"
                            title={`${s.ideias} ideia(s)`}
                            style={{ width: `${(s.ideias / maiorSetor) * 100}%`, background: COR_FORMA.ideia }}
                          />
                        )}
                      </span>
                      <span className="pg-barra-valor">{s.total}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ---- Kanban por tipo, com as duas legendas ---- */}
              <div className="pg-card">
                <h2 className="pg-card-tit">Kanban por tipo</h2>

                <div className="pg-legendas">
                  <div className="pg-legenda">
                    <span className="pg-legenda-tit">Setor</span>
                    {r.porSetor.map((s) => (
                      <span key={s.nome}>
                        <i style={{ background: corDoSetor(s.nome) }} /> {s.nome}
                      </span>
                    ))}
                  </div>
                  <div className="pg-legenda">
                    <span className="pg-legenda-tit">Borda</span>
                    <span><i className="borda" style={{ borderColor: COR_FORMA.iniciativa }} /> Iniciativa</span>
                    <span><i className="borda" style={{ borderColor: COR_FORMA.ideia }} /> Ideia</span>
                  </div>
                </div>

                <div className="pg-quadro">
                  {r.porCategoria.map((col) => (
                    <section key={col.valor} className="pg-col">
                      <div className="pg-col-cab">
                        <h2>{col.label}</h2>
                        <span className="pg-col-cont">{col.cards.length}</span>
                      </div>
                      <div className="pg-col-corpo">
                        {col.cards.length === 0 ? (
                          <p className="pg-col-vazia">Nada aqui ainda</p>
                        ) : col.cards.map((c) => (
                          // Botão, e não div com onClick: precisa receber foco e
                          // abrir com Enter para quem navega por teclado.
                          <button
                            key={c.id}
                            type="button"
                            className="pg-cartao"
                            onClick={() => setDetalhe(c)}
                            style={{
                              // Card colorido = setor; borda colorida = ideia ou
                              // iniciativa. As duas legendas da planilha. A cor
                              // nunca decide sozinha: os dois dados vêm escritos
                              // no próprio cartão.
                              background: `color-mix(in srgb, ${corDoSetor(c.setor)} 14%, #fff)`,
                              borderColor: COR_FORMA[c.tipo],
                            }}
                          >
                            <div className="pg-cartao-topo">
                              <span
                                className="pg-cartao-forma"
                                style={{ color: COR_FORMA[c.tipo], borderColor: COR_FORMA[c.tipo] }}
                              >
                                {c.tipo === 'ideia' ? 'Ideia' : 'Iniciativa'}
                              </span>
                              <span className={`pg-badge tom-${c.situacao}`}>{SITUACAO_LABEL[c.situacao]}</span>
                            </div>
                            <span className="pg-cartao-tit">{c.titulo}</span>
                            <div className="pg-cartao-pe">
                              <span className="pg-cartao-setor">
                                <i style={{ background: corDoSetor(c.setor) }} />
                                {c.setor}
                              </span>
                              <span>· {c.autorNome || 'Autor não identificado'}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>

              {/* ---- Tabela: Mapa de iniciativas, com atualizar status ---- */}
              <div className="pg-card">
                <h2 className="pg-card-tit">Mapa de iniciativas</h2>
                <p className="pg-campo-dica">
                  Clique no título para ver o registro completo.{' '}
                  {souAdmin
                    ? 'Você administra o módulo: pode atualizar a situação de qualquer registro.'
                    : 'Você pode atualizar a situação dos registros que você mesmo criou.'}
                </p>

                <div className="pg-tabela-scroll">
                  <table className="pg-tabela">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Título</th>
                        <th>Forma</th>
                        <th>Setor</th>
                        <th>Tipo</th>
                        <th>Autor</th>
                        <th>Registro</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((l) => {
                        const podeEditar = souAdmin || l.autor_id === user?.id;
                        return (
                          <tr key={l.id}>
                            <td className="num">#{l.numero}</td>
                            <td>
                              <button type="button" className="pg-link" onClick={() => setDetalhe(l)}>
                                {l.titulo}
                              </button>
                            </td>
                            <td>{l.tipo === 'ideia' ? 'Ideia' : 'Iniciativa'}</td>
                            <td>{l.setor}</td>
                            <td>{CATEGORIA_LABEL[l.categoria] || l.categoria}</td>
                            <td>{l.autorNome || '—'}</td>
                            <td className="num">{data(l.criado_em)}</td>
                            <td>
                              {podeEditar ? (
                                <select
                                  className="pg-select"
                                  value={l.situacao}
                                  disabled={salvando === l.id}
                                  onChange={(e) => trocarSituacao(l, e.target.value)}
                                  aria-label={`Situação de ${l.titulo}`}
                                >
                                  {SITUACOES.map((s) => (
                                    <option key={s.valor} value={s.valor}>{s.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className={`pg-badge tom-${l.situacao}`}>{SITUACAO_LABEL[l.situacao]}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Quem cadastrou (e o admin do módulo) edita pelo próprio detalhe. */}
      <DetalheIdeia
        registro={detalhe}
        podeEditar={Boolean(detalhe) && (souAdmin || detalhe.autor_id === user?.id)}
        onFechar={() => setDetalhe(null)}
        onSalvar={salvarEdicao}
      />
    </div>
  );
}
