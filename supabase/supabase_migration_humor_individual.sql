-- Migration: Humor do dia — resposta por pessoa para o RH + comentário (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido da Ana Claudia (RH, 02/10/2026): acompanhar o humor de cada
-- colaborador, com um campo de comentário. Muda a decisão de 30/09/2026
-- ("só agregado, nem o RH lê o individual") por decisão do usuário.
--
-- O que NÃO muda de dono:
--   - Quem respondeu até aqui respondeu lendo "Só você vê a sua resposta". Essas
--     respostas continuam fora da lista por pessoa: só entra na lista o registro
--     marcado como `identificado`, e só a função NOVA marca. Quem ainda estiver
--     com a tela antiga aberta (que promete sigilo) chama a função antiga e
--     segue anônimo — a visibilidade acompanha o aviso que a pessoa leu.
--   - O gestor continua vendo só os números da equipe (humor_resumo, intacta).
--     A lista por pessoa é só do RH (app_private.is_ausencia_rh()).
--
-- Ordem: aplicar ANTES do deploy do front. O front novo chama as funções
-- daqui; o front antigo segue funcionando com as antigas, sem mudança.
--
-- Já aplicada em 02/10/2026.
-- ============================================================================

alter table public.humor_registros
  add column if not exists comentario text,
  add column if not exists identificado boolean not null default false;

alter table public.humor_registros drop constraint if exists humor_comentario_tamanho;
alter table public.humor_registros
  add constraint humor_comentario_tamanho check (comentario is null or char_length(comentario) <= 500);

comment on column public.humor_registros.identificado is
  'true = marcado pela tela que avisa que o RH ve a resposta. So estes entram em humor_respostas.';

-- Marca (ou troca) o humor de hoje, com comentário opcional, e identifica o
-- registro. O front manda sempre o estado inteiro: comentário vazio apaga.
create or replace function public.humor_registrar_identificado(p_humor int, p_comentario text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_coment text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  if v_me is null then
    raise exception 'Seu usuário não está vinculado a um colaborador.';
  end if;
  if p_humor is null or p_humor not between 1 and 5 then
    raise exception 'Humor inválido.';
  end if;
  if char_length(v_coment) > 500 then
    raise exception 'Comentário longo demais (máximo de 500 caracteres).';
  end if;
  insert into public.humor_registros (colaborador_id, dia, humor, comentario, identificado)
  values (v_me, app_private.hoje_brasil(), p_humor, v_coment, true)
  on conflict (colaborador_id, dia)
  do update set humor = excluded.humor, comentario = excluded.comentario,
                identificado = true, updated_at = now();
end $$;
revoke all on function public.humor_registrar_identificado(int, text) from public;
revoke execute on function public.humor_registrar_identificado(int, text) from anon;
grant execute on function public.humor_registrar_identificado(int, text) to authenticated;

-- O que EU marquei hoje, com o comentário (nenhuma linha = ainda não marquei).
-- Função nova em vez de mudar humor_meu_hoje(): o front antigo espera o número.
create or replace function public.humor_meu_registro_hoje()
returns table (humor smallint, comentario text)
language sql stable security definer set search_path = '' as $$
  select h.humor, h.comentario from public.humor_registros h
   where h.colaborador_id = app_private.my_colaborador_id()
     and h.dia = app_private.hoje_brasil()
$$;
revoke all on function public.humor_meu_registro_hoje() from public;
revoke execute on function public.humor_meu_registro_hoje() from anon;
grant execute on function public.humor_meu_registro_hoje() to authenticated;

-- Respostas por pessoa, só para o RH e só as identificadas.
create or replace function public.humor_respostas(p_de date, p_ate date)
returns table (dia date, colaborador_id uuid, nome text, funcao text, humor smallint, comentario text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_ausencia_rh() then
    raise exception 'Apenas o RH vê as respostas por pessoa.' using errcode = 'insufficient_privilege';
  end if;
  if p_ate - p_de > 366 then
    raise exception 'Período longo demais (máximo de um ano).';
  end if;
  return query
  select h.dia, c.id, c.nome, c.funcao, h.humor, h.comentario
    from public.humor_registros h
    join public.colaboradores c on c.id = h.colaborador_id
   where h.identificado
     and h.dia between p_de and p_ate
   order by h.dia desc, c.nome;
end $$;
revoke all on function public.humor_respostas(date, date) from public;
revoke execute on function public.humor_respostas(date, date) from anon;
grant execute on function public.humor_respostas(date, date) to authenticated;

notify pgrst, 'reload schema';
