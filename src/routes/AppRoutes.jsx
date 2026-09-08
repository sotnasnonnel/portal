import { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazyPagina } from '../utils/lazyPagina';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout/Layout';
import { FeedbackProvider } from '../modules/reembolso/context/FeedbackContext';
import ReembolsoAppLayout from '../modules/reembolso/components/layout/AppLayout';
import SolicShell from '../modules/solic/app/components/AppShell';
import HorasShell from '../modules/horas/app/components/AppShell';
import { rotaInicial } from '../modules/horas/app/components/nav';
import { isHorasExtrasDp } from '../config/horasExtras';
import FinanceiroShell from '../modules/financeiro/app/components/AppShell';
import AdministrativoShell from '../modules/administrativo/app/components/AppShell';
import { podeAcessarAdm } from '../config/administrativo';
import ProgramasShell from '../modules/programas/app/components/AppShell';
import { podeAcessarProgramas } from '../config/programas';
import EstoqueShell from '../modules/estoque/app/components/AppShell';
import { podeAcessarEstoque } from '../config/estoque';
import MobilizacaoShell from '../modules/mobilizacao/app/components/AppShell';
import { podeAcessarMobilizacao } from '../config/mobilizacao';
import TorreShell from '../modules/torre/app/components/AppShell';
import { podeVerTorre } from '../config/torre';

const Login = lazyPagina(() => import('../pages/Login/Login'));
const Home = lazyPagina(() => import('../pages/Home/Home'));
const PortalAdmin = lazyPagina(() => import('../pages/PortalAdmin/PortalAdmin'));
const FaleConoscoCaixa = lazyPagina(() => import('../pages/FaleConosco/FaleConoscoCaixa'));
const AdminCadastro = lazyPagina(() => import('../pages/Admin/AdminCadastro'));
const AdminListagem = lazyPagina(() => import('../pages/Admin/AdminListagem'));
const GestorDashboard = lazyPagina(() => import('../pages/Gestor/GestorDashboard'));
const GestorAprovacoes = lazyPagina(() => import('../pages/Gestor/GestorAprovacoes'));
const GestorDetalhes = lazyPagina(() => import('../pages/Gestor/GestorDetalhes'));
const GestorEquipe = lazyPagina(() => import('../pages/Gestor/GestorEquipe'));
const GestorAusencia = lazyPagina(() => import('../pages/Gestor/GestorAusencia'));
const RequisicoesHub = lazyPagina(() => import('../pages/Gestor/requisicoes/RequisicoesHub'));
const NovaRequisicao = lazyPagina(() => import('../pages/Gestor/requisicoes/NovaRequisicao'));
const AcompanharRequisicoes = lazyPagina(() => import('../pages/Gestor/requisicoes/AcompanharRequisicoes'));
const ConsultaOrganograma = lazyPagina(() => import('../pages/Gestor/organograma/ConsultaOrganograma'));
const AjustesValores = lazyPagina(() => import('../pages/Gestor/valores/AjustesValores'));
const UsuarioDashboard = lazyPagina(() => import('../pages/Usuario/UsuarioDashboard'));
const AdminSolicitacoes = lazyPagina(() => import('../pages/Admin/AdminSolicitacoes'));
const AdminFluxos = lazyPagina(() => import('../pages/Admin/AdminFluxos'));
const Reembolsos = lazyPagina(() => import('../modules/reembolso/pages/Reembolsos'));
const ReembolsoForm = lazyPagina(() => import('../modules/reembolso/pages/ReembolsoForm'));
const ReembolsoDetail = lazyPagina(() => import('../modules/reembolso/pages/ReembolsoDetail'));
const PrestacaoContas = lazyPagina(() => import('../modules/reembolso/pages/PrestacaoContas'));
const DashboardReembolso = lazyPagina(() => import('../modules/reembolso/pages/DashboardReembolso'));
const SolicDashboard = lazyPagina(() => import('../modules/solic/app/dashboard/page'));
const SolicSurvey = lazyPagina(() => import('../modules/solic/app/survey/page'));
const SolicSurveyNew = lazyPagina(() => import('../modules/solic/app/surveys/new/page'));
const SolicAsset = lazyPagina(() => import('../modules/solic/app/asset/page'));
const SolicAdminRequests = lazyPagina(() => import('../modules/solic/app/admin/requests/page'));
const SolicAdminPrazos = lazyPagina(() => import('../modules/solic/app/admin/prazos/page'));
const SolicAdminCadastros = lazyPagina(() => import('../modules/solic/app/admin/cadastros/page'));
const SolicAdminUsuarios = lazyPagina(() => import('../modules/solic/app/admin/usuarios/page'));
const SolicAdminContractNew = lazyPagina(() => import('../modules/solic/app/admin/contracts/new/page'));
const HorasApontar = lazyPagina(() => import('../modules/horas/app/apontar/page'));
const HorasRegistros = lazyPagina(() => import('../modules/horas/app/registros/page'));
const HorasDashboard = lazyPagina(() => import('../modules/horas/app/dashboard/page'));
const HorasConfig = lazyPagina(() => import('../modules/horas/app/config/page'));
const HorasConfigApontamento = lazyPagina(() => import('../modules/horas/app/config/apontamento/page'));
const HorasConfigProjetos = lazyPagina(() => import('../modules/horas/app/config/projetos/page'));
const HorasEquipe = lazyPagina(() => import('../modules/horas/app/equipe/page'));
const HorasExtrasNova = lazyPagina(() => import('../modules/horas/app/extras/nova/page'));
const HorasExtrasMinhas = lazyPagina(() => import('../modules/horas/app/extras/minhas/page'));
const HorasExtrasAprovacoes = lazyPagina(() => import('../modules/horas/app/extras/aprovacoes/page'));
// Tratamento do DP das horas extras: vive no módulo Gestão de Pessoas.
const PainelHorasExtras = lazyPagina(() => import('../pages/Admin/HorasExtras/PainelHorasExtras'));
const ExcecoesPrazoHE = lazyPagina(() => import('../pages/Admin/HorasExtras/ExcecoesPrazo'));
const AuditoriaHE = lazyPagina(() => import('../pages/Admin/HorasExtras/AuditoriaHorasExtras'));
const FinanceiroCartoes = lazyPagina(() => import('../modules/financeiro/app/cartoes/page'));
const FinanceiroDashboard = lazyPagina(() => import('../modules/financeiro/app/dashboard/page'));
const FinanceiroHub = lazyPagina(() => import('../modules/financeiro/app/solicitacoes/hub/page'));
const NovaSolicitacaoFin = lazyPagina(() => import('../modules/financeiro/app/solicitacoes/nova/page'));
const AcompanharFin = lazyPagina(() => import('../modules/financeiro/app/solicitacoes/acompanhar/page'));
const FinanceiroFluxos = lazyPagina(() => import('../modules/financeiro/app/fluxos/page'));
const CatalogoAdm = lazyPagina(() => import('../modules/administrativo/app/catalogo/page'));
const NovoChamadoAdm = lazyPagina(() => import('../modules/administrativo/app/novo/page'));
const MeusChamadosAdm = lazyPagina(() => import('../modules/administrativo/app/meus/page'));
const ConfigAdm = lazyPagina(() => import('../modules/administrativo/app/config/page'));
const AprovacoesAdm = lazyPagina(() => import('../modules/administrativo/app/aprovacoes/page'));
const FilaAdm = lazyPagina(() => import('../modules/administrativo/app/fila/page'));
const ChamadoAdm = lazyPagina(() => import('../modules/administrativo/app/chamado/page'));
const FluxosAdm = lazyPagina(() => import('../modules/administrativo/app/fluxos/page'));
const KanbanAdm = lazyPagina(() => import('../modules/administrativo/app/kanban/page'));
const SatisfacaoAdm = lazyPagina(() => import('../modules/administrativo/app/satisfacao/page'));
const DashboardAdm = lazyPagina(() => import('../modules/administrativo/app/dashboard/page'));
const InicioProgramas = lazyPagina(() => import('../modules/programas/app/inicio/page'));
const DashboardIdeias = lazyPagina(() => import('../modules/programas/app/dashboard/page'));
const CampoDeIdeias = lazyPagina(() => import('../modules/programas/app/ideias/page'));
const NovaIdeia = lazyPagina(() => import('../modules/programas/app/ideias/nova/page'));
const MinhasIndicacoes = lazyPagina(() => import('../modules/programas/app/alavanca/page'));
const NovaIndicacao = lazyPagina(() => import('../modules/programas/app/alavanca/nova/page'));
const PainelAlavanca = lazyPagina(() => import('../modules/programas/app/painelAlavanca/page'));
const IniciativasEmUso = lazyPagina(() => import('../modules/programas/app/iniciativas/page'));
const PedidosIniciativa = lazyPagina(() => import('../modules/programas/app/pedidos/page'));
const PosicaoEstoque = lazyPagina(() => import('../modules/estoque/app/posicao/page'));
const EntradaEstoque = lazyPagina(() => import('../modules/estoque/app/entrada/page'));
const SaidaEstoque = lazyPagina(() => import('../modules/estoque/app/saida/page'));
const AjusteEstoque = lazyPagina(() => import('../modules/estoque/app/ajuste/page'));
const MovimentosEstoque = lazyPagina(() => import('../modules/estoque/app/movimentos/page'));
const DashboardEstoque = lazyPagina(() => import('../modules/estoque/app/dashboard/page'));

const KanbanMob = lazyPagina(() => import('../modules/mobilizacao/app/kanban/page'));
const FilaMob = lazyPagina(() => import('../modules/mobilizacao/app/fila/page'));
const ProcessosMob = lazyPagina(() => import('../modules/mobilizacao/app/processos/page'));
const ProcessoMob = lazyPagina(() => import('../modules/mobilizacao/app/processo/page'));
const NovaMob = lazyPagina(() => import('../modules/mobilizacao/app/nova/page'));
const DashboardMob = lazyPagina(() => import('../modules/mobilizacao/app/dashboard/page'));
const CatalogoMob = lazyPagina(() => import('../modules/mobilizacao/app/catalogo/page'));

const MapaTorre = lazyPagina(() => import('../modules/torre/app/mapa/page'));
const QuadroTorre = lazyPagina(() => import('../modules/torre/app/quadro/page'));
const EtapasTorre = lazyPagina(() => import('../modules/torre/app/etapas/page'));

function RouteFallback() {
  return <div style={{ padding: 'var(--space-3xl)', textAlign: 'center' }}>Carregando...</div>;
}

// Índice da Gestão de Horas: usuário/gerente caem em "Apontar", a diretoria
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

// Telas de DP das horas extras (painel, exceções, auditoria) dentro da Gestão de
// Pessoas. Gate só de UI — a RLS (app_private.is_horas_extras_dp) é quem protege
// os dados. Não dá para usar allowedRoles: um gestor com rh_dp mantém o perfil
// 'gestor' e mesmo assim é DP das horas extras.
// Administrativo em construção: só a lista de teste entra. Gate de UI — as
// tabelas do módulo seguem protegidas pela própria RLS.
function AdmEmBreveRoute({ children }) {
  const { user } = useAuth();
  if (!podeAcessarAdm(user)) return <Navigate to="/home" replace />;
  return children;
}

// Programas em construção: mesma trava do Administrativo. Gate de UI — as
// tabelas do módulo seguem protegidas pela própria RLS.
function ProgramasEmBreveRoute({ children }) {
  const { user } = useAuth();
  if (!podeAcessarProgramas(user)) return <Navigate to="/home" replace />;
  return children;
}

// Estoque em construção: mesma trava do Administrativo. Gate de UI — quem
// movimenta é decidido pela RLS (app_private.is_estoque_operador).
function EstoqueEmBreveRoute({ children }) {
  const { user } = useAuth();
  if (!podeAcessarEstoque(user)) return <Navigate to="/home" replace />;
  return children;
}

// Mobilização em construção: mesma trava do Administrativo e do Estoque. Gate
// de UI — quem controla o processo é decidido pela RLS, que reusa o papel do
// Adm (app_private.is_adm_time).
// Torre de Controle: consulta para coordenação, gerência e diretoria. O gate
// olha o PERFIL (config/torre.js) — e, enquanto em construção, também a lista
// de liberados. A RLS é quem limita o conteúdo: cada um vê o que é seu.
function TorreRoute({ children }) {
  const { user, modules } = useAuth();
  if (!podeVerTorre(user, modules)) return <Navigate to="/home" replace />;
  return children;
}

function MobilizacaoEmBreveRoute({ children }) {
  const { user } = useAuth();
  if (!podeAcessarMobilizacao(user)) return <Navigate to="/home" replace />;
  return children;
}

function HorasDpRoute({ children }) {
  const { user } = useAuth();
  if (!isHorasExtrasDp(user)) return <Navigate to="/home" replace />;
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

        {/* Fale conosco: aberto a todo logado. A RLS decide o que cada um vê —
            quem atende enxerga a fila inteira, os demais só o que enviaram. */}
        <Route
          path="/fale-conosco"
          element={
            <ProtectedRoute>
              <LazyPage>
                <FaleConoscoCaixa />
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

          {/* Horas Extras — tratamento do DP. O pedido, o acompanhamento e a
              aprovação ficam na Gestão de Horas (/horas/extras). */}
          <Route
            path="/admin/horas-extras"
            element={
              <ModuleRoute module="dp">
                <HorasDpRoute>
                  <LazyPage>
                    <PainelHorasExtras />
                  </LazyPage>
                </HorasDpRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/admin/horas-extras/excecoes"
            element={
              <ModuleRoute module="dp">
                <HorasDpRoute>
                  <LazyPage>
                    <ExcecoesPrazoHE />
                  </LazyPage>
                </HorasDpRoute>
              </ModuleRoute>
            }
          />
          <Route
            path="/admin/horas-extras/auditoria"
            element={
              <ModuleRoute module="dp">
                <HorasDpRoute>
                  <LazyPage>
                    <AuditoriaHE />
                  </LazyPage>
                </HorasDpRoute>
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
            path="/valores"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'admin']}>
                  <LazyPage>
                    <AjustesValores />
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
          {/* Antes de /reembolsos/:id, senão "dashboard" cairia no detalhe. */}
          <Route path="/reembolsos/dashboard" element={<LazyPage><DashboardReembolso /></LazyPage>} />
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
          {/* Campos que a equipe pede antes de iniciar o cronômetro. */}
          <Route path="config/apontamento" element={<LazyPage><HorasConfigApontamento /></LazyPage>} />
          {/* Quem enxerga cada projeto no seletor do apontamento. */}
          <Route path="config/projetos" element={<LazyPage><HorasConfigProjetos /></LazyPage>} />
          <Route path="equipe" element={<LazyPage><HorasEquipe /></LazyPage>} />
          {/* Rota antiga de Projetos: virou a aba Configuração. */}
          <Route path="projetos" element={<Navigate to="/horas/config" replace />} />

          {/* Horas Extras: pedir, acompanhar e aprovar — aberto a todos os
              logados, como o resto do módulo. O tratamento do DP (painel,
              exceções de prazo e auditoria) fica na Gestão de Pessoas. */}
          <Route path="extras" element={<Navigate to="/horas/extras/minhas" replace />} />
          <Route path="extras/nova" element={<LazyPage><HorasExtrasNova /></LazyPage>} />
          <Route path="extras/minhas" element={<LazyPage><HorasExtrasMinhas /></LazyPage>} />
          <Route path="extras/aprovacoes" element={<LazyPage><HorasExtrasAprovacoes /></LazyPage>} />
        </Route>

        <Route
          path="/financeiro"
          element={
            <ProtectedRoute>
              <ModuleRoute module="financeiro">
                <FinanceiroShell />
              </ModuleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/financeiro/dashboard" replace />} />
          <Route path="dashboard" element={<LazyPage><FinanceiroDashboard /></LazyPage>} />
          <Route path="cartoes" element={<LazyPage><FinanceiroCartoes /></LazyPage>} />
          <Route path="solicitacoes" element={<Navigate to="/financeiro/solicitacoes/nova" replace />} />
          {/* Acesso ao módulo já é gateado por cargo (ModuleRoute financeiro); quem
              está aqui pode abrir. Sem restrição extra por perfil (que não reflete cargo). */}
          <Route path="solicitacoes/nova" element={<LazyPage><FinanceiroHub /></LazyPage>} />
          <Route path="solicitacoes/nova/:tipo" element={<LazyPage><NovaSolicitacaoFin /></LazyPage>} />
          <Route path="solicitacoes/acompanhar" element={<LazyPage><AcompanharFin /></LazyPage>} />
          <Route path="fluxos" element={<LazyPage><FinanceiroFluxos /></LazyPage>} />
        </Route>

        {/* Administrativo: módulo aberto a todos os logados (como o Controle de
            Horas), então só ProtectedRoute — sem ModuleRoute. A camada de
            aprovação/atendimento é que terá gate próprio quando existir.
            Enquanto está em construção, a rota inteira (e as filhas junto)
            devolve para a Home, exceto para quem está testando. */}
        <Route
          path="/administrativo"
          element={
            <ProtectedRoute>
              <AdmEmBreveRoute>
                <AdministrativoShell />
              </AdmEmBreveRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/administrativo/novo" replace />} />
          <Route path="novo" element={<LazyPage><CatalogoAdm /></LazyPage>} />
          <Route path="novo/:classe/:servico" element={<LazyPage><NovoChamadoAdm /></LazyPage>} />
          <Route path="meus" element={<LazyPage><MeusChamadosAdm /></LazyPage>} />
          <Route path="aprovacoes" element={<LazyPage><AprovacoesAdm /></LazyPage>} />
          <Route path="fila" element={<LazyPage><FilaAdm /></LazyPage>} />
          <Route path="kanban" element={<LazyPage><KanbanAdm /></LazyPage>} />
          <Route path="chamado/:id" element={<LazyPage><ChamadoAdm /></LazyPage>} />
          <Route path="config" element={<LazyPage><ConfigAdm /></LazyPage>} />
          <Route path="fluxos" element={<LazyPage><FluxosAdm /></LazyPage>} />
          <Route path="dashboard" element={<LazyPage><DashboardAdm /></LazyPage>} />
          <Route path="satisfacao" element={<LazyPage><SatisfacaoAdm /></LazyPage>} />
        </Route>

        {/* Estoque: almoxarifado de EPIs e uniformes. Consultar é de todos os
            logados — é o que o Adm precisa antes de prometer um item; movimentar
            é do time do Adm, e quem barra é a RLS. Enquanto está em construção,
            a rota inteira devolve para a Home, exceto para quem está testando. */}
        <Route
          path="/estoque"
          element={
            <ProtectedRoute>
              <EstoqueEmBreveRoute>
                <EstoqueShell />
              </EstoqueEmBreveRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/estoque/posicao" replace />} />
          <Route path="posicao" element={<LazyPage><PosicaoEstoque /></LazyPage>} />
          <Route path="entrada" element={<LazyPage><EntradaEstoque /></LazyPage>} />
          <Route path="saida" element={<LazyPage><SaidaEstoque /></LazyPage>} />
          <Route path="ajuste" element={<LazyPage><AjusteEstoque /></LazyPage>} />
          <Route path="movimentos" element={<LazyPage><MovimentosEstoque /></LazyPage>} />
          <Route path="dashboard" element={<LazyPage><DashboardEstoque /></LazyPage>} />
        </Route>

        {/* Mobilização: o passo a passo que a planilha controlava. Acompanhar é
            de todos os logados, como no Adm — a RLS mostra a cada um os
            processos em que ele está envolvido; abrir processo e configurar o
            catálogo são do time do Adm. Enquanto está em construção, a rota
            inteira devolve para a Home, exceto para quem está testando. */}
        <Route
          path="/mobilizacao"
          element={
            <ProtectedRoute>
              <MobilizacaoEmBreveRoute>
                <MobilizacaoShell />
              </MobilizacaoEmBreveRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/mobilizacao/kanban" replace />} />
          <Route path="kanban" element={<LazyPage><KanbanMob /></LazyPage>} />
          <Route path="fila" element={<LazyPage><FilaMob /></LazyPage>} />
          <Route path="processos" element={<LazyPage><ProcessosMob /></LazyPage>} />
          <Route path="processo/:id" element={<LazyPage><ProcessoMob /></LazyPage>} />
          <Route path="nova" element={<LazyPage><NovaMob /></LazyPage>} />
          <Route path="dashboard" element={<LazyPage><DashboardMob /></LazyPage>} />
          <Route path="catalogo" element={<LazyPage><CatalogoMob /></LazyPage>} />
          {/* A torre saiu daqui e virou modulo proprio. A rota fica como
              redirecionamento porque ela circulou como link durante a revisao —
              tirar de vez transformaria esses links em volta para a Home, sem
              explicacao. */}
          <Route path="torre" element={<Navigate to="/torre/mapa" replace />} />
        </Route>

        {/* Torre de Controle: a mesma visão da torre da Mobilização, servida
            como módulo próprio para quem não trabalha dentro dela. SÓ LEITURA —
            existe para a reunião de torre, onde o Adm apresenta e cada
            responsável confere o que é seu. */}
        <Route
          path="/torre"
          element={(
            <ProtectedRoute>
              <TorreRoute>
                <TorreShell />
              </TorreRoute>
            </ProtectedRoute>
          )}
        >
          <Route index element={<Navigate to="/torre/mapa" replace />} />
          <Route path="mapa" element={<LazyPage><MapaTorre /></LazyPage>} />
          <Route path="quadro" element={<LazyPage><QuadroTorre /></LazyPage>} />
          <Route path="etapas" element={<LazyPage><EtapasTorre /></LazyPage>} />
        </Route>

        {/* Programas: os programas internos da PHD (Campo de Ideias e Alavanca).
            Aberto a todos os logados, como a Gestão de Horas — só o painel da
            Alavanca tem dono (o time comercial), e o gate dele fica na própria
            página. Enquanto está em construção, a rota inteira devolve para a
            Home, exceto para quem está testando. */}
        <Route
          path="/programas"
          element={
            <ProtectedRoute>
              <ProgramasEmBreveRoute>
                <ProgramasShell />
              </ProgramasEmBreveRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/programas/inicio" replace />} />
          <Route path="inicio" element={<LazyPage><InicioProgramas /></LazyPage>} />
          {/* Mesma divisão dos dois programas: "ideias" é onde se participa
              (botões + o que eu registrei) e "dashboard" é onde se lê. A rota
              antiga de escolha entre as formas redireciona — link guardado não
              pode cair em página morta. */}
          <Route path="dashboard" element={<LazyPage><DashboardIdeias /></LazyPage>} />
          <Route path="ideias" element={<LazyPage><CampoDeIdeias /></LazyPage>} />
          <Route path="ideias/nova" element={<Navigate to="/programas/ideias" replace />} />
          <Route path="ideias/nova/:tipo" element={<LazyPage><NovaIdeia /></LazyPage>} />
          <Route path="iniciativas" element={<LazyPage><IniciativasEmUso /></LazyPage>} />
          <Route path="pedidos" element={<LazyPage><PedidosIniciativa /></LazyPage>} />
          <Route path="alavanca" element={<LazyPage><MinhasIndicacoes /></LazyPage>} />
          <Route path="alavanca/nova" element={<LazyPage><NovaIndicacao /></LazyPage>} />
          {/* Irmão de /alavanca, e não filho: a sidebar marca o item ativo por
              startsWith, e aninhado os dois links acenderiam juntos. */}
          <Route path="painel-alavanca" element={<LazyPage><PainelAlavanca /></LazyPage>} />
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </HashRouter>
  );
}
