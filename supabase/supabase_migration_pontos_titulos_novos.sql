-- Migration: 36 títulos novos e a frase de cada título (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (23/10/2026): a lista de títulos em quatro grupos
-- (engenharia e planejamento, humor corporativo, campo e obra, personalidade),
-- cada um com a "descrição da insígnia". Os títulos que já existiam ganham
-- uma frase no mesmo tom, no lugar da descrição do visual ("Planilha
-- coroada."). A frase aparece embaixo do nome na insígnia grande e na dica da
-- mini (src/components/Pontos/Insignia.jsx); o grupo, o nome e a frase também
-- estão em src/config/pontos.js (GRUPOS_TITULO), que precisa bater com isto.
--
-- Nomes com maiúscula só no início, como os títulos que já existiam (siglas e
-- nomes próprios ficam: PPC, RDO, Power BI, Teams...). Mesmo custo dos outros
-- títulos (80). `preco` é legado (obrigatório); vale `custo`.
--
-- Ordem: aplicar JUNTO com o deploy do front. Antes dele, a vitrine mostraria
-- os 36 títulos sem arte, e quem trocasse pontos por um deles não veria a
-- insígnia em lugar nenhum (o front antigo não conhece o id).
-- ============================================================================

insert into public.pontos_itens (id, categoria, nome, descricao, preco, custo, requer_aprovacao, em_breve, ordem)
values
  -- Engenharia, planejamento e gestão
  ('t-domador',         'titulo', 'Domador de cronogramas',    'Faz até o caminho crítico obedecer.',          150, 80, false, false, 100),
  ('t-caminho-critico', 'titulo', 'Senhor do caminho crítico', 'Uma atividade atrasou? Ele já sabe.',          150, 80, false, false, 110),
  ('t-pull-planning',   'titulo', 'Mestre do Pull Planning',   'Puxa o plano e a responsabilidade.',           150, 80, false, false, 120),
  ('t-restricoes',      'titulo', 'Caçador de restrições',     'Nenhuma pendência passa despercebida.',        150, 80, false, false, 130),
  ('t-linha-base',      'titulo', 'Guardião da linha de base', 'A LB é sagrada.',                              150, 80, false, false, 140),
  ('t-replan',          'titulo', 'Rei do replan',             'Replanejar é uma arte.',                       150, 80, false, false, 150),
  ('t-power-bi',        'titulo', 'Mago do Power BI',          'Transforma dados em decisões.',                150, 80, false, false, 160),
  ('t-curva-s',         'titulo', 'Senhor das curvas S',       'Previsto, realizado e uma dose de desespero.', 150, 80, false, false, 170),
  ('t-ppc',             'titulo', 'Fiscal do PPC',             'Prometeu? Agora tem que cumprir.',             150, 80, false, false, 180),
  ('t-monte-carlo',     'titulo', 'Oráculo do Monte Carlo',    'Prevendo atrasos antes de acontecerem.',       150, 80, false, false, 190),
  -- Humor corporativo e cotidiano da PHD
  ('t-clt-premium',     'titulo', 'CLT premium',               'Trabalha como dono, recebe como funcionário.', 150, 80, false, false, 200),
  ('t-reuniao',         'titulo', 'Só mais uma reunião',       'A agenda é seu habitat natural.',              150, 80, false, false, 210),
  ('t-teams',           'titulo', 'Sobrevivente do Teams',     'Essa reunião poderia ser um e-mail.',          150, 80, false, false, 220),
  ('t-incendios',       'titulo', 'Apagador de incêndios',     'Resolve problemas que nem criou.',             150, 80, false, false, 230),
  ('t-deixa-comigo',    'titulo', 'Deixa comigo',              'Aceita a missão antes de saber o tamanho.',    150, 80, false, false, 240),
  ('t-cafe-desespero',  'titulo', 'Café com desespero',        'Movido a cafeína e prazo apertado.',           150, 80, false, false, 250),
  ('t-sextou',          'titulo', 'Sextou? Ainda não!',        'O cronograma não conhece finais de semana.',   150, 80, false, false, 260),
  ('t-ultimo',          'titulo', 'Último a sair',             'A luz apaga, mas ele continua.',               150, 80, false, false, 270),
  ('t-diretoria',       'titulo', 'Modo diretoria',            'Uma apresentação e três perguntas difíceis.',  150, 80, false, false, 280),
  ('t-ctrl-cv',         'titulo', 'Ctrl+C, Ctrl+V',            'Produtividade em sua forma mais pura.',        150, 80, false, false, 290),
  -- Campo, obras e engenharia raiz
  ('t-raiz',            'titulo', 'Engenheiro raiz',           'Capacete na cabeça e poeira na alma.',         150, 80, false, false, 300),
  ('t-botina-ouro',     'titulo', 'Botina de ouro',            'Onde tem obra, tem pegada.',                   150, 80, false, false, 310),
  ('t-churrasqueira',   'titulo', 'Fiscal de churrasqueira',   'De olho até no ponto da solda.',               150, 80, false, false, 320),
  ('t-rdo',             'titulo', 'Senhor do RDO',             'Se não registrou, não aconteceu.',             150, 80, false, false, 330),
  ('t-desvios',         'titulo', 'Caçador de desvios',        'Encontra problemas até onde não existem.',     150, 80, false, false, 340),
  ('t-capacete',        'titulo', 'Capacete amassado',         'Experiência que não se aprende em sala.',      150, 80, false, false, 350),
  ('t-prancheta',       'titulo', 'Dono da prancheta',         'Nada passa sem sua conferência.',              150, 80, false, false, 360),
  ('t-parada',          'titulo', 'Guerreiro da parada',       '45 dias que parecem 450.',                     150, 80, false, false, 370),
  -- Personalidade e comportamento
  ('t-resolvedor',      'titulo', 'O resolvedor',              'Problema dado, problema resolvido.',           150, 80, false, false, 400),
  ('t-caos',            'titulo', 'Embaixador do caos',        'Mantém a calma quando tudo desanda.',          150, 80, false, false, 410),
  ('t-lenda',           'titulo', 'Lenda da PHD',              'Todo mundo já ouviu falar.',                   150, 80, false, false, 420),
  ('t-memes',           'titulo', 'Mestre dos memes',          'O humor também faz parte da entrega.',         150, 80, false, false, 430),
  ('t-prazo',           'titulo', 'Inimigo do prazo',          'Sempre correndo contra o relógio.',            150, 80, false, false, 440),
  ('t-multitarefas',    'titulo', 'Multitarefas',              'Dez demandas, duas mãos e um café.',           150, 80, false, false, 450),
  ('t-excelencia',      'titulo', 'Excelência em pessoa',      'Entrega resultado sem perder a parceria.',     150, 80, false, false, 460),
  ('t-fora-curva',      'titulo', 'Fora da curva',             'Não segue a média. Supera.',                   150, 80, false, false, 470)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, custo = excluded.custo,
  ativo = true, ordem = excluded.ordem;

-- Frase nova para os títulos que já existiam (nome, preço e ordem ficam).
update public.pontos_itens i set descricao = f.frase
  from (values
    ('t-botina',   'Se a botina está limpa, não foi pra obra.'),
    ('t-home',     'Câmera desligada, produtividade ligada.'),
    ('t-crono',    'O Gantt obedece, a equipe agradece.'),
    ('t-cafe',     'Primeiro o café, depois o cronograma.'),
    ('t-monster',  'Uma lata e o dia rende o dobro.'),
    ('t-equino',   'Trabalha que nem um cavalo, e nem reclama.'),
    ('t-excel',    'PROCV no café da manhã.'),
    ('t-ia',       'Pode deixar que a IA faz. Ele só revisa.'),
    ('t-presente', 'Falta? Só se for de café.')
  ) as f(id, frase)
 where i.id = f.id;
