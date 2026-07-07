import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import PortalHeader from '../PortalHeader/PortalHeader';
import GuiaModal from '../Guia/GuiaModal';
import { DP_GUIA } from '../Guia/guides';
import { supabase } from '../../services/supabase';
import { getEquipeIds } from '../../services/equipe';
import { acaoDisponivel, APROVADORES } from '../../config/aprovacao';
import './Layout.css';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Recolher a sidebar no desktop (libera largura). Persistido entre sessões.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('dp-sidebar-collapsed') === '1'; } catch { return false; }
  });
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [solicitacaoCount, setSolicitacaoCount] = useState(0);

  useEffect(() => {
    try { localStorage.setItem('dp-sidebar-collapsed', collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  // No desktop, o botão de menu recolhe/expande a sidebar; no mobile, abre o drawer.
  const handleMenuToggle = () => {
    if (window.innerWidth > 768) setCollapsed((prev) => !prev);
    else setSidebarOpen((prev) => !prev);
  };

  const handleMenuClose = () => {
    setSidebarOpen(false);
  };

  const fetchPendingCount = async () => {
    if (user?.perfil !== 'gestor' && user?.perfil !== 'coordenador') return;
    try {
      const ids = await getEquipeIds();
      if (!ids.length) { setPendingCount(0); return; }
      const { count, error } = await supabase
        .from('ciclos_ausencia')
        .select('*', { count: 'exact', head: true })
        .in('colaborador_id', ids)
        .eq('status_atual', 'Marcação Pendente')
        .not('ausencia_agendada_inicio', 'is', null);

      if (!error) setPendingCount(count || 0);
    } catch (err) {
      console.error('Erro ao contar pendências:', err);
    }
  };

  const fetchSolicitacaoCount = async () => {
    if (!['admin', 'gestor', 'coordenador', 'rh'].includes(user?.perfil)) return;
    const { data, error } = await supabase
      .from('solicitacoes_rh')
      .select('id, gestor_id, status, concluida_em, etapas:solicitacoes_rh_etapas(id, ordem, aprovador_id, tipo_etapa, status)');
    if (error) return;
    const lista = data || [];

    // parcela 1: requisições aguardando a ação do usuário
    let aguardando = 0;
    if (user.perfil === 'gestor' || user.perfil === 'coordenador') {
      aguardando = lista.filter((s) => acaoDisponivel(user.id, s.etapas) !== null).length;
    } else if (user.perfil === 'admin') {
      // a execução é fixada no admin executor; qualquer admin deve ver o badge de executar
      aguardando = lista.filter(
        (s) => acaoDisponivel(APROVADORES.admin, s.etapas) !== null || acaoDisponivel(user.id, s.etapas) !== null
      ).length;
    }

    // parcela 2: requisições concluídas desde a última visita
    const visto = user.solicVistoEm ? new Date(user.solicVistoEm).getTime() : 0;
    const novasConcluidas = lista.filter((s) => {
      if (s.status !== 'concluida' || !s.concluida_em) return false;
      if (new Date(s.concluida_em).getTime() <= visto) return false;
      return ['gestor', 'coordenador'].includes(user.perfil) ? s.gestor_id === user.id : true; // admin/rh: todas
    }).length;

    setSolicitacaoCount(aguardando + novasConcluidas);
  };

  useEffect(() => {
    fetchPendingCount();

    const handleUpdate = () => fetchPendingCount();
    window.addEventListener('aprovacoes_atualizadas', handleUpdate);

    return () => {
      window.removeEventListener('aprovacoes_atualizadas', handleUpdate);
    };
  }, [user]);

  useEffect(() => {
    fetchSolicitacaoCount();

    const handleSolUpdate = () => fetchSolicitacaoCount();
    window.addEventListener('solicitacoes_rh_atualizadas', handleSolUpdate);

    return () => {
      window.removeEventListener('solicitacoes_rh_atualizadas', handleSolUpdate);
    };
  }, [user]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`layout ${collapsed ? 'layout-collapsed' : ''}`}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleMenuClose}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        pendingCount={pendingCount}
        solicitacaoCount={solicitacaoCount}
      />
      <div className="layout-content">
        <PortalHeader userName={user?.nome} onMenuToggle={handleMenuToggle} />
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
      <GuiaModal {...DP_GUIA} role={user?.perfil} userName={user?.nome} />
    </div>
  );
}
