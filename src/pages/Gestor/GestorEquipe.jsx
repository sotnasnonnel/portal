import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { formatarData, formatarMoeda, calcularSaldoAusencia } from '../../utils/formatters';
import { Users, Search, FileSpreadsheet } from 'lucide-react';
import '../../components/UI/Components.css';
import './Gestor.css';

export default function GestorEquipe() {
  const { user } = useAuth();
  const [busca, setBusca] = useState('');
  const [equipe, setEquipe] = useState([]);
  const [saldos, setSaldos] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEquipe = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('superior_id', user.id)
        .order('nome');

      if (!error && data) {
        setEquipe(data);

        // Busca os ciclos da equipe e calcula o saldo de dias por colaborador.
        const ids = data.map((c) => c.id);
        if (ids.length > 0) {
          const { data: cics, error: cicsError } = await supabase
            .from('ciclos_ausencia')
            .select('*')
            .in('colaborador_id', ids);

          if (!cicsError && cics) {
            const porColaborador = cics.reduce((acc, c) => {
              (acc[c.colaborador_id] = acc[c.colaborador_id] || []).push(c);
              return acc;
            }, {});

            const mapaSaldos = {};
            data.forEach((c) => {
              mapaSaldos[c.id] = calcularSaldoAusencia(porColaborador[c.id] || []).saldoDisponivel;
            });
            setSaldos(mapaSaldos);
          }
        }
      }
      setLoading(false);
    };

    if (user?.id) fetchEquipe();
  }, [user]);

  const filtrados = equipe.filter((u) =>
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.funcao?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const dataToExport = filtrados.map(u => ({
      'Nome Completo': u.nome,
      'Função': u.funcao || '—',
      'Data de Admissão': formatarData(u.data_admissao || u.dataAdmissao),
      'Salário': u.salario ? Number(u.salario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—',
      'Último Aumento': formatarData(u.ultimo_aumento || u.ultimoAumento),
      'Saldo de Dias': `${saldos[u.id] ?? 0} dias`,
      'Status': u.ativo ? 'Ativo' : 'Inativo'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Minha Equipe");
    
    XLSX.writeFile(wb, `Equipe_${user.nome.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  };

  if (loading) {
    return (
      <div className="gestor-page animate-fade-in-up">
        <h1 className="page-title"><Users size={28} /> Minha Equipe</h1>
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title">
        <Users size={28} /> Minha Equipe
      </h1>
      <p className="page-subtitle">Visão geral dos colaboradores sob sua responsabilidade.</p>

      <div className="table-container team-table-container">
        <div className="table-header">
          <div className="table-header-title">Equipe ({equipe.length} colaboradores)</div>
          <div className="table-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por nome ou função..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <button 
            className="btn btn-outline" 
            onClick={handleExportExcel}
            disabled={filtrados.length === 0}
            style={{ gap: '8px' }}
          >
            <FileSpreadsheet size={18} color="#1D6F42" />
            Exportar Excel
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>

                <th>Função</th>
                <th>Admissão</th>
                <th>Salário</th>
                <th>Último Aumento</th>
                <th>Saldo de dias</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <div className="approval-card-avatar" style={{ width: 34, height: 34, fontSize: '12px' }}>
                        {u.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                      </div>
                      <span style={{ fontWeight: 600 }}>{u.nome}</span>
                    </div>
                  </td>

                  <td>{u.funcao}</td>
                  <td>{formatarData(u.data_admissao || u.dataAdmissao)}</td>
                  <td>{formatarMoeda(u.salario)}</td>
                  <td>{formatarData(u.ultimo_aumento || u.ultimoAumento)}</td>
                  <td>
                    <span className={`saldo-pill ${(saldos[u.id] ?? 0) > 0 ? 'has-balance' : 'no-balance'}`}>
                      {saldos[u.id] ?? 0} dias
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.ativo ? 'ativo' : 'inativo'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="team-mobile-list">
          {filtrados.map((u) => (
            <div key={u.id} className="team-mobile-card">
              <div className="team-mobile-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <div className="approval-card-avatar" style={{ width: 38, height: 38, fontSize: '12px' }}>
                    {u.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <div className="team-mobile-name">{u.nome}</div>
                    <div className="team-mobile-role">{u.funcao || '—'}</div>
                  </div>
                </div>
                <span className={`badge ${u.ativo ? 'ativo' : 'inativo'}`}>
                  {u.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="team-mobile-meta">
                <div className="team-mobile-meta-item">
                  <span className="label">Admissão</span>
                  <span className="value">{formatarData(u.data_admissao || u.dataAdmissao)}</span>
                </div>
                <div className="team-mobile-meta-item">
                  <span className="label">Salário</span>
                  <span className="value">{formatarMoeda(u.salario)}</span>
                </div>
                <div className="team-mobile-meta-item">
                  <span className="label">Último aumento</span>
                  <span className="value">{formatarData(u.ultimo_aumento || u.ultimoAumento)}</span>
                </div>
                <div className="team-mobile-meta-item">
                  <span className="label">Saldo de dias</span>
                  <span className={`value saldo-pill ${(saldos[u.id] ?? 0) > 0 ? 'has-balance' : 'no-balance'}`}>
                    {saldos[u.id] ?? 0} dias
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filtrados.length === 0 && (
          <div className="table-empty">Nenhum colaborador encontrado.</div>
        )}
      </div>
    </div>
  );
}
