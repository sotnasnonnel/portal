import { semaforoPrazo } from '../../../utils/semaforo.js';
import { CLASSES_ADM } from '../../../config/administrativo.js';
import { STATUS_LABEL } from '../../administrativo/lib/statusChamado.js';

/**
 * A matriz de chamados do Adm: tipo de chamado na linha, situação na coluna.
 *
 * Existe pela mesma razão que a matriz de mobilização — ver ONDE a fila
 * empilhou sem ler a fila — e pelo pedido de não ter que trocar de página no
 * meio da reunião de torre para olhar o Adm.
 *
 * Lógica pura, testada. A tela só desenha.
 */

/**
 * As colunas: só as situações EM ABERTO, na ordem em que o trabalho anda.
 *
 * Fechado, reprovado e cancelado ficam de fora de propósito. A pergunta da
 * reunião é "o que está parado e onde", e uma coluna de encerrados seria a
 * maior de todas todo mês, achatando visualmente as quatro que importam.
 */
export const COLUNAS_CHAMADO = [
  { status: 'aguardando_aprovacao', curto: 'Aprovação' },
  { status: 'aberto', curto: 'A fazer' },
  { status: 'em_atendimento', curto: 'Em atendimento' },
  { status: 'aguardando_solicitante', curto: 'Aguard. solicitante' },
].map((c) => ({ ...c, label: STATUS_LABEL[c.status] }));

const STATUS_ABERTOS = COLUNAS_CHAMADO.map((c) => c.status);
export const ehStatusAberto = (status) => STATUS_ABERTOS.includes(status);

/** Rótulos legíveis por tom, para legenda e para o title da célula. */
export const ROTULO_TOM_CHAMADO = {
  vencido: 'Com atraso',
  atencao: 'Atenção',
  'em-dia': 'Em dia',
  'sem-prazo': 'Sem prazo definido',
  ausente: 'Nenhum chamado',
};

/**
 * A cor da célula é o PIOR caso entre os chamados que caíram nela.
 *
 * Pior caso, e não a média, porque a matriz é um alarme: uma célula com nove
 * chamados em dia e um vencido há um mês não pode ler como verde. Quem quiser
 * o detalhe abre a fila; aqui a pergunta é "tem problema aqui?".
 *
 * A régua de prazo é semaforoPrazo, a MESMA do quadro do Adm — se as duas
 * telas discordarem sobre o mesmo chamado, o indicador vira ruído.
 *
 * Duas regras próprias daqui, que vieram do pedido:
 *
 *  - "Aguardando solicitante" é sempre amarelo. A bola não está com o Adm, mas
 *    o chamado também não está andando — verde diria que está tudo certo, e
 *    vermelho culparia o Adm por espera de terceiro.
 *  - Sem prazo não é verde. "Aguardando aprovação" nem ligou o relógio ainda:
 *    pintar de verde inventaria uma folga que ninguém mediu.
 */
export function corDaCelulaChamado(chamados = [], status = '', agora = Date.now()) {
  if (!chamados.length) return 'ausente';

  const semaforos = chamados.map((c) => semaforoPrazo(c.sla_vence_em, agora));
  if (semaforos.includes('vencido')) return 'vencido';
  if (status === 'aguardando_solicitante') return 'atencao';
  if (semaforos.includes('perto')) return 'atencao';
  if (semaforos.every((s) => s === 'sem-prazo')) return 'sem-prazo';
  return 'em-dia';
}

/** Chave estável de uma linha: o serviço dentro da classe. */
export const chaveServico = (classe, servico) => `${classe}/${servico}`;

/**
 * O de-para de serviço -> rótulo, montado do catálogo do Adm.
 *
 * Vem do catálogo e não dos chamados porque o chamado guarda só os slugs. Um
 * serviço que saiu do catálogo ainda tem chamado vivo, então o fallback é o
 * próprio slug — some da tela é pior que aparecer feio.
 */
export function rotulosDeServico(classes = CLASSES_ADM) {
  const mapa = new Map();
  for (const c of classes) {
    for (const s of c.servicos || []) {
      mapa.set(chaveServico(c.slug, s.slug), { servico: s.label, classe: c.label });
    }
  }
  return mapa;
}

/**
 * Monta a matriz.
 *
 * As LINHAS saem dos chamados que existem, não do catálogo inteiro. É o
 * contrário da matriz de mobilização, e de propósito: lá as colunas vêm do
 * catálogo porque a leitura é vertical e a coluna precisa existir mesmo vazia,
 * para as linhas se alinharem. Aqui a linha é o eixo que varia, e vinte linhas
 * das quais quinze estão vazias empurrariam para fora da tela justamente as
 * que têm algo.
 *
 * A ordem é por gravidade: quem tem chamado vencido sobe. É o mesmo critério da
 * matriz de mobilização — a primeira linha da tela é a que precisa de resposta.
 */
export function montarMatrizChamados(chamados = [], { classes = CLASSES_ADM, agora = Date.now() } = {}) {
  const rotulos = rotulosDeServico(classes);

  const porLinha = new Map();
  for (const c of chamados) {
    if (!ehStatusAberto(c.status)) continue;
    const chave = chaveServico(c.classe, c.servico);
    if (!porLinha.has(chave)) porLinha.set(chave, []);
    porLinha.get(chave).push(c);
  }

  const linhas = [...porLinha.entries()].map(([chave, lista]) => {
    const rotulo = rotulos.get(chave);
    const celulas = COLUNAS_CHAMADO.map((col) => {
      const dela = lista.filter((c) => c.status === col.status);
      return {
        status: col.status,
        label: col.label,
        total: dela.length,
        tom: corDaCelulaChamado(dela, col.status, agora),
        chamados: dela,
      };
    });

    return {
      chave,
      servico: rotulo?.servico || chave.split('/')[1] || chave,
      classe: rotulo?.classe || chave.split('/')[0] || '',
      celulas,
      total: lista.length,
      vencidos: celulas.filter((c) => c.tom === 'vencido').length,
      // Quantos chamados (e nao quantas celulas) estao vencidos: e o numero que
      // a reuniao pergunta em seguida — "vencido em quantos?".
      chamadosVencidos: lista.filter((c) => semaforoPrazo(c.sla_vence_em, agora) === 'vencido').length,
    };
  });

  return linhas.sort((a, b) => b.chamadosVencidos - a.chamadosVencidos
    || b.total - a.total
    || a.servico.localeCompare(b.servico));
}

/** Total de uma coluna, para o rodapé. */
export function totalDaColuna(linhas = [], indice) {
  return linhas.reduce((soma, l) => soma + (l.celulas[indice]?.total || 0), 0);
}

/** Chamados vencidos de uma coluna, para o rodapé. */
export function vencidosDaColuna(linhas = [], indice, agora = Date.now()) {
  return linhas.reduce((soma, l) => {
    const cel = l.celulas[indice];
    if (!cel) return soma;
    return soma + cel.chamados.filter((c) => semaforoPrazo(c.sla_vence_em, agora) === 'vencido').length;
  }, 0);
}
