import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ROTA_AVISOS, semMarcas } from '../../config/avisos';
import { listarAvisos, linksDosArquivos } from '../../services/avisos';
import { nomeProprio } from '../../utils/pessoas';
import { dataDoAviso } from './datas';
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
            {/* Cartão compacto: o banner pequeno ao lado da manchete. Na largura
                toda da Home ele passava de 500px de altura e empurrava os módulos. */}
            <Link to={`${ROTA_AVISOS}/${a.id}`} className="home-avisos-slide">
              <BannerAviso manchete={a.manchete} subtitulo={a.subtitulo} fundo={a.fundo} fotoUrl={links[a.foto_path]} />
              <div className="home-avisos-txt">
                <b>{semMarcas(a.manchete)}</b>
                {a.resumo && <p>{semMarcas(a.resumo)}</p>}
                <span>{nomeProprio(a.autor_nome || '')} · {dataDoAviso(a.criado_em)}</span>
              </div>
            </Link>
          </div>
          {/* Setas embaixo, junto dos pontos: em cima do banner pequeno elas
              cobriam o quadrado do PHD. */}
          {total > 1 && (
            <div className="home-avisos-pontos">
              <button type="button" className="home-avisos-seta" onClick={() => ir(-1)} aria-label="Aviso anterior"><ChevronLeft size={16} /></button>
              {avisos.map((x, i) => (
                <button key={x.id} type="button" className={`home-avisos-ponto${i === atual ? ' is-on' : ''}`}
                  onClick={() => setAtual(i)} aria-label={`Aviso ${i + 1} de ${total}`} aria-current={i === atual} />
              ))}
              <button type="button" className="home-avisos-seta" onClick={() => ir(1)} aria-label="Próximo aviso"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
