import { normalizar, digitos, partesCompetencia } from '../../lib/formato.js';

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

// Tomador do termo. Todo prestador fatura contra a PHD Assessoria, inclusive
// quem está marcado como PHD Engenharia no cadastro: não há filial nem CNPJ
// separado para a Engenharia (decisão de 16/09/2026). A empresa do cadastro
// segue valendo só como classificação nos relatórios.
// Espelhado em supabase/functions/send-termo-pj — mudou aqui, muda lá.
export const TOMADOR = { razao: 'PHD ASSESSORIA EM GESTAO LTDA', cnpj: '45.420.053/0001-08', curto: 'PHD Assessoria' };

export const tomadorDaEmpresa = () => TOMADOR;

export const ENDERECO_TOMADOR = 'Av. Raja Gabáglia, 4343 - Santa Lúcia, Belo Horizonte-MG, 30350-577';

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
