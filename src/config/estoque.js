import { Boxes, HardHat, Shirt } from 'lucide-react';

/**
 * Módulo de Estoque — almoxarifado de EPIs e uniformes.
 *
 * Substitui as planilhas de referencia/referencia_estoque/. O vocabulário segue
 * o do banco (supabase_migration_estoque.sql):
 *
 * - ITEM     → o que se pede ("CAPACETE 3M", "Camisa Polo").
 * - VARIANTE → o que de fato tem saldo. A chave inclui tamanho, CA, gênero e
 *              setor porque a planilha real repete a mesma descrição variando
 *              esses campos, e são itens NÃO intercambiáveis: botina 39 não
 *              serve em quem calça 43, e respirador CA 45021 não substitui o
 *              CA 12011 num laudo.
 * - MOVIMENTO → entrada, saída ou ajuste. É o histórico; o saldo é consequência.
 */

/**
 * Trava de lançamento, no mesmo molde de ADM_EM_BREVE (config/administrativo.js).
 * Enquanto `true`, o módulo some do AppSwitcher e da Home e a rota devolve para
 * o início — exceto para a lista abaixo. Vira `false` quando o catálogo estiver
 * carregado e a baixa pelo chamado tiver rodado em produção.
 */
export const ESTOQUE_EM_BREVE = true;

export const ESTOQUE_LIBERADOS = [
  // O login do portal é OAuth Microsoft corporativo; o e-mail pessoal está aqui
  // porque foi o informado, mas provavelmente não é o que autentica. Se o acesso
  // não abrir, o endereço certo é o corporativo logo abaixo.
  'mrenanrguimaraes@gmail.com',
  'marcus.guimaraes@phdengenharia.eng.br',
  'andre.guimaraes@phdengenharia.eng.br',
  'lennon.santos@phdengenharia.eng.br',
];

export const podeAcessarEstoque = (user) => !ESTOQUE_EM_BREVE
  || ESTOQUE_LIBERADOS.includes((user?.email || '').trim().toLowerCase());

/**
 * Quem MOVIMENTA o estoque. Reusa o papel do Administrativo de propósito: quem
 * atende o chamado de EPI é quem entrega o EPI. Consultar saldo é liberado para
 * todo logado (a policy de select do catálogo é `using (true)`) — é o "saber se
 * tem ou não" antes de prometer o item.
 *
 * A RLS é quem realmente barra; isto aqui só esconde botão.
 */
export const ehOperadorEstoque = (modules) =>
  modules?.administrativo === 'admin' || modules?.administrativo === 'atendente';

export const CATEGORIAS = [
  { valor: 'epi', label: 'EPI', plural: 'EPIs', icon: HardHat },
  { valor: 'uniforme', label: 'Uniforme', plural: 'Uniformes', icon: Shirt },
];

export const rotuloCategoria = (v) => CATEGORIAS.find((c) => c.valor === v)?.label || v;

export const ICONE_ESTOQUE = Boxes;

// Tamanhos de vestuário, na ordem de tabela de medidas — não em ordem
// alfabética, que colocaria GG antes de M. Botinas usam número e não entram
// aqui (ver ordenarTamanho em lib/catalogo.js).
export const TAMANHOS_ALFA = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];

export const GENEROS = [
  { valor: 'masculino', label: 'Masculino' },
  { valor: 'feminino', label: 'Feminino' },
  { valor: 'unisex', label: 'Unissex' },
];

export const SETORES = [
  { valor: 'sede', label: 'Sede' },
  { valor: 'obra', label: 'Obra' },
  { valor: 'coordenacao', label: 'Coordenação' },
];

export const MOTIVOS_ENTRADA = [
  'Compra',
  'Devolução de colaborador',
  'Transferência entre unidades',
  'Carga inicial (planilha)',
];

// Espelha os MOTIVOS do formulário de EPI/uniforme do Adm
// (administrativo/app/novo/formularios/saudeSeguranca.js), para que o motivo do
// pedido e o motivo da baixa falem a mesma língua nos relatórios.
export const MOTIVOS_SAIDA = [
  'Entrega ao colaborador',
  'Substituição por quebra',
  'Substituição por desgaste',
  'Perda ou extravio',
  'Descarte por validade',
];

export const MOTIVOS_AJUSTE = [
  'Inventário',
  'Correção de lançamento',
];

export const SITUACOES = {
  ok: { label: 'Ok', tom: 'ok' },
  abaixo_minimo: { label: 'Abaixo do mínimo', tom: 'alerta' },
  sem_estoque: { label: 'Sem estoque', tom: 'critico' },
  acima_maximo: { label: 'Acima do máximo', tom: 'info' },
};
