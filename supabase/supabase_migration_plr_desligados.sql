-- Migration: PLR, os desligados que têm valor voltam (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (05/11/2026): trazer de volta os desligados da aba CALCULO PLR,
-- só os que têm valor. Muda a decisão de 04/11 ("desligados não entram").
--
-- Têm valor os que a coluna TEMPO TR da planilha não zera. Ela zera quem saiu por
-- iniciativa do profissional, quem não tem data de demissão e quem ficou menos de 4
-- meses no ano. Em 05/11, 11 dos 43 desligados têm valor.
--
-- Decisões (05/11/2026):
--   - O tempo conta até o dia da demissão, como na planilha (calculo.ts).
--   - Sem login: desligado entra com colaborador_id nulo, porque o cadastro dele
--     está desativado e o filtro de plr_pessoas_visiveis esconderia a linha. Quem
--     vê é o admin e o gestor do setor.
--   - O CT GDB (gerência do Diego Bernardes) só tem desligados e não é setor no HUB:
--     conta como Operação Leonardo (o mapa fica em docs/gerar_carga_plr_pessoas.cjs).
--
-- Ordem. A carga é a última de propósito: antes da Edge Function nova, o desligado
-- apareceria com o ano inteiro de tempo.
--   1. esta migração;
--   2. deploy das Edge Functions plr-calculo e plr-total-colaboradores (esta com
--      --no-verify-jwt);
--   3. a carga (node docs/gerar_carga_plr_pessoas.cjs, depois o SQL gerado);
--   4. deploy do front (rótulo "Desligamento em").
--
-- Pré-requisito: supabase_migration_plr_papeis.sql.
-- ============================================================================

alter table public.plr_pessoas add column if not exists data_demissao date;

-- Igual a supabase_migration_plr_papeis.sql, com data_demissao nas colunas.
create or replace function public.plr_pessoas_visiveis(p_ano integer)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu uuid := app_private.plr_eu();
  v_papel text := public.plr_acesso(p_ano);
begin
  if v_eu is null and not app_private.is_portal_super_admin() then
    raise exception 'Só colaboradores ativos veem o PLR.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'papel', v_papel,
    've_todos', v_papel is not distinct from 'admin',
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'nome', p.nome,
               'cod_ct', p.cod_ct,
               'setor_hub', p.setor_hub,
               'cargo_plr', p.cargo_plr,
               'salario', p.salario,
               'data_admissao', p.data_admissao,
               'data_demissao', p.data_demissao,
               'hub_chave', p.hub_chave)
             order by p.nome)
        from public.plr_pessoas p
        left join public.colaboradores c on c.id = p.colaborador_id
       where p.ano = p_ano
         and c.ativo is distinct from false
         and (v_papel = 'admin'
              or (v_papel in ('gestor', 'usuario') and p.colaborador_id = v_eu)
              or (v_papel = 'gestor'
                  and p.setor_hub in (select st.setor_hub from public.plr_setores st
                                       where st.id in (select app_private.plr_setores_visiveis(p_ano)))))
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.plr_pessoas_visiveis(integer) from public, anon;
grant execute on function public.plr_pessoas_visiveis(integer) to authenticated;
