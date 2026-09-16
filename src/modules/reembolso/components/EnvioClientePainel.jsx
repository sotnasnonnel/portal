import { useEffect, useState } from "react";
import { Download, FileText, RefreshCw, Loader2 } from "lucide-react";
import { baixarPdfAnexado, enviarPdfAoCliente, lerEnvioCliente } from "../services/envioCliente.js";
import { SITUACAO_ENVIO } from "../lib/envioCliente.js";
import { useToast } from "../context/FeedbackContext.jsx";
import "./EnvioClientePainel.css";

const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  : "");

/**
 * PDF para cobrança do cliente, no detalhe de um reembolso cobrado do cliente.
 * Só o admin vê (a RLS do registro também só libera a ele). O PDF não vai por
 * e-mail: fica anexado aqui e o Financeiro baixa quando for cobrar.
 *
 * Existe porque o PDF sai do navegador de quem aprova: se a aba fechou no meio,
 * o pedido fica "pendente" e é AQUI que o Financeiro descobre e gera de novo.
 *
 * Some calado quando não há registro — pedido aprovado antes da automação, ou
 * migração ainda não aplicada. Um aviso ali seria ruído num pedido que nunca
 * foi da automação.
 */
export default function EnvioClientePainel({ reembolsoId }) {
  const showToast = useToast();
  const [envio, setEnvio] = useState(undefined);   // undefined = carregando; null = sem registro
  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    let vivo = true;
    lerEnvioCliente(reembolsoId).then((e) => { if (vivo) setEnvio(e); });
    return () => { vivo = false; };
  }, [reembolsoId]);

  if (!envio) return null;

  const situacao = SITUACAO_ENVIO[envio.status] || { label: envio.status, tom: "alerta" };
  const anexado = envio.status === "enviado" && !!envio.pdf_path;

  async function gerar() {
    if (gerando) return;
    setGerando(true);
    // Regera o PDF agora, no navegador de quem clica: se o pedido foi corrigido
    // depois da aprovação, é a versão atual que fica anexada.
    const r = await enviarPdfAoCliente(reembolsoId, { reenviar: true });
    setEnvio(await lerEnvioCliente(reembolsoId));
    setGerando(false);
    showToast(r.ok ? "PDF anexado ao pedido." : `O PDF não foi anexado: ${r.motivo}`, r.ok ? "success" : "error");
  }

  async function baixar() {
    setBaixando(true);
    try {
      await baixarPdfAnexado(envio.pdf_path);
    } catch (err) {
      showToast(`Não foi possível baixar o PDF: ${err.message}`, "error");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className={`envio-cliente tom-${situacao.tom}`}>
      <FileText size={16} aria-hidden="true" />
      <div className="envio-cliente-txt">
        <strong>PDF para cobrança do cliente: {situacao.label}</strong>
        {envio.status === "enviado" && <span>Gerado em {dataHora(envio.enviado_em)}</span>}
        {envio.status === "pendente" && (
          <span>O PDF ainda não foi gerado. Se passou algum tempo desde a aprovação, gere agora.</span>
        )}
        {envio.status === "falhou" && (
          <span>{envio.ultimo_erro || "A geração falhou."} Gere de novo.</span>
        )}
      </div>
      <div className="envio-cliente-acoes">
        {anexado && (
          <button type="button" className="btn btn-primary btn-sm" onClick={baixar} disabled={baixando}>
            {baixando ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            Baixar PDF
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={gerar} disabled={gerando}>
          {gerando ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          {anexado ? "Gerar de novo" : "Gerar agora"}
        </button>
      </div>
    </div>
  );
}
