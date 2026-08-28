/**
 * Modo do módulo de Estoque — o interruptor único do módulo.
 *
 * SEM IMPORTS de propósito: este arquivo é lido tanto pelas telas quanto pelas
 * libs puras que rodam sob `node --test` (saudeSeguranca.js, estoqueDoChamado.js),
 * e essas não podem importar config/estoque.js, que traz ícones do lucide-react.
 *
 * ┌─ VITRINE (true) ────────────────────────────────────────────────────────┐
 * │ As telas do Estoque aparecem e navegam, mas NADA grava, e o             │
 * │ Administrativo funciona exatamente como antes de o módulo existir:      │
 * │                                                                         │
 * │  · /estoque: telas visíveis, botões de gravar desligados, aviso no topo │
 * │  · lib/estoque.js recusa qualquer escrita (a trava de verdade)          │
 * │  · o pedido de EPI/uniforme volta ao formulário antigo (lista de EPIs   │
 * │    e texto livre de uniforme) — sem isso, com o catálogo vazio,         │
 * │    NINGUÉM consegue abrir esses chamados                                │
 * │  · o card de baixa e a consulta de saldo somem do chamado               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * PARA LIGAR O MÓDULO DE VERDADE: troque para `false`. É só isto — nenhuma
 * outra linha precisa mudar. Antes de virar, garanta que o catálogo foi
 * importado (/estoque/importar); com ele vazio o formulário novo não tem o que
 * oferecer.
 *
 * Isto é diferente de ESTOQUE_EM_BREVE (config/estoque.js), que decide QUEM
 * enxerga o módulo. Aqui se decide O QUE ele faz.
 */
export const ESTOQUE_VITRINE = true;

/** Texto único do aviso, para as telas não divergirem entre si. */
export const AVISO_VITRINE = 'Módulo em demonstração: as telas estão liberadas para conhecer, '
  + 'mas nenhuma ação grava dados ainda.';
