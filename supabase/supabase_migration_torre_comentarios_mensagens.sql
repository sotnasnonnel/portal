-- Torre de Controle: comentários das etapas e última mensagem dos chamados
-- ============================================================================
-- NÃO APLICADO. Escrito em 14/09/2026 com a conexão do Supabase fora do ar.
-- O front já chama estas duas funções e cai para "sem comentários" se elas não
-- existirem — mas o pedido só fica atendido depois de rodar este arquivo.
--
-- O PEDIDO (André, 11/09/2026)
--
--   "No popup de detalhe de cada etapa, retirar a coluna de informações do
--    responsável e trazer os comentários. No caso do detalhe para os chamados,
--    substituir a coluna de responsável pela última mensagem do chat entre ADM
--    e solicitante."
--
-- POR QUE FUNÇÃO, E NÃO SELECT DIRETO NAS TABELAS
--
-- Pelo mesmo motivo de supabase_migration_torre_leitura.sql. Quem abre a Torre
-- é coordenação, gerência e diretoria, e a RLS das tabelas de origem não os
-- deixa ler nada disso:
--
--   mobilizacao_etapa_comentarios  -> time do Adm e envolvidos no processo
--   chamados_adm_interacoes        -> participantes do chamado
--
-- Um gerente veria o popup vazio, calado. E alargar essas policies abriria a
-- conversa inteira de todo chamado para 39 pessoas.
--
-- O QUE SAI, E O QUE FICA DE FORA DE PROPÓSITO
--
--   * Nota interna NUNCA sai (`interna = false`). É conversa do Adm consigo
--     mesmo, e a audiência da Torre inclui gente de fora do Adm. Este é o filtro
--     mais importante do arquivo.
--   * Anexo sai só como CONTAGEM, sem caminho. Comentário de mobilização carrega
--     ASO, guia de exame e contrato; a Torre é tela de consulta de reunião, e
--     um link aqui daria documento de pessoa a quem só precisa saber que existe.
--   * Só entra comentário de processo EM ANDAMENTO — o mesmo recorte de
--     torre_etapas(). Passar o id de uma etapa encerrada não devolve nada.
--
-- O conteúdo das mensagens é texto livre e pode conter dado pessoal. Isso foi
-- aceito no pedido: a última mensagem é justamente o que a reunião quer ler.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Comentários das etapas (popup do processo)
-- ---------------------------------------------------------------------------
create or replace function public.torre_comentarios_etapas(p_etapas uuid[])
returns table (
  etapa_id uuid, autor_id uuid, texto text, qtd_anexos int, created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select k.etapa_id, k.autor_id, k.texto,
         jsonb_array_length(k.anexos)::int, k.created_at
    from public.mobilizacao_etapa_comentarios k
    join public.mobilizacao_etapas e    on e.id = k.etapa_id
    join public.mobilizacao_processos p on p.id = e.processo_id
   where app_private.pode_torre()
     and k.etapa_id = any(p_etapas)
     and p.status = 'em_andamento'
   order by k.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 2. Última mensagem de cada chamado (popup dos chamados)
--
-- "Última" = a mais recente que NÃO é nota interna. `do_solicitante` diz de que
-- lado veio: na reunião, a pergunta seguinte a "o que foi dito?" é "a bola está
-- com quem?".
-- ---------------------------------------------------------------------------
create or replace function public.torre_ultima_mensagem_chamados(p_chamados uuid[])
returns table (
  chamado_id uuid, autor_id uuid, mensagem text, qtd_anexos int,
  created_at timestamptz, do_solicitante boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct on (i.chamado_id)
         i.chamado_id, i.autor_id, i.mensagem,
         jsonb_array_length(i.anexos)::int, i.created_at,
         (i.autor_id = c.solicitante_id)
    from public.chamados_adm_interacoes i
    join public.chamados_adm c on c.id = i.chamado_id
   where app_private.pode_torre()
     and i.chamado_id = any(p_chamados)
     and i.interna = false
   order by i.chamado_id, i.created_at desc;
$$;

revoke execute on function public.torre_comentarios_etapas(uuid[]) from anon;
revoke execute on function public.torre_ultima_mensagem_chamados(uuid[]) from anon;
grant execute on function public.torre_comentarios_etapas(uuid[]) to authenticated;
grant execute on function public.torre_ultima_mensagem_chamados(uuid[]) to authenticated;

notify pgrst, 'reload schema';
