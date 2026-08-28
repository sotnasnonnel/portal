import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { STATUS_PEDIDO, STATUS_PEDIDO_LABEL, tomDoPedido } from '../../../../config/programas';
import { listarEventosPedido } from '../../lib/pedidosIniciativa';

/**
 * Andamento de um pedido de iniciativa — e, para o admin do módulo, onde ele
 * RESPONDE.
 *
 * Duas leituras, porque são duas perguntas: a TRILHA responde "falta muito?"
 * (as etapas, com a atual marcada) e o HISTÓRICO responde "andou?" (cada passo,
 * quando e por quem). Só a trilha esconderia um pedido parado há três semanas;
 * só o histórico obrigaria a reconstruir de cabeça onde ele está.
 *
 * Responder aqui, e não no cartão da lista: a decisão se toma lendo o que a
 * pessoa pediu e o que já foi dito — dados que só cabem nesta tela. Na lista,
 * um select por linha convidava a mudar status sem ler nada.
 */

// Recusado não é etapa da trilha: é saída dela. Aparece no lugar da trilha
// quando acontece — desenhar um caminho que terminou não ajuda ninguém.
const TRILHA = STATUS_PEDIDO.filter((s) => s.valor !== 'recusado');

const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—');

export default function AndamentoModal({ pedido, podeResponder = false, onResponder, onFechar }) {
  const [eventos, setEventos] = useState(null);   // null = carregando
  const [erro, setErro] = useState('');
  const [status, setStatus] = useState(pedido.status);
  const [resposta, setResposta] = useState(pedido.resposta || '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarEventosPedido(pedido.id)
      .then(setEventos)
      .catch((e) => { setEventos([]); setErro(e.message); });
  }, [pedido.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !salvando) onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar, salvando]);

  const mudou = status !== pedido.status || resposta.trim() !== (pedido.resposta || '');

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      await onResponder({ status, resposta });
      // Recarrega o histórico em vez de adivinhar o passo: quem decide o que
      // virou evento é o trigger do banco, não esta tela.
      setEventos(await listarEventosPedido(pedido.id));
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const recusado = pedido.status === 'recusado';
  const atual = TRILHA.findIndex((s) => s.valor === pedido.status);

  return (
    <div className="pg-modal-overlay" onClick={onFechar}>
      <div
        className="pg-modal pg-andamento-modal" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={`Andamento do pedido ${pedido.numero}`}
      >
        <div className="pg-modal-cab">
          <h2>Pedido #{pedido.numero}</h2>
          <button type="button" className="pg-modal-x" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="pg-modal-corpo">
          <p className="pg-pedir-alvo">{pedido.iniciativa_titulo}</p>
          <dl className="pg-inic-meta">
            <div><dt>Obra</dt><dd>{pedido.obra_cod_phd}</dd></div>
            <div><dt>Pedido em</dt><dd>{dataHora(pedido.criado_em)}</dd></div>
            {pedido.solicitanteNome && (
              <div><dt>Quem pediu</dt><dd>{pedido.solicitanteNome}</dd></div>
            )}
          </dl>

          {recusado ? (
            <p className="pg-andamento-recusado">
              <span className="pg-badge tom-recusado">Recusado</span>
            </p>
          ) : (
            <ol className="pg-trilha" aria-label="Etapas do pedido">
              {TRILHA.map((s, i) => {
                const passou = i < atual;
                const aqui = i === atual;
                return (
                  <li key={s.valor} className={`${passou ? 'is-feita' : ''} ${aqui ? 'is-atual' : ''}`}>
                    <span className="pg-trilha-marca" aria-hidden="true">
                      {passou ? <Check size={12} /> : i + 1}
                    </span>
                    <span className="pg-trilha-rot">{s.label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <h3 className="pg-andamento-tit">Histórico</h3>
          {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}
          {eventos === null ? (
            <p className="pg-campo-dica"><Loader2 size={14} className="pg-spin" /> Carregando…</p>
          ) : eventos.length === 0 ? (
            <p className="pg-campo-dica">Sem passos registrados.</p>
          ) : (
            <ul className="pg-historico">
              {eventos.map((e) => (
                <li key={e.id}>
                  <span className="pg-historico-quando">{dataHora(e.criado_em)}</span>
                  <span className="pg-historico-oque">
                    {e.tipo === 'criado' && 'Pedido enviado'}
                    {e.tipo === 'status' && (
                      <>
                        {STATUS_PEDIDO_LABEL[e.de] || e.de} →{' '}
                        <span className={`pg-badge ${tomDoPedido(e.para)}`}>
                          {STATUS_PEDIDO_LABEL[e.para] || e.para}
                        </span>
                      </>
                    )}
                    {e.tipo === 'resposta' && 'Resposta atualizada'}
                    {e.autorNome && <em> · {e.autorNome}</em>}
                    {e.resposta && <span className="pg-motivo">{e.resposta}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {podeResponder && (
          <div className="pg-responder">
            <div className="pg-campo">
              <label htmlFor="resp-texto">Resposta para quem pediu</label>
              <textarea
                id="resp-texto"
                className="pg-textarea"
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                placeholder="O que foi decidido, e para quando."
                disabled={salvando}
              />
            </div>
            <div className="pg-campo">
              <label htmlFor="resp-status">Situação</label>
              <select
                id="resp-status"
                className="pg-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={salvando}
              >
                {STATUS_PEDIDO.map((s) => (
                  <option key={s.valor} value={s.valor}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="pg-modal-pe">
          <button type="button" className="pg-btn pg-btn-ghost" onClick={onFechar} disabled={salvando}>
            {podeResponder ? 'Cancelar' : 'Fechar'}
          </button>
          {podeResponder && (
            // Desabilitado enquanto nada mudou: salvar sem mudança gravaria um
            // passo no histórico dizendo que alguém mexeu, e ninguém mexeu.
            <button
              type="button" className="pg-btn pg-btn-primary"
              onClick={salvar} disabled={salvando || !mudou}
            >
              {salvando ? <Loader2 size={15} className="pg-spin" /> : null}
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
