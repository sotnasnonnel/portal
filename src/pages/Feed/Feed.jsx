import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Flag, X, RefreshCw, ScrollText, CircleHelp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTour, usePausaTour } from '../../components/Tour/TourContext';
import { TUTORIAL_FEED } from '../../config/tutoriais';
import {
  cursorDe, ehModeradorFeed, juntarPaginas, POR_PAGINA, precisaAceitarTermos, tempoRelativo, TERMOS_FEED,
} from '../../config/feed';
import * as api from '../../services/feed';
import { nomeProprio } from '../../utils/pessoas';
import PostCard from './PostCard';
import Composer from './Composer';
import { LateralDireita, LateralEsquerda } from './Laterais';
import { FotosFeedProvider } from './FotosFeed';
import TermosFeed from './TermosFeed';
import BoasVindasFeed from './BoasVindasFeed';
import './Feed.css';

/** Fila de denúncias abertas (só moderação). */
function Denuncias({ onErro, onMudou }) {
  const [lista, setLista] = useState(null);
  const carregar = useCallback(async () => {
    try { setLista(await api.listarDenuncias()); } catch (e) { onErro(e.message); setLista([]); }
  }, [onErro]);
  useEffect(() => {
    // O estado só muda depois do await — não há render em cascata.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const decidir = async (d, ocultar) => {
    try {
      if (ocultar) await api.moderar(d.alvo_tipo, d.alvo_id, true, 'Denunciado e revisado pela moderação');
      else await api.descartarDenuncia(d.alvo_tipo, d.alvo_id);
      await carregar();
      onMudou();
    } catch (e) { onErro(e.message); }
  };

  if (lista === null) return <div className="feed-vazio"><Loader2 size={18} className="feed-spin" /></div>;
  if (lista.length === 0) return <div className="feed-vazio">Nenhuma denúncia aberta.</div>;
  return (
    <div className="feed-denuncias">
      {lista.map((d) => (
        <div key={`${d.alvo_tipo}-${d.alvo_id}`} className="feed-denuncia">
          <div className="feed-denuncia-cab">
            <b>{d.alvo_tipo === 'post' ? 'Post' : 'Comentário'} de {nomeProprio(d.autor_nome || '—')}</b>
            <span>{d.denuncias} denúncia{d.denuncias === 1 ? '' : 's'} · {tempoRelativo(d.primeira_em)}</span>
          </div>
          <p className="feed-denuncia-trecho">{d.trecho || '(só fotos)'}</p>
          {d.motivos?.length > 0 && <ul className="feed-denuncia-motivos">{d.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>}
          <div className="feed-denuncia-acoes">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => decidir(d, false)}>Manter</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => decidir(d, true)}>Ocultar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Feed do portal (fase 1): posts com texto e fotos, curtidas e comentários.
// Desenho trazido do feed do selink; regras no banco (supabase_migration_feed.sql).
function PaginaFeed() {
  const { user } = useAuth();
  const moderador = ehModeradorFeed(user);
  const [posts, setPosts] = useState([]);
  const [links, setLinks] = useState({});
  const [cursor, setCursor] = useState(null);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('feed');
  // ?post=<id>: veio do aviso de marcação. Esse post abre no topo, com os
  // comentários abertos, mesmo que já tenha saído da primeira página.
  const [params] = useSearchParams();
  const postAlvo = params.get('post');
  // Regras de convivência: undefined enquanto carrega; sem o aceite da versão
  // atual, o termo cobre a página. Falha ao ler conta como "falta aceitar".
  const [aceite, setAceite] = useState(undefined);
  const [verTermos, setVerTermos] = useState(false);
  const [boasVindas, setBoasVindas] = useState(false);
  const termoPendente = aceite !== undefined && precisaAceitarTermos(aceite);

  // Passo a passo do feed (config/tutoriais.js): ele chega aqui vindo da Home
  // e espera as regras serem aceitas, as boas-vindas fecharem e os posts
  // carregarem — destacar a tela por baixo de um termo obrigatório seria
  // apontar para o que não dá para clicar. Na aba Denúncias os alvos nem
  // existem, então ele espera a volta para o feed.
  const { ativo, iniciar } = useTour();
  usePausaTour(aceite === undefined || termoPendente || verTermos || boasVindas || carregando || aba !== 'feed');

  // Entrou no feed: zera o contador de posts novos do ícone da Home.
  useEffect(() => { api.marcarFeedVisto(); }, []);
  useEffect(() => { api.termosAceitos().then(setAceite, () => setAceite(null)); }, []);

  // Boas-vindas só no primeiro aceite: quem aceita uma versão nova já conhece o feed.
  const aceitarTermos = async () => {
    const primeira = !aceite?.em;
    setAceite(await api.aceitarTermos(TERMOS_FEED.versao));
    if (primeira) setBoasVindas(true);
  };
  const fecharTermos = useCallback(() => setVerTermos(false), []);
  const fecharBoasVindas = useCallback(() => setBoasVindas(false), []);

  const comLinks = useCallback(async (lista) => {
    const paths = lista.flatMap((p) => api.arquivosDaMidia(p.midia || []));
    const novos = await api.linksDasFotos(paths);
    setLinks((v) => ({ ...v, ...novos }));
  }, []);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [lista, alvo] = await Promise.all([
        api.listarFeed(),
        postAlvo ? api.listarFeed({ post: postAlvo, limite: 1 }).catch(() => []) : [],
      ]);
      const topo = alvo.map((p) => ({ ...p, _alvo: true }));
      await comLinks([...topo, ...lista]);
      setPosts(juntarPaginas(topo, lista));
      setCursor(cursorDe(lista));
      setTemMais(lista.length >= POR_PAGINA);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [comLinks, postAlvo]);

  useEffect(() => { carregar(); }, [carregar]);

  const carregarMais = async () => {
    if (!cursor) return;
    setMaisCarregando(true);
    try {
      const lista = await api.listarFeed({ cursor });
      await comLinks(lista);
      setPosts((v) => juntarPaginas(v, lista));
      setCursor(cursorDe(lista) || cursor);
      setTemMais(lista.length >= POR_PAGINA);
    } catch (e) {
      setErro(e.message);
    } finally {
      setMaisCarregando(false);
    }
  };

  const mudou = useCallback((p) => setPosts((v) => v.map((x) => (x.id === p.id ? p : x))), []);
  // Ajuste de um campo sem depender do post atual: mantém estáveis as funções
  // que os comentários recebem (senão eles recarregariam a cada curtida).
  const ajustar = useCallback((id, fn) => setPosts((v) => v.map((x) => (x.id === id ? fn(x) : x))), []);
  const sumiu = useCallback((id) => setPosts((v) => v.filter((x) => x.id !== id)), []);
  const mostrarErro = useCallback((m) => setErro(m), []);

  return (
    <div className="feed-page">
      <div className="feed-grade">
        <LateralEsquerda />
        <div className="feed-centro">
          {/* Volta ao portal numa linha só dela: ao lado do título ficava colada. */}
          <Link to="/home" className="feed-back"><ArrowLeft size={18} /> Portal</Link>
          <header className="feed-header">
            <div className="feed-titulos">
              <h1>Feed PHD</h1>
              <p>O que está rolando nas obras, nos projetos e no escritório.</p>
            </div>
            {/* Os ícones num grupo só: soltos no flex-wrap, no celular o
                Atualizar descia sozinho para outra linha. */}
            <div className="feed-header-acoes">
              {aceite && !termoPendente && (
                <>
                  {/* Rever o passo a passo quando quiser. Começa já no feed: o
                      passo da Home (onde fica o ícone) não serve a quem está aqui. */}
                  <button type="button" className="feed-iconbtn" aria-label="Como usar o feed" title="Como usar o feed"
                    onClick={() => iniciar(TUTORIAL_FEED, { passo: 'feed-post' })}>
                    <CircleHelp size={18} />
                  </button>
                  <button type="button" className="feed-iconbtn" aria-label="Regras do feed" title="Regras do feed"
                    data-tour="feed-regras" onClick={() => setVerTermos(true)}>
                    <ScrollText size={18} />
                  </button>
                </>
              )}
              <button type="button" className="feed-iconbtn" aria-label="Atualizar" title="Atualizar" onClick={carregar}>
                <RefreshCw size={18} />
              </button>
            </div>
          </header>

          {moderador && (
            <div className="feed-abas" role="tablist">
              <button type="button" role="tab" aria-selected={aba === 'feed'} className={aba === 'feed' ? 'is-on' : ''}
                onClick={() => setAba('feed')}>Feed</button>
              <button type="button" role="tab" aria-selected={aba === 'denuncias'} className={aba === 'denuncias' ? 'is-on' : ''}
                onClick={() => setAba('denuncias')}><Flag size={14} /> Denúncias</button>
            </div>
          )}

          {erro && (
            <div className="feed-erro" role="alert">
              <AlertCircle size={16} /> {erro}
              <button type="button" className="feed-iconbtn" aria-label="Fechar aviso" onClick={() => setErro('')}><X size={14} /></button>
            </div>
          )}

          <div className="feed-coluna">
            {aba === 'denuncias' ? (
              <Denuncias onErro={mostrarErro} onMudou={carregar} />
            ) : (
              <>
                <Composer user={user} onPublicado={carregar} onErro={mostrarErro} />
                {carregando ? (
                  <div className="feed-vazio"><Loader2 size={20} className="feed-spin" /> Carregando…</div>
                ) : posts.length === 0 ? (
                  <div className="feed-vazio">Ninguém postou ainda. Que tal ser a primeira pessoa?</div>
                ) : (
                  <>
                    {posts.map((p) => (
                      <PostCard key={p.id} post={p} links={links} eu={user?.id} moderador={moderador}
                        destaque={p._alvo} onMudou={mudou} onAjustar={ajustar} onSumiu={sumiu} onErro={mostrarErro} />
                    ))}
                    {temMais && (
                      <button type="button" className="btn btn-outline feed-mais" onClick={carregarMais} disabled={maisCarregando}>
                        {maisCarregando ? <><Loader2 size={16} className="feed-spin" /> Carregando…</> : 'Carregar mais'}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <LateralDireita />
      </div>
      {termoPendente && <TermosFeed obrigatorio onAceitar={aceitarTermos} />}
      {verTermos && !termoPendente && <TermosFeed aceite={aceite} onFechar={fecharTermos} />}
      {boasVindas && <BoasVindasFeed comTutorial={Boolean(ativo)} onFechar={fecharBoasVindas} />}
    </div>
  );
}

// As fotos de perfil são compartilhadas pela página inteira (posts,
// comentários e laterais), para cada pessoa ser pedida uma vez só.
export default function Feed() {
  return (
    <FotosFeedProvider>
      <PaginaFeed />
    </FotosFeedProvider>
  );
}
