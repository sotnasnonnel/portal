import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { PERFIL_OPCOES, precisaSuperior, candidatosASuperior } from '../../config/perfis';
import { UserPlus, CheckCircle, Loader2, UserCog } from 'lucide-react';
import '../../components/UI/Components.css';
import './Admin.css';

const FORMATO_OPCOES = ['CLT', 'PJ', 'Sócio Cotista', 'Diretoria'];

const FORM_INICIAL = {
  nome: '', email: '', perfil: 'usuario', formato: '', dataNascimento: '',
  funcao: '', superior: '', dataAdmissao: '', salario: '', ultimoAumento: '',
};

export default function AdminCadastro() {
  const [aba, setAba] = useState('novo'); // 'novo' (pré-cadastro) | 'editar' (existente)
  const [colaboradores, setColaboradores] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(FORM_INICIAL);
  const [sucesso, setSucesso] = useState('');

  const superiorObrigatorio = precisaSuperior(formData.perfil);
  const candidatosSuperior = candidatosASuperior(
    formData.perfil, colaboradores, aba === 'editar' ? selecionadoId : null,
  );
  const selecionado = colaboradores.find((c) => c.id === selecionadoId) || null;

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase
        .from('colaboradores').select('*').eq('ativo', true).order('nome');
      const lista = (data || []).filter((c) => c.perfil !== 'admin');
      setColaboradores(lista);
    };
    carregar();
  }, []);

  const trocarAba = (nova) => {
    setAba(nova);
    setSelecionadoId('');
    setFormData(FORM_INICIAL);
    setSucesso('');
  };

  const handleSelecionar = (e) => {
    const id = e.target.value;
    setSelecionadoId(id);
    setSucesso('');
    const c = colaboradores.find((x) => x.id === id);
    if (!c) {
      setFormData(FORM_INICIAL);
      return;
    }
    setFormData({
      nome: c.nome || '',
      email: c.email || '',
      perfil: c.perfil || 'usuario',
      formato: c.formato || '',
      dataNascimento: c.data_nascimento || '',
      funcao: c.funcao || '',
      superior: c.superior_id || '',
      dataAdmissao: c.data_admissao || '',
      salario: c.salario ?? '',
      ultimoAumento: c.ultimo_aumento || '',
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Trocar o perfil muda a lista de candidatos a superior — zera a escolha.
      ...(name === 'perfil' ? { superior: '' } : {}),
    }));
    setSucesso('');
  };

  const camposRh = () => ({
    perfil: formData.perfil,
    formato: formData.formato || null,
    funcao: formData.funcao,
    superior_id: superiorObrigatorio ? (formData.superior || null) : null,
    data_admissao: formData.dataAdmissao || null,
    data_nascimento: formData.dataNascimento || null,
    salario: formData.salario === '' ? null : Number(formData.salario),
    ultimo_aumento: formData.ultimoAumento || null,
  });

  const cadastrarNovo = async () => {
    const email = formData.email.trim();
    // Já existe (inclusive auto-provisionado "Sem acesso")? Usa a aba Editar.
    const { data: existe } = await supabase
      .from('colaboradores').select('id').ilike('email', email).maybeSingle();
    if (existe) {
      alert('Já existe um colaborador com esse e-mail. Use a aba "Editar existente" para completar os dados (a pessoa pode já ter entrado).');
      return;
    }
    const { data: created, error } = await supabase
      .from('colaboradores')
      .insert([{ nome: formData.nome.trim(), email, ...camposRh(), ativo: true }])
      .select('*')
      .single();
    if (error) throw error;
    if (created && created.perfil !== 'admin') {
      setColaboradores((prev) => [...prev, created].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')));
    }
    setFormData(FORM_INICIAL);
    setSucesso('Colaborador cadastrado! Ao logar com a conta Microsoft deste e-mail, o acesso será vinculado.');
  };

  const salvarExistente = async () => {
    const { error } = await supabase
      .from('colaboradores').update(camposRh()).eq('id', selecionadoId);
    if (error) throw error;
    setColaboradores((prev) => prev.map((c) => (c.id === selecionadoId ? { ...c, ...camposRh() } : c)));
    setSucesso('Dados atualizados com sucesso!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (aba === 'editar' && !selecionadoId) return;
    setLoading(true);
    try {
      if (aba === 'novo') await cadastrarNovo();
      else await salvarExistente();
      setTimeout(() => setSucesso(''), 5000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const mostrarCampos = aba === 'novo' || !!selecionado;

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title">
        <UserPlus size={28} /> Cadastro de Colaboradores
      </h1>
      <p className="page-subtitle">
        {aba === 'novo'
          ? 'Pré-cadastre uma pessoa (nome, e-mail e dados de RH). Ao entrar com a conta Microsoft do mesmo e-mail, os dados são vinculados.'
          : 'Selecione um colaborador para completar ou atualizar os dados de RH.'}
      </p>

      <div className="filter-chips" style={{ marginBottom: 'var(--space-lg)' }}>
        <button type="button" className={`filter-chip ${aba === 'novo' ? 'active' : ''}`} onClick={() => trocarAba('novo')}>
          <UserPlus size={14} /> Cadastrar novo
        </button>
        <button type="button" className={`filter-chip ${aba === 'editar' ? 'active' : ''}`} onClick={() => trocarAba('editar')}>
          <UserCog size={14} /> Editar existente
        </button>
      </div>

      {sucesso && (
        <div className="success-msg">
          <CheckCircle size={18} /> {sucesso}
        </div>
      )}

      <div className="form-card">
        <div className="form-card-header">
          <UserPlus size={20} color="var(--color-primary)" />
          <h2>Dados do Colaborador</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-card-body">
            {aba === 'editar' && (
              <div className="form-group" style={{ maxWidth: 480 }}>
                <label className="form-label">Colaborador <span className="required">*</span></label>
                <select className="form-select" value={selecionadoId} onChange={handleSelecionar} required>
                  <option value="">Selecione o colaborador...</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {mostrarCampos && (
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Nome Completo <span className="required">*</span></label>
                  {aba === 'novo' ? (
                    <input className="form-input" name="nome" value={formData.nome} onChange={handleChange} placeholder="Ex: João da Silva" required />
                  ) : (
                    <input className="form-input" value={selecionado?.nome || ''} readOnly disabled />
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">E-mail <span className="required">*</span></label>
                  {aba === 'novo' ? (
                    <input className="form-input" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@phdengenharia.eng.br" required />
                  ) : (
                    <input className="form-input" value={selecionado?.email || ''} readOnly disabled />
                  )}
                  <span className="form-hint">O acesso é feito com a conta Microsoft da PHD usando este e-mail.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Perfil <span className="required">*</span></label>
                  <select className="form-select" name="perfil" value={formData.perfil} onChange={handleChange} required>
                    {PERFIL_OPCOES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Formato <span className="required">*</span></label>
                  <select className="form-select" name="formato" value={formData.formato} onChange={handleChange} required>
                    <option value="">Selecione o formato...</option>
                    {FORMATO_OPCOES.map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Data de Nascimento <span className="required">*</span></label>
                  <input className="form-input" type="date" name="dataNascimento" value={formData.dataNascimento} onChange={handleChange} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Função <span className="required">*</span></label>
                  <input className="form-input" name="funcao" value={formData.funcao} onChange={handleChange} placeholder="Ex: Engenheiro Civil" required />
                </div>

                {superiorObrigatorio && (
                  <div className="form-group">
                    <label className="form-label">Superior <span className="required">*</span></label>
                    <select className="form-select" name="superior" value={formData.superior} onChange={handleChange} required={superiorObrigatorio}>
                      <option value="">Selecione o superior...</option>
                      {candidatosSuperior.map((g) => (
                        <option key={g.id} value={g.id}>{g.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Data de Admissão <span className="required">*</span></label>
                  <input className="form-input" type="date" name="dataAdmissao" value={formData.dataAdmissao} onChange={handleChange} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Salário <span className="required">*</span></label>
                  <input className="form-input" type="number" name="salario" value={formData.salario} onChange={handleChange} placeholder="Ex: 8500.00" step="0.01" required />
                </div>

                <div className="form-group">
                  <label className="form-label">Último Aumento</label>
                  <input className="form-input" type="date" name="ultimoAumento" value={formData.ultimoAumento} onChange={handleChange} />
                </div>
              </div>
            )}
          </div>

          <div className="form-card-footer">
            <button type="button" className="btn btn-outline" onClick={() => trocarAba(aba)}>
              Limpar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || (aba === 'editar' && !selecionadoId)}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {loading ? 'Salvando...' : aba === 'novo' ? 'Cadastrar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
