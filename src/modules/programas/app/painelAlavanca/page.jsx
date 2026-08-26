import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, Loader2, Target, Trophy } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  ELEGIBILIDADE_LABEL, STATUS_ALAVANCA, STATUS_ALAVANCA_LABEL,
  calcularPremio, ehComercial,
} from '../../../../config/programas';
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
  const [rascunhos, setRascunhos] = useState({});   // comentário em edição, por id

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

  const r = useMemo(() => resumoAlavanca(linhas), [linhas]);

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
          <div className="pg-tiles">
            <div className="pg-card pg-tile is-destaque">
              <span className="pg-tile-rot">Indicações</span>
              <strong className="pg-tile-num">{r.total}</strong>
              <span className="pg-tile-pe">recebidas no total</span>
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

          <div className="pg-card">
            <h2 className="pg-card-tit">Mapa de indicações</h2>
            <p className="pg-campo-dica">
              Mudar o status ou deixar um comentário já conta como evolução — e quem indicou recebe
              o retorno por e-mail a cada mudança de status.
            </p>

            {linhas.length === 0 ? (
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
                    {linhas.map((i) => {
                      const rascunho = rascunhos[i.id];
                      const emEdicao = rascunho !== undefined;
                      return (
                        <tr key={i.id}>
                          <td className="num">#{i.numero}</td>
                          <td>
                            {i.oportunidade}
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
                              style={{ minHeight: 64, minWidth: 200, fontSize: '0.8rem' }}
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
