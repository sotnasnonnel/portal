import { Link } from 'react-router-dom';
import { X, ArrowRight, AlertTriangle } from 'lucide-react';
import { StatusBadge } from './ui';
import { useFocoDialogo } from './useFocoDialogo';
import { formatarDataHora } from '../../../../utils/formatters';

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

const dataHora = (iso) => formatarDataHora(iso, '—');

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
  // Foco nasce no X, não no primeiro link: ao abrir, ninguém quer um Enter sem
  // querer levando para o primeiro chamado da lista.
  const caixa = useFocoDialogo(true, onFechar, '.guia-close');

  return (
    <div className="guia-overlay" onClick={onFechar}>
      <div
        ref={caixa}
        className="guia-modal adm-atrasados-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adm-atrasados-tit"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="guia-head">
          <span className="guia-eyebrow">Vencidos agora</span>
          <button type="button" className="guia-close" onClick={onFechar} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="adm-atrasados-corpo">
          <h3 id="adm-atrasados-tit">
            <AlertTriangle size={18} aria-hidden="true" />
            {chamados.length === 1
              ? '1 chamado passou do prazo'
              : `${chamados.length} chamados passaram do prazo`}
          </h3>
          <p className="adm-campo-dica">
            Só os que ainda estão abertos, do mais atrasado para o menos.
          </p>

          {chamados.length === 0 ? (
            <p className="adm-prazos-vazio">Nenhum chamado vencido no momento.</p>
          ) : (
            // Lista, e não tabela: seis colunas no celular escondiam justamente
            // situação e atraso atrás da rolagem lateral, e o que importa aqui é
            // bater o olho em quanto cada um atrasou. A linha inteira é o link.
            <ul className="adm-atr-lista">
              {chamados.map((c) => (
                <li key={c.id}>
                  <Link className="adm-atr-item" to={`/administrativo/chamado/${c.id}`} onClick={onFechar}>
                    <span className="adm-atr-txt">
                      <strong>#{c.numero} · {c.assunto}</strong>
                      {/* O assunto costuma repetir o nome do serviço. */}
                      {(c.servicoLabel || c.classeLabel) !== c.assunto && <small>{c.servicoLabel || c.classeLabel || '—'}</small>}
                      <StatusBadge status={c.status} />
                    </span>
                    <span className="adm-atr-prazo">
                      <strong>{atrasoEmTexto(c.sla_vence_em, agora)}</strong>
                      <small>venceu em {dataHora(c.sla_vence_em)}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="guia-footer">
          <button type="button" className="guia-skip" onClick={onFechar}>Fechar</button>
          {/* A fila é onde se assume e se atende — a ação que costuma vir
              depois de olhar esta lista. Só para quem atende: o solicitante não
              tem essa tela, e o atalho o levaria a uma porta fechada. */}
          {souDoTime && (
            <Link
              className="adm-btn adm-btn-ghost adm-btn-sm"
              to="/administrativo/fila?atrasado=sim"
              onClick={onFechar}
            >
              Abrir na fila <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
