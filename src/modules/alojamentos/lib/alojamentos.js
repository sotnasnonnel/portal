import { supabase } from '../../../services/supabase';

/**
 * Única camada de acesso a dados do módulo — nenhuma página fala com o Supabase
 * direto (mesma regra de estoque/lib/estoque.js). As regras ficam em regras.js.
 */

const T = {
  alojamentos: 'alojamentos',
  quartos: 'alojamentos_quartos',
  estadias: 'alojamentos_estadias',
  pagamentos: 'alojamentos_pagamentos',
  itens: 'alojamentos_itens',
  ocorrencias: 'alojamentos_ocorrencias',
  pendencias: 'alojamentos_pendencias',
  contas: 'alojamentos_contas_consumo',
};
export { T as TABELAS };

// UPDATE barrado pela RLS não dá erro, dá zero linhas.
const exigirLinha = (data, erro, mensagem) => {
  if (erro) throw new Error(`${mensagem}: ${erro.message}`);
  if (!data?.length) throw new Error(`${mensagem}: você não tem permissão para esta ação.`);
  return data;
};

// O PostgREST corta em 1000 linhas por resposta, e os pagamentos passam disso
// em menos de um ano. Sem paginar, o quadro mostraria "a lançar" em conta paga.
const TAMANHO_PAGINA = 1000;
async function lerTudo(tabela) {
  const linhas = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await supabase.from(tabela).select('*')
      .order('id').range(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(`Não foi possível carregar os dados: ${error.message}`);
    linhas.push(...data);
    if (data.length < TAMANHO_PAGINA) return linhas;
  }
}

/** A base inteira: são poucas dezenas de imóveis, e os totais cruzam tudo. */
export async function carregarBase() {
  const [alojamentos, quartos, contas, pendencias, estadias, pagamentos, itens, ocorrencias] = await Promise.all([
    lerTudo(T.alojamentos), lerTudo(T.quartos), lerTudo(T.contas), lerTudo(T.pendencias),
    lerTudo(T.estadias), lerTudo(T.pagamentos), lerTudo(T.itens), lerTudo(T.ocorrencias),
  ]);
  const de = (lista, id) => lista.filter((x) => x.alojamento_id === id);
  const porCriacao = (a, b) => String(a.created_at).localeCompare(String(b.created_at));
  return {
    alojamentos: alojamentos.map((a) => ({
      ...a,
      quartos: de(quartos, a.id).sort((x, y) => x.ordem - y.ordem),
      contas: de(contas, a.id).sort(porCriacao),
      pendencias: de(pendencias, a.id).sort(porCriacao),
    })),
    estadias,
    pagamentos,
    itens,
    ocorrencias,
  };
}

// Campo vazio do formulário vira NULL: date e numeric não aceitam ''.
const limpar = (vals) => Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v === '' ? null : v]));

export async function inserir(tabela, vals) {
  const { data, error } = await supabase.from(tabela).insert(limpar(vals)).select();
  return exigirLinha(data, error, 'Não foi possível salvar')[0];
}

export async function atualizar(tabela, id, vals) {
  const { data, error } = await supabase.from(tabela).update(limpar(vals)).eq('id', id).select();
  return exigirLinha(data, error, 'Não foi possível salvar')[0];
}

export async function excluir(tabela, id) {
  const { data, error } = await supabase.from(tabela).delete().eq('id', id).select('id');
  exigirLinha(data, error, 'Não foi possível excluir');
}

/** Novo alojamento, já com "Quarto 1, Quarto 2…" quando a pessoa informou quantos. */
export async function criarAlojamento(vals, qtdQuartos) {
  const novo = await inserir(T.alojamentos, { ...vals, origem: 'Cadastrado no sistema' });
  if (qtdQuartos > 0) {
    const linhas = Array.from({ length: Math.min(qtdQuartos, 40) }, (_, i) => ({
      alojamento_id: novo.id, nome: `Quarto ${i + 1}`, vagas: 1, ordem: i,
    }));
    const { error } = await supabase.from(T.quartos).insert(linhas);
    if (error) throw new Error(`O alojamento foi criado, mas os quartos não: ${error.message}`);
  }
  return novo;
}

/** Grava a lista de quartos: atualiza os que já existiam, cria os novos e tira os removidos. */
export async function salvarQuartos(alojamentoId, linhas, removidos) {
  await Promise.all(removidos.map((id) => excluir(T.quartos, id)));
  await Promise.all(linhas.map((q, ordem) => {
    const vals = { nome: q.nome, vagas: q.vagas, ordem };
    return q.id ? atualizar(T.quartos, q.id, vals) : inserir(T.quartos, { ...vals, alojamento_id: alojamentoId });
  }));
}
