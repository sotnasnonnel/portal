/**
 * Schema único da requisição de Nova Vaga (aumento de quadro).
 * Dirige render, validação e payload, agrupado por `secao`.
 * tipos: 'textarea' | 'date' | 'number' (com `inteiro`) | 'select' | 'departamento'
 *        | 'funcao' (lista oficial + Outro) | 'uf' | 'bool' | 'text'
 * Filial depende da Empresa (mapa FILIAIS); o anexo é tratado fora do schema.
 */
import { parseCurrency } from '../utils/currencyMask';

export const EMPRESAS = ['PHD ENGENHARIA', 'PHD ASSESSORIA'];

export const FILIAIS = {
  'PHD ENGENHARIA': ['PHD PLANEJAMENTO, CONSULTORIA E GESTAO DE OBRAS'],
  'PHD ASSESSORIA': ['PHD ASSESSORIA EM GESTAO LTDA'],
};

export const DEPARTAMENTOS = [
  'Administrativo', 'Comercial', 'Dados', 'Departamento Pessoal', 'Financeiro',
  'Gente e Cultura / RH', 'Marketing', 'PMO', 'Planejamento', 'BIM', 'Lean',
  'Qualidade', 'Medição', 'Topografia', 'Operações',
];

export const MODALIDADES_CONTRATACAO = [
  'PHD Assessoria (Sócio Cotista)', 'PHD Engenharia (CLT)', 'PJ (Pessoa Jurídica)', 'PHD Assessoria (CLT)',
];

export const TIPOS_VAGA = ['Aumento de Quadro', 'Substituição'];

export const CAMPOS_NOVA_VAGA = [
  { id: 'previsao', n: 1, secao: 'Dados básicos', label: 'Data de necessidade', tipo: 'date', obrigatorio: true },

  { id: 'empresa', n: 2, secao: 'Local de destino', label: 'Empresa', tipo: 'select', obrigatorio: true, opcoes: EMPRESAS, placeholder: 'Selecione a empresa' },
  { id: 'departamento', n: 3, secao: 'Local de destino', label: 'Departamento', tipo: 'departamento', obrigatorio: true, opcoes: DEPARTAMENTOS, placeholder: 'Selecione a seção ou departamento' },

  { id: 'funcao', n: 4, secao: 'Dados da vaga', label: 'Função', tipo: 'funcao', obrigatorio: true },
  { id: 'tipo_vaga', n: 5, secao: 'Dados da vaga', label: 'Tipo de vaga', tipo: 'select', obrigatorio: true, opcoes: TIPOS_VAGA, placeholder: 'Selecione o tipo de vaga' },

  { id: 'unidade', n: 6, secao: 'Informações adicionais', label: 'Gerência', tipo: 'text', obrigatorio: true },
  { id: 'nome_cliente', n: 7, secao: 'Informações adicionais', label: 'Nome do Cliente', tipo: 'text', obrigatorio: true },
  { id: 'codigo_cliente', n: 8, secao: 'Informações adicionais', label: 'Codigo do Cliente', tipo: 'text', obrigatorio: true },
  { id: 'valor_orcado_contrato', n: 9, secao: 'Informações adicionais', label: 'Valor do profissional orçado no contrato Comercial (R$)', tipo: 'moeda', obrigatorio: true },
  { id: 'valor_margem_proposta', n: 10, secao: 'Informações adicionais', label: 'Valor/margem salarial para a proposta ao Candidato (R$)', tipo: 'moeda', obrigatorio: true },
  { id: 'tipo_transporte', n: 11, secao: 'Informações adicionais', label: 'Tipo Transporte', tipo: 'text', obrigatorio: true },
  { id: 'modalidade_contratacao', n: 12, secao: 'Informações adicionais', label: 'Modalidade de Contratação', tipo: 'select', obrigatorio: true, opcoes: MODALIDADES_CONTRATACAO, placeholder: 'Selecione a modalidade' },
  { id: 'horario_trabalho', n: 13, secao: 'Informações adicionais', label: 'Horário de Trabalho', tipo: 'text', obrigatorio: true },
  { id: 'custo_projeto_100', n: 14, secao: 'Informações adicionais', label: 'Se o profissional estará 100% no custo do projeto', tipo: 'bool', obrigatorio: true },
  { id: 'tipo_moradia', n: 15, secao: 'Informações adicionais', label: 'Tipo de Moradia', tipo: 'text', obrigatorio: true },
  { id: 'tipo_alimentacao', n: 16, secao: 'Informações adicionais', label: 'Tipo Alimentação', tipo: 'text', obrigatorio: true },
  { id: 'folga_campo', n: 17, secao: 'Informações adicionais', label: 'Folga de Campo', tipo: 'text', obrigatorio: true },
  { id: 'formacao', n: 18, secao: 'Informações adicionais', label: 'Formação', tipo: 'text', obrigatorio: true },
  { id: 'tempo_experiencia', n: 19, secao: 'Informações adicionais', label: 'Tempo de Experiência', tipo: 'text', obrigatorio: true },
  { id: 'cidade_atuacao', n: 20, secao: 'Informações adicionais', label: 'Cidade de Atuação', tipo: 'text', obrigatorio: true },
  { id: 'estado_atuacao', n: 21, secao: 'Informações adicionais', label: 'Estado de Atuação', tipo: 'uf', obrigatorio: true },
  { id: 'requisitos_desejados', n: 22, secao: 'Informações adicionais', label: 'Requisitos Desejados', tipo: 'textarea', obrigatorio: true },
  { id: 'atividades_cargo', n: 23, secao: 'Informações adicionais', label: 'Atividades do Cargo', tipo: 'textarea', obrigatorio: true },
  { id: 'requisitos_obrigatorios', n: 24, secao: 'Informações adicionais', label: 'Requisitos Obrigatórios', tipo: 'textarea', obrigatorio: true },
  { id: 'desconsiderar_perfis', n: 25, secao: 'Informações adicionais', label: 'Desconsiderar Perfis', tipo: 'textarea', obrigatorio: false },
  { id: 'justificativa', n: 26, secao: 'Informações adicionais', label: 'Justificativa', tipo: 'textarea', obrigatorio: true, placeholder: 'Insira a justificativa da vaga.' },
];

/** Seções na ordem de exibição; o anexo entra no final do formulário. */
export const SECOES_NOVA_VAGA = ['Dados básicos', 'Local de destino', 'Dados da vaga', 'Informações adicionais'];

export function estadoInicialNovaVaga() {
  const s = {};
  for (const c of CAMPOS_NOVA_VAGA) s[c.id] = c.tipo === 'bool' ? null : '';
  return s;
}

/** Retorna os campos obrigatórios que estão vazios. */
export function validarNovaVaga(form) {
  const faltando = [];
  for (const c of CAMPOS_NOVA_VAGA) {
    if (!c.obrigatorio) continue;
    const v = form[c.id];
    const vazio = c.tipo === 'bool' ? typeof v !== 'boolean' : v == null || String(v).trim() === '';
    if (vazio) faltando.push(c);
  }
  return faltando;
}

/** Monta o payload p/ a tabela vagas. */
export function montarPayloadNovaVaga(form) {
  const out = {};
  for (const c of CAMPOS_NOVA_VAGA) {
    const v = form[c.id];
    if (c.tipo === 'moeda') out[c.id] = parseCurrency(v);
    else if (c.tipo === 'number') out[c.id] = v === '' || v == null ? null : (c.inteiro ? Math.trunc(Number(v)) : Number(v));
    else if (c.tipo === 'bool') out[c.id] = typeof v === 'boolean' ? v : null;
    else out[c.id] = v === '' || v == null ? null : String(v).trim();
  }
  return out;
}
