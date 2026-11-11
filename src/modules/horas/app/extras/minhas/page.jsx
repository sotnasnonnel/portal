import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { fetchSolicitacoes } from '../../../../../services/horasExtras';
import { fmtMin } from '../../../../../config/horasExtras';
import SolicitacoesHETable from '../../components/SolicitacoesHETable';
import Aviso, { Carregando } from '../../components/Aviso';

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
      {/* A ação principal sobe para o cabeçalho: antes ocupava um cartão inteiro
          só para um botão. */}
      <div className="horas-head">
        <div>
          <h1>Minhas Solicitações de Hora Extra</h1>
          <p className="horas-sub">
            {loading ? (
              'Carregando…'
            ) : (
              <>
                {totais.qtd} solicitação(ões) · {totais.pendentes} aguardando aprovação ·{' '}
                {fmtMin(totais.minutos)} aprovadas.
              </>
            )}
          </p>
        </div>
        <div className="horas-head-acoes">
          <Link className="horas-btn" to="/horas/extras/nova">
            <Plus size={16} /> Nova solicitação
          </Link>
        </div>
      </div>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <div className="horas-card horas-table-wrap">
        {loading ? (
          <Carregando />
        ) : (
          <SolicitacoesHETable
            list={minhas}
            vazio="Você ainda não pediu hora extra. Use Nova solicitação para abrir a primeira."
          />
        )}
      </div>
    </>
  );
}
