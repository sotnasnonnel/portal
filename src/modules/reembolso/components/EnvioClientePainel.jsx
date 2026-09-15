import { useEffect, useState } from "react";
import { Mail, RefreshCw, Loader2 } from "lucide-react";
import { enviarPdfAoCliente, lerEnvioCliente } from "../services/envioCliente.js";
import { SITUACAO_ENVIO } from "../lib/envioCliente.js";
import { useToast } from "../context/FeedbackContext.jsx";
import "./EnvioClientePainel.css";

const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  : "");

/**
 * Situação do envio do PDF ao Financeiro, no detalhe de um reembolso cobrado do
 * cliente. Só o admin vê (a RLS do registro também só libera a ele).
 *
 * Existe porque o PDF sai do navegador de quem aprova: se a aba fechou no meio,
 * o pedido fica "pendente" e é AQUI que o Financeiro descobre e reenvia. Sem o
 * painel, o registro no banco saberia do furo e ninguém mais.
 *
 * Some calado quando não há registro — pedido aprovado antes da automação, ou
 * migração ainda não aplicada. Um aviso ali seria ruído num pedido que nunca
 * foi da automação.
 */
export default function EnvioClientePainel({ reembolsoId }) {
  const showToast = useToast();
  const [envio, setEnvio] = useState(undefined);   // undefined = carregando; null = sem registro
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    lerEnvioCliente(reembolsoId).then((e) => { if (vivo) setEnvio(e); });
    return () => { vivo = false; };
  }, [reembolsoId]);

  if (!envio) return null;

  const situacao = SITUACAO_ENVIO[envio.status] || { label: envio.status, tom: "alerta" };

  async function reenviar() {
    if (enviando) return;
    setEnviando(true);
    // Reenvio regera o PDF agora, no navegador de quem clica: se o pedido foi
    // corrigido depois da aprovação, é a versão atual que vai.
    const r = await enviarPdfAoCliente(reembolsoId, { reenviar: true });
    setEnvio(await lerEnvioCliente(reembolsoId));
    setEnviando(false);
    showToast(r.ok ? "PDF enviado ao Financeiro." : `Não foi enviado: ${r.motivo}`, r.ok ? "success" : "error");
  }

  return (
    <div className={`envio-cliente tom-${situacao.tom}`}>
      <Mail size={16} aria-hidden="true" />
      <div className="envio-cliente-txt">
        <strong>PDF para cobrança do cliente: {situacao.label}</strong>
        {envio.status === "enviado" && (
          <span>
            {dataHora(envio.enviado_em)}{envio.enviado_para ? ` para ${envio.enviado_para}` : ""}
            {envio.ultimo_erro ? ` · ${envio.ultimo_erro}` : ""}
          </span>
        )}
        {envio.status === "pendente" && (
          <span>O PDF ainda não chegou ao Financeiro. Se passou algum tempo desde a aprovação, reenvie.</span>
        )}
        {envio.status === "falhou" && (
          <span>{envio.ultimo_erro || "O envio falhou."} · {envio.tentativas} tentativa(s)</span>
        )}
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={reenviar} disabled={enviando}>
        {enviando ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
        {envio.status === "enviado" ? "Reenviar" : "Enviar agora"}
      </button>
    </div>
  );
}
