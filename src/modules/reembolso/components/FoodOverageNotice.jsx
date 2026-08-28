import { AlertTriangle } from "lucide-react";
import { evaluatePolicyOverage, REGRAS_VALOR_ATIVAS } from "../lib/reimbursementPolicy.js";
import { formatCurrency } from "../lib/format.js";
import "./FoodOverageNotice.css";

// Mostra um alerta quando o pedido passa de algum teto da política — refeição
// acima do limite, alimentação do dia acima de R$ 100 ou diária de hospedagem
// acima de R$ 285 —, com a conta do excedente e de quanto o total deveria ficar.
// Não renderiza nada quando está tudo dentro do limite. `total` é o total geral
// do reembolso (para calcular o "dentro do limite"); se omitido, usa só a soma
// dos itens avaliados.
export default function FoodOverageNotice({ items, total }) {
  // Fora do ar junto com o quadro de regras: apontar excedente contra um teto
  // que a empresa já sabe que vai mudar só gera pergunta.
  // Ver REGRAS_VALOR_ATIVAS em lib/reimbursementPolicy.js.
  if (!REGRAS_VALOR_ATIVAS) return null;

  const check = evaluatePolicyOverage(items);
  if (!check.hasOverage) return null;

  // O título diz o que estourou: alimentação, hospedagem ou os dois.
  const titulo = check.food.hasOverage && check.lodging.hasOverage
    ? "Valores acima do limite"
    : check.lodging.hasOverage
      ? "Hospedagem acima do limite"
      : "Alimentação acima do limite";

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
              {e.meals > 1 ? ` (×${e.meals} ${e.kind === "hospedagem" ? "diárias" : "refeições"})` : ""}
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
