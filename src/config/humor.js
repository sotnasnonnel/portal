// Humor do dia — cada pessoa marca como está, com comentário opcional.
//
// Pedido do Lucas Ferraz (30/09/2026), trazendo o que a Feedz tinha. Nasceu só
// agregado; em 02/10/2026, a pedido do RH, o RH passou a ver a resposta e o
// comentário de cada pessoa (supabase_migration_humor_individual.sql). O que
// segue valendo:
//   - o gestor vê a equipe SÓ em números, e o banco esconde a distribuição dos
//     dias com menos de MINIMO_ANONIMATO respostas;
//   - o que foi respondido antes da mudança continua só nos números: a tela
//     dizia "Só você vê a sua resposta".

import { isAusenciaRh } from './ausenciaProgramada.js';

export const MINIMO_ANONIMATO = 3;
export const COMENTARIO_MAX = 500;   // mesmo limite do banco

// Escala divergente: dois vermelhos, um cinza neutro no meio, dois azuis.
// Validada com o validate_palette da skill de dataviz (vizinhos ΔE ≥ 18, com
// daltonismo inclusive); o cinza é neutro de propósito. O verde e o vermelho de
// STATUS do portal ficam de fora: humor não é alerta.
// O desenho de cada nível é a CarinhaHumor (components/UI), com esta cor.
export const HUMORES = [
  { valor: 1, chave: 'muito_mal', rotulo: 'Muito mal', cor: '#a8201a' },
  { valor: 2, chave: 'triste', rotulo: 'Triste', cor: '#e8605a' },
  { valor: 3, chave: 'ok', rotulo: 'Ok', cor: '#d9d8d2' },
  { valor: 4, chave: 'feliz', rotulo: 'Feliz', cor: '#5a9be8' },
  { valor: 5, chave: 'muito_feliz', rotulo: 'Muito feliz', cor: '#1a4f9c' },
];

export const humorPorValor = (v) => HUMORES.find((h) => h.valor === Number(v)) || null;

/** Quem vê o resumo: gestão (a equipe) e o RH (a empresa). */
export const veResumoHumor = (user) => ['gestor', 'coordenador', 'admin'].includes(user?.perfil)
  || isAusenciaRh(user);
export const veResumoEmpresa = (user) => isAusenciaRh(user);
/** Resposta e comentário por pessoa: só o RH. Espelha humor_respostas no banco. */
export const veRespostasHumor = (user) => isAusenciaRh(user);

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtro da lista por pessoa: nome (sem acento/caixa) e "só com comentário". */
export function filtrarRespostas(respostas = [], { busca = '', soComentario = false } = {}) {
  const termo = semAcento(busca).trim();
  return respostas.filter((r) => (!termo || semAcento(r.nome).includes(termo))
    && (!soComentario || !!r.comentario));
}

/** O dia tem distribuição? Dia com poucas respostas vem do banco só com o total. */
export const diaComDistribuicao = (d) => d?.muito_mal !== null && d?.muito_mal !== undefined;

/**
 * Resumo do período a partir das linhas por dia do banco.
 *
 * Só os dias COM distribuição entram na média e nas porcentagens — somar os
 * dias escondidos reabriria o que o banco escondeu (daria para descobrir a
 * resposta de um dia por diferença). `respostas` conta todos.
 */
export function resumoPeriodo(dias = []) {
  const respostas = dias.reduce((s, d) => s + (d.total || 0), 0);
  const visiveis = dias.filter(diaComDistribuicao);
  const distribuicao = HUMORES.map((h) => ({
    ...h, total: visiveis.reduce((s, d) => s + (d[h.chave] || 0), 0),
  }));
  const contados = distribuicao.reduce((s, h) => s + h.total, 0);
  if (!contados) return { respostas, contados: 0, media: null, pctBem: null, pctMal: null, distribuicao };
  const soma = distribuicao.reduce((s, h) => s + h.valor * h.total, 0);
  const pct = (n) => Math.round((n / contados) * 100);
  return {
    respostas,
    contados,
    media: Math.round((soma / contados) * 10) / 10,
    pctBem: pct(distribuicao[3].total + distribuicao[4].total),
    pctMal: pct(distribuicao[0].total + distribuicao[1].total),
    distribuicao,
  };
}
