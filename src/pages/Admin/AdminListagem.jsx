import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { PERFIL_OPCOES, PERFIL_LABEL, precisaSuperior, candidatosASuperior } from '../../config/perfis';
import { formatarData, formatarMoeda } from '../../utils/formatters';
import { Search, Edit3, ToggleLeft, ToggleRight, Users, X, Loader2, FileSpreadsheet, CalendarClock } from 'lucide-react';
import AdminAusenciasModal from './AdminAusenciasModal';
import '../../components/UI/Components.css';
import './Admin.css';

const FORMATO_OPCOES = ['CLT', 'PJ', 'Sócio Cotista', 'Diretoria'];

const initialEditForm = {
  id: '',
  nome: '',
  email: '',
  perfil: 'usuario',
  formato: '',
  funcao: '',
  superior: '',
  dataAdmissao: '',
  salario: '',
  dataNascimento: '',
  ultimoAumento: '',
};

const initialConfirmacao = {
  id: '',
  nome: '',
};

export default function AdminListagem() {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [colaboradoresData, setColaboradoresData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [editando, setEditando] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [confirmandoDesativacao, setConfirmandoDesativacao] = useState(initialConfirmacao);
  const [ausenciasColab, setAusenciasColab] = useState(null);

  useEffect(() => {
    const carregarColaboradores = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('colaboradores')
        .select('*')
        .order('nome', { ascending: true });

      if (!error && data) {
        setColaboradoresData(data.filter((colaborador) => colaborador.perfil !== 'admin'));
      }
      setLoading(false);
    };

    carregarColaboradores();
  }, []);

  const colaboradoresPorId = colaboradoresData.reduce((acc, colaborador) => {
    acc[colaborador.id] = colaborador;
    return acc;
  }, {});

  const candidatosSuperior = candidatosASuperior(editForm.perfil, colaboradoresData, editForm.id);

  // Gestor é topo de hierarquia; coordenador e usuário precisam de superior.
  const superiorObrigatorio = precisaSuperior(editForm.perfil);

  const todosColaboradores = colaboradoresData.map((u) => {
    const superior = colaboradoresPorId[u.superior_id];

    return {
      ...u,
      perfilLabel: PERFIL_LABEL[u.perfil] || 'Usuário',
      dataAdmissaoFormatada: u.data_admissao || u.dataAdmissao,
      dataNascimento: u.data_nascimento || '',
      ultimoAumento: u.ultimo_aumento || '',
      superiorNome: superior?.nome || '',
      superiorLabel: superior?.nome || (u.perfil === 'gestor' ? 'É o superior' : 'Sem superior'),
    };
  });

  const filtrados = todosColaboradores.filter((u) => {
    const matchBusca =
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase());
    const matchFiltro =
      filtro === 'todos' ||
      (filtro === 'ativo' && u.ativo) ||
      (filtro === 'inativo' && !u.ativo) ||
      (filtro === 'gestor' && u.perfil === 'gestor') ||
      (filtro === 'usuario' && u.perfil === 'usuario');
    return matchBusca && matchFiltro;
  });

  const totalAtivos = todosColaboradores.filter((u) => u.ativo).length;
  const totalInativos = todosColaboradores.filter((u) => !u.ativo).length;

  const fecharModalEdicao = () => {
    if (savingEdit) return;
    setEditando(false);
    setEditForm(initialEditForm);
  };

  const fecharConfirmacaoDesativacao = () => {
    if (updatingId === confirmandoDesativacao.id) return;
    setConfirmandoDesativacao(initialConfirmacao);
  };

  const abrirModalEdicao = (colaborador) => {
    setEditForm({
      id: colaborador.id,
      nome: colaborador.nome || '',
      email: colaborador.email || '',
      perfil: colaborador.perfil || 'usuario',
      formato: colaborador.formato || '',
      funcao: colaborador.funcao || '',
      superior: colaborador.superior_id || '',
      dataAdmissao: colaborador.data_admissao || colaborador.dataAdmissao || '',
      salario: colaborador.salario ?? '',
      dataNascimento: colaborador.data_nascimento || '',
      ultimoAumento: colaborador.ultimo_aumento || '',
    });
    setEditando(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
      // Trocar o perfil muda a lista de candidatos a superior — zera a escolha.
      ...(name === 'perfil' ? { superior: '' } : {}),
    }));
  };

  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    setSavingEdit(true);

    const payload = {
      perfil: editForm.perfil,
      formato: editForm.formato || null,
      funcao: editForm.funcao,
      superior_id: editForm.superior || null,
      data_admissao: editForm.dataAdmissao || null,
      salario: editForm.salario === '' ? null : Number(editForm.salario),
      data_nascimento: editForm.dataNascimento || null,
      ultimo_aumento: editForm.ultimoAumento || null,
    };

    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .update(payload)
        .eq('id', editForm.id)
        .select('*')
        .single();

      if (error) throw error;

      setColaboradoresData((prev) =>
        prev.map((item) => (item.id === editForm.id ? { ...item, ...data } : item))
      );
      fecharModalEdicao();
    } catch (err) {
      console.error('Erro ao salvar colaborador:', err);
      alert('Erro ao salvar edição. Tente novamente.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleStatus = async (colaborador) => {
    const novoStatus = !colaborador.ativo;
    const statusAnterior = colaborador.ativo;

    setUpdatingId(colaborador.id);
    setColaboradoresData((prev) =>
      prev.map((item) => (
        item.id === colaborador.id ? { ...item, ativo: novoStatus } : item
      ))
    );

    try {
      const { error } = await supabase
        .from('colaboradores')
        .update({ ativo: novoStatus })
        .eq('id', colaborador.id);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      setColaboradoresData((prev) =>
        prev.map((item) => (
          item.id === colaborador.id ? { ...item, ativo: statusAnterior } : item
        ))
      );
      alert('Erro ao atualizar status. Tente novamente.');
    } finally {
      setUpdatingId(null);
      if (!novoStatus) {
        setConfirmandoDesativacao(initialConfirmacao);
      }
    }
  };

  const handleAcaoStatus = (colaborador) => {
    if (colaborador.ativo) {
      setConfirmandoDesativacao({
        id: colaborador.id,
        nome: colaborador.nome,
      });
      return;
    }

    handleToggleStatus(colaborador);
  };

  const handleExportExcel = async () => {
    const { utils, writeFile } = await import('xlsx');
    const dataToExport = filtrados.map(u => ({
      'Nome': u.nome,
      'E-mail': u.email,
      'Perfil': u.perfilLabel,
      'Formato': u.formato || '—',
      'Superior': u.superiorLabel,
      'Função': u.funcao || '—',
      'Data de Admissão': formatarData(u.dataAdmissaoFormatada),
      'Data de Nascimento': formatarData(u.dataNascimento),
      'Salário': u.salario ? Number(u.salario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—',
      'Último Aumento': formatarData(u.ultimoAumento),
      'Status': u.ativo ? 'Ativo' : 'Inativo'
    }));

    const worksheet = utils.json_to_sheet(dataToExport);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Colaboradores");
    writeFile(workbook, "listagem_colaboradores.xlsx");
  };

  if (loading) {
    return (
      <div className="admin-page animate-fade-in-up">
        <h1 className="page-title"><Users size={28} /> Listagem de Colaboradores</h1>
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title">
        <Users size={28} /> Listagem de Colaboradores
      </h1>
      <p className="page-subtitle">Gerencie os acessos de gestores e usuários do sistema.</p>

      <div className="cards-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        <div
          className={`stat-card accent ${filtro === 'todos' ? 'is-active' : ''}`}
          onClick={() => setFiltro('todos')}
        >
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <Users size={22} />
            </div>
          </div>
          <div className="stat-card-value">{todosColaboradores.length}</div>
          <div className="stat-card-label">Total Cadastrados</div>
        </div>
        <div
          className={`stat-card success ${filtro === 'ativo' ? 'is-active' : ''}`}
          onClick={() => setFiltro('ativo')}
        >
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <ToggleRight size={22} />
            </div>
          </div>
          <div className="stat-card-value">{totalAtivos}</div>
          <div className="stat-card-label">Ativos</div>
        </div>
        <div
          className={`stat-card danger ${filtro === 'inativo' ? 'is-active' : ''}`}
          onClick={() => setFiltro('inativo')}
        >
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <ToggleLeft size={22} />
            </div>
          </div>
          <div className="stat-card-value">{totalInativos}</div>
          <div className="stat-card-label">Inativos</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Colaboradores</div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="filter-chips">
              {['todos', 'gestor', 'usuario', 'ativo', 'inativo'].map((f) => (
                <button
                  key={f}
                  className={`filter-chip ${filtro === f ? 'active' : ''}`}
                  onClick={() => setFiltro(f)}
                >
                  {f === 'todos' ? 'Todos' : f === 'gestor' ? 'Gestores' : f === 'usuario' ? 'Usuários' : f === 'ativo' ? 'Ativos' : 'Inativos'}
                </button>
              ))}
            </div>
            <div className="table-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
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
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Formato</th>
                <th>Superior</th>
                <th>Função</th>
                <th>Admissão</th>
                <th>Salário</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.id}>
                  <td className="admin-colaborador-nome" title={u.nome}>{u.nome}</td>
                  <td className="admin-colaborador-email" title={u.email}>{u.email}</td>
                  <td>
                    <span className={`badge ${u.perfil === 'gestor' ? 'aprovada' : 'pendente'}`}>
                      {u.perfilLabel}
                    </span>
                  </td>
                  <td>
                    {u.formato ? <span className="badge ativo">{u.formato}</span> : '—'}
                  </td>
                  <td>
                    <span className={`badge ${u.superiorNome ? 'pendente' : 'aprovada'}`} title={u.superiorLabel}>
                      {u.superiorLabel}
                    </span>
                  </td>
                  <td>{u.funcao || '—'}</td>
                  <td>{formatarData(u.dataAdmissaoFormatada)}</td>
                  <td>{formatarMoeda(u.salario)}</td>
                  <td>
                    <span className={`badge ${u.ativo ? 'ativo' : 'inativo'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-ghost btn-icon"
                        title="Férias / Ausências"
                        onClick={() => setAusenciasColab(u)}
                        disabled={updatingId === u.id}
                      >
                        <CalendarClock size={16} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon"
                        title="Editar"
                        onClick={() => abrirModalEdicao(u)}
                        disabled={updatingId === u.id}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="btn btn-icon btn-ghost"
                        title={u.ativo ? 'Desativar' : 'Ativar'}
                        onClick={() => handleAcaoStatus(u)}
                        disabled={updatingId === u.id}
                      >
                        {updatingId === u.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : u.ativo ? (
                          <ToggleRight size={18} color="var(--color-success)" />
                        ) : (
                          <ToggleLeft size={18} color="var(--color-danger)" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtrados.length === 0 && (
          <div className="table-empty">Nenhum colaborador encontrado.</div>
        )}
      </div>

      {editando && (
        <div className="modal-overlay" onClick={fecharModalEdicao}>
          <div className="modal admin-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Editar colaborador</span>
              <button className="modal-close" onClick={fecharModalEdicao} disabled={savingEdit}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicao}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Nome Completo</label>
                    <input className="form-input" value={editForm.nome} readOnly disabled />
                  </div>

                  <div className="form-group">
                    <label className="form-label">E-mail</label>
                    <input className="form-input" type="email" value={editForm.email} readOnly disabled />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Perfil <span className="required">*</span></label>
                    <select
                      className="form-select"
                      name="perfil"
                      value={editForm.perfil}
                      onChange={handleEditChange}
                      required
                    >
                      {PERFIL_OPCOES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Formato</label>
                    <select
                      className="form-select"
                      name="formato"
                      value={editForm.formato}
                      onChange={handleEditChange}
                    >
                      <option value="">Sem formato</option>
                      {FORMATO_OPCOES.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Função <span className="required">*</span></label>
                    <input
                      className="form-input"
                      name="funcao"
                      value={editForm.funcao}
                      onChange={handleEditChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Superior {superiorObrigatorio ? <span className="required">*</span> : '(opcional)'}
                    </label>
                    <select
                      className="form-select"
                      name="superior"
                      value={editForm.superior}
                      onChange={handleEditChange}
                      required={superiorObrigatorio}
                    >
                      <option value="">
                        {superiorObrigatorio ? 'Selecione o superior...' : 'Sem superior'}
                      </option>
                      {candidatosSuperior.map((g) => (
                        <option key={g.id} value={g.id}>{g.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Data de Admissão <span className="required">*</span></label>
                    <input
                      className="form-input"
                      type="date"
                      name="dataAdmissao"
                      value={editForm.dataAdmissao}
                      onChange={handleEditChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Salário</label>
                    <input
                      className="form-input"
                      type="number"
                      name="salario"
                      value={editForm.salario}
                      onChange={handleEditChange}
                      step="0.01"
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Data de Nascimento</label>
                    <input
                      className="form-input"
                      type="date"
                      name="dataNascimento"
                      value={editForm.dataNascimento}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Último Aumento</label>
                    <input
                      className="form-input"
                      type="date"
                      name="ultimoAumento"
                      value={editForm.ultimoAumento}
                      onChange={handleEditChange}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={fecharModalEdicao} disabled={savingEdit}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? <Loader2 size={16} className="animate-spin" /> : <Edit3 size={16} />}
                  {savingEdit ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ausenciasColab && (
        <AdminAusenciasModal
          colaborador={ausenciasColab}
          onClose={() => setAusenciasColab(null)}
        />
      )}

      {confirmandoDesativacao.id && (
        <div className="modal-overlay" onClick={fecharConfirmacaoDesativacao}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Confirmar desativação</span>
              <button
                className="modal-close"
                onClick={fecharConfirmacaoDesativacao}
                disabled={updatingId === confirmandoDesativacao.id}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Deseja desativar o colaborador <strong>{confirmandoDesativacao.nome}</strong>?
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={fecharConfirmacaoDesativacao}
                disabled={updatingId === confirmandoDesativacao.id}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleToggleStatus(colaboradoresPorId[confirmandoDesativacao.id])}
                disabled={updatingId === confirmandoDesativacao.id}
              >
                {updatingId === confirmandoDesativacao.id ? <Loader2 size={16} className="animate-spin" /> : <ToggleLeft size={16} />}
                {updatingId === confirmandoDesativacao.id ? 'Desativando...' : 'Desativar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
