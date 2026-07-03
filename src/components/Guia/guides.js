// Conteúdo dos guias ("o que você pode fazer") por app e por papel.
// O passo de boas-vindas é montado no GuiaModal; aqui ficam só os passos do papel.
// Cada guia abre SÓ pelo botão "?" da barra superior (evento GUIA_OPEN_EVENT) —
// não abre mais sozinho no primeiro acesso.
import {
  CalendarDays,
  Clock,
  ClipboardCheck,
  CalendarClock,
  LayoutDashboard,
  Users,
  FileText,
  UserPlus,
  List,
  Repeat,
  Receipt,
  Camera,
  Send,
  Check,
  ThumbsUp,
  Wallet,
  CircleDollarSign,
  FileDown,
  FilePlus2,
  Building2,
} from "lucide-react";

export const GUIA_OPEN_EVENT = "abrir_guia";

// Passo comum aos 3 apps: o seletor de app no topo da sidebar.
const TROCAR_APP = {
  icon: Repeat,
  titulo: "Troque de app quando quiser",
  texto:
    'No topo do menu lateral, o seletor "App" leva você aos outros sistemas do Portal PHD a que você tem acesso (Gestão de Pessoas, Reembolso, Solicitações) sem precisar voltar à tela inicial.',
};

// ============================ Gestão de Pessoas (DP) ============================
export const DP_GUIA = {
  appName: "Gestão de Pessoas",
  fallbackRole: "usuario",
  roleLabels: { admin: "Administrador(a)", gestor: "Gestor(a)", usuario: "Colaborador(a)" },
  contentByRole: {
    usuario: [
      {
        icon: CalendarDays,
        titulo: "Solicite sua ausência",
        texto:
          'No menu "Minha Ausência", clique em "Solicitar Ausência", escolha a data de início e quantos dias quer se ausentar. O app calcula sozinho a data de término e o período aquisitivo.',
      },
      {
        icon: Clock,
        titulo: "Acompanhe o andamento",
        texto:
          "Seus pedidos ficam agrupados por Período Aquisitivo (P.A.). Cada grupo mostra o saldo de dias restante (até 21 dias) e o status de cada parcela já marcada.",
      },
      {
        icon: ClipboardCheck,
        titulo: "Entenda as cores",
        texto:
          "Verde = aprovado pelo gestor · Laranja = pendente de marcação · Vermelho = atrasado para marcar · Cinza = período ainda em aquisição.",
      },
      {
        icon: CalendarClock,
        titulo: "Pode parcelar",
        texto:
          "Você pode dividir seus 21 dias em vários pedidos. O sistema controla o saldo e não deixa marcar mais dias do que você tem direito.",
      },
      TROCAR_APP,
    ],
    gestor: [
      {
        icon: LayoutDashboard,
        titulo: "Painel inicial",
        texto:
          'No "Dashboard" você vê um resumo da sua equipe: ausências confirmadas, pendências e o número de integrantes sob a sua liderança.',
      },
      {
        icon: ClipboardCheck,
        titulo: "Aprove os pedidos",
        texto:
          'Em "Aprovações" ficam as solicitações pendentes da sua equipe. Você aprova ou reprova cada uma — o número ao lado do menu mostra quantas estão te aguardando.',
      },
      {
        icon: Users,
        titulo: "Acompanhe a equipe",
        texto: 'Em "Minha Equipe" você vê admissão e função de cada subordinado e pode exportar a lista para Excel.',
      },
      {
        icon: CalendarClock,
        titulo: "Gestão de Ausência",
        texto:
          "Visão estratégica do time: quem está Em Ausência hoje, quem tem ausência A Vencer (até 30 dias), Vencidas e uma Linha do Tempo com a cronologia.",
      },
      {
        icon: FileText,
        titulo: "Requisições DP",
        texto:
          'Envie requisições ao Departamento Pessoal (desligamento, contratação, nova vaga, ajuda de custo e mais) e acompanhe o status até a conclusão.',
      },
      TROCAR_APP,
    ],
    admin: [
      {
        icon: UserPlus,
        titulo: "Cadastrar colaboradores",
        texto:
          'Em "Cadastro" você adiciona novos colaboradores. O acesso é feito com a conta Microsoft da PHD — basta informar o e-mail corporativo.',
      },
      {
        icon: List,
        titulo: "Listagem e edição",
        texto:
          'Em "Listagem" você vê todos, edita, inativa e filtra por perfil e status. Dá para exportar para Excel respeitando os filtros.',
      },
      {
        icon: FileText,
        titulo: "Requisições e Fluxos",
        texto:
          'Acompanhe as requisições enviadas pelos gestores em "Requisições DP" e configure as etapas de aprovação em "Fluxos de Aprovação".',
      },
      TROCAR_APP,
    ],
  },
};

// ================================ Reembolso ================================
export const REEMBOLSO_GUIA = {
  appName: "Reembolso",
  fallbackRole: "solicitante",
  roleLabels: { admin: "Administrador(a)", gestor: "Gestor(a)", solicitante: "Solicitante" },
  contentByRole: {
    solicitante: [
      {
        icon: Receipt,
        titulo: "Solicite suas despesas",
        texto:
          "Aqui você cria pedidos de reembolso e adiantamento das suas despesas e acompanha tudo num só lugar.",
      },
      {
        icon: Camera,
        titulo: "Crie um pedido",
        texto:
          'Toque em "Novo", preencha o cabeçalho e adicione os itens. No reembolso dá pra tirar foto ou importar a NF — a IA preenche os itens pra você.',
      },
      {
        icon: Clock,
        titulo: "Acompanhe o status",
        texto: "Na lista você vê se o pedido está Aguardando Aprovação, Aprovado ou Reprovado.",
      },
      {
        icon: Send,
        titulo: "Foi reprovado? Reenvie",
        texto: "Se o gestor reprovar, você vê o motivo, ajusta o que for preciso e reenvia para aprovação.",
      },
      TROCAR_APP,
    ],
    gestor: [
      {
        icon: Check,
        titulo: "Aprove os pedidos da equipe",
        texto: "Você analisa e decide os reembolsos e adiantamentos dos seus liderados.",
      },
      {
        icon: Clock,
        titulo: "Sua fila de aprovação",
        texto:
          'Você já abre a lista em "Aguardando Aprovação". Abra um pedido para conferir os itens e as notas anexadas.',
      },
      {
        icon: ThumbsUp,
        titulo: "Aprovar ou reprovar",
        texto:
          "Aprove com um clique. Ao reprovar, escreva a justificativa — ela volta para o solicitante ajustar e reenviar.",
      },
      {
        icon: Receipt,
        titulo: "Você também pode solicitar",
        texto: "Seus próprios pedidos já entram aprovados automaticamente, sem precisar de outro gestor.",
      },
      TROCAR_APP,
    ],
    admin: [
      {
        icon: Wallet,
        titulo: "Visão geral e pagamentos",
        texto: "Você enxerga todos os pedidos e cuida da etapa de pagamento.",
      },
      {
        icon: CircleDollarSign,
        titulo: "O que falta pagar",
        texto: 'Você inicia em "Aprovados". O cartão "A pagar" mostra os aprovados que ainda não foram pagos.',
      },
      {
        icon: FileDown,
        titulo: "Agende e gere o PDF",
        texto: "No detalhe de um pedido aprovado, defina a data de pagamento e gere o PDF com as NFs anexadas.",
      },
      {
        icon: FileText,
        titulo: "Reembolsos e Adiantamentos",
        texto: "Tudo isso vale para as duas abas no menu lateral.",
      },
      TROCAR_APP,
    ],
  },
};

// ============================== Solicitações ==============================
export const SOLIC_GUIA = {
  appName: "Solicitações",
  fallbackRole: "user",
  roleLabels: { admin: "Administrador(a)", user: "Usuário(a)" },
  contentByRole: {
    user: [
      {
        icon: LayoutDashboard,
        titulo: "Seu painel de solicitações",
        texto: "No Dashboard você acompanha todas as suas solicitações e o andamento de cada uma num só lugar.",
      },
      {
        icon: FilePlus2,
        titulo: "Abra uma nova solicitação",
        texto:
          'Em "Nova Solicitação" você preenche o formulário, anexa o que for preciso e envia o pedido para análise.',
      },
      {
        icon: Clock,
        titulo: "Acompanhe o status e o prazo",
        texto: "Cada solicitação mostra em que etapa está e o prazo previsto, até ser concluída.",
      },
      TROCAR_APP,
    ],
    admin: [
      {
        icon: LayoutDashboard,
        titulo: "Visão geral",
        texto: "No Dashboard você acompanha todas as solicitações, com status, responsáveis e prazos.",
      },
      {
        icon: Building2,
        titulo: "Cadastros",
        texto: 'Em "Cadastros" você gerencia as empresas e os ativos que alimentam as solicitações.',
      },
      {
        icon: CalendarClock,
        titulo: "Prazos",
        texto: 'Em "Prazos" você define os prazos de cada etapa/tipo de solicitação que a equipe deve cumprir.',
      },
      {
        icon: Users,
        titulo: "Usuários",
        texto: 'Em "Usuários" você controla quem acessa o app de Solicitações e o nível de cada um.',
      },
      TROCAR_APP,
    ],
  },
};
