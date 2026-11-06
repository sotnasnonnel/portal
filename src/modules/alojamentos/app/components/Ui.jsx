import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Copy, Loader2, AlertCircle, FileCheck2, LayoutGrid, Paperclip,
} from 'lucide-react';
import {
  CHAVE, PAG_ST, STATUS, celulaAbreLista, compLabel, pagsDe, plural, resumoCelula,
} from '../../lib/regras';

// As peças visuais que as telas do módulo repetem.

export function Pill({
  c = '', semPonto = false, title, children,
}) {
  return <span className={`aloj-pill tom-${c || 'neutro'}${semPonto ? ' sem-ponto' : ''}`} title={title}>{children}</span>;
}

export const PillStatus = ({ a }) => {
  const s = STATUS[a.status] || STATUS.ativo;
  return <Pill c={s.c}>{s.l}</Pill>;
};

export const PillChave = ({ e }) => <Pill c={CHAVE[e.chave]?.c || ''}>{CHAVE[e.chave]?.l || '—'}</Pill>;

export const PillPagamento = ({ p }) => <Pill c={PAG_ST[p.status]?.c || ''}>{PAG_ST[p.status]?.l || p.status}</Pill>;

export const Nil = () => <span className="aloj-nil">—</span>;

export function Barra({ pct, tom = '' }) {
  const largura = Math.max(0, Math.min(100, pct)).toFixed(1);
  return <div className={`aloj-barra ${tom}`}><i style={{ width: `${largura}%` }} /></div>;
}

export function Kpi({
  rotulo, Icon, valor, sub, children,
}) {
  return (
    <div className="aloj-card aloj-kpi">
      <div className="aloj-kpi-l">{Icon && <Icon size={14} />}{rotulo}</div>
      <div className="aloj-kpi-v">{valor}</div>
      {children}
      {sub && <div className="aloj-kpi-s">{sub}</div>}
    </div>
  );
}

export function Vazio({ titulo, texto, children }) {
  return (
    <div className="aloj-vazio">
      <b>{titulo}</b>
      {texto}
      {children && <div className="aloj-vazio-acao">{children}</div>}
    </div>
  );
}

/** Enquanto a base carrega, ou quando ela falhou. Sem nada disso, as crianças. */
export function Carga({ carregando, erro, children }) {
  if (carregando) {
    return <div className="aloj-carga"><Loader2 size={16} className="aloj-spin" /> Carregando a base de alojamentos…</div>;
  }
  return (
    <>
      {erro && <div className="aloj-nota tom-bad"><AlertCircle size={14} /><p>{erro}</p></div>}
      {children}
    </>
  );
}

export function Copiar({ texto }) {
  const [ok, setOk] = useState(false);
  const copiar = async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    try {
      await navigator.clipboard.writeText(texto);
      setOk(true);
      setTimeout(() => setOk(false), 1200);
    } catch {
      setOk(false);
    }
  };
  return (
    <button type="button" className="aloj-copiar" onClick={copiar} title="Copiar" aria-label={`Copiar ${texto}`}>
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

/** Célula dos dois quadros de pagamento (o geral e o da ficha do imóvel). */
export function CelulaPagamento({
  base, aid, conta, comp, esperada, acoes,
}) {
  const ps = pagsDe(base, aid, conta, comp);
  if (!ps.length) {
    return (
      <button
        type="button"
        className={`aloj-cel ${esperada ? 'exp' : 'nada'}`}
        title={esperada ? 'A lançar' : 'Sem lançamento'}
        onClick={() => acoes.novoPagamento({ alojamento_id: aid, conta, competencia: comp })}
      >
        {esperada ? 'a lançar' : '+'}
      </button>
    );
  }
  const { st, principal, sub } = resumoCelula(ps);
  const nf = ps.reduce((s, p) => s + (p.anexos || []).length, 0);
  const lista = celulaAbreLista(conta, ps);
  const mais = ps.length > 1 ? `${sub ? ' · ' : ''}${ps.length} lanç.` : '';
  return (
    <button
      type="button"
      className={`aloj-cel ${st}`}
      title={`${conta} · ${compLabel(comp)}${ps.length > 1 ? ` · ${ps.length} lançamentos` : ''}${nf ? ` · ${plural(nf, 'fatura anexada', 'faturas anexadas')}` : ''}`}
      onClick={() => (lista ? acoes.listarPagamentos(aid, conta, comp) : acoes.editarPagamento(ps[0]))}
    >
      <b>{principal}</b>
      {(sub || mais || nf > 0) && <small>{sub}{mais}{nf > 0 && <> <Paperclip size={10} aria-hidden="true" /></>}</small>}
    </button>
  );
}

/** Controle das duas visões de Pagamentos: o quadro e as faturas do Contas a Pagar. */
export function SubnavPagamentos({ atual }) {
  const itens = [
    { k: 'pagamentos', href: '/alojamentos/pagamentos', rotulo: 'Quadro da competência', Icon: LayoutGrid },
    { k: 'faturas', href: '/alojamentos/pagamentos/faturas', rotulo: 'Faturas · Contas a Pagar', Icon: FileCheck2 },
  ];
  return (
    <nav className="aloj-subnav" aria-label="Pagamentos">
      {itens.map((it) => (
        <Link key={it.k} to={it.href} aria-current={atual === it.k ? 'page' : undefined}><it.Icon size={14} /> {it.rotulo}</Link>
      ))}
    </nav>
  );
}

export function LegendaPagamentos({ children }) {
  return (
    <div className="aloj-legenda">
      <span><i className="pago" />Pago</span>
      <span><i className="pendente" />Pendente</span>
      <span><i className="agendado" />Agendado</span>
      <span>{children}</span>
    </div>
  );
}
