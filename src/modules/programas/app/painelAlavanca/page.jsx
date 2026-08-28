import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, Loader2, Target, Trash2, Trophy } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  ELEGIBILIDADE_LABEL, STATUS_ALAVANCA, STATUS_ALAVANCA_LABEL,
  calcularPremio, ehAdminProgramas, ehComercial,
} from '../../../../config/programas';
import { COR_BARRA } from '../../lib/paleta';
import { ConfirmarExclusao, DetalheIndicacao } from '../components/Detalhe';
import { listarIndicacoes, atualizarIndicacao, excluirIndicacao } from '../../lib/alavanca';
import { resumoAlavanca } from '../../lib/indicadores';
import ConcluirIndicacao from './ConcluirIndicacao';

/**
 * Painel da Alavanca — "**Apenas para o time comercial" (planilha).
 *
 * Reúne o funil, a premiação, quem está indicando, o mapa geral (onde o status
 * e o comentário são editados) e o mapa de vencedores.
 *
 * Mesma gramática do Painel da Inovação: contagem em cards compactos, número
 * escrito sempre que houver cor, e as tabelas longas rolando por dentro. Os
 * dois painéis são lidos pela mesma gente na mesma semana — divergir no formato
 * obriga a reaprender a tela.
 */

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const dinheiro = (n) => (n == null
  ? '—'
  : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

export default function PainelAlavanca() {
  const { user, modules } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState('');
  const [concluindo, setConcluindo] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [rascunhos, setRascunhos] = useState({});   // comentário em edição, por id
  const [excluindo, setExcluindo] = useState('');
  const [confirmando, setConfirmando] = useState(null);   // indicação na fila de exclusão
  const [fStatus, setFStatus] = useState('');
  const [fElegib, setFElegib] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setLinhas(await listarIndicacoes());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Os filtros valem para os cards, os gráficos e as duas tabelas ao mesmo
  // tempo: filtro que muda a tabela mas não o card faz os dois se contradizerem.
  const filtradas = useMemo(() => linhas.filter(
    (i) => (!fStatus || i.status === fStatus) && (!fElegib || i.elegibilidade === fElegib)
  ), [linhas, fStatus, fElegib]);

  const r = useMemo(() => resumoAlavanca(filtradas), [filtradas]);
  const filtrando = Boolean(fStatus || fElegib);
  const souAdmin = ehAdminProgramas(modules);
  // Só apresentação: o pé de cada etapa do funil. São as mesmas frases que os
  // quatro tiles carregavam antes de serem absorvidos pelo funil.
  const recebidas = r.funil[0].total;
  const notaEtapa = [
    null,
    // Atenção só aqui: é a única nota que cobra uma decisão de quem está lendo.
    r.emAnalise > 0 ? { texto: `+ ${r.emAnalise} dependendo da sua confirmação`, alerta: true } : null,
    null,
    r.premioTotal > 0 ? { texto: `${dinheiro(r.premioTotal)} em premiação` } : null,
  ];

  // Gate de UI. Quem não é do comercial não perde nada: a RLS já esconderia as
  // indicações alheias, e a tela sem dados seria mais confusa que a Alavanca.
  if (!ehComercial(modules)) return <Navigate to="/programas/alavanca" replace />;

  const aplicar = async (indicacao, mudancas) => {
    setSalvando(indicacao.id);
    setErro('');
    try {
      const nova = await atualizarIndicacao(indicacao, mudancas, user.id);
      setLinhas((atual) => atual.map((l) => (l.id === indicacao.id ? nova : l)));
      return true;
    } catch (e) {
      setErro(e.message);
      return false;
    } finally {
      setSalvando('');
    }
  };

  // Concluir exige o valor do prêmio (regra do programa e CHECK do banco), então
  // sai do <select> e vai para um diálogo próprio, em vez de gravar pela metade.
  const trocarStatus = (indicacao, novo) => {
    if (novo === 'concluida') return setConcluindo(indicacao);
    return aplicar(indicacao, { status: novo });
  };

  // A célula do comentário nasce como TEXTO. A caixa de edição em toda linha
  // punia as indicações que ninguém vai comentar: a tabela inteira virava
  // formulário e cada linha ganhava a altura do campo.
  const editarComentario = (indicacao) =>
    setRascunhos((a) => ({ ...a, [indicacao.id]: indicacao.comentario || '' }));

  const cancelarComentario = (indicacao) =>
    setRascunhos((a) => ({ ...a, [indicacao.id]: undefined }));

  const salvarComentario = async (indicacao) => {
    const texto = rascunhos[indicacao.id];
    if (texto === undefined) return;
    const ok = await aplicar(indicacao, { comentario: texto });
    if (ok) setRascunhos((a) => ({ ...a, [indicacao.id]: undefined }));
  };

  // Excluir sai na própria linha, e só para o admin do módulo — é a regra da
  // RLS (programas_alavanca_delete): o comercial trabalha a indicação, mas
  // apagar uma indicação de terceiro, inclusive concluída, é do admin.
  const apagar = async (indicacao) => {
    setExcluindo(indicacao.id);
    setErro('');
    try {
      await excluirIndicacao(indicacao.id);
      setLinhas((atual) => atual.filter((l) => l.id !== indicacao.id));
      setConfirmando(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setExcluindo('');
    }
  };

  return (
    <div className="pg-page pg-page-full">
      <h1 className="pg-title"><Target size={24} /> Painel da Alavanca</h1>
      <p className="pg-sub">Indicações recebidas de toda a empresa, elegibilidade e premiação.</p>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : (
        <>
          <div className="pg-filtros">
            <div className="pg-filtro">
              <label htmlFor="f-status">Status</label>
              <select id="f-status" className="pg-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">Todos</option>
                {STATUS_ALAVANCA.map((x) => <option key={x.valor} value={x.valor}>{x.label}</option>)}
              </select>
            </div>
            <div className="pg-filtro">
              <label htmlFor="f-elegib">Elegibilidade</label>
              <select id="f-elegib" className="pg-select" value={fElegib} onChange={(e) => setFElegib(e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(ELEGIBILIDADE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            {filtrando && (
              <button
                type="button" className="pg-btn pg-btn-ghost pg-filtro-limpa"
                onClick={() => { setFStatus(''); setFElegib(''); }}
              >
                Limpar filtros
              </button>
            )}

            {/* De quanto saiu o recorte, no canto — mesma linha discreta do
                Painel da Inovação. Antes isso morava no pé de um tile gigante. */}
            <p className="pg-resumo">
              <strong>{r.total}</strong> indicação(ões)
              {filtrando && <span> · de {linhas.length} recebidas no total</span>}
            </p>
          </div>

          {/* A fila de trabalho vem antes de tudo: "depende do comercial" é a
              única situação que não anda sozinha. */}
          {r.emAnalise > 0 && (
            <div className="pg-aviso tom-atencao">
              <AlertCircle size={16} />
              <span>
                <strong>{r.emAnalise}</strong> indicação(ões) caíram em empresa já cadastrada com
                contato novo. Pelas regras, valem se a oportunidade ainda não tiver sido mapeada —
                confirme o status de cada uma abaixo.
              </span>
            </div>
          )}

          {/* ---- funil ----
              Os quatro tiles do topo diziam recebidas / elegíveis / evoluíram /
              concluídas, e o gráfico logo abaixo repetia os mesmos quatro
              números em barras. Viraram um bloco só: a etapa carrega o número,
              a retenção e o pé que era do tile. */}
          <div className="pg-card">
            <h2 className="pg-card-tit">Funil das indicações</h2>
            <p className="pg-campo-dica">
              Cada etapa é um subconjunto da anterior — a porcentagem é sobre as recebidas.
            </p>
            <ol className="pg-funil" aria-label="Funil das indicações">
              {r.funil.map((e, i) => {
                const pct = recebidas ? Math.round((e.total / recebidas) * 100) : 0;
                return (
                  <li className="pg-funil-etapa" key={e.nome}>
                    <span className="pg-funil-rot">{e.nome}</span>
                    <strong className="pg-funil-num">{e.total}</strong>
                    <span className="pg-funil-medida" aria-hidden="true">
                      <i style={{ width: `${pct}%`, background: COR_BARRA }} />
                    </span>
                    <span className="pg-funil-pe">
                      {i === 0 ? 'recebidas no recorte atual' : `${pct}% das recebidas`}
                    </span>
                    {notaEtapa[i] && (
                      <span className={`pg-funil-nota ${notaEtapa[i].alerta ? 'tom-atencao' : ''}`}>
                        {notaEtapa[i].texto}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {(r.naoElegiveis > 0 || r.pendentes > 0 || r.canceladas > 0) && (
              <p className="pg-campo-dica">
                Fora do funil:{' '}
                {[
                  r.naoElegiveis > 0 ? `${r.naoElegiveis} barrada(s) por não elegibilidade` : null,
                  r.canceladas > 0 ? `${r.canceladas} cancelada(s) pelo comercial` : null,
                  r.pendentes > 0 ? `${r.pendentes} sem verificação automática` : null,
                ].filter(Boolean).join(' · ')}.
              </p>
            )}
          </div>

          <div className="pg-graficos">
            <div className="pg-card">
              <h2 className="pg-card-tit">Premiação</h2>
              <p className="pg-campo-dica">0,5% do contrato, teto de R$ 10.000 por indicação.</p>
              <dl className="pg-valores">
                <div>
                  <dt>Contratos fechados pelo programa</dt>
                  <dd>{dinheiro(r.contratoTotal)}</dd>
                </div>
                <div>
                  <dt>Premiação já paga</dt>
                  <dd className="tom-alta">{dinheiro(r.premioPago)}</dd>
                </div>
                <div>
                  <dt>A pagar</dt>
                  <dd className={r.premioAPagar > 0 ? 'tom-atencao' : ''}>{dinheiro(r.premioAPagar)}</dd>
                </div>
              </dl>
            </div>

          </div>

          <div className="pg-card">
            <h2 className="pg-card-tit">Mapa de indicações</h2>
            <p className="pg-campo-dica">
              Mudar o status ou deixar um comentário já conta como evolução — e quem indicou recebe
              o retorno por e-mail a cada mudança de status.
            </p>

            {filtradas.length === 0 ? (
              <p className="pg-campo-dica">Nenhuma indicação recebida ainda.</p>
            ) : (
              /* O mapa cresce com o programa: rola por dentro e prende o
                 cabeçalho, como o mapa do Painel da Inovação. */
              <div className="pg-tabela-scroll is-alta">
                <table className="pg-tabela">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Oportunidade</th>
                      <th>Empresa / contato</th>
                      <th>Indicado por</th>
                      <th>Elegibilidade</th>
                      <th>Status</th>
                      <th>Comentário</th>
                      <th>Premiação</th>
                      {souAdmin && <th className="col-acoes">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((i) => {
                      const rascunho = rascunhos[i.id];
                      const emEdicao = rascunho !== undefined;
                      return (
                        <tr key={i.id}>
                          <td className="num">#{i.numero}</td>
                          <td>
                            <button type="button" className="pg-link" onClick={() => setDetalhe(i)}>
                              {i.oportunidade}
                            </button>
                            <span className="pg-motivo">{i.descricao}</span>
                          </td>
                          <td>
                            {i.empresa}
                            <span className="pg-motivo">
                              {i.contato_nome} — {i.contato_cargo}<br />
                              {i.contato_telefone} · {i.contato_email}
                            </span>
                          </td>
                          <td>
                            {i.indicadorNome || '—'}
                            <span className="pg-motivo">{data(i.criado_em)}</span>
                          </td>
                          <td>
                            <span className={`pg-badge tom-${i.elegibilidade}`}>
                              {ELEGIBILIDADE_LABEL[i.elegibilidade] || i.elegibilidade}
                            </span>
                            {i.elegibilidade_motivo && <span className="pg-motivo">{i.elegibilidade_motivo}</span>}
                          </td>
                          <td>
                            <select
                              className="pg-select"
                              value={i.status}
                              disabled={salvando === i.id}
                              onChange={(e) => trocarStatus(i, e.target.value)}
                              aria-label={`Status da indicação ${i.numero}`}
                            >
                              {STATUS_ALAVANCA.map((s) => (
                                <option key={s.valor} value={s.valor}>{s.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="col-coment">
                            {emEdicao ? (
                              <>
                                <textarea
                                  className="pg-textarea"
                                  // Foco na caixa que acabou de abrir: quem clicou já quer digitar.
                                  autoFocus
                                  value={rascunho}
                                  onChange={(e) => setRascunhos((a) => ({ ...a, [i.id]: e.target.value }))}
                                  placeholder="Anote o andamento…"
                                  aria-label={`Comentário da indicação ${i.numero}`}
                                />
                                <div className="pg-cel-acao pg-cel-acoes">
                                  <button
                                    type="button"
                                    className="pg-btn pg-btn-primary pg-btn-sm"
                                    disabled={salvando === i.id}
                                    onClick={() => salvarComentario(i)}
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    type="button"
                                    className="pg-btn pg-btn-ghost pg-btn-sm"
                                    disabled={salvando === i.id}
                                    onClick={() => cancelarComentario(i)}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </>
                            ) : (
                              // Botão, e não div com onClick: a célula é editável e
                              // precisa receber foco e abrir com Enter.
                              <button
                                type="button"
                                className="pg-coment"
                                onClick={() => editarComentario(i)}
                                aria-label={`Editar comentário da indicação ${i.numero}`}
                              >
                                <span className={i.comentario ? '' : 'is-vazio'}>
                                  {i.comentario || '—'}
                                </span>
                              </button>
                            )}
                          </td>
                          <td className="num">
                            {/* O próprio valor abre a edição, como o comentário
                                ao lado: um botão embaixo de cada linha concluída
                                dobrava a altura dela para repetir o que o clique
                                no número já diz. */}
                            {i.status === 'concluida' ? (
                              <button
                                type="button"
                                className="pg-valor-edit"
                                onClick={() => setConcluindo(i)}
                                title="Editar premiação"
                              >
                                {dinheiro(i.valor_premio)}
                              </button>
                            ) : (
                              dinheiro(i.valor_premio)
                            )}
                            {i.valor_contrato != null && (
                              <span className="pg-motivo">Contrato: {dinheiro(i.valor_contrato)}</span>
                            )}
                          </td>
                          {souAdmin && (
                            <td className="col-acoes">
                              <button
                                type="button"
                                className="pg-icone-acao"
                                onClick={() => setConfirmando(i)}
                                title="Excluir indicação"
                                aria-label={`Excluir ${i.oportunidade}`}
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
            )}
          </div>

          <div className="pg-card">
            <h2 className="pg-card-tit"><Trophy size={13} style={{ verticalAlign: -2 }} /> Mapa de vencedores</h2>
            {r.vencedores.length === 0 ? (
              <p className="pg-campo-dica">
                Nenhuma indicação concluída ainda. Ao concluir uma, quem indicou entra aqui com o
                valor e a data de pagamento.
              </p>
            ) : (
              <div className="pg-tabela-scroll">
                <table className="pg-tabela">
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Empresa</th>
                      <th>Oportunidade</th>
                      <th>Valor do contrato</th>
                      <th>Premiação</th>
                      <th>Data de pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.vencedores.map((i) => (
                      <tr key={i.id}>
                        <td>{i.indicadorNome || '—'}</td>
                        <td>{i.empresa}</td>
                        <td>{i.oportunidade}</td>
                        <td className="num">{dinheiro(i.valor_contrato)}</td>
                        <td className="num"><strong>{dinheiro(i.valor_premio)}</strong></td>
                        {/* Sem data de pagamento é pendência, não "—": a regra
                            manda pagar após o faturamento da 1ª medição. */}
                        <td className="num">{i.pago_em ? data(i.pago_em) : 'A pagar'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {confirmando && (
        <ConfirmarExclusao
          alvo={`#${confirmando.numero} — ${confirmando.oportunidade}`}
          excluindo={excluindo === confirmando.id}
          onCancelar={() => setConfirmando(null)}
          onConfirmar={() => apagar(confirmando)}
        />
      )}

      <DetalheIndicacao indicacao={detalhe} onFechar={() => setDetalhe(null)} />

      {concluindo && (
        <ConcluirIndicacao
          indicacao={concluindo}
          salvando={salvando === concluindo.id}
          onFechar={() => setConcluindo(null)}
          onConfirmar={async (valores) => {
            const ok = await aplicar(concluindo, {
              status: 'concluida',
              valor_contrato: valores.valorContrato,
              valor_premio: valores.valorPremio ?? calcularPremio(valores.valorContrato),
              pago_em: valores.pagoEm,
            });
            if (ok) setConcluindo(null);
          }}
        />
      )}
    </div>
  );
}
