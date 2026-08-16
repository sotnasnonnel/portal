import { Check, X, Clock, CircleDashed } from 'lucide-react';

/**
 * Cadeia de aprovação do chamado, visível para o SOLICITANTE — mesmo papel do
 * FluxoTimeline das Requisições DP: por quem o pedido passou, quem decidiu o
 * quê e quem ainda falta.
 *
 * Sem isto, quem abriu só descobria o desfecho; não dava para saber em qual
 * mesa o pedido está parado.
 */
const VISUAL = {
  aprovada: { Icon: Check, tom: 'ok', label: 'Aprovou' },
  reprovada: { Icon: X, tom: 'nao', label: 'Reprovou' },
};

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export default function FluxoAprovacao({ etapas = [], nomes = {} }) {
  if (!etapas.length) return null;

  const ordenadas = [...etapas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  // A vez é a menor ordem ainda pendente. Quem vem depois é "a seguir", e
  // precisa parecer diferente de quem está com o pedido na mão agora.
  const vez = ordenadas.find((e) => e.status === 'pendente')?.ordem;

  return (
    <div className="adm-card">
      <h2 className="adm-card-tit">Fluxo de aprovação</h2>
      <ol className="adm-fluxo">
        {ordenadas.map((e) => {
          const ehVez = e.status === 'pendente' && e.ordem === vez;
          const v = VISUAL[e.status] || (ehVez
            ? { Icon: Clock, tom: 'espera', label: 'Aguardando decisão' }
            : { Icon: CircleDashed, tom: 'depois', label: 'A seguir' });
          return (
            <li key={e.id} className={`adm-fluxo-passo tom-${v.tom} ${ehVez ? 'is-vez' : ''}`}>
              <span className="adm-fluxo-ico"><v.Icon size={14} /></span>
              <div className="adm-fluxo-corpo">
                <strong>{nomes[e.aprovador_id] || 'Aprovador'}</strong>
                <span className="adm-fluxo-status">
                  {v.label}
                  {e.decidido_em && ` · ${data(e.decidido_em)}`}
                </span>
                {e.justificativa && <p className="adm-fluxo-just">“{e.justificativa}”</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
