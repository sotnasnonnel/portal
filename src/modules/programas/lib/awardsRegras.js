import {
  AWARDS_INSCRICOES, AWARDS_LIMITE_ARQUIVO, AWARDS_PERGUNTAS,
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

/** Mesma regra de app_private.awards_pode_inscrever(). */
export const podeInscrever = (user, modules, hoje = hojeEmBrasilia()) =>
  situacaoInscricoes(hoje) === 'abertas' || ehAvaliadorAwards(user) || ehAdminProgramas(modules);

/** O que falta preencher, na ordem da tela. */
export function faltandoNoProjeto(valores) {
  const faltando = valores.categoria ? [] : ['a categoria'];
  AWARDS_PERGUNTAS.forEach(({ campo }, i) => {
    if (!String(valores[campo] || '').trim()) faltando.push(`a pergunta ${i + 1}`);
  });
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

/**
 * Ordena os finalistas de uma categoria por pontos e marca os empates que mexem
 * no pódio. Quem tem mais votos em 1º fica na frente só para sugerir a ordem: o
 * empate em pontos continua marcado, porque quem decide é a comissão.
 */
export function rankingDaCategoria(linhas) {
  const ordem = [...linhas].sort((a, b) => b.pontos - a.pontos
    || b.primeiro - a.primeiro
    || b.segundo - a.segundo);
  const k = posicoesExigidas(ordem.length);
  const corte = k ? ordem[k - 1].pontos : Infinity;
  const repetidos = new Set(ordem.map((l) => l.pontos).filter((p, i, todos) => todos.indexOf(p) !== i));
  return ordem.map((l, i) => ({
    ...l,
    posicao: i + 1,
    empate: l.pontos >= corte && repetidos.has(l.pontos),
  }));
}
