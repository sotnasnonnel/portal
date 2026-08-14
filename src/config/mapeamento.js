/**
 * Schema único da requisição de Mapeamento (Avaliação de Candidatos / Projetos).
 * Dirige render, validação e payload, no mesmo formato do formulário de contratação.
 * tipos: 'text' | 'number' | 'date' | 'textarea' | 'funcao' (lista oficial + Outro)
 *        | 'uf' | 'select' (opcoes)
 * Os anexos são tratados fora do schema (upload p/ bucket mapeamento-anexos).
 * `n` é sequencial (1..N) e vira o número do item no form/visualizações; o anexo
 * é o item N+1.
 */
import { MODALIDADES_CONTRATACAO } from './novaVaga.js';

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const CAMPOS_MAPEAMENTO = [
  { id: 'funcao', n: 1, label: 'Função', tipo: 'funcao', obrigatorio: true },
  { id: 'unidade', n: 2, label: 'Gerência', tipo: 'text', obrigatorio: true },
  { id: 'codigo_proposta_cliente', n: 3, label: 'Código da proposta/cliente', tipo: 'text', obrigatorio: true },
  { id: 'estado', n: 4, label: 'Estado', tipo: 'uf', obrigatorio: true },
  { id: 'cidade', n: 5, label: 'Cidade', tipo: 'text', obrigatorio: true },
  { id: 'modalidade_contratacao', n: 6, label: 'Modalidade de Contratação', tipo: 'select', obrigatorio: true, opcoes: MODALIDADES_CONTRATACAO, placeholder: 'Selecione a modalidade' },
  { id: 'salario_base', n: 7, label: 'Salário Base', tipo: 'number', obrigatorio: true },
  { id: 'ajuda_custo_alimentacao', n: 8, label: 'Ajuda de Custo - Alimentação', tipo: 'number', obrigatorio: true },
  { id: 'ajuda_custo_moradia', n: 9, label: 'Ajuda de Custo - Moradia', tipo: 'number', obrigatorio: true },
  { id: 'ajuda_custo_mobilidade', n: 10, label: 'Ajuda de Custo - Mobilidade', tipo: 'number', obrigatorio: true },
  { id: 'data_limite_contratacao', n: 11, label: 'Data Limite da Contratação', tipo: 'date', obrigatorio: true },
  { id: 'horario_trabalho', n: 12, label: 'Horário de Trabalho', tipo: 'text', obrigatorio: true },
  { id: 'criterio_folga', n: 13, label: 'Critério de Folga', tipo: 'text', obrigatorio: true },
  { id: 'formacao', n: 14, label: 'Formação (Escolaridade)', tipo: 'text', obrigatorio: true },
  { id: 'tempo_experiencia', n: 15, label: 'Tempo de Experiência', tipo: 'text', obrigatorio: true },
  { id: 'atividades_cargo', n: 16, label: 'Atividades do Cargo', tipo: 'textarea', obrigatorio: true },
  { id: 'conhecimentos_obrigatorios', n: 17, label: 'Conhecimentos Obrigatórios', tipo: 'textarea', obrigatorio: true },
  { id: 'desconsiderar_perfis', n: 18, label: 'Desconsiderar perfis', tipo: 'textarea', obrigatorio: false },
];

export function estadoInicialMapeamento() {
  const s = {};
  for (const c of CAMPOS_MAPEAMENTO) s[c.id] = '';
  return s;
}

/** Retorna os campos obrigatórios que estão vazios. */
export function validarMapeamento(form) {
  return CAMPOS_MAPEAMENTO.filter(
    (c) => c.obrigatorio && (form[c.id] == null || String(form[c.id]).trim() === '')
  );
}

/**
 * Quem pode transformar um Mapeamento em Nova Vaga: o SOLICITANTE, em qualquer
 * situação que não seja um fim de linha (reprovada/cancelada).
 *
 * Antes exigia `status = 'concluida'`, e isso na prática escondia o botão quase
 * sempre: 'concluida' não significa "aprovado", significa "o Admin do DP já
 * executou a etapa final". Entre a aprovação da cadeia e a execução do DP — que
 * é onde o gestor de fato quer abrir a vaga — a requisição segue 'pendente' e a
 * opção não aparecia.
 *
 * Gerar a vaga cedo é seguro: a Nova Vaga é uma requisição NOVA e passa pela
 * própria cadeia completa (§5.1 — Diretor da área + Financeiro, e a Trava
 * Headcount se for liderança). O Mapeamento é insumo, não autorização; nada
 * entra no quadro sem a vaga em si ser aprovada.
 */
export function podeGerarNovaVaga(sol, userId) {
  if (sol?.tipo !== 'mapeamento') return false;
  if (sol?.status === 'reprovada' || sol?.status === 'cancelada') return false;
  const dono = String(sol?.gestor_id || '').trim().toLowerCase();
  const eu = String(userId || '').trim().toLowerCase();
  return !!dono && dono === eu;
}

/** O Mapeamento de origem ainda não passou por toda a cadeia? (só p/ avisar na tela) */
export const mapeamentoEmAprovacao = (sol) => sol?.status !== 'concluida';

/**
 * Pré-preenche o formulário de Nova Vaga a partir dos dados de um Mapeamento
 * (feature "gerar Nova Vaga"). Só os campos com correspondência clara — os
 * demais (empresa, departamento, equipamento, valores, etc.) o gestor completa.
 * Valores monetários ficam de fora de propósito: margem/orçado têm semântica
 * diferente do salário-base do mapeamento e devem ser informados com intenção.
 */
export function prefillNovaVagaDeMapeamento(dados = {}) {
  const cp = (v) => (v == null ? '' : String(v));
  return {
    funcao: cp(dados.funcao),
    unidade: cp(dados.unidade),
    estado_atuacao: cp(dados.estado),
    cidade_atuacao: cp(dados.cidade),
    modalidade_contratacao: cp(dados.modalidade_contratacao),
    horario_trabalho: cp(dados.horario_trabalho),
    formacao: cp(dados.formacao),
    tempo_experiencia: cp(dados.tempo_experiencia),
    atividades_cargo: cp(dados.atividades_cargo),
    requisitos_obrigatorios: cp(dados.conhecimentos_obrigatorios),
    desconsiderar_perfis: cp(dados.desconsiderar_perfis),
    codigo_cliente: cp(dados.codigo_proposta_cliente),
  };
}

/** Monta o payload p/ a tabela mapeamentos. */
export function montarPayloadMapeamento(form) {
  const out = {};
  for (const c of CAMPOS_MAPEAMENTO) {
    const v = form[c.id];
    if (c.tipo === 'number') out[c.id] = v === '' || v == null ? null : Number(v);
    else out[c.id] = v === '' || v == null ? null : String(v).trim();
  }
  return out;
}
