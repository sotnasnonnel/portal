-- Nomes de pessoas da Gestão de Pessoas sempre em MAIÚSCULAS (24/11/2026).
--
-- O padrão do cadastro já era caixa alta, mas entravam nomes em caixa
-- mista: o primeiro login pela Microsoft grava o nome do Azure
-- como vem, e o formulário de contratação gravava o que o gestor digitava.
-- Os gatilhos abaixo valem para QUALQUER caminho de escrita (tela, RPC,
-- login, importação); o front também põe em maiúsculas enquanto se digita.
--
-- Cobre: colaboradores.nome (inclui candidatos), pj_prestadores.nome e o
-- nome dos dependentes (jsonb), formularios_contratacao.nome_profissional e
-- nome_substituido, e mobilizacao_processos.profissional_nome (copiado da
-- contratação).
--
-- Sem pré-requisito de deploy: pode aplicar antes ou depois do front.

-- 1) Gatilhos --------------------------------------------------------------

create or replace function public.nome_maiusculo_colaboradores()
returns trigger language plpgsql as $$
begin
  if new.nome is not null then new.nome := upper(btrim(new.nome)); end if;
  return new;
end $$;

drop trigger if exists colaboradores_nome_maiusculo on public.colaboradores;
create trigger colaboradores_nome_maiusculo
  before insert or update of nome on public.colaboradores
  for each row execute function public.nome_maiusculo_colaboradores();

create or replace function public.nome_maiusculo_pj_prestadores()
returns trigger language plpgsql as $$
begin
  if new.nome is not null then new.nome := upper(btrim(new.nome)); end if;
  if jsonb_typeof(new.dependentes) = 'array' and jsonb_array_length(new.dependentes) > 0 then
    new.dependentes := (
      select jsonb_agg(
               case when jsonb_typeof(d->'nome') = 'string'
                    then jsonb_set(d, '{nome}', to_jsonb(upper(btrim(d->>'nome'))))
                    else d end
               order by o)
        from jsonb_array_elements(new.dependentes) with ordinality as t(d, o)
    );
  end if;
  return new;
end $$;

drop trigger if exists pj_prestadores_nome_maiusculo on public.pj_prestadores;
create trigger pj_prestadores_nome_maiusculo
  before insert or update of nome, dependentes on public.pj_prestadores
  for each row execute function public.nome_maiusculo_pj_prestadores();

create or replace function public.nome_maiusculo_contratacao()
returns trigger language plpgsql as $$
begin
  if new.nome_profissional is not null then new.nome_profissional := upper(btrim(new.nome_profissional)); end if;
  if new.nome_substituido is not null then new.nome_substituido := upper(btrim(new.nome_substituido)); end if;
  return new;
end $$;

drop trigger if exists formularios_contratacao_nome_maiusculo on public.formularios_contratacao;
create trigger formularios_contratacao_nome_maiusculo
  before insert or update of nome_profissional, nome_substituido on public.formularios_contratacao
  for each row execute function public.nome_maiusculo_contratacao();

create or replace function public.nome_maiusculo_mobilizacao()
returns trigger language plpgsql as $$
begin
  if new.profissional_nome is not null then new.profissional_nome := upper(btrim(new.profissional_nome)); end if;
  return new;
end $$;

drop trigger if exists mobilizacao_processos_nome_maiusculo on public.mobilizacao_processos;
create trigger mobilizacao_processos_nome_maiusculo
  before insert or update of profissional_nome on public.mobilizacao_processos
  for each row execute function public.nome_maiusculo_mobilizacao();

-- 2) Padroniza o que já existe (os gatilhos fazem o upper) -------------------

update public.colaboradores set nome = nome where nome <> upper(btrim(nome));

update public.pj_prestadores set nome = nome
 where nome <> upper(btrim(nome))
    or exists (select 1 from jsonb_array_elements(
                 case when jsonb_typeof(dependentes) = 'array' then dependentes else '[]'::jsonb end) d
                where d->>'nome' <> upper(btrim(d->>'nome')));

update public.formularios_contratacao
   set nome_profissional = nome_profissional, nome_substituido = nome_substituido
 where nome_profissional <> upper(btrim(nome_profissional))
    or nome_substituido <> upper(btrim(nome_substituido));

update public.mobilizacao_processos set profissional_nome = profissional_nome
 where profissional_nome <> upper(btrim(profissional_nome));
