/**
 * Plano de saúde e odontológico (Atendimento DP), transcrito de
 * Estrutura_Chamados_DP_SLA_v3_Documentos_Plano_Medico.xlsx:
 * - aba "Motivos": o que se pode pedir em cada categoria e tipo, se envolve
 *   dependente e se o anexo é obrigatório;
 * - aba "Campos Chamado": a ordem Tipo → Categoria → Motivo → complemento;
 * - aba "Documentos Obrigatórios": o que anexar em cada inclusão/exclusão.
 *
 * A planilha descreve só o Plano Médico na aba de documentos; para o
 * odontológico vale a mesma lista na inclusão (a operadora pede os mesmos
 * documentos de identificação e vínculo).
 *
 * Lógica pura, para poder ser testada.
 */

export const TIPOS_CHAMADO_DP = ['Solicitação', 'Dúvida'];
export const CATEGORIAS_PLANO = ['Plano Médico', 'Plano Odontológico'];

export const VINCULOS = ['Cônjuge', 'Companheiro(a)', 'Filho(a)', 'Enteado(a)', 'Menor sob guarda/tutela'];

const MEDICO = 'Plano Médico';
const ODONTO = 'Plano Odontológico';
const SOLIC = 'Solicitação';
const DUVIDA = 'Dúvida';

/**
 * Cada motivo: categoria, tipo, rótulo, se o anexo é obrigatório e quais
 * campos complementares ele pede (chaves de CAMPOS_COMPLEMENTO).
 */
export const MOTIVOS_PLANO = [
  { categoria: MEDICO, tipo: SOLIC, motivo: 'Inclusão no plano', anexo: true, campos: ['data_inclusao'] },
  { categoria: MEDICO, tipo: SOLIC, motivo: 'Inclusão de dependente', anexo: true, campos: ['dependente', 'vinculo', 'data_inclusao'] },
  { categoria: MEDICO, tipo: SOLIC, motivo: 'Exclusão de dependente', anexo: true, campos: ['dependente'] },
  { categoria: MEDICO, tipo: SOLIC, motivo: 'Exclusão do titular', anexo: true, campos: [] },
  { categoria: MEDICO, tipo: SOLIC, motivo: 'Alteração cadastral', anexo: true, campos: ['dado_alterado'] },
  { categoria: MEDICO, tipo: DUVIDA, motivo: 'Coparticipação', anexo: false, campos: ['competencia', 'procedimento'] },
  { categoria: MEDICO, tipo: DUVIDA, motivo: 'Desconto em folha', anexo: false, campos: ['competencia'] },
  { categoria: MEDICO, tipo: DUVIDA, motivo: 'Cobertura / utilização', anexo: false, campos: [] },
  { categoria: MEDICO, tipo: DUVIDA, motivo: 'Carteirinha / acesso', anexo: false, campos: [] },

  { categoria: ODONTO, tipo: SOLIC, motivo: 'Inclusão no plano', anexo: true, campos: ['data_inclusao'] },
  { categoria: ODONTO, tipo: SOLIC, motivo: 'Inclusão de dependente', anexo: true, campos: ['dependente', 'vinculo', 'data_inclusao'] },
  // A planilha não pede anexo aqui (diferente do médico, que exige a carta).
  { categoria: ODONTO, tipo: SOLIC, motivo: 'Exclusão de dependente', anexo: false, campos: ['dependente'] },
  { categoria: ODONTO, tipo: SOLIC, motivo: 'Alteração cadastral', anexo: true, campos: ['dado_alterado'] },
  { categoria: ODONTO, tipo: DUVIDA, motivo: 'Desconto em folha', anexo: false, campos: ['competencia'] },
  { categoria: ODONTO, tipo: DUVIDA, motivo: 'Utilização / cobertura', anexo: false, campos: [] },
];

/** Todos os rótulos de motivo, sem repetição (é o `opcoes` "cheio" do campo). */
export const TODOS_MOTIVOS_PLANO = [...new Set(MOTIVOS_PLANO.map((m) => m.motivo))];

export const motivosDe = (categoria, tipo) => MOTIVOS_PLANO
  .filter((m) => m.categoria === categoria && m.tipo === tipo)
  .map((m) => m.motivo);

export const motivoEscolhido = (v = {}) => MOTIVOS_PLANO.find(
  (m) => m.categoria === v.categoria && m.tipo === v.tipo && m.motivo === v.motivo,
) || null;

const pedeCampo = (chave) => (v) => !!motivoEscolhido(v)?.campos.includes(chave);

/**
 * Um documento = um campo de anexo próprio na tela ("CPF", "Certidão de
 * casamento"…), cada um com o seu botão. Assim o DP sabe qual arquivo é qual
 * sem abrir um por um, e a pessoa vê exatamente o que falta.
 *
 * { chave, rotulo, obrigatorio, dica? }
 */
const doc = (chave, rotulo, obrigatorio = true, dica = '') => ({ chave, rotulo, obrigatorio, ...(dica ? { dica } : {}) });

// Formulário da operadora: a planilha o marca como condicional.
const ADESAO = doc('adesao', 'Formulário de adesão da operadora', false, 'Só quando o DP pedir.');

/** Documentos do dependente, por vínculo (aba "Documentos Obrigatórios"). */
const DOCS_POR_VINCULO = {
  'Cônjuge': [
    doc('rg_dependente', 'RG do cônjuge', true, 'Ou outro documento oficial de identificação.'),
    doc('cpf_dependente', 'CPF do cônjuge'),
    doc('certidao_casamento', 'Certidão de casamento'),
  ],
  'Companheiro(a)': [
    doc('rg_dependente', 'RG do(a) companheiro(a)', true, 'Ou outro documento oficial de identificação.'),
    doc('cpf_dependente', 'CPF do(a) companheiro(a)'),
    doc('uniao_estavel', 'Comprovação de união estável'),
  ],
  'Filho(a)': [
    doc('certidao_nascimento', 'Certidão de nascimento'),
    doc('cpf_dependente', 'CPF do(a) filho(a)'),
  ],
  'Enteado(a)': [
    doc('certidao_nascimento', 'Certidão de nascimento'),
    doc('cpf_dependente', 'CPF do(a) enteado(a)'),
    doc('comprovacao_vinculo', 'Comprovação do vínculo com o titular'),
  ],
  'Menor sob guarda/tutela': [
    doc('certidao_nascimento', 'Certidão de nascimento'),
    doc('cpf_dependente', 'CPF do menor'),
    doc('termo_guarda', 'Termo judicial de guarda ou tutela'),
  ],
};

// Dados mínimos da carta de exclusão (aba "Documentos Obrigatórios").
const CARTA_DADOS = 'A carta traz nome e CPF do titular, quem sai do plano, a vontade de excluir, data e assinatura.';

/**
 * Documentos a anexar no chamado escolhido, cada um com o seu campo.
 * `aviso` é o recado de quando ainda falta escolher algo para saber a lista.
 * O motivo sem anexo na planilha ("Anexo? Não") não pede documento nenhum.
 */
export function documentosDoPlano(v = {}) {
  const m = motivoEscolhido(v);
  if (!m || !m.anexo) return { documentos: [], aviso: '' };
  switch (m.motivo) {
    case 'Inclusão no plano':
      return {
        documentos: [
          doc('rg', 'RG', true, 'Ou outro documento oficial de identificação.'),
          doc('cpf', 'CPF'),
          ADESAO,
        ],
        aviso: '',
      };
    case 'Inclusão de dependente':
      return v.vinculo
        ? { documentos: [...(DOCS_POR_VINCULO[v.vinculo] || []), ADESAO], aviso: '' }
        : { documentos: [], aviso: 'Escolha o vínculo com o titular para ver os documentos.' };
    case 'Exclusão do titular':
      return { documentos: [doc('carta_exclusao', 'Carta de solicitação de cancelamento/exclusão', true, CARTA_DADOS)], aviso: '' };
    case 'Exclusão de dependente':
      return { documentos: [doc('carta_exclusao', 'Carta de exclusão assinada pelo titular', true, CARTA_DADOS)], aviso: '' };
    case 'Alteração cadastral':
      return { documentos: [doc('comprovante', 'Documento que comprove o dado novo')], aviso: '' };
    default:
      return { documentos: [], aviso: '' };
  }
}

/** Recado mostrado logo abaixo do motivo, quando há o que avisar antes de enviar. */
export function avisoDoPlano(v = {}) {
  const m = motivoEscolhido(v);
  if (!m) return '';
  if (m.motivo === 'Exclusão do titular') {
    return 'O DP registra o pedido assim que ele chega e orienta sobre os efeitos da exclusão, inclusive sobre os seus dependentes.';
  }
  if (m.motivo === 'Exclusão de dependente') {
    return 'O DP registra o pedido assim que ele chega e orienta sobre os efeitos da exclusão.';
  }
  return '';
}

const temTipoECategoria = (v) => !!v.tipo && !!v.categoria;

/** Campos do serviço dp/plano-saude, na ordem da aba "Campos Chamado". */
export const SCHEMA_PLANO_SAUDE = [
  { chave: 'tipo', rotulo: 'Tipo', tipo: 'selecao', obrigatorio: true, opcoes: TIPOS_CHAMADO_DP },
  // O formulário abre aos poucos: o plano só depois do tipo, o motivo só depois
  // dos dois, e o resto (complemento, documentos, descrição) só com o motivo.
  { chave: 'categoria', rotulo: 'Plano', tipo: 'selecao', obrigatorio: true, opcoes: CATEGORIAS_PLANO, aplica: (v) => !!v.tipo },
  {
    chave: 'motivo', rotulo: 'Motivo', tipo: 'selecao', obrigatorio: true,
    // `opcoes` cheio para quem só lê o esquema (testes, preenchimento pela URL);
    // a tela e a validação usam `opcoesPor`, que filtra por plano e tipo.
    opcoes: TODOS_MOTIVOS_PLANO,
    opcoesPor: (v) => motivosDe(v.categoria, v.tipo),
    aplica: temTipoECategoria,
    avisoPor: avisoDoPlano,
  },
  { chave: 'dependente', rotulo: 'Nome do dependente', tipo: 'texto', obrigatorio: true, aplica: pedeCampo('dependente') },
  { chave: 'vinculo', rotulo: 'Vínculo com o titular', tipo: 'selecao', obrigatorio: true, opcoes: VINCULOS, aplica: pedeCampo('vinculo') },
  { chave: 'data_inclusao', rotulo: 'Data desejada para inclusão', tipo: 'data', obrigatorio: true, aplica: pedeCampo('data_inclusao') },
  { chave: 'dado_alterado', rotulo: 'Dado a ser alterado', tipo: 'texto', obrigatorio: true, aplica: pedeCampo('dado_alterado') },
  { chave: 'competencia', rotulo: 'Competência (mês/ano)', tipo: 'texto', obrigatorio: true, aplica: pedeCampo('competencia') },
  { chave: 'procedimento', rotulo: 'Procedimento', tipo: 'texto', obrigatorio: false, aplica: pedeCampo('procedimento') },
];
