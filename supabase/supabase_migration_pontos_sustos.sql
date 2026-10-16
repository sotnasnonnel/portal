-- Migration: sustos aleatórios do tema Halloween (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (16/10/2026). Quem escolhe o Halloween responde se quer
-- levar sustos aleatórios no portal (só no dia 30 de outubro; o front checa
-- o dia); a resposta mora em pontos_perfil.sustos
-- (começa em "não"). Os sustos em si são só do front
-- (src/components/Pontos/SustosHalloween.jsx).
-- pontos_meu_resumo passa a devolver perfil.sustos (corpo igual ao anterior,
-- com a chave nova).
-- Sem dependência de deploy. Já aplicada em 16/10/2026.
-- ============================================================================
alter table public.pontos_perfil add column if not exists sustos boolean not null default false;

create or replace function public.pontos_definir_sustos(p_ligar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := app_private.my_colaborador_id();
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  perform app_private.pontos_perfil_de(v_me);
  update public.pontos_perfil set sustos = coalesce(p_ligar, false), atualizado_em = now() where colaborador_id = v_me;
end $$;
revoke all on function public.pontos_definir_sustos(boolean) from public, anon;
grant execute on function public.pontos_definir_sustos(boolean) to authenticated;
-- (pontos_meu_resumo recriada com 'sustos' dentro de 'perfil'.)
