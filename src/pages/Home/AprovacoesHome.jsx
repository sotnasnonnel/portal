import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { usePendenciasLista } from '../../modules/aprovacoes/usePendencias';
import { nomeDaFonte, ordenarPendencias } from '../../modules/aprovacoes/lib/central';
import { iniciais, nomeProprio } from '../../utils/pessoas';

// A Home mostra só os primeiros; decidir é na central, onde há o campo de
// motivo e o resto do pedido.
const VISIVEIS = 3;

const haQuanto = (iso) => {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return 'chegou hoje';
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
};

// "Para você aprovar": a única coisa da Home que pede ação. Sem pendência,
// vira uma linha só — a caixa vazia ocuparia o lugar dos módulos à toa.
export default function AprovacoesHome() {
  const { itens, carregado } = usePendenciasLista();
  if (!carregado) return null;

  if (itens.length === 0) {
    return (
      <div className="home-apv-ok" role="status">
        <span className="home-apv-ok-ic"><Check size={16} /></span>
        <span><b>Tudo em dia.</b> Nada esperando a sua decisão.</span>
        <Link to="/aprovacoes">Ver aprovações</Link>
      </div>
    );
  }

  // O mais antigo primeiro: é o que está esperando há mais tempo.
  const primeiros = ordenarPendencias(itens).slice(0, VISIVEIS);
  return (
    <section className="home-apv" aria-label="Para você aprovar">
      <header>
        <h2><span className="home-apv-n">{itens.length}</span> Para você aprovar</h2>
        <Link to="/aprovacoes">{itens.length > VISIVEIS ? `Ver todas (${itens.length})` : 'Ver todas'}</Link>
      </header>
      {primeiros.map((item) => (
        <div key={item.chave} className="home-apv-item">
          <span className="home-pav">{iniciais(item.pessoa)}</span>
          <div className="home-apv-txt">
            <b>
              {item.titulo}
              <span className="home-apv-tag">{nomeDaFonte(item.fonte)}</span>
            </b>
            <span>{[nomeProprio(item.pessoa), haQuanto(item.quando)].filter(Boolean).join(', ')}</span>
          </div>
          {/* Leva direto ao pedido: a central rola até ele e o destaca. */}
          <Link to={`/aprovacoes?item=${encodeURIComponent(item.chave)}`} className="home-apv-btn">Revisar</Link>
        </div>
      ))}
    </section>
  );
}
