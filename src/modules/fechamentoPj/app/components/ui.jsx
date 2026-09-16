import { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { competenciaRotulo } from '../../lib/formato';

// Peças de tela do Fechamento PJ, sobre o design system da Gestão de Pessoas
// (components/UI/Components.css: .modal-*, .btn, .badge, .data-table...).

export function Modal({ titulo, subtitulo, onFechar, children, rodape, largura = 'md', bloqueado = false }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape' && !bloqueado) onFechar?.(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar, bloqueado]);
  return (
    <div className="modal-overlay" onClick={() => !bloqueado && onFechar?.()}>
      <div className={`modal pj-modal pj-modal--${largura}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <span className="modal-title">{titulo}</span>
            {subtitulo && <div className="pj-modal-sub">{subtitulo}</div>}
          </div>
          <button type="button" className="modal-close" onClick={onFechar} disabled={bloqueado} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {rodape && <div className="modal-footer">{rodape}</div>}
      </div>
    </div>
  );
}

const ICONES_AVISO = { erro: AlertTriangle, alerta: AlertTriangle, sucesso: CheckCircle2, info: Info };

export function Aviso({ tipo = 'info', children, acao }) {
  const Icone = ICONES_AVISO[tipo] || Info;
  return (
    <div className={`pj-aviso pj-aviso--${tipo}`}>
      <Icone size={16} />
      <div className="pj-aviso-texto">{children}</div>
      {acao}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }) {
  return <div className="pj-carregando"><Loader2 size={18} className="pj-girando" /> {texto}</div>;
}

export function Vazio({ children }) {
  return <div className="table-empty pj-vazio">{children}</div>;
}

export function Toast({ mensagem, tipo, onFim }) {
  useEffect(() => {
    const t = setTimeout(onFim, 3200);
    return () => clearTimeout(t);
  }, [onFim]);
  return <div className={`pj-toast pj-toast--${tipo}`} role="status">{mensagem}</div>;
}

export function Abas({ abas, ativa, onTrocar }) {
  return (
    <div className="pj-abas" role="tablist">
      {abas.map((a) => (
        <button key={a.id} type="button" role="tab" aria-selected={ativa === a.id}
          className={`pj-aba ${ativa === a.id ? 'ativa' : ''}`} onClick={() => onTrocar(a.id)}>
          {a.rotulo}
          {a.contador ? <span className="pj-aba-contador">{a.contador}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Campo({ rotulo, obrigatorio, dica, erro, children, largura }) {
  return (
    <label className={`form-group pj-campo ${largura ? `pj-campo--${largura}` : ''}`}>
      <span className="form-label">{rotulo}{obrigatorio && <span className="pj-obrig"> *</span>}</span>
      {children}
      {dica && !erro && <span className="form-hint">{dica}</span>}
      {erro && <span className="form-error">{erro}</span>}
    </label>
  );
}

export function StatCard({ rotulo, valor, icone, tom = 'primary', ativo, onClick, detalhe }) {
  return (
    <div className={`stat-card ${tom} ${ativo ? 'is-active' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}
      style={onClick ? undefined : { cursor: 'default' }}>
      <div className="stat-card-header"><div className="stat-card-icon">{icone}</div></div>
      <div className={`stat-card-value ${String(valor ?? '').length > 6 ? 'stat-card-value--longo' : ''}`} title={String(valor ?? '')}>{valor}</div>
      <div className="stat-card-label">{rotulo}{detalhe && <span className="pj-stat-detalhe"> · {detalhe}</span>}</div>
    </div>
  );
}

// Status → badge. Uma tabela só para o módulo inteiro.
const BADGES = {
  conferencia: { ok: ['aprovada', 'Sem divergência'], divergente: ['reprovada', 'Divergência'] },
  termo: { disponivel: ['pendente', 'Disponível'], gerado: ['aprovada', 'Gerado'], bloqueado: ['reprovada', 'Bloqueado'] },
  envio: { nao_enviado: ['pj-neutro', 'Não enviado'], preparado: ['pendente', 'Preparado'], enviado: ['aprovada', 'Enviado'] },
  competencia: { aberta: ['pendente', 'Em conferência'], fechada: ['aprovada', 'Fechada'] },
  situacao: { ativo: ['ativo', 'Ativo'], desligado: ['inativo', 'Desligado'] },
  fornecedor: { PRONTO: ['aprovada', 'Pronto'], 'CADASTRO RM': ['pendente', 'Cadastro RM'], PENDENTE: ['reprovada', 'Pendente'] },
  encerramento: { programado: ['pendente', 'Programado'], encerrado: ['inativo', 'Encerrado'], cancelado: ['pj-neutro', 'Cancelado'] },
};

export function Badge({ tipo, valor }) {
  const [classe, rotulo] = BADGES[tipo]?.[valor] || ['pj-neutro', valor || '—'];
  return <span className={`badge ${classe}`}>{rotulo}</span>;
}

// Seletor da competência em exibição (usado no topo das telas mensais).
export function SeletorCompetencia({ competencias, valor, onTrocar }) {
  return (
    <label className="pj-seletor-comp">
      <span>Competência</span>
      <select className="form-select" value={valor || ''} onChange={(e) => onTrocar(e.target.value)}>
        {competencias.map((c) => (
          <option key={c.competencia} value={c.competencia}>
            {competenciaRotulo(c.competencia)} · {c.status === 'aberta' ? 'em conferência' : 'fechada'}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Cabecalho({ titulo, subtitulo, children }) {
  return (
    <div className="pj-cabecalho">
      <div>
        <h1 className="page-title">{titulo}</h1>
        {subtitulo && <p className="page-subtitle">{subtitulo}</p>}
      </div>
      {children && <div className="pj-cabecalho-acoes">{children}</div>}
    </div>
  );
}

export function Moeda({ valor, forte }) {
  const texto = (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return <span className={`pj-num ${forte ? 'pj-num--forte' : ''}`}>{texto}</span>;
}
