-- Migration: o aniversariante curte e responde cada recado do mural (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (19/10/2026): quem está de aniversário podia só LER o
-- mural. Agora pode reagir a cada recado, um por um:
--   curtir    -> um coração no recado (liga e desliga);
--   responder -> uma resposta curta (até 500), que fica embaixo do recado.
--
-- Quem reage é SÓ o aniversariante (parabens_recados.para_id = eu). Os dois
-- RPCs recebem o id do recado e conferem isso no banco — não é o front que
-- decide. Quem escreveu o recado vê o coração e a resposta quando abre o mural.
--
-- Um recado, uma curtida e uma resposta: as duas moram no próprio recado
-- (curtido_em, resposta, resposta_em), sem tabela nova. Não é um bate-papo —
-- é a reação do aniversariante àquele recado.
--
-- Fora da janela do aniversário (ver supabase_migration_parabens_fim_de_semana.sql)
-- não há trava aqui: a tela já só abre o mural de quem está em cartaz, e o
-- aniversariante que responde mais tarde não está fazendo nada de errado.
--
-- Editar o próprio recado NÃO apaga a curtida nem a resposta: elas são do
-- aniversariante, e parabens_enviar só mexe em texto e ícones.
--
-- DEPLOY: aplique este SQL ANTES do front novo. Nas duas ordens:
--   - banco novo + front antigo: parabens_mural ganha três colunas que o front
--     antigo ignora; nada muda para ele;
--   - front novo + banco antigo: os botões aparecem e o clique dá erro (os RPCs
--     não existem). Por isso o banco vem primeiro.
--
-- Já aplicada em 19/10/2026 (migration parabens_curtir_responder), e conferida
-- com o JWT de um aniversariante de verdade: curtir e descurtir, responder e
-- apagar a resposta, 501 caracteres barrados e quem não é o dono do mural
-- barrado nos dois RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Onde a reação mora
-- ----------------------------------------------------------------------------
alter table public.parabens_recados
  add column if not exists curtido_em  timestamptz,
  add column if not exists resposta    text,
  add column if not exists resposta_em timestamptz;

alter table public.parabens_recados drop constraint if exists parabens_resposta_tam;
alter table public.parabens_recados
  add constraint parabens_resposta_tam
  check (resposta is null or char_length(btrim(resposta)) between 1 and 500);

-- ----------------------------------------------------------------------------
-- 2) O mural passa a trazer a reação
--
-- curtido é booleano para o front não precisar saber da hora; resposta_em
-- serve para ordenar/contar depois, se um dia virar aviso por e-mail.
-- O tipo de retorno muda, então a função é recriada.
-- ----------------------------------------------------------------------------
drop function if exists public.parabens_mural(uuid);

create function public.parabens_mural(p_para uuid)
returns table (id uuid, de_id uuid, de_nome text, texto text, criado_em timestamptz,
               moldura text, mural text[], icones text[],
               curtido boolean, resposta text, resposta_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.de_id, c.nome, r.texto, r.criado_em, p.moldura, coalesce(p.mural, '{}'), r.icones,
         r.curtido_em is not null, r.resposta, r.resposta_em
    from public.parabens_recados r
    join public.colaboradores c on c.id = r.de_id
    left join public.pontos_perfil p on p.colaborador_id = r.de_id
   where r.para_id = p_para
     and r.ano = coalesce(extract(year from app_private.comemoracao_em_cartaz(p_para))::int,
                          extract(year from app_private.hoje_brasil())::int)
   order by r.criado_em
$$;
revoke all on function public.parabens_mural(uuid) from public, anon;
grant execute on function public.parabens_mural(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) Curtir (liga e desliga)
-- ----------------------------------------------------------------------------
create or replace function public.parabens_curtir(p_recado uuid, p_curtir boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  update public.parabens_recados
     set curtido_em = case when coalesce(p_curtir, true) then now() end
   where id = p_recado and para_id = v_me;
  if not found then
    raise exception 'Só o aniversariante curte os recados do próprio mural.';
  end if;
end $$;
revoke all on function public.parabens_curtir(uuid, boolean) from public, anon;
grant execute on function public.parabens_curtir(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) Responder (texto vazio apaga a resposta)
-- ----------------------------------------------------------------------------
create or replace function public.parabens_responder(p_recado uuid, p_texto text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  if v_texto is not null and char_length(v_texto) > 500 then
    raise exception 'Resposta longa demais (máximo de 500 caracteres).';
  end if;
  update public.parabens_recados
     set resposta = v_texto,
         resposta_em = case when v_texto is null then null else now() end
   where id = p_recado and para_id = v_me;
  if not found then
    raise exception 'Só o aniversariante responde os recados do próprio mural.';
  end if;
end $$;
revoke all on function public.parabens_responder(uuid, text) from public, anon;
grant execute on function public.parabens_responder(uuid, text) to authenticated;

notify pgrst, 'reload schema';
