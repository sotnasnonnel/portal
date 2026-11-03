import { normalizar, digitos, partesCompetencia, round2 } from '../../lib/formato.js';

// Apoio da tela Folha do mês: dados de exibição da linha, busca e datas de
// formulário. Sem React, para o fast refresh não reclamar de export misto.

// Mês fechado mostra o cadastro congelado no envelope; mês aberto, o cadastro vivo.
export function pessoaDoEnvelope(env, prestador) {
  const c = env?.cadastro || null;
  const p = prestador || {};
  return {
    id: env?.prestador_id,
    codigo: c?.codigo || p.codigo || '—',
    nome: c?.nome || p.nome || 'Prestador não encontrado',
    empresa: c?.empresa || p.empresa || '',
    email: c?.email ?? p.email ?? '',
    razaoSocial: c?.razaoSocial || p.razao_social || '',
    cnpj: c?.cnpj || p.cnpj || '',
    cpf: c?.cpf || p.cpf || '',
    funcao: c?.funcao || p.funcao || '',
    dataInicio: c?.dataInicio || p.data_inicio || null,
  };
}

/**
 * Quem tem lugar na folha da competência.
 *
 * Espelha a regra que o banco usa ao gerar os envelopes (pj_abrir_competencia):
 * fica quem está ativo e quem foi desligado com data dentro do mês ou depois —
 * esse ainda recebe o proporcional. Sai quem já estava desligado antes do mês
 * começar, inclusive o desligado sem data de término: é o caso dos prestadores
 * que vieram da carga histórica, e é justamente esse pessoal que não deve mais
 * aparecer. Envelope sem cadastro atual fica: sem o prestador não há como
 * julgar, e esconder um pagamento por falta de dado é pior do que mostrar.
 */
export function naFolhaDaCompetencia(prestador, competencia) {
  if (!prestador) return true;
  if (prestador.situacao !== 'desligado') return true;
  return Boolean(prestador.data_fim) && prestador.data_fim >= competencia;
}

export function combinaBusca(linha, termo) {
  const t = normalizar(termo);
  if (!t) return true;
  const p = linha.pessoa;
  const texto = normalizar([p.codigo, p.nome, p.email, p.razaoSocial, p.funcao, p.empresa].join(' '));
  if (texto.includes(t)) return true;
  const d = digitos(termo);
  return d.length >= 3 && (digitos(p.cnpj).includes(d) || digitos(p.cpf).includes(d));
}

export const eventosOrdenados = (env) => (env?.eventos || [])
  .map((e) => ({ ...e, valor: Number(e.valor) || 0, referencia: Number(e.referencia) || 0, valor_original: e.valor_original == null ? null : Number(e.valor_original) }))
  .sort((a, b) => (a.natureza === b.natureza ? (a.ordem ?? 0) - (b.ordem ?? 0) : a.natureza === 'provento' ? -1 : 1));

// timestamptz <-> <input type="datetime-local"> (hora local de quem está usando).
export function paraDatetimeLocal(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function deDatetimeLocal(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Mesma data N meses depois, com o dia limitado ao fim do mês (31/01 -> 28/02).
export function deslocarMeses(isoData, meses) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoData ?? ''));
  if (!m) return '';
  const total = Number(m[1]) * 12 + Number(m[2]) - 1 + meses;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = Math.min(Number(m[3]), ultimo);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Calendário sugerido para uma competência nova: o da anterior, um mês à
// frente; sem anterior, o padrão do protótipo (termos dia 25, NF dia 27 às
// 17h, pagamento dia 3 do mês seguinte).
export function calendarioSugerido(competencia, anterior) {
  const p = partesCompetencia(competencia);
  if (!p) return { envio: '', prazo: '', pagamento: '' };
  const base = `${p.aaaa}-${p.mm}`;
  if (anterior?.data_envio_termos || anterior?.prazo_nf || anterior?.data_pagamento) {
    const prazoLocal = paraDatetimeLocal(anterior.prazo_nf);
    return {
      envio: anterior.data_envio_termos ? deslocarMeses(anterior.data_envio_termos, 1) : `${base}-25`,
      prazo: prazoLocal ? `${deslocarMeses(prazoLocal.slice(0, 10), 1)}T${prazoLocal.slice(11)}` : `${base}-27T17:00`,
      pagamento: anterior.data_pagamento ? deslocarMeses(anterior.data_pagamento, 1) : deslocarMeses(`${base}-03`, 1),
    };
  }
  return { envio: `${base}-25`, prazo: `${base}-27T17:00`, pagamento: deslocarMeses(`${base}-03`, 1) };
}

// Tomador do termo: a empresa do cadastro do prestador (pj_prestadores.empresa)
// decide contra quem a NF sai. Razão social, CNPJ e endereço como estão na
// Receita. Sem empresa reconhecida, fica a Assessoria, que é o padrão do cadastro.
// Espelhado em supabase/functions/send-termo-pj — mudou aqui, muda lá.
export const TOMADORES = {
  'PHD ASSESSORIA': {
    razao: 'PHD ASSESSORIA EM GESTAO LTDA',
    cnpj: '45.420.053/0001-08',
    curto: 'PHD Assessoria',
    endereco: 'Av. Raja Gabáglia, 4343 - Santa Lúcia, Belo Horizonte-MG, 30350-577',
  },
  'PHD ENGENHARIA': {
    razao: 'PHD SOLUCOES EM ENGENHARIA S.A.',
    cnpj: '30.860.911/0001-50',
    curto: 'PHD Engenharia',
    endereco: 'Rua Jurupari, 210, 2º andar - Santa Lúcia, Belo Horizonte-MG, 30350-590',
  },
};

export const tomadorDaEmpresa = (empresa) => TOMADORES[normalizar(empresa)] || TOMADORES['PHD ASSESSORIA'];

// Coligada: a sigla que o RM usa para cada empresa do grupo. Vem da mesma
// `empresa` do cadastro que decide o tomador do termo. Empresa não reconhecida
// fica em branco em vez de cair na Assessoria: numa planilha de conferência,
// célula vazia avisa que falta cadastro; chute silencioso não.
export const COLIGADAS = { 'PHD ASSESSORIA': 'PHDA', 'PHD ENGENHARIA': 'PHDE' };

export const coligadaDaEmpresa = (empresa) => COLIGADAS[normalizar(empresa)] || '';

/**
 * Planilha Coligada / Nome / Função / Salário Bruto da folha em exibição.
 *
 * Recebe as linhas já montadas pela tela, então segue a mesma regra de quem
 * está na folha e o mesmo cadastro (congelado no mês fechado, vivo no aberto).
 * O bruto é o do envelope — o que a pessoa recebe na competência, já com
 * proporcional —, igual à coluna Bruto da grade, e não o valor contratual.
 * Ordena por coligada e nome para PHDA e PHDE saírem agrupados.
 */
export function planilhaColigada(linhas) {
  return (linhas || [])
    .map((l) => ({
      coligada: coligadaDaEmpresa(l.pessoa.empresa),
      nome: l.pessoa.nome,
      funcao: l.pessoa.funcao || '',
      bruto: round2(l.envelope.bruto),
    }))
    .sort((a, b) => a.coligada.localeCompare(b.coligada)
      || normalizar(a.nome).localeCompare(normalizar(b.nome)));
}

export const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

// Destinatários do termo: prestador, cópia do financeiro (se configurado) e contatos extras.
export function copiasDoTermo(config) {
  const copias = [];
  if (config?.copia_financeiro && emailValido(config.email_financeiro)) copias.push(config.email_financeiro.trim());
  (Array.isArray(config?.contatos_extras) ? config.contatos_extras : []).forEach((c) => {
    if (emailValido(c?.email) && !copias.includes(c.email.trim())) copias.push(c.email.trim());
  });
  return copias;
}
