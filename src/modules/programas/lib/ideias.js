import { supabase } from '../../../services/supabase';
import { notificarPrograma } from '../../../services/notificarPrograma';

/**
 * Acesso a dados do Campo de Ideias. Mesmo formato do lib/chamados.js do
 * Administrativo: as telas não falam com o supabase direto, e todo erro vira
 * mensagem em português antes de subir.
 */

const COLUNAS = `
  id, numero, tipo, titulo, categoria, retorno, situacao,
  descricao, problema, beneficios,
  data_inicio, setor, ferramentas, finalidade,
  link, observacoes, autor_id, criado_em, updated_at
`;

/**
 * Nome do autor vem numa segunda consulta, pela RPC `nomes_colaboradores`.
 *
 * Um join (ou um select direto em colaboradores) devolveria vazio para quase
 * todo mundo: a policy colaboradores_select só libera a própria linha, os
 * subordinados e o admin — e o painel do Campo de Ideias é aberto a todos, com
 * autores de qualquer área. A RPC é SECURITY DEFINER e expõe só (id, nome),
 * apenas dos ids informados.
 */
async function anexarAutores(linhas) {
  const ids = [...new Set(linhas.map((l) => l.autor_id).filter(Boolean))];
  if (!ids.length) return linhas.map((l) => ({ ...l, autorNome: '' }));
  const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
  const nomes = new Map((data || []).map((p) => [p.id, p.nome]));
  return linhas.map((l) => ({ ...l, autorNome: nomes.get(l.autor_id) || '' }));
}

/** Tudo do Campo de Ideias — o painel é aberto a todos (RLS: select true). */
export async function listarIdeias() {
  const { data, error } = await supabase
    .from('programas_ideias')
    .select(COLUNAS)
    .order('criado_em', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar o Campo de Ideias: ${error.message}`);
  return anexarAutores(data || []);
}

/**
 * Grava ideia ou iniciativa. O CHECK do banco (programas_ideias_campos_por_tipo)
 * é quem garante os campos obrigatórios de cada forma; aqui só limpamos o que
 * não pertence à forma escolhida, para não gravar sobra de um formulário no
 * outro quando a pessoa troca de aba.
 */
export async function criarIdeia(valores, autorId) {
  const ehIniciativa = valores.tipo === 'iniciativa';
  const linha = {
    tipo: valores.tipo,
    titulo: (valores.titulo || '').trim(),
    categoria: valores.categoria,
    retorno: (valores.retorno || '').trim(),
    situacao: ehIniciativa ? valores.situacao : 'idealizado',
    descricao: ehIniciativa ? null : (valores.descricao || '').trim(),
    problema: ehIniciativa ? null : (valores.problema || '').trim(),
    beneficios: ehIniciativa ? null : (valores.beneficios || '').trim(),
    data_inicio: ehIniciativa ? valores.data_inicio : null,
    setor: ehIniciativa ? valores.setor : null,
    ferramentas: ehIniciativa ? (valores.ferramentas || []).map((f) => f.trim()).filter(Boolean) : [],
    finalidade: ehIniciativa ? (valores.finalidade || '').trim() : null,
    link: (valores.link || '').trim() || null,
    observacoes: (valores.observacoes || '').trim() || null,
    autor_id: autorId,
  };

  const { data, error } = await supabase
    .from('programas_ideias')
    .insert([linha])
    .select('id, numero, tipo, titulo')
    .single();
  if (error) throw new Error(`Não foi possível registrar: ${error.message}`);

  // Evento e e-mail são best-effort: o registro já está gravado, e falhar aqui
  // não pode desfazer o que a pessoa acabou de enviar.
  await supabase.from('programas_ideias_eventos').insert([{
    ideia_id: data.id, tipo: 'criada', autor_id: autorId, para: linha.situacao,
  }]);
  notificarPrograma('ideia_nova', { ideia_id: data.id });

  return data;
}

/**
 * Troca a situação (o "botão atualizar status" do mapa). Devolve a linha nova
 * para a tela repintar sem recarregar tudo.
 *
 * A RLS deixa passar autor e admin do módulo. UPDATE barrado pela RLS não dá
 * erro no PostgREST — ele simplesmente não afeta linha nenhuma —, então a
 * ausência de retorno é tratada aqui como recusa, não como sucesso silencioso.
 */
export async function atualizarSituacao(ideia, novaSituacao, autorId) {
  if (ideia.situacao === novaSituacao) return ideia;

  const { data, error } = await supabase
    .from('programas_ideias')
    .update({ situacao: novaSituacao, updated_at: new Date().toISOString() })
    .eq('id', ideia.id)
    .select(COLUNAS)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível atualizar a situação: ${error.message}`);
  if (!data) {
    throw new Error('Você não pode alterar a situação deste registro. Só o autor e o administrador do módulo podem.');
  }

  await supabase.from('programas_ideias_eventos').insert([{
    ideia_id: ideia.id, tipo: 'status', autor_id: autorId, de: ideia.situacao, para: novaSituacao,
  }]);
  notificarPrograma('ideia_status', { ideia_id: ideia.id, de: ideia.situacao, para: novaSituacao });

  return { ...data, autorNome: ideia.autorNome };
}
