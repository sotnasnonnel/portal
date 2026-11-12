import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, Award, CheckCircle2, Loader2, Send,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { AWARDS_CATEGORIAS, AWARDS_PERGUNTAS, AWARDS_VIDEO_ORIENTACAO } from '../../../../config/programas';
import { buscarEstado, buscarProjeto, criarProjeto, editarProjeto } from '../../lib/awards';
import {
  ACEITA_ARQUIVO, ACEITA_VIDEO, erroDoArquivo, erroDoVideo, faltandoNoProjeto, podeInscrever,
} from '../../lib/awardsRegras';

const VAZIO = {
  categoria: '',
  ...Object.fromEntries(AWARDS_PERGUNTAS.map((p) => [p.campo, ''])),
};

/** Uma tela para cadastrar e editar: muda só o que já vem preenchido. */
export default function FormProjeto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, modules } = useAuth();
  const [v, setV] = useState(VAZIO);
  const [projeto, setProjeto] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [video, setVideo] = useState(null);
  const [progresso, setProgresso] = useState(null);
  // Trocar a chave limpa os campos de arquivo depois de "Cadastrar outro".
  const [rodada, setRodada] = useState(0);
  const [carregando, setCarregando] = useState(!!id);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(null);
  const avisoRef = useRef(null);
  // Depois que a votação abre, nenhum projeto muda (a RLS também barra).
  const [fase, setFase] = useState(null);
  const liberado = fase === 'validacao' && podeInscrever(user, modules);

  useEffect(() => {
    let ativo = true;
    buscarEstado()
      .then((e) => { if (ativo) setFase(e.fase); })
      .catch((e) => { if (ativo) { setErro(e.message); setFase('?'); } });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!id) return undefined;
    let ativo = true;
    buscarProjeto(id)
      .then((p) => {
        if (!ativo) return;
        if (p?.autor_id === user?.id) {
          setProjeto(p);
          setV(Object.fromEntries(Object.keys(VAZIO).map((c) => [c, p[c] || ''])));
        }
      })
      .catch((e) => { if (ativo) setErro(e.message); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [id, user?.id]);

  const falhar = (mensagem) => {
    setErro(mensagem);
    avisoRef.current?.focus();
  };

  const escolher = (validar, guardar) => (e) => {
    const escolhido = e.target.files?.[0] || null;
    const problema = escolhido && validar(escolhido);
    if (problema) {
      e.target.value = '';
      guardar(null);
      falhar(problema);
      return;
    }
    setErro('');
    guardar(escolhido);
  };

  const enviar = async (e) => {
    e.preventDefault();
    const faltando = faltandoNoProjeto(v, Boolean(video || projeto?.video));
    if (faltando.length) {
      falhar(`Ainda falta preencher: ${faltando.join(', ')}.`);
      return;
    }
    setEnviando(true);
    setErro('');
    const arquivos = { video, apresentacao: arquivo };
    const aoProgredir = (etapa, fracao) => setProgresso({ etapa, fracao });
    try {
      if (projeto) {
        await editarProjeto(projeto, v, arquivos, user.id, aoProgredir);
        navigate('/programas/awards');
      } else {
        setPronto(await criarProjeto(v, arquivos, user.id, aoProgredir));
      }
    } catch (err) {
      falhar(err.message);
    } finally {
      setEnviando(false);
      setProgresso(null);
    }
  };

  const voltar = <Link className="pg-link" to="/programas/awards">Voltar aos Projetos do Ano</Link>;

  if (carregando || !fase) {
    return <div className="pg-page"><div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div></div>;
  }
  if (!liberado) {
    return <div className="pg-page"><div className="pg-vazio">{erro || 'As inscrições não estão abertas agora.'} {voltar}.</div></div>;
  }
  if (id && !projeto) {
    return <div className="pg-page"><div className="pg-vazio">{erro || 'Projeto não encontrado.'} {voltar}.</div></div>;
  }

  if (pronto) {
    return (
      <div className="pg-page">
        <div className="pg-card pg-sucesso">
          <CheckCircle2 size={44} className="tom-ok" />
          <h2>Projeto cadastrado!</h2>
          <p>
            Seu projeto <strong>#{pronto.numero} · {pronto.codigo_setor}</strong> foi enviado. Nesta fase,
            só quem avalia vê os projetos cadastrados.
          </p>
          <div className="pg-acoes">
            <button type="button" className="pg-btn pg-btn-ghost" onClick={() => navigate('/programas/awards')}>
              Ver o que cadastrei
            </button>
            <button
              type="button"
              className="pg-btn pg-btn-primary"
              onClick={() => { setPronto(null); setV(VAZIO); setArquivo(null); setVideo(null); setRodada((r) => r + 1); }}
            >
              Cadastrar outro
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pg-page">
      <button type="button" className="pg-back" onClick={() => navigate('/programas/awards')}>
        <ArrowLeft size={15} /> Voltar
      </button>

      <div className="pg-form-cab">
        <span className="pg-prog-ico"><Award size={24} /></span>
        <div>
          <h1>{projeto ? 'Editar projeto' : 'Cadastrar seu Projeto'}</h1>
          <small>PHD Awards: Projetos do Ano</small>
        </div>
      </div>

      {erro && (
        <div className="pg-aviso tom-erro" tabIndex={-1} ref={avisoRef}>
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      <form onSubmit={enviar} noValidate>
        <div className="pg-card">
          <h2 className="pg-card-tit">Categoria<span className="req">*</span></h2>
          <div className="pg-aw-cats" role="radiogroup" aria-label="Categoria">
            {AWARDS_CATEGORIAS.map((c) => (
              <button
                key={c.valor} type="button" role="radio"
                className={`pg-aw-cat pg-aw-cat-opcao ${v.categoria === c.valor ? 'is-on' : ''}`}
                aria-checked={v.categoria === c.valor}
                onClick={() => setV((a) => ({ ...a, categoria: c.valor }))}
              >
                <strong>{c.label}</strong>
                <span>{c.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pg-card">
          <h2 className="pg-card-tit">Faça a indicação do seu Projeto!</h2>
          {AWARDS_PERGUNTAS.map(({ campo, label, curta }, i) => (
            <div className="pg-campo" key={campo}>
              <label htmlFor={campo}>{i + 1}. {label}<span className="req">*</span></label>
              {curta ? (
                <input
                  id={campo} className="pg-input" value={v[campo]}
                  onChange={(e) => setV((a) => ({ ...a, [campo]: e.target.value }))}
                />
              ) : (
                <textarea
                  id={campo} className="pg-textarea" value={v[campo]}
                  onChange={(e) => setV((a) => ({ ...a, [campo]: e.target.value }))}
                />
              )}
            </div>
          ))}

          <div className="pg-campo">
            <label htmlFor="video">9. Vídeo do Projeto<span className="req">*</span></label>
            <p className="pg-campo-dica pg-aw-orientacao">{AWARDS_VIDEO_ORIENTACAO}</p>
            <input
              key={`video-${rodada}`} id="video" type="file" className="pg-aw-arquivo"
              accept={ACEITA_VIDEO} onChange={escolher(erroDoVideo, setVideo)}
            />
            <p className="pg-campo-dica">
              {projeto?.video && !video
                ? `Vídeo atual: ${projeto.video.nome}. Escolher outro substitui este. `
                : ''}
              1 vídeo de até 300 MB: MP4, MOV, AVI, WMV, WEBM ou MKV. O do celular serve.
            </p>
          </div>

          <div className="pg-campo">
            <label htmlFor="apresentacao">10. Apresentação do Projeto<span className="opc">(opcional)</span></label>
            <input
              key={`apresentacao-${rodada}`} id="apresentacao" type="file" className="pg-aw-arquivo"
              accept={ACEITA_ARQUIVO} onChange={escolher(erroDoArquivo, setArquivo)}
            />
            <p className="pg-campo-dica">
              {projeto?.apresentacao && !arquivo
                ? `Arquivo atual: ${projeto.apresentacao.nome}. Escolher outro substitui este. `
                : ''}
              1 arquivo de até 100 MB: Word, Excel, PowerPoint, PDF, imagem, vídeo ou áudio.
            </p>
          </div>
        </div>

        {progresso && (
          <div className="pg-aw-progresso" role="status">
            <span>
              Enviando {progresso.etapa === 'video' ? 'o vídeo' : 'a apresentação'}… {Math.round(progresso.fracao * 100)}%.
              {' '}Não feche esta página.
            </span>
            <div className="pg-aw-progresso-barra"><span style={{ width: `${progresso.fracao * 100}%` }} /></div>
          </div>
        )}

        <div className="pg-acoes">
          <button type="button" className="pg-btn pg-btn-ghost" onClick={() => navigate('/programas/awards')} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" className="pg-btn pg-btn-primary" disabled={enviando}>
            {enviando
              ? <><Loader2 size={16} className="pg-spin" /> Enviando…</>
              : <><Send size={16} /> {projeto ? 'Salvar' : 'Enviar'}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
