import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTi } from './TiContext';

// Peças de tela da TI, no mesmo desenho das da Frota.

export function PageHead({
  Icon, titulo, sub, children,
}) {
  return (
    <header className="ti-ph">
      <div>
        <h1 className="ti-title">{Icon && <Icon size={24} aria-hidden="true" />} {titulo}</h1>
        {sub && <p className="ti-sub">{sub}</p>}
      </div>
      {children && <div className="ti-ph-a">{children}</div>}
    </header>
  );
}

/** Erro de carga e aviso de quem entra sem acesso (a RLS devolve vazio). */
export function Estado() {
  const { erro, podeEscrever } = useTi();
  if (erro) {
    return (
      <div className="ti-note crit" role="alert">
        <span>Não foi possível carregar os ativos. {erro}</span>
      </div>
    );
  }
  if (!podeEscrever) {
    return (
      <div className="ti-note">
        <span>Consulta: você vê os equipamentos que estão com você e com a sua equipe. Movimentações são feitas pelo time de TI; o termo de responsabilidade, cada um aceita o seu.</span>
      </div>
    );
  }
  return null;
}

export function Esqueleto({ linhas = 6 }) {
  return (
    <div className="ti-card ti-stack" aria-busy="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="ti-skel" style={{ width: `${90 - i * 7}%` }} />
      ))}
    </div>
  );
}

export function Kpi({
  label, valor, sub, tone = '', onClick, destaque = false,
}) {
  const conteudo = (
    <>
      <span className="ti-kpi-l">{label}</span>
      <span className={`ti-kpi-n ${tone}`}>{valor}</span>
      {sub && <span className="ti-kpi-s">{sub}</span>}
    </>
  );
  const classe = `ti-kpi ${destaque ? 'hl' : ''}`;
  if (onClick) return <button type="button" className={classe} onClick={onClick}>{conteudo}</button>;
  return <div className={classe}>{conteudo}</div>;
}

export function Pill({ children, tone = 'neutral' }) {
  return <span className={`ti-pill ${tone}`}>{children}</span>;
}

export function Busca({
  id, valor, onChange, placeholder,
}) {
  return (
    <div className="ti-fld wide">
      <label htmlFor={id}>Buscar</label>
      <div className="ti-search">
        <Search size={15} aria-hidden="true" />
        <input id={id} className="ti-inp" value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
      </div>
    </div>
  );
}

export function Selecao({
  id, label, opcoes, valor, onChange, todos = 'Todos',
}) {
  return (
    <div className="ti-fld">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="ti-inp" value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">{todos}</option>
        {opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function Chip({
  ativo, onClick, children, contagem,
}) {
  return (
    <button type="button" className={`ti-chip ${ativo ? 'on' : ''}`} onClick={onClick} aria-pressed={ativo}>
      {children}
      {contagem != null && <span className="c">{contagem}</span>}
    </button>
  );
}

export function Hbars({ itens, fmt = (v) => v }) {
  if (!itens.length) return <div className="ti-empty">Sem dados.</div>;
  const max = Math.max(...itens.map((i) => i.v), 1);
  return (
    <div className="ti-hbars">
      {itens.map((i) => (
        <div key={i.l} className="ti-hb" title={`${i.l}: ${fmt(i.v)}`}>
          <span className="l">{i.l}</span>
          <span className="tr"><span className="fi" style={{ width: `${Math.max(0.6, (i.v / max) * 100).toFixed(2)}%` }} /></span>
          <span className="v">{fmt(i.v)}</span>
        </div>
      ))}
    </div>
  );
}

export function LinhaVazia({ colunas, titulo, sub }) {
  return (
    <tr>
      <td colSpan={colunas}>
        <div className="ti-empty"><strong>{titulo}</strong>{sub}</div>
      </td>
    </tr>
  );
}

export function Secao({
  titulo, contagem, nota, className = '', children,
}) {
  return (
    <section className={`ti-card ${className}`.trim()}>
      <div className="ti-card-h">
        <h2>{titulo}</h2>
        {contagem != null && <span className="ti-count">{contagem}</span>}
        {nota && <span className="ti-card-nota">{nota}</span>}
      </div>
      {children}
    </section>
  );
}

const OUTRO = '__outro__';

/**
 * Lista suspensa para campo com valores conhecidos. `opcoes`: strings ou
 * {v, l}. Com `livre`, a última opção é "Outro…", que abre um campo de texto
 * para o valor que ainda não está na lista. Valor salvo fora da lista (dado
 * antigo da planilha) também cai no modo texto, para não sumir da tela.
 */
export function ListaSuspensa({
  id, valor, onChange, opcoes, vazio = '—', livre = true, placeholderOutro = 'Digite o valor',
}) {
  const lista = opcoes.map((o) => (typeof o === 'string' ? { v: o, l: o } : o));
  const naLista = lista.some((o) => o.v === valor);
  const [digitando, setDigitando] = useState(livre && !!valor && !naLista);

  if (digitando) {
    return (
      <div className="ti-outro">
        <input id={id} className="ti-inp" value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholderOutro} autoComplete="off" autoFocus />
        <button type="button" className="ti-btn" onClick={() => { setDigitando(false); onChange(''); }}>Voltar à lista</button>
      </div>
    );
  }
  return (
    <select
      id={id}
      className="ti-inp"
      value={naLista ? valor : ''}
      onChange={(e) => {
        if (e.target.value === OUTRO) { setDigitando(true); onChange(''); return; }
        onChange(e.target.value);
      }}
    >
      <option value="">{vazio}</option>
      {lista.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      {livre && <option value={OUTRO}>Outro…</option>}
    </select>
  );
}
