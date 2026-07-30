import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { fetchAuditoria } from '../../../lib/dataHorasExtras';

// Auditoria das horas extras (DP). As linhas são gravadas por TRIGGER no banco —
// nenhuma tela escreve aqui, então o histórico não pode ser forjado nem esquecido.
export default function AuditoriaHEPage() {
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
    return () => {
      cancel = true;
    };
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
    <>
      <h1>Auditoria — Horas Extras</h1>
      <p className="horas-sub">
        {filtrado.length} registro(s). Toda criação, aprovação, reprovação, alteração de destino,
        cancelamento, compensação e exceção de prazo é registrada automaticamente.
      </p>

      {erro ? <div className="horas-hint is-erro">⚠️ {erro}</div> : null}

      <div className="horas-card">
        <div className="horas-toolbar" style={{ marginBottom: 0 }}>
          <div className="horas-fld" style={{ maxWidth: 320 }}>
            <label>Buscar</label>
            <input
              type="text"
              placeholder="Pessoa, ação, número da solicitação…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="horas-spacer" />
          <button
            className="horas-btn2"
            type="button"
            onClick={exportarCSV}
            disabled={!filtrado.length}
          >
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="horas-card horas-table-wrap">
        {loading ? (
          <div className="horas-empty">Carregando…</div>
        ) : (
          <table className="horas-tbl-resp">
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
              {filtrado.map((l) => (
                <tr key={l.id}>
                  <td className="horas-muted" data-label="Data/Hora" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(l.criado_em).toLocaleString('pt-BR')}
                  </td>
                  <td data-label="Ator">{l.ator_nome || '—'}</td>
                  <td data-label="Solicitação">{l.numero != null ? `#${l.numero}` : '—'}</td>
                  <td data-label="Ação">
                    <b>{l.acao}</b>
                  </td>
                  <td className="horas-muted" data-label="Detalhe" style={{ maxWidth: 460 }}>
                    {l.detalhe || '—'}
                  </td>
                </tr>
              ))}
              {filtrado.length === 0 ? (
                <tr>
                  <td colSpan={5} className="horas-empty">
                    Nenhum registro de auditoria.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
