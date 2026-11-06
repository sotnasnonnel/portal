// Formulários da Frota, dirigidos por esquema como no protótipo: `sec` abre uma
// seção; `t` é o tipo do campo (texto quando omitido); `list` é um datalist de
// listasDoForm; `upper` guarda em caixa alta. Sem React, sem Supabase.
import {
  OC_STATUS, TIPOS_MAN, CAT_MULTA, CAT_AVARIA, parseBR, uniq, isNum,
} from './regras.js';
import { FAT_FORMAS, FAT_STATUS, FAT_TIPOS } from './faturas.js';

export const fmtDec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SIM_NAO = ['Sim', 'Não'];

export const SCHEMAS = {
  veiculos: [
    { sec: 'Identificação' },
    { k: 'placa', l: 'Placa', upper: true, hint: 'Deixe em branco enquanto a retirada estiver pendente' },
    { k: 'modelo', l: 'Modelo', upper: true },
    { k: 'cor', l: 'Cor' },
    { k: 'status', l: 'Status', t: 'select', opts: ['Ativo', 'Reservado', 'Inativo'], req: true },
    { sec: 'Contrato de locação' },
    { k: 'locadora', l: 'Locadora', list: 'locadoras', req: true },
    { k: 'grupo', l: 'Grupo' },
    { k: 'codigo_reserva', l: 'Código de reserva' },
    { k: 'contrato', l: 'Nº contrato' },
    { k: 'tipo_contrato', l: 'Tipo de contrato' },
    { k: 'retirada', l: 'Data de retirada', t: 'date' },
    { k: 'devolucao', l: 'Data de devolução', t: 'date' },
    { k: 'km_contratado', l: 'Km contratado por mês', t: 'int' },
    { k: 'custo_mensal', l: 'Locação (R$/mês)', t: 'money' },
    { k: 'valor_km_excedente', l: 'R$ por km excedente', t: 'money' },
    { k: 'proxima_fatura', l: 'Próxima fatura', t: 'date' },
    { sec: 'Alocação' },
    { k: 'condutor', l: 'Condutor principal', list: 'condutores' },
    { k: 'ct', l: 'CT / Centro de custo', list: 'cts' },
    { k: 'custo_resp', l: 'Custo por conta de', t: 'select', opts: ['PHD', 'Cliente'] },
    { k: 'cidade', l: 'Cidade de atuação' },
    { sec: 'Equipamentos e combustível' },
    { k: 'gps', l: 'GPS instalado', t: 'select', opts: ['Sim', 'Não', 'Retirado'] },
    { k: 'gps_numero', l: 'Nº do GPS' },
    { k: 'gps_valor', l: 'Mensalidade GPS', t: 'money' },
    { k: 'adesivo', l: 'Adesivo', t: 'select', opts: SIM_NAO },
    { k: 'cartao_combustivel', l: 'Cartão combustível' },
    { k: 'recarga_mensal', l: 'Recarga mensal (limite)', t: 'money' },
    { sec: 'Quilometragem e revisão' },
    { k: 'km_atual', l: 'Km atual', t: 'int' },
    { k: 'km_ultima_manutencao', l: 'Km da última manutenção', t: 'int' },
    { k: 'data_ultima_revisao', l: 'Data da última revisão', t: 'date' },
    { k: 'data_proxima_revisao', l: 'Data da próxima revisão', t: 'date' },
    { sec: 'Observações' },
    { k: 'obs', l: 'Pontos de atenção', t: 'area', full: true },
  ],
  mensal: [
    { sec: 'Competência e veículo' },
    { k: 'competencia', l: 'Competência', t: 'month', req: true },
    { k: 'status', l: 'Status', t: 'select', opts: ['Ativo', 'Inativo'], req: true },
    { k: 'placa', l: 'Placa', upper: true, list: 'placas' },
    { k: 'condutor', l: 'Condutor', list: 'condutores', req: true },
    { k: 'modelo', l: 'Modelo', upper: true },
    { k: 'locadora', l: 'Locadora', list: 'locadoras' },
    { k: 'grupo', l: 'Grupo' },
    { k: 'codigo_reserva', l: 'Código de reserva' },
    { k: 'contrato', l: 'Nº contrato' },
    { k: 'ct', l: 'CT / Centro de custo', list: 'cts' },
    { k: 'custo_resp', l: 'Custo por conta de', t: 'select', opts: ['PHD', 'Cliente'] },
    { k: 'retirada', l: 'Retirada', t: 'date' },
    { k: 'devolucao', l: 'Devolução', t: 'date' },
    { sec: 'Custos do mês' },
    { k: 'custo_locacao', l: 'Locação', t: 'money' },
    { k: 'gps_valor', l: 'GPS / telemetria', t: 'money' },
    { k: 'gps_numero', l: 'Nº GPS' },
    { k: 'multas', l: 'Multas', t: 'money' },
    { k: 'avarias', l: 'Avarias', t: 'money' },
    { k: 'laudos', l: 'Laudos', t: 'money' },
    { k: 'adesivo', l: 'Adesivo', t: 'money' },
    { k: 'frete', l: 'Frete', t: 'money' },
    { sec: 'Combustível' },
    { k: 'recarga_mensal', l: 'Recarga mensal (limite)', t: 'money' },
    { k: 'saldo_remanescente', l: 'Saldo remanescente', t: 'money', hint: 'Saldo do cartão no fechamento' },
    { k: 'recarga_mes', l: 'Valor a recarregar (consumido)', t: 'money', hint: 'Em branco = limite − saldo' },
    { sec: 'Quilometragem' },
    { k: 'km_contratado', l: 'Km contratado', t: 'int' },
    { k: 'km_atual', l: 'Km atual (hodômetro)', t: 'int' },
    { k: 'km_ultima_manutencao', l: 'Km última manutenção', t: 'int' },
    { k: 'data_ultima_revisao', l: 'Última revisão', t: 'date' },
    { k: 'data_proxima_revisao', l: 'Próxima revisão', t: 'date' },
    { sec: 'Observações' },
    { k: 'obs', l: 'Pontos de atenção', t: 'area', full: true },
  ],
  ocorrencias: [
    { sec: 'Ocorrência' },
    { k: 'tipo', l: 'Tipo', t: 'select', opts: ['Multa', 'Avaria'], req: true },
    { k: 'data', l: 'Data da ocorrência', t: 'date', req: true },
    { k: 'categoria', l: 'Tipo de infração / dano', list: 'categorias', req: true },
    { k: 'gravidade', l: 'Gravidade', t: 'select', opts: ['Leve', 'Média', 'Grave', 'Gravíssima', 'Alta'] },
    { k: 'placa', l: 'Placa', upper: true, list: 'placas', req: true },
    { k: 'modelo', l: 'Veículo', upper: true },
    { k: 'condutor', l: 'Condutor', list: 'condutores', req: true },
    { k: 'gestor', l: 'Gestor PHD' },
    { k: 'locadora', l: 'Locadora', list: 'locadoras' },
    { k: 'cidade', l: 'Cidade / local' },
    { k: 'descricao', l: 'Descrição', t: 'area', full: true },
    { sec: 'Valores e pagamento' },
    { k: 'valor', l: 'Valor da multa / avaria', t: 'money' },
    { k: 'status', l: 'Status', t: 'select', opts: OC_STATUS, req: true },
    { k: 'numero_fatura', l: 'Nº fatura' },
    { k: 'contrato', l: 'Nº contrato' },
    { k: 'valor_fatura', l: 'Valor da fatura', t: 'money' },
    { k: 'vencimento', l: 'Vencimento', t: 'date' },
    { k: 'data_pagamento', l: 'Data de pagamento', t: 'date' },
    { k: 'forma_pagamento', l: 'Forma de pagamento', t: 'select', opts: ['Boleto', 'Fatura da locadora', 'Cartão', 'PIX', 'Outro'] },
    { k: 'responsavel_pagamento', l: 'Quem paga', t: 'select', opts: ['PHD', 'Profissional', 'Cliente', 'Locadora'] },
    { k: 'negociacao', l: 'Houve negociação?', t: 'select', opts: SIM_NAO },
    { k: 'desconto_condutor', l: 'Descontar do condutor?', t: 'select', opts: SIM_NAO },
    { k: 'forma_desconto', l: 'Como será descontado', list: 'formasDesc' },
    { k: 'financeiro_informado', l: 'Financeiro informado?', t: 'select', opts: SIM_NAO },
    { k: 'comprovante_enviado', l: 'Comprovante enviado?', t: 'select', opts: SIM_NAO },
    { sec: 'Registro e documentos' },
    { k: 'data_phd_informada', l: 'PHD informada em', t: 'date' },
    { k: 'data_condutor_informado', l: 'Condutor informado em', t: 'date' },
    { k: 'bo_registrado', l: 'BO registrado?', t: 'select', opts: SIM_NAO },
    { k: 'numero_bo', l: 'Nº BO' },
    { k: 'laudo_recebido', l: 'Laudo recebido?', t: 'select', opts: SIM_NAO },
    { k: 'status_devolucao', l: 'Devolução do veículo', t: 'select', opts: ['Pendente', 'Devolvido', 'Não se aplica'] },
    { k: 'data_devolucao', l: 'Data da devolução', t: 'date' },
    { k: 'chamado_phd', l: 'Nº chamado PHD' },
    { k: 'anexos', l: 'Anexos (BO, notificação, laudo, fotos, comprovantes)', t: 'files', multi: true, what: 'documento', docTypes: ['Notificação', 'Boletim de ocorrência', 'Laudo', 'Fotos', 'Fatura / boleto', 'Comprovante de pagamento', 'Outro'] },
    { k: 'obs', l: 'Observações', t: 'area', full: true },
  ],
  condutores: [
    { sec: 'Dados do condutor' },
    { k: 'nome', l: 'Nome completo', req: true, full: true },
    { k: 'situacao', l: 'Situação', t: 'select', opts: ['Ativo', 'Inativo', 'Desligado'], req: true },
    { k: 'email', l: 'E-mail corporativo' },
    { k: 'ct', l: 'CT / Centro de custo', list: 'cts' },
    { k: 'gestor', l: 'Gestor responsável' },
    { sec: 'CNH' },
    { k: 'cnh_categoria', l: 'Categoria', t: 'select', opts: ['A', 'B', 'AB', 'C', 'D', 'E', 'AC', 'AD', 'AE'] },
    { k: 'cnh_validade', l: 'Validade da CNH', t: 'date' },
    { k: 'cnh_arquivo', l: 'Cópia da CNH', t: 'files', what: 'CNH' },
    { sec: 'Termo de responsabilidade' },
    { k: 'termo_assinatura', l: 'Data de assinatura', t: 'date' },
    { k: 'termo_validade', l: 'Válido até', t: 'date', hint: 'Em branco = assinatura + validade padrão' },
    { k: 'termo_placa', l: 'Veículo do termo (placa)', upper: true, list: 'placas' },
    { k: 'termo_arquivo', l: 'Termo assinado (PDF)', t: 'files', what: 'termo' },
    { sec: 'Observações' },
    { k: 'obs', l: 'Observações', t: 'area', full: true },
  ],
  manutencoes: [
    { sec: 'Serviço' },
    { k: 'placa', l: 'Placa', upper: true, list: 'placas', req: true },
    { k: 'data', l: 'Data', t: 'date', req: true },
    { k: 'tipo', l: 'Serviço', t: 'select', opts: TIPOS_MAN, req: true },
    { k: 'km', l: 'Km no serviço', t: 'int' },
    { k: 'local', l: 'Oficina / local' },
    { k: 'protocolo', l: 'Protocolo de agendamento' },
    { k: 'valor', l: 'Valor', t: 'money' },
    { k: 'condutor', l: 'Condutor', list: 'condutores' },
    { k: 'proxima_data', l: 'Próxima revisão prevista', t: 'date', hint: 'Atualiza a data no cadastro do veículo' },
    { k: 'descricao', l: 'Descrição', t: 'area', full: true },
    { k: 'anexos', l: 'Anexos (nota fiscal, checklist, protocolo)', t: 'files', multi: true, what: 'documento', docTypes: ['Nota fiscal', 'Checklist', 'Protocolo', 'Fotos', 'Outro'] },
  ],
  // `veic`: só veículo ativo. Conferido por/em não aparecem: o banco grava.
  faturas: [
    { sec: 'Veículo' },
    { k: 'placa', l: 'Veículo (somente ativos)', t: 'veic', req: true, full: true },
    { k: 'locadora', l: 'Locadora', list: 'locadoras' },
    { k: 'contrato', l: 'Nº contrato' },
    { k: 'condutor', l: 'Condutor', list: 'condutores' },
    { k: 'ct', l: 'CT / Centro de custo', list: 'cts' },
    { k: 'custo_resp', l: 'Custo por conta de', t: 'select', opts: ['PHD', 'Cliente'] },
    { sec: 'Fatura' },
    { k: 'competencia', l: 'Mês de referência', t: 'month', req: true },
    { k: 'tipo', l: 'Tipo de cobrança', t: 'select', opts: FAT_TIPOS, req: true },
    { k: 'numero_fatura', l: 'Nº da fatura' },
    { k: 'emissao', l: 'Data de emissão', t: 'date' },
    { k: 'vencimento', l: 'Data de vencimento', t: 'date', req: true },
    { k: 'valor', l: 'Valor da fatura', t: 'money', req: true },
    { k: 'valor_previsto', l: 'Valor previsto', t: 'money', hint: 'Vem do controle mensal do veículo; ajuste se necessário' },
    { k: 'forma_pagamento', l: 'Forma de pagamento', t: 'select', opts: FAT_FORMAS },
    { k: 'envio_financeiro', l: 'Enviada ao Financeiro em', t: 'date' },
    { k: 'linha_digitavel', l: 'Linha digitável do boleto / chave PIX', full: true },
    { k: 'anexos', l: 'Documentos (fatura, boleto, nota fiscal, comprovante)', t: 'files', multi: true, what: 'documento', docTypes: ['Fatura', 'Boleto', 'Nota fiscal', 'Comprovante de pagamento', 'Outro'] },
    { sec: 'Conferência — Contas a Pagar' },
    { k: 'status', l: 'Situação', t: 'select', opts: FAT_STATUS, req: true },
    { k: 'data_pagamento', l: 'Data de pagamento', t: 'date', hint: 'Em branco ao marcar Paga = hoje' },
    { k: 'obs_conferencia', l: 'Observação da conferência', t: 'area', full: true, hint: 'Obrigatória quando houver divergência' },
    { sec: 'Observações' },
    { k: 'obs', l: 'Observações', t: 'area', full: true },
  ],
};

export const COL_NAME = {
  veiculos: 'veículo', mensal: 'lançamento', ocorrencias: 'ocorrência', condutores: 'condutor', manutencoes: 'manutenção', faturas: 'fatura',
};
export const FEM = { ocorrencias: true, manutencoes: true, faturas: true };

export const camposDe = (col) => SCHEMAS[col].filter((f) => f.k);

/** Sugestões dos datalists: o que a base já tem, mais o começo do protótipo. */
export const listasDoForm = (dados) => ({
  locadoras: uniq(['Movida', 'Versa', 'Localiza', 'Unidas', 'PHD', ...dados.veiculos.map((v) => v.locadora)]),
  condutores: uniq(dados.condutores.map((c) => c.nome)),
  cts: uniq([...dados.veiculos.map((v) => v.ct), ...dados.mensal.map((m) => m.ct)]),
  placas: uniq(dados.veiculos.map((v) => v.placa)),
  categorias: uniq([...CAT_MULTA, ...CAT_AVARIA, ...dados.ocorrencias.map((o) => o.categoria)]),
  formasDesc: ['Retirada mensal', 'Folha de pagamento', 'Parcelado em folha', 'Pagamento direto'],
});

/** Valor do registro -> texto do input. Arquivo fica fora: não é texto. */
export function textosDoRegistro(col, doc) {
  const out = {};
  for (const f of camposDe(col)) {
    if (f.t === 'files') continue;
    const v = doc?.[f.k];
    if (f.t === 'money') out[f.k] = isNum(v) ? fmtDec.format(v) : '';
    else if (f.t === 'int') out[f.k] = isNum(v) ? String(v) : '';
    else out[f.k] = v == null ? '' : String(v);
  }
  return out;
}

/** Texto do input -> valor da coluna. Vazio vira null. */
export function valoresDoForm(col, textos) {
  const out = {};
  for (const f of camposDe(col)) {
    if (f.t === 'files') continue;
    let v = String(textos[f.k] ?? '').trim();
    if (f.t === 'money') v = parseBR(v);
    else if (f.t === 'int') {
      v = parseBR(v);
      v = v == null ? null : Math.round(v);
    } else if (f.upper) {
      v = v.toUpperCase().replace(f.k === 'placa' || f.k === 'termo_placa' ? /[^A-Z0-9]/g : /\s+$/g, '');
    }
    out[f.k] = v === '' || v == null ? null : v;
  }
  return out;
}

/** Rótulos dos obrigatórios que faltam. */
export const faltando = (col, vals) => camposDe(col)
  .filter((f) => f.req && (vals[f.k] == null || vals[f.k] === ''));

/** Título do registro, para formulário e confirmação de exclusão. */
export function tituloDe(col, d, compLabel, fmtDate) {
  if (col === 'mensal') return `${compLabel(d.competencia)} · ${d.placa || 'sem placa'} · ${d.condutor || ''}`;
  if (col === 'ocorrencias') return `${d.tipo || ''} · ${d.placa || ''} · ${fmtDate(d.data)}`;
  if (col === 'manutencoes') return `${d.placa || ''} · ${d.tipo || ''} · ${fmtDate(d.data)}`;
  if (col === 'veiculos') return `${d.placa || 'Retirada pendente'} · ${d.modelo || ''}`;
  if (col === 'condutores') return d.nome;
  if (col === 'faturas') return `${d.placa || ''} · ${compLabel(d.competencia)} · ${d.numero_fatura ? `Nº ${d.numero_fatura}` : 'sem nº'}`;
  return '';
}

/** Paths dos anexos de um registro, para limpar o bucket ao remover. */
export const pathsDosAnexos = (col, doc) => SCHEMAS[col]
  .filter((f) => f.t === 'files')
  .flatMap((f) => {
    const d = doc?.[f.k];
    if (d == null) return [];
    return Array.isArray(d) ? d : [d];
  })
  .map((a) => a.path)
  .filter(Boolean);
