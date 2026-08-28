-- ============================================================================
-- Importação das ideias que foram registradas FORA do portal (planilha do
-- Forms do Campo de Ideias) para public.programas_ideias.
--
-- As quatro linhas vieram do formulário de IDEIA — título, setor, descrição,
-- problema, benefícios, tipo e retorno — então todas entram como `ideia`.
--
-- "N/A" é o que a pessoa respondeu, e é assim que fica gravado: trocar por um
-- texto plausível seria apresentar invenção minha como resposta dela. O que os
-- campos obrigatórios (problema, benefícios, retorno) exigem é conteúdo, não
-- conteúdo bom — quem registrou revisa depois, pela própria tela de edição.
--
-- A situação entra como 'idealizado', o padrão de quem acabou de registrar:
-- nenhuma das quatro se declarou iniciada.
--
-- O autor sai do e-mail, como no portal — o nome nunca é digitado.
--
-- Os ids começam em 'c8ad' para a origem ser rastreável, no mesmo padrão do
-- supabase_import_programas_criacoes.sql (que usa 'c8ac'):
--   select * from programas_ideias where id::text like 'c8ad%';
--
-- Idempotente: rodar duas vezes não duplica (on conflict do nothing).
-- ============================================================================

begin;

insert into public.programas_ideias
  (id, tipo, titulo, setor,
   categoria, retorno, situacao,
   descricao, problema, beneficios,
   observacoes, autor_id, criado_em)
select v.id, 'ideia', v.titulo, v.setor,
       v.categoria, v.retorno, 'idealizado',
       v.descricao, v.problema, v.beneficios,
       'Registrado fora do portal, na planilha do Forms do Campo de Ideias, e importado depois.',
       c.id, v.criado_em
from (values
  ('c8ad0000-0000-4000-8000-000000000001'::uuid,
   'jader.correa@phdengenharia.eng.br',
   'Verificação automatizada de avanço físico e desvio de cronograma a partir do XER do Primavera P6',
   'Operação', 'coletiva', 'N/A',
   'Em um comando: planilha espelho do cronograma com a EAP rastreável até a atividade',
   'N/A', 'N/A',
   timestamptz '2026-08-24 08:58:00-03:00'),

  ('c8ad0000-0000-4000-8000-000000000002'::uuid,
   'pedro.nery@phdengenharia.eng.br',
   'Produto para atuarmos na estratégia dos projetos com o foco no ciclo de vida todo do projeto. Digital twin, etc...',
   'Diretoria', 'coletiva', 'N/A',
   'Produto para atuarmos na estratégia dos projetos com o foco no ciclo de vida todo do projeto. Digital twin, etc...',
   'N/A', 'N/A',
   timestamptz '2026-08-17 16:34:00-03:00'),

  ('c8ad0000-0000-4000-8000-000000000003'::uuid,
   'pedro.nery@phdengenharia.eng.br',
   'OQue podemos fazer para substituir o MS Project',
   'Diretoria', 'coletiva', 'N/A',
   'Devido a retirada do MS project do mercado pela microsoft gostaria e propor um brianstorming de como podemos substituir ou resolver o problema do mercado de quem utiliza o project!',
   'N/A', 'N/A',
   timestamptz '2026-05-12 16:31:00-03:00'),

  ('c8ad0000-0000-4000-8000-000000000004'::uuid,
   'ivan.silva@phdengenharia.eng.br',
   'Encurtador de URL',
   'Construtibilidade', 'coletiva', 'N/A',
   'Criar um encurtador de URL próprio da PHD.',
   'Alguns links que precisamos compartilhar são grandes demais. Então, a saída é usar um encurtador de link. Porém os links gratuitos disponíveis na internet por muitas vezes dão erro, expiram ou contém diversas propagandas.',
   'Um visual próprio da PHD, um link com domínio exclusivo, onde o cliente fica com mais segurança para clicar.',
   timestamptz '2026-02-06 17:45:00-03:00')
) as v (id, email, titulo, setor, categoria, retorno,
        descricao, problema, beneficios, criado_em)
join public.colaboradores c on lower(c.email) = v.email
on conflict (id) do nothing;

-- Trava de segurança: se algum e-mail não existir em colaboradores, o join
-- descarta a linha em silêncio — e uma ideia some sem ninguém perceber.
do $$
declare faltam int;
begin
  select 4 - count(*) into faltam
    from public.programas_ideias where id::text like 'c8ad%';
  if faltam <> 0 then
    raise exception 'Faltaram % ideia(s): confira os e-mails em colaboradores.', faltam;
  end if;
end $$;

commit;
