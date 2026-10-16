-- Migration: excluir o próprio recado do mural de parabéns (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (16/10/2026). Quem escreveu pode apagar o próprio recado
-- (do aniversário deste ano). Os pontos já ganhos ficam; escrever de novo para
-- o mesmo aniversariante não paga outra vez (a chave do movimento é a mesma).
-- Sem dependência de deploy. Já aplicada em 16/10/2026.
-- ============================================================================
create or replace function public.parabens_excluir(p_para uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  -- Só o próprio recado, do aniversário deste ano.
  delete from public.parabens_recados
   where para_id = p_para and de_id = v_me
     and ano = extract(year from app_private.hoje_brasil())::int;
end $$;
revoke all on function public.parabens_excluir(uuid) from public, anon;
grant execute on function public.parabens_excluir(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- Ícones no recado (pedido do mesmo dia): até 3, de uma lista fixa (as imagens
-- estão em src/assets/pontos). parabens_enviar ganha p_icones (com default, o
-- front antigo segue chamando com 2 argumentos) e parabens_mural devolve os
-- ícones. As duas foram recriadas porque mudaram de assinatura/retorno.
-- Já aplicada em 16/10/2026 (migration parabens_icones; o corpo completo das
-- funções está na versão aplicada).
-- ----------------------------------------------------------------------------
alter table public.parabens_recados add column if not exists icones text[] not null default '{}';
alter table public.parabens_recados drop constraint if exists parabens_icones_validos;
alter table public.parabens_recados add constraint parabens_icones_validos check (
  cardinality(icones) <= 3
  and icones <@ array['festa','bolo','balao','presente','confete','rosto-festa','brinde','coracao','palmas','brilho']::text[]
);
