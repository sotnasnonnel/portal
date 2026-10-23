-- Migration: título "Equino" na Personalização (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (20/10/2026). Só um item novo no catálogo, com o mesmo
-- preço dos outros títulos; a arte (cavalo, fundo recortado) está em
-- src/assets/pontos/cavalo.png e o esmalte em src/styles/pontos.css
-- (pts-ins-t-equino).
-- Sem dependência de deploy: o front antigo não conhece o id e mostra o item
-- sem arte na vitrine até o deploy. `preco` é legado (obrigatório); vale `custo`.
-- Já aplicada em 20/10/2026.
-- ============================================================================
insert into public.pontos_itens (id, categoria, nome, descricao, preco, custo, requer_aprovacao, em_breve, ordem)
values ('t-equino', 'titulo', 'Equino', 'Cavalo de crina ao vento. Trabalha que nem um.', 150, 80, false, false, 47)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, custo = excluded.custo,
  ativo = true, ordem = excluded.ordem;
