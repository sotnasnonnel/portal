-- ============================================================================
-- Programas — ficha de ROI do Programa de Inovação 2026 e o Ranking.
-- (Aplicada no portal_phd em 2026-10-27, antes do deploy do front: a ficha e o
-- Ranking leem esta tabela.)
--
-- Origem: Programa_Inovacao_2026_ficha.html (mockup com os cálculos). Uma ficha
-- por registro do Campo de Ideias, preenchida por quem registrou.
--
-- Só os DADOS DIGITADOS ficam aqui. Horas poupadas, % de redução, ROI e as
-- posições do ranking são calculados na leitura (lib/roi.js): guardar o
-- resultado de uma conta que depende das outras fichas deixaria o ranking
-- desatualizado a cada ficha nova.
--
-- Nome da solução, responsável e área NÃO se repetem aqui: vêm do registro
-- (titulo, autor_id, setor). Duas cópias divergiriam na primeira edição.
--
-- Duas mãos na mesma linha, como na Alavanca:
--   CONTEÚDO (medições, facilidade, workshop) -> só quem registrou a ideia
--   VALIDAÇÃO (status, parecer)               -> só o admin do módulo
-- RLS decide quem escreve NA LINHA; quais colunas cada um toca é o trigger.
-- ============================================================================

create table if not exists public.programas_roi (
  id                uuid primary key default gen_random_uuid(),
  ideia_id          uuid not null unique references public.programas_ideias(id) on delete cascade,
  autor_id          uuid not null references public.colaboradores(id) on delete restrict,

  -- Elegibilidade: workshop é condição do programa, não do preenchimento.
  workshop          boolean,
  workshop_qual     text,
  problema          text,
  medicao_inicio    date,
  medicao_fim       date,

  -- Economia de tempo (por execução, na unidade escolhida).
  tempo_antes       numeric check (tempo_antes is null or tempo_antes >= 0),
  tempo_depois      numeric check (tempo_depois is null or tempo_depois >= 0),
  tempo_unidade     text check (tempo_unidade is null or tempo_unidade in ('minuto', 'hora', 'dia', 'semana')),
  tempo_execucoes   integer check (tempo_execucoes is null or tempo_execucoes >= 0),
  detalhe_tempo     text,

  -- Retorno financeiro no período. "Gasto atual" exclui o custo da solução.
  gasto_descricao   text,
  gasto_antes       numeric check (gasto_antes is null or gasto_antes >= 0),
  gasto_atual       numeric check (gasto_atual is null or gasto_atual >= 0),
  custo_solucao     numeric check (custo_solucao is null or custo_solucao >= 0),
  detalhe_financeiro text,

  -- Facilidade: 4 perguntas de 0 a 2 pontos (nota de 0 a 8).
  fac_desenvolver   smallint check (fac_desenvolver is null or fac_desenvolver between 0 and 2),
  fac_implantar     smallint check (fac_implantar is null or fac_implantar between 0 and 2),
  fac_treinamento   smallint check (fac_treinamento is null or fac_treinamento between 0 and 2),
  fac_autonomia     smallint check (fac_autonomia is null or fac_autonomia between 0 and 2),

  -- Validação da equipe de Inovação. Só ficha validada entra no ranking.
  validacao         text not null default 'pendente'
                      check (validacao in ('pendente', 'validada', 'recusada')),
  parecer           text,
  validado_por      uuid references public.colaboradores(id) on delete set null,
  validado_em       timestamptz,

  criado_em         timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Recusar sem dizer o porquê deixa o autor sem saber o que corrigir.
  constraint programas_roi_recusa_com_parecer
    check (validacao <> 'recusada' or coalesce(btrim(parecer), '') <> '')
);

create index if not exists programas_roi_autor_idx on public.programas_roi (autor_id);

-- ---------------------------------------------------------------------------
-- Trava por coluna.
--
-- Mexer nos números de uma ficha já validada a devolve para "pendente": senão o
-- autor valida uma versão e o ranking passa a mostrar outra.
--
-- coalesce em sou_autor: a comparação devolve NULL (e não false) quando a
-- sessão não tem colaborador vinculado, e `not NULL` não dispara o IF — a trava
-- passaria calada justamente para o chamador sem identidade.
-- ---------------------------------------------------------------------------
create or replace function app_private.programas_roi_protege()
returns trigger language plpgsql security definer set search_path to '' as $fn$
declare
  sou_admin boolean := coalesce(app_private.is_programas_admin(), false);
  sou_autor boolean;
  mudou_conteudo boolean;
begin
  if tg_op = 'INSERT' then
    -- Ficha nasce aguardando validação, seja quem for que a crie.
    new.validacao := 'pendente';
    new.parecer := null;
    new.validado_por := null;
    new.validado_em := null;
    return new;
  end if;

  sou_autor := coalesce(old.autor_id = app_private.my_colaborador_id(), false);

  if new.ideia_id is distinct from old.ideia_id
     or new.autor_id is distinct from old.autor_id
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Registro, autor e data de criacao da ficha nao podem ser alterados.';
  end if;

  mudou_conteudo := (
       new.workshop is distinct from old.workshop
    or new.workshop_qual is distinct from old.workshop_qual
    or new.problema is distinct from old.problema
    or new.medicao_inicio is distinct from old.medicao_inicio
    or new.medicao_fim is distinct from old.medicao_fim
    or new.tempo_antes is distinct from old.tempo_antes
    or new.tempo_depois is distinct from old.tempo_depois
    or new.tempo_unidade is distinct from old.tempo_unidade
    or new.tempo_execucoes is distinct from old.tempo_execucoes
    or new.detalhe_tempo is distinct from old.detalhe_tempo
    or new.gasto_descricao is distinct from old.gasto_descricao
    or new.gasto_antes is distinct from old.gasto_antes
    or new.gasto_atual is distinct from old.gasto_atual
    or new.custo_solucao is distinct from old.custo_solucao
    or new.detalhe_financeiro is distinct from old.detalhe_financeiro
    or new.fac_desenvolver is distinct from old.fac_desenvolver
    or new.fac_implantar is distinct from old.fac_implantar
    or new.fac_treinamento is distinct from old.fac_treinamento
    or new.fac_autonomia is distinct from old.fac_autonomia
  );

  if mudou_conteudo and not sou_autor then
    raise exception 'So quem registrou a solucao pode alterar a ficha de ROI.';
  end if;

  if not sou_admin and (
       new.validacao is distinct from old.validacao
    or new.parecer is distinct from old.parecer
    or new.validado_por is distinct from old.validado_por
    or new.validado_em is distinct from old.validado_em
  ) then
    raise exception 'So a equipe de Inovacao (admin do modulo) valida a ficha de ROI.';
  end if;

  if mudou_conteudo then
    new.validacao := 'pendente';
    new.validado_por := null;
    new.validado_em := null;
  end if;

  new.updated_at := now();
  return new;
end
$fn$;

drop trigger if exists programas_roi_protege on public.programas_roi;
create trigger programas_roi_protege
  before insert or update on public.programas_roi
  for each row execute function app_private.programas_roi_protege();

-- ---------------------------------------------------------------------------
-- RLS. Leitura aberta a todo logado: o Ranking é aberto, como o Painel da
-- Inovação. Criar só para registro próprio do Campo de Ideias.
-- ---------------------------------------------------------------------------
alter table public.programas_roi enable row level security;

drop policy if exists programas_roi_select on public.programas_roi;
create policy programas_roi_select on public.programas_roi
  for select to authenticated using (true);

drop policy if exists programas_roi_insert on public.programas_roi;
create policy programas_roi_insert on public.programas_roi
  for insert to authenticated
  with check (
    autor_id = app_private.my_colaborador_id()
    and exists (
      select 1 from public.programas_ideias i
      where i.id = ideia_id and i.autor_id = app_private.my_colaborador_id()
    )
  );

drop policy if exists programas_roi_update on public.programas_roi;
create policy programas_roi_update on public.programas_roi
  for update to authenticated
  using (autor_id = app_private.my_colaborador_id() or app_private.is_programas_admin())
  with check (autor_id = app_private.my_colaborador_id() or app_private.is_programas_admin());

drop policy if exists programas_roi_delete on public.programas_roi;
create policy programas_roi_delete on public.programas_roi
  for delete to authenticated
  using (autor_id = app_private.my_colaborador_id() or app_private.is_programas_admin());

grant select, insert, update, delete on public.programas_roi to authenticated;
revoke all on public.programas_roi from anon;
