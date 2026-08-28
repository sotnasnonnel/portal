import { Check, X, Clock, CircleDashed, Wrench, Ban } from 'lucide-react';

/**
 * Cadeia de aprovação do chamado, visível para o SOLICITANTE — mesmo papel do
 * FluxoTimeline das Requisições DP: por quem o pedido passou, quem decidiu o
 * quê e quem ainda falta.
 *
 * Sem isto, quem abriu só descobria o desfecho; não dava para saber em qual
 * mesa o pedido está parado.
 *
 * O último degrau é a EXECUÇÃO. Não é aprovação — é para onde o pedido vai
 * depois que a cadeia se cumpre. Sem ele o fluxo terminava no gerente, como se
 * aprovar fosse o fim, e quem abriu não via com quem o pedido ficou.
 */
const VISUAL = {
  aprovada: { Icon: Check, tom: 'ok', label: 'Aprovou' },
  reprovada: { Icon: X, tom: 'nao', label: 'Reprovou' },
};

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

/**
 * O degrau do técnico, tirado do STATUS do chamado — não de uma etapa, porque
 * execução não é etapa de aprovação e não existe em chamados_adm_etapas.
 *
 * Reprovado e cancelado devolvem null: o pedido morreu antes de chegar ao Adm,
 * e mostrar "a seguir" para quem nunca vai executar seria mentira.
 */
function passoExecucao({ atendenteNome, status, fechadoEm }) {
  if (!atendenteNome || status === 'reprovado' || status === 'cancelado') return null;
  if (status === 'fechado') {
    return { Icon: Check, tom: 'ok', label: 'Concluiu', em: fechadoEm };
  }
  if (status === 'aguardando_aprovacao') {
    return { Icon: CircleDashed, tom: 'depois', label: 'Executa após a aprovação' };
  }
  return { Icon: Wrench, tom: 'espera', label: 'Em atendimento', ehVez: true };
}

export default function FluxoAprovacao({
  etapas = [], nomes = {}, atendenteNome = '', status = '', fechadoEm = null,
}) {
  const exec = passoExecucao({ atendenteNome, status, fechadoEm });
  if (!etapas.length && !exec) return null;

  const ordenadas = [...etapas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  // A vez é a menor ordem ainda pendente. Quem vem depois é "a seguir", e
  // precisa parecer diferente de quem está com o pedido na mão agora.
  const vez = ordenadas.find((e) => e.status === 'pendente')?.ordem;
  // Reprovado, ninguém decide as etapas seguintes: elas continuam 'pendente' no
  // banco, mas "a seguir" faria parecer que o chamado ainda anda.
  const interrompido = ordenadas.some((e) => e.status === 'reprovada');

  return (
    <div className="adm-card">
      {/* Serviço que dispensa aprovação não tem cadeia nenhuma: ali o card é só
          o degrau da execução, e chamá-lo de "aprovação" seria enganoso. */}
      <h2 className="adm-card-tit">{etapas.length ? 'Fluxo de aprovação' : 'Fluxo do chamado'}</h2>
      <ol className="adm-fluxo">
        {ordenadas.map((e) => {
          const ehVez = !interrompido && e.status === 'pendente' && e.ordem === vez;
          const v = VISUAL[e.status] || (interrompido
            ? { Icon: Ban, tom: 'depois', label: 'Fluxo interrompido' }
            : ehVez
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

        {exec && (
          <li className={`adm-fluxo-passo tom-${exec.tom} ${exec.ehVez ? 'is-vez' : ''}`}>
            <span className="adm-fluxo-ico"><exec.Icon size={14} /></span>
            <div className="adm-fluxo-corpo">
              <strong>{atendenteNome}</strong>
              <span className="adm-fluxo-status">
                Administrativo · {exec.label}
                {exec.em && ` · ${data(exec.em)}`}
              </span>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
