import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout/Layout';
import { FeedbackProvider } from '../modules/reembolso/context/FeedbackContext';
import ReembolsoAppLayout from '../modules/reembolso/components/layout/AppLayout';
import SolicShell from '../modules/solic/app/components/AppShell';
import HorasShell from '../modules/horas/app/components/AppShell';
import { rotaInicial } from '../modules/horas/app/components/nav';

const Login = lazy(() => import('../pages/Login/Login'));
const Home = lazy(() => import('../pages/Home/Home'));
const PortalAdmin = lazy(() => import('../pages/PortalAdmin/PortalAdmin'));
const AdminCadastro = lazy(() => import('../pages/Admin/AdminCadastro'));
const AdminListagem = lazy(() => import('../pages/Admin/AdminListagem'));
const GestorDashboard = lazy(() => import('../pages/Gestor/GestorDashboard'));
const GestorAprovacoes = lazy(() => import('../pages/Gestor/GestorAprovacoes'));
const GestorDetalhes = lazy(() => import('../pages/Gestor/GestorDetalhes'));
const GestorEquipe = lazy(() => import('../pages/Gestor/GestorEquipe'));
const GestorAusencia = lazy(() => import('../pages/Gestor/GestorAusencia'));
const RequisicoesHub = lazy(() => import('../pages/Gestor/requisicoes/RequisicoesHub'));
const NovaRequisicao = lazy(() => import('../pages/Gestor/requisicoes/NovaRequisicao'));
const AcompanharRequisicoes = lazy(() => import('../pages/Gestor/requisicoes/AcompanharRequisicoes'));
const ConsultaOrganograma = lazy(() => import('../pages/Gestor/organograma/ConsultaOrganograma'));
const UsuarioDashboard = lazy(() => import('../pages/Usuario/UsuarioDashboard'));
const AdminSolicitacoes = lazy(() => import('../pages/Admin/AdminSolicitacoes'));
const AdminFluxos = lazy(() => import('../pages/Admin/AdminFluxos'));
const Reembolsos = lazy(() => import('../modules/reembolso/pages/Reembolsos'));
const ReembolsoForm = lazy(() => import('../modules/reembolso/pages/ReembolsoForm'));
const ReembolsoDetail = lazy(() => import('../modules/reembolso/pages/ReembolsoDetail'));
const PrestacaoContas = lazy(() => import('../modules/reembolso/pages/PrestacaoContas'));
const SolicDashboard = lazy(() => import('../modules/solic/app/dashboard/page'));
const SolicSurvey = lazy(() => import('../modules/solic/app/survey/page'));
const SolicSurveyNew = lazy(() => import('../modules/solic/app/surveys/new/page'));
const SolicAsset = lazy(() => import('../modules/solic/app/asset/page'));
const SolicAdminRequests = lazy(() => import('../modules/solic/app/admin/requests/page'));
const SolicAdminPrazos = lazy(() => import('../modules/solic/app/admin/prazos/page'));
const SolicAdminCadastros = lazy(() => import('../modules/solic/app/admin/cadastros/page'));
const SolicAdminUsuarios = lazy(() => import('../modules/solic/app/admin/usuarios/page'));
const SolicAdminContractNew = lazy(() => import('../modules/solic/app/admin/contracts/new/page'));
const HorasApontar = lazy(() => import('../modules/horas/app/apontar/page'));
const HorasRegistros = lazy(() => import('../modules/horas/app/registros/page'));
const HorasDashboard = lazy(() => import('../modules/horas/app/dashboard/page'));
const HorasConfig = lazy(() => import('../modules/horas/app/config/page'));
const HorasEquipe = lazy(() => import('../modules/horas/app/equipe/page'));

function RouteFallback() {
  return <div style={{ padding: 'var(--space-3xl)', textAlign: 'center' }}>Carregando...</div>;
}

// Índice do Controle de Horas: usuário/gerente caem em "Apontar", a diretoria
// (que não aponta) cai no Dashboard Geral.
function HorasIndex() {
  const { modules } = useAuth();
  return <Navigate to={rotaInicial(modules?.horas || 'usuario')} replace />;
}

function LazyPage({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, blocked, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (blocked) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.perfil)) {
    return <Navigate to="/home" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (user) return <Navigate to="/home" replace />;
  return children;
}

export function ModuleRoute({ module, children }) {
  const { modules } = useAuth();
  if (!modules[module]) return <Navigate to="/home" replace />;
  return children;
}

function SolicAdminRoute({ children }) {
  const { modules } = useAuth();
  if (modules.solic !== 'admin') return <Navigate to="/solic/dashboard" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LazyPage>
                <Login />
              </LazyPage>
            </PublicRoute>
          }
        />

        {/* Home do portal: tela cheia, fora do Layout do DP (sem sidebar/header) */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Home />
              </LazyPage>
            </ProtectedRoute>
          }
        />

        {/* Gerenciamento de acessos do portal — só o super-admin (gate na própria página) */}
        <Route
          path="/portal-admin"
          element={
            <ProtectedRoute>
              <LazyPage>
                <PortalAdmin />
              </LazyPage>
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >

          <Route
            path="/admin/cadastro"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['admin']}>
                  <LazyPage>
                    <AdminCadastro />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/admin/listagem"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['admin']}>
                  <LazyPage>
                    <AdminListagem />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/admin/solicitacoes"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['admin']}>
                  <LazyPage>
                    <AdminSolicitacoes />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/admin/fluxos"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['admin']}>
                  <LazyPage>
                    <AdminFluxos />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />

          <Route
            path="/gestor"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'coordenador']}>
                  <LazyPage>
                    <GestorDashboard />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/gestor/aprovacoes"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'coordenador']}>
                  <LazyPage>
                    <GestorAprovacoes />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/gestor/aprovacoes/:id"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'coordenador']}>
                  <LazyPage>
                    <GestorDetalhes />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/gestor/equipe"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'coordenador']}>
                  <LazyPage>
                    <GestorEquipe />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/gestor/ausencia"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'coordenador']}>
                  <LazyPage>
                    <GestorAusencia />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/gestor/minha-ausencia"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'coordenador']}>
                  <LazyPage>
                    <UsuarioDashboard />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/gestor/solicitacoes"
            element={
              <ModuleRoute module="dp">
                <Navigate to="/gestor/solicitacoes/nova" replace />
              </ModuleRoute>
            }
          />
          <Route
            path="/gestor/solicitacoes/nova"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'coordenador', 'rh']}>
                  <LazyPage>
                    <RequisicoesHub />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/gestor/solicitacoes/nova/:tipo"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'coordenador', 'rh']}>
                  <LazyPage>
                    <NovaRequisicao />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/gestor/solicitacoes/acompanhar"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'coordenador', 'rh']}>
                  <LazyPage>
                    <AcompanharRequisicoes />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />

          <Route
            path="/organograma"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'coordenador', 'admin', 'rh']}>
                  <LazyPage>
                    <ConsultaOrganograma />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />

          <Route
            path="/usuario"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['usuario']}>
                  <LazyPage>
                    <UsuarioDashboard />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <ModuleRoute module="reembolso">
                <FeedbackProvider>
                  <ReembolsoAppLayout />
                </FeedbackProvider>
              </ModuleRoute>
            </ProtectedRoute>
          }
        >
          <Route path="/reembolsos" element={<LazyPage><Reembolsos kind="reembolso" /></LazyPage>} />
          <Route path="/reembolsos/novo" element={<LazyPage><ReembolsoForm kind="reembolso" /></LazyPage>} />
          <Route path="/reembolsos/:id/editar" element={<LazyPage><ReembolsoForm kind="reembolso" /></LazyPage>} />
          <Route path="/reembolsos/:id" element={<LazyPage><ReembolsoDetail /></LazyPage>} />
          <Route path="/adiantamentos" element={<LazyPage><Reembolsos kind="adiantamento" /></LazyPage>} />
          <Route path="/adiantamentos/novo" element={<LazyPage><ReembolsoForm kind="adiantamento" /></LazyPage>} />
          <Route path="/adiantamentos/:id/editar" element={<LazyPage><ReembolsoForm kind="adiantamento" /></LazyPage>} />
          <Route path="/adiantamentos/:id" element={<LazyPage><ReembolsoDetail /></LazyPage>} />
          <Route path="/adiantamentos/:id/prestar-contas" element={<LazyPage><PrestacaoContas /></LazyPage>} />
        </Route>

        <Route
          path="/solic"
          element={
            <ProtectedRoute>
              <ModuleRoute module="solic">
                <SolicShell />
              </ModuleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/solic/dashboard" replace />} />
          <Route path="dashboard" element={<LazyPage><SolicDashboard /></LazyPage>} />
          <Route path="survey" element={<LazyPage><SolicSurvey /></LazyPage>} />
          <Route path="surveys/new" element={<LazyPage><SolicSurveyNew /></LazyPage>} />
          <Route path="asset" element={<LazyPage><SolicAsset /></LazyPage>} />
          <Route path="admin/requests" element={<SolicAdminRoute><LazyPage><SolicAdminRequests /></LazyPage></SolicAdminRoute>} />
          <Route path="admin/prazos" element={<SolicAdminRoute><LazyPage><SolicAdminPrazos /></LazyPage></SolicAdminRoute>} />
          <Route path="admin/cadastros" element={<SolicAdminRoute><LazyPage><SolicAdminCadastros /></LazyPage></SolicAdminRoute>} />
          <Route path="admin/usuarios" element={<SolicAdminRoute><LazyPage><SolicAdminUsuarios /></LazyPage></SolicAdminRoute>} />
          <Route path="admin/contracts/new" element={<SolicAdminRoute><LazyPage><SolicAdminContractNew /></LazyPage></SolicAdminRoute>} />
        </Route>

        <Route
          path="/horas"
          element={
            <ProtectedRoute>
              {/* Módulo aberto a todos os usuários logados (sem gate de permissão). */}
              <HorasShell />
            </ProtectedRoute>
          }
        >
          {/* A diretoria não aponta horas: o índice depende do papel. */}
          <Route index element={<HorasIndex />} />
          <Route path="apontar" element={<LazyPage><HorasApontar /></LazyPage>} />
          <Route path="dashboard" element={<LazyPage><HorasDashboard /></LazyPage>} />
          <Route path="registros" element={<LazyPage><HorasRegistros /></LazyPage>} />
          <Route path="config" element={<LazyPage><HorasConfig /></LazyPage>} />
          <Route path="equipe" element={<LazyPage><HorasEquipe /></LazyPage>} />
          {/* Rota antiga de Projetos: virou a aba Configuração. */}
          <Route path="projetos" element={<Navigate to="/horas/config" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </HashRouter>
  );
}
