import { Aperture, Award, Cake, ClipboardCheck, LayoutDashboard, MessageSquareHeart, Palette, Smile, Star } from 'lucide-react';

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
    id: '2026-10-16-personalizacao',
    data: '2026-10-16',
    itens: [
      {
        icon: Star,
        modulo: 'Portal',
        marca: 'Novidade',
        titulo: 'Pontos e Personalização',
        texto: 'Ganhe pontos usando o portal e troque por molduras, títulos e temas. Toque nos seus pontos, ao lado de Novidades.',
        opcoes: [
          { icon: Aperture, label: 'Molduras' },
          { icon: Award, label: 'Títulos' },
          { icon: Palette, label: 'Temas do mês' },
          { icon: MessageSquareHeart, label: 'Recados' },
        ],
      },
      {
        icon: Smile,
        modulo: 'Portal',
        marca: 'Novidade',
        titulo: 'Como ganhar pontos',
        texto: 'Entrar no portal, marcar como você está, contar o motivo e deixar recado de aniversário; 5 dias seguidos valem bônus.',
      },
      {
        icon: Cake,
        modulo: 'Portal',
        marca: 'Novidade',
        titulo: 'Mural de parabéns',
        texto: 'No dia do aniversário, deixe um recado com ícones de festa; o aniversariante vê todos.',
      },
      {
        icon: Palette,
        modulo: 'Portal',
        marca: 'Novidade',
        titulo: 'Temas do mês',
        texto: 'Halloween e Outubro Rosa em outubro, Novembro Azul em novembro e Natal em dezembro.',
      },
    ],
  },
  {
    // As versões anteriores saíram do histórico a pedido (13/10/2026). Quem
    // tinha carimbado um id que não existe mais recebe só esta, uma vez.
    id: '2026-10-13-home-nova',
    data: '2026-10-13',
    itens: [
      {
        icon: LayoutDashboard,
        modulo: 'Portal',
        marca: 'Novo visual',
        titulo: 'A Home ganhou cara nova',
        texto: 'O que espera por você vem primeiro, os módulos em cartões maiores e as pessoas na lateral.',
      },
      {
        icon: ClipboardCheck,
        modulo: 'Aprovações',
        marca: 'Novidade',
        titulo: 'Tudo o que espera a sua decisão, num lugar só',
        texto: 'A Central de Aprovações junta os pedidos de todos os módulos; aprovar é um clique.',
      },
      {
        icon: Smile,
        modulo: 'Portal',
        marca: 'Novidade',
        titulo: 'Como você está hoje?',
        texto: 'Marque seu humor em um clique: só você vê a sua resposta, a equipe vê o total.',
      },
      {
        icon: Cake,
        modulo: 'Portal',
        marca: 'Novidade',
        titulo: 'Aniversariantes e tempo de casa do mês',
        texto: 'Veja quem faz aniversário e dê parabéns pelo Teams com um clique.',
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
