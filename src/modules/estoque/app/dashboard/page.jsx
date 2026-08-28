import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Loader2, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehOperadorEstoque } from '../../../../config/estoque';
import { listarPosicao, listarMovimentos, listarChamadosElegiveis } from '../../lib/estoque';
import {
  resumoPosicao, topDeficit, consumoMensal, entradaSaidaMensal,
  topConsumidos, entregasPorColaborador, valorPorCategoria,
} from '../../lib/indicadores';
import {
  GraficoDeficit, GraficoConsumo, GraficoRanking, GraficoEntradaSaida, GraficoValor,
} from '../components/Charts';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
});

// 12 meses de histórico é o que a planilha guardava (colunas JAN..DEZ).
const MESES = 12;

export default function DashboardEstoque() {
  const { modules } = useAuth();
  const operador = ehOperadorEstoque(modules);

  const [posicao, setPosicao] = useState([]);
  const [movs, setMovs] = useState([]);
  const [chamados, setChamados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      try {
        const de = new Date();
        de.setMonth(de.getMonth() - (MESES - 1), 1);
        const [pos, mv, ch] = await Promise.all([
          listarPosicao(),
          listarMovimentos({ de: de.toISOString(), limite: 5000 }),
          operador ? listarChamadosElegiveis() : Promise.resolve([]),
        ]);
        if (cancelado) return;
        setPosicao(pos);
        setMovs(mv);
        setChamados(ch);
      } catch (e) {
        if (!cancelado) setErro(e.message);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [operador]);

  // `ref` fixa a "hoje" do render inteiro: sem isso duas agregações no mesmo
  // render podem cair em meses diferentes na virada da meia-noite.
  const ind = useMemo(() => {
    const ref = new Date().toISOString();
    return {
      resumo: resumoPosicao(posicao),
      deficit: topDeficit(posicao, 10),
      consumo: consumoMensal(movs, ref, MESES),
      giro: entradaSaidaMensal(movs, ref, MESES),
      itens: topConsumidos(movs, 10),
      pessoas: entregasPorColaborador(movs, 15),
      valor: valorPorCategoria(posicao),
    };
  }, [posicao, movs]);

  if (carregando) {
    return (
      <div className="est-page est-page-wide">
        <div className="est-vazio"><Loader2 size={20} className="est-spin" /> Carregando indicadores…</div>
      </div>
    );
  }

  const { resumo } = ind;

  return (
    <div className="est-page est-page-wide">
      <div className="est-cab">
        <div className="est-cab-txt">
          <h1 className="est-title"><BarChart3 size={22} /> Indicadores do estoque</h1>
          <p className="est-sub">Posição atual e consumo dos últimos {MESES} meses.</p>
        </div>
      </div>

      {erro && <div className="est-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      <div className="est-tiles">
        <Link className="est-tile est-tile-link" to="/estoque/posicao">
          <strong>{resumo.skus}</strong><span>variações ativas</span>
        </Link>
        <div className="est-tile">
          <strong>{resumo.pecas}</strong><span>peças em estoque</span>
        </div>
        <div className={`est-tile ${resumo.semEstoque ? 'is-critico' : ''}`}>
          <strong>{resumo.semEstoque}</strong><span>sem estoque</span>
        </div>
        <div className={`est-tile ${resumo.abaixoMinimo ? 'is-alerta' : ''}`}>
          <strong>{resumo.abaixoMinimo}</strong><span>abaixo do mínimo</span>
        </div>
        <div className="est-tile">
          <strong>{BRL.format(resumo.valorTotal)}</strong><span>valor imobilizado</span>
        </div>
        {/* O número que amarra os dois módulos: pedido aberto esperando entrega. */}
        {operador && (
          <Link className="est-tile est-tile-link" to="/estoque/saida">
            <strong>{chamados.length}</strong><span>chamados aguardando entrega</span>
          </Link>
        )}
      </div>

      {resumo.semCusto > 0 && (
        <div className="est-aviso tom-info">
          <Info size={16} />
          {resumo.semCusto} {resumo.semCusto === 1 ? 'variação está' : 'variações estão'} sem custo
          unitário cadastrado e {resumo.semCusto === 1 ? 'não entra' : 'não entram'} no valor
          imobilizado. Dá para preencher em <Link to="/estoque/posicao">Posição de estoque</Link>.
        </div>
      )}

      <div className="est-graficos">
        <div className="est-grafico">
          <h3>Reposição urgente</h3>
          <p>Os 10 itens com maior diferença entre o saldo e o mínimo.</p>
          <div className="est-grafico-area"><GraficoDeficit data={ind.deficit} /></div>
        </div>

        <div className="est-grafico">
          <h3>Consumo mensal</h3>
          <p>Peças entregues por mês, separadas por categoria.</p>
          <div className="est-grafico-area"><GraficoConsumo data={ind.consumo} /></div>
        </div>

        <div className="est-grafico">
          <h3>Itens mais consumidos</h3>
          <p>O que mais sai — é o que precisa de reposição contratada.</p>
          <div className="est-grafico-area"><GraficoRanking data={ind.itens} /></div>
        </div>

        <div className="est-grafico">
          <h3>Entradas × saídas</h3>
          <p>Se as saídas passam as entradas, o estoque está drenando.</p>
          <div className="est-grafico-area"><GraficoEntradaSaida data={ind.giro} /></div>
        </div>

        {operador && (
          <div className="est-grafico">
            <h3>Entregas por colaborador</h3>
            <p>Quem mais retirou material no período.</p>
            <div className="est-grafico-area">
              <GraficoRanking data={ind.pessoas} cor="#2563eb" rotulo="Entregas" />
            </div>
          </div>
        )}

        <div className="est-grafico">
          <h3>Valor imobilizado</h3>
          <p>Só entra o que tem custo unitário cadastrado.</p>
          <div className="est-grafico-area"><GraficoValor data={ind.valor} /></div>
        </div>
      </div>
    </div>
  );
}
