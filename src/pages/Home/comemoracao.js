// O que a pessoa comemora e ainda está EM CARTAZ hoje: aniversário e/ou ano de
// casa (pedido da Ana Claudia, RH, 06/10/2026 — destaque no topo da Home só
// para ela). Mesma regra da lista do mês (RPC aniversariantes_mes): tempo de
// casa só a partir de 1 ano.
//
// A JANELA (pedido do usuário, 19/10/2026): o aniversário do Paulo Paiva caiu
// num domingo, ninguém abriu o portal no fim de semana e na segunda a
// comemoração já tinha sumido — ninguém deu os parabéns. Então o aniversário
// que cai num dia sem expediente fica em cartaz até o primeiro dia útil
// seguinte: domingo mostra o sábado, e a segunda mostra o fim de semana inteiro.
//
// FERIADO entra na mesma conta desde 03/11/2026 (pedido do usuário): a Ana fez
// aniversário na segunda 02/11, Finados, e a terça abriu sem a comemoração.
// Agora a janela volta por quantos dias parados houver — fim de semana, feriado
// ou feriado emendado no fim de semana — e o calendário está em
// src/utils/feriados.js.
//
// Espelho em SQL: app_private.dias_em_cartaz, app_private.comemora_em e
// app_private.sem_expediente (supabase/supabase_migration_parabens_fim_de_semana.sql
// e supabase/supabase_migration_parabens_feriado.sql).

// Com extensão: `node --test` resolve este módulo direto, sem o alias do Vite.
import { semExpediente } from '../../utils/feriados.js';

export const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado'];

// "yyyy-mm-dd" -> [ano, mês, dia]. Lido como texto: new Date("yyyy-mm-dd") é
// meia-noite UTC e, no fuso do Brasil, cairia no dia anterior.
function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const bissexto = (ano) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

// Mesmo dia e mês. Quem faz em 29/02 comemora em 28/02 nos anos não bissextos.
function caiEm([, mes, dia], d) {
  const dm = d.getMonth() + 1;
  const dd = d.getDate();
  if (mes === 2 && dia === 29 && !bissexto(d.getFullYear())) return dm === 2 && dd === 28;
  return mes === dm && dia === dd;
}

const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Quantos dias a janela pode voltar. Sete dias em cartaz é o teto, e não um
// palpite: no oitavo, dois dias da janela teriam o mesmo nome e "na terça-feira"
// ficaria ambíguo. Serve também de trava — calendário torto não vira laço
// infinito. O Carnaval, que é a emenda mais longa do ano, usa quatro.
const MAX_VOLTA = 6;

/**
 * Os dias cujo aniversário ainda está em cartaz hoje, do mais antigo ao atual.
 *
 * Hoje sempre entra; antes dele, entram os dias parados que vêm emendados —
 * fim de semana, feriado, ou os dois juntos. A terça depois de Finados numa
 * segunda enxerga sábado, domingo e a própria segunda; uma terça comum é só
 * ela mesma.
 */
export function diasEmCartaz(hoje = new Date()) {
  const atras = (n) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n, 12);
  let volta = 0;
  while (volta < MAX_VOLTA && semExpediente(atras(volta + 1))) volta += 1;
  const dias = [];
  for (let i = volta; i >= 0; i -= 1) dias.push(atras(i));
  return dias;
}

/**
 * Como falar do dia em cartaz: 'hoje', 'no sábado', 'na segunda-feira'.
 * O artigo segue o gênero do dia — domingo e sábado são "no", o resto é "na".
 */
export function rotuloCartaz(dia, hoje = new Date()) {
  if (!dia || mesmoDia(dia, hoje)) return 'hoje';
  const dow = dia.getDay();
  return `${dow === 0 || dow === 6 ? 'no' : 'na'} ${SEMANA[dow]}`;
}

/**
 * As comemorações da pessoa que estão em cartaz hoje.
 * @returns {{tipo: 'aniversario'|'tempo_casa', anos?: number, dia: Date, quando: string}[]}
 */
export function comemoracoesEmCartaz({ dataNascimento, dataAdmissao } = {}, hoje = new Date()) {
  const dias = diasEmCartaz(hoje);
  const lista = [];

  const nasc = partes(dataNascimento);
  const diaNasc = nasc && dias.find((d) => caiEm(nasc, d));
  if (diaNasc) lista.push({ tipo: 'aniversario', dia: diaNasc, quando: rotuloCartaz(diaNasc, hoje) });

  const adm = partes(dataAdmissao);
  const diaAdm = adm && dias.find((d) => caiEm(adm, d));
  if (diaAdm) {
    // Os anos saem do ano do dia em cartaz: na segunda 02/01, quem entrou num
    // 31/12 completou os anos no sábado anterior.
    const anos = diaAdm.getFullYear() - adm[0];
    if (anos >= 1) lista.push({ tipo: 'tempo_casa', anos, dia: diaAdm, quando: rotuloCartaz(diaAdm, hoje) });
  }
  return lista;
}
