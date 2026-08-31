-- Carga inicial do catalogo de estoque (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- GERADO a partir de referencia/referencia_estoque/Controle - EPI + Uniforme.xlsx
-- Nao editar a mao: se a planilha mudar, regere.
--
-- Substitui a tela de importacao: a carga e unica, feita a partir do arquivo de
-- referencia, e dali em diante o cadastro e manual pelo proprio modulo.
--
-- O saldo entra como MOVIMENTO de entrada (nunca escrito direto na coluna), em
-- dois lancamentos quando ha peca usada e nova -- assim cada bolso tem
-- procedencia e estoque_conferencia fecha desde o primeiro dia.
--
-- Idempotente: rodar de novo nao duplica nem soma. O `on conflict do nothing`
-- na chave da variante faz v_var voltar null, e os movimentos sao pulados.
-- ============================================================================
do $$
declare
  v_eu uuid; v_item uuid; v_var uuid; r record;
  n_item int := 0; n_var int := 0; n_mov int := 0;
begin
  -- Autoria da carga: o primeiro admin do Administrativo, por nome.
  select id into v_eu from public.colaboradores
   where administrativo_role = 'admin' and ativo is not false order by nome limit 1;
  if v_eu is null then
    raise exception 'Sem admin do Administrativo para assinar a carga inicial.';
  end if;

  for r in
    select * from (values
    ('epi', 'ABAFADOR DE CONCHA 3M', null, '33835', null, null, null, null, 5, 5),
    ('epi', 'ABAFADOR DE CONCHA LIBUS', null, null, null, null, null, null, 0, 0),
    ('epi', 'ABAFADOR MSA', null, '27971', null, null, null, null, 0, 2),
    ('epi', 'BONÉ AMARELO', null, null, null, null, null, null, 6, 0),
    ('epi', 'BONÉ AZUL', null, null, null, null, null, null, 5, 0),
    ('epi', 'BONÉ LARANJA', null, null, null, null, null, null, 5, 0),
    ('epi', 'BONÉ VERDE', null, null, null, null, null, null, 7, 0),
    ('epi', 'BONÉ VERMELHO', null, null, null, null, null, null, 5, 0),
    ('epi', 'BOTA ECOBOOTSCANO LONGO', '44', '37992', null, null, null, null, 0, 1),
    ('epi', 'BOTA ECOBOOTSCANO LONGO', '42', '37992', null, null, null, null, 0, 1),
    ('epi', 'BOTA MANOB. BICO COMP. ANTI PERFURO', '39', '48582', null, null, null, null, 0, 0),
    ('epi', 'BOTA MANOB. METAT. BICO COMP. ANTI PERFURO', '35', null, null, null, null, null, 0, 0),
    ('epi', 'BOTINA COM METATARSO', '45', '48582', null, null, null, null, 0, 1),
    ('epi', 'BOTINA COM METATARSO', '44', '48582', null, null, null, null, 0, 0),
    ('epi', 'BOTINA COM METATARSO', '43', '48582', null, null, null, null, 0, 1),
    ('epi', 'BOTINA COM METATARSO', '42', '48582', null, null, null, null, 0, 0),
    ('epi', 'BOTINA COM METATARSO', '41', '48582', null, null, null, null, 0, 2),
    ('epi', 'BOTINA COM METATARSO', '40', '48582', null, null, null, null, 0, 1),
    ('epi', 'BOTINA COM METATARSO', '39', '48582', null, null, null, null, 0, 3),
    ('epi', 'BOTINA COM METATARSO', '38', '48582', null, null, null, null, 0, 2),
    ('epi', 'BOTINA COM METATARSO', '37', '48582', null, null, null, null, 0, 0),
    ('epi', 'CAPACETE 3M', null, '29638', null, null, null, null, 0, 5),
    ('epi', 'CAPACETE MSA', null, '8304', null, null, null, null, 12, 2),
    ('epi', 'CAPUZ APICULTOR', null, null, null, null, null, null, 0, 2),
    ('epi', 'CAPUZ DE BRIM', null, null, null, null, null, null, 0, 5),
    ('epi', 'CAPUZ DE FUGA APICULTOR', null, null, null, null, null, null, 0, 2),
    ('epi', 'CARNEIRA 3M', null, null, null, null, null, null, 5, 4),
    ('epi', 'CARNEIRA MSA', null, null, null, null, null, null, 1, 0),
    ('epi', 'CARTUCHO P/ RESPIRADOR', null, '60926', null, null, null, null, 0, 8),
    ('epi', 'CINTO SEGURANÇA / MINEIRO', null, '4319', null, null, null, null, 2, 0),
    ('epi', 'COLETE REFLETIVO LARANJA', null, null, null, null, null, null, 0, 2),
    ('epi', 'COLETE REFLETIVO VERDE', null, null, null, null, null, null, 0, 3),
    ('epi', 'FAIXA REFLETIVA LARANJA', null, null, null, null, null, null, 0, 6),
    ('epi', 'FAIXA REFLETIVA VERDE COM ELASTICO', null, null, null, null, null, null, 0, 4),
    ('epi', 'JUGULAR', null, null, null, null, null, null, 0, 7),
    ('epi', 'LUVA BLAK COMUM', null, null, null, null, null, null, 0, 0),
    ('epi', 'LUVA DE PROTEÇÃO ANTICORTE', null, '32036', null, null, null, null, 0, 2),
    ('epi', 'LUVA DE PROTEÇÃO ANTICORTE', null, '44524', null, null, null, null, 0, 5),
    ('epi', 'LUVA DE PROTEÇÃO ANTICORTE EDGE', null, '35708', null, null, null, null, 0, 2),
    ('epi', 'LUVA ESPECIAL ANTI CORTE', null, null, null, null, null, null, 0, 0),
    ('epi', 'MOCHILA', null, null, null, null, null, null, 2, 0),
    ('epi', 'OCULOS INCOLOR DE SEGURANÇA', null, null, null, null, null, null, 0, 0),
    ('epi', 'OCULOS INCOLOR DE SEGURANÇA SOBREPOR', null, null, null, null, null, null, 0, 0),
    ('epi', 'PERNEIRA', null, '43938', null, null, null, null, 5, 1),
    ('epi', 'PROTETOR FACIAL', null, null, null, null, null, null, 0, 2),
    ('epi', 'PROTETOR SOLAR', null, null, null, null, null, null, 3, 0),
    ('epi', 'REPELENTE', null, null, null, null, null, null, 1, 0),
    ('epi', 'RESPIRADOR COM VÁLVULA', null, '45021', null, null, null, null, 0, 2),
    ('epi', 'RESPIRADOR COM VÁLVULA', null, '12011', null, null, null, null, 0, 2),
    ('epi', 'RESPIRADOR SEM VÁLVULA', null, '44241', null, null, null, null, 0, 1),
    ('epi', 'TOUCA SOLDA', null, null, null, null, null, null, 0, 3),
    ('epi', 'ÓCULOS DE PROTEÇÃO ESCURO', null, null, null, null, null, null, 0, 2),
    ('uniforme', 'Agasalho', 'P', null, 'unisex', 'sede', null, null, 0, 5),
    ('uniforme', 'Agasalho', 'M', null, 'unisex', 'sede', null, null, 0, 0),
    ('uniforme', 'Agasalho', 'G', null, 'unisex', 'sede', null, null, 0, 0),
    ('uniforme', 'Agasalho', 'GG', null, 'unisex', 'sede', null, null, 0, 0),
    ('uniforme', 'Agasalho', 'XG', null, 'unisex', 'sede', null, null, 0, 0),
    ('uniforme', 'Agasalho', 'XXG', null, 'unisex', 'sede', null, null, 0, 0),
    ('uniforme', 'Camisa Polo', 'P', null, 'masculino', 'sede', null, null, 0, 1),
    ('uniforme', 'Camisa Polo', 'M', null, 'masculino', 'sede', null, null, 0, 1),
    ('uniforme', 'Camisa Polo', 'G', null, 'masculino', 'sede', null, null, 0, 7),
    ('uniforme', 'Camisa Polo', 'GG', null, 'masculino', 'sede', null, null, 0, 28),
    ('uniforme', 'Camisa Polo', 'XG', null, 'masculino', 'sede', null, null, 0, 19),
    ('uniforme', 'Camisa Polo', 'XXG', null, 'masculino', 'sede', null, null, 0, 17),
    ('uniforme', 'Camisa Polo', 'P', null, 'feminino', 'sede', null, null, 0, 1),
    ('uniforme', 'Camisa Polo', 'M', null, 'feminino', 'sede', null, null, 0, 0),
    ('uniforme', 'Camisa Polo', 'G', null, 'feminino', 'sede', null, null, 0, 0),
    ('uniforme', 'Camisa Polo', 'GG', null, 'feminino', 'sede', null, null, 0, 8),
    ('uniforme', 'Camisa Polo', 'XG', null, 'feminino', 'sede', null, null, 0, 16),
    ('uniforme', 'Camisa Polo', 'XXG', null, 'feminino', 'sede', null, null, 0, 14),
    ('uniforme', 'Camisa Social Azul com Faixa', 'P', null, 'masculino', 'obra', null, null, 0, 18),
    ('uniforme', 'Camisa Social Azul com Faixa', 'M', null, 'masculino', 'obra', null, null, 0, 0),
    ('uniforme', 'Camisa Social Azul com Faixa', 'G', null, 'masculino', 'obra', null, null, 0, 2),
    ('uniforme', 'Camisa Social Azul com Faixa', 'GG', null, 'masculino', 'obra', null, null, 0, 17),
    ('uniforme', 'Camisa Social Azul com Faixa', 'XG', null, 'masculino', 'obra', null, null, 0, 10),
    ('uniforme', 'Camisa Social Azul com Faixa', 'XXG', null, 'masculino', 'obra', null, null, 0, 8),
    ('uniforme', 'Camisa Social Azul com Faixa', 'P', null, 'feminino', 'obra', null, null, 0, 5),
    ('uniforme', 'Camisa Social Azul com Faixa', 'M', null, 'feminino', 'obra', null, null, 0, 25),
    ('uniforme', 'Camisa Social Azul com Faixa', 'G', null, 'feminino', 'obra', null, null, 0, 19),
    ('uniforme', 'Camisa Social Azul com Faixa', 'GG', null, 'feminino', 'obra', null, null, 0, 28),
    ('uniforme', 'Camisa Social Azul com Faixa', 'XG', null, 'feminino', 'obra', null, null, 0, 18),
    ('uniforme', 'Camisa Social Azul com Faixa', 'XXG', null, 'feminino', 'obra', null, null, 0, 13),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'P', null, 'masculino', 'coordenacao', null, null, 0, 5),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'M', null, 'masculino', 'coordenacao', null, null, 0, 0),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'G', null, 'masculino', 'coordenacao', null, null, 0, 0),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'GG', null, 'masculino', 'coordenacao', null, null, 0, 0),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'XG', null, 'masculino', 'coordenacao', null, null, 0, 12),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'XXG', null, 'masculino', 'coordenacao', null, null, 0, 11),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'P', null, 'feminino', 'coordenacao', null, null, 0, 0),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'M', null, 'feminino', 'coordenacao', null, null, 0, 1),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'G', null, 'feminino', 'coordenacao', null, null, 0, 0),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'GG', null, 'feminino', 'coordenacao', null, null, 0, 5),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'XG', null, 'feminino', 'coordenacao', null, null, 0, 4),
    ('uniforme', 'Camisa Social Azul sem Faixa', 'XXG', null, 'feminino', 'coordenacao', null, null, 0, 6),
    ('uniforme', 'Camisa social Branca', 'P', null, 'feminino', 'sede', null, null, 0, 5),
    ('uniforme', 'Camisa social Branca', 'P', null, 'masculino', 'sede', null, null, 0, 4),
    ('uniforme', 'Camisa social Branca', 'M', null, 'feminino', 'sede', null, null, 0, 6),
    ('uniforme', 'Camisa social Branca', 'M', null, 'masculino', 'sede', null, null, 0, 2),
    ('uniforme', 'Camisa social Branca', 'G', null, 'masculino', 'sede', null, null, 0, 6),
    ('uniforme', 'Camisa social Branca', 'G', null, 'feminino', 'sede', null, null, 0, 8),
    ('uniforme', 'Camisa social Branca', 'GG', null, 'masculino', 'sede', null, null, 0, 6),
    ('uniforme', 'Camisa social Branca', 'XG', null, 'masculino', 'sede', null, null, 0, 5)
    ) as t(categoria, descricao, tamanho, ca, genero, setor, codigo, referencia, usado, novo)
  loop
    select id into v_item from public.estoque_itens
     where categoria = r.categoria and lower(descricao) = lower(r.descricao);
    if v_item is null then
      insert into public.estoque_itens (categoria, descricao)
      values (r.categoria, r.descricao) returning id into v_item;
      n_item := n_item + 1;
    end if;

    insert into public.estoque_variantes
      (item_id, tamanho, ca, genero, setor, codigo, referencia)
    values (v_item, r.tamanho, r.ca, r.genero, r.setor, r.codigo, r.referencia)
    on conflict do nothing returning id into v_var;

    if v_var is not null then
      n_var := n_var + 1;
      if r.novo > 0 then
        insert into public.estoque_movimentos
          (variante_id, tipo, condicao, quantidade, motivo, registrado_por)
        values (v_var, 'entrada', 'novo', r.novo, 'Carga inicial (planilha)', v_eu);
        n_mov := n_mov + 1;
      end if;
      if r.usado > 0 then
        insert into public.estoque_movimentos
          (variante_id, tipo, condicao, quantidade, motivo, registrado_por)
        values (v_var, 'entrada', 'usado', r.usado, 'Carga inicial (planilha)', v_eu);
        n_mov := n_mov + 1;
      end if;
    end if;
  end loop;

  raise notice 'Carga: % itens, % variacoes, % movimentos.', n_item, n_var, n_mov;
end $$;
