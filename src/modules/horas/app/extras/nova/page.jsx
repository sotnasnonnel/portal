import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { fetchProjetosVisiveis, fetchGerencias } from '../../../lib/data';
import {
  fetchMeuAprovador,
  fetchExcecaoAplicavel,
  fetchUltimaMinha,
  criarSolicitacao,
} from '../../../../../services/horasExtras';
import {
  MOTIVOS,
  MOTIVO_OUTRO,
  diaISO,
  fmtMin,
  janelaPedido,
  minutosEntre,
  validarPrazo,
} from '../../../../../config/horasExtras';
import { notificarHoraExtra } from '../../../../../services/notificarHoraExtra';
import SearchableSelect from '../../components/SearchableSelect';
import Aviso, { Carregando } from '../../components/Aviso';

// Nova Solicitação de Hora Extra.
// O prazo é validado aqui e no envio: sem retroativo e, no próprio dia, só até o
// limite (12:00 por padrão, ou o horário de uma exceção ativa do DP que cubra a
// data). A exceção vem da RPC — o colaborador não lê a tabela de exceções.
export default function NovaHEPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const colaboradorId = user?.id;
  const gerenciaId = user?.horasGerenciaId || null;

  const [projetos, setProjetos] = useState([]);
  const [gerenciaNome, setGerenciaNome] = useState('');
  const [aprovador, setAprovador] = useState(null);
  const [excecao, setExcecao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [form, setForm] = useState({
    matricula: '',
    centroCusto: '',
    projetoId: '',
    dataHe: diaISO(),
    horaInicio: '18:00',
    horaFim: '20:00',
    motivo: MOTIVOS[0],
    outroMotivo: '',
    justificativa: '',
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!colaboradorId) return;
      setLoading(true);
      setErro('');
      try {
        const [ps, gs, ap, ultima] = await Promise.all([
          fetchProjetosVisiveis(),
          fetchGerencias(),
          fetchMeuAprovador(),
          fetchUltimaMinha(colaboradorId),
        ]);
        if (cancel) return;
        setProjetos(ps);
        setGerenciaNome(gs.find((g) => g.id === gerenciaId)?.nome || '');
        setAprovador(ap);
        // Matrícula e centro de custo não existem no cadastro: repetimos o que a
        // pessoa informou na última solicitação para não redigitar sempre.
        setForm((f) => ({
          ...f,
          matricula: ultima?.matricula || '',
          centroCusto: ultima?.centro_custo || '',
          projetoId: f.projetoId || ultima?.projeto_id || ps[0]?.id || '',
        }));
      } catch (e) {
        if (!cancel) setErro(e?.message || 'Falha ao carregar os dados da solicitação.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [colaboradorId, gerenciaId]);

  // Exceção de prazo aplicável muda com a data e com o projeto (o escopo
  // "Equipe/Projeto" pode apontar para um projeto específico).
  const carregarExcecao = useCallback(async () => {
    if (!form.dataHe) {
      setExcecao(null);
      return;
    }
    try {
      setExcecao(await fetchExcecaoAplicavel({ data: form.dataHe, projetoId: form.projetoId }));
    } catch {
      setExcecao(null); // sem exceção conhecida = regra padrão
    }
  }, [form.dataHe, form.projetoId]);

  useEffect(() => {
    carregarExcecao();
  }, [carregarExcecao]);

  const prazo = useMemo(() => validarPrazo({ data: form.dataHe, excecao }), [form.dataHe, excecao]);
  // O input de data já nasce fechado no passado; só uma exceção ativa o reabre.
  const janela = useMemo(() => janelaPedido({ excecao }), [excecao]);
  const minutos = minutosEntre(form.horaInicio, form.horaFim);
  const motivoFinal = form.motivo === MOTIVO_OUTRO ? form.outroMotivo.trim() : form.motivo;

  async function enviar() {
    // Revalida o prazo no envio: a tela pode ficar aberta atravessando o limite.
    const atual = validarPrazo({ data: form.dataHe, excecao });
    if (!atual.ok) {
      setErro(atual.msg);
      return;
    }
    if (!minutos) {
      setErro('O horário de fim deve ser maior que o de início.');
      return;
    }
    if (form.motivo === MOTIVO_OUTRO && !form.outroMotivo.trim()) {
      setErro('Descreva o outro motivo.');
      return;
    }
    if (!form.justificativa.trim()) {
      setErro('A justificativa é obrigatória.');
      return;
    }
    if (!aprovador) {
      setErro(
        'Não encontramos um gestor com acesso ao portal acima de você na hierarquia. Peça à Gestão de Pessoas para ajustar o seu superior.'
      );
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      const criada = await criarSolicitacao({
        colaboradorId,
        aprovadorId: aprovador.id,
        gerenciaId,
        projetoId: form.projetoId || null,
        cargo: user?.funcao || null,
        matricula: form.matricula.trim(),
        centroCusto: form.centroCusto.trim(),
        dataHe: form.dataHe,
        horaInicio: form.horaInicio,
        horaFim: form.horaFim,
        motivo: motivoFinal,
        justificativa: form.justificativa.trim(),
        limiteHorario: atual.limite,
        excecaoId: excecao?.id || null,
      });
      // Best-effort: o e-mail nunca bloqueia a solicitação já gravada.
      await notificarHoraExtra(criada.id, 'nova');
      navigate('/horas/extras/minhas');
    } catch (e) {
      setErro(e?.message || 'Falha ao enviar a solicitação.');
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <>
        <h1>Nova Solicitação de Hora Extra</h1>
        <Carregando />
      </>
    );
  }

  return (
    <>
      <h1>Nova Solicitação de Hora Extra</h1>
      <p className="horas-sub">
        Equipe: <b>{gerenciaNome || '—'}</b> · Aprovador:{' '}
        <b>{aprovador ? aprovador.nome : 'não identificado'}</b>
      </p>

      <Aviso tom={prazo.ok ? 'ok' : 'erro'}>{prazo.msg}</Aviso>

      {!aprovador ? (
        <Aviso tom="erro">
          Nenhum gestor com acesso ao portal foi encontrado acima de você na hierarquia da Gestão
          de Pessoas. Sem isso não há para quem enviar a aprovação.
        </Aviso>
      ) : null}

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <section className="horas-card" aria-labelledby="horas-he-ident-tit">
        <h2 className="horas-sec" id="horas-he-ident-tit">
          Identificação
        </h2>
        <div className="horas-timer-grid">
          <div className="horas-fld">
            <label htmlFor="horas-he-nome">Colaborador</label>
            <input id="horas-he-nome" type="text" value={user?.nome || ''} disabled />
          </div>
          <div className="horas-fld">
            <label htmlFor="horas-he-cargo">Cargo</label>
            <input id="horas-he-cargo" type="text" value={user?.funcao || '—'} disabled />
          </div>
          <div className="horas-fld">
            <label htmlFor="horas-he-matricula">Matrícula</label>
            <input
              id="horas-he-matricula"
              type="text"
              placeholder="Ex.: 12345"
              value={form.matricula}
              onChange={(e) => set({ matricula: e.target.value })}
            />
          </div>
          <div className="horas-fld">
            <label htmlFor="horas-he-cc">Centro de custo</label>
            <input
              id="horas-he-cc"
              type="text"
              placeholder="Ex.: Engenharia"
              value={form.centroCusto}
              onChange={(e) => set({ centroCusto: e.target.value })}
            />
          </div>
          <div className="horas-fld">
            <label htmlFor="horas-he-projeto">Cliente/Projeto</label>
            <SearchableSelect
              id="horas-he-projeto"
              value={form.projetoId}
              placeholder="Selecione o projeto…"
              onChange={(v) => set({ projetoId: v })}
              options={projetos.map((p) => ({
                value: p.id,
                label: p.nome + (p.cliente ? ` — ${p.cliente}` : ''),
              }))}
            />
          </div>
          <div className="horas-fld">
            <label htmlFor="horas-he-equipe">Equipe</label>
            <input id="horas-he-equipe" type="text" value={gerenciaNome || '—'} disabled />
          </div>
        </div>
      </section>

      <section className="horas-card" aria-labelledby="horas-he-dados-tit">
        <h2 className="horas-sec" id="horas-he-dados-tit">
          A hora extra
        </h2>
        <div className="horas-timer-grid">
          <div className="horas-fld">
            <label htmlFor="horas-he-data">Data</label>
            <input
              id="horas-he-data"
              type="date"
              value={form.dataHe}
              min={janela.min}
              onChange={(e) => set({ dataHe: e.target.value })}
            />
          </div>
          <div className="horas-fld">
            <label htmlFor="horas-he-ini">Hora início</label>
            <input
              id="horas-he-ini"
              type="time"
              value={form.horaInicio}
              onChange={(e) => set({ horaInicio: e.target.value })}
            />
          </div>
          <div className="horas-fld">
            <label htmlFor="horas-he-fim">Hora fim</label>
            <input
              id="horas-he-fim"
              type="time"
              value={form.horaFim}
              onChange={(e) => set({ horaFim: e.target.value })}
            />
          </div>
          <div className="horas-fld">
            <label htmlFor="horas-he-qtd">Quantidade estimada</label>
            <input id="horas-he-qtd" type="text" value={fmtMin(minutos)} disabled />
          </div>
          <div className="horas-fld">
            <label htmlFor="horas-he-motivo">Motivo</label>
            <select id="horas-he-motivo" value={form.motivo} onChange={(e) => set({ motivo: e.target.value })}>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {form.motivo === MOTIVO_OUTRO ? (
            <div className="horas-fld">
              <label htmlFor="horas-he-outro">Descrever outro motivo</label>
              <input
                id="horas-he-outro"
                type="text"
                value={form.outroMotivo}
                onChange={(e) => set({ outroMotivo: e.target.value })}
              />
            </div>
          ) : null}
          <div className="horas-fld" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="horas-he-just">
              Justificativa <span className="horas-muted">(obrigatória)</span>
            </label>
            <textarea
              id="horas-he-just"
              required
              rows={3}
              placeholder="Explique por que a hora extra é necessária."
              value={form.justificativa}
              onChange={(e) => set({ justificativa: e.target.value })}
            />
          </div>
        </div>

        <Aviso>
          Ao enviar, o seu gestor recebe um e-mail e decide o <b>destino da hora</b>:
          Medição/Pagamento ou Banco de Horas. O percentual é aplicado pelo DP/RM conforme a CCT
          vigente.
        </Aviso>

        <div className="horas-modal-acoes">
          <button
            className="horas-btn grn"
            type="button"
            onClick={enviar}
            disabled={enviando || !prazo.ok || !aprovador}
          >
            <Send size={16} /> {enviando ? 'Enviando…' : 'Enviar solicitação'}
          </button>
        </div>
      </section>
    </>
  );
}
