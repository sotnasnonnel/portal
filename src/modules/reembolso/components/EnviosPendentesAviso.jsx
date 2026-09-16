import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileWarning } from "lucide-react";
import { listarEnviosPendentes } from "../services/envioCliente.js";
import "./EnvioClientePainel.css";

/**
 * Reembolsos cobrados do cliente que ainda NÃO têm o PDF anexado.
 *
 * É a rede de segurança da geração automática, que depende do navegador de quem
 * aprovou: o que ficou para trás aparece aqui, na tela onde o Financeiro já
 * trabalha, e não só no detalhe de um pedido que ninguém vai abrir por acaso.
 *
 * Some quando não há pendência — um aviso permanente "0 pendentes" vira papel
 * de parede em uma semana.
 */
export default function EnviosPendentesAviso({ rows = [] }) {
  const [pendentes, setPendentes] = useState([]);

  useEffect(() => {
    let vivo = true;
    listarEnviosPendentes().then((l) => { if (vivo) setPendentes(l); });
    return () => { vivo = false; };
  }, [rows]);

  if (!pendentes.length) return null;

  // O código do pedido sai da lista já carregada; o registro só guarda o id.
  const porId = new Map(rows.map((r) => [r.id, r]));
  const falharam = pendentes.filter((p) => p.status === "falhou").length;

  return (
    <div className={`envio-cliente ${falharam ? "tom-erro" : "tom-alerta"}`}>
      <FileWarning size={16} aria-hidden="true" />
      <div className="envio-cliente-txt">
        <strong>
          {pendentes.length === 1
            ? "1 reembolso cobrado do cliente ainda sem PDF anexado"
            : `${pendentes.length} reembolsos cobrados do cliente ainda sem PDF anexado`}
          {falharam ? ` (${falharam} com falha)` : ""}
        </strong>
        <span>
          Abra e use "Gerar agora":{" "}
          {pendentes.map((p, i) => (
            <span key={p.reimbursement_id}>
              {i > 0 && ", "}
              <Link to={`/reembolsos/${p.reimbursement_id}`}>
                {porId.get(p.reimbursement_id)?.code || "pedido"}
              </Link>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
