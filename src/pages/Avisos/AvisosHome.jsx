import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ROTA_AVISOS, semMarcas } from '../../config/avisos';
import { listarAvisos, linksDosArquivos } from '../../services/avisos';
import BannerAviso from './BannerAviso';
import './Avisos.css';

const NA_HOME = 5;
const TROCA_MS = 8000;

/**
 * Os avisos mais recentes no topo da Home, um banner por vez, como o carrossel
 * de notícias do SharePoint. Passa sozinho a cada 8 s, menos com o mouse em
 * cima; as setas e os pontos trocam na mão.
 */
export default function AvisosHome() {
  const [avisos, setAvisos] = useState(null);
  const [links, setLinks] = useState({});
  const [atual, setAtual] = useState(0);
  const [parado, setParado] = useState(false);

  useEffect(() => {
    let vivo = true;
    listarAvisos({ limite: NA_HOME })
      .then(async (lista) => {
        if (!vivo) return;
        setAvisos(lista);
        const fotos = lista.map((a) => a.foto_path).filter(Boolean);
        if (fotos.length) {
          const l = await linksDosArquivos(fotos);
          if (vivo) setLinks(l);
        }
      })
      // Falha aqui não pode derrubar a Home: o bloco só não aparece.
      .catch(() => { if (vivo) setAvisos([]); });
    return () => { vivo = false; };
  }, []);

  const total = avisos?.length || 0;
  useEffect(() => {
    if (total < 2 || parado) return undefined;
    const t = setInterval(() => setAtual((i) => (i + 1) % total), TROCA_MS);
    return () => clearInterval(t);
  }, [total, parado]);

  if (avisos === null) return null;

  const a = avisos[atual];
  const ir = (d) => setAtual((i) => (i + d + total) % total);

  return (
    <section className="home-avisos" aria-label="Avisos">
      <div className="home-avisos-cab">
        <h2>Avisos</h2>
        <span className="home-avisos-links">
          <Link to={`${ROTA_AVISOS}/novo`}><Plus size={14} style={{ verticalAlign: '-2px' }} /> Publicar</Link>
          {total > 0 && <Link to={ROTA_AVISOS}>Ver todos</Link>}
        </span>
      </div>

      {total === 0 ? (
        <div className="home-avisos-vazio">
          Nenhum aviso por enquanto. Tem algo para contar à empresa?
          <Link to={`${ROTA_AVISOS}/novo`} className="btn btn-primary btn-sm"><Plus size={14} /> Publicar aviso</Link>
        </div>
      ) : (
        <>
          <div className="home-avisos-palco" onMouseEnter={() => setParado(true)} onMouseLeave={() => setParado(false)}>
            <Link to={`${ROTA_AVISOS}/${a.id}`} className="home-avisos-slide" aria-label={`Abrir o aviso: ${semMarcas(a.manchete)}`}>
              <BannerAviso manchete={a.manchete} subtitulo={a.subtitulo} fundo={a.fundo} fotoUrl={links[a.foto_path]} />
            </Link>
            {total > 1 && (
              <>
                <button type="button" className="home-avisos-seta is-esq" onClick={() => ir(-1)} aria-label="Aviso anterior"><ChevronLeft size={18} /></button>
                <button type="button" className="home-avisos-seta is-dir" onClick={() => ir(1)} aria-label="Próximo aviso"><ChevronRight size={18} /></button>
              </>
            )}
          </div>
          {total > 1 && (
            <div className="home-avisos-pontos">
              {avisos.map((x, i) => (
                <button key={x.id} type="button" className={i === atual ? 'is-on' : ''}
                  onClick={() => setAtual(i)} aria-label={`Aviso ${i + 1} de ${total}`} aria-current={i === atual} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
