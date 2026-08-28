-- ============================================================================
-- Importação da base histórica do programa Alavanca PHD.
-- Fonte: "Base - Alavanca.xlsx" (export da lista do SharePoint, 105 linhas).
-- (Aplicada no portal_phd em 2026-08-28.)
--
-- O ARQUIVO VEM DESALINHADO: o exportador gravou só as células preenchidas, em
-- sequência, então de "Data / Hora" em diante os valores caem na coluna errada
-- (39 linhas trazem "Item", que é do Item Type, na coluna Status). A leitura
-- foi refeita pelo FORMATO de cada valor -- Hunter/Farmer, os três status,
-- número = pontos, dd/mm/aaaa = data, resto = situação --, e o resultado bate
-- com a contagem da planilha.
--
-- Decisões, todas visíveis no comentário de cada indicação:
--   • Convertido -> concluida | Em andamento -> em_evolucao
--     Cancelado -> cancelada  | sem status   -> em_analise
--   • elegibilidade: 'elegivel' para quem o comercial levou adiante (a
--     elegibilidade está provada pelos fatos) e 'pendente' para o resto -- a
--     checagem automática nunca rodou nessas linhas.
--   • 76 linhas não têm data de registro: entram com a data da carga e o
--     comentário diz isso. Inventar data seria pior do que admitir a falta.
--   • as 5 concluídas entram com valor_premio = 0: a planilha não traz nem o
--     prêmio nem o valor do contrato, e o CHECK exige um número. O comentário
--     manda conferir com o comercial.
--   • Pontos e Hunter/Farmer não têm coluna no módulo: vão na primeira linha
--     do comentário, como "Planilha: Farmer · 400 pontos".
--
-- Os ids começam em 'a1a1' para a origem ser rastreável:
--   select * from programas_alavanca where id::text like 'a1a1%';
-- Idempotente: rodar duas vezes não duplica.
-- ============================================================================

begin;

-- Sete pessoas da planilha não estão na base de colaboradores. Entram como
-- INATIVAS: preservam a autoria da indicação sem aparecer em seletor de
-- pessoas nem em lista de destinatário de e-mail.
insert into public.colaboradores (nome, email, ativo, perfil)
values
  ('Guilherme Rocha', 'guilherme.rocha@phdengenharia.eng.br', false, 'usuario'),
  ('Daniel Bittencourt', 'daniel.bittencourt@phdengenharia.eng.br', false, 'usuario'),
  ('Carlos Alves', 'carlos.alves@phdengenharia.eng.br', false, 'usuario'),
  ('Armando Figueiredo', 'armando.figueiredo@phdengenharia.eng.br', false, 'usuario'),
  ('Washington Junior', 'washington.junior@phdengenharia.eng.br', false, 'usuario'),
  ('Francisco Viana', 'francisco.viana@phdengenharia.eng.br', false, 'usuario'),
  ('Tiago Oliveira', 'tiago.oliveira@phdengenharia.eng.br', false, 'usuario')
on conflict do nothing;

insert into public.programas_alavanca
  (id, oportunidade, descricao, empresa, contato_nome, contato_cargo,
   contato_telefone, contato_email, tratativas, indicado_por,
   status, elegibilidade, comentario, valor_premio, criado_em)
select v.id, v.oportunidade, v.descricao, v.empresa, v.contato_nome, v.contato_cargo,
       v.contato_telefone, v.contato_email, v.tratativas, c.id,
       v.status, v.elegibilidade, v.comentario, v.valor_premio::numeric,
       coalesce(v.criado_em, timestamptz '2026-08-28 12:00:00-03:00')
from (values
  ('a1a10000-0000-4000-8000-000000000001'::uuid, 'Plano de Construtibilidade - Bamin', 'Entrei em contato com um contato que trabalha na mineradora Bamin e falei a respeito dos serviços de construtibilidade. Em seguida foi realizada uma reunião junto a Bamin onde o Bruno apresentou os serviços da PHD.', 'Bamin', 'Carlos Eduardo', 'Especialista de Planejamento e Controle', '+55 73 99858 7993', 'carlos.andrade@bamin.com.br', 'Foi informado pelo Carlos Eduardo que a mineração da empresa haveriam mais oportunidades e encaminhou o contato de do Caio Pimenta caio.pimenta@bamin.com.br para dar andamento ao processo uma vez que ele falou a respeito da PHD para o Caio.', 'francisco.viana@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Francisco Eustaquio Viana Filho (francisco.viana@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Despriorizada por estar em processo de venda e sem demandas

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000002'::uuid, 'Profisisonal de Gestão da Qualidade', 'Foi identificada a oportunidade para atuação de um profissional de gestão da qualidade, com foco no controle da documentação na fase de engenharia e na distribuição dos projetos, incluindo a necessidade de uma plataforma.', 'Goiasa Goiatuba Alcool Ltda', 'José Antonio Toniello', 'Gestor de Projetos (PMO)', '+5516991854025', 'Jose Antonio Toniello&lt;jatoniello@goiasa.com.br&gt;', 'Já tratamos sobre a necessidade e com a presença e apoio do Pedro e Leonardo, estamos conseguindo viabilizar a ampliação do contrato, a Goiasa já recebeu proposta comercial e estamos em fase de negociação final.', 'alex.silva@phdengenharia.eng.br', 'concluida', 'elegivel', 'Planilha: Farmer · 400 pontos

Após indicação realizada pela equipe PHD, foi negociado junto à Goiasa e fechada a proposta para alocação de mais 01 profissional.

Data de registro não veio na planilha.

Premiação não veio na planilha — conferir com o comercial.', 0, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000003'::uuid, 'Gestão Operacional Agrícola', 'Foi identificada a oportunidade para atuação de um profissional de Gestão Operacional (Opex), com foco na integração dos processos de uma fábrica de açúcar e álcool, do campo ao controle de insumos industriais', 'Goiasa Goiatuba Alcool Ltda', 'Jose Antonio Toniello', 'Gestor de Projetos', '+5516991854025', 'Jose Antonio Toniello&lt;jatoniello@goiasa.com.br&gt;', 'Já tratamos sobre a necessidade e com apresença e apoio do Pedro e Leonardo,estamos conseguindo viabilizar aampliação do contrato, a Goiasa já recebeuproposta comercial e estamos em fase denegociação final.', 'alex.silva@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer · 200 pontos

Proposta foi emitida, porém não foi aprovada pelo cliente.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000004'::uuid, 'Construtibilidade para projeto na ADM de Rondonópolis', 'Após conversa com o gerente de CapEx da ADM de Rondonópolis, foi apresentado o portifólio PHD e o mesmo teve interesse de fazer uma contrutibilidade para um dos seus projetos.', 'ADM do Brasil', 'Cristiano Octávio', 'Gerente de CapEx', '66-996533353', 'cristiano.octávio@adm.com', 'Após reunião com o gerente de CapEx de de rondonópolis com apresentação do portifólio e condução pelo gerente Eduardo Eler. O gerente Cristiano informou que tem um projeto nas fases de engenharia e ficou interessado no nosso produto de construtibilidade.', 'paulo.junior@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Contato realizado, porém não evoluímos para elaboração de proposta devido aos prazos do projeto.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000005'::uuid, 'Profissional de planejamento para ADM Rondonópolis', 'O Gerente Cristiano entou em contato comigo para solicitar um colaborador PHD para compor seu time de CapEx, de imediato. A priori poderá ser de home office, mas depois ou ano que vem, deverá ser local na planta. Informei de imediato o gerente Edu Eler.', 'ADM do Brasil', 'Cristiano Octávio', 'Gerente de CapEx', '66996533353', 'cristiano.octavio@adm.com', 'Foi solicitado a mim, via whatsapp, o envio de currículos para profissional de planejamento para a planta da ADM de Rondonópolis, parte home office, parte em loco. Informado o Gerente Eduado Eler que já está em contato com o gerente Cristiano Octávio.', 'paulo.junior@phdengenharia.eng.br', 'concluida', 'elegivel', 'Planilha: Farmer · 400 pontos

Proposta emitida e contrato fechado junto à ADM. Valor do Contrato R$ 106.674,78

Data de registro não veio na planilha.

Premiação não veio na planilha — conferir com o comercial.', 0, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000006'::uuid, 'Empresa CBA Alumínio/SP', 'Oportunidade no planejamento direto com a empresa CBA-Alumínio/SP para seus diversos projetos e expansões.', 'CBA-COMPANHIA BRASILEIRA DE ALUMINÍO', 'DANIEL BIGOGIARI', 'Coordenador Geral Planejamento CBA', '11973171600', 'arthur.andrade@phdengenharia.eng.br', 'Eu trabalhei lá dentro por 1 ano e a todo momento troca-se de empresa de planjemaneto direto com a CBA, então, há uma necessidade e espaço vazio de uma empresa séria de planejamento em geral.', 'arthur.andrade@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Hunter

Já reunimos com Daniel, mas ainda não virou proposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000007'::uuid, 'GE GRID', 'Parceria com a empresa GE.

Linkedin do Contato Idalecio: https://www.linkedin.com/in/idaleciocastro/', 'GE GRID', 'IDALECIO', 'GERENTE PROJETOS', '31999640219', 'arthur.andrade@phdengenharia.eng.br', 'Idalecio é um gerente muito influente na GE, pode ser uma boa porta de entrada com uma parceria de planejamento, a GE tem setor de planejamento, porém, tem muita necessidade de ferramentas novas e parcerias nos seus diversos produtos e montagens.', 'arthur.andrade@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter

Arthur mandou mensagem, aguardando resposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000008'::uuid, 'CBA - Alumínio/SP', 'Oportunidade direta com a empresa CBA, eles tem muita dificuldadee em planejar e gerir as obras do setor de engenharia e tecnologia.', 'CBA', 'EDIVALDO', 'GERENTE GOVERNANÇA', '15996297488', 'arthur.andrade@phdengenharia.eng.br', 'Edivaldo é um funcionário antigo e influente dentro do setor de engenharia e tecnologia, esse setor é onde ocorre todas as tratativas de obras e expansões lá da CBA.', 'arthur.andrade@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter · 200 pontos

Já reunimos com Daniel, mas ainda não virou proposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000009'::uuid, 'CBA - ALUMÍNIO/SP', 'Oportunidade na empresa CBA, muito potencial de investimento e sempre em movimento de obras e expansões.', 'CBA', 'EDUARDO PRADO', 'GERENTE DE PROJETOS', 'N/D', 'eduardo.prado@cba.com.br', 'Já enviado mensagem dizendo sobre a PHD que entrará em contato para apresentação dos diversos serviços e produtos no viés de planejamento e gestão de obras

Segue abaixo linkedin do Eduardo:
https://www.linkedin.com/in/eduardo-silva-prado-07567530/', 'arthur.andrade@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter

Já reunimos com Daniel, mas ainda não virou proposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000010'::uuid, 'GE POWER CONVERSION', 'Oportunidade de parceria com a empresa GE sediada na cidade de Betim. Eles possuem setor de planejamento porém sempre estão agregando parcerias e trabalhos nas suas montagens e produtos de fabricação diversos.', 'GE POWER CONVERSION', 'JOÃO GOSTON', 'PLANEJAMENTO LÍDER', '31996377046', 'N/D', 'Já enviado mensagem sobre a PHD que entrará em contato para apresentação da emrpesa.', 'arthur.andrade@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter · 200 pontos

Arthur mandou mensagem, aguardando resposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000011'::uuid, 'VALE', 'Oportunidade de parceria com a VALE atuando no norte do país.', 'VALE', 'ANDERSON', 'GERENTE', '31985458580', 'N/D', 'Já enviei mensagem sobre a PHD, recentemente estavam atrás de pessoas para compor quadro de planejamento deles, cargos de gerente e outros, então, tem chances de estarem a procura de apoio ao Planejamento.', 'arthur.andrade@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Já estávamos em contato com o Anderson

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000012'::uuid, 'GE VERNOVA', 'Oportunidade de parceria com a GE, eles tem seu setor próprio de planejamento, contudo, sempre estão buscando inovações e ferramentas para agregar nos seus produtos e serviços. Grande potencial de parceria.', 'GE VERNOVA', 'ANDRÉ KRAMER', 'ESPECIALISTA GESTÃO PROEJTOS', '12996502705', 'andre.striotto@gmail.com', 'Já oconversei com ele sobre a PHD, irá entrar em contato para apresentar a empresa no intuito de criar parceria.

Segue linkedin do André:
https://www.linkedin.com/in/andre-kramer/', 'arthur.andrade@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter · 200 pontos

Arthur mandou mensagem, aguardando resposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000013'::uuid, 'Construcap São Paulo', 'Oportunidade junto a empresa Construcap em São Paulo.', 'Construcap', 'Flávio Azevedo', 'Gerente Orçamentos', '27995209106', 'N/D', 'Já enviei mensagem sobre a PHD, entrará em contato para apresentação do portfólio de serviços de apoio ao Planejamento e Gestão e obras em geral.

Segue Linkedin abaixo do Flávio:
https://www.linkedin.com/in/flavioazevedoeng/', 'arthur.andrade@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Farmer

Ainda não fizemos contato

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000014'::uuid, 'Montcalm Montagens Industriais', 'Empresa com Know-how em planejamento, porém, está passando por um período de baixa nesse setor, perdeu vários integrantes de relevância desse setor e pode ser um ótimo potencial de parceria.', 'Montcalm Montagens Industriais', 'Paulo Tércio', 'Diretor Operacional', '11994145389', 'paulo.tercio@montcalm.com.br', 'Em última obra com a Montcalm, ela contratou uma empresa especialista em Planejamento chamada Climb para auxiliar junto a obra quanto a LPS, eles querem parceria com ferramentas inovadoras.

Linkedin: https://www.linkedin.com/in/paulo-t%C3%A9rcio-soares-a', 'arthur.andrade@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter

Arthur mandou mensagem, aguardando resposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000015'::uuid, 'Montcalm Montagens Industriais', 'Empresa com Know-how em planejamento, porém, está passando por um período de baixa nesse setor, perdeu vários integrantes de relevância desse setor e pode ser um ótimo potencial de parceria.', 'Montcalm Montagens Industriais', 'Daniel França', 'Gerente de Planejamento Corporativo', '11989499472', 'N/D', 'Em última obra com a Montcalm, ela contratou uma empresa especialista em Planejamento chamada Climb para auxiliar junto a obra quanto a LPS, eles querem parceria com ferramentas inovadoras.', 'arthur.andrade@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter

Arthur mandou mensagem, aguardando resposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000016'::uuid, 'Montcalm Montagens Industriais', 'Empresa com Know-how em planejamento, porém, está passando por um período de baixa nesse setor, perdeu vários integrantes de relevância desse setor e pode ser um ótimo potencial de parceria.', 'Montcalm Montagens Industriais', 'Daniel Simonsen', 'Diretor Comercial', 'N/D', 'daniel.simonsen@montcalm.com.br', 'Em última obra com a Montcalm, ela contratou uma empresa especialista em Planejamento chamada Climb para auxiliar junto a obra quanto a LPS.
Daniel é filho do dono Oscar Simonsen
https://www.linkedin.com/in/daniel-simonsen-32981b46/', 'arthur.andrade@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter

Arthur mandou mensagem, aguardando resposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000017'::uuid, 'Plano de Desmontagem do Misturador - ADM TCO', 'Oportunidade voltada para área de Construtibilidade na construção de um plano para desmontagem de um misturador que não será mais utilizado. Demanda já compartilhada com o Daniel Almeida.', 'ADM do Brasil Animal Nutrition', 'Anderson Guimarães', 'Engenheiro de Projetos Sr.', '41 99795-5485', 'anderson.guimaraes@adm.com', 'Conversado com o cliente e o mesmo solicitou orçamento para análise.', 'tiago.oliveira@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Tiago (tiago.oliveira@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Farmer

Contato realizado, porém Anderson decidiu por não compartilhar a documentação e disse que não atenderia ao prazo do projeto.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000018'::uuid, 'Gerenciamento Projeto Serpentina', 'Projeto de Expansão, de nova planta para beneficiamento de Minério de Ferro', 'Anglo American', 'Gustavo Correa', 'Especialista de Planejamento', '55 31 9903-7197', 'gustavo.correa@angloamerican.com', 'Não houve tratativa prévia diretamente com o potencial clinte. Sabe-se que a PHD ja forneceu serviços de BIM e construtibilidade para a SNC -Lavalin (Atual Atikins reális) para um grande projeto dentro da Anglo. 
 Conheço a oportunidade de um novo projeto', 'deividy.gomes@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Já estávamos em contato com o Gustavo', null, timestamptz '2025-06-09 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000019'::uuid, 'Apoio Suprimentos Goiasa', 'Dois profissionais com experiencia em compras, para apoio no suprimento, do projeto 680tch', 'Goiasa', 'Antonio Monteiro', 'Gerente de Suprimentos', '+55 64 9962-3649', 'Antônio Monteiro Neto&lt;amneto@goiasa.com.br&gt;', 'O processo já está em andamento com o Daniel do comercial PHD.', 'alex.silva@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Proposta enviada e realizado longo processo de negociação com a Goiasa. Porém, decidiram seguir com mão de obra própria.', null, timestamptz '2025-06-10 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000020'::uuid, 'Novo Contrato - CS Infra', 'É uma empresa de gestão de concessões de longo prazo do Grupo SIMPAR, com foco em infraestrutura, mobilidade, tratamento de resíduos e serviços portuários.
Irá iniciar a implantação de melhorias e novas obras do Lote 5 do leilão de MT - 308km', 'CS Infra', 'Sávio Rolemberg Aguiar', 'Diretor', '21 98650-8840', 'rubens.silva@phdengenharia.eng.br', 'Falei com ele da expertise da PHD, flexibilidade de contrato de várias modalidades (sob demanda, presencial e home office), mais de 100 planejadores em diversos segmentos, além de maquete eletrônica. Atende as maiores empresas do Brasil.', 'rubens.silva@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Hunter · 200 pontos

Fizemos proposta. Em negociação', null, timestamptz '2025-06-11 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000021'::uuid, 'Consultoria e Assessoria BIM_SRV', 'Oportunidade de Consultoria em BIM para criação de modelos BIM de uma descaracterização de Barragem em Itabira.', 'SRV Engenharia', 'Julio Carlos', 'Engenharia', '5531958926967', 'julio.carlos@srveng.com.br', 'A principio a empresa solicitou um apoio no desenvolvimento desses modelos, estruturando junto a equipe de engenharia. Além da possibilidade de torna-lo PILOTO em um processo de implantação BIM (Curso,Diagn.,BEP na SRV) mais completo.', 'matheus.costa@phdengenharia.eng.br', 'concluida', 'elegivel', 'Planilha: Hunter

Proposta convertida. Contrato iniciado. Ainda não mediu

Data de registro não veio na planilha.

Premiação não veio na planilha — conferir com o comercial.', 0, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000022'::uuid, 'Migração de dados e treinamento', 'O Carlos Eduardo, Coordenador da EGTC Infra S.A. mandou uma mensagem no grupo do whatsapp buscando empresas que faziam migração de dados do MS Project para o Primavera e davam treinamento nestes softwares.', 'EGTC Infra S.A.', 'Carlos Eduardo', 'Coordenador de Planejamento', '12 991541422', 'carlos.esantos@egtc.com.br', 'Já conversei com ele para elaboração de uma proposta seguindo as solicitações dele.', 'andre.gomes@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Fizemos proposta. Perdemos no preço

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000023'::uuid, 'PADRONIZAÇÃO DE PROCESSOS I3M ENGENHARIA', 'EMPRESA EM EXPANSÃO E PRECISA DE PADRONIZAÇÃO DE PROCESSOS PARA TIRAR AS ISOs', 'I3M ENGENHARIA', 'FABIO SCHOELBER', 'COORDENADOR DE PLANEJAMENTO', '+55 42 8445-7376', 'fabio.schoeberl@i3m.com.br', 'BREVE CONVERSA PELO WHATSAPP COM O FABIO SOBRE A POSSIBILIDADE DA PHD AUXILIAR NESSA PADRONIZAÇÃO E TREINAMENTOS DE METODOLOGIA DE PLANEJAMENTO E LEAN PARA AS OBRAS.', 'nilton.netto@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Hunter

Tentamos contato mas sem sucesso ainda', null, timestamptz '2025-07-03 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000024'::uuid, 'Controle de Materiais', 'Identificado a deficiência/necessidade de um colaborador para controle de material, RMs, controle de estoque e em conversa com o cliente foi informado que o mesmo tem interesse em contratar um colabodor para estas atividades.', 'Gerdau', 'GERD-CT14-PIND', 'Consultor de Planejamento', '11950784225', 'gabriel.abud@phdengenharia.eng.br', 'Já foi conversado com o cliente sobre esta necessidade na obra e o mesmo demonstrou interesse nesta contratação e solicitou que fosse levantado co a PHD se a mesma tem profissional qualifidado para exercer a função.', 'gabriel.abud@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Proposta realizada e longo processo de negociação junto à Gerdau. Porém, o escopo não foi contratado.', null, timestamptz '2025-07-07 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000025'::uuid, 'Nacional Gás', 'Acompanhamento da expansão da Nacional Gás', 'Nacional Gás', 'Rafael Palma', 'Intermediário com comercial', '(85) 98122-6125', 'Rafael Palma &lt;rafael@qtenergia.com.br&gt;', 'O cliente já entrou em contato com PHD, onde fez uma esplanação sobre o escopo, ficando de enviar na semana do dia 14/07/2025 com o BID com o escopo.', 'marcelo.lima@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Hunter

Estamos em negociação

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000026'::uuid, 'BIM na Canopus Construtora', 'Possível oportunidade com a Construtora Canopus Engenharia, Construtora de alto padrão em BH. Utilizam BIM nos projetos, estão começando a implantar o Synchro e não possuem sinergia entre BIM/PBI.', 'Construtora Canopus', 'Maria Clara Procopio', 'Engenheira de Planejamento', '03199838175', 'N.A', 'O contato ja foi passado ao Bruno Azevedo e Isac.', 'vinicius.costa@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Hunter

Estamos em contato com Maria Clara', null, timestamptz '2025-11-08 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000027'::uuid, 'Serra do Rabo', 'Projeto de nova mina da VALE, em Carajás.', 'Vale', 'Poliana Xavier', 'Diretoria da Engenharia de Projetos', '31986970486', 'poliana.xavier@vale.com', 'O projeto está no início do conceitual, sendo realizado o trade-off. Previsão de início dos estudos em FEL2 e Construtibilidade em Janeiro de 2026.
Auxiliei o cliente para estimativa de levantamento no cronograma macro do projeto.', 'ivan.silva@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Construtibilidade deverá sair apenas em Janeiro de 2026

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000028'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Roberto Soares', 'Gerente de área - Implantação de Obras - Ferroviárias', '31 99709-6792', 'robertosoares@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Daniel havia apenas indicado os nomes e contatos. Pedi ele pra fazer contato e ele disse que o ponto focal seria o Roberto. Daniel está aguardando Roberto voltar de férias para conversar com ele e fazer a ponte. Por enquanto não está sendo considerado no Alavanca

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000029'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Marcela Silveira', 'Gerente Geral - Implantação de Obras - Ferroviárias', '32 99982-3906', 'marcela.silveira@mrs.com.br', 'Não', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000030'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Marcelo Modolo', 'Gerente Geral - Implantação de Obras - Ferroviárias', '48 98848-4259', 'marcelo.modolo@mrs.com.br', 'Não', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000031'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Vinicius Barichello', 'Gerente de área - Implantação de Obras - Ferroviárias', '45 99917-2197', 'vinicius.barichello@mrs.com.br', 'Não', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000032'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Leiziane Senra', 'Coordenador - Suprimentos', '32 99918-2448', 'leiziane.senra@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000033'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Priscila Andrade', 'Coordenador - Implantação de Obras - Ferroviárias', '32 98445-0886', 'priscila.andrade@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000034'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Helder Souza', 'Especilalista Planejamento - Implantação de Obras - Ferroviárias', '31 99663-7606', 'helder.souza@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000035'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Raphael Silvério', 'Coordenador - Implantação de Obras Eletroeletrônica', '32 99129-9725', 'raphael.silvério@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000036'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Everton Cabral', 'Gerente de área - Implantação de Obras Eletroeletrônica', '37 98845-8310', 'everton.cabral@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000037'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Claysson Nicácio', 'Especialista - Implantação de Obras Ferroviárias', '31 99610-1850', 'claysson.nicácio@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000038'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Tatiana Maestri', 'Coordenador - PMO', '11 97236-9520', 'tatiana.maestri@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000039'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Bilga Dias', 'Especialista - Projetos Instalações Prediais', '31 99793-4938', 'bilga.dias@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000040'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Juliana Santana', 'Especilalista Planejamento - Projetos Instalações Prediais', '31 98409-0058', 'juliana.santana@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000041'::uuid, 'MRS Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'MRS Logística S.A.', 'Raissa Lambertucci', 'Especialista - Projetos Super e Infraestrutura Ferroviária', '31 99556-6055', 'raissa.lambertucci@mrs.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Lucas está em contato com Raissa no whatsapp para agendar reunião

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000042'::uuid, 'CSN Mineração S.A.', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'CSN Mineração S.A.', 'Christian Martins', 'GERENTE - ENGENHARIA - PROJETOS CORRENTES', '(31) 98309-8604', 'christian.sousa@csn.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Daniel havia apenas indicado os nomes e contatos. Pedi ele pra fazer contato e ele disse que o ponto focal seria o Thales mesmo que já estamos em contato. Não será considerado no Alavanca

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000043'::uuid, 'CSN Mineração S.A.', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'CSN Mineração S.A.', 'Jaino Xavier', 'GERENTE - IMPLANTAÇÃO - PROJETOS CORRENTES', '(31) 98411 6340', 'jaino.xavier@csn.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000044'::uuid, 'CSN Mineração S.A.', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'CSN Mineração S.A.', 'Thales Mendes', 'GERENTE - IMPLANTAÇÃO - PROJETOS CORRENTES', '31', 'thales.mendes@csn.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000045'::uuid, 'CSN Mineração S.A.', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'CSN Mineração S.A.', 'Humberto Mendanha', 'GERENTE - IMPLANTAÇÃO - PROJETOS CORRENTES', '(31) 98962 1380', 'humberto.mendanha@csn.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000046'::uuid, 'CSN Mineração S.A.', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'CSN Mineração S.A.', 'Tadeu Torquato', 'GERENTE - ENGENHARIA E IMPLANTAÇÃO - PROJETOS BARRAGENS E INFRAESTRUTURA', '(31) 99607-7665', 'tadeu.torquato@csn.com.br', 'Não.', 'daniel.bittencourt@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Idem

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000047'::uuid, 'Rumo Logística - Ferrovia', 'Empresa com multiplos projetos de investimento em execução em diferentes fases. Muitas possibilidades de negócio.', 'Rumo Logística', 'Maria Luiza Martins', 'Supervisora de Implantação - Projetos Mato Grosso', '65 99297-5394', 'não', 'Não', 'daniel.bittencourt@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Agendamos reunião com o Alexandre Fontes através do Daniel. Processo nao avançou após as reuniões.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000048'::uuid, 'Proposta de Gerenciamento', 'Victor, orçamentista da empresa APLUS ENGENHARIA necessite de orçamento para gerenciamento de um projeto para execução de uma usina de etanol de milho no município de Nova Olimpia MT.', 'Aplus Engenharia', 'Victor', 'Orçamentista', '+55 47 9251-7653', '-', 'Trabalhei na ADM gerenciando a empresa TWA de Montagens Mecânicas em vários projetos da ADM. A TWA nos indicou para um dos seus clientes Aplus, para realizar o gerenciamento de obras. 

Conversei com o Victor em 21/08 via whatsapp sobre interesse na PHD.', 'diogo.soares@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Fizemos proposta para a Aplus, mas estão com dificuldades de validar com a UISA. Estamos tentando contato com a UISA. Processo finalizado

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000049'::uuid, 'Empresa sem Planejamento especializado', 'Trabalhei um tempo na ede Montagens, e eles não possuem um planejamento especializado, apenas contratações internas, e já tiveram problemas com desistências por parte do planejamento.', 'Rede Montagens', 'José Perecini', 'Gerente de Contratos', '98992056111', 'rodolphogf@hotmail.com', 'Ele já sabe do trabalho da PHD, e estava recentemente procurando planejadores para algumas obras.', 'rodolpho.fonseca@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Rodolpho ainda não fez primeiro contato

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000050'::uuid, 'VLI Multimodal S.A.', 'Empresa nas vias de assinar o contrato de renovação da concessão de mais 30 anos, antecipada e devidoa isso tem que fazer investimentos vultuosos, que são convertidos em obras de infraestrutura, viária e de mobilidade urbana.', 'VLI Multimodal S.A.', 'Álvaro Freitas', 'Supervisor de Planejamento Estratégico', '31984553404', 'não', 'Nenhuma.', 'daniel.bittencourt@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Daniel Leite Bittencourt (daniel.bittencourt@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Daniel ainda não fez contato. Já estamos em contato com a VLI

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000051'::uuid, 'Escopo de BIM Adicional que foi vendido no Contrato BEMISA', 'Fiz a venda de um escopo no contrato existente da BEMISA enquanto estive lá, consegui anagariar um escopo que seria da empresa projetista TECNOMIN e ela não estava atendendo e durante o densenrolar do contrato consegui puxar esse escopo para a PHD.', 'BEMISA', 'BEMI-CT02-GERE', 'Coord. de Planejamento', '32982397184', 'washington.junior@phdengenharia.eng.br', 'O escopo já foi vendido.', 'washington.junior@phdengenharia.eng.br', 'concluida', 'elegivel', 'Indicado por Washington Venancio Júnior (washington.junior@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Farmer · 400 pontos

Proposta aprovada junto à Bemisa. Escopo já está sendo realizado junto ao cliente pela equipe BIM PHD. - Valor do contrato: R$ 200.000,00

Data de registro não veio na planilha.

Premiação não veio na planilha — conferir com o comercial.', 0, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000052'::uuid, 'Implementação BIM - Gêmeos Digitais - TIC Trens', 'Considerando a Estratégia de Implantação BIM Nacional para concessionárias e que a TIC Trens ainda está em fase de estudos sobre o assunto, a oferta dos serviços de uma consultoria para auxiliá-los no assunto, tal como ocorrerá na Ecovias, pode valer.', 'TIC Trens', 'Mariana Braga Rodrigues', 'Especialista BIM', 'não tenho', 'mariana.rodrigues@engetrens.com.br', 'Em uma conversa com colegas/amigos que trabalham na TIC Trens, descobri que eles ainda estão estudando o uso de gêmeos digitais pra fase de uso e operação. A ideia é uso sensores nos trilhos que vão mandar as informações pra alguns para os painéis.', 'gabriel.santos@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Realizamos diversas reuniões com o cliente, emitimos proposta para mais de um escopo, porém não conseguimos avançar no fechamento das oportunidades.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000053'::uuid, 'CEG Engenharia - BIM', 'Seria alguém pra guiar minha equipe na metodologia. Alguem que saiba bem o passo a passo de infra (esse projeto em especifico é drenagem de uma ferrovia), indique ferramentas pra gente estudar e aplicar, que manje da compatibilidade dos programas etc', 'CEG Engenharia', 'Tiago Campos', 'Coordenador de Drenagem', '(16)99633307', 'tiago@ceg.eng.br', 'Conversei diretamente com o contato fornecido e ele disse que está disposto a conhecer mais sobre a PHD. Pelo que entendi, eles precisam de um consultor pra ajudá-los não em um único projeto mas acompanhamento para todo o escritório', 'gabriel.santos@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Fizemos contato. Oportunidade pequena, não é o foco do BIM agora', null, timestamptz '2025-09-02 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000054'::uuid, 'Gerenciamento, Planejamento e Controle (LPS) e Construtiilidade', 'Buscando oportunidade na mineração em Canaã dos Carajás na empresa OZ Minerals.', 'OZ Minerals', 'Fernando Abbud', 'Gerente de Projetos', '94981667258', 'fernando.abbud@ozminerals.com', 'Solicitamos o contato do Suprimentos para oportunidade em Gerenciamento, Planejamento e Controle (LPS) e Construtibilidade', 'jefferson.magalhaes@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Hunter

Estamos em contato com Fernando. Ainda não conseguimos marcar reunião', null, timestamptz '2025-09-03 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000055'::uuid, 'Gerenciamento, Plaejamento e Controle (LPS) e Construtibilidade', 'Oportunidade em Gerenciamento, Plaejamento e Controle (LPS) e Construtibilidade no Projeto nos Projetos do Porto e Ferrovia.', 'Rumo Logistica', 'Sandro Luiz Ferreira', 'Gerente de Planejamento', '(13) 991749595', 'sandro.ferreira@rumolog.com', 'Solicitamos oportunidade para gerenciamento, planejamento e controle (LPS) e Construtibilidade nos projetos.', 'jefferson.magalhaes@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Estamos em contato com o Sandro que direcionou para o Luis Almeida de suprimentos. Estamos aguardando fechar o cadastro PHD na Rumo para falar com o Luis. Processo não foi adiante.', null, timestamptz '2025-09-03 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000056'::uuid, 'Oportunidade de Novo Contrato ControleADMB-CT16-PORT', 'Com o fechamento da fábrica de Três Corações, venho oferecendo ao cliente uma pessoa para Santos. Ele já demonstrou interesse, porem recuou.', 'ADM do Brasil', 'Gabriel Nomiyama', 'Engenheiro de Projetos', '13 9 9647-2185', 'Gabriel.Nomiyama@adm.com', 'Desci um nível na hierarquia e alertei o engenheiro sobre os impactos da não presença de um colaborador visto que o gerente não vinha nos respondendo a mais de 3 semanas. O Gabriel apresentou interesse e conseguiu autonomia para realizar a aquisição.', 'diogo.soares@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer', null, timestamptz '2025-09-09 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000057'::uuid, 'Controle_ADMB-CT16-PORT Aditivo', 'Faz se necessário a alteração da minha atuação de Home Office para presencial em Santos de forma temporária.', 'ADM do Brasil', 'Gabriel Nomiyama', 'Engenheiro de Projetos', '13 9 96472185', 'Gabriel.Nomiyama@adm.com', 'Haverá uma parada de 45 dias a partir de Novembro. E alinhei com o gestor sobre minha estadia a partir do dia 20/10. Proposta de 45 dias em Santos.', 'diogo.soares@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer', null, timestamptz '2025-09-09 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000058'::uuid, 'Planejamento Capex Min Nexa', 'Registrando a indicação do passado da empresa NEXA onde ja gerou faturamentos para as unidades de Aripuana, oportunidades em Três Marias e Vazante.', 'Nexa', 'Rodrigo/ Cristovão  e Leonardo Celho', 'Gestão de Projetos', '51987247303', 'cristovao.teofilo@nexa.com', 'Entrei em contato com o CEO Leonardo Coelho e o Diretor Latam da NEXA que nos indicou o Rodrigo para apresentar as nossa soluções. Foram feitos os contatos e gerados as oportunidades.', 'armando.figueiredo@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Armando (armando.figueiredo@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Farmer

Indicação não válida para o programa.', null, timestamptz '2025-09-09 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000059'::uuid, 'Oportunidades no AGRO', 'Contato para apresentar nossas soluções para a Diretora de Projetos Paola.', 'Syngenta', 'Paola Prado', 'Diretora de Projetos', '1199690 8184', 'paola.prado@syngenta.com.br', 'Contato para apresentação das soluções da PHD para a Syngenta.', 'armando.figueiredo@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Armando (armando.figueiredo@phdengenharia.eng.br), que não está mais na base de colaboradores.', null, timestamptz '2025-09-09 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000060'::uuid, 'Planejamento e Controle', 'Conversando com o coordenador da Brazabe, ele me pediu indicações de Técnico de planejamento.', 'BRAZABE CONSTRUÇÕES E SERVIÇOS', 'Joabe Vitalino', 'Coordenador de contratos', '12981695142', 'joabe.vitalino@brazabe.com.br', 'Conversando com o coordenador da Brazabe, ele me pediu indicações de Técnico de planejamento Pleno. Sendo assim indiquei a PHD que daria mais suporte e estabilidade para ele.', 'aline.lage@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter · 200 pontos

Contato realizado e proposta emitida. Em negociação com o cliente

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000061'::uuid, 'Empresa RAD', 'Empresa com expansão de uma nova empresa de Lithio no Sul -

Pedro Nery ja fez contato com o CEO e agendou uma reunião para proxima  sexta feira 26/09', 'Rad Mineração', 'Denilson Coutinho', 'CEO', '92988470087', 'denilson.coutinho@radmetal.com.br', 'Agendado uma reunião no dia 26/09 para apresentação do portifolio da PHD', 'armando.figueiredo@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Armando (armando.figueiredo@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000062'::uuid, 'Coordenação BIM - Rodovia (381)', 'As atividades chave são o Ger.de modelos, coordenação, padronização de entregas BIM pela subcontratada que poderiam contar com uma assesoria BIM no des. de projetos de Infraestrutura Rodoviária para o projeto Rodovia 381 que exigem entregas BIM.', 'Intertechne', 'Mayra Carmo', 'Supervisora de Geo/Terraplenagem', '+55 32 9827-0749', 'matheus.costa@phdengenharia.eng.br', 'A empresa  Intertechne busca um profissional para atender as funções de coordenação e gerenciamento BIM (BIM MAnager) da empresa. Foi apresentado a possibilidade da execução das funções via consultoria visto que a vaga não foi atendida (20d do 1ºcontato )', 'matheus.costa@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Contato feito com a Mayra, mas sem retorno. Após este momento conseguimos contato com a cliente e emitimos proposta. Não avançamos devido a restrição de verba

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000063'::uuid, 'implantar LPS / AWP', 'Márcio Douglas, coordenador da empresa Niplan, solicitou contato para implantação do LPS e planejamento AWP em uma obra que eles ganharam da Anglo, com uma certa urgência', 'Niplan/midinfraestrutura', 'Mário Douglas', 'Coordenador de planejamento', '(98)99241-7417', 'marcio.douglas@midinfraestrutura.com.br', 'Prestamos serviços para eles no inicio do ano, e eu estava na obra de representando a PHD, devido ao relacionamento com eles e o bom trabalho exercido, eles me procuraram hoje solicitando uma contato da PHD para orçamento para realizar esse serviço.', 'guilherme.rocha@phdengenharia.eng.br', 'cancelada', 'pendente', 'Indicado por Guilherme (guilherme.rocha@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Farmer

Reunião com Mario agendada para 15/10. Após reunião, não conseguimos validar o escopo para avançar com elaboração de proposta junto ao cliente.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000064'::uuid, 'Multinacional buscando parcerias.', 'Um conhecido, atua como Consultor Corporativo, entrou em contato no Linkedin e informou que uma empresa de Engenharia da Europa presente em 15 países, busca parceiros no Brasil.', 'EA Engineering', 'Bruno Barbosa', 'Head of Softlanding &amp; Internationalization', '31995100099', '.', 'Conversamos via linkedin, e informou que uma empresa muito grande da Europa de engenharia que está querendo vir pro Brasil, e está buscando parceiros. Pediu uma reunião, de preferencia em inglês para apresentarem a empresa e encontrarem oportunidades.', 'diogo.soares@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000065'::uuid, 'PX Energy - Mineração, Óleo e Gás', 'A PX é uma empresa do grupo Forbes e Manhatan, localizada em São Mateus do Sul, no PR, com foco em Óleo, Gás e Mineração.', 'PX Energy', 'Gustavo Fontes Lopes', 'Gerente de Mina e Planta', '+55 31 9 9204-2376', 'Gustavo.fontes@pxenergy.com', 'O Gustavo já foi contatado por whatsapp e o mesmo deu liberdade para que possa fazer o primeiro contato e convidar o comercial para uma apresentação formal.', 'rubens.silva@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Hunter

Reunião feita, ainda não virou proposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000066'::uuid, 'MONTAGEM ELETROMECÂNICA NOS PROJETOS DAS FILTRAGENS DE REJEITO NAS MINAS DE CONCEIÇÃO E CAUÊ', 'MONTAGEM ELETROMECÂNICA NOS PROJETOS DAS FILTRAGENS DE
REJEITO NAS MINAS DE CONCEIÇÃO E CAUÊ', 'IMC SASTE', 'MARCELO SANTOS', 'ENGENHEIRO PREPOSTO', '13 99660-6010', 'jeferson.expedito@phdengenharia.eng.br', 'Acabamos de encerrar o contrato IMC CT-06 com a IMC SASTE  e a empresa ganhou outro contrato na mesma planta, em conversa com o preposto Marcelo Santos o sinalizou o interesse em manter a equipe da PHD nesse novo projeto.', 'jeferson.expedito@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer', null, timestamptz '2025-10-09 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000067'::uuid, 'Profissional de Planejamento Especializado', 'Em conversa com amigo de outra empresa, o mesmo está na dificuldade em encontrar mão de obra pro projeto que fechou com a Vale. O mesmo precisa emitir PTO, entregas iniciais e planejamento e controle do projeto em cronograma em Primavera.', 'Degraus Engenharia', 'João Paulo', 'Orçamentista', '31992271311', 'vendas@degraus.eng.br', 'Conversei a respeito da dificuldade de encontrar mão de obra, disse a ele que poderia pedir pra Phd enviar um orçamento para avaliarem. O mesmo ficou disposto em aceitar contato.', 'hudson.vilela@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter', null, timestamptz '2025-10-10 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000068'::uuid, 'México - Brasil', 'Trabalhei no gerenciamento da contratada mexicana Area Industrial, responsável por parte dos entregáveis do projeto. Durante essa parceria, o diretor da empresa entrou em contato demonstrando interesse em estabelecer futuras parcerias com a PHD Engenharia', 'Area Industrial', 'Alejandro Rojas', 'Diretor', '52 1 55 4188 3031', 'alejandro.rosas@areaindustrial.com.mx', 'Até o momento, foi estabelecido o primeiro contato com o diretor via E-mail da empresa Area Industrial. Compartilhei o e-mail com o Leonardo, Lucas e Pedro Morais. Não conheço a carteira de projetos da Area Industrial, bem como as possiveis oportunidades.', 'diogo.soares@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Hunter

Fiz contato por e-mail em 08/11 para agendar reunião entre 18 e 21 de novembro

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000069'::uuid, 'Neovia Engenharia', 'Empresa de Engenharia com foco em rodovias que atua em diversos setores diferentes', 'Neovia Engenharia', 'André Costa', 'Coordenador de Planejamento', '41 9 8835 7517', 'n/a', 'Falei com um amigo meu que trabalha como supervisor de contratos na empresa, onde falei a respeito dos produtos oferecidos pela PHD como planejamento especializado, construtibilidade e me passou o contato do coordenador de planejamento para apresentarmos.', 'marlon.mueller@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000070'::uuid, 'CART - Concessionaria Auto Raposo Tavares', 'Detém a concessão de aproximadamente 834 quilômetros de rodovias no Oeste Paulista, ligando Bauru a Presidente Epitácio. As principais rodovias sob sua responsabilidade são: SP-270, SP-225, SP-327.', 'CART - Concessionaria Auto Raposo Tavares', 'Levy', 'Gerente de Implantação', '+55 14 99877-1830', 'fernando.levy@cartsp.com.br', 'Concessão de rodovias consolidada no interior de SP, onde podemos oferecer planos de construtibilidade, planejamento especializado, onde pode ser viável para implantação alguma OAE, ou ciclo de pavimentação que acontece a cada 5 anos ao longo do trecho.', 'marlon.mueller@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000071'::uuid, 'Gerenciamento ADM - Animal Nutrition', 'Proposta de Gerenciamento para a Carteira completa de Animal Nutrition da ADM.', 'ADM DO BRASIL', 'Rafaela.Barbosa@adm.com', 'Gerente de Projetos II', '(19) 9 99525403', 'rafaela.barbosa@adm.com', 'Feito contato com a Rafaela, nova gerente de projetos, que está assumindo toda a carteira de Nutrição Animal da ADM. Durante a conversa, ela solicitou a elaboração de uma proposta para alocação de um planejador dedicado à gestão do portifolio.', 'luiz.fernandes@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Foi realizado contato com a Rafaela e emissão de proposta para este escopo. Porém, após longo tempo de negociação, não avançamos com este contrato junto à ADM

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000072'::uuid, 'JMalucelli - MLC Infra', 'JMalucelli é um grupo empresarial no qual a empresa MLC Infra detém algumas obras no sul do Paraná (contratos ativos), implantação da terraplanagem do projeto ARAUCO e detém duas concessões de rodovias uma em Rondônia (BR-364) e outra em MG (BR-381)', 'MLC Infra', 'Dyego Giacomassi Cavet', 'Supervisor de obras', '+55 41 9997-7397', 'dyego.cavet@mlcinfra.com.br', 'A MLC infra está em uma crescente de obras, e detém apenas de uma analista de planejamento e um time de apoio na matriz, está implantado o LPS e estão implanando o SAP e ERP na matriz', 'carlos.alves@phdengenharia.eng.br', 'concluida', 'elegivel', 'Indicado por Carlos Henrique Macedo Alves (carlos.alves@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Proposta convertida junto à J.Malucelli

Data de registro não veio na planilha.

Premiação não veio na planilha — conferir com o comercial.', 0, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000073'::uuid, 'ETE IV - Norteng Engenharia', 'Implantação de uma ETE IV - Separação do petróleo e água, prazo até 04 de 2026, possível replan', 'Norteng Engenharia', 'Ricardo Braz', 'Engenheiro de qualidade', '(84)981527878', 'ricardo.braz@norteng.com.br', 'Implantação de uma ETE IV - para separação do petróleo e água em Currais Novos-RN, estão no 3º mês da obra , está construído 40% do tanque de depósito de concreto, falta o tq separador, flotador, água tratada, sala de painéis e toda estutura metálica', 'carlos.alves@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Carlos Henrique Macedo Alves (carlos.alves@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000074'::uuid, 'HTB / TEDESCO', 'HTB / TEDESCO é uma empresa que tem um portfólio variado no ramo de civil, atualmente eles detém a ampliação e implantação do aeroporto de Congonhas (contratante AENA), algumas obras civis (hospitalar no RS, Porto de Suape no Pernambuco', 'HTB / TEDESCO', 'Marcelo Machado', 'Gerente de contrato', '51 9980-3300', 'marcelo.machado@tedesco.com.br', 'Não inicei o contato, mas o Marcelo é um gestor antigo na empresa HTB, ele detém acesso direto a diretoria', 'carlos.alves@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Carlos Henrique Macedo Alves (carlos.alves@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000075'::uuid, 'CCR Aeroportos', 'O Caio era o gestor do aeroporto internacional de Curitiba pela CCR, o mesmo coordena alguns aeroportos na região sul do país', 'CCR - MOTIVA (15B Aeroportos)', 'Caio César Gonzaga Cavalcanti', 'Gestor de Projetos', '11911662213', 'caio.cavalcanti@grupoccr.com.br', 'Não iniciei contato com o mesmo', 'carlos.alves@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Carlos Henrique Macedo Alves (carlos.alves@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000076'::uuid, 'CCR lote 3', 'Lote 3 de rodovias no Paraná
 O contrato, com duração de 30 anos, irá demandar investimentos de R$ 9,8 bilhões em obras de melhorias e modernização das condições viárias, 569 km de rodovias', 'CCR MOTIVA', 'Adriano Kruger', 'Coordenador de Planejamento', '11 91582-7244', 'adriano.kruger@motiva.com.br', 'Nao entrei em contato. Lote 3 de rodovias no Paraná
 O contrato, com duração de 30 anos, irá demandar investimentos de R$ 9,8 bilhões em obras de melhorias e modernização das condições viárias, 569 km de rodovias', 'carlos.alves@phdengenharia.eng.br', 'em_analise', 'pendente', 'Indicado por Carlos Henrique Macedo Alves (carlos.alves@phdengenharia.eng.br), que não está mais na base de colaboradores.

Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000077'::uuid, 'BTS - Diagnóstico Estratégico BI', 'Realização diagnóstico inicial e criação, acompanhamento e apresentação de KPIs de processos para entendimento da gerência aos principais índices do grupo BTS', 'BTS Properties', 'Viktor Nobre', 'Sócio Executivo', '31) 3555-0000', 'viktor.nobre@btsproperties.com', 'Já realizamos uma primeira reunião p/ entender a demanda e mensurar a dimensão e formato de atuação da PHD ou mesmo Grupo PHDTech. Junto ao Isac está alinhado um 2ª Encontro para a BTS apresentar os processos chave (Semente) p/ desenvolvimento dos KPIs.', 'matheus.costa@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Foi realizado contato com o cliente após sinalização da oportunidade, porém não conseguimos validar este novo escopo e a proposta nem chegou a ser emitida', null, timestamptz '2025-11-06 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000078'::uuid, 'Workshop planejamento - Barcarena PA', 'Temas Sugeridos:
•	Estruturação de base de planejamento e controle
•	Gestão Lean e LPS
•	Construção e análise de indicadores de projeto
•	AWP e BIM (visão geral)', 'Conorte Serviços Industriais', 'Elson Oliveira da Silva', 'Gestor Projetos Guarda Chuva Hydro', '11981865677', 'elson.silva@conorte-pa.com.br', 'Formato: Presencial e interativa/dinâmica
Público: Planejadores dos projetos Guarda chuva Hydro Alunorte, Clean up e Albras (20-25 pessas). Perfil junior a senior.
Duração: 2 dias (sex e sáb). 
Prazo: agenda até 15/12/25', 'jader.correa@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Após projeto inicial desenvolvido com a Conorte, tentamos fomentar esta nova parceria, porém não houve sucesso e seguiram a parada com time interno.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000079'::uuid, 'Parceria Estratégica com Hect', 'Hect é uma empresa especialista em Gerenciamento de Contratos, Disputas, Arbitragens e Pleitos. Possui uma boa sinergia com os serviços prestados pela PHD e pode ter excelentes oportunidades de novos produtos e parcerias.', 'Hect', 'André Martins', 'Gerente Comercial', '31 9386-1113', 'andre.martins@hect.com', 'Alinhei com o André um primeiro contato, que aconteceu na PHD com a apresentação das duas empresas. Pedro Morais deu seguimento depois em uma visita à Hect, e por último, o time da Hect visitou a PHD novamente para reunir com Leonardo Drumond e Paulo P.', 'vinicius.costa@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Foram realizadas diversas reuniões com o parceiro, porém não conseguimos avançar em nenhuma oportunidade com esta parceria estruturada. Recebemos oportunidades de contrato e chegamos a converter um projeto com a Laage por meio de indicação da Hect. Porém, com a própria empresa não conseguimos evoluir.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000080'::uuid, 'Fiscalização BIM Obra', 'Assessoria para o Acompanhamento BIM para obra de infraestrutura rodoviária.', 'Strata', 'Luiz Otávio', 'BIM Manager', '+55 31 7580-1567', 'matheus.costa@pdengenharia.eng.br', 'Conversado rapidamente sobre a possibilidade de assessoria para a montagem de planejamento/acompanhamento (piloto) de uma obra de Infraestrutura rodoviária para realizar a fiscalização das atividades em campo de um trecho próximo ao BH shopping.', 'matheus.costa@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000081'::uuid, 'Automações para projetos de saneamento', 'Necessitam de uma consultoria para buscar (ou desenvolver) ferramentas de automação para o desenvolvimento de projetos de Saneamento, além de conexões com IA.', 'Geasa Engenharia', 'Jonas Blum', 'Projetista BIM Líder', '51 9918-1265', 'jonas.costas@geasaengenharia.com.br', 'Ele já me mandou um áudio com as necessidades que possui de uma forma mais geral e disse que está verificando com algumas consultorias se elas podem ajudar. Pelo que entendi, tem muito a ver com automações para Revit principalmente.', 'gabriel.santos@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter', null, timestamptz '2025-12-01 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000082'::uuid, 'Venda de BIM de aompanhamento de Montagem', 'Apresentamos para o cliente a ferramenta de acompanhamento de serviços e o mesmo demostrou bastante interesse para aplicação da metodologia no projeto.', 'Construcap', 'Willy Edmar da Silva Ramos', 'Engenheiro de Planejamento', '85-99716-4288', 'wesramos@construcap.com.br', 'Desenvolvimento de BIM para acompanhamento de montagem eletromecânica.', 'wantuil.oliveira@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000083'::uuid, 'Implantação de BIM para acompanhamento de Projeto pelo Gerenciamento', 'Em conversa com o gerenciamento do projeto o mesmo se mostrou interessado em conhecer as soluções de acompanhamento de projetos que temos.', 'Poyry/arauco', 'Jose Barroso dos Santos Filho', 'Engenheiro De Planejamento', '021-96944-2719', 'jose.b.santos@afry.com', 'Estamos aguardando a agenda do cliente para apresentarmos nosso portifólio.', 'wantuil.oliveira@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000084'::uuid, 'Gerenciamento, contrutibilidade e BIM', 'A Ligga está em desenvolvimento de um projeto de Ampliação das suas atividades no PA, com isso teremos orportunidades em diversas áreas de atuação.', 'Ligga', 'Poliana Luz', 'Coordenadora de Suprimentos', '(94) 99115-3338', 'poliana.luz@ligga.com.br', 'Solicitamos o cadastro no Suprimentos e apresentamos o portfólio junto com a visita ao Engenheiro de Projetos sr. Mauro Scapulatempo. Grandes oportunidades em diversas áreas de atuação da PHD.', 'jefferson.magalhaes@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Estamos em contato com Mauro com 3 oportunidades abertas. Realizamos diversas propostas e fomos para o short list de um dos projetos, para execução de Construtibilidade. Porém, não fomos contratados devido ao preço apresentado (time de suprimentos condicionou exclusivamente ao preço de proposta

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000085'::uuid, 'Planejadores para Obra de Tubulação', 'Gerente de Contratos da empresa INSTALL me ligou em 07/01 pedindo por planejadores para obra de 90 dias em São Paulo - Interior. Deixo os dados para retorno. A parceria pode gerar mais contratos do mesmo porte.', 'INSTALL', 'Augusto Hespanhol', 'Gerente de Contratos', '11916170433', 'augusto.hespanhol@installautomacao.com.br', 'Gerente de Contratos da empresa INSTALL me ligou em 07/01 pedindo por Técnicos de Planejamento para obra de 90 dias em São Paulo - A INSTALL foi uma empresa que contratamos pela ADM em Santos e Três Corações em trabalhos de Eletromecanica.', 'diogo.soares@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Hunter

Entrei em contato em 14/01 com o Augusto', null, timestamptz '2026-01-07 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000086'::uuid, 'Desenvolvimento de PBI para gestão de obras', 'Hoje temos uma demanda aqui de desenvolvimento de PBI para gestão das nossas obras, principalmente para report a nível gerencial. Temos ideia do que precisa ser mostrado"', 'Teixeira Duarte', 'Isabela Guimarães', 'Gestora de Projetos', '31 98357-6178', 'não informado', 'Entrei em contato com ela e conversamos, apos pedido dela em grupo no watts app. " 
Ela informou que a empresa já tem parceria com a PHD em demandas anteriores. Esta é uma nova oportunidade. Eles precisam de quem realmente desenvolva as telas.', 'deividy.gomes@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Proposta foi emitida para o time da Teixeira Duarte. Após envio e durante o processo de negociação, houve alteração do time de PMO do cliente e o novo direcionamento foi para que o escopo proposto pela PHD fosse executado pelo time interno do cleinte.', null, timestamptz '2026-01-08 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000087'::uuid, 'Contrato de Parceria EPC', 'Realizar uma visita na sede da Andradre Gutierrez em São Paulo, para apresentarmos os produtos PHD e propor uma parceria de atuação nos contratos EPC.', 'Andrade Gutierrez', 'Willen Delgado', 'Gerente de Engenharia', '45 9 9154-8531', 'willen.ferraz@agnet.com.br', 'Estou em contato com o Willen Delgado alinhando as agendas para a realização da visita na sede da AG. Segundo o próprio Willen, na próxima semana ele receberá um diretor de Portos da AG em seu projeto e irá propor a visita presencialmente.', 'julio.cesar@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000088'::uuid, 'Novas Bitolas L1', 'Cliente precisa de um estrudo de construtibilidade para parada que já irá acontecer em Abril.', 'Gerdau', 'Lucas Rodrigues', 'Coordenador de Engenharia', '+55 85 9921-3775', 'lucas.oliveira17@gerdau.com.br', 'Já entrei em contato com o cliente, fizemos uma apresentação do portifólio da PHD. Agora aguardando o suprimentos da Gerdau para dar seguimento ao processo do contrato.', 'ivan.silva@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Realizamos algumas reuniões com o cliente, enviamos a proposta comercial, porém a Gerdau Cosigua não tem cultura de contratar Construtibilidade e o processo não foi para nem enviado para o suprimentos.', null, timestamptz '2026-02-06 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000089'::uuid, 'INPASA', 'Conversei com Elton "Engenheiro" na IMPASA sobre a qualidade do planejamento e ele me informou que a empresa precisa de apoio.', 'INPASA', 'Leonardo Baganha Inpasa', 'Gerente de Planejamento', '+55 24 99822-0414', 'Leonardo.baganha@inpasa.com.br', 'Elton me recomendou o contato do gerente, informou que poderiamos utilizar o nome dele para acesso ao Gerente. Encaminhei as informações e o contato ao Pedro Morais.', 'diogo.soares@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter', null, timestamptz '2026-02-11 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000090'::uuid, 'Arcelormittal - Piracicaba', 'Em contato com David Brito "Área de Contratos" foi oferecido a PHD participar de um BID de apoio na gestão de contratos e planejamento.', 'Arcelormittal', 'David Brito', 'Responsável pelos contratos da Usina.', '13997411322', 'david.brito@arcelormittal.com.br', 'Em contato com David Brito "Área de Contratos" foi oferecido a PHD participar de um BID de apoio na gestão de contratos e planejamento. Necessário entrar em contato e entender a demanda. O cliente demonstrou disponibilidade de agenda em 19/02.', 'diogo.soares@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Estamos em contato com a Arcelor por alguns canais. Este BID não aconteceu, porém estamos fechando parcerias de outras formas.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000091'::uuid, 'CADASTRO NA CBMM', 'Cadastro da PHD para participara de varias proostas na empresa CBMM via mercado elêtronico. 

Obs: Preciso estar junto para realizar o cadastro com o time comercial PHD, realizar ligações para abrir as portas.', 'CBMM', 'DOVEL', 'Comprador', '**********', 'victor.mota@phdengenharia.eng.br', 'Já conversei com clinete e neste mês de março já estão iniciando a contratação de projetos via mercado elêtronico.', 'victor.mota@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Hunter

Cadastro realizado, porém o nosso modelo de vendas é consultivo e apenas o cadastro no portal não nos leva a concorrer em projetos que realmente fazem sentido a atuação PHD', null, timestamptz '2026-03-03 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000092'::uuid, 'Mina do Sossego - GP2026', 'Grande parada da Usina da Mina do Sossego. Modelagem de peças a partir dos projetos de engenharia, verificação da peça fabricada conforme projeto, análise de clash detection com o modelo 3D e elaboração de simulação construtiva.', 'Vale Base Metals', 'Thiago Henrique da Silva', 'Engenheiro de Planejamento', '55 (34) 99806-6527', 'thiago.silva19@vale.com', 'Pedro Morais já entrou em contato com o cliente para as tratativas de proposta para esse projeto.', 'ivan.silva@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Farmer', null, timestamptz '2026-04-08 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000093'::uuid, 'Moinho SAG - Planejamento Integrado', 'Planejamento integrado para o projeto Substituição da Tampa e Munhão do Moinho SAG', 'Vale Base Metals', 'Thiago Henrique da Silva', 'Engenheiro de Planejamento', '55 (34) 99806-6527', 'thiago.silva19@vale.com', 'Realizamos o estudo de construtibilidade. Cliente está gostando das entregas e deseja que realizemos o acompanhamento do projeto. Pedro Morais já entrou em contato com o cliente para as tratativas de proposta para esse projeto.', 'ivan.silva@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Farmer', null, timestamptz '2026-04-08 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000094'::uuid, 'Gerenciamento', 'Oportunidade de Gerenciamento do Projeto Downstream na ArcelorMittal unidade Tubarão - ES.', 'ArcelorMittal', 'Igor Bellotti', 'Coordenador de Projetos', '(27) 99312-6522', 'igor.bellotti@arcelormittal.com.br', 'Foi conversado e indicado a Phd para está acompanhando de perto o projeto downstream devido a robustez. O projeto prevê diversas empresas responsáveis por cada etapa do empreendimento, onde o gerenciamento é muito importante desde o início.', 'daniel.sousa@phdengenharia.eng.br', 'em_evolucao', 'elegivel', 'Planilha: Farmer

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000095'::uuid, 'Gestão Digital de Quantitativos e Revisões – Terraplenagem', 'Cliente possui projetos de terraplenagem já desenvolvidos e busca implementar a metodologia BIM para extração de quantitativos e gestão de revisões de forma ágil e confiável.', 'PAVIDEZ ENGENHARIA', 'Gilmar', 'Gerente de contrato', '35988774334', 'gilmar@pavidez.com.br', 'O cliente já possui os projetos de terraplenagem concluídos e manifestou a necessidade de aprimorar o processo de levantamento de quantitativos e controle de revisões.

Atualmente, as atualizações de projeto são manuais e com muito tempo para atualizar.', 'raykleison.costa@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

O projeto entre PHD e Pavidez foi finalizado, devido ao final do contrato. Com isso, e pela relação Pavidez - PHD no contrato não estar muito boa, o processo não foi a diante.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000096'::uuid, 'ADM Descalvado', 'Venho conversando com o Yuri a Alguns dias, e fechamos a necessidade de uma pessoa em loco para descalvado. Um novo contrato. Agendei uma reunião entre Yuri, Uilliam e nosso comercial.', 'ADM do Brasil', 'Yuri Bernardes', 'Engenheiro de Projeto', '+55 35 8874-3348', 'yuri.bernardes@adm.com', 'Ja conversamos, e agendamos uma reunião comercial para apresentar a PHD. Essa reunião dará inicio ao contrato de um consultor.', 'diogo.soares@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Farmer

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000097'::uuid, 'Gerenciamento Projeto Data Center Ascenty', 'A Ascenty está elaborando um projeto de construtibilidade de um data center em sumaré. A oportunidade de gerar um gerenciamento desse mesmo projeto é grande.', 'Ascenty', 'Matheus Manso', 'Project Manager - SPO, VIN, SCL', '19 9 9997‑5061', 'julio.lemes@ascenty.com', 'Estamos fazendo a construtibilidade do projeto, foi iniciado a conversa com Handerson Carvalho da Ascenty que conhece a Phd e está dando apoio para que a Phd pegue o gerenciamento dessa grande obra.', 'daniel.sousa@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Farmer', null, timestamptz '2026-05-04 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000098'::uuid, 'Planejador de Parada de manutenção', 'Planejador para atender Parada de manutenção ADM Campo Grande. Prioridade por planejador ja integrado na PHD com disponibilidade imediata. Mai/26 a ago/26', 'ADM do Brasil', 'Franciele Camara', 'Coord. Projetos Capex', '67999817107', 'franciele.camara@adm.com', 'Sinalizado oportunidade para Eduardo para avaliação de disponibilidade de pessoas', 'jader.correa@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Farmer

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000099'::uuid, 'Implantação de Fel', 'Implantar o processoda metodologia de FEL na Goiasa.', 'GOIASA', 'Guilherme', 'Gerente Geral', '3100000000', 'mateus.cerejo@phdengenharia.eng.br', 'Foi conversado previamente com o Pedro Morais sobre a oportunidade em uma dor do nosso cliente Goiasa, durante a visita dele ao projeto ele conseguiu apresentar previamente e foi apresentado a proposta  está em negociação nesse momento.', 'mateus.cerejo@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Proposta emitida, porém não foi a diante devido a restrição de verba do cliente.

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000100'::uuid, 'Projeto Forno - Gerdau pinda', 'A Gerdau está com o estudo para implantação de um novo forno para substituição de um antigo. Previsão de aprovaçao em 2026 e execução em 2027.', 'Gerdau - Pindamonhangaba', 'Marco Welby / Peterson Danilo', 'Gerente de Projeto / Planejamento - Capex', '12991015578 / 12991198084', 'welby.silva@gerdau.com.br / peterson.oliveira@gerdausummit.com', 'Em conversa com o Peterson, um dos resposáveis de planejamento Capex, o mesmo informou que a Gerdau está em processo de aprovação para 2026, com previsão para início para 2027. O mesmo informou que o projeto teria capacidade de contrataão da PHD.', 'gabriel.abud@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Farmer', null, timestamptz '2026-07-02 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000101'::uuid, 'Planejamento 4D - 324201 ADM SANTOS - ADM-CT16', 'Venda consolidada do planejamento 4D para o contrato CT16 na ADM do porto de Santos', 'ADM doBrasil', 'Gabriel Nomiyama', 'Engenheiro de Projetos', '013996472185', 'jeferson.expedito@phdengenharia.eng.br', 'Contrato fechado', 'jeferson.expedito@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Farmer', null, timestamptz '2026-07-06 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000102'::uuid, 'Pessoa de Planejamento - México', 'Em conversa com Leonardo Duvanel em 27/05, recebemos a demanda de 02 colaboradores. Um para gestão de documentos e outros para responsabilidade técnica de engenharia.', 'Aura Minerals', 'Leonardo Duvanel', 'Gerente de Engenharia', '+55 31 9266-3333', 'leonardo.pires@auraminerals.com', 'Consegui convence-lo de que ele precisava de 3 colaboradores. Não mais uma pessoa para arquivo técnico e outra para responsabilidade técnica de engenharia, mas sim, um planejador de engenharia e os outros dois.', 'diogo.soares@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Farmer', null, timestamptz '2026-07-06 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000103'::uuid, 'Planejador com foco em Campo para Santos', 'Conversei com o Gestor Gabriel Nomiyama e alinhamos sobre o envio de uma proposta, para uma indicação. Filipe Soares', 'ADM', 'Gabriel Nomiyama', 'Engenheiro de Projetos', '+55 13 99647-2185', 'gabriel.nomiyama@adm.com', 'Ja indiquei um colaborador, que foi aprovado pelo Gabriel, com pretensão salarial entre "Podemos chegar entre 15k a  17k" ... Pendente enviar proposta.', 'diogo.soares@phdengenharia.eng.br', 'cancelada', 'pendente', 'Planilha: Farmer

Proposta emitida, porém não foi a diante devido a restrição de verba do cliente.', null, timestamptz '2026-07-06 12:00:00-03:00'),
  ('a1a10000-0000-4000-8000-000000000104'::uuid, 'Novelis Pindamonhangaba', 'Expansão da Planta - Projeto para Duplicar a planta de Pindamonhangaba. Aprovação do projeto no 1º Semestre de 2027. Construtibilidade e Gerenciamento
CAPEX - Oportunidade nos demais projetos CAPEX da Novelis.', 'Novelis', 'Vander', 'Planejamento Capex', '(11)98407-4122', 'N/a', 'Coord. da Gerdau do projeto GERD-CT14 apresentou a PHD para o contato da Novelis. O mesmo mostrou interesse em conhecer a PHD e seus produtos e como podemos auxiliar e melhorar a gestão dos projetos Capex da empresa.', 'gabriel.abud@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Hunter

23/07/2026 16:43

Data de registro não veio na planilha.', null, null::timestamptz),
  ('a1a10000-0000-4000-8000-000000000105'::uuid, 'Projeto Nexus - Uberlândia', 'Oportunidade de concorrência a um contrato master com a ADM Latam, afim de unificar em uma empresa só, todas a M.O. de planejamento e apoio para as plantas da da América Latina.', 'ADM do Brasil', 'Fernando Abreu', 'Gerente Geral de Projetos', '31 9 84117892', 'fernando.abreu@adm.com', 'Por diversas vezes, pude demonstrar nossa capacidade de apoio ao cliente, tanto apresentando os cases internos como os externos, e sempre dando a visão que o perfil a ser contratado pela ADM é exatamente o que já oferecemos ao mercado. Isso gerou um grande interesse dele, o qual sempre comenta comigo que a PHD, pelo que ele já viu das empresas que atendem e ja atenderam a ADM, é que tem a maior capacidade técnica de assumir essa nova posição estratégica.', 'paulo.junior@phdengenharia.eng.br', 'em_analise', 'pendente', 'Planilha: Farmer

12/08/2026 16:24

Data de registro não veio na planilha.', null, null::timestamptz)
) as v (id, oportunidade, descricao, empresa, contato_nome, contato_cargo,
        contato_telefone, contato_email, tratativas, email, status, elegibilidade,
        comentario, valor_premio, criado_em)
join public.colaboradores c on lower(c.email) = v.email
on conflict (id) do nothing;

-- Trava: se algum e-mail não casar, o join descarta a linha em silêncio.
do $$
declare faltam int;
begin
  select 105 - count(*) into faltam
    from public.programas_alavanca where id::text like 'a1a1%';
  if faltam <> 0 then
    raise exception 'Faltaram % indicacao(oes): confira os e-mails em colaboradores.', faltam;
  end if;
end $$;

commit;