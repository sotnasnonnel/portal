import {
  alojs, byId, num, operando, staysOn, STATUS, CONTAS, CONTAS_CONTROLAVEIS, CONF, UTIL_TIPOS, CHAVE, PAG_ST, FORMAS, DESTINOS, TIPOS_OC,
  TIPOS_IMOVEL, UFS,
} from './regras.js';

// Os campos de cada formulário, do jeito que o protótipo os descreve. Quem
// desenha é app/components/FormModal.jsx. `k` é o nome da coluna no banco.

const pares = (mapa) => Object.entries(mapa).map(([k, v]) => [k, v.l]);

export const alojOpts = (base, incluirInativos) => alojs(base, (a) => (incluirInativos ? true : operando(a)))
  .map((a) => [a.id, `${a.nome}${a.status !== 'ativo' ? ` (${STATUS[a.status].l.toLowerCase()})` : ''}`]);

export const ALOJ_PADRAO = {
  status: 'ativo', pais: 'Brasil', contas_controladas: ['Aluguel', 'Condomínio', 'Água', 'Energia', 'Internet'],
};

export const alojFields = (isNew) => [
  { section: 'Identificação' },
  { k: 'nome', label: 'Nome do alojamento', req: true, ph: 'Ex.: Buritis Aluísio 202' },
  { k: 'sigla', label: 'Sigla / unidade', ph: 'Ex.: GBA' },
  { k: 'status', label: 'Situação', type: 'select', opts: pares(STATUS), def: 'ativo' },
  { k: 'tipo', label: 'Tipo de imóvel', type: 'select', opts: TIPOS_IMOVEL, def: 'Apartamento' },
  { k: 'endereco', label: 'Endereço completo', span: 2, ph: 'Rua, número, complemento, bairro' },
  { k: 'cidade', label: 'Cidade' },
  { k: 'uf', label: 'UF', type: 'select', opts: UFS },
  { k: 'cep', label: 'CEP' },
  { k: 'pais', label: 'País', def: 'Brasil' },
  { k: 'composicao', label: 'Composição do imóvel', span: 2, ph: 'Ex.: 3 quartos (1 suíte), sala, cozinha, área de serviço' },
  ...(isNew ? [{ k: '_nq', label: 'Quantidade de quartos', type: 'int', hint: 'Cria Quarto 1, Quarto 2… (ajuste depois em Ocupação)' }] : []),
  { section: 'Gestão' },
  { k: 'cnpj_locacao', label: 'Locatário (CNPJ de locação)', ph: 'PHD Assessoria / PHD Engenharia' },
  { k: 'centro_custo', label: 'Centro de custo', ph: 'Ex.: VALE-CT01' },
  { k: 'gerente', label: 'Gerente responsável' },
  { k: 'projeto', label: 'Contrato / projeto atendido' },
  { section: 'Contrato de locação' },
  { k: 'contrato_inicio', label: 'Início do contrato', type: 'date' },
  { k: 'contrato_fim', label: 'Fim do contrato', type: 'date' },
  { k: 'contrato_prazo', label: 'Prazo', ph: 'Ex.: 30 meses' },
  { k: 'contrato_renovacao_automatica', label: 'Prorrogação automática', type: 'toggle' },
  { k: 'contrato_observacao', label: 'Cláusulas / observação contratual', type: 'textarea', span: 2, ph: 'Multa, aviso prévio, reajuste…' },
  { k: 'encerramento_previsto', label: 'Entrega prevista (desmobilização)', type: 'date' },
  { k: 'devolucao_data', label: 'Data de devolução do imóvel', type: 'date' },
  { k: 'devolucao_obs', label: 'Observação da devolução', span: 2 },
  { section: 'Valores' },
  { k: 'aluguel_valor', label: 'Valor do aluguel (R$)', type: 'money' },
  { k: 'aluguel_vencimento', label: 'Dia de vencimento do aluguel', ph: 'Ex.: 10' },
  { k: 'aluguel_cobranca', label: 'Como recebe a cobrança do aluguel', span: 2, ph: 'Ex.: Boleto no e-mail do administrativo' },
  { k: 'condominio_valor', label: 'Condomínio (R$)', type: 'money' },
  { k: 'iptu', label: 'IPTU mensal (R$)', type: 'money' },
  { k: 'caucao', label: 'Caução (R$)', type: 'money' },
  { section: 'Contatos' },
  { k: 'proprietario_nome', label: 'Proprietário / locador' },
  { k: 'proprietario_telefone', label: 'Telefone do proprietário', type: 'tel' },
  { k: 'proprietario_email', label: 'E-mail do proprietário', type: 'email', span: 2 },
  { k: 'imobiliaria_nome', label: 'Imobiliária' },
  { k: 'imobiliaria_telefone', label: 'Telefone da imobiliária', type: 'tel' },
  { k: 'imobiliaria_email', label: 'E-mail da imobiliária', type: 'email', span: 2 },
  { k: 'condominio_nome', label: 'Nome do condomínio' },
  { k: 'condominio_cobranca', label: 'Cobrança do condomínio' },
  { k: 'sindico_nome', label: 'Síndico' },
  { k: 'sindico_telefone', label: 'Telefone do síndico', type: 'tel' },
  { k: 'diarista_nome', label: 'Diarista / limpeza' },
  { k: 'diarista_telefone', label: 'Telefone da diarista', type: 'tel' },
  { k: 'diarista_valor', label: 'Valor da diária (R$)', type: 'money' },
  { k: 'diarista_intervalo', label: 'Frequência', ph: 'Ex.: 1x na semana' },
  { k: 'garagem_vagas', label: 'Vagas de garagem', type: 'int' },
  { k: 'garagem_usuarios', label: 'Usuários da garagem' },
  { section: 'Controle de pagamentos' },
  {
    k: 'contas_controladas',
    label: 'Contas fixas controladas mês a mês',
    type: 'checks',
    // Manutenção fica fora: é variável e nunca entra como "a lançar".
    opts: CONTAS_CONTROLAVEIS,
    hint: 'Aparecem como “a lançar” no quadro de pagamentos até serem registradas.',
  },
  { section: 'Observações' },
  { k: 'observacoes', label: 'Observações gerais', type: 'textarea', span: 2, rows: 4 },
];

export const contaFields = [
  { k: 'tipo', label: 'Conta', type: 'select', opts: UTIL_TIPOS, def: 'Energia' },
  { k: 'fornecedor', label: 'Fornecedor / concessionária', ph: 'Ex.: CEMIG' },
  { k: 'codigo', label: 'Unidade consumidora / código do cliente' },
  { k: 'vencimento', label: 'Dia de vencimento', ph: 'Ex.: 10' },
  { k: 'cobranca', label: 'Como recebe a cobrança', span: 2, ph: 'Ex.: O financeiro pega no site da concessionária' },
  { k: 'status', label: 'Situação', type: 'select', opts: [['ativa', 'Ativa'], ['cancelada', 'Cancelada']] },
  { k: 'obs', label: 'Observação / protocolo', span: 2 },
];

function quartoOpts(base, aid, aceitaSemQuarto) {
  const a = byId(base, aid);
  if (!a) return [['', 'Escolha o alojamento']];
  const on = staysOn(base, aid);
  const qs = (a.quartos || []).map((q) => {
    const o = on.filter((e) => e.quarto_id === q.id).length;
    const vg = Math.max(1, +q.vagas || 1);
    return [q.id, `${q.nome} · ${o >= vg ? 'ocupado' : vg > 1 ? `${vg - o} vaga(s) livre(s)` : 'livre'}`];
  });
  // Na edição, "Sem quarto" existe para a estadia antiga cujo quarto foi
  // excluído: sem essa opção o select cairia no 1º quarto, e salvar a mudaria de
  // quarto sem ninguém ter pedido.
  if (aceitaSemQuarto) return [['', 'Sem quarto'], ...qs];
  return qs.length ? qs : [['', 'Configure os quartos deste alojamento']];
}

export const stayFields = (base, comSaida) => [
  { k: 'alojamento_id', label: 'Alojamento', type: 'select', opts: () => [['', 'Selecione…'], ...alojOpts(base, comSaida)], req: true },
  {
    k: 'quarto_id', label: 'Quarto', type: 'select', dep: 'alojamento_id', opts: (v) => quartoOpts(base, v.alojamento_id, comSaida), req: !comSaida,
  },
  { k: 'morador', label: 'Morador', req: true, span: 2, ph: 'Nome completo do profissional' },
  { k: 'entrada', label: 'Data de entrada', type: 'date' },
  { k: 'saida_prevista', label: 'Saída prevista', type: 'date', hint: 'Deixe vazio para indeterminado' },
  ...(comSaida ? [{ k: 'saida', label: 'Data de saída (real)', type: 'date' }] : []),
  { k: 'chave', label: 'Status da chave', type: 'select', opts: pares(CHAVE) },
  { k: 'chave_obs', label: 'Observação da chave', span: comSaida ? 1 : 2, ph: 'Ex.: entregue p/ outro morador' },
  { k: 'obs', label: 'Observações', type: 'textarea', span: 2, rows: 2 },
];

export const saidaFields = [
  { k: 'saida', label: 'Data de saída', type: 'date', req: true },
  { k: 'chave', label: 'Status da chave', type: 'select', opts: pares(CHAVE) },
  { k: 'chave_obs', label: 'Observação da chave', span: 2 },
  { k: 'obs', label: 'Observações', type: 'textarea', span: 2, rows: 2 },
];

export const pagamentoFields = (base) => [
  { k: 'alojamento_id', label: 'Alojamento', type: 'select', opts: [['', 'Selecione…'], ...alojOpts(base, true)], req: true },
  { k: 'conta', label: 'Conta', type: 'select', opts: CONTAS, req: true },
  { k: 'competencia', label: 'Mês / ano de referência', type: 'month', req: true },
  { k: 'valor', label: 'Valor (R$)', type: 'money' },
  { k: 'vencimento', label: 'Vencimento da fatura', type: 'date' },
  { k: 'data_pagamento', label: 'Data do pagamento', type: 'date' },
  { k: 'status', label: 'Situação', type: 'select', opts: pares(PAG_ST) },
  { k: 'forma', label: 'Forma de pagamento', type: 'select', opts: ['', ...FORMAS] },
  { k: 'fornecedor', label: 'Fornecedor / prestador', ph: 'Ex.: CEMIG, Claro, eletricista João' },
  { k: 'documento', label: 'Nº da fatura / boleto / NF', ph: 'Ex.: 000123456' },
  { k: 'anexos', label: 'Fatura, boleto ou comprovante', type: 'files', span: 2 },
  { k: 'obs', label: 'Observação', type: 'textarea', span: 2, rows: 2, ph: 'Serviço de manutenção executado, consumo (kWh), protocolo…' },
];

/** Conferência pelo Contas a Pagar: o resultado e, junto, a situação do pagamento. */
export const conferenciaFields = [
  {
    k: 'conferencia_status',
    label: 'Resultado da conferência',
    type: 'select',
    opts: [['conferida', 'Conferida: fatura confere com o lançamento'], ['divergencia', 'Divergência encontrada'], ['pendente', `Deixar ${CONF.pendente.l.toLowerCase()}`]],
  },
  { k: 'status', label: 'Situação do pagamento', type: 'select', opts: pares(PAG_ST) },
  { k: 'data_pagamento', label: 'Data do pagamento', type: 'date' },
  { k: 'forma', label: 'Forma de pagamento', type: 'select', opts: ['', ...FORMAS] },
  {
    k: 'conferencia_obs', label: 'Observação da conferência', type: 'textarea', span: 2, rows: 3, ph: 'Ex.: valor do boleto difere do lançado; fatura de outro mês; aguardando 2ª via', hint: 'Obrigatória quando houver divergência.',
  },
];

export const itemFields = (base) => [
  { k: 'alojamento_id', label: 'Alojamento', type: 'select', opts: [['', 'Selecione…'], ...alojOpts(base, true)], req: true, span: 2 },
  { k: 'produto', label: 'Produto', req: true, span: 2, ph: 'Ex.: Geladeira frost free 375 L' },
  { k: 'quantidade', label: 'Quantidade', type: 'int', min: 1, req: true },
  { k: 'preco_unitario', label: 'Preço unitário (R$)', type: 'money' },
  { k: 'fornecedor', label: 'Fornecedor da compra' },
  { k: 'data_compra', label: 'Data da compra', type: 'date' },
  { k: 'destino', label: 'Destino na devolução', type: 'select', opts: DESTINOS, span: 2 },
  { k: 'obs', label: 'Observação', span: 2, ph: 'Nota fiscal, estado de conservação…' },
];

export const ocorrenciaFields = (base) => [
  { k: 'alojamento_id', label: 'Alojamento', type: 'select', opts: [['', 'Selecione…'], ...alojOpts(base, true)], req: true, span: 2 },
  { k: 'data', label: 'Data', type: 'date', req: true },
  { k: 'tipo', label: 'Tipo', type: 'select', opts: TIPOS_OC },
  { k: 'descricao', label: 'Descrição', type: 'textarea', req: true, span: 2, rows: 4, ph: 'O que aconteceu, quem foi acionado, protocolo…' },
];

/* ===================== motor do formulário ===================== */
export const opcoes = (campo, vals) => (typeof campo.opts === 'function' ? campo.opts(vals) : campo.opts)
  .map((o) => (Array.isArray(o) ? o : [o, o]));

/**
 * Valores que a tela abre. Um <select> sem valor válido mostra a 1ª opção, e é
 * ela que tem de valer ao salvar; por isso a 1ª opção entra já aqui.
 */
export function valoresIniciais(campos, valores = {}) {
  const out = {};
  campos.forEach((c) => {
    if (c.section) return;
    let v = valores[c.k];
    if (v === undefined || v === null) v = c.def ?? '';
    if (c.type === 'select') {
      const ops = opcoes(c, { ...valores, ...out });
      if (!ops.some(([valor]) => String(valor) === String(v))) v = ops[0]?.[0] ?? '';
    }
    if (c.type === 'toggle') v = !!v;
    if ((c.type === 'checks' || c.type === 'files') && !Array.isArray(v)) v = [];
    out[c.k] = v;
  });
  return out;
}

/** O que vai para o banco: número onde é número, texto aparado no resto. */
export function coletar(campos, vals) {
  const out = {};
  campos.forEach((c) => {
    if (c.section) return;
    const v = vals[c.k];
    if (c.type === 'checks' || c.type === 'toggle' || c.type === 'files') out[c.k] = v;
    else if (c.type === 'money' || c.type === 'int') out[c.k] = num(v);
    else out[c.k] = String(v ?? '').trim();
  });
  return out;
}

export const faltando = (campos, coletados) => campos
  .filter((c) => c.req && !c.section && (coletados[c.k] === '' || coletados[c.k] === null || coletados[c.k] === undefined))
  .map((c) => c.label);
