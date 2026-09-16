// PDF anexado automaticamente quando o reembolso é cobrado do cliente. Não vai
// por e-mail: fica no bucket e o Financeiro baixa pelo detalhe do pedido.
//
// Por que o PDF sai do NAVEGADOR e não do servidor: o gerador (reembolsoPdf.js)
// já existe aqui e carrega o padrão de nome de arquivo exigido pelo cliente.
// Uma segunda versão no servidor divergiria exatamente nesse ponto.
//
// O preço dessa escolha é depender do navegador de quem aprova terminar o
// trabalho — e é por isso que o banco mantém um REGISTRO: todo aprovado
// reembolsável nasce "pendente" por gatilho, independente deste arquivo, e só
// vira "anexado" (status 'enviado') quando a função confere o arquivo. Se a aba
// fechar no meio, o pedido fica pendente e visível para o Financeiro gerar.

import { supabase } from "../lib/supabase.js";
import { getReimbursement } from "./reimbursements.js";
import { deveEnviarAoCliente } from "../lib/envioCliente.js";

export const PDF_CLIENTE_BUCKET = "reembolso-pdf-cliente";
const TABELA = "reembolso_envios_cliente";

/**
 * Gera o PDF, guarda no bucket e pede à função que registre como anexado.
 *
 * Nunca lança: o chamador é a aprovação, e ela já foi gravada. Devolve
 * `{ ok, motivo }` para quem quiser mostrar (o botão "Gerar de novo" mostra).
 *
 * `reenviar` só é aceito pela função quando quem pede é admin — regerar o que
 * já está anexado é ação do Financeiro, não de qualquer aprovador.
 */
export async function enviarPdfAoCliente(id, { reenviar = false } = {}) {
  try {
    const { data: r, error } = await getReimbursement(id);
    if (error || !r) return { ok: false, motivo: "Pedido não encontrado." };
    if (!deveEnviarAoCliente(r)) return { ok: false, motivo: "Este pedido não é cobrado do cliente." };

    // Import dinâmico, como no botão "Gerar PDF": o jsPDF é pesado e só baixa
    // quando há de fato um PDF a gerar.
    const { gerarReembolsoPdfBlob } = await import("./reembolsoPdf.js");
    const { blob, fileName } = await gerarReembolsoPdfBlob(r);

    // O caminho começa pelo id do pedido: a função recusa arquivo fora da
    // pasta do próprio pedido, para ninguém anexar o PDF de outro reembolso.
    const path = `${id}/${fileName}`;
    const { error: upErr } = await supabase.storage
      .from(PDF_CLIENTE_BUCKET)
      .upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (upErr) return { ok: false, motivo: `Não foi possível guardar o PDF: ${upErr.message}` };

    const { data, error: fnErr } = await supabase.functions.invoke("envia-reembolso-cliente", {
      body: { id, path, reenviar },
    });
    if (fnErr) return { ok: false, motivo: `Não foi possível registrar o PDF: ${fnErr.message}` };
    if (data?.sent) return { ok: true, motivo: "" };
    return { ok: false, motivo: data?.motivo || data?.skipped || data?.error || "O PDF não foi registrado." };
  } catch (err) {
    console.warn("[envia-reembolso-cliente] falhou:", err?.message);
    return { ok: false, motivo: err?.message || "Não foi possível gerar o PDF." };
  }
}

/**
 * Situação do envio de UM pedido. Tolerante: devolve null se o registro ainda
 * não existe no banco (migração não aplicada) ou se quem olha não pode vê-lo —
 * o detalhe do pedido não pode quebrar por causa de um painel acessório.
 */
export async function lerEnvioCliente(id) {
  try {
    const { data, error } = await supabase
      .from(TABELA)
      .select("status, tentativas, ultimo_erro, enviado_em, pdf_path, atualizado_em")
      .eq("reimbursement_id", id)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Pedidos aprovados e cobrados do cliente que ainda NÃO têm o PDF anexado.
 * É a rede de segurança da geração pelo navegador: o que ficar aqui é o que
 * precisa ser gerado de novo. Consulta separada — e não embutida na lista principal —
 * de propósito: se a tabela ainda não existir, a lista de reembolsos continua
 * funcionando para todo mundo.
 */
export async function listarEnviosPendentes() {
  try {
    const { data, error } = await supabase
      .from(TABELA)
      .select("reimbursement_id, status, ultimo_erro, atualizado_em")
      .in("status", ["pendente", "falhou"])
      .order("atualizado_em", { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/** Baixa o PDF anexado (bucket privado: URL assinada de curta duração). */
export async function baixarPdfAnexado(path) {
  const nome = path.slice(path.indexOf("/") + 1);
  const { data, error } = await supabase.storage
    .from(PDF_CLIENTE_BUCKET)
    .createSignedUrl(path, 60, { download: nome });
  if (error) throw new Error(error.message);
  window.location.assign(data.signedUrl);
}
