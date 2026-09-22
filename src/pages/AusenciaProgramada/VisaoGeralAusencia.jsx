import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, LayoutDashboard, AlertTriangle, CalendarDays, Download, Pencil, UserPlus, RefreshCw, Wallet,
} from 'lucide-react';
import {
  csv, diaISO, diasAteLimite, fmtDataBr, rotuloPeriodo, situacaoPeriodo, statusExibido, statusLabel,
  SITUACAO_LABEL,
} from '../../config/ausenciaProgramada';
import { MOD_AUSENCIA } from '../../config/modulosAusencia';
import { servicoAusencia } from '../../services/ausenciaProgramada';
import {
  Alerta, ModalPeriodo, SituacaoPeriodo, StatCard, StatusBadge,
} from './componentes';
import { useRecarregarAoMudar } from './useRecarregarAoMudar';
import TableScroll from '../../components/UI/TableScroll';
import '../../components/UI/Components.css';
import '../Admin/Admin.css';
import './AusenciaProgramada.css';

const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Duas telas no mesmo componente, que só mudam o escopo:
//  * escopo 'equipe' — o gestor acompanha a subárvore dele;
//  * escopo 'todos'  — o RH acompanha a empresa, corrige períodos e cadastra
//    quem ainda não tem saldo.
//
// Serve aos dois módulos (`mod`): Ausência Programada e Folga de Campo.
export default function VisaoGeralAusencia({ mod = MOD_AUSENCIA, escopo = 'equipe' }) {
  const api = servicoAusencia(mod);
  const ehRh = escopo === 'todos';
  const [periodos, setPeriodos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [semPeriodo, setSemPeriodo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [aba, setAba] = useState('saldos');
  const [filtro, setFiltro] = useState('atuais');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null); // { periodo } | { colaborador }
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [ps, ss, sp] = await Promise.all([
        api.listarPeriodos(escopo),
        api.listarSolicitacoes(escopo),
        ehRh ? api.listarSemPeriodo() : Promise.resolve([]),
      ]);
      setPeriodos(ps);
      setPedidos(ss);
      setSemPeriodo(sp);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [api, escopo, ehRh]);

  useEffect(() => { api.gerarAlertas(); carregar(); }, [api, carregar]);
  useRecarregarAoMudar(mod.evento, carregar);

  const hoje = diaISO();

  const comSituacao = useMemo(
    () => periodos.map((p) => ({ ...p, situacao: situacaoPeriodo(p, hoje) })),
    [periodos, hoje],
  );

  const stats = useMemo(() => ({
    pessoas: new Set(periodos.map((p) => p.colaborador_id)).size,
    saldo: comSituacao
      .filter((p) => ['disponivel', 'vencendo'].includes(p.situacao))
      .reduce((t, p) => t + p.saldo, 0),
    vencendo: comSituacao.filter((p) => p.situacao === 'vencendo').length,
    vencido: comSituacao.filter((p) => p.situacao === 'vencido').length,
    proximas: pedidos.filter((s) => s.status === 'aprovada' && s.data_fim >= hoje).length,
    pendentes: pedidos.filter((s) => s.status === 'pendente').length,
  }), [comSituacao, pedidos, periodos, hoje]);

  const q = normal(busca);

  const periodosFiltrados = useMemo(() => {
    let l = comSituacao;
    if (filtro === 'atuais') l = l.filter((p) => p.situacao !== 'sem_saldo' || p.data_limite >= hoje);
    else if (filtro !== 'todos') l = l.filter((p) => p.situacao === filtro);
    if (q) l = l.filter((p) => normal(p.colaborador_nome).includes(q) || normal(p.superior_nome).includes(q));
    return l;
  }, [comSituacao, filtro, q, hoje]);

  const pedidosFiltrados = useMemo(() => {
    let l = pedidos;
    if (filtro === 'proximas') l = l.filter((s) => s.status === 'aprovada' && s.data_fim >= hoje);
    else if (filtro === 'pendente') l = l.filter((s) => s.status === 'pendente');
    if (q) l = l.filter((s) => normal(s.colaborador_nome).includes(q) || normal(s.aprovador_nome).includes(q));
    return l;
  }, [pedidos, filtro, q, hoje]);

  function trocarAba(nova) {
    setAba(nova);
    setFiltro(nova === 'saldos' ? 'atuais' : 'todos');
  }

  function baixar(nome, linhas) {
    const blob = new Blob(['﻿' + csv(linhas)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportar() {
    if (aba === 'saldos') {
      baixar(`${mod.arquivo}_saldos.csv`, [
        ['Colaborador', 'Funcao', 'Modalidade', 'Gestor', 'Inicio Periodo', 'Fim Periodo', 'Data Inicial',
          'Data Limite', 'Direito', 'Ajuste', 'Motivo Ajuste', 'Tirados', 'Agendados', 'Pendentes', 'Saldo',
          'Situacao', 'Dias ate a Data Limite', 'Observacao'],
        ...periodosFiltrados.map((p) => [
          p.colaborador_nome, p.colaborador_funcao, p.colaborador_formato, p.superior_nome,
          fmtDataBr(p.inicio_periodo), fmtDataBr(p.fim_periodo), fmtDataBr(p.data_inicial),
          fmtDataBr(p.data_limite), p.dias_direito, p.dias_ajuste, p.ajuste_motivo, p.dias_tirados,
          p.dias_agendados, p.dias_pendentes, p.saldo, SITUACAO_LABEL[p.situacao], diasAteLimite(p, hoje),
          p.observacao,
        ]),
      ]);
    } else {
      baixar(`${mod.arquivo}_pedidos.csv`, [
        ['Numero', 'Colaborador', 'Inicio', 'Fim', 'Dias', 'Periodo', 'Data Limite', 'Status',
          'Fora do Prazo', 'Gestor', 'Decidido Por', 'Decidido Em', 'Motivo Reprovacao', 'Observacao'],
        ...pedidosFiltrados.map((s) => [
          s.numero, s.colaborador_nome, fmtDataBr(s.data_inicio), fmtDataBr(s.data_fim), s.dias,
          rotuloPeriodo(s), fmtDataBr(s.data_limite), statusLabel(s, hoje), s.fora_do_prazo ? 'Sim' : 'Nao',
          s.aprovador_nome, s.decidido_por_nome, s.decidido_em ? fmtDataBr(s.decidido_em) : '',
          s.motivo_reprovacao, s.observacao,
        ]),
      ]);
    }
  }

  async function gerarTodos() {
    setGerando(true);
    setErro('');
    try {
      const n = await api.gerarPeriodos({ todos: true });
      setOkMsg(n ? `${n} período(s) novo(s) gerado(s).` : 'Nenhum período novo a gerar.');
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao gerar períodos.');
    } finally {
      setGerando(false);
    }
  }

  const titulo = ehRh ? mod.tituloPainel : mod.tituloEquipe;
  const Icone = ehRh ? LayoutDashboard : Users;

  if (loading) {
    return (
      <div className="admin-page animate-fade-in-up">
        <h1 className="page-title"><Icone size={28} /> {titulo}</h1>
        <div className="ap-vazio">Carregando...</div>
      </div>
    );
  }

  const FILTROS = aba === 'saldos'
    ? [['atuais', 'Atuais'], ['disponivel', 'Disponível'], ['vencendo', 'Data limite próxima'],
      ['vencido', 'Data limite passou'], ['em_aquisicao', 'Em aquisição'], ['todos', 'Todos']]
    : [['todos', 'Todos'], ['pendente', 'Pendentes'], ['proximas', 'Aprovadas a acontecer']];

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><Icone size={28} /> {titulo}</h1>
      <p className="page-subtitle">
        {ehRh
          ? 'Saldos, datas limite e pedidos da empresa toda. Correções de saldo ficam registradas com motivo.'
          : `Saldos e ${mod.plural.toLowerCase()} de quem está abaixo de você no organograma.`}
      </p>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {okMsg && <Alerta tipo="ok">{okMsg}</Alerta>}
      {stats.vencido > 0 && (
        <Alerta tipo="erro">
          {stats.vencido} período(s) passaram da data limite com saldo sobrando.
        </Alerta>
      )}

      <div className="cards-grid cards-grid--3 ap-secao">
        <StatCard tom="accent" icone={<Users size={22} />} valor={stats.pessoas} rotulo="Pessoas com período" />
        <StatCard tom="success" icone={<Wallet size={22} />} valor={stats.saldo} rotulo="Saldo disponível (dias)" />
        <StatCard tom="warning" icone={<AlertTriangle size={22} />} valor={stats.vencendo}
          rotulo="Data limite em até 3 meses" ativo={aba === 'saldos' && filtro === 'vencendo'}
          onClick={() => { setAba('saldos'); setFiltro('vencendo'); }} />
        <StatCard tom="danger" icone={<AlertTriangle size={22} />} valor={stats.vencido}
          rotulo="Data limite passou" ativo={aba === 'saldos' && filtro === 'vencido'}
          onClick={() => { setAba('saldos'); setFiltro('vencido'); }} />
        <StatCard tom="accent" icone={<CalendarDays size={22} />} valor={stats.proximas}
          rotulo={`${mod.plural} aprovadas a acontecer`} ativo={aba === 'pedidos' && filtro === 'proximas'}
          onClick={() => { setAba('pedidos'); setFiltro('proximas'); }} />
        <StatCard tom="warning" icone={<CalendarDays size={22} />} valor={stats.pendentes}
          rotulo="Pedidos pendentes" ativo={aba === 'pedidos' && filtro === 'pendente'}
          onClick={() => { setAba('pedidos'); setFiltro('pendente'); }} />
      </div>

      {ehRh && semPeriodo.length > 0 && (
        <div className="table-container ap-secao">
          <div className="table-header">
            <div className="table-header-title">Sem saldo cadastrado ({semPeriodo.length})</div>
          </div>
          <Alerta tipo="info">
            Estas pessoas não têm nenhum período. O portal só gera sozinho para quem entrou há menos de um
            ano; para os demais, cadastre o período com o saldo atual.
          </Alerta>
          <TableScroll>
            <table className="data-table">
              <thead>
                <tr><th>Colaborador</th><th>Modalidade</th><th>Admissão</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {semPeriodo.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nome}<div className="ap-sub">{c.funcao || '—'}</div></td>
                    <td>{c.formato || '—'}</td>
                    <td>{fmtDataBr(c.data_admissao)}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditando({ colaborador: c })}>
                        <UserPlus size={16} /> Cadastrar período
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}

      <div className="table-container">
        <div className="table-header">
          <div className="filter-chips">
            <button className={`filter-chip ${aba === 'saldos' ? 'active' : ''}`} onClick={() => trocarAba('saldos')}>
              Saldos por período
            </button>
            <button className={`filter-chip ${aba === 'pedidos' ? 'active' : ''}`} onClick={() => trocarAba('pedidos')}>
              Pedidos
            </button>
          </div>
          <div className="ap-toolbar">
            <input className="form-input ap-busca" placeholder="Buscar por nome ou gestor"
              value={busca} onChange={(e) => setBusca(e.target.value)} />
            {ehRh && (
              <button className="btn btn-outline" onClick={gerarTodos} disabled={gerando}
                title="Cria os períodos que viraram para quem já tem histórico">
                <RefreshCw size={18} /> {gerando ? 'Gerando...' : 'Gerar períodos'}
              </button>
            )}
            <button className="btn btn-outline" onClick={exportar}>
              <Download size={18} /> Exportar CSV
            </button>
          </div>
        </div>

        <div className="filter-chips" style={{ padding: '0 var(--space-lg) var(--space-md)' }}>
          {FILTROS.map(([v, l]) => (
            <button key={v} className={`filter-chip ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>
              {l}
            </button>
          ))}
        </div>

        <TableScroll>
          {aba === 'saldos' ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Período</th>
                  <th>Data inicial</th>
                  <th>Data limite</th>
                  <th>Direito</th>
                  <th>Tirados</th>
                  <th>Agendados</th>
                  <th>Pendentes</th>
                  <th>Saldo</th>
                  <th>Situação</th>
                  {ehRh && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {periodosFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.colaborador_nome}
                      <div className="ap-sub">
                        {[p.colaborador_formato, p.superior_nome && `Gestor: ${p.superior_nome}`].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td>{rotuloPeriodo(p)}</td>
                    <td>{fmtDataBr(p.data_inicial)}</td>
                    <td>
                      {fmtDataBr(p.data_limite)}
                      {['vencendo', 'disponivel'].includes(p.situacao) && (
                        <div className="ap-sub">em {diasAteLimite(p, hoje)} dia(s)</div>
                      )}
                    </td>
                    <td className="ap-num">
                      {p.dias_direito + p.dias_ajuste}
                      {p.dias_ajuste !== 0 && (
                        <div className="ap-sub" title={p.ajuste_motivo || ''}>
                          ajuste {p.dias_ajuste > 0 ? '+' : ''}{p.dias_ajuste}
                        </div>
                      )}
                    </td>
                    <td className="ap-num">{p.dias_tirados}</td>
                    <td className="ap-num">{p.dias_agendados}</td>
                    <td className="ap-num">{p.dias_pendentes}</td>
                    <td className="ap-num"><strong>{p.saldo}</strong></td>
                    <td>
                      <SituacaoPeriodo periodo={p} />
                      {p.observacao && <div className="ap-sub">{p.observacao}</div>}
                    </td>
                    {ehRh && (
                      <td>
                        <button className="btn-icon" title="Corrigir período" onClick={() => setEditando({ periodo: p })}>
                          <Pencil size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {periodosFiltrados.length === 0 && (
                  <tr><td colSpan={ehRh ? 11 : 10} className="table-empty">Nenhum período encontrado.</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Colaborador</th>
                  <th>{mod.substantivoTitulo}</th>
                  <th>Dias</th>
                  <th>Data limite</th>
                  <th>Status</th>
                  <th>Gestor</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((s) => (
                  <tr key={s.id}>
                    <td>#{s.numero}</td>
                    <td>{s.colaborador_nome}<div className="ap-sub">{s.colaborador_funcao || '—'}</div></td>
                    <td>
                      {fmtDataBr(s.data_inicio)} a {fmtDataBr(s.data_fim)}
                      {s.origem === 'importacao' && <div className="ap-sub">Importado da planilha</div>}
                    </td>
                    <td className="ap-num">{s.dias}</td>
                    <td>{fmtDataBr(s.data_limite)}</td>
                    <td>
                      <StatusBadge s={s} />
                      {statusExibido(s, hoje) === 'reprovada' && s.motivo_reprovacao && (
                        <div className="ap-sub">{s.motivo_reprovacao}</div>
                      )}
                    </td>
                    <td>{s.aprovador_nome || '—'}</td>
                  </tr>
                ))}
                {pedidosFiltrados.length === 0 && (
                  <tr><td colSpan={7} className="table-empty">Nenhum pedido encontrado.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </TableScroll>
      </div>

      {editando && (
        <ModalPeriodo
          periodo={editando.periodo || null}
          colaborador={editando.colaborador || null}
          onClose={() => setEditando(null)}
          onSalvar={async (campos) => {
            if (editando.periodo) await api.atualizarPeriodo(editando.periodo.id, campos);
            else await api.criarPeriodo(campos);
            setEditando(null);
            setOkMsg('Período salvo.');
            await carregar();
          }}
        />
      )}
    </div>
  );
}
