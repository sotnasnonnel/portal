import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Play, SendHorizontal, Video, X } from 'lucide-react';
import { usePontos } from '../../contexts/PontosContext';
import {
  ehVideo, mencoesNoTexto, MIDIAS_MAX, TEXTO_MAX, validarPost, VIDEO_ACCEPT, VIDEOS_MAX,
} from '../../config/feed';
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

function ModalPublicar({ user, abrirCom = null, onFechar, onPublicado, onErro }) {
  const { recarregar } = usePontos();
  const [texto, setTexto] = useState('');
  const [mencoes, setMencoes] = useState([]); // [{ id, nome }] escolhidas no "@"
  const [midias, setMidias] = useState([]); // [{ file, url, video }], na ordem escolhida
  const [enviando, setEnviando] = useState(false);
  const textoRef = useRef(null);
  const fotoRef = useRef(null);
  const videoRef = useRef(null);
  const midiasRef = useRef(midias);
  useEffect(() => { midiasRef.current = midias; }, [midias]);

  const videos = midias.filter((m) => m.video).length;

  // Prévias locais soltas ao fechar; foco no texto ao abrir (ou no seletor,
  // se a pessoa veio pelo ícone de foto ou de vídeo).
  useEffect(() => {
    if (abrirCom === 'foto') fotoRef.current?.click();
    else if (abrirCom === 'video') videoRef.current?.click();
    else textoRef.current?.focus();
    return () => midiasRef.current.forEach((m) => URL.revokeObjectURL(m.url));
  }, [abrirCom]);

  const temConteudo = texto.trim() !== '' || midias.length > 0;
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

  // Um seletor para foto e outro para vídeo, mas uma lista só: a ordem de
  // escolha é a ordem do carrossel. O que não cabe fica de fora, com aviso.
  const escolher = (e) => {
    const escolhidos = [...e.target.files].filter((f) => f.type.startsWith('image/') || ehVideo(f));
    e.target.value = '';
    const aceitos = [];
    let jaVideos = videos;
    for (const file of escolhidos) {
      if (midias.length + aceitos.length >= MIDIAS_MAX) { onErro(`No máximo ${MIDIAS_MAX} arquivos por post.`); break; }
      const video = ehVideo(file);
      if (video && jaVideos >= VIDEOS_MAX) { onErro('Só um vídeo por post.'); continue; }
      if (video) jaVideos += 1;
      aceitos.push({ file, url: URL.createObjectURL(file), video });
    }
    if (aceitos.length) setMidias((v) => [...v, ...aceitos]);
  };

  const tirar = (i) => {
    URL.revokeObjectURL(midias[i].url);
    setMidias((v) => v.filter((_, j) => j !== i));
  };

  const publicar = async () => {
    const erros = validarPost({ texto, midias: midias.map((m) => m.file) });
    if (erros.length) { onErro(erros[0]); return; }
    setEnviando(true);
    let midia = [];
    try {
      midia = await api.subirMidias(user.id, midias.map((m) => m.file));
      await api.postar(texto, midia, mencoesNoTexto(texto, mencoes));
      recarregar(); // o primeiro post do dia paga 25 (o "+25" voa até o saldo)
      onPublicado();
      onFechar();
    } catch (e) {
      await api.apagarMidia(api.arquivosDaMidia(midia));
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

        {/* Os data-tour marcam os passos do passo a passo (config/tutoriais.js). */}
        <div className="feed-modal-corpo" data-tour="post-texto">
          <CampoMencoes inputRef={textoRef} value={texto} onChange={setTexto} mencoes={mencoes} onMencoes={setMencoes}
            rows={7} maxLength={TEXTO_MAX} disabled={enviando}
            placeholder="Sobre o que você quer falar? Use @ para marcar alguém." aria-label="Texto da publicação" />
          {midias.length > 0 && (
            <div className="feed-composer-fotos">
              {midias.map((m, i) => (
                <span key={m.url} className={`feed-composer-foto ${m.video ? 'is-video' : ''}`}>
                  {m.video
                    ? <><video src={m.url} muted playsInline preload="metadata" /><Play size={18} /></>
                    : <img src={m.url} alt="" />}
                  {!enviando && (
                    <button type="button" aria-label={m.video ? 'Tirar vídeo' : 'Tirar foto'} onClick={() => tirar(i)}>
                      <X size={14} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="feed-modal-ferramentas" data-tour="post-ferramentas">
          <input ref={fotoRef} type="file" accept="image/*" multiple hidden onChange={escolher} />
          <input ref={videoRef} type="file" accept={VIDEO_ACCEPT} hidden onChange={escolher} />
          <button type="button" className="feed-ferramenta" onClick={() => fotoRef.current?.click()}
            disabled={midias.length >= MIDIAS_MAX || enviando} title="Adicionar fotos">
            <ImagePlus size={20} /> Foto{midias.length ? ` (${midias.length}/${MIDIAS_MAX})` : ''}
          </button>
          <button type="button" className="feed-ferramenta" onClick={() => videoRef.current?.click()}
            disabled={midias.length >= MIDIAS_MAX || videos >= VIDEOS_MAX || enviando}
            title={videos >= VIDEOS_MAX ? 'Só um vídeo por post' : 'Adicionar vídeo (até 50 MB, 3 min)'}>
            <Video size={20} /> Vídeo
          </button>
          <EmojiPicker onEscolher={inserirEmoji} desabilitado={enviando} />
        </div>

        <div className="feed-modal-rodape">
          <span className={`feed-contador ${restantes < 0 ? 'is-estouro' : ''}`} aria-live="polite">
            {restantes <= 300 ? `${restantes} restantes` : ''}
          </span>
          <button type="button" className="feed-btn-publicar" onClick={publicar} disabled={enviando || !temConteudo}
            aria-busy={enviando} data-tour="post-publicar">
            {enviando
              // Vídeo é arquivo grande e sobe como veio: o aviso explica a espera.
              ? <><Loader2 size={16} className="feed-spin" /> {videos ? 'Enviando o vídeo…' : 'Publicando…'}</>
              : <><SendHorizontal size={16} /> Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A chamada no topo do feed: avatar, "Sobre o que você quer falar?", foto e vídeo. */
export default function Composer({ user, onPublicado, onErro }) {
  const [aberto, setAberto] = useState(null); // null | 'texto' | 'foto' | 'video'
  return (
    <>
      <section className="feed-chamada">
        <MeuAvatar user={user} />
        <button type="button" className="feed-chamada-pilula" data-tour="feed-chamada" onClick={() => setAberto('texto')}>
          Sobre o que você quer falar?
        </button>
        <button type="button" className="feed-iconbtn is-foto" aria-label="Criar publicação com foto" title="Foto"
          onClick={() => setAberto('foto')}>
          <ImagePlus size={20} />
        </button>
        <button type="button" className="feed-iconbtn is-video" aria-label="Criar publicação com vídeo" title="Vídeo"
          onClick={() => setAberto('video')}>
          <Video size={20} />
        </button>
      </section>
      {aberto && (
        <ModalPublicar user={user} abrirCom={aberto === 'texto' ? null : aberto} onFechar={() => setAberto(null)}
          onPublicado={onPublicado} onErro={onErro} />
      )}
    </>
  );
}
