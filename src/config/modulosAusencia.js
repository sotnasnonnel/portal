// Os DOIS módulos de afastamento da Gestão de Pessoas, que são a mesma rotina
// com nomes diferentes:
//
//   * AUSÊNCIA PROGRAMADA — o período de ausência de qualquer colaborador.
//   * FOLGA DE CAMPO      — o mesmo, para as equipes de campo registrarem e
//                           aprovarem seus períodos de ausência de obra.
//
// Regra, tela e banco são idênticos: saldo por período, data limite, pedido
// com aprovação do gestor direto. Só mudam o NOME, a ROTA e as TABELAS/RPCs.
// Por isso existe um descritor em vez de duas cópias do módulo: corrigir uma
// regra em um lugar corrige nos dois.
//
// No BANCO as tabelas são separadas (ausencia_* e folga_campo_*), porque saldo
// de ausência e saldo de folga de campo são contas diferentes da mesma pessoa —
// e porque, se um dia as regras divergirem, o corte já está feito.
//
// As telas continuam em src/pages/AusenciaProgramada/ (a pasta nasceu antes da
// folga); o `mod` é quem decide o que aparece escrito.
import { ROTA_AUSENCIA } from './ausenciaProgramada.js';

export { ROTA_AUSENCIA };
export const ROTA_FOLGA_CAMPO = '/folga-de-campo';

export const MOD_AUSENCIA = {
  chave: 'ausencia',
  rota: ROTA_AUSENCIA,
  // Prefixo das RPCs (ausencia_periodos_listar, ausencia_salvar, ...) e nome da
  // tabela de períodos, a única escrita direta (correção do RH).
  rpc: 'ausencia',
  tabelaPeriodos: 'ausencia_periodos',
  // Evento de janela que faz as outras telas abertas recarregarem.
  evento: 'ausencias_programadas_atualizadas',
  navKey: 'ausenciaProgramada',
  arquivo: 'ausencia_programada',

  nome: 'Ausência Programada',
  nomeMinusculo: 'ausência programada',
  substantivo: 'ausência',
  substantivoTitulo: 'Ausência',
  plural: 'Ausências',
  doModulo: 'de ausência',
  menuMinha: 'Minha Ausência',
  tituloAprovacoes: 'Aprovações de Ausência',
  tituloEquipe: 'Ausência da Equipe',
  tituloPainel: 'Painel de Ausência Programada',
  descricaoCartao: 'Saldo, data limite e pedidos de ausência com aprovação do gestor.',
  ctaCartao: 'Abrir ausência programada',
};

export const MOD_FOLGA_CAMPO = {
  chave: 'folgaCampo',
  rota: ROTA_FOLGA_CAMPO,
  rpc: 'folga_campo',
  tabelaPeriodos: 'folga_campo_periodos',
  evento: 'folgas_campo_atualizadas',
  navKey: 'folgaCampo',
  arquivo: 'folga_de_campo',

  nome: 'Folga de Campo',
  nomeMinusculo: 'folga de campo',
  substantivo: 'folga',
  substantivoTitulo: 'Folga',
  plural: 'Folgas',
  doModulo: 'de folga de campo',
  menuMinha: 'Minha Folga',
  tituloAprovacoes: 'Aprovações de Folga de Campo',
  tituloEquipe: 'Folga de Campo da Equipe',
  tituloPainel: 'Painel de Folga de Campo',
  descricaoCartao: 'Períodos de ausência de obra das equipes de campo, com aprovação do gestor.',
  ctaCartao: 'Abrir folga de campo',
};

export const MODULOS_AUSENCIA = [MOD_AUSENCIA, MOD_FOLGA_CAMPO];
