import { useCallback, useEffect, useState } from 'react';
import { Cake, X, Send, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePontos } from '../../contexts/PontosContext';
import { muralDe, enviarParabens, excluirParabens } from '../../services/pontos';
import RecadoMural from '../../components/Pontos/RecadoMural';
import { ICONES_PARABENS, MAX_ICONES } from '../../config/pontos';
import { IMG } from '../../config/pontosImagens';
import { nomeProprio } from '../../utils/pessoas';
import './SolucoesModal.css';
import './MuralParabensModal.css';

const MAX = 500;

// Mensagem pronta: abre o mural com ela no campo, para enviar com um clique
// ou editar antes.
const mensagemPronta = (primeiro) =>
  `Feliz aniversário, ${primeiro}! 🎉 Desejo muita saúde, felicidade e sucesso. Um grande abraço!`;

/**
 * Mural de parabéns de quem faz aniversário hoje. Cada colega deixa UM recado
 * (pode editar ou excluir no dia); o aniversariante vê todos.
 * O banco só aceita recado no dia do aniversário (parabens_enviar).
 *
 * Reusa a casca do SolucoesModal, como os outros popups da Home.
 */
export default function MuralParabensModal({ pessoa, linkTeams, onClose }) {
  const { user } = useAuth();
  const { perfil, recarregar } = usePontos();
  const [recados, setRecados] = useState(null);
  const [texto, setTexto] = useState('');
  const [icones, setIcones] = useState(['festa', 'bolo']);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [excluindo, setExcluindo] = useState(false); // confirmação aberta
  const [apagando, setApagando] = useState(false);
  const souEu = pessoa.colaborador_id === user?.id;
  const primeiro = nomeProprio(pessoa.nome).split(' ')[0];

  const carregar = useCallback(async () => {
    try {
      const lista = await muralDe(pessoa.colaborador_id);
      setRecados(lista);
      const meu = lista.find((r) => r.de_id === user?.id);
      if (meu) {
        setTexto((t) => t || meu.texto);
        setIcones(meu.icones || []);
      } else {
        setTexto((t) => t || mensagemPronta(nomeProprio(pessoa.nome).split(' ')[0]));
      }
    } catch (e) {
      setErro(e.message);
      setRecados([]);
    }
  }, [pessoa.colaborador_id, pessoa.nome, user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowAnterior;
    };
  }, [onClose]);

  const jaMandei = recados?.some((r) => r.de_id === user?.id);

  const enviar = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setErro('');
    setOk('');
    try {
      await enviarParabens(pessoa.colaborador_id, texto.trim(), icones);
      setOk(jaMandei ? 'Recado atualizado.' : 'Recado enviado.');
      await carregar();
      recarregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const excluir = async () => {
    setApagando(true);
    setErro('');
    setOk('');
    try {
      await excluirParabens(pessoa.colaborador_id);
      setTexto(mensagemPronta(primeiro));
      setIcones(['festa', 'bolo']);
      setExcluindo(false);
      setOk('Recado excluído.');
      await carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setApagando(false);
    }
  };

  const alternarIcone = (id) => {
    setIcones((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (atual.length >= MAX_ICONES) return atual;
      return [...atual, id];
    });
  };

  // Excluir pede confirmação no próprio recado: é a única ação sem volta aqui.
  const rodapeMeu = excluindo ? (
    <span className="muralmodal-confirma">
      Excluir seu recado?
      <button type="button" className="muralmodal-sim" onClick={excluir} disabled={apagando}>
        {apagando ? <Loader2 size={13} className="muralmodal-spin" /> : <Trash2 size={13} />} Excluir
      </button>
      <button type="button" className="muralmodal-nao" onClick={() => setExcluindo(false)} disabled={apagando}>Cancelar</button>
    </span>
  ) : (
    <button type="button" className="muralmodal-excluir" onClick={() => setExcluindo(true)}>
      <Trash2 size={13} /> Excluir meu recado
    </button>
  );

  return (
    <div className="solmodal-overlay" onClick={onClose}>
      <div className="solmodal muralmodal" role="dialog" aria-modal="true" aria-labelledby="mural-titulo" onClick={(e) => e.stopPropagation()}>
        <header className="solmodal-head">
          <span className="solmodal-head-icon"><Cake size={20} /></span>
          <div className="solmodal-head-txt">
            <h2 id="mural-titulo">{souEu ? 'Seu mural de parabéns' : `Mural de ${primeiro}`}</h2>
            <p>{souEu ? 'Os recados que os colegas deixaram para você hoje.' : `Deixe um recado de aniversário para ${primeiro}.`}</p>
          </div>
          <button type="button" className="solmodal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="solmodal-body muralmodal-body">
          {!souEu && (
            <form className="muralmodal-form" onSubmit={enviar}>
              <label htmlFor="mural-texto">{jaMandei ? 'Seu recado (dá para editar hoje)' : 'Seu recado'}</label>
              <textarea
                id="mural-texto"
                value={texto}
                maxLength={MAX}
                rows={4}
                placeholder={`Feliz aniversário, ${primeiro}!`}
                onChange={(e) => setTexto(e.target.value)}
              />
              <div className="muralmodal-icones" role="group" aria-label={`Ícones do recado (até ${MAX_ICONES})`}>
                <span>Ícones <small>(até {MAX_ICONES})</small></span>
                {ICONES_PARABENS.map((ic) => {
                  const on = icones.includes(ic.id);
                  return (
                    <button key={ic.id} type="button" className={`muralmodal-icone ${on ? 'is-on' : ''}`}
                      aria-pressed={on} title={ic.nome} onClick={() => alternarIcone(ic.id)}
                      disabled={!on && icones.length >= MAX_ICONES}>
                      <img src={IMG[ic.img]} alt={ic.nome} />
                    </button>
                  );
                })}
              </div>
              <div className="muralmodal-acoes">
                <small>{texto.length}/{MAX}{!jaMandei && ' · vale 10 pontos'}</small>
                {linkTeams && <a href={linkTeams} target="_blank" rel="noopener noreferrer">Mandar também no Teams</a>}
                <button type="submit" className="muralmodal-enviar" disabled={enviando || !texto.trim()}>
                  {enviando ? <Loader2 size={15} className="muralmodal-spin" /> : <Send size={15} />}
                  {jaMandei ? 'Atualizar' : 'Enviar recado'}
                </button>
              </div>
              {erro && <p className="muralmodal-erro" role="alert">{erro}</p>}
              {ok && <p className="muralmodal-ok" role="status">{ok}</p>}
            </form>
          )}

          <div className="muralmodal-lista">
            {recados === null && <p className="muralmodal-vazio"><Loader2 size={16} className="muralmodal-spin" /> Carregando recados…</p>}
            {recados?.length === 0 && (
              <p className="muralmodal-vazio">{souEu ? 'Ainda não chegou nenhum recado. O dia está só começando.' : 'Nenhum recado ainda. Seja o primeiro.'}</p>
            )}
            {recados?.map((r) => (
              <RecadoMural
                key={r.id}
                nome={r.de_nome}
                texto={r.texto}
                moldura={r.de_id === user?.id ? perfil?.moldura : r.moldura}
                mural={r.de_id === user?.id ? perfil?.mural : r.mural}
                icones={r.icones}
                meu={r.de_id === user?.id}
                rodape={r.de_id === user?.id ? rodapeMeu : null}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
