// Estado e regras da mobilização. Sem imports de propósito: fica testável sob
// `node --test` e fora do arquivo do componente, que não pode exportar outra
// coisa além de componentes (fast refresh) — mesma razão do nav.js das sidebars.
// As listas de opções vivem em opcoes.js.

export const MOVIMENTOS = ['Nova mobilização', 'Movimentação de profissional', 'Desmobilização'];

export const DESMOBILIZACAO = 'Desmobilização';

/** Valor do seletor de projeto para "não está na lista" — o nome vai digitado. */
export const OUTRO_PROJETO = 'outro';

/** Desmobilização pede outra coisa: quem sai e o que devolve. */
export const eDesmobilizacao = (v) => v?.movimento === DESMOBILIZACAO;

export const inicialMobilizacao = () => ({
  movimento: MOVIMENTOS[0],
  profissional_id: '',
  profissional: '',
  gestor: '',
  cc: '',
  // Projeto guarda o NOME sempre, e o id só quando veio da lista: o chamado é
  // lido por gente, e um uuid solto no corpo não diz obra nenhuma.
  projeto_id: '',
  projeto: '',
  local_obra: '',
  data_inicio_cliente: '',
  equipamentos: [],
  softwares: [],
  epis: [],
  // Uniforme é texto livre: a lista dele não existe no portal (a de EPI existe).
  uniforme: '',
  contato_cliente: '',
  devolucao: false,
  devolucao_descricao: '',
});

/**
 * Ao trocar de movimento, zera o que não se aplica. Sem isso, quem preenchesse
 * a obra e depois mudasse para Desmobilização mandaria esses campos escondidos
 * junto no chamado.
 */
export function aoTrocarMovimento(valores, movimento) {
  const base = { ...valores, movimento };
  if (movimento === DESMOBILIZACAO) {
    return {
      ...base,
      gestor: '', cc: '', projeto_id: '', projeto: '', local_obra: '', data_inicio_cliente: '',
      equipamentos: [], softwares: [], epis: [], uniforme: '', contato_cliente: '',
    };
  }
  return { ...base, devolucao: false, devolucao_descricao: '' };
}

export function validarMobilizacao(v) {
  if (!v.movimento) return 'Escolha o tipo de movimentação.';
  if (!v.profissional_id) return 'Escolha o profissional.';

  if (eDesmobilizacao(v)) {
    // Marcar devolução sem dizer o que será devolvido não ajuda ninguém do Adm.
    if (v.devolucao && !v.devolucao_descricao?.trim()) return 'Descreva o que será devolvido.';
    return '';
  }

  if (!v.cc?.trim()) return 'Informe o centro de custo.';
  // Obrigatório: mobilizar sem dizer para qual projeto deixa o Adm sem saber o
  // que provisionar, e é a primeira pergunta que ele faria de volta.
  if (!v.projeto?.trim()) return 'Informe o projeto em que o profissional será alocado.';
  if (!v.local_obra?.trim()) return 'Informe o local da obra.';
  if (!v.data_inicio_cliente) return 'Informe a data de início no cliente.';
  return '';
}
