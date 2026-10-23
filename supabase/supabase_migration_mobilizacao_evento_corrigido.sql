-- Migration: evento 'corrigido' no histórico da mobilização (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Correção de dado do processo feita direto no banco (não existe tela para
-- editar o cabeçalho) precisa aparecer no histórico. Nenhum tipo existente
-- servia: 'carga' é a planilha, 'status' é etapa.
--
-- O evento guarda o campo em `dados.campo` (rótulo da tela) e os valores em
-- `de`/`para`. Autor nulo: correção no banco não tem sessão de usuário.
--
-- Sem pré-requisito de deploy: até o front novo subir, a tela mostra
-- "corrigido (de → para)" em vez de "Dado corrigido — Campo (de → para)".
--
-- Para derrubar (apague antes os eventos 'corrigido'):
--     alter table public.mobilizacao_eventos drop constraint mobilizacao_eventos_tipo_check;
--     alter table public.mobilizacao_eventos add constraint mobilizacao_eventos_tipo_check
--       check (tipo in ('criado', 'status', 'atribuido', 'concluida', 'cancelado', 'carga'));

alter table public.mobilizacao_eventos drop constraint mobilizacao_eventos_tipo_check;
alter table public.mobilizacao_eventos add constraint mobilizacao_eventos_tipo_check
  check (tipo in ('criado', 'status', 'atribuido', 'concluida', 'cancelado', 'carga', 'corrigido'));

-- Primeiro uso (13/10/2026): processo #145 aberto com o cliente errado.
insert into public.mobilizacao_eventos (processo_id, tipo, de, para, dados)
select p.id, 'corrigido', v.de, v.para, jsonb_build_object('campo', v.campo)
from public.mobilizacao_processos p
cross join (values
  ('Cliente PHD',  'PHD ASSESSORIA', 'SUPERUS'),
  ('Empresa PHD',  null,             'PHD ASSESSORIA')
) as v(campo, de, para)
where p.numero = 145;
