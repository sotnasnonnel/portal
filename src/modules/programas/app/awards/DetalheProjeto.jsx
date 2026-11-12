import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Download, Loader2, Pencil, Play } from 'lucide-react';
import { AWARDS_CATEGORIA_LABEL, AWARDS_PERGUNTAS } from '../../../../config/programas';
import { urlDaApresentacao, urlParaAssistir } from '../../lib/awards';
import { BotaoExcluir, Casca } from '../components/Detalhe';

/** Popup com as respostas do projeto. Quem cadastrou recebe `podeMexer` durante o prazo. */
export default function DetalheProjeto({ projeto, podeMexer = false, onFechar, onExcluir }) {
  const [baixando, setBaixando] = useState(false);
  const [carregandoVideo, setCarregandoVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  const assistir = async () => {
    setCarregandoVideo(true);
    setErro('');
    try {
      setVideoUrl(await urlParaAssistir(projeto.video));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregandoVideo(false);
    }
  };

  const baixar = async (arquivo) => {
    setBaixando(true);
    setErro('');
    try {
      window.location.href = await urlDaApresentacao(arquivo);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBaixando(false);
    }
  };

  const excluir = async () => {
    setExcluindo(true);
    setErro('');
    try {
      await onExcluir(projeto);
      onFechar();
    } catch (e) {
      setErro(e.message);
      setExcluindo(false);
    }
  };

  const enviadoEm = new Date(projeto.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Casca
      titulo={`#${projeto.numero} · ${projeto.codigo_setor}`}
      onFechar={onFechar}
      etiquetas={<span className="pg-badge tom-destaque">{AWARDS_CATEGORIA_LABEL[projeto.categoria]}</span>}
      acoes={(
        <>
          {podeMexer && (
            <>
              <BotaoExcluir rotulo="Excluir este projeto?" excluindo={excluindo} onExcluir={excluir} />
              <span className="pg-modal-pe-espaco" />
              <Link className="pg-btn pg-btn-ghost" to={`/programas/awards/${projeto.id}/editar`}>
                <Pencil size={15} /> Editar
              </Link>
            </>
          )}
          <button type="button" className="pg-btn pg-btn-primary" onClick={onFechar}>Fechar</button>
        </>
      )}
    >
      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      <dl className="pg-det-campos">
        <div><dt>Cadastrado por</dt><dd>{projeto.autorNome || '—'}</dd></div>
        <div><dt>Enviado em</dt><dd>{enviadoEm}</dd></div>
      </dl>

      {AWARDS_PERGUNTAS.map(({ campo, label }, i) => (
        <section className="pg-det-bloco" key={campo}>
          <h3>{i + 1}. {label}</h3>
          <p className="pg-det-texto">{projeto[campo]}</p>
        </section>
      ))}

      <section className="pg-det-bloco">
        <h3>9. Vídeo do Projeto</h3>
        {!projeto.video ? (
          <p className="pg-det-texto">Nenhum vídeo enviado.</p>
        ) : videoUrl ? (
          <video className="pg-aw-video" src={videoUrl} controls autoPlay playsInline />
        ) : (
          <div className="pg-acoes" style={{ marginTop: 0 }}>
            <button type="button" className="pg-btn pg-btn-primary pg-btn-sm" onClick={assistir} disabled={carregandoVideo}>
              {carregandoVideo ? <Loader2 size={15} className="pg-spin" /> : <Play size={15} />} Assistir
            </button>
            <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={() => baixar(projeto.video)} disabled={baixando}>
              <Download size={15} /> Baixar
            </button>
          </div>
        )}
      </section>

      <section className="pg-det-bloco">
        <h3>10. Apresentação do Projeto</h3>
        {projeto.apresentacao ? (
          <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={() => baixar(projeto.apresentacao)} disabled={baixando}>
            {baixando ? <Loader2 size={15} className="pg-spin" /> : <Download size={15} />}
            {' '}{projeto.apresentacao.nome}
          </button>
        ) : <p className="pg-det-texto">Nenhum arquivo enviado.</p>}
      </section>
    </Casca>
  );
}
