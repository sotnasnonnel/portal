// Estado e regras da mobilização. Sem imports de propósito: fica testável sob
// `node --test` e fora do arquivo do componente, que não pode exportar outra
// coisa além de componentes (fast refresh) — mesma razão do nav.js das sidebars.
// As listas de opções vivem em opcoes.js.

export const MOVIMENTOS = ['Nova mobilização', 'Movimentação de profissional', 'Desmobilização'];

export const DESMOBILIZACAO = 'Desmobilização';

/** Desmobilização pede outra coisa: quem sai e o que devolve. */
export const eDesmobilizacao = (v) => v?.movimento === DESMOBILIZACAO;

export const inicialMobilizacao = () => ({
  movimento: MOVIMENTOS[0],
  profissional_id: '',
  profissional: '',
  gestor: '',
  cc: '',
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
      gestor: '', cc: '', local_obra: '', data_inicio_cliente: '',
      equipamentos: [], softwares: [], epis: [], uniforme: '', contato_cliente: '',
    };
  }
  return { ...base, devolucao: false, devolucao_descricao: '', data_desmobilizacao: '' };
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

  if (!v.cliente?.trim()) return 'Informe o cliente.';
  if (!v.cc?.trim()) return 'Informe o centro de custo.';
  if (!v.local_obra?.trim()) return 'Informe o local da obra.';
  if (!v.data_inicio_cliente) return 'Informe a data de início no cliente.';
  return '';
}
