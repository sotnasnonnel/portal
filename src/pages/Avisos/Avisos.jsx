import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Megaphone, Plus, Trash2 } from 'lucide-react';
import { POR_PAGINA, ROTA_AVISOS, semMarcas } from '../../config/avisos';
import { excluirAviso, listarAvisos, linksDosArquivos } from '../../services/avisos';
import { nomeProprio } from '../../utils/pessoas';
import { dataDoAviso } from './datas';
import BannerAviso from './BannerAviso';
import './Avisos.css';

// Todos os avisos, do mais novo para o mais antigo (/avisos). Quem quiser
// publica pelo botão do topo; a Home mostra só os mais recentes.
export default function Avisos() {
  const [avisos, setAvisos] = useState([]);
  const [links, setLinks] = useState({});
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async (antes = []) => {
    setCarregando(true);
    setErro('');
    try {
      const ultimo = antes[antes.length - 1];
      const novos = await listarAvisos({ cursor: ultimo ? { em: ultimo.criado_em, id: ultimo.id } : null });
      setAvisos([...antes, ...novos]);
      setTemMais(novos.length === POR_PAGINA);
      const fotos = novos.map((a) => a.foto_path).filter(Boolean);
      if (fotos.length) {
        const l = await linksDosArquivos(fotos);
        setLinks((atual) => ({ ...atual, ...l }));
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Só aparece para quem publicou e para o super admin (pode_editar vem do banco).
  const [excluindo, setExcluindo] = useState(null);
  const excluir = async (a) => {
    if (!window.confirm(`Excluir o aviso "${semMarcas(a.manchete)}"? Ele sai do ar para todo mundo e não dá para desfazer.`)) return;
    setExcluindo(a.id);
    setErro('');
    try {
      await excluirAviso(a.id);
      setAvisos((lista) => lista.filter((x) => x.id !== a.id));
    } catch (e) {
      setErro(e.message);
    } finally {
      setExcluindo(null);
    }
  };

  return (
    <div className="avisos-page">
      <Link to="/home" className="avisos-voltar"><ArrowLeft size={16} /> Voltar ao início</Link>
      <header className="avisos-cab">
        <div>
          <h1><Megaphone size={22} aria-hidden="true" /> Avisos</h1>
          <p>Comunicados da PHD. Qualquer colaborador pode publicar.</p>
        </div>
        <Link to={`${ROTA_AVISOS}/novo`} className="btn btn-primary"><Plus size={16} /> Publicar aviso</Link>
      </header>

      {erro && <div className="avisos-erro">{erro}</div>}

      {!carregando && !erro && avisos.length === 0 && (
        <div className="avisos-vazio">
          Nenhum aviso publicado ainda. <Link to={`${ROTA_AVISOS}/novo`}>Publique o primeiro.</Link>
        </div>
      )}

      <div className="avisos-grade">
        {avisos.map((a) => (
          <div key={a.id} className="avisos-card-caixa">
            <Link to={`${ROTA_AVISOS}/${a.id}`} className="avisos-card">
              <BannerAviso manchete={a.manchete} subtitulo={a.subtitulo} fundo={a.fundo} fotoUrl={links[a.foto_path]} />
              <div className="avisos-card-txt">
                <h2>{semMarcas(a.manchete)}</h2>
                {a.resumo && <p>{semMarcas(a.resumo)}</p>}
                <span className="avisos-meta">{nomeProprio(a.autor_nome || '')} · {dataDoAviso(a.criado_em)}</span>
              </div>
            </Link>
            {/* Fora do <Link>: botão dentro de link abriria o aviso ao clicar. */}
            {a.pode_editar && (
              <button type="button" className="avisos-card-excluir" onClick={() => excluir(a)} disabled={excluindo === a.id}
                aria-label={`Excluir o aviso "${semMarcas(a.manchete)}"`} title="Excluir aviso">
                {excluindo === a.id ? <Loader2 size={16} className="aviso-spin" /> : <Trash2 size={16} />}
              </button>
            )}
          </div>
        ))}
      </div>

      {carregando && <div className="avisos-carregando"><Loader2 size={18} className="aviso-spin" /> Carregando…</div>}
      {!carregando && temMais && (
        <div className="avisos-mais">
          <button type="button" className="btn btn-outline" onClick={() => carregar(avisos)}>Ver mais avisos</button>
        </div>
      )}
    </div>
  );
}
