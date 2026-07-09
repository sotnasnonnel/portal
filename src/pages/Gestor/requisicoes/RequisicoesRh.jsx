import { useState } from 'react';
import { Clock, CheckCheck, X, ClipboardCheck, FileText } from 'lucide-react';
import FluxoTimeline from '../../../components/Solicitacoes/FluxoTimeline';
import { resumoAndamento, TIPO_LABEL, INICIATIVA_LABEL } from '../../../config/aprovacao';
import { formatarMoeda, parseDesligamento } from '../../../utils/formatters';
import ModalRespostas, { DETALHE, buscarRespostas } from './ModalRespostas';
import BotaoPdfRequisicao from '../../../components/BotaoPdfRequisicao';

// Visão do RH/DP: vê TODAS as requisições (somente leitura). Cards de status no
// topo filtram a lista compacta; clicar numa requisição abre o detalhe (fluxo).
const TOM_BADGE = {
  pendente: { label: 'Em andamento', badge: 'pendente' },
  concluida: { label: 'Concluída', badge: 'aprovada' },
  reprovada: { label: 'Reprovada', badge: 'inativo' },
};

const CARDS = [
  { key: 'todos', label: 'Todas', tone: 'accent', Icon: ClipboardCheck },
  { key: 'pendente', label: 'Em andamento', tone: 'warning', Icon: Clock },
  { key: 'concluida', label: 'Concluídas', tone: 'success', Icon: CheckCheck },
  { key: 'reprovada', label: 'Reprovadas', tone: 'danger', Icon: X },
];

export default function RequisicoesRh({ participa, nomes, loading }) {
  const [filtro, setFiltro] = useState('pendente'); // começa em "Em andamento"
  const [aberta, setAberta] = useState(null);        // requisição aberta no modal
  const [verRespostas, setVerRespostas] = useState(null);
  const [solRespostas, setSolRespostas] = useState(null);

  const abrirRespostas = async (sol) => { setSolRespostas(sol); setVerRespostas(await buscarRespostas(sol)); };

  const nomeSolic = (s) => nomes[s.gestor_id] || s.gestor?.nome || '—';
  const nomeColab = (s) => nomes[s.colaborador_id] || s.colaborador?.nome || '';
  const tomDe = (s) => resumoAndamento(s, s.etapas).tom;

  const contar = (key) => participa.filter((s) => tomDe(s) === key).length;
  const filtradas = filtro === 'todos' ? participa : participa.filter((s) => tomDe(s) === filtro);

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title"><ClipboardCheck size={28} /> Requisições</h1>
      <p className="page-subtitle">Todas as requisições do DP — clique numa para ver o fluxo de aprovação.</p>

      <div className="cards-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        {CARDS.map((c) => {
          const Icon = c.Icon;
          return (
            <div
              key={c.key}
              className={`stat-card ${c.tone} ${filtro === c.key ? 'is-active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setFiltro(c.key)}
            >
              <div className="stat-card-header">
                <div className="stat-card-icon"><Icon size={22} /></div>
              </div>
              <div className="stat-card-value">{c.key === 'todos' ? participa.length : contar(c.key)}</div>
              <div className="stat-card-label">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title"><ClipboardCheck size={16} /> Requisições</div>
        </div>
        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhuma requisição neste filtro.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Solicitante</th>
                  <th>Colaborador</th>
                  <th>Abertura</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((s) => {
                  const tomB = TOM_BADGE[tomDe(s)] || TOM_BADGE.pendente;
                  return (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setAberta(s)}>
                      <td style={{ fontWeight: 600 }}>{TIPO_LABEL[s.tipo] || s.tipo}</td>
                      <td>{nomeSolic(s)}</td>
                      <td>{nomeColab(s) || '—'}</td>
                      <td>{s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                      <td><span className={`badge ${tomB.badge}`}>{tomB.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {aberta ? (() => {
        const s = aberta;
        const resumo = resumoAndamento(s, s.etapas);
        const tomB = TOM_BADGE[resumo.tom] || TOM_BADGE.pendente;
        const det = s.tipo === 'desligamento' ? parseDesligamento(s.justificativa) : { data: null, texto: s.justificativa };
        return (
          <div className="modal-overlay" onClick={() => setAberta(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '100%' }}>
              <div className="modal-header">
                <span className="modal-title">{TIPO_LABEL[s.tipo] || s.tipo}</span>
                <button className="modal-close" onClick={() => setAberta(null)} aria-label="Fechar"><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="sol-card-top">
                  <div>
                    <div className="sol-card-colab">{nomeColab(s) || `Solicitado por ${nomeSolic(s)}`}</div>
                    <div className="sol-card-tipo">
                      {TIPO_LABEL[s.tipo]}
                      {s.iniciativa && <span className="sol-card-iniciativa"> · {INICIATIVA_LABEL[s.iniciativa]}</span>}
                      {nomeColab(s) && <span className="sol-card-iniciativa"> · Solicitado por {nomeSolic(s)}</span>}
                      {s.created_at && <span className="sol-card-iniciativa"> · Aberta em {new Date(s.created_at).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                  <span className={`badge ${tomB.badge}`}>{tomB.label}</span>
                </div>

                <div className="sol-card-info">
                  {s.tipo === 'aumento_salario' && s.salario_proposto != null && (
                    <span>Valor: {formatarMoeda(s.colaborador?.salario)} → <strong style={{ color: 'var(--color-success)' }}>{formatarMoeda(s.salario_proposto)}</strong></span>
                  )}
                  {s.tipo === 'aumento_salario' && s.funcao_proposta && (
                    <span>Função: {s.colaborador?.funcao || '—'} → <strong style={{ color: 'var(--color-success)' }}>{s.funcao_proposta}</strong></span>
                  )}
                  {s.tipo === 'aumento_salario' && s.cargo_proposto && (
                    <span>Cargo: <strong style={{ color: 'var(--color-success)' }}>{s.cargo_proposto}</strong></span>
                  )}
                  {s.tipo === 'desligamento' && det.data && (
                    <span>Desligamento sugerido: <strong style={{ color: 'var(--color-danger)' }}>{det.data}</strong></span>
                  )}
                </div>
                {det.texto && <div className="sol-card-just">{det.texto}</div>}

                <div className={`sol-card-resumo tom-${resumo.tom}`}>{resumo.texto}</div>

                <FluxoTimeline etapas={s.etapas} />

                <div className="sol-card-actions" style={{ marginTop: 'var(--space-md)' }}>
                  <BotaoPdfRequisicao sol={s} nomeColaborador={nomeColab(s)} nomeSolicitante={nomeSolic(s)} />
                  {DETALHE[s.tipo] && (
                    <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                      <FileText size={14} /> Ver respostas
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}

      <ModalRespostas
        respostas={verRespostas}
        sol={solRespostas}
        nomeColaborador={solRespostas ? nomeColab(solRespostas) : undefined}
        nomeSolicitante={solRespostas ? nomeSolic(solRespostas) : undefined}
        onClose={() => { setVerRespostas(null); setSolRespostas(null); }}
      />
    </div>
  );
}
