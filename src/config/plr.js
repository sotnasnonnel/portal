/**
 * PLR — metas e resultados de cada setor (aba SETORES da plr.xlsx).
 *
 * Quem vê o quê é decidido no banco (supabase_migration_plr_papeis.sql), e chega
 * aqui pronto em `modules.plr`, que vem da RPC plr_acesso no login:
 *   - 'admin'   → tudo, e a tela de edição. O super admin é admin, a menos que
 *                 escolha outro papel para si; os demais, por Gerenciar acessos.
 *   - 'gestor'  → quem está em plr_setor_gestores: Metas por setor só do setor
 *                 dele; Resultado por pessoa só das pessoas do setor dele, com
 *                 salário.
 *   - 'usuario' → só o Resultado por pessoa: a própria linha e o cabeçalho do setor.
 *   - null      → nada disso: o card nem aparece.
 *
 * Gestor e usuário valem por chave geral, no banco, ou pessoa a pessoa em
 * Gerenciar acessos.
 *
 * O gate daqui só controla a tela; quem filtra setores e pessoas é o banco.
 */

// Ano exibido. As tabelas já guardam o ano: a aba "SETORES - 2027" entra como
// outra carga, e aí basta trocar aqui (ou ganhar um seletor).
export const PLR_ANO = 2026;

export const podeVerPlr = (modules) => !!modules?.plr;

export const podeEditarPlr = (modules) => modules?.plr === 'admin';

export const veTodosSetoresPlr = (modules) => modules?.plr === 'admin';

export const veSetoresPlr = (modules) => modules?.plr === 'admin' || modules?.plr === 'gestor';

// Onde o módulo abre: quem só tem a própria linha não tem setor para ver.
export const rotaInicialPlr = (modules) => (veSetoresPlr(modules) ? '/plr/setores' : '/plr/resultado');

export const PAPEL_PLR_LABEL = {
  admin: 'Admin',
  gestor: 'Gestor',
  usuario: 'Usuário',
};
