import { LayoutDashboard, Building2, CalendarDays, FilePlus2, BarChart3 } from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import { clearSupabaseCache } from "@/lib/supabaseCache";
import { clearSolicIdentity } from "@/lib/identity";
import ModuleSidebar from "../../../../components/Layout/ModuleSidebar";

// Sidebar do PMO — estrutura no componente compartilhado ModuleSidebar, o mesmo
// dos outros módulos (padrão do Financeiro: grupos colapsáveis + seções).
// collapsed/onToggle recolhem no desktop; aberto/onFechar controlam o drawer no
// mobile (o ☰ do PortalHeader — ver src/hooks/useDrawerMobile.js).
export function Sidebar({
  collapsed = false,
  onToggle,
  aberto = false,
  onFechar,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  aberto?: boolean;
  onFechar?: () => void;
}) {
  // Perfil vem do shell (já resolvido antes da rota abrir): síncrono, sem flicker
  // de menu usuário→admin nem consulta repetida ao banco.
  const { logout, solicProfile } = useAuth();
  const isAdmin = solicProfile?.role === "admin";

  const secoes = [
    {
      label: "Solicitações",
      group: true,
      key: "solicitacoes",
      Icon: BarChart3,
      items: isAdmin
        ? [{ label: "Dashboard", href: "/solic/dashboard", Icon: LayoutDashboard }]
        : [
            { label: "Dashboard", href: "/solic/dashboard", Icon: LayoutDashboard },
            { label: "Nova Solicitação", href: "/solic/surveys/new", Icon: FilePlus2 },
          ],
    },
    ...(isAdmin
      ? [
          {
            label: "Administração",
            key: "admin",
            items: [
              { label: "Empresas", href: "/solic/admin/cadastros", Icon: Building2 },
              { label: "Prazos", href: "/solic/admin/prazos", Icon: CalendarDays },
            ],
          },
        ]
      : []),
  ];

  const onLogout = async () => {
    clearSupabaseCache();
    clearSolicIdentity();
    await logout();
  };

  return (
    <ModuleSidebar
      moduloKey="solic"
      titulo="PMO"
      Icon={BarChart3}
      secoes={secoes}
      papelLabel={isAdmin ? "Administrador" : "Usuário"}
      aberto={aberto}
      onFechar={onFechar}
      collapsed={collapsed}
      onToggleCollapse={onToggle}
      onLogout={onLogout}
    />
  );
}
