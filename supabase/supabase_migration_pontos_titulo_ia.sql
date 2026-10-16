-- Migration: título "IA trabalhando" na Personalização (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (16/10/2026). Só um item novo no catálogo; o visual da
-- insígnia (robô digitando) está em src/styles/pontos.css (pts-ins-t-ia).
-- Sem dependência de deploy: o front antigo não conhece o id e não mostra
-- a insígnia (o item aparece sem arte na vitrine até o deploy).
-- Já aplicada em 16/10/2026.
-- ============================================================================
insert into public.pontos_itens (id, categoria, nome, descricao, preco, requer_aprovacao, em_breve, ordem)
values ('t-ia', 'titulo', 'IA trabalhando', 'Robô digitando por você. Pode deixar que a IA faz.', 1, false, false, 55)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, ativo = true, ordem = excluded.ordem;

-- Sem a aba "Pedidos do RH" (pedido do usuário, 16/10/2026) ninguém modera o
-- título personalizado, que é texto livre: sai do catálogo e de quem usava.
update public.pontos_itens set ativo = false where id = 't-livre';
update public.pontos_perfil set titulo = null where titulo = 't-livre';
