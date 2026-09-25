-- Migration: ajustar valores sem ser gestor (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido: o Patrick (atendente do Atendimento, perfil 'usuario') passa a editar
-- a tela "Ajustes de Valores" — e só ela.
--
-- Sem isto, a única forma seria torná-lo gestor no DP, o que abriria equipe,
-- requisições e o resto da Gestão de Pessoas. Mesma decisão, e mesmo desenho,
-- da flag `organograma_consulta` (supabase_migration_organograma_consulta.sql):
-- capacidade avulsa por pessoa, ligada na tela de Gerenciamento de acessos.
--
-- DIFERENÇA IMPORTANTE em relação àquela: lá a flag só abre TELA, porque os
-- dados vêm de views públicas. Aqui ela abre ESCRITA de verdade — quem tem a
-- flag grava em precos_itens —, então a policy do banco muda junto. Gate de
-- tela sozinho seria porta pintada: a RLS barraria o salvamento e a pessoa veria
-- os campos sem conseguir salvar.
--
-- Para derrubar:
--     alter table public.colaboradores drop column valores_ajuste;
--     -- e voltar a policy precos_itens_write para app_private.is_gestor_or_admin()
-- ============================================================================

alter table public.colaboradores
  add column if not exists valores_ajuste boolean not null default false;

comment on column public.colaboradores.valores_ajuste is
  'Libera SÓ a tela Ajustes de Valores (/valores) para quem não é gestor/admin do DP. Vale também no banco: entra na policy de escrita de precos_itens.';

-- ----------------------------------------------------------------------------
-- Quem pode mexer nos preços: gestor/admin do DP (como antes) OU a flag.
--
-- Função nova em vez de mudar `is_gestor_or_admin()`: aquela responde "esta
-- pessoa é gestor ou admin?" e é usada para outras coisas; alterá-la para
-- incluir a flag faria o Patrick virar gestor aos olhos de todo o resto.
-- ----------------------------------------------------------------------------
create or replace function app_private.pode_ajustar_valores()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid())
      and (perfil in ('gestor', 'admin') or valores_ajuste is true)
  )
$$;
revoke all on function app_private.pode_ajustar_valores() from public;
revoke execute on function app_private.pode_ajustar_valores() from anon;
grant execute on function app_private.pode_ajustar_valores() to authenticated;

drop policy if exists precos_itens_write on public.precos_itens;
create policy precos_itens_write on public.precos_itens
for all to authenticated
using (app_private.pode_ajustar_valores())
with check (app_private.pode_ajustar_valores());

-- PostgREST guarda o schema em cache; sem isso o front não enxerga a coluna
-- nova em colaboradores.
notify pgrst, 'reload schema';
