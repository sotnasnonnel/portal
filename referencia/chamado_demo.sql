-- =============================================================================
-- Chamado de demonstração para ver a tela de Acompanhamento com tudo preenchido.
--
-- Solicitante: Marcus · Aprovador: Jarbas · Técnico: André
-- Percurso: aberto -> aprovado -> atribuído -> em atendimento -> mensagem do
-- técnico -> aguardando solicitante -> resposta -> em atendimento -> nota interna
--
-- NÃO fecha o chamado de propósito: chamado fechado sem avaliação bloqueia a
-- abertura de novos. Para ver o fechamento e a pesquisa de satisfação, use os
-- botões da própria tela.
--
-- Os eventos são gravados por trigger com a data de agora; o bloco final os
-- reescreve para espalhar a história em 3 dias e a linha do tempo ficar legível.
-- =============================================================================
do $$
declare
  v_id uuid := gen_random_uuid();
  v_marcus uuid;  v_jarbas uuid;  v_andre uuid;
  v_d3 timestamptz := now() - interval '3 days';
  v_d2 timestamptz := now() - interval '2 days';
  v_d1 timestamptz := now() - interval '1 day';
begin
  select id into v_marcus from public.colaboradores where email = 'marcus.guimaraes@phdengenharia.eng.br';
  select id into v_jarbas from public.colaboradores where email = 'jarbas.junior@phdengenharia.eng.br';
  select id into v_andre  from public.colaboradores where email = 'andre.guimaraes@phdengenharia.eng.br';

  -- 1) Marcus abre um chamado de TI que exige aprovação
  insert into public.chamados_adm
    (id, classe, servico, assunto, natureza, descricao, campos, solicitante_id, exige_aprovacao, status, criado_em)
  values (
    v_id, 'ti', 'troca-equipamentos', 'Troca de equipamentos e acessórios', 'solicitacao_servico',
    'O notebook trava durante as medições em campo e já reiniciou sozinho duas vezes esta semana. Preciso de substituição antes da mobilização da equipe no dia 20.',
    jsonb_build_object(
      'cc', 'CC-1042', 'tipo', 'Notebook', 'numero_serie', 'NB-8871-PHD',
      'patrimonio', '004512', 'motivo', 'Quebra', 'localizacao', 'Sede — 2º andar',
      'data_necessidade', to_char(now() + interval '10 days', 'YYYY-MM-DD'),
      'observacao', 'Se possível manter o mesmo modelo, os projetos já estão configurados nele.'
    ),
    v_marcus, true, 'aguardando_aprovacao', v_d3 + interval '9 hours 12 minutes'
  );

  -- 2) Etapa de aprovação com o Jarbas, já decidida
  insert into public.chamados_adm_etapas (chamado_id, ordem, aprovador_id, status, decidido_em, created_at)
  values (v_id, 1, v_jarbas, 'pendente', null, v_d3 + interval '9 hours 12 minutes');

  update public.chamados_adm_etapas
     set status = 'aprovada', decidido_em = v_d3 + interval '11 hours 40 minutes'
   where chamado_id = v_id;

  -- 3) Aprovação libera o chamado e liga o relógio do prazo (48h)
  update public.chamados_adm
     set status = 'aberto',
         analise_em = v_d3 + interval '11 hours 40 minutes',
         sla_vence_em = v_d3 + interval '11 hours 40 minutes' + interval '48 hours'
   where id = v_id;

  -- 4) André assume e começa a tocar
  update public.chamados_adm set atendente_id = v_andre where id = v_id;
  update public.chamados_adm set status = 'em_atendimento' where id = v_id;

  -- 5) André responde -> a bola passa para o solicitante
  insert into public.chamados_adm_interacoes (chamado_id, autor_id, mensagem, created_at)
  values (v_id, v_andre,
          'Solicitei o orçamento de dois modelos ao fornecedor. Assim que chegar, envio para conferência antes de fechar a compra.',
          v_d2 + interval '9 hours 30 minutes');
  update public.chamados_adm set status = 'aguardando_solicitante' where id = v_id;

  -- 6) Marcus responde -> volta para o Adm
  insert into public.chamados_adm_interacoes (chamado_id, autor_id, mensagem, created_at)
  values (v_id, v_marcus,
          'Perfeito. Só peço que o modelo tenha 32GB de memória, os arquivos de projeto não abrem no de 16.',
          v_d2 + interval '15 hours 20 minutes');
  update public.chamados_adm set status = 'em_atendimento' where id = v_id;

  -- 7) Nota interna do técnico (o solicitante comum NÃO enxerga; como admin do
  --    Adm, o Marcus enxerga — serve para ver o destaque amarelo na tela)
  insert into public.chamados_adm_interacoes (chamado_id, autor_id, mensagem, interna, created_at)
  values (v_id, v_andre,
          'Estoque tem 1 unidade reservada para o projeto novo. Confirmar com o Financeiro se libera para troca.',
          true, v_d1 + interval '10 hours');

  -- ---------------------------------------------------------------------------
  -- Espalha os eventos na linha do tempo (o trigger gravou todos com "agora")
  -- ---------------------------------------------------------------------------
  update public.chamados_adm_eventos e set
    autor_id = case
      when e.tipo = 'criado' then v_marcus
      when e.tipo = 'aprovado' then v_jarbas
      else v_andre end,
    created_at = case
      when e.tipo = 'criado'                             then v_d3 + interval '9 hours 12 minutes'
      when e.tipo = 'aprovado'                           then v_d3 + interval '11 hours 40 minutes'
      when e.tipo = 'status' and e.para = 'aberto'       then v_d3 + interval '11 hours 40 minutes'
      when e.tipo = 'atribuido'                          then v_d3 + interval '11 hours 41 minutes'
      when e.tipo = 'status' and e.para = 'em_atendimento'
           and e.de = 'aberto'                           then v_d3 + interval '14 hours 5 minutes'
      when e.tipo = 'status' and e.para = 'aguardando_solicitante'
                                                         then v_d2 + interval '9 hours 31 minutes'
      when e.tipo = 'status' and e.para = 'em_atendimento'
                                                         then v_d2 + interval '15 hours 21 minutes'
      else e.created_at end
  where e.chamado_id = v_id;

  raise notice 'Chamado de demonstração criado: %', v_id;
end $$;

-- Confere o resultado
select c.numero, c.status, c.sla_vence_em,
       (select count(*) from public.chamados_adm_eventos e where e.chamado_id = c.id) as eventos,
       (select count(*) from public.chamados_adm_interacoes i where i.chamado_id = c.id) as mensagens
from public.chamados_adm c
where c.assunto = 'Troca de equipamentos e acessórios'
order by c.criado_em desc limit 1;
