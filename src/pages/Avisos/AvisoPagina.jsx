import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, Trash2 } from 'lucide-react';
import { ROTA_AVISOS, arquivosDoAviso, semMarcas } from '../../config/avisos';
import { excluirAviso, linksDosArquivos, obterAviso } from '../../services/avisos';
import { nomeProprio } from '../../utils/pessoas';
import { dataDoAviso } from './datas';
import BannerAviso from './BannerAviso';
import CorpoAviso from './CorpoAviso';
import './Avisos.css';

// Um aviso aberto (/avisos/:id), no desenho das notícias do SharePoint: o
// banner de ponta a ponta, a manchete em laranja e o corpo logo abaixo.
export default function AvisoPagina() {
  const { id } = useParams();
  // `key`: trocar de aviso (link de um para outro) recomeça a tela do zero.
  return <Leitura key={id} id={id} />;
}

function Leitura({ id }) {
  const navigate = useNavigate();
  const [aviso, setAviso] = useState(null);
  const [links, setLinks] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [apagando, setApagando] = useState(false);

  useEffect(() => {
    let vivo = true;
    obterAviso(id)
      .then(async (a) => {
        if (!vivo) return;
        setAviso(a);
        const paths = a ? arquivosDoAviso(a) : [];
        if (paths.length) {
          const l = await linksDosArquivos(paths);
          if (vivo) setLinks(l);
        }
      })
      .catch((e) => { if (vivo) setErro(e.message); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [id]);

  const apagar = async () => {
    if (!window.confirm('Apagar este aviso? Ele sai do ar para todo mundo.')) return;
    setApagando(true);
    try {
      await excluirAviso(id);
      navigate(ROTA_AVISOS, { replace: true });
    } catch (e) {
      setErro(e.message);
      setApagando(false);
    }
  };

  return (
    <div className="avisos-page aviso-leitura">
      <Link to={ROTA_AVISOS} className="avisos-voltar"><ArrowLeft size={16} /> Todos os avisos</Link>

      {carregando && <div className="avisos-carregando"><Loader2 size={18} className="aviso-spin" /> Carregando…</div>}
      {erro && <div className="avisos-erro">{erro}</div>}
      {!carregando && !erro && !aviso && (
        <div className="avisos-vazio">Este aviso não existe mais. <Link to={ROTA_AVISOS}>Ver os outros avisos.</Link></div>
      )}

      {aviso && (
        <article>
          <BannerAviso manchete={aviso.manchete} subtitulo={aviso.subtitulo} fundo={aviso.fundo} fotoUrl={links[aviso.foto_path]} />
          <div className="aviso-artigo">
            <h1 className="aviso-titulo">{semMarcas(aviso.manchete)}</h1>
            <div className="aviso-linha-meta">
              <span className="avisos-meta">
                Por {nomeProprio(aviso.autor_nome || '')} · {dataDoAviso(aviso.criado_em)}
                {aviso.editado_em && ' · editado'}
              </span>
              {aviso.pode_editar && (
                <span className="aviso-acoes">
                  <Link to={`${ROTA_AVISOS}/${aviso.id}/editar`} className="btn btn-outline btn-sm"><Pencil size={14} /> Editar</Link>
                  <button type="button" className="btn btn-outline btn-sm" onClick={apagar} disabled={apagando}>
                    <Trash2 size={14} /> Apagar
                  </button>
                </span>
              )}
            </div>
            <CorpoAviso blocos={aviso.blocos} links={links} />
          </div>
        </article>
      )}
    </div>
  );
}
