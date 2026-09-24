import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, LayoutDashboard, Download, CalendarDays } from 'lucide-react';
import {
  csv, diaISO, fmtDataBr, statusExibido, statusLabel,
} from '../../config/folgaCampo';
import { listar } from '../../services/folgaCampo';
import { Alerta, StatusBadge } from './componentes';
import { useRecarregarAoMudar } from './useRecarregarAoMudar';
import '../../components/UI/Components.css';
import '../Admin/Admin.css';
import './FolgaCampo.css';

const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// A tela de CONSULTA — "fica para consulta" é o motivo de o módulo existir.
// Duas telas no mesmo componente, que só mudam o escopo:
//  * 'equipe' — o responsável vê a subárvore dele;
//  * 'todos'  — o RH vê a empresa toda.
export default function ConsultaFolga({ escopo = 'equipe' }) {
  const ehRh = escopo === 'todos';
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('proximas');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setLista(await listar(escopo));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [escopo]);

  useEffect(() => { carregar(); }, [carregar]);
  useRecarregarAoMudar(carregar);

  const hoje = diaISO();
  const q = normal(busca);

  const filtrada = useMemo(() => {
    let l = lista;
    if (filtro === 'proximas') l = l.filter((r) => r.status === 'aprovada' && r.data_fim >= hoje);
    else if (filtro === 'pendente') l = l.filter((r) => r.status === 'pendente');
    else if (filtro === 'historico') l = l.filter((r) => r.data_fim < hoje);
    if (q) l = l.filter((r) => normal(r.colaborador_nome).includes(q)
      || normal(r.aprovador_nome).includes(q)
      || normal(r.obra).includes(q));
    return l;
  }, [lista, filtro, q, hoje]);

  const stats = useMemo(() => ({
    pessoas: new Set(lista.map((r) => r.colaborador_id)).size,
    fora: lista.filter((r) => r.status === 'aprovada' && r.data_inicio <= hoje && r.data_fim >= hoje).length,
    proximas: lista.filter((r) => r.status === 'aprovada' && r.data_inicio > hoje).length,
    pendentes: lista.filter((r) => r.status === 'pendente').length,
  }), [lista, hoje]);

  function exportar() {
    const linhas = [
      ['Numero', 'Colaborador', 'Funcao', 'Obra', 'Inicio', 'Fim', 'Dias', 'Motivo', 'Status',
        'Responsavel', 'Decidido Por', 'Decidido Em', 'Motivo Reprovacao'],
      ...filtrada.map((r) => [
        r.numero, r.colaborador_nome, r.colaborador_funcao, r.obra,
        fmtDataBr(r.data_inicio), fmtDataBr(r.data_fim), r.dias, r.motivo, statusLabel(r, hoje),
        r.aprovador_nome, r.decidido_por_nome, r.decidido_em ? fmtDataBr(r.decidido_em) : '',
        r.motivo_reprovacao,
      ]),
    ];
    const blob = new Blob(['﻿' + csv(linhas)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'folga_de_campo.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const titulo = ehRh ? 'Painel de Folga de Campo' : 'Folga de Campo da Equipe';
  const Icone = ehRh ? LayoutDashboard : Users;

  if (loading) {
    return (
      <div className="admin-page animate-fade-in-up">
        <h1 className="page-title"><Icone size={28} /> {titulo}</h1>
        <div className="fc-vazio">Carregando...</div>
      </div>
    );
  }

  const FILTROS = [
    ['proximas', 'Aprovadas a acontecer'],
    ['pendente', 'Aguardando aprovação'],
    ['historico', 'Já aconteceram'],
    ['todos', 'Todas'],
  ];

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><Icone size={28} /> {titulo}</h1>
      <p className="page-subtitle">
        {ehRh
          ? 'Quem está ou vai ficar fora da obra, na empresa toda.'
          : 'Quem está ou vai ficar fora da obra, entre as pessoas abaixo de você no organograma.'}
      </p>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <div className="cards-grid cards-grid--3 fc-secao">
        <div className="stat-card accent">
          <div className="stat-card-header"><div className="stat-card-icon"><Users size={22} /></div></div>
          <div className="stat-card-value">{stats.pessoas}</div>
          <div className="stat-card-label">Pessoas com registro</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-card-header"><div className="stat-card-icon"><CalendarDays size={22} /></div></div>
          <div className="stat-card-value">{stats.fora}</div>
          <div className="stat-card-label">Fora da obra hoje</div>
        </div>
        <div className="stat-card success">
          <div className="stat-card-header"><div className="stat-card-icon"><CalendarDays size={22} /></div></div>
          <div className="stat-card-value">{stats.proximas}</div>
          <div className="stat-card-label">Aprovadas a acontecer</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">
            Registros{stats.pendentes ? ` · ${stats.pendentes} aguardando aprovação` : ''}
          </div>
          <div className="fc-toolbar">
            <input className="form-input fc-busca" placeholder="Buscar por nome, responsável ou obra"
              value={busca} onChange={(e) => setBusca(e.target.value)} />
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

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Colaborador</th>
                <th>Período fora</th>
                <th>Dias</th>
                <th>Obra</th>
                <th>Motivo</th>
                <th>Status</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((r) => (
                <tr key={r.id}>
                  <td>#{r.numero}</td>
                  <td>
                    {r.colaborador_nome}
                    <div className="fc-sub">{r.colaborador_funcao || '—'}</div>
                  </td>
                  <td>{fmtDataBr(r.data_inicio)} a {fmtDataBr(r.data_fim)}</td>
                  <td className="fc-num">{r.dias}</td>
                  <td>{r.obra || '—'}</td>
                  <td className="fc-motivo">{r.motivo}</td>
                  <td>
                    <StatusBadge r={r} />
                    {statusExibido(r, hoje) === 'reprovada' && r.motivo_reprovacao && (
                      <div className="fc-sub">{r.motivo_reprovacao}</div>
                    )}
                  </td>
                  <td>{r.aprovador_nome || '—'}</td>
                </tr>
              ))}
              {filtrada.length === 0 && (
                <tr><td colSpan={8} className="table-empty">Nenhum registro encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
