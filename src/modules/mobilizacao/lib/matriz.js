import { ehEncerrada } from './statusEtapa.js';
import { estaAtrasada, temPrazo } from './painelEtapas.js';
import { ordenarEtapas } from './catalogo.js';

/**
 * A matriz de bolinhas: uma linha por processo, uma coluna por etapa do fluxo.
 *
 * É a leitura que a planilha dava e a lista não dá — bater o olho e ver ONDE a
 * fila parou. Numa lista de 40 etapas ninguém percebe que oito processos
 * travaram todos no mesmo passo; numa coluna inteira de vermelho, percebe.
 *
 * Lógica pura, testável.
 */

/**
 * A cor de uma célula.
 *
 * A régua é a MESMA do semáforo do quadro e dos cards (painelEtapas), e isso é
 * o ponto: se a matriz pintasse de vermelho um critério e o quadro outro, os
 * dois passariam a discordar sobre a mesma etapa na mesma tela.
 *
 * @returns {'concluida'|'vencida'|'no-prazo'|'dispensada'|'sem-prazo'|'ausente'}
 */
export function corDaCelula(etapa) {
  if (!etapa) return 'ausente';
  if (etapa.status === 'dispensada') return 'dispensada';
  if (etapa.status === 'concluida') return 'concluida';
  if (estaAtrasada(etapa)) return 'vencida';
  // Em aberto e sem prazo nenhum não é "no prazo": é falta de data-base, e
  // pintar de amarelo esconderia justamente o processo que ninguém consegue
  // acompanhar.
  if (!temPrazo(etapa)) return 'sem-prazo';
  return 'no-prazo';
}

export const ROTULO_COR = {
  concluida: 'Concluída',
  vencida: 'Vencida',
  'no-prazo': 'Em aberto, no prazo',
  dispensada: 'Não se aplica',
  'sem-prazo': 'Em aberto, sem prazo',
  ausente: 'Não faz parte deste processo',
};

/**
 * Título curto para o cabeçalho da coluna.
 *
 * A matriz tem até 11 colunas e o cabeçalho fica na vertical; "Aprovação do
 * cliente final" inteiro esticaria a altura do cabeçalho para além da tela. O
 * corte é por PALAVRA, nunca no meio de uma — "Aprovação do cli…" se lê pior
 * que "Aprovação".
 */
export function tituloCurto(titulo, max = 22) {
  const t = String(titulo || '').trim();
  if (t.length <= max) return t;

  const palavras = t.split(/\s+/);
  let saida = '';
  for (const p of palavras) {
    if (saida && (`${saida} ${p}`).length > max) break;
    saida = saida ? `${saida} ${p}` : p;
  }
  // Palavra unica maior que o limite nao tem por onde quebrar: o corte seco e
  // o unico jeito, e sem ele o cabecalho voltaria ao tamanho original.
  return saida.length > max ? saida.slice(0, max) : saida;
}

/**
 * As colunas de um fluxo saem do CATÁLOGO, não das etapas que existem.
 *
 * Se viessem das etapas, um processo a que falta um passo condicional
 * deslocaria as colunas dos outros e a matriz deixaria de ser comparável entre
 * linhas — que é a única razão de ela existir. Vindo do catálogo, a etapa que
 * não nasceu aparece como buraco na coluna certa.
 */
export function colunasDoFluxo(catalogo = [], fluxo) {
  return ordenarEtapas(catalogo.filter((c) => c.fluxo === fluxo && c.ativo !== false))
    .map((c) => ({ codigo: c.codigo, titulo: c.titulo, curto: tituloCurto(c.titulo) }));
}

/**
 * Monta um bloco por fluxo: colunas do catálogo, uma linha por processo.
 *
 * Fluxo sem processo nenhum sai de fora — três cabeçalhos vazios empilhados só
 * empurram para baixo o que interessa.
 *
 * @param processos [{ id, numero, titulo, fluxo, ... }]
 * @param etapas    [{ processo_id, codigo, status, dias_atraso, ... }]
 * @param catalogo  [{ fluxo, codigo, ordem, titulo, ativo }]
 * @param fluxos    a ordem em que os blocos aparecem (config/mobilizacao FLUXOS)
 */
export function montarMatriz(processos = [], etapas = [], catalogo = [], fluxos = []) {
  // Índice processo -> (codigo -> etapa). Sem ele, cada célula varreria a lista
  // inteira: 126 processos x 11 colunas x 1300 etapas é lentidão visível.
  const porProcesso = new Map();
  for (const e of etapas) {
    if (!porProcesso.has(e.processo_id)) porProcesso.set(e.processo_id, new Map());
    porProcesso.get(e.processo_id).set(e.codigo, e);
  }

  return fluxos
    .map((f) => {
      const doFluxo = processos.filter((p) => p.fluxo === f.slug);
      if (!doFluxo.length) return null;

      const colunas = colunasDoFluxo(catalogo, f.slug);
      const linhas = doFluxo.map((p) => {
        const etapasDoProcesso = porProcesso.get(p.id) || new Map();
        const celulas = colunas.map((c) => {
          const etapa = etapasDoProcesso.get(c.codigo) || null;
          return { codigo: c.codigo, titulo: c.titulo, etapa, cor: corDaCelula(etapa) };
        });
        return {
          processo: p,
          celulas,
          // Quantos passos faltam: é por ele que a linha se ordena, para o que
          // está mais longe do fim aparecer primeiro na reunião.
          faltam: celulas.filter((c) => c.cor !== 'concluida' && c.cor !== 'dispensada').length,
          vencidas: celulas.filter((c) => c.cor === 'vencida').length,
        };
      });

      // Mais vencidas primeiro; empatando, quem tem mais a fazer. É a ordem em
      // que a reunião ataca a lista.
      linhas.sort((a, b) => (b.vencidas - a.vencidas)
        || (b.faltam - a.faltam)
        || String(a.processo.titulo || '').localeCompare(String(b.processo.titulo || ''), 'pt-BR'));

      return { fluxo: f.slug, label: f.label, colunas, linhas };
    })
    .filter(Boolean);
}

/**
 * Quantas etapas de cada cor há numa coluna — o rodapé que responde "este passo
 * trava todo mundo?" sem precisar contar bolinha na tela.
 */
export function resumoDaColuna(linhas = [], indice) {
  const contas = { concluida: 0, vencida: 0, 'no-prazo': 0, dispensada: 0, 'sem-prazo': 0, ausente: 0 };
  for (const l of linhas) {
    const c = l.celulas[indice];
    if (c) contas[c.cor] += 1;
  }
  return contas;
}

/** Só o que ainda está em jogo, para o filtro "esconder concluídos". */
export const linhaEmAndamento = (linha) => linha.faltam > 0;

export { ehEncerrada };
