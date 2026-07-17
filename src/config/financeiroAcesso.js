// Acesso ao módulo Financeiro por CARGO (coluna `funcao` do colaborador):
// só quem é DIRETOR, GERENTE ou COORDENADOR enxerga o módulo.
//
// Por que `funcao` e não `perfil`: no portal o `perfil` não reflete o cargo —
// há coordenadores com perfil 'usuario' e o perfil 'coordenador' está vazio;
// diretores/gerentes ficam como 'gestor'. O cargo real está no texto da função.
const norm = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove acentos (inclui ç→c)
  .toUpperCase();

const CARGOS_FINANCEIRO = ['DIRETOR', 'GERENTE', 'COORDENADOR'];

/** A função indica cargo de diretor, gerente ou coordenador? */
export function temCargoFinanceiro(funcao) {
  const f = norm(funcao);
  return CARGOS_FINANCEIRO.some((c) => f.includes(c));
}
