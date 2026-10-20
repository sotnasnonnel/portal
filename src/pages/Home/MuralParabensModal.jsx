import { useCallback, useEffect, useState } from 'react';
import { Cake, X, Send, Loader2, Trash2, Pencil, Heart, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePontos } from '../../contexts/PontosContext';
import {
  muralDe, enviarParabens, excluirParabens, curtirParabens, responderParabens,
  visuais as visuaisPontos,
} from '../../services/pontos';
import { notificarParabens } from '../../services/notificarParabens';
import { carregarFotosMural, fotosMuralCobrem, fotosMuralEmCache } from './fotosMural';
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
 * Mural de parabéns de quem está em cartaz. Cada colega deixa UM recado; o
 * aniversariante vê todos.
 *
 * Depois de enviar, o formulário sai de cena: fica o recado no mural, com
 * "Editar" e "Excluir" (pedido do usuário, 19/10/2026 — o campo de texto aberto
 * com o recado dentro fazia parecer que ele ainda não tinha sido enviado). O
 * formulário só volta no "Editar".
 *
 * O banco aceita recado no dia do aniversário e, quando ele cai no fim de
 * semana, até a segunda (parabens_enviar / app_private.comemoracao_em_cartaz).
 *
 * Cada recado mostra a foto, o título e os enfeites de quem escreveu, e o
 * recado novo avisa o aniversariante por e-mail (notificarParabens).
 *
 * O ANIVERSARIANTE reage a cada recado: curtir (um coração, que liga e desliga)
 * e responder (um texto embaixo do recado, que ele pode editar ou apagar). Quem
 * escreveu só lê a reação quando volta ao mural — ver
 * supabase/supabase_migration_parabens_curtir_responder.sql.
 *
 * Reusa a casca do SolucoesModal, como os outros popups da Home.
 */
export default function MuralParabensModal({ pessoa, linkTeams, onClose }) {
  const { user, fotoUrl } = useAuth();
  const { perfil, recarregar } = usePontos();
  const [recados, setRecados] = useState(null);
  const [visuais, setVisuais] = useState(() => new Map()); // título de quem escreveu
  // As fotos que a Home já buscou (ver fotosMural.js): o modal nasce com elas.
  const [fotos, setFotos] = useState(() => fotosMuralEmCache(pessoa.colaborador_id)?.fotos || {});
  const [texto, setTexto] = useState('');
  const [icones, setIcones] = useState(['festa', 'bolo']);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [editando, setEditando] = useState(false);   // formulário reaberto
  const [excluindo, setExcluindo] = useState(false); // confirmação aberta
  const [apagando, setApagando] = useState(false);
  const [respondendo, setRespondendo] = useState(null); // id do recado com o campo de resposta aberto
  const [resposta, setResposta] = useState('');
  const [salvandoResp, setSalvandoResp] = useState(false);
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

  // Quem escreveu, em texto, para a foto e o título serem buscados só quando a
  // lista de autores muda: editar ou excluir o próprio recado recarrega o mural
  // e não deve refazer as duas consultas.
  const autores = recados ? [...new Set(recados.map((r) => r.de_id))].sort().join(',') : '';

  // Título da lojinha de quem escreveu, e a foto de quem ainda não veio no
  // que a Home buscou (um recado novo, de alguém que não estava no mural).
  useEffect(() => {
    if (!autores) return undefined;
    let vivo = true;
    const ids = autores.split(',');
    visuaisPontos(ids).then((v) => { if (vivo) setVisuais(v); });
    if (!fotosMuralCobrem(pessoa.colaborador_id, ids)) {
      carregarFotosMural(pessoa.colaborador_id).then(({ fotos: f }) => { if (vivo) setFotos(f); });
    }
    return () => { vivo = false; };
  }, [autores, pessoa.colaborador_id]);

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

  const meuRecado = recados?.find((r) => r.de_id === user?.id) || null;
  const jaMandei = Boolean(meuRecado);
  // Quem ainda não mandou escreve direto; quem já mandou só vê o campo ao
  // editar. Enquanto os recados não chegam não há como saber em qual dos dois
  // casos a pessoa está: o formulário espera, em vez de aparecer e sumir.
  const mostrarForm = !souEu && recados !== null && (!jaMandei || editando);

  const enviar = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setErro('');
    setOk('');
    try {
      await enviarParabens(pessoa.colaborador_id, texto.trim(), icones);
      // Recado novo avisa o aniversariante por e-mail; editar o próprio recado
      // não manda outro aviso.
      if (!jaMandei) notificarParabens(pessoa.colaborador_id);
      setOk(jaMandei ? 'Recado atualizado.' : 'Recado enviado.');
      setEditando(false);
      await carregar();
      recarregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const editar = () => {
    setTexto(meuRecado.texto);
    setIcones(meuRecado.icones || []);
    setErro('');
    setOk('');
    setEditando(true);
  };

  // Cancelar desfaz o que foi digitado: o recado no mural continua o que está lá.
  const cancelarEdicao = () => {
    setTexto(meuRecado?.texto || '');
    setIcones(meuRecado?.icones || []);
    setEditando(false);
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
      setEditando(false);
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

  // Troca um recado da lista no lugar, sem reler o mural: a reação do
  // aniversariante não mexe em mais nada da tela.
  const trocar = (id, campos) =>
    setRecados((lista) => (lista || []).map((r) => (r.id === id ? { ...r, ...campos } : r)));

  // O coração acende na hora; se o banco recusar, ele volta e o erro aparece.
  const curtir = async (r) => {
    const novo = !r.curtido;
    setErro('');
    setOk('');
    trocar(r.id, { curtido: novo });
    try {
      await curtirParabens(r.id, novo);
    } catch (err) {
      trocar(r.id, { curtido: !novo });
      setErro(err.message);
    }
  };

  const abrirResposta = (r) => {
    setErro('');
    setOk('');
    setResposta(r.resposta || '');
    setRespondendo(r.id);
  };

  const fecharResposta = () => {
    setRespondendo(null);
    setResposta('');
  };

  const salvarResposta = async (r) => {
    const texto = resposta.trim();
    if (!texto) return;
    setSalvandoResp(true);
    setErro('');
    setOk('');
    try {
      await responderParabens(r.id, texto);
      trocar(r.id, { resposta: texto });
      setOk('Resposta publicada.');
      fecharResposta();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvandoResp(false);
    }
  };

  // Apagar a resposta é o mesmo RPC com texto vazio. Sem confirmação: o texto
  // continua no campo, que fica aberto para reescrever.
  const apagarResposta = async (r) => {
    setSalvandoResp(true);
    setErro('');
    setOk('');
    try {
      await responderParabens(r.id, '');
      trocar(r.id, { resposta: null });
      setOk('Resposta excluída.');
      fecharResposta();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvandoResp(false);
    }
  };

  // Rodapé dos recados DO MEU mural: curtir, responder e a resposta aberta.
  // Só para o aniversariante — quem escreveu o recado apenas lê a reação.
  const rodapeReacao = (r) => {
    const aberto = respondendo === r.id;
    return (
      <>
        <span className="muralmodal-reacoes">
          <button type="button" className={`muralmodal-curtir ${r.curtido ? 'is-on' : ''}`}
            aria-pressed={Boolean(r.curtido)} onClick={() => curtir(r)}>
            <Heart size={13} fill={r.curtido ? 'currentColor' : 'none'} /> {r.curtido ? 'Curtido' : 'Curtir'}
          </button>
          {!aberto && (
            <button type="button" className="muralmodal-responder" onClick={() => abrirResposta(r)}>
              <MessageCircle size={13} /> {r.resposta ? 'Editar resposta' : 'Responder'}
            </button>
          )}
          {!aberto && r.resposta && (
            <button type="button" className="muralmodal-excluir" onClick={() => apagarResposta(r)} disabled={salvandoResp}>
              <Trash2 size={13} /> Excluir resposta
            </button>
          )}
        </span>
        {aberto && (
          <span className="muralmodal-respform">
            <textarea
              value={resposta}
              maxLength={MAX}
              rows={2}
              autoFocus
              aria-label={`Resposta para ${nomeProprio(r.de_nome).split(' ')[0]}`}
              placeholder={`Responder a ${nomeProprio(r.de_nome).split(' ')[0]}…`}
              onChange={(e) => setResposta(e.target.value)}
            />
            <span className="muralmodal-respacoes">
              <small>{resposta.length}/{MAX}</small>
              <button type="button" className="muralmodal-nao" onClick={fecharResposta} disabled={salvandoResp}>Cancelar</button>
              <button type="button" className="muralmodal-respenviar" onClick={() => salvarResposta(r)}
                disabled={salvandoResp || !resposta.trim()}>
                {salvandoResp ? <Loader2 size={13} className="muralmodal-spin" /> : <Send size={13} />} Responder
              </button>
            </span>
          </span>
        )}
      </>
    );
  };

  // Rodapé do próprio recado: editar e excluir, com a confirmação no lugar dos
  // dois (excluir é a única ação sem volta aqui). Durante a edição o rodapé sai:
  // os botões que valem estão no formulário.
  let rodapeMeu = null;
  if (!editando) {
    rodapeMeu = excluindo ? (
      <span className="muralmodal-confirma">
        Excluir seu recado?
        <button type="button" className="muralmodal-sim" onClick={excluir} disabled={apagando}>
          {apagando ? <Loader2 size={13} className="muralmodal-spin" /> : <Trash2 size={13} />} Excluir
        </button>
        <button type="button" className="muralmodal-nao" onClick={() => setExcluindo(false)} disabled={apagando}>Cancelar</button>
      </span>
    ) : (
      <span className="muralmodal-rodape">
        <button type="button" className="muralmodal-editar" onClick={editar}>
          <Pencil size={13} /> Editar
        </button>
        <button type="button" className="muralmodal-excluir" onClick={() => setExcluindo(true)}>
          <Trash2 size={13} /> Excluir
        </button>
      </span>
    );
  }

  return (
    <div className="solmodal-overlay" onClick={onClose}>
      <div className="solmodal muralmodal" role="dialog" aria-modal="true" aria-labelledby="mural-titulo" onClick={(e) => e.stopPropagation()}>
        <header className="solmodal-head">
          <span className="solmodal-head-icon"><Cake size={20} /></span>
          <div className="solmodal-head-txt">
            <h2 id="mural-titulo">{souEu ? 'Seu mural de parabéns' : `Mural de ${primeiro}`}</h2>
            <p>{souEu ? 'Os recados que os colegas deixaram para você. Curta ou responda cada um.' : `Deixe um recado de aniversário para ${primeiro}.`}</p>
          </div>
          <button type="button" className="solmodal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="solmodal-body muralmodal-body">
          {mostrarForm && (
            <form className="muralmodal-form" onSubmit={enviar}>
              <label htmlFor="mural-texto">{editando ? 'Editando seu recado' : 'Seu recado'}</label>
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
                <small>{texto.length}/{MAX}{!jaMandei && ' · vale 10 pontos e avisa por e-mail'}</small>
                {linkTeams && <a href={linkTeams} target="_blank" rel="noopener noreferrer">Mandar também no Teams</a>}
                {editando && (
                  <button type="button" className="muralmodal-cancelar" onClick={cancelarEdicao} disabled={enviando}>
                    Cancelar
                  </button>
                )}
                <button type="submit" className="muralmodal-enviar" disabled={enviando || !texto.trim()}>
                  {enviando ? <Loader2 size={15} className="muralmodal-spin" /> : <Send size={15} />}
                  {jaMandei ? 'Salvar recado' : 'Enviar recado'}
                </button>
              </div>
            </form>
          )}

          {/* Fora do formulário: o aviso tem de aparecer também quando ele se
              fecha depois do envio. */}
          {erro && <p className="muralmodal-erro" role="alert">{erro}</p>}
          {ok && <p className="muralmodal-ok" role="status">{ok}</p>}

          <div className="muralmodal-lista">
            {recados === null && <p className="muralmodal-vazio"><Loader2 size={16} className="muralmodal-spin" /> Carregando recados…</p>}
            {recados?.length === 0 && (
              <p className="muralmodal-vazio">{souEu ? 'Ainda não chegou nenhum recado. O dia está só começando.' : 'Nenhum recado ainda. Seja o primeiro.'}</p>
            )}
            {recados?.map((r) => {
              const meu = r.de_id === user?.id;
              // O meu visual vem do contexto: muda na hora em que compro algo
              // na lojinha, sem esperar a releitura do mural.
              const v = meu ? perfil : visuais.get(r.de_id);
              return (
                <RecadoMural
                  key={r.id}
                  nome={r.de_nome}
                  texto={r.texto}
                  moldura={meu ? perfil?.moldura : r.moldura}
                  mural={meu ? perfil?.mural : r.mural}
                  titulo={v?.titulo}
                  tituloTexto={v?.titulo_texto}
                  // A minha foto já está em memória (a bolinha do topo); a dos
                  // colegas vem do hub, e pode não ter chegado ainda.
                  foto={(meu && fotoUrl) || fotos[r.de_id] || null}
                  icones={r.icones}
                  meu={meu}
                  // O aniversariante vê o coração no botão, não repetido no
                  // recado; quem escreveu vê "curtiu seu recado".
                  curtido={!souEu && Boolean(r.curtido)}
                  resposta={r.resposta || null}
                  respostaNome={souEu ? 'Você' : primeiro}
                  rodape={souEu ? rodapeReacao(r) : (meu ? rodapeMeu : null)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
