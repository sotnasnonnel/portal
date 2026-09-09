import { supabase } from './supabase';

/**
 * Ids de toda a equipe do usuário logado: subordinados diretos + as equipes
 * dos coordenadores abaixo (RPC recursiva get_minha_equipe).
 */
export async function getEquipeIds() {
  const { data, error } = await supabase.rpc('get_minha_equipe');
  if (error) throw error;
  return (data || []).map((r) => r.id);
}

/**
 * Ids que alimentam a FILA de aprovação de ausência — que é outra pergunta:
 * "quem eu decido", e não "quem está abaixo de mim".
 *
 * Para quase todo mundo dá o mesmo que getEquipeIds(): o gestor de um
 * coordenador precisa decidir a ausência da equipe do coordenador. A diferença
 * aparece em quem está no topo do organograma, onde a árvore recursiva deixa de
 * ser uma equipe e vira a empresa inteira — a pessoa recebia como pendência
 * dela a ausência de gente três e quatro níveis abaixo, que já tem gestor
 * imediato. A saída é por pessoa (colaboradores.ausencias_apenas_diretos), e
 * quem decide é o banco: ver supabase_migration_ausencias_apenas_diretos.sql.
 */
export async function getEquipeAprovacaoIds() {
  const { data, error } = await supabase.rpc('get_minha_equipe_aprovacoes');
  if (error) throw error;
  return (data || []).map((r) => r.id);
}
