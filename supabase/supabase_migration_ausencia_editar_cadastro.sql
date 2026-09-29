-- Migration: RH edita modalidade e gestor pelo painel de Ausência (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do Maicon (29/09/2026): editar, no painel de Ausência Programada, a
-- modalidade (CLT / PJ / Sócio Cotista / Diretoria) e o gestor do profissional.
--
-- Esses dois campos NÃO são do controle de ausência — são do cadastro do
-- colaborador, e já se editam em Colaboradores → Listagem. O que muda aqui é
-- só o caminho: quem está conferindo saldo resolve na mesma tela, em vez de
-- trocar de módulo e procurar a pessoa de novo.
--
-- POR QUE UMA RPC, E NÃO UPDATE DIRETO: a RLS de `colaboradores` só deixa o
-- ADMIN do DP escrever. O RH da ausência (is_ausencia_rh) não é
-- necessariamente admin — o Maicon é, mas a permissão da tela não pode depender
-- disso. A RPC roda como dono e confere o papel na porta.
--
-- DUAS TRAVAS no gestor, porque trocar superior mexe no organograma inteiro
-- (cadeia de aprovação de chamados, visibilidade de horas, requisições do DP):
--   1. ninguém é gestor de si mesmo;
--   2. o novo gestor não pode estar ABAIXO da pessoa — isso fecharia um ciclo,
--      e um ciclo no organograma trava a subida da alçada em laço infinito.
--
-- A modalidade é validada contra a mesma lista da tela de cadastro. Texto livre
-- aqui viraria "Socio cotista", "SÓCIO", "clt" — e os filtros por modalidade
-- passariam a mentir.
-- ============================================================================

create or replace function public.ausencia_editar_cadastro(
  p_colaborador uuid,
  p_formato text default null,
  p_superior uuid default null,
  p_limpar_superior boolean default false
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_ausencia_rh() then
    raise exception 'Apenas o RH edita o cadastro por esta tela.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_colaborador is null then
    raise exception 'Colaborador não informado.';
  end if;

  if p_formato is not null and p_formato not in ('CLT', 'PJ', 'Sócio Cotista', 'Diretoria') then
    raise exception 'Modalidade inválida: %', p_formato;
  end if;

  if p_superior is not null then
    if p_superior = p_colaborador then
      raise exception 'Uma pessoa não pode ser gestora dela mesma.';
    end if;
    if p_superior in (select app_private.descendentes(p_colaborador)) then
      raise exception 'Este gestor está abaixo da pessoa no organograma — isso criaria um ciclo.';
    end if;
    if not exists (select 1 from public.colaboradores c where c.id = p_superior) then
      raise exception 'Gestor não encontrado.';
    end if;
  end if;

  update public.colaboradores c
     set formato = coalesce(p_formato, c.formato),
         -- `p_limpar_superior` existe porque null em p_superior significa "não
         -- mexe"; sem o sinalizador, tirar o gestor de alguém seria impossível.
         superior_id = case when p_limpar_superior then null
                            else coalesce(p_superior, c.superior_id) end
   where c.id = p_colaborador;

  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;
end $$;
revoke all on function public.ausencia_editar_cadastro(uuid, text, uuid, boolean) from public;
revoke execute on function public.ausencia_editar_cadastro(uuid, text, uuid, boolean) from anon;
grant execute on function public.ausencia_editar_cadastro(uuid, text, uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- Os candidatos a gestor, para o seletor da tela.
--
-- A RLS de colaboradores mostra ao RH da ausência apenas a própria linha e a
-- subárvore; sem esta função, o seletor viria quase vazio.
-- ----------------------------------------------------------------------------
create or replace function public.ausencia_pessoas_listar()
returns table (id uuid, nome text, funcao text, formato text, superior_id uuid, superior_nome text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.funcao, c.formato, c.superior_id, sup.nome
  from public.colaboradores c
  left join public.colaboradores sup on sup.id = c.superior_id
  where app_private.is_ausencia_rh()
    and c.ativo is distinct from false
  order by c.nome
$$;
revoke all on function public.ausencia_pessoas_listar() from public;
revoke execute on function public.ausencia_pessoas_listar() from anon;
grant execute on function public.ausencia_pessoas_listar() to authenticated;

notify pgrst, 'reload schema';
