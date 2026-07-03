/**
 * Schema único do Formulário de Contratação (Formalização de Admissão).
 * Dirige render, validação e payload. `mostrar(form)` controla campos condicionais.
 * tipos: 'date' | 'text' | 'number' | 'bool' (Sim/Não) | 'radio' | 'checkbox'
 */
export const CAMPOS = [
  { id: 'data_preenchimento', n: 1, label: 'Data de preenchimento do formulário', tipo: 'date', obrigatorio: true },
  { id: 'nome_profissional', n: 2, label: 'Nome do profissional selecionado', tipo: 'text', obrigatorio: true },
  { id: 'telefone', n: 3, label: 'Telefone de contato do profissional', tipo: 'text', obrigatorio: true },
  { id: 'email', n: 4, label: 'E-mail de contato do profissional', tipo: 'text', obrigatorio: true },
  { id: 'cidade_estado', n: 5, label: 'Cidade e Estado em que o profissional irá atuar', tipo: 'text', obrigatorio: true },
  { id: 'gerente_area', n: 6, label: 'Gerente da área', tipo: 'text', obrigatorio: true },
  { id: 'gestor_responsavel', n: 7, label: 'Gestor responsável pela oportunidade', tipo: 'text', obrigatorio: true },
  { id: 'codigo_proposta_projeto', n: 8, label: 'Código da(o) proposta/projeto', tipo: 'text', obrigatorio: true },
  { id: 'codigo_vaga', n: 9, label: 'Código da Vaga (solicitar ao RH)', tipo: 'text', obrigatorio: true },
  { id: 'cargo_nivel', n: 10, label: 'Cargo e Nível', tipo: 'text', obrigatorio: true },
  { id: 'remuneracao', n: 11, label: 'Remuneração da Proposta Formal ao colaborador', tipo: 'text', obrigatorio: true },
  { id: 'ajuda_custo', n: 12, label: 'Ajuda de custo', tipo: 'bool', obrigatorio: true },
  {
    id: 'condicao_ajuda_custo', n: 13, label: 'Condição da Ajuda de Custo', tipo: 'radio', obrigatorio: true,
    mostrar: (f) => f.ajuda_custo === true,
    opcoes: ['Temporária (Oferecida pelo Cliente)', 'Temporária (Oferecida pela PHD)', 'Permanente (Oferecida pela PHD)', 'Não haverá ajuda de custo'],
  },
  {
    id: 'motivo_ajuda_custo', n: 14, label: 'Motivo da Ajuda de Custo', tipo: 'radio', obrigatorio: true,
    mostrar: (f) => f.ajuda_custo === true,
    opcoes: ['Alimentação', 'Alojamento', 'Complemento de Salário | Retirada', 'Não haverá ajuda de custo'],
  },
  { id: 'valor_ajuda_custo', n: 15, label: 'Valor da ajuda de custo', tipo: 'number', obrigatorio: true, mostrar: (f) => f.ajuda_custo === true },
  {
    id: 'formato_contratacao', n: 16, label: 'Formato de Contratação', tipo: 'radio', obrigatorio: true,
    opcoes: ['PHD Assessoria (Sócio Cotista)', 'PHD Engenharia (CLT)', 'PJ (Pessoa Jurídica)', 'PHD Assessoria (CLT)'],
  },
  { id: 'destinacao_profissional', n: 17, label: 'Destinação do profissional', tipo: 'radio', obrigatorio: true, opcoes: ['Obra', 'Sede'] },
  { id: 'passagem_deslocamento', n: 18, label: 'Passagem para deslocamento', tipo: 'bool', obrigatorio: true },
  { id: 'rota_viagem', n: 19, label: 'Rota de viagem para compra da passagem', tipo: 'text', obrigatorio: true, mostrar: (f) => f.passagem_deslocamento === true },
  { id: 'tipo_vaga', n: 20, label: 'Tipo de vaga', tipo: 'radio', obrigatorio: true, opcoes: ['Nova', 'Substituição'] },
  { id: 'nome_substituido', n: 21, label: 'Nome do profissional que será substituído', tipo: 'text', obrigatorio: true, mostrar: (f) => f.tipo_vaga === 'Substituição' },
  {
    id: 'softwares_extras', n: 22, label: 'Softwares Extras Necessários', tipo: 'checkbox', obrigatorio: false,
    opcoes: ['MS Project', 'Primavera P6', 'Acrobat Reader', 'Navisworks', 'DWG True View', 'Power BI', 'Pacote Office', '2° tela', 'Outra'],
  },
  {
    id: 'epis', n: 23, label: 'EPIs', tipo: 'checkbox', obrigatorio: false,
    opcoes: ['Camisa com faixa refletiva', 'Camisa polo', 'Agasalho', 'Jaleco', 'Botina com metatarso', 'Botina sem metatarso', 'Capacete', 'Protetor Auricular', 'Protetor Solar', 'Outra'],
  },
  {
    id: 'beneficios', n: 24, label: 'Benefícios', tipo: 'checkbox', obrigatorio: false,
    opcoes: ['Vale Alimentação (VA)', 'Vale Transporte (VT)', 'Alojamento', 'Passagem para mobilização', 'Passagem para desmobilização', 'Passagem para viagens periódicas', 'Passagem para folga de campo', 'Hospedagem em hotel', 'Outra'],
  },
  { id: 'data_disponibilidade', n: 25, label: 'Data de Disponibilidade do Profissional', tipo: 'date', obrigatorio: true },
];

export const camposVisiveis = (form) => CAMPOS.filter((c) => !c.mostrar || c.mostrar(form));

export function estadoInicial() {
  const s = {};
  for (const c of CAMPOS) {
    s[c.id] = c.tipo === 'checkbox' ? [] : c.tipo === 'bool' ? null : '';
  }
  // Data de preenchimento já vem preenchida com hoje (editável). en-CA => YYYY-MM-DD local.
  s.data_preenchimento = new Date().toLocaleDateString('en-CA');
  return s;
}

/** Retorna os campos obrigatórios visíveis que estão vazios. */
export function validar(form) {
  const faltando = [];
  for (const c of camposVisiveis(form)) {
    if (!c.obrigatorio) continue;
    const v = form[c.id];
    const vazio = c.tipo === 'bool'
      ? typeof v !== 'boolean'
      : c.tipo === 'checkbox'
        ? !(Array.isArray(v) && v.length)
        : v == null || String(v).trim() === '';
    if (vazio) faltando.push(c);
  }
  return faltando;
}

/** Monta o payload p/ formularios_contratacao; campos ocultos viram null/[]. */
export function montarPayload(form) {
  const out = {};
  for (const c of CAMPOS) {
    const vis = !c.mostrar || c.mostrar(form);
    if (!vis) { out[c.id] = c.tipo === 'checkbox' ? [] : null; continue; }
    const v = form[c.id];
    if (c.tipo === 'number') out[c.id] = v === '' || v == null ? null : Number(v);
    else if (c.tipo === 'checkbox') out[c.id] = Array.isArray(v) ? v : [];
    else if (c.tipo === 'bool') out[c.id] = typeof v === 'boolean' ? v : null;
    else out[c.id] = v === '' ? null : v;
  }
  return out;
}
