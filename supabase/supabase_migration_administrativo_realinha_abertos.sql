-- Migration: administrativo — realinha os chamados JÁ ABERTOS à cadeia de hoje
-- (projeto bogsuuhrgvopzgcceoqz) -- decisao da diretoria, ago/2026
--
-- A troca de regra (escada Coordenador -> Gerente e, depois, o seed do GER PHD
-- em chamados_adm_fluxos) só vale para chamado NOVO: a cadeia é copiada para
-- chamados_adm_etapas no momento da abertura. Os chamados que já estavam em
-- aprovação continuaram com a cadeia velha -- a que somava
-- solicitacoes_rh_fluxos e por isso arrastava conferentes do DP (LUCAS FERRAZ)
-- e o Diretor de Operações para dentro de pedidos de compra e de viagem que não
-- tinham nada com eles.
--
-- Este script reescreve APENAS as etapas PENDENTES desses chamados, usando a
-- mesma regra que vale hoje: a cadeia cadastrada em chamados_adm_fluxos
-- (classe geral) do solicitante.
--
-- O QUE ELE NÃO FAZ, de propósito:
--   * não toca em etapa já decidida. Quem aprovou, aprovou -- reescrever isso
--     seria inventar um histórico que não aconteceu (é o caso dos chamados #9 e
--     #10, que o Lucas Ferraz aprovou de fato, quando ele era a regra);
--   * não recalcula a alçada por valor. Abaixo de R$ 5.000 a
--     TABELA_ADMINISTRATIVO não pede papel nenhum, e a GUARDA 1 aborta o script
--     inteiro se aparecer um chamado acima disso -- ali a cadeia precisa de
--     COO + Gerente Financeiro e a conta tem que ser refeita à mão;
--   * não manda e-mail. Quem virar o aprovador da vez não é avisado por aqui.
--
-- Chamado que fica sem nenhuma etapa pendente é LIBERADO na hora: status
-- 'aberto', analise_em agora e o relógio do SLA começando -- exatamente o que
-- decidirChamado() faz quando a última etapa é aprovada. Deixá-lo em
-- 'aguardando_aprovacao' sem ninguém para aprovar o congelaria para sempre.
--
-- Idempotente: reexecutar não acha mais nada desalinhado e não muda nada.
-- ============================================================================

do $$
declare
  -- Teto do nível 1 de TABELA_ADMINISTRATIVO (config/alcadas.js): até aqui a
  -- faixa não acrescenta papel nenhum e a cadeia é só o fluxo do solicitante.
  c_teto_sem_papel constant numeric := 5000;
  r record;
  v_venc timestamptz;
  v_i int;
  v_sem_fluxo text;
  v_acima text;
begin
  -- --------------------------------------------------------------------------
  -- Alvo: chamado ainda esperando aprovação + a cadeia que valeria hoje.
  -- --------------------------------------------------------------------------
  create temp table alvo on commit drop as
  select c.id,
         c.numero,
         c.classe,
         c.servico,
         c.campos,
         f.aprovadores as cadeia,
         cfg.sla_dias_uteis
    from public.chamados_adm c
    left join public.chamados_adm_fluxos f
           on f.solicitante_id = c.solicitante_id and f.classe = ''
    left join public.chamados_adm_config cfg
           on cfg.classe = c.classe and cfg.servico = c.servico
   where c.status = 'aguardando_aprovacao';

  -- GUARDA 1: serviço de gasto acima da 1ª faixa precisa de COO + Gerente
  -- Financeiro somados ao fluxo. Essa conta mora em avaliarAlcada(), no JS --
  -- refazê-la aqui em SQL criaria uma segunda versão da regra, livre para
  -- divergir da primeira. Melhor abortar e resolver caso a caso.
  select string_agg('#' || numero || ' (' || classe || '/' || servico || ')', ', ')
    into v_acima
    from alvo
   where classe || '/' || servico in ('compra/solicitacao-compra',
                                      'frota/recarga-ticket-log',
                                      'viagem-hospedagem/locacao-imovel')
     and coalesce(nullif(campos ->> case classe || '/' || servico
                                      when 'compra/solicitacao-compra'        then 'valor_base'
                                      when 'frota/recarga-ticket-log'         then 'valor'
                                      when 'viagem-hospedagem/locacao-imovel' then 'custo_previsto'
                                    end, ''), '0')::numeric > c_teto_sem_papel;
  if v_acima is not null then
    raise exception 'Abortado: % passa da 1a faixa da alcada e precisa de COO + Gerente Financeiro. Refaca a cadeia desses a mao.', v_acima;
  end if;

  -- GUARDA 2: sem fluxo cadastrado não há como saber quem aprova. Fica de fora,
  -- avisado em voz alta -- calar seria dar o script por completo sem estar.
  select string_agg('#' || numero, ', ') into v_sem_fluxo from alvo where cadeia is null;
  if v_sem_fluxo is not null then
    raise notice 'NAO realinhados (sem fluxo em chamados_adm_fluxos): %', v_sem_fluxo;
    delete from alvo where cadeia is null;
  end if;

  -- --------------------------------------------------------------------------
  -- 1. Fora quem não é mais da cadeia -- e só entre os PENDENTES.
  -- --------------------------------------------------------------------------
  delete from public.chamados_adm_etapas e
   using alvo a
   where e.chamado_id = a.id
     and e.status = 'pendente'
     and not (e.aprovador_id = any (a.cadeia));

  -- --------------------------------------------------------------------------
  -- 2. Entra quem a cadeia de hoje pede e ainda não tem etapa no chamado (nem
  --    pendente, nem decidida -- quem já decidiu não decide de novo).
  -- --------------------------------------------------------------------------
  insert into public.chamados_adm_etapas (chamado_id, ordem, aprovador_id, status)
  select a.id, p.pos, p.aprovador, 'pendente'
    from alvo a
    cross join lateral unnest(a.cadeia) with ordinality as p(aprovador, pos)
   where not exists (select 1 from public.chamados_adm_etapas e
                      where e.chamado_id = a.id and e.aprovador_id = p.aprovador);

  -- --------------------------------------------------------------------------
  -- 3. Renumera: quem já decidiu vem primeiro, na ordem em que decidiu; os
  --    pendentes seguem na ordem da cadeia. É `ordem` que diz de quem é a vez
  --    (listarAprovacoesPendentes), então buraco na numeração não pode ficar.
  -- --------------------------------------------------------------------------
  with nova as (
    select e.id,
           row_number() over (
             partition by e.chamado_id
             order by coalesce(e.decidido_em, 'infinity'::timestamptz),
                      coalesce(array_position(a.cadeia, e.aprovador_id), 99)
           ) as ordem
      from public.chamados_adm_etapas e
      join alvo a on a.id = e.chamado_id
  )
  update public.chamados_adm_etapas e
     set ordem = nova.ordem
    from nova
   where e.id = nova.id and e.ordem is distinct from nova.ordem;

  -- --------------------------------------------------------------------------
  -- 4. Sem etapa pendente = cadeia cumprida. Libera para a fila do Adm e começa
  --    o SLA, contado em dias ÚTEIS como em lib/prazo.js (fim de semana não
  --    conta; feriado não é tratado lá nem aqui).
  -- --------------------------------------------------------------------------
  for r in
    select a.id, a.numero, a.sla_dias_uteis
      from alvo a
     where not exists (select 1 from public.chamados_adm_etapas e
                        where e.chamado_id = a.id and e.status = 'pendente')
  loop
    v_venc := null;
    if coalesce(r.sla_dias_uteis, 0) > 0 then
      v_venc := date_trunc('day', now());
      while extract(isodow from v_venc) >= 6 loop v_venc := v_venc + interval '1 day'; end loop;
      for v_i in 1..r.sla_dias_uteis loop
        v_venc := v_venc + interval '1 day';
        while extract(isodow from v_venc) >= 6 loop v_venc := v_venc + interval '1 day'; end loop;
      end loop;
      v_venc := v_venc + (now() - date_trunc('day', now()));
    end if;

    update public.chamados_adm
       set status = 'aberto', analise_em = now(), sla_vence_em = v_venc, updated_at = now()
     where id = r.id;

    raise notice 'Chamado #% liberado (cadeia cumprida); SLA vence em %', r.numero, v_venc;
  end loop;
end $$;

-- ============================================================================
-- Conferência (rodar depois): quem aprova cada chamado ainda em pé.
-- ============================================================================
-- select c.numero, c.status, s.nome as solicitante,
--        e.ordem, e.status as etapa, a.nome as aprovador
--   from public.chamados_adm c
--   join public.colaboradores s on s.id = c.solicitante_id
--   left join public.chamados_adm_etapas e on e.chamado_id = c.id
--   left join public.colaboradores a on a.id = e.aprovador_id
--  where c.status not in ('fechado','reprovado','cancelado')
--  order by c.numero, e.ordem;
