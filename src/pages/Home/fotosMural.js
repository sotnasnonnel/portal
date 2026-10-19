// Fotos de quem escreveu no mural de parabéns, guardadas por aniversariante.
//
// A foto vem de uma Edge Function (fotos-aniversariantes, modo mural) que fala
// com o hub: é a parte lenta do mural. Então ela é pedida ANTES do clique — a
// Home dispara a busca assim que sabe quem está em cartaz — e fica em memória,
// para o modal abrir com as fotos já na mão (pedido do usuário, 19/10/2026: a
// foto tem de carregar na hora).
//
// Em memória, e não no localStorage: são fotos de outras pessoas e a máquina
// pode ser compartilhada (a mesma razão do limparFotoMicrosoft no logout).
// Recarregar a página pede de novo, uma vez.

import { fotosDoMural } from '../../services/humor';

// aniversariante -> { dia, fotos, ids: Set }  (`ids` = quem já foi consultado,
// com foto ou sem: é o que distingue "ainda não perguntei" de "não tem foto").
const cache = new Map();
// Buscas em andamento, para o clique no botão não repetir o que a Home já pediu.
const indo = new Map();

const diaDeHoje = () => new Date().toDateString();

/** O que já está na mão, sem rede: { fotos, ids } ou null. */
export function fotosMuralEmCache(aniversarianteId) {
  const linha = cache.get(aniversarianteId);
  return linha && linha.dia === diaDeHoje() ? linha : null;
}

/** true quando o cache já cobre todos esses autores (nada a buscar). */
export function fotosMuralCobrem(aniversarianteId, autoresIds) {
  const linha = fotosMuralEmCache(aniversarianteId);
  return Boolean(linha) && autoresIds.every((id) => linha.ids.has(id));
}

/**
 * A busca que a Home dispara antes do clique: não repete o que já está em
 * memória (voltar para a Home não refaz o pedido). Quem precisa das fotos é o
 * modal, e lá a conta é outra — ele rebusca quando aparece um autor novo.
 */
export function prefetchFotosMural(aniversarianteId) {
  if (fotosMuralEmCache(aniversarianteId)) return;
  carregarFotosMural(aniversarianteId);
}

/**
 * Busca as fotos do mural e guarda. Chamadas simultâneas (a da Home e a do
 * modal) esperam a mesma resposta. Nunca rejeita: falha vira cache vazio.
 */
export function carregarFotosMural(aniversarianteId) {
  if (!aniversarianteId) return Promise.resolve({ fotos: {}, ids: new Set() });
  const indoJa = indo.get(aniversarianteId);
  if (indoJa) return indoJa;

  const busca = fotosDoMural(aniversarianteId)
    .then(({ fotos, ids }) => {
      const linha = { dia: diaDeHoje(), fotos, ids: new Set(ids) };
      cache.set(aniversarianteId, linha);
      return linha;
    })
    .catch(() => ({ fotos: {}, ids: new Set() }))
    .finally(() => indo.delete(aniversarianteId));

  indo.set(aniversarianteId, busca);
  return busca;
}
