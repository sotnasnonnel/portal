import { supabase } from '../../../services/supabase';

/**
 * Leitura dos chamados do Adm para a Torre.
 *
 * Não reusa `listarQuadro` do Administrativo de propósito. Aquela traz nomes de
 * pessoas e a contagem de mensagens não lidas — duas idas a mais ao banco, para
 * dados que a matriz não desenha. E, principalmente, ela não pagina: a matriz
 * precisa da CONTAGEM certa, e uma resposta cortada em silêncio viraria um
 * número errado com cara de número certo.
 *
 * O RECORTE é da RLS, e ela é estreita: `chamados_adm_select` libera solicitante,
 * atendente, aprovador e time do Adm. Coordenador ou gerente de fora do Adm vê
 * quase nada — a tela avisa isso em vez de mostrar uma matriz vazia como se
 * fosse "não há chamados".
 */

/** Só o que a matriz usa. Trazer `campos` (jsonb) aqui seria carregar o dobro à toa. */
const CAMPOS = 'id, numero, classe, servico, assunto, status, criado_em, sla_vence_em, atendente_id';

/**
 * Lê a consulta inteira, em páginas de 1000.
 *
 * Mesmo motivo do lerTudo da Mobilização: o PostgREST corta em 1000 linhas sem
 * avisar. Aqui o estrago seria pior que uma lista curta — a matriz mostraria
 * "12 chamados" numa célula que tem 30, e ninguém teria como desconfiar.
 */
async function lerTudo(montarQuery, { pagina = 1000 } = {}) {
  const linhas = [];
  for (let de = 0; ; de += pagina) {
    const { data, error } = await montarQuery().range(de, de + pagina - 1);
    if (error) return { data: null, error };
    linhas.push(...(data || []));
    if (!data || data.length < pagina) return { data: linhas, error: null };
  }
}

/** Os status que a matriz desenha. Encerrado não entra — nem vem do banco. */
const ABERTOS = ['aguardando_aprovacao', 'aberto', 'em_atendimento', 'aguardando_solicitante'];

export async function listarChamadosAbertos() {
  const { data, error } = await lerTudo(() => supabase
    .from('chamados_adm')
    .select(CAMPOS)
    .in('status', ABERTOS)
    // Ordem total: paginar sem desempate deixa duas linhas de mesmo criado_em
    // trocarem de lugar entre páginas, e uma delas se perde na emenda.
    .order('criado_em', { ascending: true })
    .order('id'));

  if (error) throw new Error(`Não foi possível carregar os chamados: ${error.message}`);
  return data || [];
}

/**
 * Os chamados para a LISTA de Etapas da Torre.
 *
 * Difere de listarChamadosAbertos em duas coisas, ambas para casar com o lado
 * da mobilização na mesma tabela:
 *
 *  1. inclui os encerrados recentes, na MESMA janela de 15 dias que
 *     listarEtapasDoQuadro usa. Sem isso a lista misturaria dois recortes
 *     diferentes e a soma no rodapé não bateria com nada;
 *  2. resolve o nome do atendente, porque o filtro por pessoa é o eixo da
 *     reunião — cada um seleciona o próprio nome e apresenta a sua parte.
 */
export async function listarChamadosDaLista({ diasFechados = 15 } = {}) {
  const corte = new Date(Date.now() - diasFechados * 86400000).toISOString();

  const { data, error } = await lerTudo(() => supabase
    .from('chamados_adm')
    .select(`${CAMPOS}, fechado_em`)
    // O valor vai entre aspas porque o ISO tem pontos e dois-pontos, que são
    // separadores na sintaxe de filtro do PostgREST.
    .or(`status.in.(${ABERTOS.join(',')}),updated_at.gte."${corte}"`)
    .order('criado_em', { ascending: true })
    .order('id'));

  if (error) throw new Error(`Não foi possível carregar os chamados: ${error.message}`);

  const lista = data || [];
  const ids = [...new Set(lista.map((c) => c.atendente_id).filter(Boolean))];
  const nomes = new Map();
  if (ids.length) {
    const { data: pessoas } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    (pessoas || []).forEach((p) => nomes.set(p.id, p.nome));
  }

  return lista.map((c) => ({ ...c, atendenteNome: nomes.get(c.atendente_id) || '' }));
}
