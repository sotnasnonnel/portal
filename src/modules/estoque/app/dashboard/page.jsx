import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Loader2, AlertCircle, Info, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehOperadorEstoque } from '../../../../config/estoque';
import { listarPosicao, listarMovimentos, listarChamadosElegiveis } from '../../lib/estoque';
import {
  resumoPosicao, consumoMensal, entradaSaidaMensal,
  topConsumidos, entregasPorColaborador, valorPorCategoria,
} from '../../lib/indicadores';
import {
  GraficoConsumo, GraficoRanking, GraficoEntradaSaida, GraficoValor,
} from '../components/Charts';
import ListaSituacao from '../components/ListaSituacao';

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
  // Qual indicador está aberto no popup. null = nenhum.
  const [detalhe, setDetalhe] = useState(null);

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
        {/* O que há de cada categoria, separando peça nova de usada — a leitura
            que o almoxarifado faz primeiro. Levam à Posição já filtrada. */}
        {resumo.porCategoria.map((c) => (
          <Link key={c.categoria} className="est-tile est-tile-link"
            to={`/estoque/posicao?categoria=${c.categoria}`}>
            <strong>{c.pecas}</strong>
            <span>{c.categoria === 'epi' ? 'peças de EPI' : 'peças de uniforme'}</span>
            <span className="est-tile-quebra">
              {c.novas} nova{c.novas === 1 ? '' : 's'} · {c.usadas} usada{c.usadas === 1 ? '' : 's'}
            </span>
          </Link>
        ))}
        {/* Os três indicadores de situação abrem a lista por trás do número:
            saber QUAIS são é o passo seguinte imediato de quem olha o painel. */}
        <button type="button"
          className={`est-tile est-tile-botao ${resumo.semEstoque ? 'is-critico' : ''}`}
          disabled={!resumo.semEstoque}
          onClick={() => setDetalhe('sem_estoque')}>
          <strong>{resumo.semEstoque}</strong>
          <span>sem estoque</span>
          {resumo.semEstoque > 0 && <span className="est-tile-dica">ver quais</span>}
        </button>
        <button type="button"
          className={`est-tile est-tile-botao ${resumo.abaixoMinimo ? 'is-alerta' : ''}`}
          disabled={!resumo.abaixoMinimo}
          onClick={() => setDetalhe('abaixo_minimo')}>
          <strong>{resumo.abaixoMinimo}</strong>
          <span>estoque baixo</span>
          {resumo.abaixoMinimo > 0 && <span className="est-tile-dica">ver quais</span>}
        </button>
        {/* Excesso não é alerta de reposição: é dinheiro parado, e por isso não
            entra no "precisa repor" nem no aviso do sino. */}
        <button type="button"
          className="est-tile est-tile-botao"
          disabled={!resumo.acimaMaximo}
          onClick={() => setDetalhe('acima_maximo')}>
          <strong>{resumo.acimaMaximo}</strong>
          <span>estoque alto</span>
          {resumo.acimaMaximo > 0 && <span className="est-tile-dica">ver quais</span>}
        </button>
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

      {/* "Baixo" e "alto" dependem de mínimo e máximo. Sem eles os dois
          indicadores ficam em zero para sempre, e isso parece defeito. */}
      {(resumo.semMinimo > 0 || resumo.semMaximo > 0) && (
        <div className="est-aviso tom-alerta">
          <TriangleAlert size={16} />
          <span>
            {resumo.semMinimo > 0 && (
              <>
                <strong>{resumo.semMinimo}</strong> {resumo.semMinimo === 1 ? 'variação está' : 'variações estão'} sem
                {' '}<strong>estoque mínimo</strong> cadastrado — {resumo.semMinimo === 1 ? 'ela' : 'elas'} só
                {' '}{resumo.semMinimo === 1 ? 'aparece' : 'aparecem'} como “estoque baixo” quando zerar.
              </>
            )}
            {resumo.semMinimo > 0 && resumo.semMaximo > 0 && ' '}
            {resumo.semMaximo > 0 && (
              <>
                <strong>{resumo.semMaximo}</strong> sem <strong>máximo</strong>, e por isso nunca
                {' '}{resumo.semMaximo === 1 ? 'entra' : 'entram'} em “estoque alto”.
              </>
            )}
            {' '}Dá para preencher em <Link to="/estoque/posicao">Posição de estoque</Link>.
          </span>
        </div>
      )}

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

      {detalhe && (
        <ListaSituacao situacao={detalhe} posicao={posicao} onFechar={() => setDetalhe(null)} />
      )}
    </div>
  );
}
