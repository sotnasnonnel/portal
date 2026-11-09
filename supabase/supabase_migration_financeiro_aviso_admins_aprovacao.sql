-- Migration: Financeiro — time de admins acompanha as etapas de APROVAÇÃO (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Até aqui, enquanto um Cartão Clara subia a cadeia de alçadas, o time do
-- Financeiro não via nada: `notif_fin_vez` só abria o leque para todos os
-- admins na etapa de EXECUÇÃO. A etapa de aprovação avisava apenas o aprovador
-- nomeado, e quem executa só descobria o pedido quando ele caía na sua mão.
--
-- Agora cada etapa de aprovação também gera um aviso de ACOMPANHAMENTO para os
-- admins do Financeiro.
--
-- Tipo 'andamento', e NÃO 'sua_vez', de propósito: a decisão daquela etapa é de
-- uma pessoa só. Marcar como "sua vez" para o time inteiro poria na fila de
-- seis pessoas algo que elas não podem decidir — e 'sua_vez' é o que o sino
-- pinta como pendência. O aprovador da vez continua recebendo o 'sua_vez' dele,
-- como sempre.
--
-- DUAS EXCLUSÕES no leque, as duas para não duplicar aviso na mesma pessoa:
--   - o SOLICITANTE, que já recebe o 'andamento' do próprio pedido por
--     notif_fin_etapa_decidida (mesma referencia_id, mesmo tipo);
--   - o APROVADOR da etapa, que recebe o 'sua_vez'.
--
-- IDEMPOTÊNCIA por `not exists`, e não por índice único: o índice
-- notificacoes_vez_idx cobre só 'sua_vez', e criar um para 'andamento' mexeria
-- num tipo que PODE repetir de propósito (um pedido que anda três vezes gera
-- três avisos ao solicitante). O guard aqui é estreito: o mesmo admin não
-- recebe duas vezes o acompanhamento da MESMA etapa, que é o que aconteceria
-- quando o gatilho de inserção e o de decisão calculam a mesma etapa pendente.
--
-- Sem pré-requisito de deploy: o sino já cai no visual de 'andamento' para
-- qualquer tipo que não conheça (VISUAL[n.tipo] || VISUAL.andamento, em
-- SinoNotificacoes.jsx), e aqui o tipo é justamente 'andamento'.
--
-- O e-mail equivalente está na Edge Function notify-financeiro-aprovador, que
-- precisa de deploy à parte. As duas mudanças são independentes: aplicar só
-- esta dá o aviso no sino, sem e-mail.
--
-- Para voltar ao comportamento anterior, reaplique a versão de
-- supabase_migration_notificacoes.sql (seção 3).

create or replace function app_private.notif_fin_vez(p_sol uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare e record; s record; destino uuid;
begin
  select * into s from solicitacoes_financeiro where id = p_sol;
  if s is null or s.status <> 'pendente' then return; end if;
  select * into e from solicitacoes_financeiro_etapas
   where solicitacao_id = p_sol and status = 'pendente'
     and tipo_etapa in ('aprovacao', 'execucao')
   order by ordem limit 1;
  if e is null then return; end if;
  if e.tipo_etapa = 'execucao' then
    -- Execução é de grupo: avisa todo o time do Financeiro.
    for destino in select id from colaboradores where financeiro_role = 'admin' and ativo is not false loop
      perform app_private.notificar(destino, 'financeiro', 'sua_vez',
        format('Solicitação #%s aguarda execução', coalesce(s.numero::text, '')),
        coalesce(s.nome_despesa, 'Solicitação do Financeiro'),
        '/financeiro/solicitacoes/acompanhar', e.id);
    end loop;
  elsif e.aprovador_id is not null then
    perform app_private.notificar(e.aprovador_id, 'financeiro', 'sua_vez',
      format('Solicitação #%s aguarda sua aprovação', coalesce(s.numero::text, '')),
      coalesce(s.nome_despesa, 'Solicitação do Financeiro'),
      '/financeiro/solicitacoes/acompanhar', e.id);
  end if;

  -- Acompanhamento do time nas etapas de aprovação. Fora do if/elsif acima
  -- porque vale mesmo quando a etapa não tem aprovador nomeado (etapa de grupo
  -- do Jurídico, Conselho ou RH): o Financeiro quer saber que o pedido está
  -- parado em alguém, e aí não há 'sua_vez' nenhum para se apoiar.
  if e.tipo_etapa <> 'execucao' then
    for destino in
      select c.id from colaboradores c
       where c.financeiro_role = 'admin'
         and c.ativo is not false
         and c.id is distinct from s.solicitante_id
         and c.id is distinct from e.aprovador_id
         and not exists (
           select 1 from notificacoes n
            where n.destinatario_id = c.id
              and n.referencia_id = e.id
              and n.tipo = 'andamento'
         )
    loop
      perform app_private.notificar(destino, 'financeiro', 'andamento',
        format('Solicitação #%s em aprovação', coalesce(s.numero::text, '')),
        format('%s — aguardando %s',
          coalesce(s.nome_despesa, 'Solicitação do Financeiro'),
          coalesce(e.papel, 'aprovação')),
        '/financeiro/solicitacoes/acompanhar', e.id);
    end loop;
  end if;
end $$;
