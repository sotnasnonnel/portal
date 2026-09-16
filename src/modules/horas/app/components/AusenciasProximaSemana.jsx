import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../services/supabase';
import { getEquipeIds } from '../../../../services/equipe';
import { getStatusCalculado, formatarData } from '../../../../utils/formatters';

/**
 * Ausências da equipe que começam nos próximos 7 dias.
 *
 * Morava no Dashboard do gestor em Gestão de Pessoas e veio para o Dashboard da
 * Equipe daqui a pedido da gestão (15/09/2026): é informação de planejamento de
 * horas, e é aqui que o gestor olha a equipe no dia a dia.
 *
 * Mesma leitura de lá: a equipe é a subárvore do organograma (get_minha_equipe)
 * e as ausências vêm de ciclos_ausencia, cuja RLS também segue a hierarquia —
 * nenhuma das duas depende do perfil do DP, então funciona igual para quem é
 * gestão só na Gestão de Horas.
 *
 * Carrega sozinho, fora do Promise.all do dashboard: é outra consulta, sem
 * relação com o período escolhido, e não deve segurar os gráficos.
 */
export default function AusenciasProximaSemana() {
  const { modules } = useAuth();
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // A tela de Gestão de Ausência continua no DP e só abre para gestor/coordenador
  // de lá; para os outros o botão levaria de volta à Home.
  const abreGestaoAusencia = ['gestor', 'coordenador'].includes(modules?.dp);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const ids = await getEquipeIds();
        if (!ids.length) {
          if (!cancel) setLista([]);
          return;
        }
        const [{ data: cols, error: eCols }, { data: cics, error: eCics }] = await Promise.all([
          supabase.from('colaboradores').select('id, nome').in('id', ids),
          supabase.from('ciclos_ausencia').select('*').in('colaborador_id', ids),
        ]);
        if (eCols) throw eCols;
        if (eCics) throw eCics;

        const nomes = new Map((cols || []).map((c) => [c.id, c.nome]));
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + 7);

        const proximas = (cics || [])
          .filter((c) => {
            if (!c.ausencia_agendada_inicio) return false;
            const inicio = new Date(`${c.ausencia_agendada_inicio}T00:00:00`);
            return inicio >= hoje && inicio <= limite;
          })
          .sort((a, b) => String(a.ausencia_agendada_inicio).localeCompare(String(b.ausencia_agendada_inicio)))
          .map((c) => ({
            ...c,
            colaborador_nome: nomes.get(c.colaborador_id) || 'Desconhecido',
            calc: getStatusCalculado({
              ...c,
              status_original: c.status_atual,
              fim_pa: c.fim_periodo_aquisitivo,
            }),
          }));
        if (!cancel) setLista(proximas);
      } catch (e) {
        if (!cancel) setErro(e?.message || 'Falha ao carregar as ausências.');
      } finally {
        if (!cancel) setCarregando(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="horas-card" style={{ marginBottom: 18 }}>
      <div className="horas-campo-topo">
        <div className="horas-sec" style={{ margin: 0 }}>
          Ausência(s) marcada(s) para próxima semana
        </div>
        {abreGestaoAusencia ? (
          <button className="horas-btn2" type="button" onClick={() => navigate('/gestor/ausencia')}>
            Ver gestão de ausência
          </button>
        ) : null}
      </div>

      {carregando ? (
        <div className="horas-empty">Carregando…</div>
      ) : erro ? (
        <div className="horas-empty">⚠️ {erro}</div>
      ) : !lista.length ? (
        <div className="horas-empty">Ninguém da equipe entra em ausência nos próximos 7 dias.</div>
      ) : (
        <div className="horas-table-wrap">
          <table className="horas-tbl-resp">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Início</th>
                <th>Término</th>
                <th>Dias</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.id}>
                  <td data-label="Colaborador" style={{ fontWeight: 600 }}>{s.colaborador_nome}</td>
                  <td data-label="Início">{formatarData(s.ausencia_agendada_inicio)}</td>
                  <td data-label="Término">{formatarData(s.ausencia_agendada_fim)}</td>
                  <td data-label="Dias">{s.dias_solicitados || 0} dias</td>
                  <td data-label="Status">
                    <span
                      className="horas-badge"
                      style={{ backgroundColor: s.calc.cor, color: '#fff', fontSize: 'var(--font-size-2xs)' }}
                    >
                      {s.calc.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
