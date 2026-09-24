-- ============================================================================
-- Administrativo — quem pode trocar o responsável de um chamado
--
-- Assumir chamado é pegar para si, e todo o time do Adm pode. Trocar o
-- responsável é mexer na fila alheia (e devolver o chamado à fila sem dono),
-- e é decisão de coordenação.
--
-- Vira CAPACIDADE PRÓPRIA em vez de papel: nenhum dos papéis existentes separa
-- esse grupo — Jarbas é admin e Daniela é atendente. E fica no banco, não numa
-- lista de e-mails no código, para não haver duas fontes divergindo.
--
-- Já aplicada em 29/08/2026.
-- ============================================================================

alter table public.colaboradores
  add column if not exists administrativo_reatribui boolean not null default false;

comment on column public.colaboradores.administrativo_reatribui is
  'Pode trocar o responsavel de um chamado do Adm, inclusive devolve-lo a fila. '
  'Assumir para si continua liberado a todo o time e nao depende deste campo.';

update public.colaboradores
   set administrativo_reatribui = true
 where email in ('jarbas.junior@phdengenharia.eng.br',
                 'daniela.sebrian@phdengenharia.eng.br');

create or replace function app_private.pode_reatribuir_adm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.colaboradores
     where auth_id = (select auth.uid()) and administrativo_reatribui
  )
$$;

-- A RLS enxerga só a linha NOVA; comparar com a ANTIGA é trabalho de gatilho.
-- Mesmo padrão da guarda de reabertura, que já mora nesta tabela.
create or replace function public.chamados_adm_guarda_reatribuicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.atendente_id is not distinct from old.atendente_id then
    return new;                       -- não mexeu no responsável
  end if;

  -- Sem usuário logado é manutenção pelo painel/service role, que já passa por
  -- cima da RLS de qualquer forma: barrar aqui só atrapalharia.
  if app_private.my_colaborador_id() is null then
    return new;
  end if;

  if app_private.pode_reatribuir_adm() then
    return new;                       -- coordenação: pode pôr no nome de qualquer um
  end if;

  -- Assumir para si segue liberado a todo o time do Adm.
  if new.atendente_id = app_private.my_colaborador_id() and app_private.is_adm_time() then
    return new;
  end if;

  raise exception 'Voce nao tem permissao para trocar o responsavel deste chamado.'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists chamados_adm_guarda_reatribuicao_trg on public.chamados_adm;
create trigger chamados_adm_guarda_reatribuicao_trg
  before update on public.chamados_adm
  for each row execute function public.chamados_adm_guarda_reatribuicao();

notify pgrst, 'reload schema';
