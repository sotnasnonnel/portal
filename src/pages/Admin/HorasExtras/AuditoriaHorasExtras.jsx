import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, Download, Search, ArrowLeft } from 'lucide-react';
import { fetchAuditoria } from '../../../services/horasExtras';
import '../../../components/UI/Components.css';
import '../Admin.css';
import './HorasExtras.css';

// Auditoria das horas extras (módulo Gestão de Pessoas).
// As linhas são gravadas por TRIGGER no banco — nenhuma tela escreve aqui, então
// o histórico não pode ser forjado nem esquecido.
export default function AuditoriaHorasExtras() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await fetchAuditoria({ limite: 500 });
        if (!cancel) setList(rows);
      } catch (e) {
        if (!cancel) setErro(e?.message || 'Falha ao carregar a auditoria.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return list;
    return list.filter((l) =>
      [l.ator_nome, l.acao, l.detalhe, l.numero != null ? `#${l.numero}` : '']
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [list, busca]);

  function exportarCSV() {
    const head = ['Data/Hora', 'Ator', 'Solicitacao', 'Acao', 'Detalhe'];
    const rows = filtrado.map((l) => [
      new Date(l.criado_em).toLocaleString('pt-BR'),
      l.ator_nome || '',
      l.numero != null ? `#${l.numero}` : '',
      l.acao,
      (l.detalhe || '').replace(/[\n;]/g, ' '),
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'horas_extras_auditoria.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><ScrollText size={28} /> Auditoria de Horas Extras</h1>
      <p className="page-subtitle">
        {filtrado.length} registro(s). Criação, aprovação, reprovação, alteração de destino,
        cancelamento, compensação e exceção de prazo são registradas automaticamente.
      </p>

      {erro && <div className="he-alerta he-alerta--erro">{erro}</div>}

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Histórico</div>
          <div className="he-toolbar">
            <div className="table-search">
              <Search size={16} />
              <input type="text" placeholder="Pessoa, ação, número da solicitação..."
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Link className="btn btn-outline" to="/admin/horas-extras">
              <ArrowLeft size={18} /> Voltar ao painel
            </Link>
            <button className="btn btn-outline" onClick={exportarCSV} disabled={!filtrado.length}>
              <Download size={18} /> Exportar CSV
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Ator</th>
                <th>Solicitação</th>
                <th>Ação</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="table-empty">Carregando dados...</td></tr>
              ) : (
                <>
                  {filtrado.map((l) => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(l.criado_em).toLocaleString('pt-BR')}
                      </td>
                      <td>{l.ator_nome || '—'}</td>
                      <td>{l.numero != null ? `#${l.numero}` : '—'}</td>
                      <td><strong>{l.acao}</strong></td>
                      <td style={{ maxWidth: 460 }}>{l.detalhe || '—'}</td>
                    </tr>
                  ))}
                  {filtrado.length === 0 && (
                    <tr><td colSpan={5} className="table-empty">Nenhum registro de auditoria.</td></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
