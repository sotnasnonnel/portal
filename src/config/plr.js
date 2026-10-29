/**
 * PLR — metas e resultados de cada setor (aba SETORES da plr.xlsx).
 *
 * Quem vê o quê é decidido no banco (supabase_migration_plr.sql), e chega aqui
 * pronto em `modules.plr`, que vem da RPC plr_acesso no login:
 *   - 'setor'        → o responsável do setor na planilha e a equipe dele pelo
 *                      organograma: cada um vê o setor do responsável mais
 *                      próximo acima de si (ou o próprio, se for o responsável).
 *   - 'visualizador' → todos os setores (Gerenciar acessos).
 *   - 'admin'        → todos os setores e a tela de edição. O super admin é
 *                      admin sempre; os demais, por Gerenciar acessos.
 *   - null           → sem setor no organograma: o card nem aparece.
 *
 * O gate daqui só controla a tela; quem filtra os setores é a RPC.
 */

// Ano exibido. As tabelas já guardam o ano: a aba "SETORES - 2027" entra como
// outra carga, e aí basta trocar aqui (ou ganhar um seletor).
export const PLR_ANO = 2026;

export const podeVerPlr = (modules) => !!modules?.plr;

export const podeEditarPlr = (modules) => modules?.plr === 'admin';

export const veTodosSetoresPlr = (modules) => modules?.plr === 'admin' || modules?.plr === 'visualizador';

export const PAPEL_PLR_LABEL = {
  admin: 'Admin',
  visualizador: 'Todos os setores',
  setor: 'Meu setor',
};
