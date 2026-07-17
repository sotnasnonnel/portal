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
  BarChart3,
  ListChecks,
  Settings,
  CreditCard,
  TrendingUp,
  Workflow,
  ShieldCheck,
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

// ============================= Controle de Horas =============================
// Passos comuns a quem administra a equipe (gestor e coordenador). O que muda
// entre eles é só o alcance: o gestor no topo vê a empresa toda; o coordenador,
// a sua subárvore — a RLS do banco cuida disso, então o texto fala em "equipe".
const HORAS_GESTAO_STEPS = [
  {
    icon: Clock,
    titulo: "Você também aponta",
    texto:
      'Como a equipe, em "Apontar" você registra o seu próprio tempo: escolha projeto e atividades e use o cronômetro (Iniciar/Encerrar) ou o "Lançamento manual".',
  },
  {
    icon: Settings,
    titulo: "Configure projetos e atividades",
    texto:
      'Em "Configuração" você cadastra os projetos e as atividades controladas da sua área. Sem isso, a equipe não consegue apontar horas.',
  },
  {
    icon: Users,
    titulo: "Organize a sua equipe",
    texto:
      'Em "Equipe" você vê quem está vinculado à sua área. É o vínculo com a área que libera cada colaborador para apontar.',
  },
  {
    icon: BarChart3,
    titulo: "Dashboard da equipe",
    texto:
      'No "Dashboard da Equipe" você acompanha as horas de todos, com totais e distribuição por colaborador, projeto e atividade.',
  },
  {
    icon: ListChecks,
    titulo: "Registros da equipe",
    texto:
      'Em "Registros" você consulta todos os apontamentos da equipe, filtra por colaborador ou projeto e exporta quando precisar.',
  },
  TROCAR_APP,
];

export const HORAS_GUIA = {
  appName: "Controle de Horas",
  fallbackRole: "usuario",
  roleLabels: { gestor: "Gestor(a)", coordenador: "Coordenador(a)", usuario: "Colaborador(a)" },
  contentByRole: {
    usuario: [
      {
        icon: Clock,
        titulo: "Aponte suas horas",
        texto:
          'Em "Apontar", escolha o projeto e as atividades e clique em Iniciar para o cronômetro rodar. Ao terminar, clique em Encerrar — o tempo é salvo automaticamente.',
      },
      {
        icon: FilePlus2,
        titulo: "Esqueceu de marcar? Lance manual",
        texto:
          'Use o "Lançamento manual" para registrar um período já trabalhado informando início e fim — útil quando você esqueceu de ligar o cronômetro.',
      },
      {
        icon: BarChart3,
        titulo: "Acompanhe o seu tempo",
        texto:
          'Em "Meu Dashboard" você vê o total de horas e a distribuição por projeto e atividade, em gráficos.',
      },
      {
        icon: ListChecks,
        titulo: "Revise os seus registros",
        texto:
          'Em "Meus Registros" ficam todos os seus apontamentos. Dá para conferir, filtrar e excluir um lançamento errado.',
      },
      TROCAR_APP,
    ],
    coordenador: HORAS_GESTAO_STEPS,
    gestor: HORAS_GESTAO_STEPS,
  },
};

// ================================ Financeiro ================================
// Papéis: 'user' = solicitante (coordenador/gestor que abre) · 'admin' = time do
// Financeiro (aprova/executa/configura fluxos). Deriva de modules.financeiro.
// Como o admin também é gestor (abre solicitações), o guia dele inclui os
// passos de "como solicitar" — por isso eles ficam num bloco compartilhado.
const FIN_SOLICITAR_STEPS = [
  {
    icon: CreditCard,
    titulo: "Abrir um Cartão Virtual",
    texto:
      'Vá em Solicitações → "Cartão Virtual". Em "Descrição do cartão", dê um nome que identifique o uso (ex.: "Materiais da Obra X") — é por ele que o cartão será reconhecido depois, inclusive na hora de pedir aumento. Preencha o "Centro de custo (CC)" e o "Valor (R$)", que é o limite que o cartão terá.',
  },
  {
    icon: CalendarClock,
    titulo: "Definir a vigência (ou vitalício)",
    texto:
      'Se o cartão tem prazo, deixe "cartão vitalício" desmarcado e preencha "De" e "Até" — a data final não pode ser anterior à inicial. Se o cartão é permanente, marque "cartão vitalício": os campos de data desaparecem, porque deixam de ser necessários.',
  },
  {
    icon: ListChecks,
    titulo: "Escolher a Aplicação",
    texto:
      'Em "Aplicação", diga em que o cartão será usado (alimentação, combustíveis, materiais…). Você pode marcar mais de uma: clique no campo, selecione as que quiser e feche — use a busca se a lista for grande. A "Observação" é opcional, para algum detalhe extra.',
  },
  {
    icon: ShieldCheck,
    titulo: "Aceitar os Termos e enviar",
    texto:
      'O botão "Enviar" fica bloqueado até tudo estar preenchido e os Termos aceitos. Clique em "Ler os termos", leia, marque "Li e estou de acordo" e confirme — o aceite fica registrado com seu nome e a data/hora. Depois, é só enviar.',
  },
  {
    icon: TrendingUp,
    titulo: "Pedir aumento de limite",
    texto:
      'Em "Aumento de Limite", o primeiro campo é o cartão: aparecem só os seus cartões ativos e dentro da validade. Ao escolher, o app mostra o limite atual, o centro de custo e a vigência — esses dados vêm do cartão, você não digita. Em "Novo valor", informe o limite TOTAL que o cartão passará a ter (precisa ser maior que o atual). Aceite os termos e envie.',
  },
];

export const FINANCEIRO_GUIA = {
  appName: "Financeiro",
  fallbackRole: "user",
  roleLabels: { admin: "Financeiro", user: "Solicitante" },
  contentByRole: {
    user: [
      {
        icon: Wallet,
        titulo: "Bem-vindo ao Financeiro",
        texto:
          "Aqui você solicita cartões virtuais para despesas da empresa e pede aumento de limite dos cartões que já usa. Todo pedido passa por aprovação e, no fim, o time do Financeiro gera o cartão. No menu lateral: o Dashboard resume seus pedidos e, em Solicitações, você abre um novo ou acompanha os que já enviou.",
      },
      ...FIN_SOLICITAR_STEPS,
      {
        icon: ClipboardCheck,
        titulo: "Acompanhar e aprovar",
        texto:
          'Em "Acompanhar" você vê cada pedido e sua linha do tempo: por quais aprovadores já passou e onde está agora. Se você faz parte da cadeia de aprovação de outra pessoa, os botões "Aprovar" e "Reprovar" aparecem no pedido quando chega a sua vez.',
      },
      TROCAR_APP,
    ],
    admin: [
      {
        icon: Wallet,
        titulo: "Seu papel no Financeiro",
        texto:
          "Você é do time do Financeiro: recebe as solicitações depois que passam pelos aprovadores, decide e gera os cartões — e ainda monta as cadeias de aprovação de cada pessoa. Como você também é gestor, este guia cobre as duas coisas: primeiro a parte de administração, depois como abrir suas próprias solicitações.",
      },
      {
        icon: Workflow,
        titulo: "Montar os fluxos de aprovação",
        texto:
          'Em Administração → "Fluxos de Aprovação", escolha o solicitante e o tipo e defina a cadeia: por quais aprovadores o pedido passa antes de chegar a você. Sem cadeia configurada, a pessoa fica bloqueada e não consegue enviar — configure antes de liberar alguém. Cadeia vazia significa que o pedido vai direto para o Financeiro.',
      },
      {
        icon: ClipboardCheck,
        titulo: "Analisar, executar ou reprovar",
        texto:
          'Em "Acompanhar", quando o pedido chega ao Financeiro você tem duas ações: "Executar / Concluir" (depois de gerar o cartão, o pedido vira Concluído) ou "Reprovar" (com um comentário; o pedido é encerrado). Lembre: no aumento, o "Novo valor" é o limite TOTAL do cartão, não um acréscimo.',
      },
      {
        icon: LayoutDashboard,
        titulo: "Visão geral e auditoria",
        texto:
          'No "Dashboard" você acompanha tudo: quantidade por status, valores e as solicitações por aplicação. Toda solicitação exige o aceite dos Termos, guardado com autor e data/hora — um registro de auditoria que não pode ser alterado nem apagado.',
      },
      {
        icon: FilePlus2,
        titulo: "Você também abre solicitações",
        texto:
          "Como coordenador/gestor, você também pode abrir cartões e pedir aumentos, igual a qualquer solicitante. Os próximos passos mostram como fazer isso.",
      },
      ...FIN_SOLICITAR_STEPS,
      TROCAR_APP,
    ],
  },
};
