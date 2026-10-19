// O que a pessoa comemora e ainda está EM CARTAZ hoje: aniversário e/ou ano de
// casa (pedido da Ana Claudia, RH, 06/10/2026 — destaque no topo da Home só
// para ela). Mesma regra da lista do mês (RPC aniversariantes_mes): tempo de
// casa só a partir de 1 ano.
//
// A JANELA (pedido do usuário, 19/10/2026): o aniversário do Paulo Paiva caiu
// num domingo, ninguém abriu o portal no fim de semana e na segunda a
// comemoração já tinha sumido — ninguém deu os parabéns. Então o aniversário
// que cai no fim de semana fica em cartaz até o primeiro dia útil seguinte:
// domingo mostra o sábado, e a segunda mostra o fim de semana inteiro.
//
// Feriado NÃO entra: o portal não tem calendário de feriados, a mesma limitação
// conhecida de src/utils/diasUteis.js.
//
// Espelho em SQL: app_private.dias_em_cartaz e app_private.comemora_em
// (supabase/supabase_migration_parabens_fim_de_semana.sql).

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

/**
 * Os dias cujo aniversário ainda está em cartaz hoje, do mais antigo ao atual.
 * Segunda e domingo voltam até o sábado; os outros dias são só eles mesmos.
 */
export function diasEmCartaz(hoje = new Date()) {
  const dow = hoje.getDay();
  const volta = dow === 1 ? 2 : (dow === 0 ? 1 : 0);
  const dias = [];
  for (let i = volta; i >= 0; i -= 1) {
    dias.push(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i, 12));
  }
  return dias;
}

/** Como falar do dia em cartaz: 'hoje', 'no sábado' ou 'no domingo'. */
export function rotuloCartaz(dia, hoje = new Date()) {
  if (!dia || mesmoDia(dia, hoje)) return 'hoje';
  return `no ${SEMANA[dia.getDay()]}`;
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
