-- Limpeza dos dados da Mobilização, para recarregar da planilha nova
-- ============================================================================
-- Aplicado em produção em 09/09/2026, antes de
-- supabase_import_mobilizacao_2026.sql gerado da planilha
-- "ADM_GESTAO_DE_MOBILIZACAO_ATUALIZADA (1).xlsx".
--
-- O QUE ESTE ARQUIVO APAGA, E O QUE ELE NÃO ENCOSTA
--
-- Apaga:  mobilizacao_processos (e, por CASCADE, mobilizacao_etapas e
--         mobilizacao_eventos), mais o log mobilizacao_gatilho_falhas.
--
-- NÃO apaga: mobilizacao_catalogo_etapas. O catálogo é CONFIGURAÇÃO, não dado
--         carregado — são as 26 etapas com SLA que o seed criou e que a tela de
--         Catálogo edita. Apagá-lo faria a recarga criar 129 processos com zero
--         etapas cada, porque mob_abrir monta as etapas A PARTIR do catálogo.
--
-- NÃO encosta em NADA fora do módulo. Vale a pena registrar por que isso é
-- garantido, e não uma esperança: a única FK que sai daqui para fora é
-- mobilizacao_processos.origem_chamado_id -> chamados_adm, e ela aponta PARA
-- FORA. Deletar a linha que aponta não mexe na apontada. Não existe nenhuma FK
-- no sentido contrário — nada em chamados_adm, colaboradores ou qualquer outro
-- módulo referencia as tabelas de mobilização. Conferido em
-- information_schema antes de rodar.
--
-- POR QUE APAGAR TUDO, E NÃO SÓ origem = 'planilha'
--
-- Havia 4 processos nascidos de chamado do Adm (origem='adm'), e 3 deles são as
-- MESMAS pessoas que aparecem na planilha nova. Manter os 4 e carregar por cima
-- daria dois processos para a mesma mobilização, sem nada ligando um ao outro —
-- e o índice único não pegaria, porque ele é por carga_chave, que nesses é null.
--
-- Nada se perde nessa decisão porque:
--   * nenhuma etapa tinha tocada_no_portal = true (conferido: 0 de 1363), ou
--     seja, ninguém tinha trabalhado no app ainda; e
--   * os chamados do Adm continuam intactos, então o vínculo se refaz depois
--     (ver supabase_religar_mobilizacao_chamados.sql, o passo seguinte).
-- ============================================================================

begin;

-- Confira ANTES (esperado em 09/09/2026: 131 processos, 1363 etapas, 1356
-- eventos, 0 etapas tocadas no portal). Se "tocadas" vier > 0, PARE: alguém
-- trabalhou no portal e esse trabalho seria perdido.
select
  (select count(*) from public.mobilizacao_processos) as processos,
  (select count(*) from public.mobilizacao_etapas) as etapas,
  (select count(*) from public.mobilizacao_eventos) as eventos,
  (select count(*) from public.mobilizacao_etapas where tocada_no_portal) as tocadas,
  (select count(*) from public.mobilizacao_catalogo_etapas) as catalogo_preservado;

-- Guarda o vínculo chamado -> pessoa antes de apagar, para religar depois.
-- Tabela comum, e não temporária: o religamento roda em OUTRA conexão (cada
-- execute_sql abre a sua), e uma temp table morreria junto com esta.
create table if not exists public.mobilizacao_religar_tmp as
select p.origem_chamado_id as chamado_id,
       p.fluxo,
       p.profissional_nome,
       p.profissional_id,
       p.solicitante_id,
       p.data_base
  from public.mobilizacao_processos p
 where p.origem = 'adm' and p.origem_chamado_id is not null;

delete from public.mobilizacao_processos;

-- O log de falhas do gatilho é diagnóstico da carga antiga; sem processos, ele
-- não descreve mais nada.
delete from public.mobilizacao_gatilho_falhas;

-- Numeração recomeça do 1: o número é só rótulo de tela (nada o referencia por
-- FK), e deixá-lo continuar de 131 faria a base nova nascer com uma lacuna que
-- ninguém sabe explicar daqui a seis meses.
alter sequence public.mobilizacao_numero_seq restart with 1;

commit;

-- Confira DEPOIS: tudo zero, menos o catálogo.
select
  (select count(*) from public.mobilizacao_processos) as processos,
  (select count(*) from public.mobilizacao_etapas) as etapas,
  (select count(*) from public.mobilizacao_eventos) as eventos,
  (select count(*) from public.mobilizacao_catalogo_etapas) as catalogo,
  (select count(*) from public.mobilizacao_religar_tmp) as guardados_para_religar,
  (select count(*) from public.chamados_adm) as chamados_adm_intactos;

-- ============================================================================
-- RESULTADO REAL (09/09/2026)
--
--   antes:  131 processos · 1363 etapas · 0 tocadas no portal
--   depois: 130 processos · 1480 etapas · 94 chamados_adm intactos · 0 falhas
--           126 da planilha nova + 4 nascidos de chamado do Adm
--
-- RELIGAMENTO dos 4 chamados, feito com mobilizacao_religar_tmp:
--   * 3 pessoas (chamados 61, 75 e 76) JA vinham na planilha nova. O processo
--     carregado foi adotado pelo chamado — escolhendo o de data_base MAIS
--     RECENTE, porque as tres aparecem duas vezes no ano e o chamado aberto
--     agora fala da mobilizacao atual, nao da de marco.
--   * 1 (chamado 83, Gabriel da Silva) nao estava na planilha; foi recriado
--     chamando app_private.mob_abrir pelo mesmo caminho do gatilho.
--
-- Por que mob_abrir e nao mobilizacao_reprocessar_chamado: a conexao do MCP nao
-- tem usuario autenticado, entao is_adm_time() e falso e a porta publica barra.
-- A funcao privada e a que o proprio gatilho usa e nao tem esse gate.
--
-- A tabela mobilizacao_religar_tmp foi removida ao fim.
-- ============================================================================
