import { formatarMoeda } from '../../../../utils/formatters';
import { nomeProprio } from '../../../../utils/pessoas';
import { BASE_DO_FATOR, formatarMult, formatarPct, rotuloCargo, rotuloYtd } from '../../lib/plr';
import AvisoGatilho from './AvisoGatilho';
import CabecalhoSetor from './CabecalhoSetor';

function Linha({ rotulo, valor, forte = false, sub = null }) {
  return (
    <tr className={forte ? 'is-forte' : undefined}>
      <td>
        {rotulo}
        {sub ? <small className="plr-pessoa-sub">{sub}</small> : null}
      </td>
      <td className="num">{valor}</td>
    </tr>
  );
}

function QuantoRecebe({ dados, valor, rodape }) {
  return (
    <section className="plr-card">
      <h2 className="plr-card-tit">Quanto você recebe</h2>
      <span className="plr-calc-rotulo">{rotuloYtd(dados.ytdAte)}</span>
      <strong className="plr-base-total">{formatarMoeda(valor)}</strong>
      <p className="plr-rodape">{rodape}</p>
    </section>
  );
}

/** O valor, o setor e a conta inteira, passo a passo. */
function ContaColaborador({ dados, c }) {
  const setor = dados.setores.find((s) => s.id === c.setorId);
  return (
    <>
      <QuantoRecebe
        dados={dados}
        valor={c.valor}
        rodape={`${nomeProprio(c.nome)} · ${c.setorNome} · ${rotuloCargo(c.cargo)}`}
      />
      <section className="plr-card">
        {setor ? <CabecalhoSetor setor={setor} multEmpresa={c.multEmpresa} /> : null}
        <h2 className="plr-card-tit">Como a conta é feita</h2>
        <table className="plr-conta">
          <tbody>
            <Linha rotulo="Multiplicador empresa" sub="Igual para todos" valor={formatarPct(c.multEmpresa)} forte />
            <Linha rotulo={`% do setor ${c.setorNome}`} valor={formatarPct(c.setorPct)} />
            <Linha rotulo="Multiplicador do setor" valor={formatarPct(dados.metasSetor, 0)} />
            <Linha rotulo="Valor % setor" valor={formatarPct(c.valorSetor)} forte />
            <Linha rotulo="Multiplicador total" valor={formatarPct(c.multTotal)} forte />
            <Linha rotulo={`Multiplicador tempo (${formatarMult(c.meses)} meses ÷ 12)`} valor={formatarMult(c.multTempo, 4)} />
            <Linha rotulo="Multiplicador cargo" valor={formatarMult(c.multCargo)} />
            <Linha rotulo="Multiplicador final" valor={formatarMult(c.multFinal, 4)} forte />
            <Linha rotulo="Salário" valor={formatarMoeda(c.salario)} />
            <Linha rotulo="Valor final" valor={formatarMoeda(c.valor)} forte />
          </tbody>
        </table>
        {c.meses === 0 ? <p className="plr-rodape">Menos de 4 meses no ano contam como zero.</p> : null}
      </section>
    </>
  );
}

/** Gerência: o valor completo que o HUB calcula. */
function ContaGerencia({ dados, g }) {
  return (
    <>
      <QuantoRecebe dados={dados} valor={g.total} rodape={`${nomeProprio(g.nome)} · ${g.cargo}`} />
      <section className="plr-card">
        <h2 className="plr-card-tit">De onde vem</h2>
        <table className="plr-conta">
          <tbody>
            <Linha rotulo="Fator Resultados" sub={BASE_DO_FATOR} valor={formatarPct(g.fator)} />
            <Linha rotulo="Resultados" valor={formatarMoeda(g.plr)} />
            <Linha rotulo="Bônus" valor={formatarMoeda(g.bonus)} />
            <Linha rotulo="Variável" valor={formatarMoeda(g.variavel)} />
            <Linha rotulo="Total" valor={formatarMoeda(g.total)} forte />
          </tbody>
        </table>
        {g.bonusZerado ? <p className="plr-rodape">Bônus zerado pelo piso de lucro, como no HUB.</p> : null}
      </section>
    </>
  );
}

// O usuário: só a própria linha, que é tudo o que a resposta traz.
export default function MinhaLinha({ dados }) {
  const colaborador = dados.colaboradores[0];
  const gerente = dados.gerencia[0];

  if (!colaborador && !gerente) {
    return <div className="plr-vazio">Você não está na lista dos Resultados de {dados.ano}.</div>;
  }
  return (
    <>
      <AvisoGatilho dados={dados} />
      {gerente ? <ContaGerencia dados={dados} g={gerente} /> : <ContaColaborador dados={dados} c={colaborador} />}
    </>
  );
}
