-- Financeiro: a solicitação de cartão passa a ter duas modalidades
-- ---------------------------------------------------------------------------
-- O formulário de cartão agora pergunta se o cartão é VIRTUAL (como era) ou
-- FÍSICO. No físico o solicitante informa o endereço de entrega (estimativa de
-- 10 dias úteis, avisada na tela). O tipo da solicitação continua
-- 'cartao_virtual' — fluxos, alçadas e aumento de limite não mudam.

alter table solicitacoes_financeiro
  add column if not exists modalidade_cartao text not null default 'virtual',
  add column if not exists endereco_entrega text;

alter table solicitacoes_financeiro
  drop constraint if exists solicitacoes_financeiro_modalidade_cartao_check;
alter table solicitacoes_financeiro
  add constraint solicitacoes_financeiro_modalidade_cartao_check
  check (modalidade_cartao in ('virtual', 'fisico'));

-- Cartão físico tem que ter endereço de entrega; virtual, não.
alter table solicitacoes_financeiro
  drop constraint if exists solicitacoes_financeiro_endereco_entrega_check;
alter table solicitacoes_financeiro
  add constraint solicitacoes_financeiro_endereco_entrega_check
  check (modalidade_cartao <> 'fisico' or coalesce(btrim(endereco_entrega), '') <> '');

comment on column solicitacoes_financeiro.modalidade_cartao is 'virtual | fisico (só para tipo = cartao_virtual)';
comment on column solicitacoes_financeiro.endereco_entrega is 'Endereço de entrega do cartão físico (estimativa de 10 dias úteis)';
