import { nomeCurto } from '../../../../utils/formatters';
import { nomeProprio } from '../../../../utils/pessoas';

export const nomeResponsavel = (setor) => nomeProprio(nomeCurto(setor?.responsavel_nome));

// "Operação" aparece três vezes, uma por responsável: em lista e em select o
// nome sozinho não diz qual é.
export const rotuloSetor = (setor) => `${setor.nome} · ${nomeResponsavel(setor)}`;
