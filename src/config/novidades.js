import {
  Aperture, AtSign, Award, BellRing, Cake, ClipboardCheck, Fingerprint, HardHat, Heart, ImagePlus, Laugh,
  LayoutDashboard, Link2, MessageCircle, MessageSquareHeart, Newspaper, Palette, Paperclip, Ruler, Smile, Star, Type,
} from 'lucide-react';
import { COMO_GANHAR } from './pontos.js';

// O valor do post vem da mesma lista do "Como ganhar pontos", para o aviso não
// discordar da loja se o valor mudar (mesma conta do BoasVindasFeed).
const PONTOS_POST = COMO_GANHAR.find((g) => g.o === 'Postar no feed')?.p;

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
 *
 * Na VERSÃO (não no item), `tutorial` é o id de um passo a passo de
 * config/tutoriais.js. Fechar o aviso automático que contém essa versão — por
 * qualquer caminho — começa o passo a passo (quem decide é a Home), e o botão
 * do rodapé avisa isso ("Ver como funciona"). No histórico a versão ganha um
 * botão "Ver o passo a passo", e reabrir o histórico não começa nada sozinho.
 * Serve para a novidade que só se entende vendo onde clicar.
 */
export const NOVIDADES = [
  {
    // Avisos do portal (pages/Avisos): qualquer colaborador publica, com o
    // banner no template de manchete da Comunicação. Depende da migração
    // supabase_migration_avisos.sql estar aplicada.
    id: '2026-10-28-avisos',
    data: '2026-10-28',
    itens: [
      {
        icon: BellRing,
        modulo: 'Portal',
        marca: 'Novidade',
        titulo: 'Publicar avisos',
        texto: 'Qualquer um publica um aviso para a empresa: o banner sai no padrão da Comunicação e aparece na Home.',
        opcoes: [
          { icon: Type, label: 'Texto formatado' },
          { icon: ImagePlus, label: 'Imagens' },
          { icon: Link2, label: 'Botão com link' },
          { icon: Paperclip, label: 'Anexos' },
        ],
      },
    ],
  },
  {
    // Lançamento do feed para todo mundo (config/feed.js) e os títulos novos
    // da Personalização: fechar o aviso já cai no passo a passo do feed, que
    // leva da Home até a primeira postagem.
    id: '2026-10-23-feed',
    data: '2026-10-23',
    tutorial: 'feed',
    itens: [
      {
        icon: Newspaper,
        modulo: 'Portal',
        marca: 'Novidade',
        titulo: 'Feed PHD',
        texto: 'Poste fotos e novidades da obra, do projeto e da vida; curta, comente e marque colegas com @.',
        opcoes: [
          { icon: ImagePlus, label: 'Fotos' },
          { icon: Heart, label: 'Curtidas' },
          { icon: MessageCircle, label: 'Comentários' },
          { icon: AtSign, label: 'Marcar com @' },
        ],
      },
      ...(PONTOS_POST ? [{
        icon: Star,
        modulo: 'Portal',
        marca: 'Novidade',
        titulo: 'Post vale ponto',
        texto: `O primeiro post do dia vale +${PONTOS_POST} pontos para a lojinha.`,
      }] : []),
      {
        // Os 36 dos quatro grupos novos mais "Movido a Monster" e "Equino",
        // que entraram nos Clássicos (GRUPOS_TITULO, em config/pontos.js).
        icon: Award,
        modulo: 'Portal',
        marca: 'Novidade',
        titulo: '38 títulos novos',
        texto: 'Do "Mago do Power BI" ao "Engenheiro raiz", cada um com arte e frase. Troque pelos seus pontos.',
        opcoes: [
          { icon: Ruler, label: 'Engenharia e planejamento' },
          { icon: Laugh, label: 'Humor corporativo' },
          { icon: HardHat, label: 'Campo e obra' },
          { icon: Fingerprint, label: 'Personalidade' },
        ],
      },
    ],
  },
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

/**
 * O passo a passo que acompanha estas versões: o `tutorial` da primeira que
 * tiver um (a lista vem da mais nova para a mais antiga), ou null. Um aviso só
 * puxa um passo a passo — dois em fila depois de fechar seria demais.
 */
export function tutorialDasNovidades(versoes = []) {
  return versoes.find((v) => v.tutorial)?.tutorial ?? null;
}
