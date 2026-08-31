import { supabase } from '../../../services/supabase';
// O aviso ao solicitante é do CHAMADO, mas mora aqui porque é esta função que
// fecha o chamado — nos dois pontos de entrada (a tela de Saída e o card do
// Adm). Deixá-lo em quem chama já custou um caminho silencioso.
import { notificarChamadoAdm } from '../../../services/notificarChamadoAdm';

/**
 * Única camada de acesso a dados do módulo de Estoque — nenhuma página fala com
 * o Supabase direto (mesma regra do administrativo/lib/chamados.js).
 *
 * DUAS FORMAS DE FALHAR, e elas não são intercambiáveis:
 *
 *  - UPDATE/INSERT barrado por RLS devolve ZERO LINHAS, sem erro. Por isso todo
 *    update abaixo passa por `exigirLinha`, como no Adm.
 *  - RPC com `raise exception` devolve ERRO de verdade. Ali `exigirLinha` não se
 *    aplica; basta propagar a mensagem, que já vem escrita para o usuário
 *    ("Saldo insuficiente de CAPACETE 3M (disponível: 0, pedido: 1)").
 *
 * Trocar um pelo outro é o erro fácil de cometer aqui.
 */

// UPDATE barrado pela RLS não dá erro, dá zero linhas.
const exigirLinha = (data, erro, mensagem) => {
  if (erro) throw new Error(`${mensagem}: ${erro.message}`);
  if (!data?.length) throw new Error(`${mensagem}: você não tem permissão para esta ação.`);
  return data;
};

const COLS_POSICAO = 'id, item_id, categoria, descricao, unidade, tamanho, ca, genero, setor, '
  + 'codigo, referencia, custo_unitario, estoque_minimo, estoque_maximo, '
  + 'saldo_novo, saldo_usado, saldo, ativo, valor_total, situacao';

/**
 * Posição de estoque. A view já traz situação e valor calculados, então a tela
 * não recalcula nada. Filtro e busca ficam em memória (lib/catalogo.js): são
 * ~100 variantes, e paginar isso só atrapalharia quem procura um item.
 */
export async function listarPosicao({ incluirInativas = false } = {}) {
  let q = supabase.from('estoque_posicao').select(COLS_POSICAO);
  if (!incluirInativas) q = q.eq('ativo', true);
  const { data, error } = await q.order('descricao');
  if (error) throw new Error(`Não foi possível carregar o estoque: ${error.message}`);
  return data || [];
}

/** Itens do catálogo (sem variantes) — para agrupar e para o cadastro. */
export async function listarItens() {
  const { data, error } = await supabase
    .from('estoque_itens')
    .select('id, categoria, descricao, unidade, ativo')
    .order('descricao');
  if (error) throw new Error(`Não foi possível carregar os itens: ${error.message}`);
  return data || [];
}

/** Cria o item; se já existir a dupla (categoria, descrição), devolve o existente. */
export async function garantirItem({ categoria, descricao, unidade = 'un' }) {
  const nome = descricao.trim();
  const { data: achado } = await supabase
    .from('estoque_itens')
    .select('id')
    .eq('categoria', categoria)
    .ilike('descricao', nome)
    .maybeSingle();
  if (achado?.id) return achado.id;

  const { data, error } = await supabase
    .from('estoque_itens')
    .insert({ categoria, descricao: nome, unidade })
    .select('id');
  exigirLinha(data, error, 'Não foi possível cadastrar o item');
  return data[0].id;
}

export async function salvarItem({ id, descricao, unidade, ativo }) {
  const { data, error } = await supabase
    .from('estoque_itens')
    .update({ descricao: descricao?.trim(), unidade, ativo })
    .eq('id', id)
    .select('id');
  exigirLinha(data, error, 'Não foi possível salvar o item');
}

const nuloSeVazio = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};

const inteiroOuNulo = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

export async function criarVariante(dados) {
  const { data, error } = await supabase
    .from('estoque_variantes')
    .insert({
      item_id: dados.item_id,
      tamanho: nuloSeVazio(dados.tamanho),
      ca: nuloSeVazio(dados.ca),
      genero: nuloSeVazio(dados.genero),
      setor: nuloSeVazio(dados.setor),
      codigo: nuloSeVazio(dados.codigo),
      referencia: nuloSeVazio(dados.referencia),
      custo_unitario: dados.custo_unitario ?? null,
      estoque_minimo: inteiroOuNulo(dados.estoque_minimo) ?? 0,
      estoque_maximo: inteiroOuNulo(dados.estoque_maximo),
    })
    .select('id');
  if (error && /estoque_variantes_chave/.test(error.message)) {
    throw new Error('Esta variação já existe no catálogo (mesma descrição, tamanho, CA, gênero e setor).');
  }
  exigirLinha(data, error, 'Não foi possível cadastrar a variação');
  return data[0].id;
}

/**
 * Edição do cadastro da variante — mínimo, máximo, custo e ativo. O SALDO NÃO
 * ENTRA AQUI de propósito: saldo só muda por movimento, senão o histórico deixa
 * de explicar o número. Para corrigir contagem existe o inventário (/estoque/ajuste).
 */
export async function salvarVariante(id, { estoque_minimo, estoque_maximo, custo_unitario, ativo, codigo, referencia }) {
  const patch = {};
  if (estoque_minimo !== undefined) patch.estoque_minimo = inteiroOuNulo(estoque_minimo) ?? 0;
  if (estoque_maximo !== undefined) patch.estoque_maximo = inteiroOuNulo(estoque_maximo);
  if (custo_unitario !== undefined) {
    const n = Number(String(custo_unitario).replace(',', '.'));
    patch.custo_unitario = String(custo_unitario).trim() === '' || !Number.isFinite(n) ? null : n;
  }
  if (ativo !== undefined) patch.ativo = ativo;
  if (codigo !== undefined) patch.codigo = nuloSeVazio(codigo);
  if (referencia !== undefined) patch.referencia = nuloSeVazio(referencia);

  const { data, error } = await supabase
    .from('estoque_variantes').update(patch).eq('id', id).select('id');
  exigirLinha(data, error, 'Não foi possível salvar a variação');
}

/**
 * Lançamento de movimentos (entrada, saída, ajuste). Passa pela RPC porque é ela
 * que trava a variante (`for update`) e valida o saldo — dois atendentes
 * entregando o último capacete precisam ser serializados no banco, não no front.
 *
 * `movs` sai de lib/carrinho.js já com o sinal certo. `chamadoId` só quando a
 * saída quita um chamado do Adm sem fechá-lo.
 */
export async function lancarMovimentos(movs, chamadoId = null) {
  if (!movs?.length) throw new Error('Nenhum item para lançar.');
  const { data, error } = await supabase.rpc('estoque_lancar', {
    p_movs: movs, p_chamado: chamadoId,
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Baixa do estoque + fechamento do chamado do Adm, na MESMA transação.
 *
 * Mora aqui, e não em administrativo/lib/chamados.js, porque a RPC é do Estoque
 * e os dois pontos de entrada precisam dela: a tela de Saída (quando se escolhe
 * um chamado a quitar) e o card "Fechar chamado" do Adm. A dependência é de mão
 * única — o Adm importa do Estoque, nunca o contrário.
 *
 * Ou os dois acontecem, ou nenhum: fechar sem baixar deixa o saldo mentindo, e
 * baixar sem fechar entrega o EPI num chamado que continua aberto.
 *
 * A mensagem de erro da RPC já vem escrita para o usuário e nomeia o item — não
 * embrulhe. E `exigirLinha` NÃO se aplica: RPC com `raise exception` devolve
 * erro de verdade, não zero linhas.
 */
export async function baixarChamado(chamadoId, resolucao, movs) {
  const { data, error } = await supabase.rpc('estoque_baixa_chamado', {
    p_chamado: chamadoId, p_resolucao: (resolucao || '').trim(), p_itens: movs || [],
  });
  if (error) throw new Error(error.message);
  // Best-effort, como em todo fechamento do Adm: nunca derruba a ação.
  notificarChamadoAdm(chamadoId, 'fechado');
  return data;
}

/**
 * Histórico. Os nomes saem por RPC (nomes_colaboradores) porque a policy de
 * colaboradores só libera a própria linha, a equipe e o admin do DP — quem
 * recebeu o EPI raramente é subordinado de quem está olhando o relatório.
 */
export async function listarMovimentos({ varianteId, colaboradorId, chamadoId, de, ate, limite = 500 } = {}) {
  let q = supabase
    .from('estoque_movimentos')
    .select('id, tipo, quantidade, motivo, documento, observacao, criado_em, '
      + 'colaborador_id, chamado_id, registrado_por, '
      + 'estoque_variantes(id, tamanho, ca, genero, setor, estoque_itens(descricao, categoria)), '
      + 'chamados_adm(numero, servico)')
    .order('criado_em', { ascending: false })
    .limit(limite);

  if (varianteId) q = q.eq('variante_id', varianteId);
  if (colaboradorId) q = q.eq('colaborador_id', colaboradorId);
  if (chamadoId) q = q.eq('chamado_id', chamadoId);
  if (de) q = q.gte('criado_em', de);
  if (ate) q = q.lte('criado_em', ate);

  const { data, error } = await q;
  if (error) throw new Error(`Não foi possível carregar o histórico: ${error.message}`);

  const ids = [...new Set((data || [])
    .flatMap((m) => [m.colaborador_id, m.registrado_por]).filter(Boolean))];
  const nomes = new Map();
  if (ids.length) {
    const { data: pessoas } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    (pessoas || []).forEach((p) => nomes.set(p.id, p.nome));
  }

  return (data || []).map((m) => {
    const v = m.estoque_variantes || {};
    return {
      id: m.id,
      tipo: m.tipo,
      quantidade: m.quantidade,
      motivo: m.motivo,
      documento: m.documento,
      observacao: m.observacao,
      criado_em: m.criado_em,
      chamado_id: m.chamado_id,
      chamadoNumero: m.chamados_adm?.numero ?? null,
      chamadoServico: m.chamados_adm?.servico ?? '',
      colaboradorNome: nomes.get(m.colaborador_id) || '',
      registradoPorNome: nomes.get(m.registrado_por) || '',
      variante: {
        id: v.id,
        descricao: v.estoque_itens?.descricao || '',
        categoria: v.estoque_itens?.categoria || '',
        tamanho: v.tamanho, ca: v.ca, genero: v.genero, setor: v.setor,
      },
    };
  });
}

/** O que já saiu por um chamado — é o que impede a baixa em dobro na reabertura. */
export async function movimentosDoChamado(chamadoId) {
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('variante_id, quantidade, tipo')
    .eq('chamado_id', chamadoId);
  if (error) throw new Error(`Não foi possível ler as baixas do chamado: ${error.message}`);
  return data || [];
}

/** Pessoas para o campo "quem recebeu". RPC própria — ver a nota na migration. */
export async function listarPessoasEstoque() {
  const { data, error } = await supabase.rpc('estoque_pessoas');
  if (error) throw new Error(`Não foi possível carregar as pessoas: ${error.message}`);
  return data || [];
}

/** Chamados de EPI/uniforme em andamento que uma saída pode quitar. */
export async function listarChamadosElegiveis() {
  const { data, error } = await supabase.rpc('estoque_chamados_elegiveis');
  if (error) throw new Error(`Não foi possível carregar os chamados: ${error.message}`);
  return data || [];
}
