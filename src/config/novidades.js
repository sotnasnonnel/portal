import { BarChart3, Clock, FileClock } from 'lucide-react';

/**
 * O que mudou na plataforma, do mais novo para o mais antigo.
 *
 * A Home abre a versão mais recente UMA vez por pessoa (ver NovidadesModal e
 * colaboradores.novidades_visto_id, em supabase_migration_novidades.sql) e
 * depois some. O botão "Novidades" da barra reabre o histórico quando quiser.
 *
 * Como adicionar: coloque a versão nova NO TOPO da lista, com um `id` novo. É o
 * id que decide quem já viu o quê — mudar o id de uma versão antiga faz o aviso
 * dela voltar para todo mundo, então não reaproveite.
 *
 * A versão não tem título: o aviso se apresenta pela data e pela contagem
 * ("3 mudanças"), e o que mudou fica por conta dos itens. Uma manchete tentando
 * resumir a lista inteira ou repetia os itens ou generalizava até não dizer nada.
 *
 * Cada item fala de UMA mudança, na voz de quem usa ("o card mudou de nome"),
 * não na de quem programou ("refatoramos o módulo"). `modulo` é o rótulo do
 * chip; use o nome que aparece no card da Home.
 *
 * `texto` é UMA linha. Este aviso é lido de passagem, entre o login e o que a
 * pessoa veio fazer: parágrafo com ressalva e exemplo vira aviso que se fecha
 * sem ler. O que não couber numa linha provavelmente é assunto do Guia do
 * módulo (o botão "?" da barra), não daqui.
 *
 * Campos opcionais que o aviso DESENHA em vez de descrever — texto explicando
 * que "o card mudou de nome" é mais lento de entender do que ver os dois nomes
 * lado a lado:
 *   de/para  -> a fita "PMO → Dados" (renomeações)
 *   opcoes   -> mini-cartões do que a pessoa vai encontrar na tela ([{ icon, label }])
 *   marca    -> selo do canto do cartão ('Novo nome', 'Novidade', ...)
 */
export const NOVIDADES = [
  {
    id: '2026-09-01-dados-horas',
    data: '2026-09-01',
    itens: [
      {
        icon: BarChart3,
        modulo: 'Dados',
        marca: 'Novo nome',
        de: 'PMO',
        para: 'Dados',
        titulo: 'O PMO agora se chama Dados',
        texto: 'Mesmo app, mesmo endereço: só o nome mudou.',
      },
      {
        icon: Clock,
        modulo: 'Gestão de Horas',
        marca: 'Novo nome',
        de: 'Controle de Horas',
        para: 'Gestão de Horas',
        titulo: 'O Controle de Horas virou Gestão de Horas',
        texto: 'O nome agora cobre o módulo inteiro, hora extra incluída.',
      },
      {
        icon: FileClock,
        modulo: 'Gestão de Horas',
        marca: 'Mudou de jeito',
        titulo: 'Apontamento e Horas Extras, cada um na sua porta',
        texto: 'O card pergunta por onde começar, e cada área mostra só o que é dela.',
        opcoes: [
          { icon: Clock, label: 'Apontamento' },
          { icon: FileClock, label: 'Horas Extras' },
        ],
      },
    ],
  },
];

/** A versão mais recente — é o id que fica carimbado quando a pessoa fecha o aviso. */
export const ULTIMA_NOVIDADE = NOVIDADES[0];

/**
 * O que esta pessoa ainda não viu, dado o último id que ela carimbou.
 *
 * Quem nunca viu (ou viu um id que não existe mais) recebe só a versão mais
 * recente, não o histórico inteiro: no primeiro login o que importa é o portal
 * de hoje — despejar seis versões antigas é um aviso que ninguém lê.
 */
export function novidadesNaoVistas(vistoId) {
  if (!vistoId) return NOVIDADES.slice(0, 1);
  const i = NOVIDADES.findIndex((n) => n.id === vistoId);
  if (i < 0) return NOVIDADES.slice(0, 1);
  return NOVIDADES.slice(0, i);
}
