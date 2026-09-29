-- Migration: tempo total do processo de mobilização (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido da Edijane (28/09/2026): ver o total de dias da mobilização, em
-- andamento ou finalizada, no processo, na lista e na Torre. E do André
-- (29/09/2026): tempo MÉDIO de mobilização de pessoas e de empresa nos
-- indicadores.
--
-- POR QUE UMA COLUNA, E NÃO UMA CONTA NA TELA: o fim do processo não é
-- `concluido_em`. Essa coluna guarda o momento em que o portal MARCOU o
-- processo como concluído — e para os 107 processos vindos da planilha isso é o
-- dia da carga, não o dia em que a mobilização acabou. Medir por ela daria 114
-- dias de média onde o real são 17.
--
-- O fim verdadeiro é a última DATA REAL das etapas, que veio da planilha
-- preenchida e que o time atualiza no dia a dia. Só que ela mora em outra
-- tabela, e as telas que precisam do número (lista de Processos, Torre,
-- indicadores) carregam processos sem as etapas. Guardar o resultado no próprio
-- processo evita uma consulta por linha em cada uma delas.
--
-- Quem mantém a coluna é o MESMO recálculo que já mantém etapas_concluidas e
-- prazo_em: um lugar só, disparado pelos gatilhos que já existem.
--
-- Para derrubar:
--     alter table public.mobilizacao_processos drop column concluido_real;
--     -- e remover as duas linhas correspondentes de app_private.mob_recalcular
-- ============================================================================

alter table public.mobilizacao_processos
  add column if not exists concluido_real date;

comment on column public.mobilizacao_processos.concluido_real is
  'Data REAL do fim do processo: a última data_real das etapas. Diferente de concluido_em, que é quando o portal marcou o processo como concluído (nos importados, o dia da carga). É desta coluna que sai o tempo total.';

-- ----------------------------------------------------------------------------
-- O recálculo, com duas linhas a mais. O resto é idêntico ao de
-- supabase_migration_mobilizacao.sql — a função é reescrita inteira porque
-- plpgsql não tem "alterar só este trecho".
-- ----------------------------------------------------------------------------
create or replace function app_private.mob_recalcular(p_processo uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_total int;
  v_passo int;
  v_mudou boolean;
  v_base date;
  v_nova date;
  v_data_base date;
  r record;
begin
  select count(*) into v_total from public.mobilizacao_etapas where processo_id = p_processo;
  if v_total = 0 then
    update public.mobilizacao_processos
       set etapas_total = 0, etapas_concluidas = 0, prazo_em = null, updated_at = now()
     where id = p_processo;
    return;
  end if;

  select data_base into v_data_base from public.mobilizacao_processos where id = p_processo;

  update public.mobilizacao_etapas e
     set data_prevista = app_private.mob_dias_uteis_apos(v_data_base, coalesce(e.sla_dias_uteis, 0))
   where e.processo_id = p_processo
     and e.depende_de is null
     and e.data_prevista is null
     and v_data_base is not null;

  for v_passo in 1..v_total loop
    v_mudou := false;
    for r in
      select e.id, e.depende_de, e.sla_dias_uteis, e.data_prevista
        from public.mobilizacao_etapas e
       where e.processo_id = p_processo and e.depende_de is not null
       order by e.ordem
    loop
      select coalesce(p.data_real, p.data_prevista) into v_base
        from public.mobilizacao_etapas p
       where p.processo_id = p_processo and p.codigo = r.depende_de;

      v_nova := case when v_base is null then null
                     else app_private.mob_dias_uteis_apos(v_base, coalesce(r.sla_dias_uteis, 0)) end;

      if v_nova is distinct from r.data_prevista then
        update public.mobilizacao_etapas set data_prevista = v_nova where id = r.id;
        v_mudou := true;
      end if;
    end loop;
    exit when not v_mudou;
  end loop;

  update public.mobilizacao_etapas e
     set dias_atraso = case
           when e.status = 'dispensada' then null
           when e.data_prevista is null then null
           else coalesce(e.data_real, current_date) - e.data_prevista
         end
   where e.processo_id = p_processo;

  update public.mobilizacao_processos p
     set etapas_total = t.total,
         etapas_concluidas = t.feitas,
         prazo_em = t.prazo,
         status = case when p.status = 'cancelado' then 'cancelado'
                       when t.feitas >= t.total then 'finalizado'
                       else 'em_andamento' end,
         concluido_em = case when p.status <> 'cancelado' and t.feitas >= t.total
                             then coalesce(p.concluido_em, now()) else null end,
         -- O fim REAL: a última data preenchida nas etapas. Só vale com o
         -- processo inteiro resolvido; enquanto falta passo, o processo ainda
         -- corre e o tempo se conta contra hoje.
         concluido_real = case when p.status <> 'cancelado' and t.feitas >= t.total
                               then t.ultima_real else null end,
         updated_at = now()
    from (
      select count(*) as total,
             count(*) filter (where status in ('concluida', 'dispensada')) as feitas,
             max(data_prevista) filter (where status not in ('concluida', 'dispensada')) as prazo,
             max(data_real) as ultima_real
        from public.mobilizacao_etapas where processo_id = p_processo
    ) t
   where p.id = p_processo;
end $$;

-- ----------------------------------------------------------------------------
-- Preenche o histórico: os 114 processos já finalizados nunca passaram pelo
-- recálculo novo. Sem isto, o tempo médio nasceria contando só os próximos.
-- ----------------------------------------------------------------------------
update public.mobilizacao_processos p
   set concluido_real = (
         select max(e.data_real) from public.mobilizacao_etapas e
          where e.processo_id = p.id
       )
 where p.status = 'finalizado'
   and p.concluido_real is null;

notify pgrst, 'reload schema';
