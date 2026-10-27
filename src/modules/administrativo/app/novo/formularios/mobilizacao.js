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

/**
 * "TERE-CT02-MIST" -> "TERE-CT02"; o que não começa por um CT -> null.
 * Mesma regra de app_private.mob_dados_do_chamado, que grava o Cód. CT do
 * processo a partir do projeto.
 */
export function codCt(texto) {
  const m = /^([A-Za-z0-9]+-CT[0-9]+)/.exec(String(texto || '').trim());
  return m ? m[1].toUpperCase() : null;
}

/** Desmobilização pede outra coisa: quem sai e o que devolve. */
export const eDesmobilizacao = (v) => v?.movimento === DESMOBILIZACAO;

/**
 * Movimentação: a pessoa sai de uma obra e vai para outra. Desde 27/10/2026 o
 * formulário mostra de onde ela sai, e a movimentação abre SEMPRE os dois
 * processos: a mobilização na obra nova (o próprio chamado) e a desmobilização
 * da obra de onde ela sai (um chamado de Desmobilização aberto junto).
 */
export const MOVIMENTACAO = 'Movimentação de profissional';
export const eMovimentacao = (v) => v?.movimento === MOVIMENTACAO;
export const precisaDesmob = eMovimentacao;

const CAMPOS_DESMOB_DA_MOVIMENTACAO = {
  desmob_data: '', desmob_possui_cracha: '', desmob_cracha_entregue: '',
};

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
  // Contato do setor do cliente em três campos (pedido de 27/10/2026). Até
  // então era um texto livre, `contato_cliente`, e cada um escrevia de um
  // jeito — só o nome, só o e-mail, telefone e nome juntos. Os chamados antigos
  // continuam com ele gravado.
  contato_nome: '',
  contato_telefone: '',
  contato_email: '',
  // Inclusão de treinamento: quais treinamentos (texto livre, "RAC 04 e PRO").
  treinamentos: '',
  devolucao: false,
  devolucao_descricao: '',
  // Só na movimentação: a desmobilização da obra de onde a pessoa sai.
  ...CAMPOS_DESMOB_DA_MOVIMENTACAO,
});

/**
 * Ao trocar de movimento, zera o que não se aplica. Sem isso, quem preenchesse
 * a obra e depois mudasse para Desmobilização mandaria esses campos escondidos
 * junto no chamado.
 */
export function aoTrocarMovimento(valores, movimento) {
  const base = movimento === MOVIMENTACAO
    ? { ...valores, movimento }
    : { ...valores, ...CAMPOS_DESMOB_DA_MOVIMENTACAO, movimento };
  if (movimento === DESMOBILIZACAO) {
    return {
      ...base,
      gestor: '', cc: '', projeto_id: '', projeto: '', local_obra: '', data_inicio_cliente: '',
      equipamentos: [], softwares: [], epis: [], uniforme: '', treinamentos: '',
      contato_nome: '', contato_telefone: '', contato_email: '',
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fixo (10 dígitos) ou celular (11), com ou sem a máscara. */
const telefoneCompleto = (t) => [10, 11].includes(String(t || '').replace(/\D/g, '').length);

/** Os três são obrigatórios: é por eles que o Adm fala com a obra. */
function validarContato(v) {
  if (!v.contato_nome?.trim()) return 'Informe o nome do contato no cliente.';
  if (!telefoneCompleto(v.contato_telefone)) return 'Informe o telefone do contato no cliente, com DDD.';
  if (!EMAIL_RE.test(String(v.contato_email || '').trim())) return 'Informe um e-mail válido do contato no cliente.';
  return '';
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
    return validarContato(v);
  }

  // Obrigatório: mobilizar sem dizer para qual projeto deixa o Adm sem saber o
  // que provisionar, e é dele que sai o Código CT. Vem logo depois do
  // profissional, na mesma ordem da tela.
  if (!v.projeto?.trim()) return 'Informe o projeto em que o profissional será alocado.';
  if (!v.cliente?.trim()) return 'Informe o cliente.';
  if (!v.cc?.trim()) return 'Informe o centro de custo.';
  if (!v.local_obra?.trim()) return 'Informe o local da obra.';
  if (!v.data_inicio_cliente) return 'Informe a data de início no cliente.';
  return validarContato(v) || validarDesmobDaMovimentacao(v);
}

function validarDesmobDaMovimentacao(v) {
  if (!eMovimentacao(v)) return '';
  if (!v.desmob_data) return 'Informe a data da desmobilização.';
  if (!['sim', 'nao'].includes(v.desmob_possui_cracha)) return 'Diga se o profissional possui crachá.';
  if (v.desmob_possui_cracha === 'sim' && !['sim', 'nao'].includes(v.desmob_cracha_entregue)) {
    return 'Diga se o crachá já foi entregue ao cliente.';
  }
  return '';
}

/**
 * Os campos do chamado de Desmobilização que nasce junto da movimentação.
 * Obra, cliente, Código CT e contato NÃO vão: o processo os herda da última
 * mobilização finalizada da pessoa, que é de onde ela sai
 * (app_private.mob_dados_do_chamado). Mandar os da movimentação poria a obra
 * NOVA na saída.
 */
export function desmobDaMovimentacao(v, numeroMovimentacao) {
  return {
    movimento: DESMOBILIZACAO,
    profissional_id: v.profissional_id,
    profissional: v.profissional,
    gestor: v.gestor,
    data_desmobilizacao: v.desmob_data,
    possui_cracha: v.desmob_possui_cracha,
    // Sem crachá não há o que entregar: a pergunta nem aparece.
    cracha_entregue: v.desmob_possui_cracha === 'sim' ? v.desmob_cracha_entregue : '',
    devolucao: false,
    devolucao_descricao: '',
    movimentacao_numero: numeroMovimentacao ? String(numeroMovimentacao) : '',
  };
}
