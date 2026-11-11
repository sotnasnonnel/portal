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

// Opções do filtro "Gerente": cada equipe do Horas (horas_gerencias) é ancorada
// num gerente (gestor_id). Só entram as equipes de quem está no escopo (colabs),
// e o rótulo é o nome do gerente — ou o nome da equipe sem o "Equipe ".
export function gerentesDoEscopo(gerencias, colabs) {
  const nomes = new Map(colabs.map((c) => [c.id, c.nome]));
  const noEscopo = new Set(colabs.map((c) => c.gerenciaId).filter(Boolean));
  return gerencias
    .filter((g) => noEscopo.has(g.id))
    .map((g) => ({
      value: g.id,
      label: (g.gestor_id && nomes.get(g.gestor_id)) || String(g.nome || '').replace(/^Equipe\s+/i, ''),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

export function lookupGerencias(gerencias) {
  const mapa = new Map(gerencias.map((g) => [g.id, g.nome]));
  return { nome: (id) => mapa.get(id) || '—' };
}
