// Descritor da AUSÊNCIA PROGRAMADA, usado pelas telas em
// src/pages/AusenciaProgramada/ (nome, rota, prefixo das RPCs e rótulos).
//
// Por que existe um descritor para um módulo só: a Folga de Campo nasceu como
// cópia da Ausência Programada e as duas dividiam estas telas. Em 23/09/2026 o
// usuário esclareceu que folga de campo NÃO tem saldo — ela virou um módulo
// próprio e bem mais simples (config/folgaCampo.js, pages/FolgaCampo/).
//
// O descritor ficou porque as telas da ausência já o consomem e tirá-lo seria
// mexer, sem ganho nenhum, num módulo que está em produção com dados reais.
// **Não volte a pendurar módulo novo aqui sem antes conferir que ele tem saldo,
// período aquisitivo e data limite** — foi exatamente esse atalho que deu
// errado.
import { ROTA_AUSENCIA } from './ausenciaProgramada.js';

export { ROTA_AUSENCIA };

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

export const MODULOS_AUSENCIA = [MOD_AUSENCIA];
