import {
  FORNECEDORES, SITUACOES, SITUACOES_TERMO, TIPOS,
} from '../../../config/ti.js';

// Campos do ativo, na ordem da ficha e do formulário. `t`: text | email | date |
// money | select | area.
//   `opcoes`  -> lista suspensa FECHADA (select).
//   `lista`   -> lista suspensa com "Outro…": as opções são `base` mais os
//                valores que já existem na base (ver opcoesDoCampo).
//   `pessoas` -> lista suspensa de colaboradores (nome — e-mail).
//   `ph`      -> exemplo dentro do campo vazio (placeholder).
//   `dica`    -> texto de ajuda sob o campo, no formulário.
export const SECOES_ATIVO = [
  {
    titulo: 'Identificação',
    campos: [
      {
        k: 'numero_serie', l: 'Número de série', obrigatorio: true, ph: 'Ex.: 5CD1234XYZ',
      },
      { k: 'fornecedor', l: 'Fornecedor', lista: true, base: FORNECEDORES },
      { k: 'tipo', l: 'Tipo de ativo', lista: true, base: TIPOS },
      { k: 'modelo', l: 'Modelo', lista: true },
      { k: 'descricao', l: 'Descrição', full: true },
      { k: 'configuracao', l: 'Configuração', full: true },
      { k: 'software', l: 'Software', lista: true },
    ],
  },
  {
    titulo: 'Uso',
    campos: [
      {
        k: 'responsavel', l: 'Responsável atual (e-mail)', t: 'email', pessoas: true,
        dica: 'Trocar aqui não grava histórico nem zera o termo. Para passar o equipamento a outra pessoa, use Movimentar.',
      },
      { k: 'situacao', l: 'Situação', t: 'select', opcoes: SITUACOES },
      { k: 'cidade', l: 'Cidade / local', lista: true },
      {
        k: 'ultima_movimentacao', l: 'Última movimentação', t: 'date', dica: 'Movimentar atualiza esta data sozinho.',
      },
      { k: 'observacoes', l: 'Observações', t: 'area', full: true },
    ],
  },
  {
    titulo: 'Contrato',
    campos: [
      { k: 'contrato', l: 'Número do contrato', lista: true },
      {
        k: 'cnpj', l: 'CNPJ', lista: true, ph: '00.000.000/0000-00',
      },
      { k: 'inicio_contrato', l: 'Início do contrato', t: 'date' },
      { k: 'vencimento_contrato', l: 'Vencimento do contrato', t: 'date' },
      {
        k: 'valor_mensal', l: 'Valor mensal', t: 'money', ph: '0,00',
      },
      { k: 'nfe_remessa', l: 'NFe remessa' },
    ],
  },
  {
    titulo: 'Termo de responsabilidade',
    campos: [
      {
        k: 'situacao_termo', l: 'Situação do termo', t: 'select', opcoes: SITUACOES_TERMO,
        dica: 'A própria pessoa aceita o termo em Termos; ao aceitar, fica Assinado.',
      },
      {
        k: 'link_termo', l: 'Link do termo', ph: 'https://…',
      },
      { k: 'data_envio_termo', l: 'Data de envio do termo', t: 'date' },
      { k: 'data_assinatura_termo', l: 'Data de assinatura do termo', t: 'date' },
    ],
  },
  {
    titulo: 'Base do fornecedor',
    campos: [
      { k: 'responsavel_base', l: 'Responsável na base', pessoas: true },
      { k: 'situacao_base', l: 'Situação na base', t: 'select', opcoes: SITUACOES },
    ],
  },
];

export const CAMPOS_ATIVO = SECOES_ATIVO.flatMap((s) => s.campos);

const ordenar = (lista) => [...new Set(lista.filter((v) => v != null && String(v).trim() !== ''))]
  .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

/** Opções de um campo `lista`: a base fixa mais o que já existe nos ativos. */
export function opcoesDoCampo(ativos, campo) {
  return ordenar([...(campo.base || []), ...ativos.map((a) => a[campo.k])]);
}

/**
 * Opções de pessoa: colaboradores ativos (nome — e-mail) mais quem aparece como
 * responsável sem estar no cadastro, para o valor atual não sumir da lista.
 */
export function opcoesDePessoas(pessoas, ativos = [], campos = ['responsavel']) {
  const porEmail = new Map();
  pessoas.filter((p) => p.ativo !== false && p.email)
    .forEach((p) => porEmail.set(p.email.toLowerCase(), { v: p.email.toLowerCase(), l: `${p.nome} — ${p.email.toLowerCase()}` }));
  ativos.forEach((a) => campos.forEach((k) => {
    const e = String(a[k] || '').trim().toLowerCase();
    if (e.includes('@') && !porEmail.has(e)) porEmail.set(e, { v: e, l: `${e} (fora do cadastro)` });
  }));
  return [...porEmail.values()].sort((a, b) => a.l.localeCompare(b.l, 'pt-BR'));
}

/** Rascunho do formulário -> linha do banco. Vazio vira null. */
export function paraBanco(rascunho) {
  const out = {};
  for (const c of CAMPOS_ATIVO) {
    let v = rascunho[c.k];
    if (typeof v === 'string') v = v.trim();
    if (v === '' || v === undefined) v = null;
    if (v != null && c.t === 'money') {
      const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
      v = Number.isFinite(n) ? n : null;
    }
    if (v != null && c.t === 'email') v = String(v).toLowerCase();
    if (v != null && c.k === 'numero_serie') v = String(v).toUpperCase();
    out[c.k] = v;
  }
  return out;
}

/** Linha do banco -> rascunho (valor monetário no formato brasileiro). */
export function paraRascunho(ativo = {}) {
  const r = {};
  for (const c of CAMPOS_ATIVO) {
    const v = ativo[c.k];
    if (v == null) r[c.k] = '';
    else if (c.t === 'money') r[c.k] = Number(v).toFixed(2).replace('.', ',');
    else if (c.t === 'date') r[c.k] = String(v).slice(0, 10);
    else r[c.k] = String(v);
  }
  return r;
}
