import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, LayoutDashboard, AlertTriangle, CalendarDays, Download, Pencil, UserPlus, RefreshCw, Wallet,
  UserMinus, Undo2, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  csv, diaISO, diasAteLimite, fmtDataBr, rotuloPeriodo, situacaoPeriodo, statusExibido, statusLabel,
  SITUACAO_LABEL,
} from '../../config/ausenciaProgramada';
import { MOD_AUSENCIA } from '../../config/modulosAusencia';
import { servicoAusencia } from '../../services/ausenciaProgramada';
import {
  Alerta, ModalPeriodo, ModalTirados, SituacaoPeriodo, StatCard, StatusBadge,
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
  const [foraDoControle, setForaDoControle] = useState([]);
  // Recolhida por padrão: é um arquivo, consultado raramente, e aberta ela
  // empurrava os saldos (a razão da tela) para baixo de 23 linhas.
  const [verForaDoControle, setVerForaDoControle] = useState(false);
  const [pessoas, setPessoas] = useState([]);
  const [removendo, setRemovendo] = useState(null); // { colaborador, resumo }
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [aba, setAba] = useState('saldos');
  const [filtro, setFiltro] = useState('atuais');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null); // { periodo } | { colaborador }
  const [corrigindoTirados, setCorrigindoTirados] = useState(null); // periodo
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [ps, ss, sp, fora, pes] = await Promise.all([
        api.listarPeriodos(escopo),
        api.listarSolicitacoes(escopo),
        ehRh ? api.listarSemPeriodo() : Promise.resolve([]),
        ehRh ? api.listarForaDoControle() : Promise.resolve([]),
        // Para o seletor de gestor do modal. Só o RH edita cadastro.
        ehRh && mod.controlePessoas ? api.listarPessoas() : Promise.resolve([]),
      ]);
      setPeriodos(ps);
      setPedidos(ss);
      setSemPeriodo(sp);
      setForaDoControle(fora);
      setPessoas(pes);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [api, escopo, ehRh, mod.controlePessoas]);

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
          'Data Limite', 'Direito', 'Ajuste', 'Motivo Ajuste', 'Adicionais', 'Tirados', 'Agendados', 'Pendentes', 'Saldo',
          'Situacao', 'Dias ate a Data Limite', 'Observacao'],
        ...periodosFiltrados.map((p) => [
          p.colaborador_nome, p.colaborador_funcao, p.colaborador_formato, p.superior_nome,
          fmtDataBr(p.inicio_periodo), fmtDataBr(p.fim_periodo), fmtDataBr(p.data_inicial),
          fmtDataBr(p.data_limite), p.dias_direito, p.dias_ajuste, p.ajuste_motivo, p.dias_adicionais ?? 0, p.dias_tirados,
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

  // Pergunta ao banco o que a pessoa tem ANTES de abrir a confirmação: remover
  // quem já usa o controle é permitido, mas nunca às cegas.
  async function pedirRemocao(colaborador) {
    setErro('');
    try {
      setRemovendo({ colaborador, resumo: await api.resumoDoColaborador(colaborador.id) });
    } catch (e) {
      setErro(e?.message || 'Falha ao consultar o colaborador.');
    }
  }

  async function confirmarRemocao() {
    const alvo = removendo?.colaborador;
    setRemovendo(null);
    if (!alvo) return;
    try {
      await api.definirControle(alvo.id, false);
      setOkMsg(`${alvo.nome} saiu do controle de ${mod.nomeMinusculo}.`);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao remover do controle.');
    }
  }

  async function devolver(colaborador) {
    setErro('');
    try {
      await api.definirControle(colaborador.id, true);
      setOkMsg(`${colaborador.nome} voltou para o controle.`);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao devolver ao controle.');
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

      {/* Quem saiu do controle fica listado: sem isto, remover seria porta sem
          volta — a pessoa sumiria de todas as telas do RH. */}
      {ehRh && mod.controlePessoas && foraDoControle.length > 0 && (
        <div className="table-container ap-secao">
          <div className="table-header">
            <button type="button" className="btn btn-ghost btn-sm table-header-title"
              aria-expanded={verForaDoControle}
              onClick={() => setVerForaDoControle((v) => !v)}>
              {verForaDoControle ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Fora do controle ({foraDoControle.length})
            </button>
          </div>
          {verForaDoControle && (<>
          <Alerta tipo="info">
            Estas pessoas não entram no controle de {mod.nomeMinusculo}: não aparecem nos saldos e
            não ganham período novo. O que já havia continua guardado.
          </Alerta>
          <TableScroll>
            <table className="data-table">
              <thead>
                <tr><th>Colaborador</th><th>Modalidade</th><th>Admissão</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {foraDoControle.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nome}<div className="ap-sub">{c.funcao || '—'}</div></td>
                    <td>{c.formato || '—'}</td>
                    <td>{fmtDataBr(c.data_admissao)}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => devolver(c)}>
                        <Undo2 size={16} /> Devolver ao controle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          </>)}
        </div>
      )}

      {/* A confirmação diz o que a pessoa tem HOJE no controle: um pedido
          aprovado esquecido é o tipo de coisa que só aparece depois. */}
      {removendo && (
        <div className="modal-overlay" role="presentation" onClick={() => setRemovendo(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Remover do controle</span>
            </div>
            <div className="modal-body">
              <p>
                <strong>{removendo.colaborador.nome}</strong> deixa de aparecer no controle de
                {' '}{mod.nomeMinusculo} e não recebe mais período automático.
              </p>
              {(removendo.resumo.periodos > 0 || removendo.resumo.pedidos > 0) && (
                <Alerta tipo="erro">
                  Esta pessoa já usa o controle: {removendo.resumo.periodos} período(s),
                  {' '}{removendo.resumo.pedidos} pedido(s) em aberto ou aprovados e
                  {' '}{removendo.resumo.saldo} dia(s) de saldo. Nada disso é apagado, mas some das
                  suas listas.
                </Alerta>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setRemovendo(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarRemocao}>Remover do controle</button>
            </div>
          </div>
        </div>
      )}

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
                      {/* A outra saída para esta lista: quem não deve estar no
                          controle sai dela, em vez de ficar para sempre como
                          pendência de cadastro. */}
                      {mod.controlePessoas && (
                        <button className="btn btn-outline btn-sm" onClick={() => pedirRemocao(c)}>
                          <UserMinus size={16} /> Remover do controle
                        </button>
                      )}
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
                  <th title="Dias do Adicional de Ausências, já aprovados">Adicionais</th>
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
                    <td className="ap-num" title="Dias do Adicional de Ausências, já aprovados">
                      {p.dias_adicionais ? `+${p.dias_adicionais}` : '—'}
                    </td>
                    <td className="ap-num">
                      {/* O RH corrige o tirado que não foi tirado (lançamento
                          da planilha errado, ausência que não aconteceu). */}
                      {ehRh && p.dias_tirados > 0 ? (
                        <button type="button" className="btn btn-ghost btn-sm" title="Corrigir dias tirados"
                          onClick={() => setCorrigindoTirados(p)}>
                          {p.dias_tirados} <Pencil size={13} />
                        </button>
                      ) : p.dias_tirados}
                    </td>
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
                        {/* Tirar do controle também aqui: é nesta tabela que o
                            RH vê quem não deveria estar na lista. */}
                        {mod.controlePessoas && (
                          <button className="btn-icon" title="Remover do controle"
                            onClick={() => pedirRemocao({ id: p.colaborador_id, nome: p.colaborador_nome })}>
                            <UserMinus size={16} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {periodosFiltrados.length === 0 && (
                  <tr><td colSpan={ehRh ? 12 : 11} className="table-empty">Nenhum período encontrado.</td></tr>
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

      {corrigindoTirados && (
        <ModalTirados
          periodo={corrigindoTirados}
          // Mesma regra do banco para "tirado": aprovado e já terminado.
          lancamentos={pedidos
            .filter((s) => s.periodo_id === corrigindoTirados.id
              && s.status === 'aprovada' && s.data_fim < hoje)
            .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))}
          onClose={() => setCorrigindoTirados(null)}
          onSalvar={async (alteracoes, motivo) => {
            for (const { lancamento, dias } of alteracoes) {
              if (dias === 0) await api.cancelar(lancamento.id, { motivo });
              else await api.corrigirDias(lancamento.id, dias, motivo);
            }
            setCorrigindoTirados(null);
            setOkMsg('Dias tirados corrigidos.');
            await carregar();
          }}
        />
      )}

      {editando && (
        <ModalPeriodo
          periodo={editando.periodo || null}
          colaborador={editando.colaborador || null}
          pessoas={ehRh && mod.controlePessoas ? pessoas : []}
          onSalvarCadastro={ehRh && mod.controlePessoas
            ? (id, campos) => api.editarCadastro(id, campos)
            : undefined}
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
