import { useCallback, useEffect, useState } from 'react';
import { UserSearch, UserPlus, Pencil, BadgeCheck, Trash2, X, AlertCircle, CheckCircle } from 'lucide-react';
import SearchSelect from '../../components/UI/SearchSelect';
import { listarPessoas } from '../../modules/administrativo/lib/chamados';
import {
  listarCandidatos, salvarCandidato, promoverCandidato, descartarCandidato,
} from '../../services/candidatos';
import '../../components/UI/Components.css';
import './Admin.css';

const FORMATO_OPCOES = ['CLT', 'PJ', 'Sócio Cotista', 'Diretoria'];
const PERFIS_PROMOCAO = [['usuario', 'Usuário'], ['coordenador', 'Coordenador'], ['gestor', 'Gestor']];
const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');

function Modal({ titulo, onClose, bloqueado, children, rodape }) {
  return (
    <div className="modal-overlay" onClick={() => !bloqueado && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{titulo}</span>
          <button className="modal-close" onClick={onClose} disabled={bloqueado} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{rodape}</div>
      </div>
    </div>
  );
}

function Erro({ texto }) {
  if (!texto) return null;
  return <div className="form-error" role="alert"><AlertCircle size={16} /> {texto}</div>;
}

/**
 * Candidatos — quem está em contratação e ainda não é funcionário (pedido do
 * André, 30/09/2026). Cadastrado aqui, o nome aparece nos campos de pessoa do
 * Atendimento (passagem, hospedagem, mobilização…), e "Promover para o quadro"
 * transforma o MESMO registro em funcionário: tudo que já foi pedido no nome
 * dele continua ligado a ele.
 */
export default function AdminCandidatos() {
  const [lista, setLista] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [editando, setEditando] = useState(null);   // {} novo | candidato
  const [promovendo, setPromovendo] = useState(null);
  const [descartando, setDescartando] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setLista(await listarCandidatos());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    // Ativos (sem candidatos): gestor previsto e superior na promoção.
    listarPessoas().then(setGestores).catch(() => setGestores([]));
  }, [carregar]);

  const opcoesGestor = gestores.map((p) => ({ value: p.id, label: p.nome }));

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><UserSearch size={28} /> Candidatos</h1>
      <p className="page-subtitle">
        Pessoas em processo de contratação. Cadastradas aqui, já podem ser escolhidas nos pedidos do
        Atendimento (passagem, hospedagem, mobilização…). Na contratação, use “Promover para o quadro”.
      </p>

      <Erro texto={erro} />
      {ok && <div className="success-msg"><CheckCircle size={18} /> {ok}</div>}

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Em contratação ({lista.length})</div>
          <button className="btn btn-primary" onClick={() => { setOk(''); setEditando({}); }}>
            <UserPlus size={18} /> Novo candidato
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th><th>Função prevista</th><th>Modalidade</th><th>Gestor</th>
                <th>Previsão de início</th><th>Pedidos no nome</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={7} className="table-empty">Carregando...</td></tr>}
              {!carregando && lista.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.nome}
                    {c.obs && <div className="text-muted" style={{ fontSize: 'var(--font-size-2xs)' }}>{c.obs}</div>}
                  </td>
                  <td>{c.funcao || '—'}</td>
                  <td>{c.formato || '—'}</td>
                  <td>{c.gestor_nome || '—'}</td>
                  <td>{dataBr(c.previsao)}</td>
                  <td>{c.chamados || '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-success btn-sm" onClick={() => { setOk(''); setPromovendo(c); }}>
                        <BadgeCheck size={16} /> Promover para o quadro
                      </button>
                      <button className="btn-icon" title="Editar" onClick={() => { setOk(''); setEditando(c); }}>
                        <Pencil size={16} />
                      </button>
                      <button className="btn-icon" title="Descartar (desistência)" onClick={() => { setOk(''); setDescartando(c); }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!carregando && lista.length === 0 && (
                <tr><td colSpan={7} className="table-empty">Nenhum candidato em contratação.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <ModalCandidato
          candidato={editando}
          opcoesGestor={opcoesGestor}
          onClose={() => setEditando(null)}
          onSalvo={async (novo) => {
            setEditando(null);
            setOk(novo ? 'Candidato cadastrado. O nome já aparece nos pedidos do Atendimento.' : 'Dados atualizados.');
            await carregar();
          }}
        />
      )}

      {promovendo && (
        <ModalPromover
          candidato={promovendo}
          opcoesGestor={opcoesGestor}
          onClose={() => setPromovendo(null)}
          onPromovido={async () => {
            setOk(`${promovendo.nome} agora é funcionário. Complete os demais dados em Cadastro, se precisar.`);
            setPromovendo(null);
            await carregar();
          }}
        />
      )}

      {descartando && (
        <ModalDescartar
          candidato={descartando}
          onClose={() => setDescartando(null)}
          onDescartado={async (resultado) => {
            setOk(resultado === 'arquivado'
              ? `${descartando.nome} saiu da lista. Como já há pedidos no nome dele, o registro foi guardado para o histórico.`
              : `${descartando.nome} foi removido.`);
            setDescartando(null);
            await carregar();
          }}
        />
      )}
    </div>
  );
}

function ModalCandidato({ candidato, opcoesGestor, onClose, onSalvo }) {
  const novo = !candidato.id;
  const [f, setF] = useState({
    nome: candidato.nome || '',
    funcao: candidato.funcao || '',
    formato: candidato.formato || '',
    gestorId: candidato.gestor_id || '',
    previsao: candidato.previsao || '',
    obs: candidato.obs || '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function salvar() {
    if (!f.nome.trim()) return setErro('Informe o nome do candidato.');
    setErro('');
    setSalvando(true);
    try {
      await salvarCandidato({ id: candidato.id || null, ...f });
      await onSalvo(novo);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <Modal
      titulo={novo ? 'Novo candidato' : 'Editar candidato'}
      onClose={onClose}
      bloqueado={salvando}
      rodape={(
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Voltar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </>
      )}
    >
      <div className="form-group">
        <label className="form-label">Nome completo</label>
        <input className="form-input" value={f.nome} onChange={set('nome')} placeholder="Como vai aparecer nos pedidos" />
      </div>
      <div className="form-group">
        <label className="form-label">Função prevista (opcional)</label>
        <input className="form-input" value={f.funcao} onChange={set('funcao')} />
      </div>
      <div className="form-group">
        <label className="form-label">Modalidade prevista (opcional)</label>
        <select className="form-input" value={f.formato} onChange={set('formato')}>
          <option value="">—</option>
          {FORMATO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Gestor (opcional)</label>
        <SearchSelect value={f.gestorId} onChange={(v) => setF((x) => ({ ...x, gestorId: v }))}
          options={opcoesGestor} placeholder="Busque pelo nome…" ariaLabel="Gestor" />
        <div className="form-hint">Vira o superior no organograma quando a pessoa for promovida.</div>
      </div>
      <div className="form-group">
        <label className="form-label">Previsão de início (opcional)</label>
        <input className="form-input" type="date" value={f.previsao} onChange={set('previsao')} />
      </div>
      <div className="form-group">
        <label className="form-label">Observação (opcional)</label>
        <textarea className="form-input" rows={2} value={f.obs} onChange={set('obs')} />
      </div>
      <Erro texto={erro} />
    </Modal>
  );
}

function ModalPromover({ candidato, opcoesGestor, onClose, onPromovido }) {
  const [f, setF] = useState({
    email: '',
    dataAdmissao: candidato.previsao || '',
    formato: candidato.formato || '',
    perfil: 'usuario',
    funcao: candidato.funcao || '',
    superiorId: candidato.gestor_id || '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function promover() {
    if (!f.email.trim()) return setErro('Informe o e-mail corporativo.');
    if (!f.dataAdmissao) return setErro('Informe a data de admissão.');
    if (!f.formato) return setErro('Informe a modalidade.');
    setErro('');
    setSalvando(true);
    try {
      await promoverCandidato(candidato.id, f);
      await onPromovido();
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <Modal
      titulo="Promover para o quadro"
      onClose={onClose}
      bloqueado={salvando}
      rodape={(
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Voltar</button>
          <button className="btn btn-success" onClick={promover} disabled={salvando}>
            {salvando ? 'Promovendo...' : 'Confirmar contratação'}
          </button>
        </>
      )}
    >
      <p className="form-hint" style={{ marginTop: 0 }}>
        <strong>{candidato.nome}</strong> passa a ser funcionário
        {candidato.chamados ? `, e os ${candidato.chamados} pedido(s) já feitos no nome dele continuam ligados a ele` : ''}.
      </p>
      <div className="form-group">
        <label className="form-label">E-mail corporativo</label>
        <input className="form-input" type="email" value={f.email} onChange={set('email')} placeholder="nome.sobrenome@phdengenharia.eng.br" />
        <div className="form-hint">É com ele que a pessoa entra no portal (conta Microsoft).</div>
      </div>
      <div className="form-group">
        <label className="form-label">Data de admissão</label>
        <input className="form-input" type="date" value={f.dataAdmissao} onChange={set('dataAdmissao')} />
      </div>
      <div className="form-group">
        <label className="form-label">Modalidade</label>
        <select className="form-input" value={f.formato} onChange={set('formato')}>
          <option value="">Selecione…</option>
          {FORMATO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Perfil</label>
        <select className="form-input" value={f.perfil} onChange={set('perfil')}>
          {PERFIS_PROMOCAO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Função</label>
        <input className="form-input" value={f.funcao} onChange={set('funcao')} />
      </div>
      <div className="form-group">
        <label className="form-label">Superior</label>
        <SearchSelect value={f.superiorId} onChange={(v) => setF((x) => ({ ...x, superiorId: v }))}
          options={opcoesGestor} placeholder="Busque pelo nome…" ariaLabel="Superior" />
      </div>
      <Erro texto={erro} />
    </Modal>
  );
}

function ModalDescartar({ candidato, onClose, onDescartado }) {
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function descartar() {
    setErro('');
    setSalvando(true);
    try {
      await onDescartado(await descartarCandidato(candidato.id));
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <Modal
      titulo="Descartar candidato"
      onClose={onClose}
      bloqueado={salvando}
      rodape={(
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Voltar</button>
          <button className="btn btn-danger" onClick={descartar} disabled={salvando}>
            {salvando ? 'Descartando...' : 'Descartar'}
          </button>
        </>
      )}
    >
      <p style={{ marginTop: 0 }}>
        <strong>{candidato.nome}</strong> sai da lista e deixa de aparecer nos pedidos do Atendimento.
      </p>
      {candidato.chamados > 0 && (
        <p className="form-hint">
          Já há {candidato.chamados} pedido(s) no nome dele: o registro fica guardado para esses pedidos
          continuarem mostrando o nome.
        </p>
      )}
      <Erro texto={erro} />
    </Modal>
  );
}
