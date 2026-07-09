-- Migration: solicitacoes_rh_numero (projeto bogsuuhrgvopzgcceoqz)

-- Número sequencial curto e estável da requisição (#1, #2, ...), para
-- referência entre as pessoas. Backfill por ordem de criação (mais antiga = 1);
-- novas recebem da sequência. Policies inalteradas.
alter table public.solicitacoes_rh add column if not exists numero bigint;

with ordenado as (
  select id, row_number() over (order by created_at, id) as rn
  from public.solicitacoes_rh
)
update public.solicitacoes_rh s
set numero = o.rn
from ordenado o
where o.id = s.id and s.numero is null;

create sequence if not exists public.solicitacoes_rh_numero_seq
  owned by public.solicitacoes_rh.numero;

select setval('public.solicitacoes_rh_numero_seq',
              coalesce((select max(numero) from public.solicitacoes_rh), 0) + 1,
              false);

alter table public.solicitacoes_rh
  alter column numero set default nextval('public.solicitacoes_rh_numero_seq');
alter table public.solicitacoes_rh alter column numero set not null;

create unique index if not exists solicitacoes_rh_numero_key
  on public.solicitacoes_rh (numero);
