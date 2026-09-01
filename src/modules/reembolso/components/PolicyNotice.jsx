import { AlertTriangle } from "lucide-react";
import {
  POLICY,
  REGRAS_VALOR_ATIVAS,
  REGIOES_ALIMENTACAO,
  alimentacaoDia,
  regraDaRegiao,
} from "../lib/reimbursementPolicy.js";
import { formatCurrency } from "../lib/format.js";
import "./PolicyNotice.css";

// Aviso com as regras de reembolso (tabela de alimentação por local e itens
// proibidos). Hospedagem não entra: deixou de ter teto aqui — é tratada em
// outra plataforma. Mostrado ao solicitante no formulário e ao gestor na
// aprovação. `compact` reduz margens para caber dentro de modais.
//
// A tabela é por LOCAL, e o local sai da nota: por isso a linha embaixo
// explicando de onde o sistema tira a coluna — sem ela, quem lança de Itabira
// acha que está na coluna de BH.
const LINHAS = [
  { campo: "cafe", label: "Café da manhã" },
  { campo: "almoco", label: "Almoço" },
  { campo: "jantar", label: "Jantar" },
];

export default function PolicyNotice({ compact = false }) {
  if (!REGRAS_VALOR_ATIVAS) return null;

  const padrao = regraDaRegiao(POLICY.regiaoPadrao);

  return (
    <div className={`policy-notice${compact ? " policy-notice--compact" : ""}`}>
      <div className="policy-notice-head">
        <AlertTriangle size={16} aria-hidden="true" />
        <strong>Regras de reembolso</strong>
      </div>

      <div className="policy-block">
        <span className="policy-block-title">Alimentação por local</span>
        <div className="policy-table-wrap">
          <table className="policy-table">
            <thead>
              <tr>
                <th scope="col">Refeição</th>
                {REGIOES_ALIMENTACAO.map((r) => (
                  <th key={r.id} scope="col">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LINHAS.map((l) => (
                <tr key={l.campo}>
                  <th scope="row">{l.label}</th>
                  {REGIOES_ALIMENTACAO.map((r) => (
                    <td key={r.id}>{formatCurrency(r[l.campo])}</td>
                  ))}
                </tr>
              ))}
              <tr className="policy-table-total">
                <th scope="row">Máximo por dia</th>
                {REGIOES_ALIMENTACAO.map((r) => (
                  <td key={r.id}>{formatCurrency(alimentacaoDia(r.id))}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="policy-note">
          O local vem da nota anexada (cidade do estabelecimento). Sem cidade
          identificada, vale a coluna “{padrao.label}”.
        </p>
      </div>

      <div className="policy-block policy-block-forbidden">
        <span className="policy-block-title">Não é permitido</span>
        <p>{POLICY.naoPermitido.join(" • ")}.</p>
      </div>
    </div>
  );
}
