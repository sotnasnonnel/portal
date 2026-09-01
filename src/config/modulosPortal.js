import { podeAcessarAdm } from './administrativo';
import { podeAcessarProgramas } from './programas';
import { podeAcessarEstoque } from './estoque';
import { areasFinanceiroDe } from './financeiro';

// Os módulos que uma pessoa ENXERGA no portal, em uma lista só.
//
// Existe para o "Fale conosco": quem relata precisa dizer sobre o que está
// falando, e oferecer módulo que a pessoa não usa só atrapalha a escolha. Os
// gates aqui são os MESMOS que a Home aplica nos cards — se divergirem, a lista
// do relato passa a citar telas que a pessoa não tem como abrir.
//
// `Portal` vem sempre e vem primeiro: login, tela inicial, sino e o próprio
// canal não pertencem a módulo nenhum, e sem essa opção esses relatos cairiam
// num módulo qualquer.
export const MODULO_PORTAL = 'Portal';

export function modulosVisiveis(user, modules) {
  const nomes = [MODULO_PORTAL];

  if (modules?.dp) nomes.push('Gestão de Pessoas');
  if (modules?.solic) nomes.push('PMO');
  nomes.push('Controle de Horas');                       // aberto a todos
  if (podeAcessarAdm(user)) nomes.push('Administrativo');
  if (podeAcessarProgramas(user)) nomes.push('Programas');
  if (podeAcessarEstoque(user)) nomes.push('Estoque');

  // O card "Financeiro" cobre duas rotinas sem relação uma com a outra, e quem
  // relata pensa em uma delas — não no card. Por isso entram separadas, e só a
  // metade a que a pessoa tem acesso.
  for (const area of areasFinanceiroDe(modules)) {
    nomes.push(area.slug === 'reembolsos' ? 'Reembolso' : 'Financeiro (Cartões)');
  }

  return nomes;
}

/**
 * Casa o nome que a barra superior usa (ex.: "Financeiro", "Reembolso") com um
 * item da lista, para o relato já vir marcado com a tela de onde saiu. Sem
 * correspondência, cai no Portal — em vez de num módulo errado.
 */
export function moduloPadrao(nomeDaBarra, disponiveis) {
  if (!nomeDaBarra) return MODULO_PORTAL;
  const exato = disponiveis.find((m) => m === nomeDaBarra);
  if (exato) return exato;
  const parcial = disponiveis.find((m) => m.startsWith(nomeDaBarra));
  return parcial || MODULO_PORTAL;
}
