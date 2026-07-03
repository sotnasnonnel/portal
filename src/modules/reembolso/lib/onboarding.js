// Tutorial de boas-vindas por papel. Mostra no primeiro login (o "visto" é
// gravado no perfil, em reembolso_profiles.onboarding_seen_at) e pode ser
// reaberto pelo botão na sidebar.
import {
  Camera,
  Check,
  CircleDollarSign,
  Clock,
  FileDown,
  FileText,
  Receipt,
  Send,
  ThumbsUp,
  Wallet,
} from "lucide-react";

export const ONBOARDING_OPEN_EVENT = "reembolso:open-onboarding";

// Reabre o guia de qualquer lugar (ex.: botão de ajuda na sidebar).
// Dispara o evento unificado consumido pelo GuiaModal compartilhado.
export function openOnboarding() {
  window.dispatchEvent(new Event("abrir_guia"));
}

export const ONBOARDING = {
  solicitante: {
    title: "Bem-vindo ao PHD Reembolso",
    steps: [
      {
        icon: Receipt,
        title: "Solicite suas despesas",
        body: "Aqui você cria pedidos de reembolso e adiantamento das suas despesas e acompanha tudo num só lugar.",
      },
      {
        icon: Camera,
        title: "Crie um pedido",
        body: 'Toque em "Novo reembolso", preencha o cabeçalho e adicione os itens. No reembolso dá pra tirar foto ou importar a NF — a IA preenche os itens pra você.',
      },
      {
        icon: Clock,
        title: "Acompanhe o status",
        body: "Na lista você vê se o pedido está Aguardando Aprovação, Aprovado ou Reprovado.",
      },
      {
        icon: Send,
        title: "Foi reprovado? Reenvie",
        body: "Se o gestor reprovar, você vê o motivo, ajusta o que for preciso e reenvia para aprovação.",
      },
    ],
  },
  gestor: {
    title: "Bem-vindo, gestor",
    steps: [
      {
        icon: Check,
        title: "Aprove os pedidos da equipe",
        body: "Você analisa e decide os reembolsos e adiantamentos dos seus liderados.",
      },
      {
        icon: Clock,
        title: "Sua fila de aprovação",
        body: 'Você já abre a lista em "Aguardando Aprovação". Abra um pedido para conferir os itens e as notas anexadas.',
      },
      {
        icon: ThumbsUp,
        title: "Aprovar ou reprovar",
        body: "Aprove com um clique. Ao reprovar, escreva a justificativa — ela volta para o solicitante ajustar e reenviar.",
      },
      {
        icon: Receipt,
        title: "Você também pode solicitar",
        body: "Seus próprios pedidos já entram aprovados automaticamente, sem precisar de outro gestor.",
      },
    ],
  },
  admin: {
    title: "Bem-vindo, administrador",
    steps: [
      {
        icon: Wallet,
        title: "Visão geral e pagamentos",
        body: "Você enxerga todos os pedidos e cuida da etapa de pagamento.",
      },
      {
        icon: CircleDollarSign,
        title: "O que falta pagar",
        body: 'Você inicia em "Aprovados". O cartão "A pagar" mostra os aprovados que ainda não foram pagos.',
      },
      {
        icon: FileDown,
        title: "Agende e gere o PDF",
        body: "No detalhe de um pedido aprovado, defina a data de pagamento e gere o PDF com as NFs anexadas.",
      },
      {
        icon: FileText,
        title: "Reembolsos e Adiantamentos",
        body: "Tudo isso vale para as duas abas no menu lateral.",
      },
    ],
  },
};
