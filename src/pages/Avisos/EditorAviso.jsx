import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, Bold, Heading, ImagePlus, Italic, Link2, List, ListOrdered,
  Loader2, Paperclip, Plus, Send, Trash2, Type, X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  ANEXO_ACCEPT, ANEXO_BYTES_MAX, FUNDOS, IMAGEM_ACCEPT, LEGENDA_MAX, MANCHETE_MAX, ROTA_AVISOS,
  ROTULO_MAX, SUBTITULO_MAX, TEXTO_MAX, TIPOS_BLOCO, aplicarMarca, arquivosDoAviso, blocoNovo,
  prefixarLinhas, semMarcas, tamanhoLegivel, validarAviso,
} from '../../config/avisos';
import { linksDosArquivos, obterAviso, salvarAviso } from '../../services/avisos';
import BannerAviso from './BannerAviso';
import CorpoAviso from './CorpoAviso';
import './Avisos.css';

// Chave local de cada bloco, só para o React não confundir os blocos ao
// reordenar. Não vai para o banco.
let seq = 0;
const comChave = (b) => ({ ...b, _k: ++seq });

const ICONE_BLOCO = { texto: Type, imagem: ImagePlus, botao: Link2, anexo: Paperclip };
const DICA_BLOCO = {
  texto: 'Parágrafos, listas e negrito',
  imagem: 'Foto ou print, com legenda',
  botao: 'Link em destaque',
  anexo: 'PDF, planilha, apresentação',
};

/**
 * Barra de formatação de um campo de texto. Mexe no texto pelas marcas
 * (**, _, "- ", "1. ", "## ") e devolve a seleção no lugar certo.
 */
function BarraFormato({ campoRef, valor, onChange, linhas = true }) {
  const aplicar = (fn) => {
    const el = campoRef.current;
    if (!el) return;
    const r = fn(valor, el.selectionStart, el.selectionEnd);
    onChange(r.texto);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.ini, r.fim); });
  };
  const botoes = [
    { Icon: Bold, titulo: 'Negrito (**texto**)', fn: (t, i, f) => aplicarMarca(t, i, f, '**') },
    { Icon: Italic, titulo: 'Itálico (_texto_)', fn: (t, i, f) => aplicarMarca(t, i, f, '_') },
    ...(linhas ? [
      { Icon: Heading, titulo: 'Subtítulo (## no começo da linha)', fn: (t, i, f) => prefixarLinhas(t, i, f, '## ') },
      { Icon: List, titulo: 'Lista (- no começo da linha)', fn: (t, i, f) => prefixarLinhas(t, i, f, '- ') },
      { Icon: ListOrdered, titulo: 'Lista numerada', fn: (t, i, f) => prefixarLinhas(t, i, f, '1. ') },
    ] : []),
  ];
  return (
    <div className="aviso-ed-barra" role="toolbar" aria-label="Formatação">
      {botoes.map((b) => {
        const Icon = b.Icon;
        // onMouseDown: o clique não pode tirar o foco do campo antes de ler a seleção.
        return (
          <button key={b.titulo} type="button" title={b.titulo} aria-label={b.titulo}
            onMouseDown={(e) => e.preventDefault()} onClick={() => aplicar(b.fn)}>
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}

function BlocoTexto({ bloco, mudar }) {
  const ref = useRef(null);
  return (
    <>
      <BarraFormato campoRef={ref} valor={bloco.texto} onChange={(texto) => mudar({ texto })} />
      <textarea ref={ref} className="aviso-ed-area" rows={6} maxLength={TEXTO_MAX} value={bloco.texto}
        placeholder={'Boa tarde!\n\nComo anunciado no Bom dia PHD, …\n\nUse **negrito**, _itálico_ e - para listas. Links viram link sozinhos.'}
        onChange={(e) => mudar({ texto: e.target.value })} />
    </>
  );
}

function BlocoArquivo({ bloco, mudar, links, guardarPreview, imagem }) {
  const escolher = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!imagem && file.size > ANEXO_BYTES_MAX) {
      mudar({ erro: `Arquivo acima de ${Math.round(ANEXO_BYTES_MAX / 1024 / 1024)} MB.` });
      return;
    }
    const preview = imagem ? guardarPreview(file) : undefined;
    mudar({ arquivo: file, preview, path: '', nome: file.name, tamanho: file.size, erro: '' });
  };
  const src = bloco.preview || links[bloco.path];
  return (
    <>
      {imagem && src && <img className="aviso-ed-miniatura" src={src} alt="" />}
      {!imagem && (bloco.nome) && (
        <p className="aviso-ed-arquivo"><Paperclip size={14} /> {bloco.nome}{bloco.tamanho != null && ` · ${tamanhoLegivel(bloco.tamanho)}`}</p>
      )}
      <label className="btn btn-outline btn-sm aviso-ed-escolher">
        {imagem ? <ImagePlus size={14} /> : <Paperclip size={14} />}
        {bloco.path || bloco.arquivo ? 'Trocar arquivo' : imagem ? 'Escolher imagem' : 'Escolher arquivo'}
        <input type="file" hidden accept={imagem ? IMAGEM_ACCEPT : ANEXO_ACCEPT} onChange={escolher} />
      </label>
      {bloco.erro && <p className="aviso-erro-inline">{bloco.erro}</p>}
      {imagem && (
        <input className="aviso-ed-input" maxLength={LEGENDA_MAX} value={bloco.legenda || ''}
          placeholder="Legenda (opcional)" onChange={(e) => mudar({ legenda: e.target.value })} />
      )}
    </>
  );
}

function BlocoBotao({ bloco, mudar }) {
  return (
    <div className="aviso-ed-duplo">
      <input className="aviso-ed-input" maxLength={ROTULO_MAX} value={bloco.rotulo}
        placeholder="Texto do botão (ex.: Acessar nosso portal)" onChange={(e) => mudar({ rotulo: e.target.value })} />
      <input className="aviso-ed-input" value={bloco.url} inputMode="url"
        placeholder="Link (https://… ou /feed)" onChange={(e) => mudar({ url: e.target.value })} />
    </div>
  );
}

/**
 * Publicar (/avisos/novo) e editar (/avisos/:id/editar) um aviso. À esquerda o
 * formulário, à direita a prévia exatamente como vai sair.
 */
export default function EditorAviso() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const mancheteRef = useRef(null);
  const previews = useRef([]);

  const [manchete, setManchete] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [fundo, setFundo] = useState('laranja');
  const [foto, setFoto] = useState(null); // { path } | { arquivo, preview }
  const [blocos, setBlocos] = useState(() => [comChave(blocoNovo('texto'))]);
  const [links, setLinks] = useState({});
  const [carregando, setCarregando] = useState(Boolean(id));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  // Aviso que não existe ou que não é desta pessoa: só a mensagem, sem formulário.
  const [bloqueado, setBloqueado] = useState(false);

  // URLs locais das imagens escolhidas, liberadas ao sair da tela.
  const guardarPreview = (file) => {
    const url = URL.createObjectURL(file);
    previews.current.push(url);
    return url;
  };
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  useEffect(() => {
    if (!id) return undefined;
    let vivo = true;
    obterAviso(id)
      .then(async (a) => {
        if (!vivo) return;
        if (!a) { setErro('Este aviso não existe mais.'); setBloqueado(true); return; }
        if (!a.pode_editar) { setErro('Só quem publicou edita este aviso.'); setBloqueado(true); return; }
        setManchete(a.manchete);
        setSubtitulo(a.subtitulo || '');
        setFundo(a.fundo);
        setFoto(a.foto_path ? { path: a.foto_path } : null);
        setBlocos((a.blocos || []).map(comChave));
        const paths = arquivosDoAviso(a);
        if (paths.length) {
          const l = await linksDosArquivos(paths);
          if (vivo) setLinks(l);
        }
      })
      .catch((e) => { if (vivo) { setErro(e.message); setBloqueado(true); } })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [id]);

  const mudarBloco = (k, patch) => setBlocos((bs) => bs.map((b) => (b._k === k ? { ...b, ...patch } : b)));
  const moverBloco = (i, d) => setBlocos((bs) => {
    const j = i + d;
    if (j < 0 || j >= bs.length) return bs;
    const novo = [...bs];
    [novo[i], novo[j]] = [novo[j], novo[i]];
    return novo;
  });
  const tirarBloco = (k) => setBlocos((bs) => bs.filter((b) => b._k !== k));
  const porBloco = (tipo) => setBlocos((bs) => [...bs, comChave(blocoNovo(tipo))]);

  const escolherFoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setFoto({ arquivo: file, preview: guardarPreview(file) });
  };

  const salvar = async (e) => {
    e.preventDefault();
    const problema = validarAviso({ manchete, subtitulo, fundo, foto, blocos });
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro('');
    try {
      const novoId = await salvarAviso(user.id, { id: id || null, manchete, subtitulo, fundo, foto, blocos });
      navigate(`${ROTA_AVISOS}/${novoId}`, { replace: true });
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  };

  const fotoUrl = foto?.preview || links[foto?.path];
  const voltar = id ? `${ROTA_AVISOS}/${id}` : ROTA_AVISOS;

  if (carregando) {
    return <div className="avisos-page"><div className="avisos-carregando"><Loader2 size={18} className="aviso-spin" /> Carregando…</div></div>;
  }

  if (bloqueado) {
    return (
      <div className="avisos-page">
        <Link to={ROTA_AVISOS} className="avisos-voltar"><ArrowLeft size={16} /> Todos os avisos</Link>
        <div className="avisos-erro">{erro}</div>
      </div>
    );
  }

  return (
    <div className="avisos-page">
      <Link to={voltar} className="avisos-voltar"><ArrowLeft size={16} /> {id ? 'Voltar ao aviso' : 'Todos os avisos'}</Link>
      <header className="avisos-cab">
        <div>
          <h1>{id ? 'Editar aviso' : 'Publicar aviso'}</h1>
          <p>O banner segue o template de manchete da Comunicação Interna. Escreva, confira a prévia e publique.</p>
        </div>
      </header>

      <form className="aviso-ed" onSubmit={salvar}>
        <div className="aviso-ed-form">
          <section className="aviso-ed-secao">
            <h2>Banner</h2>
            <label className="aviso-ed-rotulo" htmlFor="aviso-manchete">
              Manchete <span>{semMarcas(manchete).length}/{MANCHETE_MAX}</span>
            </label>
            <BarraFormato campoRef={mancheteRef} valor={manchete} onChange={setManchete} linhas={false} />
            <input id="aviso-manchete" ref={mancheteRef} className="aviso-ed-input" maxLength={MANCHETE_MAX} value={manchete}
              placeholder="Módulo **Financeiro** liberado no **Portal PHD**" onChange={(e) => setManchete(e.target.value)} />
            <p className="aviso-ed-dica">Selecione um trecho e clique em <b>B</b> para destacá-lo em negrito, como no template.</p>

            <label className="aviso-ed-rotulo" htmlFor="aviso-sub">Subtítulo (opcional)</label>
            <input id="aviso-sub" className="aviso-ed-input" maxLength={SUBTITULO_MAX} value={subtitulo}
              placeholder="Uma linha de apoio abaixo da manchete" onChange={(e) => setSubtitulo(e.target.value)} />

            <span className="aviso-ed-rotulo">Fundo</span>
            <div className="aviso-ed-fundos" role="radiogroup" aria-label="Fundo do banner">
              {FUNDOS.map((f) => (
                <button key={f.valor} type="button" role="radio" aria-checked={fundo === f.valor}
                  className={`aviso-ed-fundo is-${f.valor}${fundo === f.valor ? ' is-on' : ''}`}
                  onClick={() => setFundo(f.valor)}>
                  <span aria-hidden="true" />{f.rotulo}
                </button>
              ))}
            </div>
            {fundo === 'foto' && (
              <label className="btn btn-outline btn-sm aviso-ed-escolher">
                <ImagePlus size={14} /> {foto ? 'Trocar a foto' : 'Escolher a foto do fundo'}
                <input type="file" hidden accept={IMAGEM_ACCEPT} onChange={escolherFoto} />
              </label>
            )}
          </section>

          <section className="aviso-ed-secao">
            <h2>Conteúdo</h2>
            {blocos.length === 0 && <p className="aviso-ed-dica">Sem blocos: o aviso fica só com o banner e a manchete.</p>}
            {blocos.map((b, i) => {
              const Icon = ICONE_BLOCO[b.tipo];
              const mudar = (patch) => mudarBloco(b._k, patch);
              return (
                <div key={b._k} className="aviso-ed-bloco">
                  <div className="aviso-ed-bloco-cab">
                    <span><Icon size={14} /> {TIPOS_BLOCO[b.tipo]}</span>
                    <span className="aviso-ed-bloco-acoes">
                      <button type="button" onClick={() => moverBloco(i, -1)} disabled={i === 0} aria-label="Subir bloco" title="Subir"><ArrowUp size={14} /></button>
                      <button type="button" onClick={() => moverBloco(i, 1)} disabled={i === blocos.length - 1} aria-label="Descer bloco" title="Descer"><ArrowDown size={14} /></button>
                      <button type="button" onClick={() => tirarBloco(b._k)} aria-label="Remover bloco" title="Remover"><Trash2 size={14} /></button>
                    </span>
                  </div>
                  {b.tipo === 'texto' && <BlocoTexto bloco={b} mudar={mudar} />}
                  {b.tipo === 'botao' && <BlocoBotao bloco={b} mudar={mudar} />}
                  {(b.tipo === 'imagem' || b.tipo === 'anexo') && (
                    <BlocoArquivo bloco={b} mudar={mudar} links={links} guardarPreview={guardarPreview} imagem={b.tipo === 'imagem'} />
                  )}
                </div>
              );
            })}
            <div className="aviso-ed-adicionar">
              <span className="aviso-ed-adicionar-tit"><Plus size={14} /> Adicionar bloco</span>
              <div className="aviso-ed-tiles">
                {Object.entries(TIPOS_BLOCO).map(([tipo, rotulo]) => {
                  const Icon = ICONE_BLOCO[tipo];
                  return (
                    <button key={tipo} type="button" className="aviso-ed-tile" onClick={() => porBloco(tipo)}>
                      <span className="aviso-ed-tile-icone"><Icon size={18} /></span>
                      <b>{rotulo}</b>
                      <small>{DICA_BLOCO[tipo]}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {erro && <div className="avisos-erro">{erro}</div>}
          <div className="aviso-ed-rodape">
            <span className="aviso-ed-rodape-dica">
              {id ? 'As alterações aparecem na hora para todos.' : 'Ao publicar, o aviso aparece na Home de todo o portal.'}
            </span>
            <Link to={voltar} className="btn btn-outline aviso-ed-cancelar"><X size={16} /> Cancelar</Link>
            <button type="submit" className="btn btn-primary aviso-ed-publicar" disabled={salvando}>
              {salvando ? <Loader2 size={16} className="aviso-spin" /> : <Send size={16} />}
              {salvando ? 'Publicando…' : id ? 'Salvar alterações' : 'Publicar aviso'}
            </button>
          </div>
        </div>

        <aside className="aviso-ed-previa" aria-label="Prévia">
          <span className="aviso-ed-previa-tit">Prévia</span>
          <div className="aviso-ed-previa-caixa">
            <BannerAviso manchete={manchete} subtitulo={subtitulo} fundo={fundo} fotoUrl={fotoUrl} />
            <div className="aviso-artigo">
              <h1 className="aviso-titulo">{semMarcas(manchete) || 'Manchete do aviso'}</h1>
              <CorpoAviso blocos={blocos} links={links} />
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
