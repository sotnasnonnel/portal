import { AlertTriangle } from "lucide-react";
import { evaluatePolicyOverage, REGRAS_VALOR_ATIVAS } from "../lib/reimbursementPolicy.js";
import { formatCurrency } from "../lib/format.js";
import "./FoodOverageNotice.css";

// Mostra um alerta quando o pedido passa do teto de alimentação — a refeição
// acima do limite do local, ou a soma do dia acima do diário do local —, com a
// conta do excedente e de quanto o total deveria ficar. Não renderiza nada
// quando está tudo dentro do limite. `total` é o total geral do reembolso
// (para calcular o "dentro do limite"); se omitido, usa só a soma dos itens
// avaliados.
export default function FoodOverageNotice({ items, total }) {
  // Anda junto com o quadro de regras (REGRAS_VALOR_ATIVAS).
  if (!REGRAS_VALOR_ATIVAS) return null;

  const check = evaluatePolicyOverage(items);
  if (!check.hasOverage) return null;

  const titulo = "Alimentação acima do limite";

  const grand = total != null ? Number(total) : check.spent;
  const dentroDoLimite = grand - check.over;

  return (
    <div className="food-overage" role="alert">
      <div className="food-overage-head">
        <AlertTriangle size={16} aria-hidden="true" />
        <strong>{titulo}</strong>
      </div>

      <ul className="food-overage-list">
        {check.exceeded.map((e, i) => (
          <li key={`${e.description}-${i}`}>
            <span className="food-overage-item">
              {e.description}
              {e.meals > 1 ? ` (×${e.meals} refeições)` : ""}
              {e.regiao ? <em className="food-overage-regiao"> · {e.regiao}</em> : null}
            </span>
            <span className="food-overage-detail">
              {formatCurrency(e.value)}
              <em>
                {" "}
                — limite {formatCurrency(e.limit)}, excede {formatCurrency(e.over)}
              </em>
            </span>
          </li>
        ))}
      </ul>

      <div className="food-overage-totals">
        <div>
          <span>Total atual</span>
          <strong>{formatCurrency(grand)}</strong>
        </div>
        <div className="food-overage-over">
          <span>Excedente</span>
          <strong>{formatCurrency(check.over)}</strong>
        </div>
        <div>
          <span>Dentro do limite</span>
          <strong>{formatCurrency(dentroDoLimite)}</strong>
        </div>
      </div>
    </div>
  );
}
