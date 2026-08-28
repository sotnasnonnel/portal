-- ============================================================================
-- APLICAR NO PROJETO backoffice_phd (dvvqgoxqawyhycakppps) — NÃO no portal_phd.
--
-- Checagem de elegibilidade do programa Alavanca PHD (módulo Programas).
--
-- O Portal lê este projeto com a chave ANON e SEM sessão (ver
-- src/services/supabaseBackoffice.js), então não dá para consultar accounts /
-- contacts direto: as policies delas exigem 'authenticated'. Abrir leitura anon
-- nessas tabelas exporia a carteira inteira de clientes ao bundle do navegador.
--
-- Esta função é o contrário: SECURITY DEFINER que recebe o que o colaborador
-- JÁ digitou e devolve só o veredito sobre aquilo. Nada que o chamador ainda
-- não conheça sai daqui, além do nome cadastrado da conta que casou — que é o
-- que explica a recusa para quem indicou.
--
-- Enquanto esta função não existir, o Portal trata toda indicação como
-- "em análise" e o time comercial decide na mão (ver lib/elegibilidade.js).
-- ============================================================================
create or replace function public.alavanca_checar_base(
  p_empresa text,
  p_contato text default null,
  p_email   text default null
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $fn$
  with alvo as (
    select
      lower(btrim(coalesce(p_empresa, ''))) as empresa,
      lower(btrim(coalesce(p_contato, ''))) as contato,
      lower(btrim(coalesce(p_email, '')))   as email
  ),
  -- Casamento por conteúdo, não por igualdade: ninguém digita a razão social
  -- exata. O piso de 3 caracteres evita que "SA" case com meio cadastro.
  conta as (
    select a.id, a.name
    from public.accounts a, alvo
    where a.deleted_at is null
      and length(alvo.empresa) >= 3
      and (
        lower(btrim(a.name)) = alvo.empresa
        or lower(btrim(coalesce(a.corporate_name, ''))) = alvo.empresa
        or position(alvo.empresa in lower(a.name)) > 0
        or position(lower(a.name) in alvo.empresa) > 0
        or position(alvo.empresa in lower(coalesce(a.corporate_name, ''))) > 0
      )
    order by (lower(btrim(a.name)) = alvo.empresa) desc, length(a.name) asc
    limit 1
  ),
  -- E-mail bate em qualquer conta (é identificador único de pessoa). Nome só
  -- conta como reencontro se for na MESMA empresa — homônimo em cliente
  -- diferente não é o mesmo contato.
  achado as (
    select c.name, c.full_name
    from public.contacts c, alvo
    where c.deleted_at is null
      and (
        (length(alvo.email) >= 5 and lower(btrim(coalesce(c.email, ''))) = alvo.email)
        or (
          length(alvo.contato) >= 3
          and c.account_id = (select id from conta)
          and (
            position(alvo.contato in lower(coalesce(c.name, ''))) > 0
            or position(alvo.contato in lower(coalesce(c.full_name, ''))) > 0
          )
        )
      )
    limit 1
  )
  select jsonb_build_object(
    'empresa_na_base', (select count(*) from conta) > 0,
    'empresa_cadastrada', (select name from conta),
    'contato_na_base', (select count(*) from achado) > 0,
    'contato_cadastrado', (select coalesce(full_name, name) from achado)
  )
$fn$;

-- Aqui o anon É intencional: o Portal lê este projeto com a chave anon e sem
-- sessão (supabaseBackoffice). A função só devolve o veredito sobre o que o
-- chamador já digitou — nunca uma lista.
revoke all on function public.alavanca_checar_base(text, text, text) from public;
grant execute on function public.alavanca_checar_base(text, text, text) to anon, authenticated;
