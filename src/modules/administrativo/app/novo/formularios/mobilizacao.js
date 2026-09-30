// Estado e regras da mobilização. Sem imports de propósito: fica testável sob
// `node --test` e fora do arquivo do componente, que não pode exportar outra
// coisa além de componentes (fast refresh) — mesma razão do nav.js das sidebars.
// As listas de opções vivem em opcoes.js.

export const MOVIMENTOS = [
  'Nova mobilização', 'Movimentação de profissional', 'Desmobilização', 'Inclusão de treinamento',
];

export const DESMOBILIZACAO = 'Desmobilização';

/**
 * Treinamento novo para quem JÁ está mobilizado no contrato (pedido da
 * Edijane, 30/09/2026). Pede só quem, onde e quais treinamentos: obra, data e
 * adicionais já são da mobilização que existe.
 */
export const INCLUSAO_TREINAMENTO = 'Inclusão de treinamento';
export const eInclusaoTreinamento = (v) => v?.movimento === INCLUSAO_TREINAMENTO;

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
  // Os tres campos abaixo existem para o modulo de Mobilizacao: o processo
  // que nasce deste chamado precisa saber PARA QUEM a pessoa vai e por qual
  // empresa. Sem eles o processo nascia com cliente em branco, enquanto as
  // 125 linhas vindas da planilha tinham todos preenchidos.
  cliente: '',
  cliente_final: '',
  empresa_phd: '',
  // Desmobilizacao nao tem "data de inicio no cliente", e sem data nenhuma o
  // processo nascia sem prazo em NENHUM passo. Esta e a data-base dele.
  data_desmobilizacao: '',
  equipamentos: [],
  softwares: [],
  epis: [],
  // Uniforme é texto livre: a lista dele não existe no portal (a de EPI existe).
  uniforme: '',
  contato_cliente: '',
  // Inclusão de treinamento: quais treinamentos (texto livre, "RAC 04 e PRO").
  treinamentos: '',
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
      equipamentos: [], softwares: [], epis: [], uniforme: '', contato_cliente: '', treinamentos: '',
    };
  }
  if (movimento === INCLUSAO_TREINAMENTO) {
    // Fica: profissional, gestor, cliente, CC, local e contato. Sai o que é
    // de mobilização nova (projeto, data, adicionais) e de desmobilização.
    return {
      ...base,
      projeto_id: '', projeto: '', data_inicio_cliente: '',
      equipamentos: [], softwares: [], epis: [], uniforme: '',
      devolucao: false, devolucao_descricao: '', data_desmobilizacao: '',
    };
  }
  return { ...base, devolucao: false, devolucao_descricao: '', data_desmobilizacao: '', treinamentos: '' };
}

export function validarMobilizacao(v) {
  if (!v.movimento) return 'Escolha o tipo de movimentação.';
  if (!v.profissional_id) return 'Escolha o profissional.';

  if (eDesmobilizacao(v)) {
    // Marcar devolução sem dizer o que será devolvido não ajuda ninguém do Adm.
    if (v.devolucao && !v.devolucao_descricao?.trim()) return 'Descreva o que será devolvido.';
    // É a data-base do processo de desmobilização: sem ela nenhum passo tem
    // prazo, e o quadro nasce todo sem semáforo.
    if (!v.data_desmobilizacao) return 'Informe a data da desmobilização.';
    return '';
  }

  if (eInclusaoTreinamento(v)) {
    if (!v.cliente?.trim()) return 'Informe o cliente.';
    if (!v.cc?.trim()) return 'Informe o centro de custo.';
    if (!v.treinamentos?.trim()) return 'Informe quais treinamentos devem ser incluídos.';
    return '';
  }

  if (!v.cliente?.trim()) return 'Informe o cliente.';
  if (!v.cc?.trim()) return 'Informe o centro de custo.';
  // Obrigatório: mobilizar sem dizer para qual projeto deixa o Adm sem saber o
  // que provisionar, e é a primeira pergunta que ele faria de volta.
  if (!v.projeto?.trim()) return 'Informe o projeto em que o profissional será alocado.';
  if (!v.local_obra?.trim()) return 'Informe o local da obra.';
  if (!v.data_inicio_cliente) return 'Informe a data de início no cliente.';
  return '';
}
