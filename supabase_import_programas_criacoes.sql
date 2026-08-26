-- ============================================================================
-- Importação do "Controle de Criações com IA" para o Campo de Ideias.
-- Fonte: referencia/Controle de Criações com IA(1-6).xlsx (export do Forms).
-- Gerado por script a partir da planilha — não editar à mão; regerar.
--
-- O formulário de origem é exatamente o de INICIATIVA da planilha do módulo
-- (data de início, setor, o que está criando, ferramenta, finalidade, link,
-- observações), então todas as linhas entram como `iniciativa`.
--
-- DOIS CAMPOS NÃO EXISTIAM naquele formulário e o módulo exige:
--   retorno  -> entra com um texto de PENDÊNCIA, visível no detalhe. Inventar
--               um ganho plausível seria apresentar texto meu como dado real.
--   tipo     -> entra como 'coletiva', o padrão combinado. Quem criou revisa.
-- A situação entra como 'iniciado': o formulário pergunta "o que está
-- criando", então nada ali é só ideia, e nenhuma linha se declarou concluída.
--
-- Os ids começam em 'c8ac' (hex válido) para a origem ser rastreável:
--   select * from programas_ideias where id::text like 'c8ac%';
-- ============================================================================

begin;

-- Sai o dado de demonstração: com os dois no mesmo quadro ninguém distingue
-- o que é real do que era exemplo.
delete from public.programas_alavanca where id::text like 'deadbeef-%';
delete from public.programas_ideias   where id::text like 'deadbeef-%';

insert into public.programas_ideias
  (id, tipo, titulo, setor,
   categoria, retorno, situacao,
   data_inicio, ferramentas, finalidade, link, observacoes,
   autor_id, criado_em)
values
  ('c8ac0000-0000-4000-8000-000000000001', 'iniciativa', 'Mapa visual de vagas para controle dos recrutadores e report à operação', 'RH',
   'coletiva', 'A preencher — importado do formulário "Controle de Criações com IA", que não perguntava o retorno esperado.', 'iniciado',
   date '2026-05-04', array['Claude'], 'Organização e report das vagas que estão sendo trabalhadas', null, 'Local do arquivo: C:\Users\lucas.ferraz\PHD SOLUCOES EM ENGENHARIA EIRELI\PHD - Gestão de Pessoas - General\2 - Recrutamento\Sistema Claude

Importado do formulário "Controle de Criações com IA". O tipo (individual/coletiva/venda) e o retorno esperado não existiam naquele formulário e precisam ser revisados por quem criou.', '554ec9c1-c4fb-4b5a-b4a6-040c835acca5', timestamptz '2026-05-18 08:55:38-03:00'),
  ('c8ac0000-0000-4000-8000-000000000002', 'iniciativa', 'Plataforma de análise de indicadores comerciais.', 'Comercial',
   'coletiva', 'A preencher — importado do formulário "Controle de Criações com IA", que não perguntava o retorno esperado.', 'iniciado',
   date '2026-05-07', array['Claude', 'Netlify', 'supabase'], 'Ter um maior controle de indicadores, conseguir analisar com maior agilidade indicadores comerciais como: pipeline, produtos, performance gerencial, projeção de fechamentos, tempo & conversão, análise de revisões, volume por produto, entre outros vários indicadores.', 'https://comercial-analytics.netlify.app/index.html', 'Somente pessoas autorizadas conseguem logar na plataforma. 
Pessoas com login: André e Daniel (comercial)

Importado do formulário "Controle de Criações com IA". O tipo (individual/coletiva/venda) e o retorno esperado não existiam naquele formulário e precisam ser revisados por quem criou.', 'c90dc80e-418f-4958-9108-82217e097917', timestamptz '2026-05-18 11:44:20-03:00'),
  ('c8ac0000-0000-4000-8000-000000000003', 'iniciativa', 'Aplicativo para controle de suprimentos para a Construcap', 'Excelência operacional',
   'coletiva', 'A preencher — importado do formulário "Controle de Criações com IA", que não perguntava o retorno esperado.', 'iniciado',
   date '2026-05-18', array['Antigravity'], 'Uso no projeto novo da Construcap.', null, 'Local do arquivo: Ainda em estado de avanço na pasta pessoal.

Importado do formulário "Controle de Criações com IA". O tipo (individual/coletiva/venda) e o retorno esperado não existiam naquele formulário e precisam ser revisados por quem criou.', '83de65d2-316e-45c1-802d-5d0e3e83c7b7', timestamptz '2026-06-01 09:36:41-03:00'),
  ('c8ac0000-0000-4000-8000-000000000004', 'iniciativa', 'Plano de Trabalho automatizado', 'Excelência operacional',
   'coletiva', 'A preencher — importado do formulário "Controle de Criações com IA", que não perguntava o retorno esperado.', 'iniciado',
   date '2026-05-11', array['Antigravity'], 'Tentativa de automatizar a formação do plano de trabalho.', null, 'Local do arquivo: Ainda em estado de teste na pasta pessoal.

Importado do formulário "Controle de Criações com IA". O tipo (individual/coletiva/venda) e o retorno esperado não existiam naquele formulário e precisam ser revisados por quem criou.', '83de65d2-316e-45c1-802d-5d0e3e83c7b7', timestamptz '2026-06-01 09:37:35-03:00'),
  ('c8ac0000-0000-4000-8000-000000000005', 'iniciativa', 'Estou criando o Diário de Bordo, uma ferramenta para facilitar o acompanhamento das entregas de cada colaborador. A ideia é reunir em um só lugar os prazos, arquivos, pendências, justificativas e resultados, evitando cobranças espalhadas por e-mail, WhatsApp ou Teams. Assim, cada pessoa consegue acompanhar suas responsabilidades, e os gestores têm uma visão mais clara do andamento das equipes e dos projetos', 'Operação',
   'coletiva', 'A preencher — importado do formulário "Controle de Criações com IA", que não perguntava o retorno esperado.', 'iniciado',
   date '2026-07-01', array['Base44'], 'A finalidade do Diário de Bordo é facilitar o controle das entregas e responsabilidades de cada colaborador, reunindo prazos, arquivos, pendências e justificativas em um único lugar. Com isso, o sistema ajuda a reduzir cobranças manuais, evitar atrasos e dar mais transparência para o acompanhamento das equipes e dos projetos.', null, 'Local do arquivo: Base44 - Ainda não publicado

Importado do formulário "Controle de Criações com IA". O tipo (individual/coletiva/venda) e o retorno esperado não existiam naquele formulário e precisam ser revisados por quem criou.', '0b65fd2b-6413-43be-b205-30532d845782', timestamptz '2026-07-13 09:13:44-03:00'),
  ('c8ac0000-0000-4000-8000-000000000006', 'iniciativa', 'TakeOff Engine - Aplicativo para quantificação de Take off automatico', 'Excelência operacional',
   'coletiva', 'A preencher — importado do formulário "Controle de Criações com IA", que não perguntava o retorno esperado.', 'iniciado',
   date '2026-08-11', array['Antigravity', 'Antigravity IDE', 'Gemini'], 'Redução de carga de trabalho', null, 'Local do arquivo: Interno

Utilizando API pessoal no primeiro momento para testes. Backend interno no PC

Importado do formulário "Controle de Criações com IA". O tipo (individual/coletiva/venda) e o retorno esperado não existiam naquele formulário e precisam ser revisados por quem criou.', '83de65d2-316e-45c1-802d-5d0e3e83c7b7', timestamptz '2026-08-11 15:01:19-03:00')
on conflict (id) do nothing;

commit;
