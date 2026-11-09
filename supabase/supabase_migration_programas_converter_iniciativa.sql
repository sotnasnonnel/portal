-- Migration: evento 'convertida' no histórico do Campo de Ideias (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- A tela ganhou o botão "Transformar em iniciativa": a ideia que saiu do papel
-- passa a ser iniciativa na mesma linha, sem registrar de novo.
--
-- Precisa de evento próprio porque nenhum tipo existente diz o que aconteceu:
-- 'editada' é mudança de texto e 'status' é a situação (idealizado → concluído).
-- Trocar a FORMA é outra coisa — é o que decide se a solução concorre ao
-- Programa de Inovação e se ela pode ter ficha de ROI.
--
-- `de`/`para` guardam 'ideia' e 'iniciativa', como o evento de status guarda as
-- duas situações.
--
-- SEM PRÉ-REQUISITO DE DEPLOY, e sem ordem obrigatória com o front:
--   - front novo + banco velho -> a conversão funciona (ela é um UPDATE em
--     programas_ideias); só o evento não grava. O insert do evento é
--     best-effort no lib/ideias.js, como o de 'criada': o supabase-js devolve
--     o erro em vez de lançá-lo, e a tela não quebra.
--   - banco novo + front velho -> nada muda; ninguém grava esse tipo ainda.
-- Aplicar antes do deploy é o melhor dos dois, para não perder o rastro das
-- primeiras conversões.
--
-- NÃO existe o caminho de volta (iniciativa -> ideia), de propósito: a policy
-- programas_roi_insert confere a forma só na CRIAÇÃO da ficha, então
-- desconverter deixaria ficha de ROI pendurada numa linha que já não pode ter
-- uma. Isto corrige a suposição escrita em
-- supabase_migration_programas_roi_so_iniciativa.sql ("a forma não muda depois
-- de criada"): ela muda, mas só de ideia para iniciativa, que é a direção que
-- ABRE a ficha. Ficha órfã continua impossível.
--
-- Para derrubar (apague antes os eventos 'convertida'):
--     alter table public.programas_ideias_eventos drop constraint programas_ideias_eventos_tipo_check;
--     alter table public.programas_ideias_eventos add constraint programas_ideias_eventos_tipo_check
--       check (tipo in ('criada', 'status', 'editada'));

alter table public.programas_ideias_eventos drop constraint programas_ideias_eventos_tipo_check;
alter table public.programas_ideias_eventos add constraint programas_ideias_eventos_tipo_check
  check (tipo in ('criada', 'status', 'editada', 'convertida'));

-- Primeira conversão (09/11/2026), feita direto no banco antes de a tela subir:
-- o #10 de JADER THIAGO SILVA CORREA ("Verificação automatizada de avanço físico
-- e desvio de cronograma a partir do XER do Primavera P6") foi registrado como
-- ideia na importação do Forms e já existia como solução.
--
-- Autor nulo, como no evento 'corrigido' da mobilização: mudança no banco não
-- tem sessão de usuário. Quem pediu foi o dono do portal, não o autor do
-- registro — e é por isso que o rastro importa aqui.
--
-- Idempotente: reaplicar a migração não duplica o evento.
insert into public.programas_ideias_eventos (ideia_id, tipo, autor_id, de, para)
select i.id, 'convertida', null, 'ideia', 'iniciativa'
from public.programas_ideias i
where i.id = 'c8ad0000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.programas_ideias_eventos e
    where e.ideia_id = i.id and e.tipo = 'convertida'
  );
