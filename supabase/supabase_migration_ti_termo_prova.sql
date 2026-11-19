-- Migration: ti_termo_prova (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Prova do aceite do termo de responsabilidade (19/11/2026).
--
-- Antes, o aceite guardava pessoa, CPF, hora, IP, navegador, a cópia dos
-- equipamentos e só o NOME da versão ("CLT 2026-11"). O PDF era montado com o
-- texto ATUAL do código, e o time de TI podia editar ou apagar o registro.
-- Agora cada aceite guarda também:
--   * texto_aceito    -> o texto completo que a pessoa leu (o PDF sai dele);
--   * aceite_auth_id  -> a conta autenticada (auth.uid()) que aceitou;
--   * colaborador_id  -> o cadastro em colaboradores;
--   * aceite_hash     -> SHA-256 do conteúdo do aceite (pessoa, CPF,
--                        identificação, equipamentos, texto, versão, hora, IP,
--                        navegador, conta). public.ti_termo_integro(id) confere.
-- E o registro aceito fica TRAVADO: nem o time de TI edita ou apaga.
--
-- Aceites anteriores (93, de 17 a 19/11/2026): o texto vem do termoTexto.js,
-- que não mudou desde que o aceite entrou no ar (commit 7ec9c5c, 17/11). Ficam
-- com texto_retroativo = true. A conta e o cadastro vêm de colaboradores pelo
-- e-mail.
--
-- O texto gravado é sempre o oficial do banco (app_private.ti_termo_textos,
-- passo 7), nunca o que o navegador envia; p_texto só confere que a tela
-- mostrou o texto vigente. A versão também sai da tabela.
--
-- Pode ir ANTES do front: p_texto é opcional, e o front antigo continua
-- aceitando (já com o texto oficial gravado). Idempotente.
-- ============================================================================

-- 1) Colunas -----------------------------------------------------------------
alter table public.ti_termos add column if not exists texto_aceito jsonb;
alter table public.ti_termos add column if not exists texto_retroativo boolean not null default false;
alter table public.ti_termos add column if not exists aceite_auth_id uuid;
alter table public.ti_termos add column if not exists colaborador_id uuid;
alter table public.ti_termos add column if not exists aceite_hash text;

comment on column public.ti_termos.texto_aceito is 'Texto do termo que a pessoa leu e aceitou: {identificacao, abertura, clausulas[{titulo, itens}], declaracao, assinatura}.';
comment on column public.ti_termos.texto_retroativo is 'true = texto gravado depois do aceite, a partir do código da versão aceita (aceites de 17 a 19/11/2026).';
comment on column public.ti_termos.aceite_auth_id is 'auth.uid() da conta que aceitou.';
comment on column public.ti_termos.aceite_hash is 'SHA-256 (hex) do conteúdo do aceite; ver app_private.ti_termo_hash e public.ti_termo_integro.';

-- 2) Hash do conteúdo --------------------------------------------------------
-- jsonb ordena as chaves, então o texto é estável. A hora vai em UTC, fixa,
-- para não depender do fuso da sessão.
create or replace function app_private.ti_termo_hash(t public.ti_termos)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'id', t.id,
    'pessoa_email', t.pessoa_email,
    'pessoa_nome', t.pessoa_nome,
    'cpf', t.cpf,
    'vinculo', t.vinculo,
    'modelo', t.modelo,
    'identificacao', t.identificacao,
    'data_admissao', t.data_admissao,
    'cidade', t.cidade,
    'data_termo', t.data_termo,
    'ativos', t.ativos,
    'versao_texto', t.versao_texto,
    'texto_aceito', t.texto_aceito,
    'aceite_em', to_char(t.aceite_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'aceite_ip', t.aceite_ip,
    'aceite_user_agent', t.aceite_user_agent,
    'aceite_auth_id', t.aceite_auth_id,
    'colaborador_id', t.colaborador_id
  )::text, 'UTF8')), 'hex')
$$;
revoke all on function app_private.ti_termo_hash(public.ti_termos) from public;
grant execute on function app_private.ti_termo_hash(public.ti_termos) to authenticated;

-- true = o registro bate com o hash gravado no aceite. Respeita a RLS.
create or replace function public.ti_termo_integro(p_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select t.aceite_hash is not null and t.aceite_hash = app_private.ti_termo_hash(t)
    from public.ti_termos t where t.id = p_id
$$;
revoke all on function public.ti_termo_integro(uuid) from public;
revoke execute on function public.ti_termo_integro(uuid) from anon;
grant execute on function public.ti_termo_integro(uuid) to authenticated;

-- 3) Aceite: guarda texto, conta e cadastro ----------------------------------
drop function if exists public.ti_aceitar_termo(text, jsonb, text);
create or replace function public.ti_aceitar_termo(p_cpf text, p_ident jsonb, p_versao text, p_texto jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_eu record;
  v_modelo text;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_ident jsonb := coalesce(p_ident, '{}'::jsonb);
  v_ids uuid[];
  v_ativos jsonb;
  v_pendentes int;
  v_cidade text;
  v_hoje date := app_private.hoje_brasil();
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_termo public.ti_termos;
  v_texto jsonb;
  v_versao text;
begin
  select c.id, c.nome, lower(c.email) as email, c.formato, c.data_admissao
    into v_eu
    from public.colaboradores c
   where c.auth_id = (select auth.uid()) and coalesce(c.ativo, true) and c.email is not null
   limit 1;
  if v_eu.id is null then
    raise exception 'Cadastro não encontrado.' using errcode = '42501';
  end if;
  v_modelo := app_private.ti_modelo_termo(v_eu.formato);

  if length(v_cpf) <> 11 then
    raise exception 'Informe um CPF válido.' using errcode = '22023';
  end if;
  if v_modelo = 'PJ' and (
       coalesce(trim(v_ident->>'razao_social'), '') = ''
    or length(regexp_replace(coalesce(v_ident->>'cnpj', ''), '\D', '', 'g')) <> 14
    or coalesce(trim(v_ident->>'representante'), '') = ''
    or length(regexp_replace(coalesce(v_ident->>'cpf_representante', ''), '\D', '', 'g')) <> 11
  ) then
    raise exception 'Preencha razão social, CNPJ, representante legal e CPF do representante.' using errcode = '22023';
  end if;
  -- O texto que vale é o do BANCO (app_private.ti_termo_textos, passo 7), nunca
  -- o que o navegador manda: senão daria para aceitar um termo adulterado e o
  -- hash atestaria o texto errado. p_texto só confere que a tela mostrou o
  -- texto vigente.
  select tt.texto, tt.versao into v_texto, v_versao
    from app_private.ti_termo_textos tt
   where tt.modelo = v_modelo and tt.vigente;
  if v_texto is null then
    raise exception 'Texto do termo % não cadastrado.', v_modelo using errcode = '22023';
  end if;
  if p_texto is not null and p_texto is distinct from v_texto then
    raise exception 'O texto do termo mudou. Recarregue a página e leia o termo de novo.' using errcode = '22023';
  end if;

  select array_agg(a.id order by a.tipo, a.numero_serie),
         jsonb_agg(jsonb_build_object(
           'id', a.id, 'numero_serie', a.numero_serie, 'tipo', a.tipo, 'modelo', a.modelo,
           'descricao', a.descricao, 'configuracao', a.configuracao, 'fornecedor', a.fornecedor,
           'valor_mensal', a.valor_mensal) order by a.tipo, a.numero_serie),
         count(*) filter (where a.situacao_termo is distinct from 'Assinado'),
         max(a.cidade)
    into v_ids, v_ativos, v_pendentes, v_cidade
    from public.ti_ativos a
   where lower(trim(a.responsavel)) = v_eu.email
     and a.situacao = 'Em utilização';

  if v_ids is null then
    raise exception 'Não há equipamento em uso com você.' using errcode = '22023';
  end if;
  if v_pendentes = 0 then
    raise exception 'Seu termo já está aceito.' using errcode = '22023';
  end if;

  insert into public.ti_termos (
    pessoa_email, pessoa_nome, cpf, vinculo, modelo, identificacao, data_admissao, cidade,
    data_termo, ativos, status, data_assinatura, versao_texto, aceite_em, aceite_ip, aceite_user_agent,
    texto_aceito, aceite_auth_id, colaborador_id
  ) values (
    v_eu.email, v_eu.nome,
    substr(v_cpf, 1, 3) || '.' || substr(v_cpf, 4, 3) || '.' || substr(v_cpf, 7, 3) || '-' || substr(v_cpf, 10, 2),
    v_eu.formato, v_modelo,
    jsonb_strip_nulls(jsonb_build_object(
      'razao_social', nullif(trim(v_ident->>'razao_social'), ''),
      'cnpj', nullif(trim(v_ident->>'cnpj'), ''),
      'representante', nullif(trim(v_ident->>'representante'), ''),
      'cpf_representante', nullif(trim(v_ident->>'cpf_representante'), ''),
      'area_atuacao', nullif(trim(v_ident->>'area_atuacao'), '')
    )),
    v_eu.data_admissao, coalesce(v_cidade, 'BELO HORIZONTE'),
    v_hoje, v_ativos, 'Assinado', v_hoje, v_modelo || ' ' || v_versao, now(),
    -- IP: o que a Cloudflare do Supabase preenche (o cliente não forja); sem
    -- ele, o ÚLTIMO item do x-forwarded-for (o que o proxy acrescentou).
    left(trim(coalesce(
      nullif(v_headers->>'cf-connecting-ip', ''),
      (regexp_split_to_array(coalesce(v_headers->>'x-forwarded-for', ''), '\s*,\s*'))[
        array_length(regexp_split_to_array(coalesce(v_headers->>'x-forwarded-for', ''), '\s*,\s*'), 1)]
    )), 64),
    left(v_headers->>'user-agent', 400),
    v_texto, (select auth.uid()), v_eu.id
  )
  returning * into v_termo;  -- o hash sai no gatilho de insert (passo 4)

  update public.ti_ativos
     set situacao_termo = 'Assinado',
         data_assinatura_termo = v_hoje,
         data_envio_termo = coalesce(data_envio_termo, v_hoje)
   where id = any (v_ids);

  return to_jsonb(v_termo);
end;
$$;
revoke all on function public.ti_aceitar_termo(text, jsonb, text, jsonb) from public;
revoke execute on function public.ti_aceitar_termo(text, jsonb, text, jsonb) from anon;
grant execute on function public.ti_aceitar_termo(text, jsonb, text, jsonb) to authenticated;

-- 4) Hash no insert ----------------------------------------------------------
create or replace function app_private.ti_termo_carimbar_hash()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.aceite_em is not null then
    new.aceite_hash := app_private.ti_termo_hash(new);
  end if;
  return new;
end;
$$;
revoke all on function app_private.ti_termo_carimbar_hash() from public;
drop trigger if exists ti_termos_hash on public.ti_termos;
create trigger ti_termos_hash before insert on public.ti_termos
  for each row execute function app_private.ti_termo_carimbar_hash();

-- 5) Aceites anteriores: texto da versão 2026-11, conta, cadastro e hash -----
--    (antes da trava do passo 6; só toca quem ainda não tem texto/hash)
update public.ti_termos set texto_aceito = $txt${"identificacao":"IDENTIFICAÇÃO DO EMPREGADO","abertura":"Recebi da empresa PHD SOLUCOES EM ENGENHARIA LTDA, a título de empréstimo gratuito, os equipamentos de sua propriedade descritos neste termo, para uso exclusivo nas minhas atividades profissionais para a PHD. Declaro que os recebi completos, em funcionamento e no estado de conservação registrado na descrição abaixo, e me comprometo a cumprir as condições a seguir.","clausulas":[{"titulo":"1. USO E GUARDA","itens":["Usar os equipamentos apenas para a finalidade a que se destinam, sendo vedado o uso por terceiros, inclusive familiares;","Responsabilizar-me por sua guarda e conservação, não os deixando sem supervisão em veículos, locais públicos ou canteiros de obra;","Não instalar programas sem licença ou sem autorização da área de tecnologia, não remover etiquetas de patrimônio ou lacres e não alterar configurações de segurança;","Não realizar troca de qualquer equipamento entre profissionais sem a devida formalização para o setor de TI e autorização formal pela gerência;","Não efetuar a colagem de adesivos nos equipamentos, pois fere o código de bom uso dos fornecedores;","Comunicar ao setor de TI, via chamado, qualquer defeito ou alteração que torne o equipamento impróprio para uso, sendo vedado o reparo por conta própria ou em assistência não autorizada."]},{"titulo":"2. MAU USO E DANOS","itens":["Considera-se mau uso, entre outros: queda, contato com líquidos, uso em desacordo com as orientações do fabricante, reparo ou abertura não autorizados, violação de lacre, uso por terceiros e descuido na guarda;","O desgaste natural decorrente do uso regular não gera responsabilidade ao empregado;","Constatado o mau uso pelo Comitê de Avaria e Fornecedor, o custo do reparo ou, se este for inviável, da reposição por equipamento equivalente será repassado ao empregado, na forma do item 5."]},{"titulo":"3. EXTRAVIO, FURTO OU ROUBO","itens":["Em caso de furto ou roubo, registrar boletim de ocorrência e comunicar o setor Administrativo e TI, por e-mail, em até 24 (vinte e quatro) horas do fato ou de sua ciência, apresentando o boletim e o relato das circunstâncias;","A responsabilidade será avaliada pelo Comitê de Avaria, com base nas evidências apresentadas. Havendo extravio, ou furto ou roubo em que se comprove descuido do empregado ou descumprimento deste termo, o custo de reposição será repassado ao empregado, na forma do item 5;","A ausência do boletim de ocorrência ou a comunicação fora do prazo será considerada pelo Comitê na avaliação da responsabilidade."]},{"titulo":"4. DEVOLUÇÃO","itens":["Devolver os equipamentos completos e em perfeito estado de conservação, ressalvado o desgaste natural, sempre que solicitado pela PHD ou até o último dia de trabalho em caso de desligamento;","Esgotado o prazo sem devolução, o equipamento será considerado não devolvido e o seu valor de reposição será descontado, acrescido dos custos comprovados com equipamento substituto durante o período de atraso;","Caso o equipamento seja devolvido após o desconto e em condições de uso, o valor será restituído, deduzidos os custos do atraso e eventuais reparos."]},{"titulo":"5. APURAÇÃO E DESCONTO","itens":["Antes de qualquer decisão do Comitê de Avaria, será assegurado ao empregado apresentar sua versão e as evidências que julgar pertinentes;","O valor de referência será o de mercado de equipamento equivalente ao entregue, na data da apuração, comprovado por orçamento;","Nos termos do art. 462, § 1º, da CLT, autorizo expressamente o desconto em salário ou em verbas rescisórias dos valores apurados conforme os itens 2, 3 e 4, após ciência formal da decisão do Comitê, respeitados os limites legais. Eventual saldo remanescente poderá ser cobrado pelos meios legais cabíveis."]},{"titulo":"6. DADOS E INFORMAÇÕES","itens":["Os equipamentos e as informações neles contidas pertencem à PHD e podem ser inspecionados, monitorados ou recolhidos a qualquer tempo, conforme a política de segurança da informação da empresa;","Não armazenar arquivos pessoais nos equipamentos. Na devolução, os dados poderão ser apagados sem aviso prévio."]}],"declaracao":"Declaro, para os devidos fins, que recebi e me responsabilizo pelos equipamentos descritos nesta ficha.","assinatura":"Empregado"}$txt$::jsonb, texto_retroativo = true
 where aceite_em is not null and texto_aceito is null and coalesce(modelo, 'CLT') = 'CLT';

update public.ti_termos set texto_aceito = $txt${"identificacao":"IDENTIFICAÇÃO DA CONTRATADA","abertura":"A PHD SOLUCOES EM ENGENHARIA LTDA (COMODANTE) entrega à CONTRATADA identificada acima (COMODATÁRIA), a título de comodato, nos termos dos arts. 579 a 585 do Código Civil, os equipamentos de sua propriedade descritos neste termo, para uso exclusivo na execução dos serviços objeto do contrato indicado, do qual este termo é parte integrante. A CONTRATADA declara recebê-los completos, em funcionamento e no estado registrado na descrição abaixo, e obriga-se às condições a seguir.","clausulas":[{"titulo":"1. USO E GUARDA","itens":["Utilizar os equipamentos exclusivamente na execução do objeto do contrato, respondendo pelo uso feito por seus sócios, empregados ou prepostos;","Conservar os equipamentos como se seus fossem, não os deixando sem supervisão em veículos, locais públicos ou canteiros de obra;","Não ceder, emprestar ou transferir os equipamentos a terceiros sem autorização prévia e por escrito da PHD;","Não instalar programas sem licença ou sem autorização da PHD, não remover etiquetas de patrimônio ou lacres e não alterar configurações de segurança;","Não efetuar a colagem de adesivos nos equipamentos, pois fere o código de bom uso dos fornecedores;","Comunicar à PHD, por escrito, qualquer defeito ou alteração que torne o equipamento impróprio para uso, sendo vedado o reparo por conta própria ou em assistência não autorizada."]},{"titulo":"2. DANOS","itens":["A CONTRATADA responde pelos danos causados aos equipamentos, exceto os decorrentes do desgaste natural pelo uso regular;","O dano será apurado por vistoria técnica da PHD, com laudo ou orçamento, assegurado à CONTRATADA manifestar-se por escrito em até 5 (cinco) dias úteis do recebimento;","Será devido o custo do reparo ou, se este for inviável, o valor de reposição por equipamento equivalente."]},{"titulo":"3. EXTRAVIO, FURTO OU ROUBO","itens":["Em caso de furto ou roubo, registrar boletim de ocorrência e comunicar a PHD, por e-mail, em até 24 (vinte e quatro) horas do fato ou de sua ciência, apresentando o boletim e o relato das circunstâncias;","A CONTRATADA responde pelo valor de reposição em caso de extravio, furto ou roubo, salvo se comprovar que o fato decorreu de caso fortuito ou força maior, sem qualquer culpa sua ou de seus prepostos;","A ausência do boletim de ocorrência ou a comunicação fora do prazo afasta a exceção prevista no item anterior."]},{"titulo":"4. DEVOLUÇÃO E MORA","itens":["Devolver os equipamentos completos e em perfeito estado de conservação, ressalvado o desgaste natural, da solicitação da PHD ou do término do contrato, qualquer que seja o motivo;","Esgotado o prazo, a CONTRATADA estará em mora independentemente de notificação e pagará, nos termos do art. 582 do Código Civil, aluguel de 5% do valor de referência do equipamento por dia de atraso, até a efetiva devolução;","Decorridos 3 dias de atraso, o equipamento será considerado não devolvido e será devido também o seu valor de reposição, sem prejuízo das medidas judiciais cabíveis, inclusive reintegração de posse."]},{"titulo":"5. APURAÇÃO E COBRANÇA","itens":["O valor de referência será o de mercado de equipamento equivalente ao entregue, na data da apuração, comprovado por orçamento;","A CONTRATADA autoriza expressamente a compensação dos valores devidos com quaisquer pagamentos a que tenha direito no contrato, mediante comunicação prévia e por escrito da PHD, acompanhada do demonstrativo do cálculo;","O saldo não compensado deverá ser pago em até 10 (dez) dias do recebimento da comunicação, sob pena de cobrança pelos meios legais cabíveis."]},{"titulo":"6. DADOS E DISPOSIÇÕES GERAIS","itens":["Os equipamentos e as informações neles contidas pertencem à PHD, que poderá inspecioná-los ou recolhê-los a qualquer tempo, aplicando-se as cláusulas de sigilo e proteção de dados do contrato;","Este termo integra o contrato de prestação de serviços indicado, prevalecendo o contrato em caso de conflito, e fica eleito o mesmo foro nele previsto."]}],"declaracao":"E, por estarem de acordo, as partes assinam este termo.","assinatura":"CONTRATADA (representante legal)"}$txt$::jsonb, texto_retroativo = true
 where aceite_em is not null and texto_aceito is null and coalesce(modelo, 'CLT') = 'PJ';

update public.ti_termos set texto_aceito = $txt${"identificacao":"IDENTIFICAÇÃO DO SÓCIO","abertura":"Recebi da PHD SOLUCOES EM ENGENHARIA LTDA, na condição de sócio quotista, a título de comodato, nos termos dos arts. 579 a 585 do Código Civil, os equipamentos de sua propriedade descritos neste termo, para uso exclusivo nas atividades que exerço para a PHD. Declaro que os recebi completos, em funcionamento e no estado de conservação registrado na descrição abaixo, e me comprometo a cumprir as condições a seguir.","clausulas":[{"titulo":"1. USO E GUARDA","itens":["Usar os equipamentos apenas para as atividades da PHD, sendo vedado o uso por terceiros, inclusive familiares;","Conservar os equipamentos como se meus fossem, não os deixando sem supervisão em veículos, locais públicos ou canteiros de obra;","Não instalar programas sem licença ou sem autorização da área de tecnologia, não remover etiquetas de patrimônio ou lacres e não alterar configurações de segurança;","Não realizar troca de qualquer equipamento sem a devida formalização ao setor de TI;","Não efetuar a colagem de adesivos nos equipamentos, pois fere o código de bom uso dos fornecedores;","Comunicar ao setor TI, via chamado, qualquer defeito ou alteração que torne o equipamento impróprio para uso, sendo vedado o reparo por conta própria ou em assistência não autorizada."]},{"titulo":"2. MAU USO E DANOS","itens":["Considera-se mau uso, entre outros: queda, contato com líquidos, uso em desacordo com as orientações do fabricante, reparo ou abertura não autorizados, violação de lacre, uso por terceiros e descuido na guarda;","O desgaste natural decorrente do uso regular não gera responsabilidade ao sócio;","Constatado o mau uso, com base em laudo ou orçamento técnico, o custo do reparo ou, se este for inviável, da reposição por equipamento equivalente será de responsabilidade do sócio, na forma do item 5."]},{"titulo":"3. EXTRAVIO, FURTO OU ROUBO","itens":["Em caso de furto ou roubo, registrar boletim de ocorrência e comunicar o setor Administrativo e TI, por e-mail, em até 24 (vinte e quatro) horas do fato ou de sua ciência, apresentando o boletim e o relato das circunstâncias;","Havendo extravio, ou furto ou roubo em que se comprove descuido do sócio ou descumprimento deste termo, o custo de reposição será de sua responsabilidade, na forma do item 5;","A ausência do boletim de ocorrência ou a comunicação fora do prazo será considerada na avaliação da responsabilidade."]},{"titulo":"4. DEVOLUÇÃO E MORA","itens":["Devolver os equipamentos completos e em perfeito estado de conservação, ressalvado o desgaste natural, por solicitação da PHD, ou até a data de minha retirada da sociedade ou do encerramento de minhas atividades na PHD;","Esgotado o prazo, estarei em mora independentemente de notificação e pagarei, nos termos do art. 582 do Código Civil, aluguel de 5% do valor de referência do equipamento por dia de atraso, até a efetiva devolução;","Decorridos 3 dias de atraso, o equipamento será considerado não devolvido e será devido também o seu valor de reposição."]},{"titulo":"5. APURAÇÃO E COMPENSAÇÃO","itens":["A responsabilidade será apurada pela administração da sociedade, com impedimento do sócio envolvido, assegurado a este apresentar sua versão e evidências antes da decisão;","O valor de referência será o de mercado de equipamento equivalente ao entregue, na data da apuração, comprovado por orçamento;","Autorizo expressamente a compensação dos valores apurados com lucros distribuídos, haveres a que eu tenha direito em caso de retirada;","Este termo não altera o contrato social nem o acordo de sócios, que prevalecem em caso de conflito."]},{"titulo":"6. DADOS E INFORMAÇÕES","itens":["Os equipamentos e as informações neles contidas pertencem à PHD e podem ser inspecionados, monitorados ou recolhidos a qualquer tempo, conforme a política de segurança da informação da empresa;","Não armazenar arquivos pessoais nos equipamentos. Na devolução, os dados poderão ser apagados sem aviso prévio."]}],"declaracao":"Declaro, para os devidos fins, que recebi e me responsabilizo pelos equipamentos descritos nesta ficha.","assinatura":"Sócio"}$txt$::jsonb, texto_retroativo = true
 where aceite_em is not null and texto_aceito is null and coalesce(modelo, 'CLT') = 'Sócio Cotista';

update public.ti_termos t
   set aceite_auth_id = c.auth_id,
       colaborador_id = c.id
  from public.colaboradores c
 where t.aceite_em is not null
   and t.colaborador_id is null
   and lower(c.email) = lower(t.pessoa_email);

update public.ti_termos t
   set aceite_hash = app_private.ti_termo_hash(t)
 where t.aceite_em is not null and t.aceite_hash is null;

-- 6) Trava: termo aceito não muda nem some ------------------------------------
create or replace function app_private.ti_termo_travado()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.aceite_em is not null then
    raise exception 'Termo aceito não pode ser alterado nem apagado: é a prova do aceite. Para corrigir, a pessoa aceita um termo novo.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function app_private.ti_termo_travado() from public;
drop trigger if exists ti_termos_travado on public.ti_termos;
create trigger ti_termos_travado before update or delete on public.ti_termos
  for each row execute function app_private.ti_termo_travado();

-- 7) Texto oficial no banco -------------------------------------------------
-- Um texto vigente por modelo. O aceite grava ESTE texto (passo 3). Mudou o
-- termoTexto.js? Suba VERSAO_TERMO e insira a versão nova aqui, marcando-a
-- como vigente e a anterior como não vigente, NO MESMO deploy do front: com
-- texto diferente, o aceite recusa ("O texto do termo mudou").
create table if not exists app_private.ti_termo_textos (
  modelo text not null,
  versao text not null,
  texto jsonb not null,
  vigente boolean not null default false,
  criado_em timestamptz not null default now(),
  primary key (modelo, versao)
);
create unique index if not exists ti_termo_textos_vigente on app_private.ti_termo_textos (modelo) where vigente;
revoke all on app_private.ti_termo_textos from public, anon, authenticated;

-- Versão 2026-11: o texto já gravado nos aceites (passo 5), conferido byte a
-- byte com o termoTexto.js.
insert into app_private.ti_termo_textos (modelo, versao, texto, vigente)
select distinct on (modelo) modelo, '2026-11', texto_aceito, true
  from public.ti_termos
 where texto_retroativo and modelo in ('CLT', 'PJ', 'Sócio Cotista')
 order by modelo, aceite_em
on conflict (modelo, versao) do nothing;

notify pgrst, 'reload schema';
