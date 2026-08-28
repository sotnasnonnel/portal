-- ============================================================================
-- Administrativo — desdobramento da mobilização em chamados próprios
--
-- Ao abrir uma mobilização com adicionais (equipamento, software, EPI,
-- uniforme), cada adicional passa a virar um chamado independente, no serviço
-- que já existe no catálogo. O objetivo é operacional: quem aprova equipamento
-- não deveria precisar abrir mobilizações de pessoa para achar o que lhe cabe.
--
-- Aqui entra só o vínculo entre o chamado filho e a mobilização que o gerou.
-- Rodar ANTES de subir o build com a funcionalidade: o insert do filho manda
-- esta coluna, e sem ela o pedido falha.
-- ============================================================================

alter table public.chamados_adm
  add column if not exists origem_chamado_id uuid
    references public.chamados_adm(id) on delete set null;

comment on column public.chamados_adm.origem_chamado_id is
  'Mobilização que gerou este chamado, quando ele nasceu de um adicional. '
  'ON DELETE SET NULL: apagar a mobilização não pode levar junto um pedido de '
  'equipamento que segue seu próprio fluxo de aprovação.';

-- Serve à pergunta "o que esta mobilização gerou?", feita na tela do chamado.
-- Parcial porque a coluna é nula na esmagadora maioria das linhas.
create index if not exists chamados_adm_origem_idx
  on public.chamados_adm (origem_chamado_id)
  where origem_chamado_id is not null;

-- A RLS não muda: o filho é um chamado como outro qualquer, e as policies já
-- existentes o entregam a quem é solicitante, aprovador ou atendente dele.
-- Note que o solicitante do filho é o MESMO da mobilização — quem aprova o
-- equipamento vem da configuração daquele serviço, não da mobilização.

notify pgrst, 'reload schema';
