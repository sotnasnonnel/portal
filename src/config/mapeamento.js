/**
 * Schema único da requisição de Mapeamento (Avaliação de Candidatos / Projetos).
 * Dirige render, validação e payload, no mesmo formato do formulário de contratação.
 * tipos: 'text' | 'number' | 'date' | 'textarea' | 'funcao' (lista oficial + Outro) | 'uf'
 * O anexo é tratado fora do schema (upload p/ bucket mapeamento-anexos).
 */
export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const CAMPOS_MAPEAMENTO = [
  { id: 'funcao', n: 1, label: 'Função', tipo: 'funcao', obrigatorio: true },
  { id: 'unidade', n: 2, label: 'Gerência', tipo: 'text', obrigatorio: true },
  { id: 'codigo_proposta_cliente', n: 3, label: 'Código da proposta/cliente', tipo: 'text', obrigatorio: true },
  { id: 'estado', n: 5, label: 'Estado', tipo: 'uf', obrigatorio: true },
  { id: 'cidade', n: 6, label: 'Cidade', tipo: 'text', obrigatorio: true },
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
