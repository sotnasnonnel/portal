import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { TERMOS_FEED } from '../../config/feed';

// Regras de convivência do feed (config/feed.js, TERMOS_FEED). Mesma mecânica
// do TermosAceite do Financeiro, com o visual do feed.
//
// `obrigatorio` (nunca aceitou, ou aceitou uma versão antiga): o termo cobre a
// página, sem X nem clique fora, e a saída é voltar ao portal. Sem ele, é só
// leitura, aberta pelo botão do cabeçalho, e mostra quando `aceite` foi dado.
export default function TermosFeed({ obrigatorio = false, aceite, onAceitar, onFechar }) {
  const leitura = !obrigatorio;
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!leitura) return undefined;
    const tecla = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [leitura, onFechar]);

  const confirmar = async () => {
    setEnviando(true);
    setErro('');
    try {
      await onAceitar();
    } catch (e) {
      setErro(e.message);
      setEnviando(false);
    }
  };

  return (
    <div className="feed-modal-fundo"
      onMouseDown={(e) => { if (leitura && e.target === e.currentTarget) onFechar(); }}>
      <div className="feed-modal feed-termos" role="dialog" aria-modal="true" aria-labelledby="feed-termos-tit">
        <div className="feed-modal-cab">
          <h2 id="feed-termos-tit" className="feed-termos-tit">{TERMOS_FEED.titulo}</h2>
          {leitura && (
            <button type="button" className="feed-iconbtn" aria-label="Fechar" onClick={onFechar}><X size={20} /></button>
          )}
        </div>

        <div className="feed-modal-corpo">
          <p className="feed-termos-intro">{TERMOS_FEED.intro}</p>
          <ul className="feed-termos-lista">
            {TERMOS_FEED.itens.map(([titulo, texto, destaque]) => (
              <li key={titulo} className={destaque ? 'is-destaque' : ''}>
                {destaque && <AlertTriangle size={14} aria-hidden="true" />}
                <span><strong>{titulo}:</strong> {texto}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Fora da área que rola: o aceite fica sempre à vista, junto do botão. */}
        <div className="feed-termos-aceite">
          {leitura ? aceite?.em && (
            <p className="feed-termos-ok">
              <ShieldCheck size={16} /> Você aceitou estas regras em {new Date(aceite.em).toLocaleString('pt-BR')}.
            </p>
          ) : (
            <label className={`feed-termos-check ${marcado ? 'is-marcado' : ''}`}>
              <input type="checkbox" checked={marcado} disabled={enviando} onChange={(e) => setMarcado(e.target.checked)} />
              <span>Li e estou de acordo com as regras de convivência do Feed PHD.</span>
            </label>
          )}
          {erro && <p className="feed-termos-erro" role="alert">{erro}</p>}
        </div>

        <div className={`feed-modal-rodape ${leitura ? 'is-leitura' : ''}`}>
          {leitura ? (
            <button type="button" className="feed-btn-publicar" onClick={onFechar}>Fechar</button>
          ) : (
            <>
              <Link to="/home" className="feed-termos-sair">Voltar ao portal</Link>
              <button type="button" className="feed-btn-publicar" disabled={!marcado || enviando} onClick={confirmar}
                aria-busy={enviando} title={marcado ? undefined : 'Marque o "Li e estou de acordo" para continuar'}>
                {enviando
                  ? <><Loader2 size={16} className="feed-spin" /> Salvando…</>
                  : <><Check size={16} /> Aceitar e entrar no feed</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
