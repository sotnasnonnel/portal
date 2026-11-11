import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

// Avisos da Gestão de Horas num formato só: ícone + texto, com o tom dizendo o
// que é (antes cada tela usava um emoji diferente e o erro tinha a mesma cara
// da explicação).
//  - info:  explicação de como a tela funciona
//  - aviso: algo impede ou limita a ação, mas não é falha
//  - erro:  a ação falhou (anunciado ao leitor de tela na hora)
//  - ok:    confirmação
const ICONES = { info: Info, aviso: AlertTriangle, erro: XCircle, ok: CheckCircle2 };
const PAPEL = { erro: 'alert', ok: 'status' };

export default function Aviso({ tom = 'info', children, className = '', style }) {
  const Icone = ICONES[tom] || Info;
  return (
    <div
      className={`horas-hint has-ico is-${tom}${className ? ` ${className}` : ''}`}
      role={PAPEL[tom]}
      style={style}
    >
      <Icone size={16} className="horas-hint-ico" aria-hidden="true" />
      <div className="horas-hint-txt">{children}</div>
    </div>
  );
}

// Estado de carregamento, anunciado ao leitor de tela.
export function Carregando({ texto = 'Carregando…' }) {
  return (
    <div className="horas-loading" role="status" aria-live="polite">
      <Loader2 size={18} className="horas-spin" aria-hidden="true" />
      {texto}
    </div>
  );
}

// Confirmação flutuante que some sozinha (ex.: "Apontamento salvo.").
// O onFim fica num ref: a tela do cronômetro re-renderiza a cada segundo, e um
// callback novo a cada render reiniciaria o prazo para sempre.
export function AvisoTemporario({ msg, onFim, ms = 4000 }) {
  const fimRef = useRef(onFim);
  useEffect(() => {
    fimRef.current = onFim;
  }, [onFim]);
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => fimRef.current?.(), ms);
    return () => clearTimeout(t);
  }, [msg, ms]);
  if (!msg) return null;
  return (
    <div className="horas-toast" role="status" aria-live="polite">
      <CheckCircle2 size={16} aria-hidden="true" />
      {msg}
    </div>
  );
}
