import { useLocation } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { areaDaRota, navSections } from './nav';

// Sidebar do Financeiro — a estrutura (grupos colapsáveis + seções) vive no
// componente compartilhado ModuleSidebar, usado por todos os módulos.
// aberto/onFechar controlam o drawer no mobile; ver useDrawerMobile.js.
//
// Também é a sidebar do Reembolso: o AppLayout de lá importa esta daqui, e é
// por isso que o menu segue a ROTA — dentro dos Cartões só aparecem os Cartões,
// dentro do Reembolso só o Reembolso. Trocar de área é decisão que se toma no
// card "Financeiro" da Home, não no meio do menu.
export default function Sidebar({ aberto = false, onFechar }) {
  const { modules } = useAuth();
  const pathname = useLocation().pathname || '';

  // Quem já tem acesso ao módulo pode abrir solicitações (o acesso em si já é
  // restrito por cargo/financeiro_role no ModuleRoute).
  const canAbrir = !!modules?.financeiro;
  const isAdmin = modules?.financeiro === 'admin';
  const secoes = navSections({
    canAbrir,
    isAdmin,
    temFinanceiro: !!modules?.financeiro,
    temReembolso: !!modules?.reembolso,
    // Solicitante não vê painel: 'gestor' aprova a equipe e 'admin' paga.
    vePainelReembolso: modules?.reembolso === 'admin' || modules?.reembolso === 'gestor' || isAdmin,
    area: areaDaRota(pathname),
  });

  return (
    <ModuleSidebar
      moduloKey="financeiro"
      titulo="Financeiro"
      Icon={Wallet}
      secoes={secoes}
      papelLabel="Financeiro"
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
