import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { fetchSolicitacoes, aprovar, reprovar } from '../../../../../services/horasExtras';
import { fmtMin, podeDecidir } from '../../../../../config/horasExtras';
import { notificarHoraExtra } from '../../../../../services/notificarHoraExtra';
import SolicitacoesHETable from '../../components/SolicitacoesHETable';
import DestinoHEModal from '../../components/DestinoHEModal';
import MotivoHEModal from '../../components/MotivoHEModal';

// Aprovações Pendentes: as solicitações em que EU sou o aprovador (superior
// direto do solicitante). Aprovar exige definir o destino da hora; reprovar exige
// motivo — as duas regras também são garantidas pelo banco.
export default function AprovacoesHEPage() {
  const { user } = useAuth();
  const meuId = user?.id;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aAprovar, setAAprovar] = useState(null);
  const [aReprovar, setAReprovar] = useState(null);
  const [verDecididas, setVerDecididas] = useState(false);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setList(await fetchSolicitacoes());
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar as aprovações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const minhasAprovacoes = useMemo(
    () => list.filter((s) => s.aprovador_id === meuId),
    [list, meuId]
  );
  const pendentes = useMemo(
    () => minhasAprovacoes.filter((s) => s.status === 'pendente'),
    [minhasAprovacoes]
  );
  const decididas = useMemo(
    () => minhasAprovacoes.filter((s) => s.status !== 'pendente'),
    [minhasAprovacoes]
  );

  const totalPendente = pendentes.reduce((soma, s) => soma + (s.minutos || 0), 0);

  async function confirmarAprovacao({ destino, compensacao, observacao }) {
    const s = aAprovar;
    await aprovar(s.id, { destino, compensacao, observacao, decididoPor: meuId });
    await notificarHoraExtra(s.id, 'decidida');
    setAAprovar(null);
    await carregar();
  }

  async function confirmarReprovacao(motivo) {
    const s = aReprovar;
    await reprovar(s.id, { motivo, decididoPor: meuId });
    await notificarHoraExtra(s.id, 'decidida');
    setAReprovar(null);
    await carregar();
  }

  const acoes = (s) =>
    podeDecidir(s, meuId) ? (
      <>
        <button className="horas-btn grn horas-btn-sm" type="button" onClick={() => setAAprovar(s)}>
          <Check size={14} /> Aprovar
        </button>{' '}
        <button className="horas-btn red horas-btn-sm" type="button" onClick={() => setAReprovar(s)}>
          <X size={14} /> Reprovar
        </button>
      </>
    ) : null;

  return (
    <>
      <h1>Aprovações Pendentes</h1>
      <p className="horas-sub">
        {pendentes.length} solicitação(ões) aguardando você · {fmtMin(totalPendente)} no total.
      </p>

      <div className="horas-hint">
        Ao aprovar, defina se a hora vai para <b>Medição/Pagamento</b> ou <b>Banco de Horas</b> (que
        exige data, período e quantidade previstos para compensação). O percentual não é informado
        por você: o DP/RM aplica conforme a CCT vigente.
      </div>

      {erro ? <div className="horas-hint is-erro">⚠️ {erro}</div> : null}

      <div className="horas-card horas-table-wrap">
        {loading ? (
          <div className="horas-empty">Carregando…</div>
        ) : (
          <SolicitacoesHETable list={pendentes} mostraColaborador acoes={acoes} />
        )}
      </div>

      {decididas.length ? (
        <>
          <div className="horas-toolbar" style={{ marginTop: 18 }}>
            <div className="horas-sec" style={{ margin: 0 }}>
              Já decididas por você ({decididas.length})
            </div>
            <div className="horas-spacer" />
            <button
              className="horas-btn2"
              type="button"
              onClick={() => setVerDecididas((v) => !v)}
            >
              {verDecididas ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {verDecididas ? (
            <div className="horas-card horas-table-wrap">
              <SolicitacoesHETable list={decididas} mostraColaborador />
            </div>
          ) : null}
        </>
      ) : null}

      {aAprovar ? (
        <DestinoHEModal
          solicitacao={aAprovar}
          titulo="Aprovar solicitação"
          onClose={() => setAAprovar(null)}
          onConfirm={confirmarAprovacao}
        />
      ) : null}

      {aReprovar ? (
        <MotivoHEModal
          titulo={`Reprovar solicitação #${aReprovar.numero}`}
          descricao={`${aReprovar.colaborador_nome} · ${fmtMin(aReprovar.minutos)} de hora extra. O motivo é enviado ao colaborador.`}
          rotulo="Motivo da reprovação"
          confirmar="Reprovar"
          perigo
          onClose={() => setAReprovar(null)}
          onConfirm={confirmarReprovacao}
        />
      ) : null}
    </>
  );
}
