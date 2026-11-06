import { Pill, Placa } from './Pecas';
import { compLabel } from '../../lib/regras';
import {
  difRelevante, fatDif, fatTone, fatVenc,
} from '../../lib/faturas';
import { fmtDate, money } from '../../lib/formato';

/** Cabeçalho da fatura aberta: valor, vencimento, diferença e conferência. */
export default function ResumoFatura({ fatura: x }) {
  const vs = fatVenc(x);
  const dif = fatDif(x);
  const quando = x.conferido_em
    ? new Date(x.conferido_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '';
  return (
    <div className="frota-card frota-fat-resumo">
      <Placa placa={x.placa} />
      <div className="tx">
        <span className="v">{money(x.valor)}</span>
        <span className="s">
          {x.vencimento ? `vence em ${fmtDate(x.vencimento)}` : 'sem vencimento'} · ref. {compLabel(x.competencia)}
          {dif ? (
            <span className={difRelevante(dif) ? 'dif' : ''}> · diferença {dif > 0 ? '+' : ''}{money(dif)} sobre o previsto</span>
          ) : null}
        </span>
      </div>
      <div className="st">
        <Pill tone={fatTone(x.status)}>{x.status}</Pill>
        <Pill tone={vs.tone}>{vs.label}</Pill>
        {quando && <span className="frota-hint">{x.conferido_por_nome ? `${x.conferido_por_nome} · ` : ''}{quando}</span>}
      </div>
    </div>
  );
}
