import {
  AWARDS_CRITERIOS, AWARDS_INSCRICOES, AWARDS_LIMITE_ARQUIVO, AWARDS_LIMITE_VIDEO, AWARDS_PERGUNTAS,
  AWARDS_PESO_COMISSAO, AWARDS_PESO_VOTACAO,
  ehAdminProgramas, ehAvaliadorAwards,
} from '../../../config/programas.js';

/** Regras puras do cadastro dos Projetos do Ano. O acesso a dados fica em awards.js. */

/** AAAA-MM-DD em Brasília: o prazo não pode virar no fuso de quem está acessando. */
export const hojeEmBrasilia = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(agora);

/** 'antes' | 'abertas' | 'encerradas' */
export function situacaoInscricoes(hoje = hojeEmBrasilia()) {
  if (hoje < AWARDS_INSCRICOES.abre) return 'antes';
  return hoje > AWARDS_INSCRICOES.fecha ? 'encerradas' : 'abertas';
}

/**
 * Antes das inscrições, quem avalia pode percorrer o fluxo inteiro e reiniciar depois.
 * A mesma data está em public.awards_reiniciar_premiacao(): depois dela os votos valem.
 */
export const podeReiniciarPremiacao = (hoje = hojeEmBrasilia()) => situacaoInscricoes(hoje) === 'antes';

/** Mesma regra de app_private.awards_pode_inscrever(). */
export const podeInscrever = (user, modules, hoje = hojeEmBrasilia()) =>
  situacaoInscricoes(hoje) === 'abertas' || ehAvaliadorAwards(user) || ehAdminProgramas(modules);

/** O que falta preencher, na ordem da tela. */
export function faltandoNoProjeto(valores, temVideo = true) {
  const faltando = valores.categoria ? [] : ['a categoria'];
  AWARDS_PERGUNTAS.forEach(({ campo }, i) => {
    if (!String(valores[campo] || '').trim()) faltando.push(`a pergunta ${i + 1}`);
  });
  if (!temVideo) faltando.push('o vídeo');
  return faltando;
}

const TIPOS = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
};

export const ACEITA_ARQUIVO = Object.keys(TIPOS).map((e) => `.${e}`).join(',');
export const ACEITA_VIDEO = Object.keys(TIPOS).filter((e) => TIPOS[e].startsWith('video/')).map((e) => `.${e}`).join(',');

/**
 * Pela extensão, e não por file.type: o navegador deixa o tipo vazio em vários
 * arquivos do Office, e aí o bucket recusaria um PowerPoint válido.
 */
export function tipoDoArquivo(nome = '') {
  const extensao = String(nome).split('.').pop().toLowerCase();
  return Object.hasOwn(TIPOS, extensao) ? TIPOS[extensao] : null;
}

/** A mensagem do problema, ou null se o arquivo pode ir. */
export function erroDoArquivo(arquivo) {
  if (!tipoDoArquivo(arquivo.name)) {
    return `${arquivo.name}: formato não aceito. Envie Word, Excel, PowerPoint, PDF, imagem, vídeo ou áudio.`;
  }
  if (arquivo.size > AWARDS_LIMITE_ARQUIVO) return `${arquivo.name}: acima de 100 MB.`;
  return null;
}

/** O mesmo para o vídeo obrigatório: só vídeo, até 300 MB. */
export function erroDoVideo(arquivo) {
  if (!tipoDoArquivo(arquivo.name)?.startsWith('video/')) {
    return `${arquivo.name}: envie um vídeo (MP4, MOV, AVI, WMV, WEBM ou MKV).`;
  }
  if (arquivo.size > AWARDS_LIMITE_VIDEO) return `${arquivo.name}: acima de 300 MB. Grave em resolução menor ou comprima o vídeo.`;
  return null;
}

// ============================ Votação e pódio ============================

/** 1º vale 3, 2º vale 2, 3º vale 1 (decisão do Lucas). A soma é feita em awards_resultado(). */
export const PONTOS_POR_POSICAO = [3, 2, 1];

/** Com menos de 3 finalistas na categoria, o voto e o pódio têm menos posições. */
export const posicoesExigidas = (finalistas) => Math.min(3, Math.max(0, finalistas));

/** A mensagem do problema no voto (ids em ordem 1º, 2º, 3º), ou null se ele pode ir. */
export function erroDoVoto(escolhas, finalistas) {
  const exigidas = posicoesExigidas(finalistas);
  const preenchidas = escolhas.slice(0, exigidas).filter(Boolean);
  if (preenchidas.length < exigidas) return `Escolha o ${exigidas === 1 ? '1º lugar' : `1º ao ${exigidas}º lugar`}.`;
  if (new Set(preenchidas).size < exigidas) return 'Escolha projetos diferentes para cada posição.';
  return null;
}

/** 0 a 100: o mais votado da categoria fica com 100 e os outros proporcionais aos pontos. */
export const notaDaVotacao = (pontos, maiorPontuacao) => (maiorPontuacao > 0 ? (pontos / maiorPontuacao) * 100 : 0);

/**
 * 0 a 100, ou null se falta nota em algum critério. Média das notas de 0 a 10,
 * ponderada pelo `peso` de cada critério (1 quando não vem), vezes 10.
 */
export function notaDaComissao(notas = {}, criterios = AWARDS_CRITERIOS) {
  if (!criterios.length || criterios.some((c) => notas[c.chave] == null)) return null;
  const pesoTotal = criterios.reduce((soma, c) => soma + (c.peso ?? 1), 0);
  const somaPonderada = criterios.reduce((soma, c) => soma + Number(notas[c.chave]) * (c.peso ?? 1), 0);
  return (somaPonderada / pesoTotal) * 10;
}

/**
 * 70% votação + 30% comissão. Sem critérios definidos, vale só a votação; com
 * critérios e sem a nota da comissão, ainda não há nota final (null).
 */
export function notaFinal(votacao, comissao, criterios = AWARDS_CRITERIOS) {
  if (!criterios.length) return votacao;
  if (comissao == null) return null;
  return AWARDS_PESO_VOTACAO * votacao + AWARDS_PESO_COMISSAO * comissao;
}

/** Duas casas, para o empate não depender de dízima. */
const arredondada = (n) => (n == null ? null : Math.round(n * 100) / 100);

/**
 * Classifica os projetos de uma categoria pela nota final e marca os empates
 * que mexem no pódio. `linhas` vêm de awards_resultado(); `notas` é
 * { projeto_id: { criterio: nota } }. Quem ainda não tem nota final vai para o
 * fim. Mais pontos e mais votos em 1º só desempatam a SUGESTÃO de ordem: o
 * empate na nota final continua marcado, porque quem decide é a comissão.
 */
export function rankingDaCategoria(linhas, notas = {}, criterios = AWARDS_CRITERIOS) {
  const maior = Math.max(0, ...linhas.map((l) => l.pontos));
  const comNotas = linhas.map((l) => {
    const votacao = notaDaVotacao(l.pontos, maior);
    const comissao = notaDaComissao(notas[l.projeto_id], criterios);
    return { ...l, votacao, comissao, final: notaFinal(votacao, comissao, criterios) };
  });
  const valor = (l) => (l.final == null ? -1 : arredondada(l.final));
  const ordem = comNotas.sort((a, b) => valor(b) - valor(a)
    || b.pontos - a.pontos
    || b.primeiro - a.primeiro
    || b.segundo - a.segundo);
  const k = posicoesExigidas(ordem.length);
  const corte = k ? valor(ordem[k - 1]) : Infinity;
  const finais = ordem.filter((l) => l.final != null).map(valor);
  const repetidos = new Set(finais.filter((v, i) => finais.indexOf(v) !== i));
  return ordem.map((l, i) => ({
    ...l,
    posicao: i + 1,
    empate: l.final != null && valor(l) >= corte && repetidos.has(valor(l)),
  }));
}

/**
 * O pódio confirmado cobre todas as posições de cada categoria? `podio` vem de
 * listarPodio(); `finalistas` é a contagem por categoria. Mesma regra de
 * public.awards_publicar_vencedores().
 */
export function podioCompleto(podio, finalistas) {
  const categorias = Object.keys(finalistas);
  if (!categorias.some((c) => finalistas[c] > 0)) return false;
  return categorias.every((c) => (podio[c] || []).filter(Boolean).length === posicoesExigidas(finalistas[c]));
}

/**
 * A ordem da cerimônia: categoria por categoria, do 3º para o 1º lugar.
 * `categorias` na ordem de AWARDS_CATEGORIAS; categoria sem pódio fica de fora.
 */
export function ordemDaRevelacao(podio, categorias) {
  return categorias
    .filter((c) => (podio[c] || []).some(Boolean))
    .map((c) => ({
      categoria: c,
      posicoes: podio[c].map((id, i) => (id ? i + 1 : null)).filter(Boolean).reverse(),
    }));
}
