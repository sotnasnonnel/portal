import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, SendHorizontal, X } from 'lucide-react';
import { usePontos } from '../../contexts/PontosContext';
import { FOTOS_MAX, mencoesNoTexto, TEXTO_MAX, validarPost } from '../../config/feed';
import * as api from '../../services/feed';
import { nomeProprio } from '../../utils/pessoas';
import { AvatarFeed } from './Autor';
import EmojiPicker from './EmojiPicker';
import CampoMencoes from './CampoMencoes';

// Publicar, no molde do selink (selink-web/src/components/feed/FeedComposer e
// FeedComposerModal), que segue o LinkedIn: no topo do feed só a chamada; o
// post é escrito num modal, sem a linha do tempo competindo logo abaixo.

function MeuAvatar({ user, grande = false }) {
  const { perfil } = usePontos();
  return <AvatarFeed id={user?.id} nome={user?.nome} moldura={perfil?.moldura} className={grande ? 'is-grande' : ''} />;
}

function ModalPublicar({ user, fotosIniciais = false, onFechar, onPublicado, onErro }) {
  const { recarregar } = usePontos();
  const [texto, setTexto] = useState('');
  const [mencoes, setMencoes] = useState([]); // [{ id, nome }] escolhidas no "@"
  const [fotos, setFotos] = useState([]); // [{ file, url }]
  const [enviando, setEnviando] = useState(false);
  const textoRef = useRef(null);
  const inputRef = useRef(null);
  const fotosRef = useRef(fotos);
  useEffect(() => { fotosRef.current = fotos; }, [fotos]);

  // Prévias locais soltas ao fechar; foco no texto ao abrir (ou no seletor,
  // se a pessoa veio pelo ícone de foto).
  useEffect(() => {
    if (fotosIniciais) inputRef.current?.click();
    else textoRef.current?.focus();
    return () => fotosRef.current.forEach((f) => URL.revokeObjectURL(f.url));
  }, [fotosIniciais]);

  const temConteudo = texto.trim() !== '' || fotos.length > 0;
  const fechar = () => {
    if (enviando) return;
    if (temConteudo && !window.confirm('Descartar esta publicação?')) return;
    onFechar();
  };

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  });

  const escolher = (e) => {
    const novos = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    const cabem = FOTOS_MAX - fotos.length;
    if (novos.length > cabem) onErro(`No máximo ${FOTOS_MAX} fotos por post.`);
    setFotos((v) => [...v, ...novos.slice(0, cabem).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const tirar = (i) => {
    URL.revokeObjectURL(fotos[i].url);
    setFotos((v) => v.filter((_, j) => j !== i));
  };

  const publicar = async () => {
    const erros = validarPost({ texto, fotos: fotos.map((f) => f.file) });
    if (erros.length) { onErro(erros[0]); return; }
    setEnviando(true);
    let midia = [];
    try {
      midia = await api.subirFotos(user.id, fotos.map((f) => f.file));
      await api.postar(texto, midia, mencoesNoTexto(texto, mencoes));
      recarregar(); // o primeiro post do dia paga 25 (o "+25" voa até o saldo)
      onPublicado();
      onFechar();
    } catch (e) {
      await api.apagarFotos(api.arquivosDaMidia(midia));
      onErro(e.message);
      setEnviando(false);
    }
  };

  // Emoji entra onde está o cursor (ou no fim), e o cursor vai para depois dele.
  const inserirEmoji = (emoji) => {
    const el = textoRef.current;
    const ini = el?.selectionStart ?? texto.length;
    const fim = el?.selectionEnd ?? texto.length;
    const novo = texto.slice(0, ini) + emoji + texto.slice(fim);
    if (novo.length > TEXTO_MAX) return;
    setTexto(novo);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(ini + emoji.length, ini + emoji.length);
    });
  };

  const restantes = TEXTO_MAX - texto.length;

  return (
    <div className="feed-modal-fundo"
      // Clique fora só fecha com o modal vazio: num clique perdido, um texto
      // longo iria embora (mesma regra do selink).
      onMouseDown={(e) => { if (e.target === e.currentTarget && !temConteudo && !enviando) onFechar(); }}>
      <div className="feed-modal" role="dialog" aria-modal="true" aria-labelledby="feed-modal-tit">
        <h2 id="feed-modal-tit" className="feed-sr">Criar publicação</h2>
        <div className="feed-modal-cab">
          <MeuAvatar user={user} grande />
          <div className="feed-modal-quem">
            <b>{nomeProprio(user?.nome || '')}</b>
            <span>Publicar no feed da PHD</span>
          </div>
          <button type="button" className="feed-iconbtn" aria-label="Fechar" onClick={fechar}><X size={20} /></button>
        </div>

        <div className="feed-modal-corpo">
          <CampoMencoes inputRef={textoRef} value={texto} onChange={setTexto} mencoes={mencoes} onMencoes={setMencoes}
            rows={7} maxLength={TEXTO_MAX} disabled={enviando}
            placeholder="Sobre o que você quer falar? Use @ para marcar alguém." aria-label="Texto da publicação" />
          {fotos.length > 0 && (
            <div className="feed-composer-fotos">
              {fotos.map((f, i) => (
                <span key={f.url} className="feed-composer-foto">
                  <img src={f.url} alt="" />
                  {!enviando && <button type="button" aria-label="Tirar foto" onClick={() => tirar(i)}><X size={14} /></button>}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="feed-modal-ferramentas">
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={escolher} />
          <button type="button" className="feed-ferramenta" onClick={() => inputRef.current?.click()}
            disabled={fotos.length >= FOTOS_MAX || enviando} title="Adicionar fotos">
            <ImagePlus size={20} /> Foto{fotos.length ? ` (${fotos.length}/${FOTOS_MAX})` : ''}
          </button>
          <EmojiPicker onEscolher={inserirEmoji} desabilitado={enviando} />
        </div>

        <div className="feed-modal-rodape">
          <span className={`feed-contador ${restantes < 0 ? 'is-estouro' : ''}`} aria-live="polite">
            {restantes <= 300 ? `${restantes} restantes` : ''}
          </span>
          <button type="button" className="feed-btn-publicar" onClick={publicar} disabled={enviando || !temConteudo}
            aria-busy={enviando}>
            {enviando
              ? <><Loader2 size={16} className="feed-spin" /> Publicando…</>
              : <><SendHorizontal size={16} /> Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A chamada no topo do feed: avatar, "Sobre o que você quer falar?" e foto. */
export default function Composer({ user, onPublicado, onErro }) {
  const [aberto, setAberto] = useState(null); // null | 'texto' | 'foto'
  return (
    <>
      <section className="feed-chamada">
        <MeuAvatar user={user} />
        <button type="button" className="feed-chamada-pilula" onClick={() => setAberto('texto')}>
          Sobre o que você quer falar?
        </button>
        <button type="button" className="feed-iconbtn is-foto" aria-label="Criar publicação com foto" title="Foto"
          onClick={() => setAberto('foto')}>
          <ImagePlus size={20} />
        </button>
      </section>
      {aberto && (
        <ModalPublicar user={user} fotosIniciais={aberto === 'foto'} onFechar={() => setAberto(null)}
          onPublicado={onPublicado} onErro={onErro} />
      )}
    </>
  );
}
