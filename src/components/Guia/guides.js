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
  FileClock,
  Building2,
  BarChart3,
  ListChecks,
  Settings,
  CreditCard,
  TrendingUp,
  Workflow,
  ShieldCheck,
  Headset,
  Search,
  Paperclip,
  Lightbulb,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  AlertTriangle,
  Bell,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  PackageCheck,
  FileSpreadsheet,
  Home,
} from "lucide-react";
import { POLICY } from "../../modules/reembolso/lib/reimbursementPolicy.js";

// Os limites do guia saem da POLICY, não de texto solto: guia que contradiz a
// regra que o sistema aplica é pior do que guia nenhum.
const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const LIMITES_REFEICAO = POLICY.alimentacao.map((r) => `${r.label} ${brl(r.value)}`).join(", ");

export const GUIA_OPEN_EVENT = "abrir_guia";

// Passo comum a todos os apps: o sino da barra superior. A central é uma só —
// avisa de qualquer módulo, de onde a pessoa estiver.
const NOTIFICACOES = {
  icon: Bell,
  titulo: "O sino avisa quando algo anda",
  texto:
    'O sino na barra do topo mostra o que aconteceu com os seus pedidos e o que está esperando decisão sua: chegou a sua vez de aprovar, seu pedido foi aprovado, reprovado ou concluído. A bolinha conta o que você ainda não leu; clicar na notificação abre o pedido e dá baixa nela. Vale para todos os apps do portal, não só para este.',
};

// Passo comum aos apps: como ir para outro sistema do portal. O seletor "App"
// que ficava no topo da sidebar deixou de existir quando a marca da PHD tomou
// esse lugar; hoje a volta é pelo "Início".
const TROCAR_APP = {
  icon: Home,
  titulo: "Troque de app quando quiser",
  texto:
    'No menu lateral, "Início" leva de volta à tela inicial do Portal PHD, onde ficam os cards de todos os sistemas a que você tem acesso (Gestão de Pessoas, PMO, Controle de Horas, Administrativo, Financeiro, Programas e Estoque). Clicar na marca da PHD, no topo do menu, faz o mesmo.',
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
      NOTIFICACOES,
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
      NOTIFICACOES,
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
      NOTIFICACOES,
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
        icon: Building2,
        titulo: "Escolher o Cliente / Obra",
        texto:
          'O campo "Cliente / Obra" lista as obras do organograma — é a mesma lista do centro de custo das solicitações do Financeiro, para a obra ser sempre chamada pelo mesmo código. Se a sua não estiver ali (obra nova, rateio), escolha "Outro (digitar)" e informe à mão; o link "Escolher da lista" volta para a lista.',
      },
      {
        icon: AlertTriangle,
        titulo: "Limites de alimentação e hospedagem",
        texto:
          `Dois limites separados, conferidos pelo sistema. Alimentação: ${LIMITES_REFEICAO} por refeição e no máximo ${brl(POLICY.alimentacaoDia)} somando o dia — três almoços no mesmo dia não passam só porque cada um cabe no teto. Hospedagem: ${brl(POLICY.hospedagem)} por diária, contada por nota (3 noites numa nota = 3 diárias). Máximo por dia: ${brl(POLICY.diariaMaxima)}. Passar do teto não impede o envio: aparece o aviso com o excedente e o gestor decide.`,
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
      NOTIFICACOES,
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
        icon: AlertTriangle,
        titulo: "Pedido acima do limite",
        texto:
          `Passou de algum teto — ${brl(POLICY.alimentacaoDia)} de alimentação no dia, o limite da refeição ou ${brl(POLICY.hospedagem)} por diária —, o app mostra o excedente item a item e libera "Aprovar com desconto", que paga já sem o que passou. Aprovar pelo valor cheio continua possível: a decisão é sua, o sistema só não deixa passar despercebido. Itens proibidos (bebida alcoólica, cigarro, vestuário) também aparecem sinalizados.`,
      },
      {
        icon: Receipt,
        titulo: "Você também pode solicitar",
        texto: "Seus próprios pedidos já entram aprovados automaticamente, sem precisar de outro gestor.",
      },
      NOTIFICACOES,
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
        icon: AlertTriangle,
        titulo: "Valor aprovado x solicitado",
        texto:
          `Quando o gestor aprova com desconto (pedido acima do teto da refeição, dos ${brl(POLICY.alimentacaoDia)} de alimentação no dia ou dos ${brl(POLICY.hospedagem)} por diária), o que se paga é o "Valor aprovado", não o solicitado — o detalhe e o PDF mostram os dois, com o desconto destacado.`,
      },
      {
        icon: FileText,
        titulo: "Reembolsos e Adiantamentos",
        texto: "Tudo isso vale para as duas abas no menu lateral.",
      },
      NOTIFICACOES,
      TROCAR_APP,
    ],
  },
};

// ============================== PMO ==============================
export const SOLIC_GUIA = {
  appName: "PMO",
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
      NOTIFICACOES,
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
        texto: 'Em "Usuários" você controla quem acessa o app de PMO e o nível de cada um.',
      },
      NOTIFICACOES,
      TROCAR_APP,
    ],
  },
};

// ============================= Controle de Horas =============================
// Passos comuns a quem administra a equipe (gestor e coordenador). O que muda
// entre eles é só o alcance: o gestor no topo vê a empresa toda; o coordenador,
// a sua subárvore — a RLS do banco cuida disso, então o texto fala em "equipe".
// Horas extras: fluxo de solicitação/aprovação, paralelo ao apontamento. Todo
// mundo pede; por isso o passo de solicitar aparece nos dois papéis.
const HORAS_EXTRA_SOLICITAR = {
  icon: FilePlus2,
  titulo: "Peça hora extra antes de fazer",
  texto:
    'Em "Horas Extras → Nova Solicitação", informe data, horário, projeto e a justificativa. O pedido só é aceito até 12:00 do próprio dia e não vale para datas passadas — fora disso, é o DP que libera por exceção. Seu gestor recebe um e-mail e decide.',
};

const HORAS_EXTRA_APROVAR = {
  icon: ClipboardCheck,
  titulo: "Aprove definindo o destino da hora",
  texto:
    'Em "Solicitações Pendentes" você aprova ou reprova (com motivo) as horas extras da sua equipe. Ao aprovar, escolha Medição/Pagamento ou Banco de Horas — neste caso informe data, período e quantidade previstos para compensação, e a data precisa caber nos 180 dias seguintes à hora extra. O percentual não é seu: o DP/RM aplica conforme a CCT.',
};

const HORAS_GESTAO_STEPS = [
  {
    icon: Clock,
    titulo: "Você também aponta",
    texto:
      'Como a equipe, em "Apontar" você registra o seu próprio tempo: escolha o projeto, preencha os campos que a sua equipe definiu e use o cronômetro (Iniciar/Encerrar) ou o "Lançamento manual".',
  },
  {
    icon: Settings,
    titulo: "Configure os projetos",
    texto:
      'Em "Configuração" você cadastra os projetos da sua área. Sem isso, a equipe não consegue apontar horas. Já em "Config. do Apontamento" você monta os campos que a sua equipe preenche antes do cronômetro: o nome de cada um, se é lista suspensa (com as opções que você quiser) ou texto livre, e se é obrigatório.',
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
      'No "Dashboard da Equipe" você acompanha as horas de todos, com totais e distribuição por colaborador, projeto e o campo do apontamento que escolher no gráfico.',
  },
  {
    icon: ListChecks,
    titulo: "Registros da equipe",
    texto:
      'Em "Registros" você consulta todos os apontamentos da equipe, filtra por colaborador ou projeto e exporta quando precisar.',
  },
  HORAS_EXTRA_SOLICITAR,
  HORAS_EXTRA_APROVAR,
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
          'Em "Apontar", escolha o projeto, preencha os campos que a sua equipe definiu e clique em Iniciar para o cronômetro rodar. Ao terminar, clique em Encerrar — o tempo é salvo automaticamente.',
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
          'Em "Meu Dashboard" você vê o total de horas e a distribuição por projeto e pelos campos do apontamento, em gráficos.',
      },
      {
        icon: ListChecks,
        titulo: "Revise os seus registros",
        texto:
          'Em "Meus Registros" ficam todos os seus apontamentos. Dá para conferir, filtrar e excluir um lançamento errado.',
      },
      HORAS_EXTRA_SOLICITAR,
      {
        icon: FileClock,
        titulo: "Acompanhe suas horas extras",
        texto:
          'Em "Minhas Solicitações" você vê o andamento de cada pedido: pendente, aprovada (com o destino — Medição/Pagamento ou Banco de Horas), reprovada (com o motivo) ou já compensada.',
      },
      NOTIFICACOES,
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
    titulo: "Abrir um Cartão",
    texto:
      'Vá em Solicitações → "Cartão" e escolha o "Tipo de cartão": virtual (emitido no sistema) ou físico. No físico, informe o "Endereço de entrega" — a estimativa é de 10 dias úteis para a entrega. Em "Descrição do cartão", dê um nome que identifique o uso (ex.: "Materiais da Obra X") — é por ele que o cartão será reconhecido depois, inclusive na hora de pedir aumento. Preencha o "Centro de custo (CC)" e o "Valor (R$)", que é o limite que o cartão terá.',
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
      'Assim que você informa o valor, o bloco "Quem vai aprovar" mostra a cadeia inteira: seu gestor no organograma, os aprovadores que a faixa de valor exige e, no fim, o Financeiro que executa. O botão "Enviar" fica bloqueado até tudo estar preenchido e os Termos aceitos. Clique em "Ler os termos", leia, marque "Li e estou de acordo" e confirme — o aceite fica registrado com seu nome e a data/hora. Depois é só enviar — para reler os termos mais tarde, use o botão de termos na barra do topo.',
  },
  {
    icon: CreditCard,
    titulo: "Acompanhar seus cartões",
    texto:
      'Em "Meus Cartões" ficam os cartões que já são seus: o limite que vale hoje (com os aumentos aprovados somados), a vigência, o centro de custo e a aplicação. Cartão em aprovação e cartão vencido também aparecem, marcados — e, se você pediu um aumento que ainda não saiu, o card avisa que o limite só muda quando o Financeiro executar.',
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
          "Aqui você solicita cartões corporativos (virtual ou físico) e pede aumento de limite dos que já usa. Todo pedido passa por aprovação e, no fim, o time do Financeiro gera o cartão. O menu lateral tem duas áreas: CARTÕES (novo pedido, Meus Cartões e a fila de aprovação) e REEMBOLSOS (o que você pagou do próprio bolso e quer de volta). Os dashboards de cada área são do time do Financeiro e de quem aprova.",
      },
      ...FIN_SOLICITAR_STEPS,
      {
        icon: ClipboardCheck,
        titulo: "Acompanhar e aprovar",
        texto:
          'Em "Acompanhar" você vê cada pedido e sua linha do tempo: por quais aprovadores já passou e onde está agora. Se você faz parte da cadeia de aprovação de outra pessoa, os botões "Aprovar" e "Reprovar" aparecem no pedido quando chega a sua vez.',
      },
      NOTIFICACOES,
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
        titulo: "Fluxos de aprovação (exceções)",
        texto:
          'A cadeia padrão não é cadastrada: sai do organograma — o superior direto da pessoa e o gerente acima dele — e depois sobe para a faixa de valor (até R$ 5.000 ninguém a mais; de R$ 5.000 a R$ 20.000 entram COO e Gerente Financeiro; acima disso soma o CEO). É a mesma regra do Administrativo. Em Administração → "Fluxos de Aprovação" você cadastra EXCEÇÃO: o que for salvo ali entra no lugar da escada do organograma daquela pessoa. Ninguém fica bloqueado por falta de cadastro.',
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
          'O "Dashboard de Cartões" mostra quantidade por status, valores, o total por tipo de solicitação e quantos cartões são virtuais e quantos são físicos — estes precisam ser produzidos e entregues. Os reembolsos PF têm dashboard próprio, na outra área do menu. Toda solicitação exige o aceite dos Termos, guardado com autor e data/hora — um registro de auditoria que não pode ser alterado nem apagado.',
      },
      {
        icon: FilePlus2,
        titulo: "Você também abre solicitações",
        texto:
          "Como coordenador/gestor, você também pode abrir cartões e pedir aumentos, igual a qualquer solicitante. Os próximos passos mostram como fazer isso.",
      },
      ...FIN_SOLICITAR_STEPS,
      NOTIFICACOES,
      TROCAR_APP,
    ],
  },
};

// ============================ Administrativo ============================
// Abrir e acompanhar chamado é igual para todo mundo — esses passos são a base
// dos três papéis. O que muda é o que vem antes deles.
const ADM_USAR_STEPS = [
  {
    icon: Search,
    titulo: "Ache o serviço certo",
    texto:
      'Em "Abrir chamado" estão as classes de serviço. Clique numa e os serviços dela abrem numa janela; classe que tem um serviço só abre o formulário direto. Se você já sabe o que quer, use a busca do topo — digitar "uber", "EPI" ou "veículo" encontra o serviço sem precisar adivinhar em qual classe ele está.',
  },
  {
    icon: FilePlus2,
    titulo: "Preencha e envie",
    texto:
      "Cada serviço pede só o que faz sentido para ele: placa e KM na manutenção de veículo, origem e destino no Uber, datas na hospedagem. O assunto do chamado é preenchido sozinho, você não digita. Onde couber anexo, o botão está no fim do formulário.",
  },
  {
    icon: Users,
    titulo: "Mobilização: tudo num pedido só",
    texto:
      'Nova mobilização, movimentação e desmobilização vivem no mesmo formulário — o seletor do topo diz qual é. Ao escolher o profissional, o gestor vem do organograma sozinho. Em "Adicionais" ficam equipamento, software, EPI e uniforme: clique para expandir e marque só o que essa pessoa precisa. Tudo ali é opcional.',
  },
  {
    icon: List,
    titulo: "Acompanhe seus chamados",
    texto:
      'Em "Meus chamados" há duas abas: em andamento e fechados. Você vê o número do chamado, o técnico responsável, quando foi criado e o vencimento do prazo. Quando o serviço exige aprovação, o prazo só começa a contar depois que o gestor aprova — por isso a coluna "Análise" fica vazia até lá.',
  },
  {
    icon: ClipboardCheck,
    titulo: 'Aprovações: quando aparecem para você',
    texto:
      'Alguns serviços exigem liberação antes de virar tarefa do Administrativo, e quem libera é o superior direto de quem abriu. Se alguém da sua equipe abrir um desses, o chamado aparece em "Aprovações" com o pedido inteiro à vista. Aprovar solta o chamado e inicia o prazo; reprovar exige que você escreva o motivo.',
  },
];

export const ADMINISTRATIVO_GUIA = {
  appName: "Administrativo",
  fallbackRole: "user",
  roleLabels: { admin: "Administrador do Adm", atendente: "Atendente", user: "Solicitante" },
  contentByRole: {
    user: [
      {
        icon: Headset,
        titulo: "Bem-vindo ao Administrativo",
        texto:
          "Aqui você abre chamados para o setor Administrativo: mobilização de profissional, compras, frota, viagem e hospedagem, TI, manutenção e saúde e segurança. Toda demanda para o Adm passa por chamado — é o que garante prazo, responsável e histórico do pedido.",
      },
      ...ADM_USAR_STEPS,
      NOTIFICACOES,
      TROCAR_APP,
    ],
    atendente: [
      {
        icon: Headset,
        titulo: "Seu papel: atendente do Administrativo",
        texto:
          "Você faz parte do time do Adm, então os chamados dos serviços em que você é o responsável caem no seu nome — o solicitante vê o seu nome assim que salva o pedido. A tela de fila de atendimento, com as respostas ao solicitante e o fechamento do chamado, ainda está em construção; por enquanto você já aparece como técnico dos chamados abertos.",
      },
      ...ADM_USAR_STEPS,
      NOTIFICACOES,
      TROCAR_APP,
    ],
    admin: [
      {
        icon: ShieldCheck,
        titulo: "Seu papel: administrador do Administrativo",
        texto:
          "Além de abrir chamados como todo mundo, você configura como o módulo se comporta. É o único papel que enxerga a seção Administração no menu lateral.",
      },
      {
        icon: Settings,
        titulo: "Configure cada serviço antes de liberar",
        texto:
          'Em Administração → "Configuração" você define, para cada serviço: quem atende (o nome que aparece para o solicitante), o prazo de atendimento em dias úteis e se exige aprovação. Serviço sem configuração ainda funciona, mas o chamado nasce sem responsável e sem prazo — vale preencher antes de o time começar a usar.',
      },
      {
        icon: ClipboardCheck,
        titulo: "Como a aprovação funciona",
        texto:
          "Ao marcar um serviço como sujeito a aprovação, o chamado segue o fluxo cadastrado do solicitante ou, na falta dele, vai para o superior direto lido do organograma da Gestão de Pessoas. Quem não tem nenhum dos dois não consegue abrir o chamado — só a direção, que não tem a quem recorrer, passa direto. Serviços com gasto (compra, recarga de cartão, locação de imóvel) ignoram o fluxo e seguem a alçada por valor.",
      },
      {
        icon: Paperclip,
        titulo: "Onde os campos de cada serviço são definidos",
        texto:
          "Os campos que aparecem em cada formulário seguem o levantamento feito com o setor. Se algum serviço precisar de um campo novo, fale com o time do portal — a mudança é feita num arquivo de configuração, sem refazer a tela.",
      },
      ...ADM_USAR_STEPS,
      NOTIFICACOES,
      TROCAR_APP,
    ],
  },
};

// ============================ Programas ============================
// Passos comuns aos dois papéis: todo mundo participa dos dois programas —
// o que muda é quem AVALIA a Alavanca.
const PROGRAMAS_USAR_STEPS = [
  {
    icon: Lightbulb,
    titulo: "Campo de Ideias: ideia ou iniciativa",
    texto:
      'Em "Campo de Ideias" ficam os dois botões de registrar e a lista do que VOCÊ registrou. IDEIA é o que ainda não existe e você acha que a PHD deveria ter. INICIATIVA é o que você já está construindo, para uso próprio ou em projeto, mesmo sem a equipe de Inovação.',
  },
  {
    icon: LayoutDashboard,
    titulo: "O painel, o quadro e o mapa",
    texto:
      'O "Painel da Inovação" é a visão da empresa inteira, aberta a todos: filtros (setor, tipo e status), os números, o gráfico por setor — que separa ideias de iniciativas — e o quadro por tipo de uso. No quadro, a cor do cartão diz o setor e a cor da borda diz se é ideia ou iniciativa. Clicando em qualquer cartão ou linha você abre o registro completo, e quem cadastrou pode editar por ali mesmo. O menu separa as duas coisas: em "Menu" você participa, na seção "Dashboard" você lê os números — Painel da Inovação e, para o comercial, Painel da Alavanca.',
  },
  {
    icon: Rocket,
    titulo: "Alavanca PHD: indique e concorra à premiação",
    texto:
      'Em "Alavanca PHD" você indica uma oportunidade comercial. Antes do formulário é obrigatório ler e aceitar as regras do programa. Assim que você envia, o sistema confere a empresa e o contato contra a base do comercial e já responde se a indicação é elegível — e, quando não é, explica o motivo.',
  },
  {
    icon: Trophy,
    titulo: "Como a premiação funciona",
    texto:
      "Fechando contrato com o cliente indicado, a premiação é de 0,5% do valor, limitada a R$ 10.000,00, paga após o faturamento da primeira medição. Se o mesmo cliente for indicado por mais de uma pessoa, vale quem indicou primeiro. Você acompanha o andamento e o valor em \"Minhas indicações\".",
  },
];

export const PROGRAMAS_GUIA = {
  appName: "Programas",
  fallbackRole: "user",
  roleLabels: {
    admin: "Administrador dos Programas",
    comercial: "Time comercial",
    user: "Participante",
  },
  contentByRole: {
    user: [
      {
        icon: Sparkles,
        titulo: "Bem-vindo aos Programas",
        texto:
          "Aqui ficam os programas internos da PHD: o Campo de Ideias, para registrar o que você inventou ou está inventando, e a Alavanca PHD, para indicar oportunidades comerciais e concorrer à premiação do programa.",
      },
      ...PROGRAMAS_USAR_STEPS,
      NOTIFICACOES,
      TROCAR_APP,
    ],
    comercial: [
      {
        icon: Target,
        titulo: "Seu papel: time comercial",
        texto:
          'Além de participar dos dois programas como todo mundo, você enxerga o "Painel da Alavanca" no menu lateral — a fila de indicações de toda a empresa, que só o time comercial acessa.',
      },
      {
        icon: ListChecks,
        titulo: "O que fazer no painel",
        texto:
          'No mapa de indicações você muda o status e deixa comentários; qualquer um dos dois já conta a indicação como "evoluída", e a mudança de status manda um e-mail de retorno para quem indicou. Fique de olho nas marcadas como "Depende do comercial": são empresas já cadastradas com contato novo, e só você sabe se a oportunidade já tinha sido mapeada.',
      },
      {
        icon: Trophy,
        titulo: "Concluir e premiar",
        texto:
          'Ao marcar uma indicação como "Concluída", o sistema pede o valor do contrato e calcula a premiação (0,5%, teto de R$ 10.000). O valor é obrigatório e continua editável, caso o efetivo seja diferente. A partir daí a indicação entra no Mapa de vencedores, com nome, valor e data de pagamento.',
      },
      ...PROGRAMAS_USAR_STEPS,
      NOTIFICACOES,
      TROCAR_APP,
    ],
    admin: [
      {
        icon: ShieldCheck,
        titulo: "Seu papel: administrador dos Programas",
        texto:
          "Você faz tudo o que o time comercial faz na Alavanca e, no Campo de Ideias, pode atualizar a situação de qualquer registro — não só dos seus. É o papel que destrava o mapa inteiro.",
      },
      {
        icon: Target,
        titulo: "O painel da Alavanca é seu também",
        texto:
          'O "Painel da Alavanca" no menu lateral traz a fila de indicações de toda a empresa: elegibilidade, status, comentários e a premiação de cada uma.',
      },
      ...PROGRAMAS_USAR_STEPS,
      NOTIFICACOES,
      TROCAR_APP,
    ],
  },
};

// ============================ Estoque ============================
// Dois papéis: quem só CONSULTA (todo mundo) e quem OPERA o almoxarifado
// (o time do Administrativo, por administrativo_role).
//
// O guia carrega mais peso aqui que nos outros módulos porque o vocabulário é
// novo: "variação" não é sinônimo de item, e o saldo não se digita.

const ESTOQUE_CONSULTAR = {
  icon: Search,
  titulo: "Consultar o que tem",
  texto:
    'Em "Posição de estoque" está o saldo de cada item. A busca casa nome, tamanho e CA ao mesmo tempo — dá para procurar "botina 42" ou só "45021". O filtro "Precisa repor" mostra de uma vez o que está zerado ou abaixo do mínimo.',
};

const ESTOQUE_VARIACAO = {
  icon: Boxes,
  titulo: 'Item e "variação" são coisas diferentes',
  texto:
    'O item é o nome ("BOTINA COM METATARSO"); a variação é o que de fato tem saldo, e inclui tamanho, CA, gênero e setor. Botina 39 e botina 43 são variações distintas, e respirador CA 45021 não substitui o CA 12011 num laudo — por isso cada um tem seu próprio saldo, e a busca sempre mostra esses detalhes embaixo do nome.',
};

const ESTOQUE_PEDIR = {
  icon: Headset,
  titulo: "Pedir EPI ou uniforme continua no Administrativo",
  texto:
    'O pedido é feito como sempre, em Administrativo → Saúde e segurança. A diferença é que agora dá para escolher o item do catálogo, com a quantidade — e o saldo aparece ao lado. Falta de estoque NÃO impede o pedido: se o item está zerado ou nem existe no catálogo, peça do mesmo jeito (há um campo de texto livre para isso). É o pedido que avisa o Administrativo de que precisa comprar.',
};

const ESTOQUE_NOTIFICACAO = {
  icon: Bell,
  titulo: "O sino avisa quando um item acaba",
  texto:
    "Quando uma saída deixa um item zerado ou abaixo do mínimo, o time do Administrativo recebe um aviso no sino da barra do topo, com link direto para a lista do que precisa repor. Não é preciso ficar olhando o painel.",
};

export const ESTOQUE_GUIA = {
  appName: "Estoque",
  fallbackRole: "user",
  roleLabels: {
    admin: "Almoxarifado",
    atendente: "Almoxarifado",
    user: "Consulta",
  },
  contentByRole: {
    user: [
      {
        icon: Boxes,
        titulo: "Bem-vindo ao Estoque",
        texto:
          "Aqui fica o almoxarifado de EPIs e uniformes da PHD, no lugar das planilhas. Você pode consultar o que existe e quanto tem; quem movimenta o material é o time do Administrativo.",
      },
      ESTOQUE_CONSULTAR,
      ESTOQUE_VARIACAO,
      ESTOQUE_PEDIR,
      {
        icon: List,
        titulo: "O que você já recebeu",
        texto:
          'Em "Movimentações" aparece o que saiu para o seu nome e o que foi entregue nos seus chamados — a sua ficha de EPI, que antes só existia numa aba de planilha.',
      },
      NOTIFICACOES,
      TROCAR_APP,
    ],
    atendente: [
      {
        icon: PackageCheck,
        titulo: "Seu papel: almoxarifado",
        texto:
          "Além de consultar, você movimenta o estoque: registra entrada, entrega material e faz inventário. Toda saída fica registrada no nome de quem recebeu.",
      },
      ESTOQUE_CONSULTAR,
      ESTOQUE_VARIACAO,
      {
        icon: ArrowDownToLine,
        titulo: "Entrada: material que chegou",
        texto:
          'Em "Entrada" você lança o que foi recebido, com o motivo e o número da nota. O saldo NUNCA é digitado direto na tabela: ele é sempre a soma dos movimentos, e é isso que permite responder depois "de onde veio esse número".',
      },
      {
        icon: ArrowUpFromLine,
        titulo: "Saída: entrega com dono",
        texto:
          'Em "Saída" você registra a entrega, e informar quem recebeu é obrigatório. Se a entrega atende a um chamado, escolha o chamado no topo da tela: os itens pedidos entram sozinhos no carrinho e o chamado é FECHADO junto com a baixa, numa operação só.',
      },
      {
        icon: ClipboardCheck,
        titulo: "Inventário: quando a prateleira discorda",
        texto:
          'Em "Inventário" você digita o que CONTOU, não a diferença. Só o que divergir do sistema vira ajuste, e item deixado em branco não é tocado — dá para conferir uma prateleira por vez, sem precisar contar o almoxarifado inteiro.',
      },
      {
        icon: Headset,
        titulo: "Dar baixa direto pelo chamado",
        texto:
          'Ao fechar um chamado de EPI ou uniforme no Administrativo, aparece o card "Baixa no estoque" com o que foi pedido, o que já foi entregue e o saldo de cada item. Ajuste as quantidades e feche: o chamado fecha e o estoque desconta juntos. Se não houver o que baixar (item comprado direto, pedido negado), marque "Fechar sem movimentar o estoque".',
      },
      {
        icon: Search,
        titulo: "Conferir o saldo sem sair do chamado",
        texto:
          'Dentro do chamado, o card "Consultar estoque" responde se tem o item antes de você prometer a entrega — e na lista de itens pedidos a coluna "Em estoque" já avisa quando falta ("3 · faltam 2").',
      },
      ESTOQUE_NOTIFICACAO,
      {
        icon: AlertTriangle,
        titulo: "Movimento não se apaga",
        texto:
          "Entrada, saída e ajuste são registros definitivos: não dá para editar nem excluir. Errou? Lance o movimento contrário, ou corrija pelo inventário. É o que mantém o histórico explicando o saldo.",
      },
      NOTIFICACOES,
      TROCAR_APP,
    ],
    admin: [
      {
        icon: ShieldCheck,
        titulo: "Seu papel: administrador do Estoque",
        texto:
          "Você faz tudo o que o almoxarifado faz e mais o cadastro: criar itens e variações, definir estoque mínimo e máximo, custo unitário, e desativar o que saiu de linha.",
      },
      {
        icon: FileSpreadsheet,
        titulo: "Carregar o catálogo da planilha",
        texto:
          'Em "Importar planilha" você sobe as planilhas de EPIs e uniformes. Antes de gravar, a tela mostra tudo que será criado, linha a linha, e o que não deu para ler. Pode ser repetido: item que já existe não é duplicado, e saldo diferente vira ajuste — não uma segunda entrada.',
      },
      {
        icon: AlertTriangle,
        titulo: "Mínimo e máximo mandam no alerta",
        texto:
          'O estoque mínimo é o que define "precisa repor" — no painel, nos gráficos e no aviso do sino. Sem mínimo cadastrado, um item só é sinalizado quando zera, e aí já é tarde. Vale preencher ao menos nos itens de giro.',
      },
      ESTOQUE_CONSULTAR,
      ESTOQUE_VARIACAO,
      {
        icon: BarChart3,
        titulo: "Indicadores",
        texto:
          'Em "Indicadores" ficam o que repor primeiro (por quanto falta, não por quanto tem), o consumo mês a mês, os itens que mais saem, as entregas por colaborador e o valor imobilizado. O cartão "chamados aguardando entrega" é o que liga os dois módulos.',
      },
      ESTOQUE_NOTIFICACAO,
      NOTIFICACOES,
      TROCAR_APP,
    ],
  },
};
