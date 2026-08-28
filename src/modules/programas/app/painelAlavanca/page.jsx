import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, Loader2, Target, Trophy } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  ELEGIBILIDADE_LABEL, STATUS_ALAVANCA, STATUS_ALAVANCA_LABEL,
  calcularPremio, ehComercial,
} from '../../../../config/programas';
import { COR_BARRA } from '../../lib/paleta';
import { DetalheIndicacao } from '../components/Detalhe';
import { listarIndicacoes, atualizarIndicacao } from '../../lib/alavanca';
import { resumoAlavanca } from '../../lib/indicadores';
import ConcluirIndicacao from './ConcluirIndicacao';

/**
 * Painel da Alavanca — "**Apenas para o time comercial" (planilha).
 *
 * Reúne os quatro cards do funil, o mapa geral (onde o status e o comentário
 * são editados) e o mapa de vencedores.
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
  const maiorPessoa = Math.max(1, ...r.porPessoa.map((p) => p.total));

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

  const salvarComentario = async (indicacao) => {
    const texto = rascunhos[indicacao.id];
    if (texto === undefined) return;
    const ok = await aplicar(indicacao, { comentario: texto });
    if (ok) setRascunhos((a) => ({ ...a, [indicacao.id]: undefined }));
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
          </div>

          <div className="pg-tiles">
            <div className="pg-card pg-tile is-destaque">
              <span className="pg-tile-rot">Indicações</span>
              <strong className="pg-tile-num">{r.total}</strong>
              <span className="pg-tile-pe">
                {filtrando ? `de ${linhas.length} recebidas no total` : 'recebidas no total'}
              </span>
            </div>
            <div className="pg-card pg-tile">
              <span className="pg-tile-rot">Elegíveis</span>
              <strong className="pg-tile-num tom-alta">{r.elegiveis}</strong>
              <span className="pg-tile-pe">
                {r.emAnalise > 0
                  ? `+ ${r.emAnalise} dependendo da sua confirmação`
                  : `${r.naoElegiveis} não elegíveis`}
              </span>
            </div>
            <div className="pg-card pg-tile">
              <span className="pg-tile-rot">Evoluíram</span>
              <strong className="pg-tile-num">{r.evoluidas}</strong>
              <span className="pg-tile-pe">com status ou comentário do comercial</span>
            </div>
            <div className="pg-card pg-tile">
              <span className="pg-tile-rot">Concluídas</span>
              <strong className={`pg-tile-num ${r.concluidas ? 'tom-alta' : ''}`}>{r.concluidas}</strong>
              <span className="pg-tile-pe">{dinheiro(r.premioTotal)} em premiação</span>
            </div>
          </div>

          {/* A fila de trabalho vem antes da tabela: "depende do comercial" é a
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

          <div className="pg-graficos">
            <div className="pg-card">
              <h2 className="pg-card-tit">Funil das indicações</h2>
              <div
                className="pg-funil"
                role="img"
                aria-label={`Funil. ${r.funil.map((e) => `${e.nome}: ${e.total}`).join('. ')}.`}
              >
                {r.funil.map((e, i) => (
                  <div className="pg-funil-linha" key={e.nome} aria-hidden="true">
                    <span className="pg-barra-nome">{e.nome}</span>
                    <span className="pg-barra-trilho">
                      <span
                        className="pg-barra"
                        style={{
                          width: `${r.funil[0].total ? (e.total / r.funil[0].total) * 100 : 0}%`,
                          background: COR_BARRA,
                        }}
                      />
                    </span>
                    <span className="pg-barra-valor">{e.total}</span>
                    <span className="pg-funil-pct">
                      {i === 0 || !r.funil[0].total
                        ? '—'
                        : `${Math.round((e.total / r.funil[0].total) * 100)}%`}
                    </span>
                  </div>
                ))}
              </div>
              {(r.naoElegiveis > 0 || r.pendentes > 0) && (
                <p className="pg-campo-dica">
                  {r.naoElegiveis} barrada(s) por não elegibilidade
                  {r.pendentes > 0 ? ` · ${r.pendentes} sem verificação automática` : ''}.
                </p>
              )}
            </div>

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

            {r.porPessoa.length > 0 && (
              <div className="pg-card pg-card-largo">
                <h2 className="pg-card-tit">Quem está indicando</h2>
                <p className="pg-campo-dica">
                  Participação no programa — o mapa de vencedores, abaixo, é a premiação.
                </p>
                <div
                  className="pg-barras"
                  role="img"
                  aria-label={`Indicações por colaborador. ${r.porPessoa.map((x) => `${x.nome}: ${x.total}`).join('. ')}.`}
                >
                  {r.porPessoa.map((x) => (
                    <div className="pg-barra-linha" key={x.nome} aria-hidden="true">
                      <span className="pg-barra-nome" title={x.nome}>{x.nome}</span>
                      <span className="pg-barra-trilho">
                        <span
                          className="pg-barra"
                          style={{ width: `${(x.total / maiorPessoa) * 100}%`, background: COR_BARRA }}
                        />
                      </span>
                      <span className="pg-barra-valor">{x.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              <div className="pg-tabela-scroll">
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
                          <td>
                            <textarea
                              className="pg-textarea"
                              style={{ minHeight: 64, minWidth: 200, fontSize: 'var(--font-size-xs)' }}
                              value={emEdicao ? rascunho : (i.comentario || '')}
                              onChange={(e) => setRascunhos((a) => ({ ...a, [i.id]: e.target.value }))}
                              placeholder="Anote o andamento…"
                              aria-label={`Comentário da indicação ${i.numero}`}
                            />
                            {emEdicao && (
                              <button
                                type="button"
                                className="pg-btn pg-btn-primary pg-btn-sm"
                                style={{ marginTop: 6 }}
                                disabled={salvando === i.id}
                                onClick={() => salvarComentario(i)}
                              >
                                Salvar comentário
                              </button>
                            )}
                          </td>
                          <td className="num">
                            {dinheiro(i.valor_premio)}
                            {i.valor_contrato != null && (
                              <span className="pg-motivo">Contrato: {dinheiro(i.valor_contrato)}</span>
                            )}
                            {i.status === 'concluida' && (
                              <button
                                type="button"
                                className="pg-btn pg-btn-ghost pg-btn-sm"
                                style={{ marginTop: 6 }}
                                onClick={() => setConcluindo(i)}
                              >
                                Editar premiação
                              </button>
                            )}
                          </td>
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
