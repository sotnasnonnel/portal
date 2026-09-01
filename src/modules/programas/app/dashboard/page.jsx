import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Boxes, LayoutDashboard, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  CATEGORIAS, CATEGORIA_LABEL, SETORES, SITUACOES, SITUACAO_LABEL,
  corDoSetor, ehAdminProgramas,
} from '../../../../config/programas';
import { COR_FORMA } from '../../lib/paleta';
import {
  listarIdeias, atualizarSituacao, atualizarIdeia, excluirIdeia, classificarIniciativa,
} from '../../lib/ideias';
import ClassificarModal from '../components/ClassificarModal';
import { resumoIdeias } from '../../lib/indicadores';
import { ConfirmarExclusao, DetalheIdeia } from '../components/Detalhe';

/**
 * Painel da Inovação — o Dashboard do Campo de Ideias (item 4 da planilha,
 * "Liberado para todos").
 *
 * Tela de LEITURA: os números do programa inteiro, de todo mundo. Quem quer
 * registrar vai em "Campo de Ideias", que é a tela de participação — mesma
 * divisão do outro programa ("Alavanca PHD" x "Painel da Alavanca"). Misturar
 * as duas faz o painel virar ao mesmo tempo onde se olha e onde se cadastra.
 *
 * Os quatro blocos da planilha, na ordem dela: o total, a contagem por setor,
 * o kanban por tipo e o mapa com atualizar status.
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
  const [excluindo, setExcluindo] = useState('');
  const [confirmando, setConfirmando] = useState(null);   // registro na fila de exclusão
  const [classificando, setClassificando] = useState(null);   // registro indo para o catálogo

  // Sub-aba ideia x iniciativa. Fica FORA dos selects de propósito: é a
  // primeira decisão de leitura do painel ("estou olhando o que já existe ou o
  // que ainda é ideia?"), não mais um recorte no meio dos outros três.
  const [fForma, setFForma] = useState('');   // '' = as duas
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

  // Sem a forma: é sobre este conjunto que as abas contam. Assim o número da
  // aba diz quantos registros o clique traz, já com os outros filtros valendo.
  const semForma = useMemo(() => linhas.filter(
    (l) => (!fSetor || l.setor === fSetor)
      && (!fTipo || l.categoria === fTipo)
      && (!fSituacao || l.situacao === fSituacao)
  ), [linhas, fSetor, fTipo, fSituacao]);

  const filtradas = useMemo(
    () => (fForma ? semForma.filter((l) => l.tipo === fForma) : semForma),
    [semForma, fForma]
  );

  const abas = [
    { valor: '', label: 'Tudo', cor: null, n: semForma.length },
    { valor: 'iniciativa', label: 'Iniciativas', cor: COR_FORMA.iniciativa, n: semForma.filter((l) => l.tipo === 'iniciativa').length },
    { valor: 'ideia', label: 'Ideias', cor: COR_FORMA.ideia, n: semForma.filter((l) => l.tipo === 'ideia').length },
  ];

  const r = useMemo(() => resumoIdeias(filtradas), [filtradas]);
  const souAdmin = ehAdminProgramas(modules);
  // Só os selects: o botão limpa o que ele consegue limpar. A aba é escolha de
  // leitura e continua onde está.
  const filtrando = Boolean(fSetor || fTipo || fSituacao);
  const recortado = filtrando || Boolean(fForma);
  // Os títulos dos blocos seguem a aba: "Mapa de iniciativas" com a aba de
  // ideias aberta faria a pessoa duvidar do que está lendo.
  const plural = fForma === 'ideia' ? 'ideias' : fForma === 'iniciativa' ? 'iniciativas' : 'registros';

  const salvarEdicao = async (registro, valores) => {
    const atualizado = await atualizarIdeia(registro, valores, user.id);
    setLinhas((atual) => atual.map((l) => (l.id === registro.id ? atualizado : l)));
    // O popup continua aberto mostrando o registro salvo, não o antigo.
    setDetalhe(atualizado);
  };

  const apagar = async (registro) => {
    await excluirIdeia(registro.id);
    setLinhas((atual) => atual.filter((l) => l.id !== registro.id));
  };

  // Excluir direto da linha do mapa, sem passar pelo detalhe. Só o admin do
  // módulo vê a coluna — é a mesma regra da RLS (programas_ideias_delete), e
  // botão que aparece para quem o banco vai recusar é só frustração.
  const apagarDaLinha = async (registro) => {
    setExcluindo(registro.id);
    setErro('');
    try {
      await apagar(registro);
      setConfirmando(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setExcluindo('');
    }
  };

  // Classificar cria a linha no catálogo da empresa (backoffice) e marca este
  // registro — ver lib/ideias.js. Só o admin do módulo vê o botão, e a Edge
  // Function confere isso de novo no servidor.
  const classificar = async (valores) => {
    const r = await classificarIniciativa(classificando, valores);
    setLinhas((atual) => atual.map((l) => (
      l.id === classificando.id
        ? { ...l, pipeline_id: r.pipeline_id, classificado_em: new Date().toISOString() }
        : l
    )));
    setClassificando(null);
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
      <h1 className="pg-title"><LayoutDashboard size={24} /> Painel da Inovação</h1>
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
          {/* ---- sub-abas: ideia x iniciativa, com o total à direita ---- */}
          <div className="pg-painel-topo">
            <div className="pg-tabs" role="tablist" aria-label="Forma do registro">
              {abas.map((a) => (
                <button
                  key={a.valor || 'tudo'}
                  type="button"
                  role="tab"
                  aria-selected={fForma === a.valor}
                  className={`pg-tab ${fForma === a.valor ? 'is-active' : ''}`}
                  onClick={() => setFForma(a.valor)}
                >
                  {a.cor && <i className="pg-tab-ponto" style={{ background: a.cor }} aria-hidden="true" />}
                  {a.label}
                  <span className="pg-tab-cont">{a.n}</span>
                </button>
              ))}
            </div>

            {/* O total ficava num card grande no meio da tela, empurrando o
                conteúdo para baixo. É referência, não o assunto: cabe numa
                linha no canto. */}
            <p className="pg-resumo">
              <strong>{r.total}</strong> {plural}
              <span> · {r.iniciativas} iniciativa(s) · {r.ideias} ideia(s)</span>
              {recortado && <span> · de {linhas.length} no total</span>}
            </p>
          </div>

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

          {r.total === 0 ? (
            <div className="pg-vazio">Nenhum registro com esse filtro.</div>
          ) : (
            <>
              {/* ---- por setor: um card por setor ----
                  Era um gráfico de barras. Com poucos registros espalhados em
                  13 setores, quase toda barra virava um risco de 1 unidade e a
                  leitura ficava pior do que o número escrito. */}
              <div className="pg-card">
                <h2 className="pg-card-tit">{plural[0].toUpperCase() + plural.slice(1)} por setor</h2>
                <p className="pg-campo-dica">
                  {fForma
                    ? 'Só a forma escolhida na aba acima.'
                    : 'Cada card separa o que já está sendo construído do que ainda é ideia.'}
                </p>

                {!fForma && (
                  <p className="pg-legenda-serie">
                    <span><i style={{ background: COR_FORMA.iniciativa }} /> Iniciativas</span>
                    <span><i style={{ background: COR_FORMA.ideia }} /> Ideias</span>
                  </p>
                )}

                <div className="pg-contagens">
                  {r.porSetor.map((s) => (
                    <div className="pg-contagem" key={s.nome} style={{ '--conta': corDoSetor(s.nome) }}>
                      <span className="pg-contagem-nome" title={s.nome}>{s.nome}</span>
                      <strong className="pg-contagem-num">{s.total}</strong>
                      {fForma ? (
                        <span className="pg-contagem-pe">{fForma === 'ideia' ? 'ideia(s)' : 'iniciativa(s)'}</span>
                      ) : (
                        <>
                          {/* A divisão da barra é apoio: os dois números estão
                              escritos logo abaixo. */}
                          <span className="pg-contagem-barra" aria-hidden="true">
                            {s.iniciativas > 0 && (
                              <i style={{ flex: s.iniciativas, background: COR_FORMA.iniciativa }} />
                            )}
                            {s.ideias > 0 && (
                              <i style={{ flex: s.ideias, background: COR_FORMA.ideia }} />
                            )}
                          </span>
                          <span className="pg-contagem-pe">
                            {s.iniciativas} iniciativa(s) · {s.ideias} ideia(s)
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ---- Kanban por tipo, com as duas legendas ---- */}
              <div className="pg-card">
                <h2 className="pg-card-tit">Kanban por tipo</h2>

                {/* A legenda de setor saiu: os cards acima já dão a mesma
                    tabela de cor→nome, e com 13 setores ela era o bloco mais
                    alto da tela para repetir o que estava logo antes. Sobra a
                    borda, que não tem outro lugar onde apareça explicada — e a
                    cor segue sem decidir nada sozinha, o setor e a forma vêm
                    escritos dentro de cada cartão. */}
                <div className="pg-legendas">
                  <div className="pg-legenda">
                    <span className="pg-legenda-tit">Borda</span>
                    <span><i className="borda" style={{ borderColor: COR_FORMA.iniciativa }} /> Iniciativa</span>
                    <span><i className="borda" style={{ borderColor: COR_FORMA.ideia }} /> Ideia</span>
                  </div>
                  <p className="pg-campo-dica">Fundo do cartão = setor, nas mesmas cores dos cards acima.</p>
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
                <h2 className="pg-card-tit">Mapa de {plural}</h2>
                <p className="pg-campo-dica">
                  Clique no título para ver o registro completo.{' '}
                  {souAdmin
                    ? 'Você administra o módulo: pode atualizar a situação de qualquer registro.'
                    : 'Você pode atualizar a situação dos registros que você mesmo criou.'}
                </p>

                <div className="pg-tabela-scroll is-alta">
                  <table className="pg-tabela">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th className="col-titulo">Título</th>
                        <th className="col-curta">Forma</th>
                        <th className="col-curta">Setor</th>
                        <th>Tipo</th>
                        <th>Autor</th>
                        <th className="col-curta">Registro</th>
                        <th>Situação</th>
                        {souAdmin && <th className="col-acoes">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((l) => {
                        // Mudar a situação é editar o registro: só de quem o criou.
                        const podeEditar = l.autor_id === user?.id;
                        return (
                          <tr key={l.id}>
                            <td className="num">#{l.numero}</td>
                            <td className="col-titulo">
                              <button type="button" className="pg-link" onClick={() => setDetalhe(l)}>
                                {l.titulo}
                              </button>
                            </td>
                            <td className="col-curta">{l.tipo === 'ideia' ? 'Ideia' : 'Iniciativa'}</td>
                            <td className="col-curta">{l.setor}</td>
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
                            {souAdmin && (
                              <td className="col-acoes">
                                {/* Classificar é só da INICIATIVA: ideia é o que
                                    ainda não existe, e catálogo de coisa que não
                                    existe não é catálogo. */}
                                {l.tipo === 'iniciativa' && (
                                  l.pipeline_id ? (
                                    <span className="pg-badge tom-ok" title="Já está em Iniciativas em uso">
                                      No catálogo
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="pg-icone-acao"
                                      onClick={() => setClassificando(l)}
                                      title="Classificar como iniciativa em uso"
                                      aria-label={`Classificar ${l.titulo}`}
                                    >
                                      <Boxes size={16} />
                                    </button>
                                  )
                                )}
                                <button
                                  type="button"
                                  className="pg-icone-acao is-perigo"
                                  onClick={() => setConfirmando(l)}
                                  title="Excluir registro"
                                  aria-label={`Excluir ${l.titulo}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            )}
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

      {classificando && (
        <ClassificarModal
          registro={classificando}
          autorNome={classificando.autorNome || ''}
          onFechar={() => setClassificando(null)}
          onClassificar={classificar}
        />
      )}

      {confirmando && (
        <ConfirmarExclusao
          alvo={`#${confirmando.numero} — ${confirmando.titulo}`}
          excluindo={excluindo === confirmando.id}
          onCancelar={() => setConfirmando(null)}
          onConfirmar={() => apagarDaLinha(confirmando)}
        />
      )}

      {/* Quem cadastrou (e o admin do módulo) edita pelo próprio detalhe. */}
      <DetalheIdeia
        registro={detalhe}
        podeEditar={Boolean(detalhe) && detalhe.autor_id === user?.id}
        podeExcluir={Boolean(detalhe) && (souAdmin || detalhe.autor_id === user?.id)}
        onFechar={() => setDetalhe(null)}
        onClassificar={souAdmin ? (r) => { setDetalhe(null); setClassificando(r); } : null}
        onSalvar={salvarEdicao}
        onExcluir={apagar}
      />
    </div>
  );
}
