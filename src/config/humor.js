// Humor do dia — cada pessoa marca como está; o resumo é SÓ agregado.
//
// Pedido do Lucas Ferraz (30/09/2026), trazendo o que a Feedz tinha. Decisão do
// usuário: ninguém vê o humor individual de outra pessoa. O RH vê a empresa e
// o gestor a equipe, sempre em números, e o banco esconde a distribuição dos
// dias com menos de MINIMO_ANONIMATO respostas (supabase_migration_humor_aniversariantes.sql).

import { isAusenciaRh } from './ausenciaProgramada.js';

export const MINIMO_ANONIMATO = 3;

// Escala divergente: dois vermelhos, um cinza neutro no meio, dois azuis.
// Validada com o validate_palette da skill de dataviz (vizinhos ΔE ≥ 18, com
// daltonismo inclusive); o cinza é neutro de propósito. O verde e o vermelho de
// STATUS do portal ficam de fora: humor não é alerta.
export const HUMORES = [
  { valor: 1, chave: 'muito_mal', rotulo: 'Muito mal', emoji: '😞', cor: '#a8201a' },
  { valor: 2, chave: 'triste', rotulo: 'Triste', emoji: '😕', cor: '#e8605a' },
  { valor: 3, chave: 'ok', rotulo: 'Ok', emoji: '😐', cor: '#d9d8d2' },
  { valor: 4, chave: 'feliz', rotulo: 'Feliz', emoji: '🙂', cor: '#5a9be8' },
  { valor: 5, chave: 'muito_feliz', rotulo: 'Muito feliz', emoji: '😄', cor: '#1a4f9c' },
];

export const humorPorValor = (v) => HUMORES.find((h) => h.valor === Number(v)) || null;

/** Quem vê o resumo: gestão (a equipe) e o RH (a empresa). */
export const veResumoHumor = (user) => ['gestor', 'coordenador', 'admin'].includes(user?.perfil)
  || isAusenciaRh(user);
export const veResumoEmpresa = (user) => isAusenciaRh(user);

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
