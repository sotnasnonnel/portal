import { isSuperAdmin } from './superAdmin.js';

/**
 * "Ver como" — o mesmo do HUB PHD (app-phd/src/context/verComo.js), pedido em
 * 16/11/2026: o super admin escolhe uma pessoa e o portal passa a entregar às
 * telas o `user` e os `modules` DELA (perfil, papéis, checkboxes de acesso).
 * Toda regra de tela — cards da Home, menus, guardas de rota — já lê o
 * AuthContext, então nenhuma tela precisa saber que é simulação.
 *
 * O QUE NÃO MUDA: a sessão do banco continua sendo a do super admin. O que a
 * RLS filtra por pessoa chega como ele vê, não como a pessoa veria. Exceção: o
 * módulo TI recorta pela árvore da pessoa simulada (ti_emails_visiveis_de). A
 * faixa do ver como avisa disso.
 *
 * SOMENTE LEITURA enquanto durar (services/supabase.js).
 *
 * Só para o super admin, decidido pelo usuário REAL, nunca pelo simulado.
 */
export const podeVerComo = (usuarioReal) => isSuperAdmin(usuarioReal);

export const CHAVE_SESSAO_VER_COMO = 'portal:verComo';

/**
 * RPCs que só LEEM e podem rodar no ver como. Qualquer outra é bloqueada pelo
 * cliente (services/supabase.js). Ao criar uma RPC de leitura nova, inclua aqui;
 * se esquecer, a tela dela só vem vazia durante o ver como.
 */
export const RPCS_LEITURA = new Set([
  'alavanca_checar_base', 'alavanca_indicacao_anterior',
  'alcadas_area_colaborador', 'alcadas_resolver_papeis',
  'aniversariantes_mes',
  'ausencia_adicional_equipe', 'ausencia_adicional_listar',
  'avisos_listar', 'avisos_obter',
  'candidatos_listar',
  'chamados_adm_ausencias', 'chamados_adm_cadeia', 'chamados_adm_centro_custo', 'chamados_adm_pessoas', 'chamados_adm_time',
  'desligamento_ciencia_minhas',
  'estoque_chamados_elegiveis', 'estoque_pessoas',
  'feed_comentarios_listar', 'feed_curtidas_listar', 'feed_curtidas_resumo', 'feed_denuncias_listar',
  'feed_destaques_semana', 'feed_diretorio', 'feed_listar', 'feed_novidades', 'feed_pessoas',
  'feed_pode_marcar_todos', 'feed_termos_aceite',
  'financeiro_colaboradores_pool',
  'folga_campo_listar', 'folga_campo_meu_aprovador',
  'get_calendario_ausencias_global', 'get_minha_equipe', 'get_minha_equipe_aprovacoes',
  'horas_acesso_projeto', 'horas_colaboradores', 'horas_projetos_visiveis',
  'horas_extras_auditoria_listar', 'horas_extras_colaboradores', 'horas_extras_excecao_aplicavel',
  'horas_extras_listar', 'horas_extras_meu_aprovador',
  'humor_meu_registro_hoje', 'humor_respostas', 'humor_resumo',
  'mobilizacao_ausencias', 'mobilizacao_dados_do_ct', 'mobilizacao_onde_esta',
  'nomes_colaboradores',
  'parabens_mural',
  'plr_acesso', 'plr_mult_empresa', 'plr_painel',
  'pontos_extrato', 'pontos_meu_resumo', 'pontos_visuais',
  'ti_pessoas', 'ti_emails_visiveis_de', 'ti_meu_termo',
]);
