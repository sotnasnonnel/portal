-- ============================================================================
-- Novidades da plataforma: "o que mudou desde a sua última visita"
-- (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- O portal muda toda semana e ninguém avisava: quem entrava encontrava um card
-- com outro nome e descobria sozinho. Agora a Home abre uma vez o que mudou.
--
-- Guarda o ID da ÚLTIMA versão vista (texto, ex.: '2026-09-01-dados-horas'), e
-- não um booleano: a lista de novidades cresce, e o que importa é onde a pessoa
-- parou. O catálogo em si vive no código (src/config/novidades.js) — é conteúdo
-- editorial, versionado junto com a mudança que ele anuncia; o banco só guarda
-- por onde cada pessoa passou.
--
-- Por pessoa e não por navegador: quem usa o computador do escritório e o de
-- casa veria o mesmo aviso duas vezes se isso morasse no localStorage.
-- ============================================================================

alter table public.colaboradores
  add column if not exists novidades_visto_id text;

-- RPC: marca a última novidade vista pelo usuário logado.
-- SECURITY DEFINER pelo mesmo motivo do solic_marcar_visto: a policy de escrita
-- em colaboradores é do admin (colaboradores_admin_write), e aqui cada pessoa
-- precisa carimbar a PRÓPRIA linha — a função restringe por auth.uid(), então
-- ninguém marca a linha de outro.
create or replace function public.novidades_marcar_visto(p_id text)
returns void language sql security definer set search_path = '' as $$
  update public.colaboradores
     set novidades_visto_id = p_id
   where auth_id = (select auth.uid());
$$;
revoke all on function public.novidades_marcar_visto(text) from public;
grant execute on function public.novidades_marcar_visto(text) to authenticated;
