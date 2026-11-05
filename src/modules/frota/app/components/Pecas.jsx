import { Search } from 'lucide-react';
import { comps, compLabel } from '../../lib/regras';
import { money0 } from '../../lib/formato';
import { useFrota } from './FrotaContext';

// Peças de tela da Frota: as mesmas do protótipo, em React.

export function PageHead({ Icon, titulo, sub, children }) {
  return (
    <header className="frota-ph">
      <div>
        <h1 className="frota-title">{Icon && <Icon size={24} aria-hidden="true" />} {titulo}</h1>
        {sub && <p className="frota-sub">{sub}</p>}
      </div>
      {children && <div className="frota-ph-a">{children}</div>}
    </header>
  );
}

/** Erro de carga e aviso de quem entra sem ser do time (a RLS devolve vazio). */
export function Estado() {
  const { erro, podeEscrever } = useFrota();
  if (erro) {
    return (
      <div className="frota-note crit" role="alert">
        <span>Não foi possível carregar a frota. {erro}</span>
      </div>
    );
  }
  if (!podeEscrever) {
    return (
      <div className="frota-note warn">
        <span>Seu usuário não faz parte do time do Atendimento, então a base aparece vazia e nada pode ser alterado. Peça o acesso em Gerenciar acessos.</span>
      </div>
    );
  }
  return null;
}

export function Esqueleto({ linhas = 6 }) {
  return (
    <div className="frota-card frota-stack" aria-busy="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="frota-skel" style={{ width: `${90 - i * 7}%` }} />
      ))}
    </div>
  );
}

export function Kpi({ label, valor, sub, tone = '', onClick, destaque = false }) {
  const conteudo = (
    <>
      <span className="frota-kpi-l">{label}</span>
      <span className={`frota-kpi-n ${tone}`}>{valor}</span>
      {sub && <span className="frota-kpi-s">{sub}</span>}
    </>
  );
  const classe = `frota-kpi ${destaque ? 'hl' : ''}`;
  if (onClick) return <button type="button" className={classe} onClick={onClick}>{conteudo}</button>;
  return <div className={classe}>{conteudo}</div>;
}

export function Pill({ children, tone = 'neutral' }) {
  return <span className={`frota-pill ${tone}`}>{children}</span>;
}

export function Placa({ placa }) {
  return placa
    ? <span className="frota-plate">{placa}</span>
    : <span className="frota-plate none">sem placa</span>;
}

export function Busca({ id, valor, onChange, placeholder }) {
  return (
    <div className="frota-fld wide">
      <label htmlFor={id}>Buscar</label>
      <div className="frota-search">
        <Search size={15} aria-hidden="true" />
        <input id={id} className="frota-inp" value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
      </div>
    </div>
  );
}

export function Selecao({ id, label, opcoes, valor, onChange, todos = 'Todos' }) {
  return (
    <div className="frota-fld">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="frota-inp" value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">{todos}</option>
        {opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function Chip({ ativo, onClick, children, contagem }) {
  return (
    <button type="button" className={`frota-chip ${ativo ? 'on' : ''}`} onClick={onClick} aria-pressed={ativo}>
      {children}
      {contagem != null && <span className="c">{contagem}</span>}
    </button>
  );
}

export function SeletorComp({ valor, onChange }) {
  const { dados } = useFrota();
  const lista = comps(dados.mensal).slice().reverse();
  if (!lista.length) return null;
  return (
    <select className="frota-inp frota-comp" value={valor} onChange={(e) => onChange(e.target.value)} aria-label="Competência">
      {lista.map((c) => <option key={c} value={c}>{compLabel(c)}</option>)}
    </select>
  );
}

export function Hbars({ itens, fmt = money0 }) {
  if (!itens.length) return <div className="frota-empty">Sem dados para o período.</div>;
  const max = Math.max(...itens.map((i) => i.v), 1);
  return (
    <div className="frota-hbars">
      {itens.map((i) => (
        <div key={i.l} className="frota-hb" title={`${i.l}\n${fmt(i.v)}${i.t ? `\n${i.t}` : ''}`}>
          <span className="l">{i.l}</span>
          <span className="tr"><span className="fi" style={{ width: `${Math.max(0.6, (i.v / max) * 100).toFixed(2)}%` }} /></span>
          <span className="v">{fmt(i.v)}</span>
        </div>
      ))}
    </div>
  );
}

export function Medidor({ pct, tone = '', largura = 70 }) {
  return (
    <span className={`frota-meter ${tone}`} style={{ width: largura }}>
      <i style={{ width: `${Math.min(100, (pct || 0) * 100).toFixed(0)}%` }} />
    </span>
  );
}

export function LinhaVazia({ colunas, titulo, sub }) {
  return (
    <tr>
      <td colSpan={colunas}>
        <div className="frota-empty"><strong>{titulo}</strong>{sub}</div>
      </td>
    </tr>
  );
}

export function Secao({ titulo, contagem, nota, children }) {
  return (
    <section className="frota-card">
      <div className="frota-card-h">
        <h2>{titulo}</h2>
        {contagem != null && <span className="frota-count">{contagem}</span>}
        {nota && <span className="frota-card-nota">{nota}</span>}
      </div>
      {children}
    </section>
  );
}

export function LinhaAuditoria({ doc }) {
  if (!doc?.atualizado_em) return null;
  const quando = new Date(doc.atualizado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <p className="frota-hint">
      Última alteração em {quando}{doc.atualizado_por_nome ? ` por ${doc.atualizado_por_nome}` : ''}.
    </p>
  );
}
