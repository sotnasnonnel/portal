-- Migration: movimentação com desmobilização e crachá (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido de 27/10/2026. Na "Movimentação de profissional" o formulário passou a:
--   * mostrar onde o profissional está hoje (cliente, obra, Código CT e
--     contato da última mobilização FINALIZADA dele);
--   * perguntar se precisa de processo de desmobilização. Se sim, pede a data
--     de saída, se ele possui crachá e, se possui, se o crachá já foi entregue
--     ao cliente — e abre, junto com o da movimentação, um chamado de
--     Desmobilização, que gera o próprio processo pelo gatilho de sempre.
--
-- Aqui, três peças:
--
-- 1) public.mobilizacao_onde_esta(profissional): a origem para o formulário.
--    SECURITY DEFINER pelo mesmo motivo de mobilizacao_dados_do_ct: quem abre
--    o chamado (o gestor) quase nunca enxerga os processos pela RLS. Mesma
--    regra da herança da desmobilização (mob_dados_do_chamado): mobilização
--    de pessoa, finalizada, a mais recente pela data-base.
--
-- 2) mob_dados_do_chamado leva `possui_cracha` e `cracha_entregue` (e o número
--    da movimentação de onde a desmobilização saiu) para o processo.
--
-- 3) mob_abrir ajusta as etapas de crachá da desmobilização ao nascer:
--      sem crachá             -> Recebimento, Entrega ao cliente e Envio do
--                                protocolo nascem "Não se aplica";
--      crachá já entregue     -> Recebimento e Entrega nascem concluídas; o
--                                protocolo segue pendente;
--      não entregue / sem resposta (chamado antigo, desmobilização avulsa)
--                             -> as três nascem normais, como sempre.
--    Pelo CÓDIGO da etapa (recebimento_cracha, entrega_cracha_cliente,
--    envio_protocolo_cracha): renomear um deles no catálogo desliga o ajuste
--    daquele passo, sem erro. As etapas nascem e são marcadas na mesma
--    transação, então ninguém chega a vê-las pendentes; o histórico registra
--    a marcação como qualquer outra.
--
-- APLIQUE ANTES DO DEPLOY DO FRONT: o formulário novo chama
-- mobilizacao_onde_esta. A ordem inversa é segura.
--
-- Para derrubar:
--     drop function if exists public.mobilizacao_onde_esta(uuid);
--   recrie mob_dados_do_chamado como em
--   supabase_migration_mobilizacao_contato_desmob_herda.sql e mob_abrir como
--   está no banco antes desta (sem o bloco "Crachá da desmobilização").

create or replace function app_private.mob_dados_do_chamado(p_campos jsonb, p_solicitante uuid)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  with base as (
    select
      nullif(btrim(coalesce(p_campos ->> 'projeto', '')), '') as projeto,
      nullif(btrim(coalesce(p_campos ->> 'cc', '')), '')      as cc,
      nullif(btrim(coalesce(p_campos ->> 'gestor', '')), '')  as coordenador,
      nullif(btrim(coalesce(p_campos ->> 'profissional', '')), '') as nome,
      case when p_campos ->> 'profissional_id' ~* '^[0-9a-f-]{36}$'
           then (p_campos ->> 'profissional_id')::uuid end   as profissional
  ),
  lider as (
    select coalesce(
      (select g.nome from public.colaboradores c
         join public.colaboradores g on g.id = c.superior_id
        where upper(c.nome) = upper(b.coordenador)
        order by c.ativo desc nulls last limit 1),
      (select g.nome from public.colaboradores p
         join public.colaboradores c on c.id = p.superior_id
         join public.colaboradores g on g.id = c.superior_id
        where p.id = b.profissional)
    ) as gerente
    from base b
  ),
  -- Só a desmobilização herda: as outras trazem projeto e contato no próprio
  -- chamado.
  ultima as (
    select m.cod_phd, m.cod_ct, m.local_obra, m.cliente_phd, m.cliente_final,
           m.empresa_phd, m.coo_phd, m.campos
      from base b
      join public.mobilizacao_processos m
        on m.fluxo = 'mobilizacao_pessoa'
       and m.status = 'finalizado'
       and (m.profissional_id = b.profissional
            or (b.nome is not null and upper(m.profissional_nome) = upper(b.nome)))
     where p_campos ->> 'movimento' = 'Desmobilização'
     order by m.data_base desc nulls last, m.criado_em desc
     limit 1
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'profissional_id',   nullif(p_campos ->> 'profissional_id', ''),
    'profissional_nome', b.nome,
    'local_obra',        coalesce(nullif(btrim(coalesce(p_campos ->> 'local_obra', '')), ''), u.local_obra),
    'cod_phd',           coalesce(b.projeto, u.cod_phd),
    'cod_ct',            coalesce(upper(coalesce(
                           substring(b.projeto from '^([A-Za-z0-9]+-CT[0-9]+)'),
                           substring(b.cc from '^([A-Za-z0-9]+-CT[0-9]+)'))), u.cod_ct),
    'coo_phd',           coalesce(b.coordenador, u.coo_phd),
    'ger_phd',           l.gerente,
    'cliente_phd',       coalesce(nullif(btrim(coalesce(p_campos ->> 'cliente', '')), ''), u.cliente_phd),
    'cliente_final',     coalesce(nullif(btrim(coalesce(p_campos ->> 'cliente_final', '')), ''), u.cliente_final),
    'empresa_phd',       coalesce(nullif(btrim(coalesce(p_campos ->> 'empresa_phd', '')), ''), u.empresa_phd),
    'campos',            nullif(jsonb_strip_nulls(jsonb_build_object(
                           'contato_cliente',     coalesce(nullif(btrim(coalesce(p_campos ->> 'contato_cliente', '')), ''), u.campos ->> 'contato_cliente'),
                           'contato_nome',        coalesce(nullif(btrim(coalesce(p_campos ->> 'contato_nome', '')), ''), u.campos ->> 'contato_nome'),
                           'contato_telefone',    coalesce(nullif(btrim(coalesce(p_campos ->> 'contato_telefone', '')), ''), u.campos ->> 'contato_telefone'),
                           'contato_email',       coalesce(nullif(btrim(coalesce(p_campos ->> 'contato_email', '')), ''), u.campos ->> 'contato_email'),
                           'data_inicio_cliente', nullif(p_campos ->> 'data_inicio_cliente', ''),
                           'data_desmobilizacao', nullif(p_campos ->> 'data_desmobilizacao', ''),
                           'treinamentos',        nullif(btrim(coalesce(p_campos ->> 'treinamentos', '')), ''),
                           'centro_custo',        b.cc,
                           'possui_cracha',       nullif(p_campos ->> 'possui_cracha', ''),
                           'cracha_entregue',     nullif(p_campos ->> 'cracha_entregue', ''),
                           'movimentacao_numero', nullif(p_campos ->> 'movimentacao_numero', '')
                         )), '{}'::jsonb),
    'data_base',         to_char(greatest(
                           current_date,
                           app_private.ausente_ate(b.profissional, current_date) + 1
                         ), 'YYYY-MM-DD'),
    'solicitante_id',    p_solicitante::text,
    'movimento',         nullif(p_campos ->> 'movimento', ''),
    -- No primeiro nível porque é lá que mob_abrir (e a `condicao` do catálogo)
    -- olha. Também vão em `campos`, para o resumo do processo mostrar.
    'possui_cracha',     nullif(p_campos ->> 'possui_cracha', ''),
    'cracha_entregue',   nullif(p_campos ->> 'cracha_entregue', '')
  ))
  from base b
  cross join lider l
  left join ultima u on true
$function$;

create or replace function public.mobilizacao_onde_esta(p_profissional uuid)
returns table (
  numero text, cliente_phd text, cliente_final text, empresa_phd text,
  local_obra text, cod_phd text, cod_ct text, data_base date, campos jsonb
)
language sql
stable
security definer
set search_path to ''
as $function$
  select m.numero_exibicao, m.cliente_phd, m.cliente_final, m.empresa_phd,
         m.local_obra, m.cod_phd, m.cod_ct, m.data_base,
         -- Só o contato: o resto de `campos` (centro de custo, datas) não é
         -- da conta de quem abre o chamado.
         jsonb_strip_nulls(jsonb_build_object(
           'contato_nome',     m.campos ->> 'contato_nome',
           'contato_telefone', m.campos ->> 'contato_telefone',
           'contato_email',    m.campos ->> 'contato_email',
           'contato_cliente',  m.campos ->> 'contato_cliente'))
    from public.mobilizacao_processos m
   where m.fluxo = 'mobilizacao_pessoa'
     and m.status = 'finalizado'
     and (m.profissional_id = p_profissional
          or upper(m.profissional_nome) = (
               select upper(c.nome) from public.colaboradores c where c.id = p_profissional))
   order by m.data_base desc nulls last, m.criado_em desc
   limit 1
$function$;

revoke all on function public.mobilizacao_onde_esta(uuid) from public;
grant execute on function public.mobilizacao_onde_esta(uuid) to authenticated;

-- Igual ao que estava no banco em 27/10/2026, mais o bloco "Crachá da
-- desmobilização" antes do recálculo.
create or replace function app_private.mob_abrir(p_fluxo text, p_dados jsonb, p_origem text default 'manual'::text, p_origem_chamado uuid default null::uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_eu uuid := app_private.my_colaborador_id();
  v_titulo text;
  v_datas jsonb := coalesce(p_dados -> 'datas', '{}'::jsonb);
  v_qtd int;
begin
  if p_fluxo not in ('mobilizacao_pessoa', 'desmobilizacao_pessoa', 'mobilizacao_empresa', 'inclusao_treinamento') then
    raise exception 'Fluxo desconhecido: %', p_fluxo;
  end if;

  if p_origem_chamado is not null then
    select id into v_id from public.mobilizacao_processos
     where origem_chamado_id = p_origem_chamado;
    if v_id is not null then return v_id; end if;
  end if;

  if nullif(btrim(p_dados ->> 'carga_chave'), '') is not null then
    select id into v_id from public.mobilizacao_processos
     where carga_chave = btrim(p_dados ->> 'carga_chave');
    if v_id is not null then return v_id; end if;
  end if;

  v_titulo := coalesce(
    nullif(btrim(p_dados ->> 'titulo'), ''),
    nullif(btrim(p_dados ->> 'profissional_nome'), ''),
    nullif(btrim(p_dados ->> 'cliente_phd'), ''),
    'Processo sem identificação'
  );

  insert into public.mobilizacao_processos (
    fluxo, titulo, profissional_id, profissional_nome,
    empresa_phd, cliente_phd, cliente_final, local_obra, cod_ct, cod_phd,
    coo_phd, ger_phd, contrato, data_base, observacoes, campos,
    solicitante_id, responsavel_id, origem, origem_chamado_id, carga_chave
  ) values (
    p_fluxo, v_titulo,
    nullif(p_dados ->> 'profissional_id', '')::uuid,
    nullif(btrim(p_dados ->> 'profissional_nome'), ''),
    nullif(btrim(p_dados ->> 'empresa_phd'), ''),
    nullif(btrim(p_dados ->> 'cliente_phd'), ''),
    nullif(btrim(p_dados ->> 'cliente_final'), ''),
    nullif(btrim(p_dados ->> 'local_obra'), ''),
    nullif(btrim(p_dados ->> 'cod_ct'), ''),
    nullif(btrim(p_dados ->> 'cod_phd'), ''),
    nullif(btrim(p_dados ->> 'coo_phd'), ''),
    nullif(btrim(p_dados ->> 'ger_phd'), ''),
    nullif(btrim(p_dados ->> 'contrato'), ''),
    nullif(p_dados ->> 'data_base', '')::date,
    nullif(btrim(p_dados ->> 'observacoes'), ''),
    coalesce(p_dados -> 'campos', '{}'::jsonb),
    coalesce(nullif(p_dados ->> 'solicitante_id', '')::uuid, v_eu),
    nullif(p_dados ->> 'responsavel_id', '')::uuid,
    p_origem, p_origem_chamado,
    nullif(btrim(p_dados ->> 'carga_chave'), '')
  ) returning id into v_id;

  insert into public.mobilizacao_etapas (
    processo_id, catalogo_id, codigo, ordem, titulo, descricao,
    depende_de, sla_dias_uteis, responsavel_id, data_prevista
  )
  select v_id, c.id, c.codigo, c.ordem, c.titulo, c.descricao,
         c.depende_de, c.sla_dias_uteis, c.responsavel_id,
         nullif(v_datas ->> c.codigo, '')::date
    from public.mobilizacao_catalogo_etapas c
   where c.fluxo = p_fluxo and c.ativo
     and app_private.mob_condicao_ok(c.condicao, p_dados)
   order by c.ordem;

  get diagnostics v_qtd = row_count;

  insert into public.mobilizacao_eventos (processo_id, tipo, autor_id, para, dados)
  values (v_id, 'criado', v_eu, p_fluxo,
          jsonb_build_object('origem', p_origem, 'etapas', v_qtd,
                             'catalogo_vazio', v_qtd = 0));

  -- Crachá da desmobilização (27/10/2026): o chamado já diz se há crachá e se
  -- ele foi entregue ao cliente. As etapas nascem todas e são marcadas aqui,
  -- em vez de não nascer, porque o Envio do protocolo depende da Entrega — sem
  -- a predecessora, ele ficaria sem prazo.
  if p_fluxo = 'desmobilizacao_pessoa' then
    if p_dados ->> 'possui_cracha' = 'nao' then
      update public.mobilizacao_etapas
         set status = 'dispensada'
       where processo_id = v_id
         and codigo in ('recebimento_cracha', 'entrega_cracha_cliente', 'envio_protocolo_cracha');
    elsif p_dados ->> 'possui_cracha' = 'sim' and p_dados ->> 'cracha_entregue' = 'sim' then
      update public.mobilizacao_etapas
         set status = 'concluida'
       where processo_id = v_id
         and codigo in ('recebimento_cracha', 'entrega_cracha_cliente');
    end if;
  end if;

  perform app_private.mob_recalcular(v_id);

  return v_id;
end $function$;
