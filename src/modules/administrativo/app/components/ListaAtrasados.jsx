import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ArrowRight, AlertTriangle } from 'lucide-react';
import { STATUS_LABEL } from '../../lib/statusChamado';

/**
 * O que está por trás do número "Vencidos agora".
 *
 * Um indicador que só diz "7 vencidos" obriga a pessoa a ir para a fila e
 * refazer o filtro para descobrir QUAIS são — e é isso que ela quer saber. A
 * lista abre por cima, do mais vencido para o menos (é a ordem em que se
 * atende), e cada linha leva direto ao chamado.
 *
 * Recebe a lista que o painel já calculou: nenhuma consulta nova.
 */

const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—');

/** Há quanto tempo estourou — o dado que ordena a ação, mais que a data em si. */
function atrasoEmTexto(slaVenceEm, agora) {
  const ms = agora - new Date(slaVenceEm).getTime();
  const horas = Math.floor(ms / 3600000);
  if (horas < 1) return 'há menos de 1h';
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

// `agora` vem de fora, sem default: é o MESMO instante que o painel usou para
// contar os vencidos, e ler o relógio aqui faria a lista e o número divergirem
// (e o lint proíbe, com razão — Date.now() no render não é puro).
export default function ListaAtrasados({ chamados, agora, souDoTime = false, onFechar }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  return (
    <div className="guia-overlay" onClick={onFechar}>
      <div
        className="guia-modal adm-atrasados-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adm-atrasados-tit"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="guia-head">
          <span className="guia-eyebrow">Vencidos agora</span>
          <button className="guia-close" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="adm-atrasados-corpo">
          <h3 id="adm-atrasados-tit">
            <AlertTriangle size={18} /> Chamados que passaram do prazo
          </h3>
          <p className="adm-campo-dica">
            Só o que ainda está em jogo: fechado com atraso já entra no indicador de prazo
            e contá-lo aqui seria o mesmo problema duas vezes. Do mais vencido para o menos.
          </p>

          {chamados.length === 0 ? (
            <p className="adm-prazos-vazio">Nenhum chamado vencido no momento.</p>
          ) : (
            <div className="adm-tabela-scroll">
              <table className="adm-tabela">
                <thead>
                  <tr>
                    <th>ID</th><th>Assunto</th><th>Serviço</th>
                    <th>Situação</th><th>Venceu em</th><th>Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {chamados.map((c) => (
                    <tr key={c.id}>
                      <td className="num">
                        <Link className="adm-link" to={`/administrativo/chamado/${c.id}`} onClick={onFechar}>
                          #{c.numero}
                        </Link>
                      </td>
                      <td>
                        <Link className="adm-link" to={`/administrativo/chamado/${c.id}`} onClick={onFechar}>
                          {c.assunto}
                        </Link>
                      </td>
                      <td>{c.servicoLabel || c.classeLabel || '—'}</td>
                      <td>
                        <span className={`adm-badge tom-${c.status}`}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                      </td>
                      <td className="num is-vencido">{dataHora(c.sla_vence_em)}</td>
                      <td className="num is-vencido">{atrasoEmTexto(c.sla_vence_em, agora)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="guia-footer">
          <button className="guia-skip" onClick={onFechar}>Fechar</button>
          {/* A fila é onde se assume e se atende — a ação que costuma vir
              depois de olhar esta lista. Só para quem atende: o solicitante não
              tem essa tela, e o atalho o levaria a uma porta fechada. */}
          {souDoTime && (
            <Link
              className="adm-btn adm-btn-ghost adm-btn-sm"
              to="/administrativo/fila?atrasado=sim"
              onClick={onFechar}
            >
              Abrir na fila <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
