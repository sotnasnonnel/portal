// Resolvedores de nome/cor a partir das listas carregadas do banco.
// Apontar, Dashboard e Registros precisavam dos mesmos três; ficavam copiados.

export function lookupProjetos(projetos) {
  const mapa = new Map(projetos.map((p) => [p.id, p]));
  return {
    nome: (id) => mapa.get(id)?.nome || '—',
    cor: (id) => mapa.get(id)?.cor || '#C44A28',
    // Só os projetos que aparecem nesses apontamentos — um gerente não deve ver
    // a lista de projetos das outras gerências nos filtros.
    usadosEm: (apontamentos) => {
      const ids = new Set(apontamentos.map((a) => a.projetoId));
      return projetos.filter((p) => ids.has(p.id));
    },
  };
}

export function lookupColaboradores(colabs) {
  const mapa = new Map(colabs.map((c) => [c.id, c]));
  return {
    nome: (id) => mapa.get(id)?.nome || '—',
    funcao: (id) => mapa.get(id)?.funcao || '—',
    usadosEm: (apontamentos) => {
      const ids = new Set(apontamentos.map((a) => a.colaboradorId));
      return colabs.filter((c) => ids.has(c.id));
    },
  };
}

export function lookupGerencias(gerencias) {
  const mapa = new Map(gerencias.map((g) => [g.id, g.nome]));
  return { nome: (id) => mapa.get(id) || '—' };
}
