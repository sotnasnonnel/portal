/**
 * Perfis do módulo DP e regras de hierarquia de cadastro.
 * - gestor: normalmente topo, mas PODE ter superior (opcional) — a liderança
 *   real (coordenador→gerente→diretor→CEO) é toda perfil 'gestor', e o motor de
 *   alçadas depende dessa cadeia (colaboradores.superior_id).
 * - coordenador: responde a um gestor.
 * - usuario: responde a um gestor ou coordenador.
 * (admin não é atribuível pela UI de cadastro.)
 */
export const PERFIL_OPCOES = [
  { value: 'usuario', label: 'Usuário' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'gestor', label: 'Gestor' },
];

export const PERFIL_LABEL = {
  admin: 'Admin',
  gestor: 'Gestor',
  coordenador: 'Coordenador',
  usuario: 'Usuário',
};

// Só o gestor pode ficar sem superior (topo da cadeia). Para os demais é
// obrigatório. Para o gestor o campo é OPCIONAL (pode ou não ter superior).
export const precisaSuperior = (perfil) => perfil !== 'gestor';

/**
 * Descendentes de `raizId` na árvore de superior_id (para impedir ciclos:
 * A não pode ter como superior alguém que responde a A, direta ou
 * indiretamente). Só é calculado ao EDITAR (quando há `raizId`).
 */
function descendentesDe(raizId, colaboradores) {
  const descendentes = new Set();
  if (!raizId) return descendentes;
  const filhosPorSuperior = new Map();
  for (const c of colaboradores || []) {
    if (!filhosPorSuperior.has(c.superior_id)) filhosPorSuperior.set(c.superior_id, []);
    filhosPorSuperior.get(c.superior_id).push(c.id);
  }
  const pilha = [raizId];
  while (pilha.length) {
    for (const filho of (filhosPorSuperior.get(pilha.pop()) || [])) {
      if (!descendentes.has(filho)) { descendentes.add(filho); pilha.push(filho); }
    }
  }
  return descendentes;
}

/**
 * Candidatos a superior de um colaborador, conforme o perfil:
 * - gestor: outros gestores (a cadeia de liderança é toda 'gestor');
 * - coordenador: gestores;
 * - usuario: gestores e coordenadores.
 * Exclui o próprio (`excluirId`) e seus descendentes, para não formar ciclo.
 */
export function candidatosASuperior(perfil, colaboradores, excluirId = null) {
  const aceitos = perfil === 'coordenador' ? ['gestor']
    : perfil === 'gestor' ? ['gestor']
      : ['gestor', 'coordenador'];
  const proibidos = descendentesDe(excluirId, colaboradores);
  return (colaboradores || [])
    .filter((c) => aceitos.includes(c.perfil) && c.id !== excluirId && !proibidos.has(c.id))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
}
