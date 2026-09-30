import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, X, Ban, PlusCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SearchSelect from '../../components/UI/SearchSelect';
import { isAusenciaRh, fmtDataBr } from '../../config/ausenciaProgramada';
import {
  OUTRO_PROJETO, STATUS_ADICIONAL, podeRegistrarAdicional, validarRegistro,
  podeDecidirAdicional, podeCancelarAdicional,
} from '../../config/adicionalAusencia';
import {
  listar, listarEquipe, listarProjetos, registrar, decidir, cancelar, ADICIONAIS_EVENTO,
} from '../../services/adicionalAusencia';
import { Alerta, ModalMotivo } from '../AusenciaProgramada/componentes';
import '../../components/UI/Components.css';
import '../Admin/Admin.css';
import '../AusenciaProgramada/AusenciaProgramada.css';

const TITULOS = {
  meus: 'Adicional de Ausências',
  aprovar: 'Aprovações de adicionais',
  todos: 'Adicionais — Painel RH',
};
const SUBTITULOS = {
  meus: 'Dias adicionais combinados com a sua equipe, por projeto. Depois de aprovados, somam no saldo da Ausência Programada.',
  aprovar: 'Dias adicionais registrados pela sua equipe de gestão. Aprovados, entram no saldo do colaborador.',
  todos: 'Todos os dias adicionais registrados na empresa.',
};

const FILTROS = [
  ['pendente', 'Aguardando'],
  ['aprovada', 'Aprovados'],
  ['reprovada', 'Reprovados'],
  ['cancelada', 'Cancelados'],
  ['todos', 'Todos'],
];

function Status({ r }) {
  const st = STATUS_ADICIONAL[r.status] || { label: r.status, badge: 'inativo' };
  return <span className={`badge ${st.badge}`}>{st.label}</span>;
}

// Três telas no mesmo componente, que só mudam o escopo:
//  * 'meus'    — quem registra (e o colaborador vê os que recebeu);
//  * 'aprovar' — a fila de quem aprova;
//  * 'todos'   — o RH.
export default function AdicionalAusencias({ escopo = 'meus' }) {
  const { user } = useAuth();
  const ehRh = isAusenciaRh(user);
  const registra = escopo === 'meus' && podeRegistrarAdicional(user);
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [filtro, setFiltro] = useState(escopo === 'aprovar' ? 'pendente' : 'todos');
  const [novo, setNovo] = useState(false);
  const [salvandoId, setSalvandoId] = useState(null);
  const [aReprovar, setAReprovar] = useState(null);
  const [aCancelar, setACancelar] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setLista(await listar(escopo));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar os registros.');
    } finally {
      setLoading(false);
    }
  }, [escopo]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    window.addEventListener(ADICIONAIS_EVENTO, carregar);
    return () => window.removeEventListener(ADICIONAIS_EVENTO, carregar);
  }, [carregar]);

  const contagem = useMemo(() => {
    const c = {};
    lista.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [lista]);
  const filtrada = filtro === 'todos' ? lista : lista.filter((r) => r.status === filtro);

  async function aprovar(r) {
    setSalvandoId(r.id);
    setErro('');
    setOkMsg('');
    try {
      await decidir(r.id, { aprovar: true });
      setOkMsg(`Adicional #${r.numero} aprovado: ${r.dias} dia(s) no saldo de ${r.colaborador_nome}.`);
    } catch (e) {
      setErro(e?.message || 'Falha ao aprovar.');
    } finally {
      setSalvandoId(null);
    }
  }

  const titulo = TITULOS[escopo];

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><CalendarPlus size={28} /> {titulo}</h1>
      <p className="page-subtitle">{SUBTITULOS[escopo]}</p>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {okMsg && <Alerta tipo="ok">{okMsg}</Alerta>}
      {escopo === 'aprovar' && (contagem.pendente || 0) > 0 && (
        <Alerta tipo="aviso">{contagem.pendente} registro(s) aguardando sua aprovação.</Alerta>
      )}

      {registra && (
        <div className="ap-secao">
          <button type="button" className="btn btn-primary" onClick={() => { setNovo(true); setOkMsg(''); }}>
            <PlusCircle size={18} /> Efetuar novo registro
          </button>
        </div>
      )}

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Registros</div>
        </div>
        <div className="filter-chips" style={{ padding: '0 var(--space-lg) var(--space-md)' }}>
          {FILTROS.map(([v, l]) => (
            <button key={v} className={`filter-chip ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>
              {l}{v !== 'todos' && contagem[v] ? ` (${contagem[v]})` : ''}
            </button>
          ))}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Colaborador</th>
                <th>Projeto</th>
                <th className="ap-num">Dias</th>
                <th>Registrado por</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="table-empty">Carregando...</td></tr>
              )}
              {!loading && filtrada.map((r) => {
                const decide = podeDecidirAdicional(r, { userId: user?.id, ehRh });
                const cancela = podeCancelarAdicional(r, { userId: user?.id, ehRh });
                return (
                  <tr key={r.id}>
                    <td>#{r.numero}</td>
                    <td>
                      {r.colaborador_nome}
                      <div className="ap-sub">{r.colaborador_funcao || '—'}</div>
                    </td>
                    <td>
                      {r.projeto_nome}
                      {r.observacao && <div className="ap-sub">{r.observacao}</div>}
                    </td>
                    <td className="ap-num"><strong>{r.dias}</strong></td>
                    <td>
                      {r.registrado_por_nome}
                      <div className="ap-sub">{fmtDataBr(String(r.created_at).slice(0, 10))}</div>
                    </td>
                    <td>
                      <Status r={r} />
                      {r.status === 'pendente' && r.aprovador_nome && (
                        <div className="ap-sub">com {r.aprovador_nome}</div>
                      )}
                      {r.status === 'aprovada' && r.periodo_inicio && (
                        <div className="ap-sub">
                          no período {fmtDataBr(r.periodo_inicio)} a {fmtDataBr(r.periodo_fim)}
                        </div>
                      )}
                      {r.decidido_por_nome && r.status !== 'pendente' && (
                        <div className="ap-sub">{r.decidido_por_nome} · {fmtDataBr(String(r.decidido_em).slice(0, 10))}</div>
                      )}
                      {(r.motivo_reprovacao || r.motivo_cancelamento) && (
                        <div className="ap-sub">{r.motivo_reprovacao || r.motivo_cancelamento}</div>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        {decide && (
                          <>
                            <button className="btn btn-success btn-sm" disabled={salvandoId === r.id}
                              onClick={() => aprovar(r)}>
                              <Check size={16} /> Aprovar
                            </button>
                            <button className="btn btn-outline btn-sm" disabled={salvandoId === r.id}
                              onClick={() => setAReprovar(r)}>
                              <X size={16} /> Reprovar
                            </button>
                          </>
                        )}
                        {cancela && (
                          <button className="btn-icon" title="Cancelar registro" onClick={() => setACancelar(r)}>
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtrada.length === 0 && (
                <tr><td colSpan={7} className="table-empty">Nenhum registro aqui.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {novo && (
        <ModalNovoRegistro
          onClose={() => setNovo(false)}
          onSalvo={(r) => {
            setNovo(false);
            setOkMsg(`Registro #${r?.numero ?? ''} enviado para aprovação.`);
          }}
        />
      )}

      {aReprovar && (
        <ModalMotivo
          titulo={`Reprovar adicional #${aReprovar.numero}`}
          descricao={`${aReprovar.colaborador_nome} · ${aReprovar.dias} dia(s) · ${aReprovar.projeto_nome}.`}
          rotulo="Motivo da reprovação"
          confirmar="Reprovar"
          onClose={() => setAReprovar(null)}
          onConfirm={async (motivo) => {
            await decidir(aReprovar.id, { aprovar: false, motivo });
            setAReprovar(null);
          }}
        />
      )}

      {aCancelar && (
        <ModalMotivo
          titulo={`Cancelar adicional #${aCancelar.numero}`}
          descricao={aCancelar.status === 'aprovada'
            ? `${aCancelar.dias} dia(s) saem do saldo de ${aCancelar.colaborador_nome}.`
            : `${aCancelar.colaborador_nome} · ${aCancelar.dias} dia(s) · ${aCancelar.projeto_nome}.`}
          rotulo="Motivo do cancelamento"
          obrigatorio={aCancelar.registrado_por !== user?.id}
          confirmar="Cancelar registro"
          onClose={() => setACancelar(null)}
          onConfirm={async (motivo) => {
            await cancelar(aCancelar.id, { motivo: motivo || null });
            setACancelar(null);
          }}
        />
      )}
    </div>
  );
}

// O fluxo do pedido: colaborador (busca), projeto (lista ou digitado), dias.
function ModalNovoRegistro({ onClose, onSalvo }) {
  const [equipe, setEquipe] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [f, setF] = useState({ colaboradorId: '', projetoId: '', projetoNome: '', dias: '1', observacao: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const mexer = (patch) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    let vivo = true;
    Promise.all([listarEquipe(), listarProjetos()])
      .then(([e, p]) => { if (vivo) { setEquipe(e); setProjetos(p); } })
      .catch((e) => { if (vivo) setErro(e.message); });
    return () => { vivo = false; };
  }, []);

  const opcoesProjeto = [
    ...projetos.map((p) => ({ value: p.id, label: p.cliente ? `${p.nome} — ${p.cliente}` : p.nome })),
    // Obra nova que ainda não está cadastrada não pode travar o registro.
    { value: OUTRO_PROJETO, label: 'Não está na lista — digitar o nome' },
  ];

  async function salvar() {
    const msg = validarRegistro(f);
    if (msg) return setErro(msg);
    setErro('');
    setSalvando(true);
    try {
      onSalvo(await registrar(f));
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !salvando && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Novo registro de dias adicionais</span>
          <button className="modal-close" onClick={onClose} disabled={salvando} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Colaborador</label>
            <SearchSelect
              value={f.colaboradorId}
              onChange={(v) => mexer({ colaboradorId: v })}
              options={equipe.map((c) => ({ value: c.id, label: c.funcao ? `${c.nome} — ${c.funcao}` : c.nome }))}
              placeholder="Busque pelo nome…"
              ariaLabel="Colaborador"
            />
            <span className="ap-sub">Só aparece quem é da sua equipe no organograma.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Projeto</label>
            <SearchSelect
              value={f.projetoId}
              onChange={(v) => mexer({ projetoId: v, projetoNome: '' })}
              options={opcoesProjeto}
              placeholder="Busque pelo projeto ou cliente…"
              ariaLabel="Projeto"
            />
            <span className="ap-sub">O registro é por projeto: a mesma pessoa pode ter adicionais em projetos diferentes.</span>
          </div>

          {f.projetoId === OUTRO_PROJETO && (
            <div className="form-group">
              <label className="form-label">Nome do projeto</label>
              <input className="form-input" value={f.projetoNome} onChange={(e) => mexer({ projetoNome: e.target.value })} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Dias adicionais</label>
            <input className="form-input" type="number" min={1} step={1} style={{ maxWidth: 140 }}
              value={f.dias} onChange={(e) => mexer({ dias: e.target.value })} />
            <span className="ap-sub">
              Aprovados, entram no saldo do período em uso da Ausência Programada e vencem junto com ele.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Observação (opcional)</label>
            <textarea className="form-input" rows={2} value={f.observacao}
              onChange={(e) => mexer({ observacao: e.target.value })} />
          </div>

          {erro && <Alerta tipo="erro">{erro}</Alerta>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Voltar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
