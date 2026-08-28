import { supabase } from '../../../services/supabase';
import { notificarPrograma } from '../../../services/notificarPrograma';
import { nomeCurto } from '../../../utils/formatters';

/**
 * Pedidos de uma iniciativa da Inovação para uma obra.
 *
 * O registro vive no portal (programas_iniciativa_pedidos), e não no
 * backoffice: o pedido é do Portal — quem pede é usuário daqui, e a fila é
 * tratada aqui. Do backoffice vem só a leitura de QUAL iniciativa existe.
 *
 * Quem vê o quê é a RLS, não este arquivo: `listar` devolve os pedidos da
 * pessoa e, para o admin do módulo, a fila inteira — a mesma consulta.
 */

const COLUNAS = `
  id, numero, iniciativa_id, iniciativa_titulo, obra_cod_phd, justificativa,
  status, resposta, solicitante_id, criado_em, respondido_em
`;

/** Nome de quem pediu vem pela RPC, como no resto do módulo (ver lib/ideias.js). */
async function anexarSolicitantes(linhas) {
  const ids = [...new Set(linhas.map((l) => l.solicitante_id).filter(Boolean))];
  if (!ids.length) return linhas.map((l) => ({ ...l, solicitanteNome: '' }));
  const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
  const nomes = new Map((data || []).map((p) => [p.id, p.nome]));
  // Curto para a tela, completo para o `title`: "MARIA EDUARDA DE SOUZA LIMA"
  // numa coluna de tabela quebra em três linhas e empurra o resto.
  return linhas.map((l) => {
    const completo = nomes.get(l.solicitante_id) || '';
    return { ...l, solicitanteNome: nomeCurto(completo), solicitanteNomeCompleto: completo };
  });
}

export async function listarPedidos() {
  const { data, error } = await supabase
    .from('programas_iniciativa_pedidos')
    .select(COLUNAS)
    .order('criado_em', { ascending: false });
  if (error) throw new Error(`Não consegui carregar os pedidos: ${error.message}`);
  return anexarSolicitantes(data || []);
}

export async function criarPedido({ iniciativa, obra, justificativa }, solicitanteId) {
  const { data, error } = await supabase
    .from('programas_iniciativa_pedidos')
    .insert({
      iniciativa_id: iniciativa.id,
      // Título copiado de propósito: ver o comentário da migração.
      iniciativa_titulo: iniciativa.titulo,
      obra_cod_phd: obra,
      justificativa: justificativa.trim(),
      solicitante_id: solicitanteId,
    })
    .select(COLUNAS)
    .single();
  if (error) throw new Error(`Não consegui registrar o pedido: ${error.message}`);

  // Só o id: quem monta o e-mail lê a linha no servidor. Mandar os campos
  // daqui deixaria o conteúdo do aviso à mercê do que o navegador enviou.
  // Best-effort — o pedido já está gravado (ver notificarPrograma).
  notificarPrograma('iniciativa_pedido_novo', { pedido_id: data.id });

  const [comNome] = await anexarSolicitantes([data]);
  return comNome;
}

/**
 * Resposta da Inovação. `resposta` vale para qualquer status — inclusive
 * aprovar, onde ela costuma dizer o "quando".
 */
export async function responderPedido(pedido, { status, resposta }) {
  const { data, error } = await supabase
    .from('programas_iniciativa_pedidos')
    .update({
      status,
      resposta: resposta?.trim() || null,
      respondido_em: new Date().toISOString(),
    })
    .eq('id', pedido.id)
    .select(COLUNAS)
    .single();
  if (error) throw new Error(`Não consegui salvar a resposta: ${error.message}`);

  // O aviso no sino sai por trigger no banco; o e-mail sai daqui.
  notificarPrograma('iniciativa_pedido_status', { pedido_id: data.id });

  const [comNome] = await anexarSolicitantes([data]);
  return comNome;
}

export async function excluirPedido(id) {
  const { error } = await supabase.from('programas_iniciativa_pedidos').delete().eq('id', id);
  if (error) throw new Error(`Não consegui excluir o pedido: ${error.message}`);
}

/**
 * Andamento do pedido: um passo por linha, como o banco gravou (trigger
 * prog_pedido_evento). É o que responde "andou?" — a coluna `status` só diz
 * onde ele está agora.
 */
export async function listarEventosPedido(pedidoId) {
  const { data, error } = await supabase
    .from('programas_iniciativa_pedido_eventos')
    .select('id, tipo, de, para, resposta, autor_id, criado_em')
    .eq('pedido_id', pedidoId)
    .order('criado_em', { ascending: true });
  if (error) throw new Error(`Não consegui carregar o andamento: ${error.message}`);
  return anexarAutores(data || []);
}

/** Mesma RPC de nomes usada nos pedidos; aqui a coluna é `autor_id`. */
async function anexarAutores(linhas) {
  const ids = [...new Set(linhas.map((l) => l.autor_id).filter(Boolean))];
  if (!ids.length) return linhas.map((l) => ({ ...l, autorNome: '' }));
  const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
  const nomes = new Map((data || []).map((p) => [p.id, p.nome]));
  return linhas.map((l) => ({ ...l, autorNome: nomeCurto(nomes.get(l.autor_id) || '') }));
}
