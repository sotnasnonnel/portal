// Regras do módulo TI, sem React nem Supabase, para dar para testar.
import { TERMO_ASSINADO } from '../../../config/ti.js';

export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const uniq = (lista) => [...new Set(lista.filter((v) => v != null && v !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const ehEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? '').trim());
export const emailChave = (s) => String(s ?? '').trim().toLowerCase();

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Valor do banco (numeric chega como string pelo PostgREST) para número. */
export const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Está com alguém de verdade: em uso e com e-mail no responsável. */
export const emUso = (a) => a.situacao === 'Em utilização' && ehEmail(a.responsavel);

/**
 * Pendência de termo: o equipamento está com alguém e o termo ainda não voltou
 * assinado. É a mesma conta do app antigo (219 equipamentos, 140 responsáveis
 * na carga da planilha), mais a saída quando o termo é marcado como assinado.
 */
export const pendenteTermo = (a) => emUso(a) && a.situacao_termo !== TERMO_ASSINADO;

/** Números do painel: quantidade e mensalidade, no total e por fornecedor. */
export function resumoPainel(ativos) {
  const porFornecedor = new Map();
  let mensal = 0;
  for (const a of ativos) {
    const f = a.fornecedor || 'Sem fornecedor';
    const v = num(a.valor_mensal) || 0;
    const atual = porFornecedor.get(f) || { fornecedor: f, quantidade: 0, mensal: 0 };
    atual.quantidade += 1;
    atual.mensal += v;
    porFornecedor.set(f, atual);
    mensal += v;
  }
  const pend = ativos.filter(pendenteTermo);
  return {
    total: ativos.length,
    mensal: Math.round(mensal * 100) / 100,
    fornecedores: [...porFornecedor.values()]
      .map((f) => ({ ...f, mensal: Math.round(f.mensal * 100) / 100 }))
      .sort((a, b) => b.quantidade - a.quantidade),
    emUso: ativos.filter(emUso).length,
    pendentes: pend.length,
    responsaveisPendentes: new Set(pend.map((a) => emailChave(a.responsavel))).size,
  };
}

/** Contagem por um campo, da maior para a menor. */
export function contarPor(ativos, campo) {
  const m = new Map();
  for (const a of ativos) {
    const k = a[campo] || 'Não informado';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v || a.l.localeCompare(b.l, 'pt-BR'));
}

/**
 * Resumo por modelo: quantos de cada, com a configuração mais comum do grupo e
 * quanto o grupo custa por mês. Sem modelo, cai em "Modelo não informado".
 */
export function agruparPorModelo(ativos) {
  const grupos = new Map();
  for (const a of ativos) {
    const modelo = (a.modelo || '').trim() || 'Modelo não informado';
    const g = grupos.get(modelo) || {
      modelo, quantidade: 0, mensal: 0, configs: new Map(), tipos: new Set(), fornecedores: new Set(), emUso: 0,
    };
    g.quantidade += 1;
    g.mensal += num(a.valor_mensal) || 0;
    if (a.configuracao) g.configs.set(a.configuracao, (g.configs.get(a.configuracao) || 0) + 1);
    if (a.tipo) g.tipos.add(a.tipo);
    if (a.fornecedor) g.fornecedores.add(a.fornecedor);
    if (emUso(a)) g.emUso += 1;
    grupos.set(modelo, g);
  }
  return [...grupos.values()].map((g) => ({
    modelo: g.modelo,
    quantidade: g.quantidade,
    emUso: g.emUso,
    mensal: Math.round(g.mensal * 100) / 100,
    configuracao: [...g.configs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    tipos: [...g.tipos].sort(),
    fornecedores: [...g.fornecedores].sort(),
  })).sort((a, b) => b.quantidade - a.quantidade || a.modelo.localeCompare(b.modelo, 'pt-BR'));
}

/**
 * Resumo por pessoa: uma linha para cada pessoa e modelo que ela tem em uso.
 * O que não está com ninguém (estoque, recolhido, sem e-mail) fica numa linha
 * por modelo com `email: null`. A ordem por nome fica com a tela, que conhece
 * os nomes.
 */
export function resumoPorPessoa(ativos) {
  const porPessoa = new Map();
  for (const a of ativos) {
    const k = emUso(a) ? emailChave(a.responsavel) : '';
    if (!porPessoa.has(k)) porPessoa.set(k, []);
    porPessoa.get(k).push(a);
  }
  return [...porPessoa.entries()].flatMap(([email, lista]) => agruparPorModelo(lista)
    .map((g) => ({ ...g, email: email || null })));
}

/**
 * Pessoas da tela de termos: todo colaborador ativo, mais quem aparece como
 * responsável de algum equipamento sem estar no cadastro (ex-colaborador,
 * e-mail digitado diferente). Cada uma vem com os equipamentos em uso e quantos
 * estão com termo pendente.
 */
export function pessoasComAtivos(ativos, pessoas) {
  const porEmail = new Map();
  for (const p of pessoas) {
    if (!p.email) continue;
    porEmail.set(emailChave(p.email), {
      email: emailChave(p.email), nome: p.nome || p.email, vinculo: p.vinculo || '', data_admissao: p.data_admissao || null,
      ativo: p.ativo !== false, cadastrado: true, ativos: [], pendentes: 0,
    });
  }
  for (const a of ativos) {
    if (!emUso(a)) continue;
    const k = emailChave(a.responsavel);
    if (!porEmail.has(k)) {
      porEmail.set(k, {
        email: k, nome: k, vinculo: '', data_admissao: null, ativo: true, cadastrado: false, ativos: [], pendentes: 0,
      });
    }
    const p = porEmail.get(k);
    p.ativos.push(a);
    if (pendenteTermo(a)) p.pendentes += 1;
  }
  return [...porEmail.values()]
    // Desligado sem nada na mão não tem o que assinar nem devolver.
    .filter((p) => p.ativo || p.ativos.length)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Situação do termo de UMA pessoa (item de pessoasComAtivos):
 *  - 'sem_equipamento': nada em uso com ela, não há o que aceitar;
 *  - 'pendente': algum equipamento em uso sem termo aceito;
 *  - 'aceito': tudo coberto. `aceitoEm` é a assinatura mais recente.
 */
export function situacaoTermoPessoa(p) {
  if (!p.ativos.length) return { situacao: 'sem_equipamento', aceitoEm: null };
  if (p.pendentes > 0) return { situacao: 'pendente', aceitoEm: null };
  const datas = p.ativos.map((a) => a.data_assinatura_termo).filter(Boolean).sort();
  return { situacao: 'aceito', aceitoEm: datas[datas.length - 1] || null };
}

/**
 * Lista da tela "Termo de responsabilidade": quem tem equipamento em uso, com
 * a situação do termo. Pendentes primeiro, depois por nome.
 */
export function listaTermos(ativos, pessoas) {
  return pessoasComAtivos(ativos, pessoas)
    .filter((p) => p.ativos.length)
    .map((p) => ({ ...p, ...situacaoTermoPessoa(p) }))
    .sort((a, b) => (a.situacao === b.situacao ? 0 : a.situacao === 'pendente' ? -1 : 1)
      || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Situações de quem está livre para ir para alguém (o "estoque" da TI). */
export const SITUACOES_DISPONIVEIS = ['Aguardando atribuição', 'Em preparação', 'Parado'];
export const disponivel = (a) => SITUACOES_DISPONIVEIS.includes(a.situacao);

/**
 * Quem está no cadastro, ativo, e sem nenhum equipamento em uso. Com `desde`
 * (ISO), só quem foi admitido a partir dessa data: é a fila de quem acabou de
 * entrar e precisa de equipamento. Mais recentes primeiro; sem data, no fim.
 */
export function pessoasSemEquipamento(ativos, pessoas, { desde = null } = {}) {
  const comEquip = new Set(ativos.filter(emUso).map((a) => emailChave(a.responsavel)));
  return pessoas
    .filter((p) => p.email && p.ativo !== false && !comEquip.has(emailChave(p.email)))
    .filter((p) => !desde || (p.data_admissao && p.data_admissao >= desde))
    .map((p) => ({ ...p, email: emailChave(p.email) }))
    .sort((a, b) => String(b.data_admissao || '').localeCompare(String(a.data_admissao || ''))
      || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

/** Data ISO de `dias` atrás (a partir de hoje, no fuso do navegador). */
export function diasAtras(dias, hoje = new Date()) {
  const d = new Date(hoje);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Busca livre num ativo: série, responsável, modelo, descrição, contrato, NF. */
export function casaBusca(a, q) {
  if (!q) return true;
  return norm([
    a.numero_serie, a.responsavel, a.modelo, a.descricao, a.tipo, a.fornecedor, a.contrato, a.nfe_remessa, a.observacoes,
  ].join(' ')).includes(norm(q));
}

/** Máscara de CPF (só formata; não valida dígito). */
export function formatarCpf(v) {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** Máscara de CNPJ (só formata). */
export function formatarCnpj(v) {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Dígito verificador do CPF. */
export function cpfValido(v) {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/**
 * Quem só consulta não movimenta: pede a troca pelo chamado do Atendimento
 * (serviço ti/troca-equipamentos). Com o ativo, o chamado já abre com o número
 * de série e o tipo (o Atendimento só aceita tipo que esteja nas opções dele).
 */
export const ROTA_TROCA_EQUIPAMENTO = '/administrativo/novo/ti/troca-equipamentos';
export function linkTrocaEquipamento(ativo) {
  if (!ativo) return ROTA_TROCA_EQUIPAMENTO;
  const p = new URLSearchParams();
  if (ativo.numero_serie) p.set('numero_serie', ativo.numero_serie);
  if (ativo.tipo) p.set('tipo', ativo.tipo);
  const q = p.toString();
  return q ? `${ROTA_TROCA_EQUIPAMENTO}?${q}` : ROTA_TROCA_EQUIPAMENTO;
}
