-- Migration: chamados_adm_time (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- VERSIONAMENTO de uma função que já existe em produção. NÃO muda nada.
--
-- `chamados_adm_time()` foi aplicada direto no Supabase e nunca entrou no
-- repositório. Ela é usada por `listarTimeAdm()`
-- (src/modules/administrativo/lib/chamados.js) para popular o "Alterar
-- responsável" do chamado — e agora também pela Mobilização, para escolher o
-- responsável de uma etapa (src/modules/mobilizacao/lib/mobilizacao.js).
--
-- Com dois módulos dependendo dela, um `supabase db reset` a partir dos
-- arquivos do repositório deixaria as duas telas quebradas sem nenhum arquivo
-- explicando o quê. Este arquivo fecha esse buraco.
--
-- O corpo abaixo foi COPIADO da definição que está no banco
-- (pg_get_functiondef), não reescrito: versionar é registrar o que existe, e
-- uma versão "melhorada" aqui viraria uma mudança de comportamento disfarçada
-- de documentação.
--
-- POR QUE ELA EXISTE, e não basta consultar colaboradores: a policy
-- `colaboradores_select` só libera a própria linha, a equipe e o admin do DP.
-- O atendente do Adm não enxergaria os colegas de time, e o seletor viria
-- vazio e calado.
--
-- POR QUE É SEPARADA de `chamados_adm_pessoas()`: aquela devolve a empresa
-- inteira, para escolher aprovador. Atribuir um chamado (ou uma etapa) a
-- alguém de fora do time o tiraria da fila, e ele só reapareceria para essa
-- pessoa.
--
-- Repare que ela devolve TRÊS colunas — a terceira é o papel, que hoje nenhuma
-- tela usa. Quem consumir precisa contar com ela.
-- ============================================================================

create or replace function public.chamados_adm_time()
returns table(id uuid, nome text, papel text)
language sql security definer set search_path to 'public' as $$
  select c.id, c.nome, c.administrativo_role
    from public.colaboradores c
   where c.ativo is not false
     and c.administrativo_role is not null
   order by c.nome
$$;

notify pgrst, 'reload schema';
