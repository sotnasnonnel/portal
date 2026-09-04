-- Seed: catálogo de etapas da Mobilização
-- ============================================================================
-- Fonte: referencia/planilha_modulo_mobilizacao.xlsx, abas MOB.PESSOAS,
-- MOB.EMPRESAS e DESMOB. PESSOAS.
--
-- Este arquivo é ESCRITO À MÃO, e não gerado pelo .cjs como os demais seeds do
-- repositório. A razão: os nomes e os SLAs saem das linhas 1 e 2 da planilha,
-- mas a CADEIA DE DEPENDÊNCIAS só existe dentro das fórmulas das colunas
-- "DATA PREV" — por exemplo, em MOB.PESSOAS:
--
--     [DATA PREV - EXAMES]        = [DATA PREV - FORMS] + $AN$1
--     [DATA PREV - TREINAMENTOS]  = [DATA PREV - FORMS] + $AT$1
--     [DATA PREV - ASO]           = [DATA PREV - EXAMES] + $AQ$1
--
-- e em MOB.EMPRESAS / DESMOB. PESSOAS, na forma
--
--     IF(prev="", "", IF(real="", WORKDAY(prev, SLA), WORKDAY(real, SLA)))
--
-- Um gerador teria de interpretar fórmula de Excel para descobrir o que aqui
-- são 24 linhas estáveis. O que muda com a planilha é o HISTÓRICO, e esse sim
-- sai do docs/gerar_carga_mobilizacao.cjs.
--
-- REGRAS QUE AS FÓRMULAS FIXARAM:
--   * A base de cada etapa é a data REAL do predecessor quando ela já existe, e
--     a PREVISTA dele enquanto não existe. Está em app_private.mob_recalcular().
--   * Etapa RAIZ (depende_de null) tem data informada na abertura. O número
--     acima dela na planilha não é offset: é o "+1" das contas de tempo
--     inclusivo. Por isso raiz entra com sla_dias_uteis = 0 — exceto
--     "Alteração contratual", cujo 25 é duração-alvo de verdade.
--   * MOB.PESSOAS somava dias CORRIDOS e as outras duas usavam WORKDAY. Aqui
--     TUDO conta dias ÚTEIS (é o pedido, e é o que o Adm faz). Os prazos de
--     mobilização de pessoas ficam ~2 dias mais folgados que na planilha.
--
-- Idempotente: upsert por (fluxo, codigo). Upsert e não `do nothing` porque
-- recarregar precisa CORRIGIR o SLA sem perder o id — processos já em curso não
-- mudam, pois a etapa instanciada é snapshot.
--
-- PENDENTE (decisão do time, não do código): a coluna `condicao` está vazia em
-- todas as etapas, ou seja, "Nova mobilização" e "Movimentação de profissional"
-- geram a MESMA lista. Se a movimentação dispensar exames/ASO/alteração
-- contratual, basta marcar essas três com {"movimento": ["Nova mobilização"]}
-- pela tela de Catálogo — sem deploy.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- MOB.PESSOAS — 11 etapas
-- ----------------------------------------------------------------------------
insert into public.mobilizacao_catalogo_etapas
  (fluxo, codigo, ordem, titulo, descricao, depende_de, sla_dias_uteis, responsavel_papel)
values
  ('mobilizacao_pessoa', 'assinatura_contrato', 0, 'Assinatura de contrato',
   'Marco comercial: é a data que abre a contagem do processo.', null, 0, 'comercial'),

  ('mobilizacao_pessoa', 'abertura_chamado', 1, 'Abertura de chamado (Forms)',
   'Entrada da necessidade. No portal, é o chamado de mobilização do Administrativo.',
   null, 0, 'adm'),

  ('mobilizacao_pessoa', 'exames', 2, 'Exames',
   'Agendamento e realização dos exames ocupacionais.', 'abertura_chamado', 7, 'dp'),

  ('mobilizacao_pessoa', 'emissao_aso', 3, 'Emissão do ASO',
   'Atestado de Saúde Ocupacional emitido pela clínica.', 'exames', 2, 'dp'),

  -- Treinamento pende da ABERTURA, não dos exames: os dois caminhos correm em
  -- paralelo na planilha e amarrá-los em série inventaria atraso.
  ('mobilizacao_pessoa', 'treinamentos_agendados', 4, 'Treinamentos agendados',
   'Agendamento dos treinamentos exigidos pelo cliente.', 'abertura_chamado', 1, 'sesmt'),

  ('mobilizacao_pessoa', 'conclusao_treinamentos', 5, 'Conclusão dos treinamentos',
   'Treinamentos concluídos e certificados em mãos.', 'treinamentos_agendados', 7, 'sesmt'),

  -- Raiz com SLA de verdade: os 25 dias são duração-alvo, contados da data-base.
  ('mobilizacao_pessoa', 'alteracao_contratual', 6, 'Alteração contratual / CLT',
   'Alteração de contrato de trabalho, quando o movimento exige.', null, 25, 'dp'),

  ('mobilizacao_pessoa', 'envio_dossie', 7, 'Envio do dossiê',
   'Dossiê completo enviado ao cliente.', 'conclusao_treinamentos', 2, 'adm'),

  ('mobilizacao_pessoa', 'postagem_cliente', 8, 'Postagem pelo cliente',
   'Cliente posta a documentação no sistema dele.', 'envio_dossie', 3, 'cliente'),

  ('mobilizacao_pessoa', 'aprovacao_cliente_final', 9, 'Aprovação do cliente final',
   'Análise e aprovação pelo cliente final.', 'postagem_cliente', 6, 'cliente'),

  ('mobilizacao_pessoa', 'liberacao_cracha', 10, 'Liberação do crachá',
   'Crachá liberado — o profissional pode entrar na obra.', 'aprovacao_cliente_final', 1, 'cliente')
on conflict (fluxo, codigo) do update set
  ordem = excluded.ordem, titulo = excluded.titulo, descricao = excluded.descricao,
  depende_de = excluded.depende_de, sla_dias_uteis = excluded.sla_dias_uteis,
  responsavel_papel = excluded.responsavel_papel, updated_at = now();

-- ----------------------------------------------------------------------------
-- MOB.EMPRESAS — 8 etapas
-- ----------------------------------------------------------------------------
insert into public.mobilizacao_catalogo_etapas
  (fluxo, codigo, ordem, titulo, descricao, depende_de, sla_dias_uteis, responsavel_papel)
values
  ('mobilizacao_empresa', 'assinatura_contrato', 0, 'Assinatura de contrato',
   'Marco comercial do novo contrato.', null, 0, 'comercial'),

  ('mobilizacao_empresa', 'email_novo_contrato', 1, 'E-mail de novo contrato',
   'Comunicação interna de que há contrato novo a mobilizar.', null, 0, 'comercial'),

  ('mobilizacao_empresa', 'contato_cliente_doc', 2, 'Contato com o cliente (documentação)',
   'Levantamento da documentação que o cliente exige.', null, 0, 'adm'),

  ('mobilizacao_empresa', 'envio_anexo_06', 3, 'Envio do Anexo 06',
   'Anexo 06 preenchido e enviado ao cliente.', 'contato_cliente_doc', 5, 'adm'),

  ('mobilizacao_empresa', 'solicitacao_programas_legais', 4, 'Solicitação dos programas legais',
   'Pedido dos programas legais à clínica.', 'envio_anexo_06', 1, 'sesmt'),

  ('mobilizacao_empresa', 'envio_programas_legais', 5, 'Envio dos programas legais',
   'Programas legais enviados ao cliente.', 'solicitacao_programas_legais', 10, 'sesmt'),

  ('mobilizacao_empresa', 'postagem_cliente', 6, 'Postagem pelo cliente',
   'Cliente posta os programas no sistema dele.', 'envio_programas_legais', 5, 'cliente'),

  ('mobilizacao_empresa', 'aprovacao', 7, 'Aprovação',
   'Aprovação final do cliente — a empresa está mobilizada.', 'postagem_cliente', 1, 'cliente')
on conflict (fluxo, codigo) do update set
  ordem = excluded.ordem, titulo = excluded.titulo, descricao = excluded.descricao,
  depende_de = excluded.depende_de, sla_dias_uteis = excluded.sla_dias_uteis,
  responsavel_papel = excluded.responsavel_papel, updated_at = now();

-- ----------------------------------------------------------------------------
-- DESMOB. PESSOAS — 5 etapas
-- ----------------------------------------------------------------------------
insert into public.mobilizacao_catalogo_etapas
  (fluxo, codigo, ordem, titulo, descricao, depende_de, sla_dias_uteis, responsavel_papel)
values
  ('desmobilizacao_pessoa', 'abertura_chamado', 0, 'Abertura de chamado (Forms)',
   'Entrada da desmobilização. No portal, é o chamado do Administrativo.', null, 0, 'adm'),

  ('desmobilizacao_pessoa', 'recebimento_cracha', 1, 'Recebimento do crachá',
   'Crachá devolvido na sede ou na filial.', null, 0, 'adm'),

  ('desmobilizacao_pessoa', 'entrega_cracha_cliente', 2, 'Entrega do crachá ao cliente',
   'Crachá devolvido ao cliente.', 'recebimento_cracha', 2, 'adm'),

  ('desmobilizacao_pessoa', 'envio_protocolo_cracha', 3, 'Envio do protocolo de entrega',
   'Protocolo de devolução enviado e arquivado.', 'entrega_cracha_cliente', 1, 'adm'),

  ('desmobilizacao_pessoa', 'desmobilizacao_finalizada', 4, 'Desmobilização finalizada pelo cliente',
   'Cliente confirma a baixa do profissional.', 'envio_protocolo_cracha', 4, 'cliente')
on conflict (fluxo, codigo) do update set
  ordem = excluded.ordem, titulo = excluded.titulo, descricao = excluded.descricao,
  depende_de = excluded.depende_de, sla_dias_uteis = excluded.sla_dias_uteis,
  responsavel_papel = excluded.responsavel_papel, updated_at = now();

commit;

-- Conferência rápida: 11 + 8 + 5 = 24 etapas, e nenhuma dependência órfã.
do $$
declare v_orfas int;
begin
  select count(*) into v_orfas
    from public.mobilizacao_catalogo_etapas c
   where c.depende_de is not null
     and not exists (
       select 1 from public.mobilizacao_catalogo_etapas p
        where p.fluxo = c.fluxo and p.codigo = c.depende_de);
  if v_orfas > 0 then
    raise exception 'Catálogo com % dependência(s) apontando para código inexistente.', v_orfas;
  end if;
  raise notice 'Catálogo da Mobilização: % etapas.',
    (select count(*) from public.mobilizacao_catalogo_etapas);
end $$;
