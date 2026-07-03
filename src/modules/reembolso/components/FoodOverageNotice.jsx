import { AlertTriangle } from "lucide-react";
import { evaluateFoodOverage } from "../lib/reimbursementPolicy.js";
import { formatCurrency } from "../lib/format.js";
import "./FoodOverageNotice.css";

// Mostra um alerta quando itens de alimentação passam do limite por refeição,
// com a conta do excedente e de quanto o total deveria ficar dentro do limite.
// Não renderiza nada quando está tudo dentro do limite. `total` é o total geral
// do reembolso (para calcular o "dentro do limite"); se omitido, usa só a soma
// dos itens de alimentação.
export default function FoodOverageNotice({ items, total }) {
  const check = evaluateFoodOverage(items);
  if (!check.hasOverage) return null;

  const grand = total != null ? Number(total) : check.spent;
  const dentroDoLimite = grand - check.over;

  return (
    <div className="food-overage" role="alert">
      <div className="food-overage-head">
        <AlertTriangle size={16} aria-hidden="true" />
        <strong>Alimentação acima do limite</strong>
      </div>

      <ul className="food-overage-list">
        {check.exceeded.map((e, i) => (
          <li key={`${e.description}-${i}`}>
            <span className="food-overage-item">
              {e.description}
              {e.meals > 1 ? ` (×${e.meals} refeições)` : ""}
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
