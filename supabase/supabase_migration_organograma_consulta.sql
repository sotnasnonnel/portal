-- Migration: consulta do Organograma como permissão própria (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Até aqui, /organograma exigia perfil de DP (gestor, coordenador, admin ou
-- RH). Quem só precisa CONSULTAR o organograma — o time do Administrativo, por
-- exemplo — só entrava virando RH, e RH carrega junto as Requisições DP, o
-- painel de Horas Extras e o Fechamento PJ. Permissão grande demais para uma
-- tela de leitura.
--
-- Por isso uma flag própria, no molde do `rh_dp`: booleana, por pessoa, ligada
-- na tela de Gerenciamento de acessos. Não substitui o perfil — quem já é
-- gestor/coordenador/admin/RH continua entrando pelo perfil, sem precisar dela.
--
-- Só protege TELA, e é de propósito: os dados do organograma não vêm daqui.
-- Vêm das views portal_organograma_* do projeto backoffice_phd, expostas ao
-- papel anon desde o endurecimento de RLS de 2026-09-08 (ver
-- src/pages/Gestor/organograma/useOrganograma.js). Não há RLS a acrescentar
-- deste lado, e nenhuma RPC lê esta coluna.
--
-- Para derrubar:
--     alter table public.colaboradores drop column organograma_consulta;
-- ============================================================================

alter table public.colaboradores
  add column if not exists organograma_consulta boolean not null default false;

comment on column public.colaboradores.organograma_consulta is
  'Libera SÓ a Consulta do Organograma (/organograma) para quem não tem perfil de DP. Gate de tela; os dados vêm das views portal_organograma_* do backoffice_phd.';
