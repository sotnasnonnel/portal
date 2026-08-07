import { EQUIPAMENTOS } from '../../../../../config/novaVaga';
import { CAMPOS as CAMPOS_CONTRATACAO } from '../../../../../config/formularioContratacao';

// As listas de EPI, software e equipamento já existem no portal, usadas nas
// Requisições DP. Reaproveitá-las evita que a mobilização peça um EPI que a
// contratação não oferece.
//
// Ficam separadas das REGRAS (mobilizacao.js) de propósito: puxar os catálogos
// do DP arrasta uma cadeia de imports que não roda fora do Vite, e isso deixaria
// as regras sem teste.
const opcoesContratacao = (id) => CAMPOS_CONTRATACAO.find((c) => c.id === id)?.opcoes || [];

// "2ª tela" está catalogada como software no formulário de Contratação, mas é
// hardware — no Administrativo ela pertence a Equipamento e acessórios. A troca
// é feita aqui, sem mexer no catálogo do DP, que é usado por outras telas.
const SEGUNDA_TELA = '2° tela';

export const OPCOES_EQUIPAMENTO = [...EQUIPAMENTOS, SEGUNDA_TELA];
export const OPCOES_SOFTWARE = opcoesContratacao('softwares_extras').filter((o) => o !== SEGUNDA_TELA);
export const OPCOES_EPI = opcoesContratacao('epis');
