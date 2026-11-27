import { useState } from 'react';

// Projetos fixados no topo do seletor da tela de Apontar. É preferência de quem
// aponta (gente que passa meses no mesmo projeto e cansava de procurá-lo no
// meio da lista), então mora no navegador, por colaborador: não precisa de
// tabela nem de RLS. Trocar de navegador perde os fixados — aceitável para um
// atalho. Projeto que deixou de ser visível só não aparece (o seletor filtra).

const chaveDe = (colaboradorId) => (colaboradorId ? `horas:projetosFixados:${colaboradorId}` : null);

export function lerFixados(colaboradorId) {
  const chave = chaveDe(colaboradorId);
  if (!chave) return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(chave));
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function useProjetosFixados(colaboradorId) {
  const chave = chaveDe(colaboradorId);
  // Guardamos a chave junto: se o usuário mudar, a lista é relida do storage
  // na renderização, sem efeito.
  const [estado, setEstado] = useState({ chave: null, lista: [] });
  const fixados = estado.chave === chave ? estado.lista : lerFixados(colaboradorId);

  const alternar = (projetoId) => {
    if (!chave || !projetoId) return;
    const nova = fixados.includes(projetoId)
      ? fixados.filter((id) => id !== projetoId)
      : [...fixados, projetoId];
    try {
      window.localStorage.setItem(chave, JSON.stringify(nova));
    } catch {
      // Storage cheio/bloqueado: o fixado vale só até recarregar a página.
    }
    setEstado({ chave, lista: nova });
  };

  return [fixados, alternar];
}
