-- Migration: gatilho Administrativo -> Mobilização (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- O chamado de mobilização do Adm passa a ABRIR o processo aqui.
--
-- Arquivo SEPARADO de supabase_migration_mobilizacao.sql de propósito: é a
-- única parte que toca uma tabela de outro módulo, e é a mudança mais arriscada
-- da entrega. Assim ela pode ser derrubada sozinha:
--
--     drop trigger if exists mobilizacao_do_chamado_ins on public.chamados_adm;
--     drop trigger if exists mobilizacao_do_chamado_upd on public.chamados_adm;
--     drop trigger if exists mobilizacao_encerra_chamado on public.chamados_adm;
--
-- POR QUE GATILHO, E NÃO CHAMADA NA TELA:
--   * Vale por qualquer caminho — abertura pela tela, aprovação de alçada,
--     correção manual no banco, reprocessamento. É a mesma escolha já feita e
--     justificada em supabase_migration_notificacoes.sql ("uma tela nova não
--     tem como esquecer de notificar") e em chamados_adm_eventos.
--   * É atômico com o chamado.
--   * Mantém a dependência de mão única: nenhum dos dois módulos JS importa o
--     outro.
--
-- A CONTRAPARTIDA, e a defesa contra ela: um erro aqui não pode impedir a
-- abertura de um chamado. Por isso o corpo inteiro roda dentro de
-- `exception when others`, que registra em mobilizacao_gatilho_falhas e segue.
-- Falha silenciosa seria pior, então a lista de falhas é lida pela tela e tem
-- botão de reprocessar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Movimento -> fluxo
--    Espelho de src/modules/mobilizacao/lib/gatilho.js, que é testado contra a
--    lista MOVIMENTOS do formulário do Adm — o teste quebra se aparecer um
--    movimento novo sem fluxo, que é justamente o erro que passaria calado aqui.
--
--    "Movimentação de profissional" cai em mobilizacao_pessoa: é uma
--    mobilização em outro local, com alguns passos a menos. Um quarto fluxo
--    duplicaria a lista inteira de etapas para omitir três — a coluna `condicao`
--    do catálogo resolve isso sem deploy.
-- ----------------------------------------------------------------------------
create or replace function app_private.mob_fluxo_do_movimento(p_movimento text)
returns text language sql immutable set search_path = '' as $$
  select case p_movimento
    when 'Nova mobilização'             then 'mobilizacao_pessoa'
    when 'Movimentação de profissional' then 'mobilizacao_pessoa'
    when 'Desmobilização'               then 'desmobilizacao_pessoa'
    else null
  end
$$;

-- ----------------------------------------------------------------------------
-- 2) Tradução dos campos do chamado
--    As chaves de origem são as de
--    src/modules/administrativo/app/novo/formularios/mobilizacao.js, gravadas
--    no jsonb chamados_adm.campos. Mapa EXPLÍCITO, e não um passe adiante do
--    jsonb inteiro: assim renomear um campo lá aparece como campo vazio aqui,
--    e não como um processo com colunas erradas.
-- ----------------------------------------------------------------------------
create or replace function app_private.mob_dados_do_chamado(p_campos jsonb, p_solicitante uuid)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'profissional_id',   nullif(p_campos ->> 'profissional_id', ''),
    'profissional_nome', nullif(btrim(coalesce(p_campos ->> 'profissional', '')), ''),
    'local_obra',        nullif(btrim(coalesce(p_campos ->> 'local_obra', '')), ''),
    'cod_ct',            nullif(btrim(coalesce(p_campos ->> 'cc', '')), ''),
    'ger_phd',           nullif(btrim(coalesce(p_campos ->> 'gestor', '')), ''),
    'cliente_phd',       nullif(btrim(coalesce(p_campos ->> 'cliente', '')), ''),
    'cliente_final',     nullif(btrim(coalesce(p_campos ->> 'cliente_final', '')), ''),
    'empresa_phd',       nullif(btrim(coalesce(p_campos ->> 'empresa_phd', '')), ''),
    -- Não tem coluna própria (só a mobilização de pessoa o coleta), então vai
    -- para o jsonb de campos em vez de ser descartado calado.
    'campos',            case when nullif(btrim(coalesce(p_campos ->> 'contato_cliente', '')), '') is null
                              then null
                              else jsonb_build_object('contato_cliente', btrim(p_campos ->> 'contato_cliente'))
                         end,
    -- A data-base sai de campos DIFERENTES conforme o movimento: mobilização
    -- usa a data de início no cliente, desmobilização usa a data em que a
    -- pessoa sai. Antes só existia a primeira, e por isso a desmobilização
    -- nascia sem prazo em passo NENHUM. Espelha dataBaseDoChamado em
    -- src/modules/mobilizacao/lib/gatilho.js.
    'data_base',         coalesce(
                           nullif(p_campos ->> 'data_desmobilizacao', ''),
                           nullif(p_campos ->> 'data_inicio_cliente', '')
                         ),
    'solicitante_id',    p_solicitante::text,
    -- O movimento não vira coluna, mas precisa viajar: é o que a `condicao` do
    -- catálogo consulta para decidir quais etapas nascem.
    'movimento',         nullif(p_campos ->> 'movimento', '')
  ))
$$;

-- ----------------------------------------------------------------------------
-- 3) O gatilho
-- ----------------------------------------------------------------------------
create or replace function public.mobilizacao_do_chamado_adm()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_fluxo text;
  v_id uuid;
begin
  begin
    v_fluxo := app_private.mob_fluxo_do_movimento(new.campos ->> 'movimento');

    -- Movimento novo no Adm não pode derrubar a abertura do chamado. Registra e
    -- sai: a lista de falhas é o aviso, e o botão "reprocessar" é o conserto
    -- depois que o mapa acima for atualizado.
    if v_fluxo is null then
      insert into public.mobilizacao_gatilho_falhas (chamado_id, erro)
      values (new.id, format('Movimento sem fluxo mapeado: %L', new.campos ->> 'movimento'));
      return null;
    end if;

    v_id := app_private.mob_abrir(
      v_fluxo,
      app_private.mob_dados_do_chamado(new.campos, new.solicitante_id),
      'adm',
      new.id
    );
  exception when others then
    -- O bloco `begin ... exception` é uma subtransação: o que falhou aqui é
    -- desfeito, e o INSERT do chamado que disparou o gatilho continua de pé.
    insert into public.mobilizacao_gatilho_falhas (chamado_id, erro)
    values (new.id, sqlerrm);
    raise warning 'Mobilização: falha ao abrir processo do chamado % — %', new.id, sqlerrm;
  end;

  return null;
end $$;

-- Chamado sem alçada já nasce 'aberto'.
drop trigger if exists mobilizacao_do_chamado_ins on public.chamados_adm;
create trigger mobilizacao_do_chamado_ins
  after insert on public.chamados_adm
  for each row
  when (new.classe = 'mobilizacao'
        and new.origem_chamado_id is null
        and new.status = 'aberto')
  execute function public.mobilizacao_do_chamado_adm();

-- Chamado COM alçada só vira processo depois da aprovação — mesma regra do
-- passo 10 do POP, em que o SLA do chamado também só começa a contar aí.
drop trigger if exists mobilizacao_do_chamado_upd on public.chamados_adm;
create trigger mobilizacao_do_chamado_upd
  after update of status on public.chamados_adm
  for each row
  when (new.classe = 'mobilizacao'
        and new.origem_chamado_id is null
        and old.status = 'aguardando_aprovacao'
        and new.status = 'aberto')
  execute function public.mobilizacao_do_chamado_adm();

-- `origem_chamado_id is null` nos dois `when` é o que impede os FILHOS do
-- desdobramento (ti/solicitacao-equipamentos, saude-seguranca/epi...) de gerar
-- processo. A classe deles já é outra, mas a guarda dupla é barata e explícita.

-- ----------------------------------------------------------------------------
-- 4) Encerramento espelhado
--    Sem isto o quadro acumularia processos de chamados que morreram.
-- ----------------------------------------------------------------------------
create or replace function public.mobilizacao_encerra_do_chamado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.mobilizacao_processos where origem_chamado_id = new.id;
  if v_id is null then return null; end if;

  update public.mobilizacao_processos
     set status = 'cancelado', updated_at = now()
   where id = v_id and status <> 'cancelado';

  insert into public.mobilizacao_eventos (processo_id, tipo, autor_id, para, dados)
  values (v_id, 'cancelado', app_private.my_colaborador_id(), 'cancelado',
          jsonb_build_object('motivo', format('Chamado #%s %s', new.numero, new.status)));

  return null;
end $$;

drop trigger if exists mobilizacao_encerra_chamado on public.chamados_adm;
create trigger mobilizacao_encerra_chamado
  after update of status on public.chamados_adm
  for each row
  when (new.classe = 'mobilizacao'
        and new.status in ('reprovado', 'cancelado')
        and old.status not in ('reprovado', 'cancelado'))
  execute function public.mobilizacao_encerra_do_chamado();

-- ----------------------------------------------------------------------------
-- 5) Reprocessar
--    Serve para duas coisas: consertar uma falha registrada (depois de corrigir
--    o catálogo ou o mapa de movimento) e alcançar os chamados de mobilização
--    que já existiam antes deste gatilho.
-- ----------------------------------------------------------------------------
create or replace function public.mobilizacao_reprocessar_chamado(p_chamado uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c record;
  v_fluxo text;
  v_id uuid;
begin
  if not app_private.is_adm_time() then
    raise exception 'Só o time do Administrativo pode reprocessar um chamado.'
      using errcode = 'insufficient_privilege';
  end if;

  select id, classe, campos, solicitante_id, status
    into c
    from public.chamados_adm
   where id = p_chamado;

  if c.id is null then raise exception 'Chamado não encontrado.'; end if;
  if c.classe <> 'mobilizacao' then raise exception 'O chamado não é de mobilização.'; end if;
  if c.status = 'aguardando_aprovacao' then
    raise exception 'O chamado ainda está em aprovação — o processo nasce depois dela.';
  end if;

  v_fluxo := app_private.mob_fluxo_do_movimento(c.campos ->> 'movimento');
  if v_fluxo is null then
    raise exception 'Movimento sem fluxo mapeado: %', coalesce(c.campos ->> 'movimento', '(vazio)');
  end if;

  -- mob_abrir é idempotente por origem_chamado_id: reprocessar duas vezes
  -- devolve o mesmo processo em vez de criar um segundo.
  v_id := app_private.mob_abrir(
    v_fluxo, app_private.mob_dados_do_chamado(c.campos, c.solicitante_id), 'adm', c.id);

  update public.mobilizacao_gatilho_falhas
     set resolvido_em = now()
   where chamado_id = p_chamado and resolvido_em is null;

  return v_id;
end $$;
revoke all on function public.mobilizacao_reprocessar_chamado(uuid) from public;
revoke execute on function public.mobilizacao_reprocessar_chamado(uuid) from anon;
grant execute on function public.mobilizacao_reprocessar_chamado(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6) Retroalimentação
--    Os chamados de mobilização abertos ANTES deste gatilho não têm processo.
--    Rode este bloco UMA VEZ, logo após aplicar a migration. Ele é seguro de
--    repetir (mob_abrir é idempotente por chamado), mas não precisa.
-- ----------------------------------------------------------------------------
do $$
declare
  c record;
  v_fluxo text;
  n int := 0;
  falhou int := 0;
begin
  for c in
    select ch.id, ch.campos, ch.solicitante_id
      from public.chamados_adm ch
     where ch.classe = 'mobilizacao'
       and ch.origem_chamado_id is null
       and ch.status <> 'aguardando_aprovacao'
       and not exists (select 1 from public.mobilizacao_processos p where p.origem_chamado_id = ch.id)
     order by ch.criado_em
  loop
    v_fluxo := app_private.mob_fluxo_do_movimento(c.campos ->> 'movimento');
    if v_fluxo is null then
      falhou := falhou + 1;
      insert into public.mobilizacao_gatilho_falhas (chamado_id, erro)
      values (c.id, format('Retroalimentação: movimento sem fluxo (%L)', c.campos ->> 'movimento'));
      continue;
    end if;
    perform app_private.mob_abrir(
      v_fluxo, app_private.mob_dados_do_chamado(c.campos, c.solicitante_id), 'adm', c.id);
    n := n + 1;
  end loop;

  raise notice 'Mobilização: % processo(s) criado(s) de chamados antigos, % sem fluxo.', n, falhou;
end $$;

notify pgrst, 'reload schema';
