import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { fetchSolicitacoes } from '../../../../../services/horasExtras';
import { fmtMin } from '../../../../../config/horasExtras';
import SolicitacoesHETable from '../../components/SolicitacoesHETable';

// Minhas Solicitações: só as que EU abri (a RPC também devolve as que eu aprovo e
// as da minha equipe — filtramos aqui pelo meu id).
export default function MinhasHEPage() {
  const { user } = useAuth();
  const meuId = user?.id;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErro('');
      try {
        const rows = await fetchSolicitacoes();
        if (!cancel) setList(rows);
      } catch (e) {
        if (!cancel) setErro(e?.message || 'Falha ao carregar as solicitações.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const minhas = useMemo(() => list.filter((s) => s.colaborador_id === meuId), [list, meuId]);

  const totais = useMemo(
    () => ({
      qtd: minhas.length,
      pendentes: minhas.filter((s) => s.status === 'pendente').length,
      minutos: minhas
        .filter((s) => s.status === 'aprovada' || s.status === 'compensada')
        .reduce((soma, s) => soma + (s.minutos || 0), 0),
    }),
    [minhas]
  );

  return (
    <>
      <h1>Minhas Solicitações de Hora Extra</h1>
      <p className="horas-sub">
        {totais.qtd} solicitação(ões) · {totais.pendentes} aguardando aprovação ·{' '}
        {fmtMin(totais.minutos)} aprovadas.
      </p>

      {erro ? <div className="horas-hint is-erro">⚠️ {erro}</div> : null}

      <div className="horas-card">
        <div className="horas-toolbar" style={{ marginBottom: 0 }}>
          <div className="horas-spacer" />
          <Link className="horas-btn" to="/horas/extras/nova">
            <Plus size={16} /> Nova solicitação
          </Link>
        </div>
      </div>

      <div className="horas-card horas-table-wrap">
        {loading ? (
          <div className="horas-empty">Carregando…</div>
        ) : (
          <SolicitacoesHETable list={minhas} />
        )}
      </div>
    </>
  );
}
