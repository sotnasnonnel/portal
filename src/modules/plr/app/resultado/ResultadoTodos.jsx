import { useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { formatarMoeda } from '../../../../utils/formatters';
import { nomeProprio } from '../../../../utils/pessoas';
import { BASE_DO_FATOR, formatarMult, formatarPct, nomeCasa, rotuloCargo, rotuloYtd } from '../../lib/plr';
import AvisoGatilho from './AvisoGatilho';
import { CabecalhoSetor, MultiplicadorEmpresa } from './PartesSetor';

// Rolagem por código, e não por âncora (#): o portal usa HashRouter.
const irPara = (id) => {
  document.getElementById(`plr-calc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/** O total e o multiplicador da empresa. */
function CartaoResumo({ dados }) {
  return (
    <section className="plr-card plr-calc-resumo">
      <div>
        <h2 className="plr-card-tit">{rotuloYtd(dados.ytdAte)}</h2>
        <strong className="plr-base-total">{formatarMoeda(dados.totais.geral)}</strong>
        <dl className="plr-base-linhas">
          <div><dt>Colaboradores</dt><dd>{formatarMoeda(dados.totais.colaboradores)}</dd></div>
          <div><dt>Gerência</dt><dd>{formatarMoeda(dados.totais.gerencia)}</dd></div>
        </dl>
      </div>
      <MultiplicadorEmpresa valor={dados.multEmpresa} />
    </section>
  );
}

function ResumoSetores({ dados }) {
  return (
    <section className="plr-card">
      <h2 className="plr-card-tit">Por setor</h2>
      <div className="plr-tabela-scroll">
        <table className="plr-tabela plr-tabela-calc">
          <thead>
            <tr>
              <th>Setor</th>
              <th className="num">% do setor</th>
              <th className="num">Valor % setor</th>
              <th className="num">Mult. total YTD</th>
              <th className="num">Pessoas</th>
              <th className="num">Valor YTD</th>
            </tr>
          </thead>
          <tbody>
            {dados.setores.map((s) => (
              <tr key={s.id}>
                <td className="plr-ind">
                  <button type="button" className="plr-link" onClick={() => irPara(s.id)}>{s.nome}</button>
                  {s.responsavel ? <small className="plr-pessoa-sub">{s.responsavel}</small> : null}
                </td>
                <td className="num" data-rot="% do setor">{formatarPct(s.pct)}</td>
                <td className="num" data-rot="Valor % setor">{formatarPct(s.valorSetor)}</td>
                <td className="num" data-rot="Mult. total YTD">{formatarPct(s.multTotal)}</td>
                <td className="num" data-rot="Pessoas">{s.pessoas}</td>
                <td className="num plr-contrib" data-rot="Valor YTD">{formatarMoeda(s.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CartaoGerencia({ gerencia }) {
  const bonusZerado = gerencia.some((g) => g.bonusZerado);
  return (
    <section className="plr-card plr-setor" id="plr-calc-gerencia">
      <header className="plr-setor-cab plr-calc-cab">
        <div className="plr-setor-tit">
          <h2>Gerência</h2>
          <p>Valor completo vindo do HUB ({BASE_DO_FATOR.toLowerCase()}): não passa pela conta dos colaboradores.</p>
        </div>
      </header>
      <div className="plr-tabela-scroll">
        <table className="plr-tabela plr-tabela-calc">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th className="num">Salário</th>
              <th className="num">PLR</th>
              <th className="num">Bônus</th>
              <th className="num">Variável</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {gerencia.map((g) => (
              <tr key={g.id}>
                <td className="plr-ind">
                  <span className="plr-ind-nome">{nomeProprio(g.nome)}</span>
                  <small className="plr-pessoa-sub">{g.cargo}</small>
                </td>
                <td className="num" data-rot="Salário">{formatarMoeda(g.salario)}</td>
                <td className="num" data-rot="PLR">
                  {formatarMoeda(g.plr)}
                  <small className="plr-fator">fator {formatarPct(g.fator)}</small>
                </td>
                <td className="num" data-rot="Bônus">{formatarMoeda(g.bonus)}</td>
                <td className="num" data-rot="Variável">{formatarMoeda(g.variavel)}</td>
                <td className="num plr-contrib" data-rot="Total">{formatarMoeda(g.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bonusZerado ? <p className="plr-rodape">Bônus zerado pelo piso de lucro, como no HUB.</p> : null}
    </section>
  );
}

function CartaoSetorPessoas({ setor, pessoas, multEmpresa, comTotal }) {
  return (
    <section className="plr-card plr-setor" id={`plr-calc-${setor.id}`}>
      <CabecalhoSetor setor={setor} multEmpresa={multEmpresa} />
      <div className="plr-tabela-scroll">
        <table className="plr-tabela plr-tabela-calc">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th className="num">Salário</th>
              <th className="num">Tempo (meses)</th>
              <th className="num">Mult. tempo</th>
              <th className="num">Mult. cargo</th>
              <th className="num">Final YTD</th>
              <th className="num">Valor YTD</th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => (
              <tr key={p.id}>
                <td className="plr-ind">
                  <span className="plr-ind-nome">{nomeProprio(p.nome)}</span>
                  <small className="plr-pessoa-sub">{rotuloCargo(p.cargo)} · {p.cod_ct}</small>
                </td>
                <td className="num" data-rot="Salário">{formatarMoeda(p.salario)}</td>
                <td className="num" data-rot="Tempo (meses)">{formatarMult(p.meses)}</td>
                <td className="num" data-rot="Mult. tempo">{formatarMult(p.multTempo, 4)}</td>
                <td className="num" data-rot="Mult. cargo">{formatarMult(p.multCargo)}</td>
                <td className="num" data-rot="Final YTD">{formatarMult(p.multFinal, 4)}</td>
                <td className="num plr-contrib" data-rot="Valor YTD">{formatarMoeda(p.valor)}</td>
              </tr>
            ))}
          </tbody>
          {comTotal ? (
            <tfoot>
              <tr>
                <td>Total</td>
                <td colSpan={5} className="plr-cel-vazia" />
                <td className="num" data-rot="Valor YTD">{formatarMoeda(setor.valor)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

function FiltroNome({ valor, onMudar }) {
  return (
    <div className="plr-filtro">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        className="plr-input"
        placeholder="Filtrar pelo nome da pessoa"
        aria-label="Filtrar pelo nome da pessoa"
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
      />
    </div>
  );
}

// Admin e gestor: o total da empresa, a quantidade de pessoas e o valor de cada
// setor, a gerência e as pessoas, com filtro por nome. O admin recebe todo mundo; o
// gestor, só as linhas do setor dele e a própria.
export default function ResultadoTodos({ dados }) {
  const [busca, setBusca] = useState('');
  const semFiltro = busca.trim() === '';

  const gerencia = dados.gerencia.filter((g) => nomeCasa(g.nome, busca));
  const setores = dados.setores
    .map((setor) => ({
      setor,
      pessoas: dados.colaboradores.filter((c) => c.setorId === setor.id && nomeCasa(c.nome, busca)),
    }))
    .filter(({ pessoas }) => pessoas.length > 0);

  return (
    <>
      <AvisoGatilho dados={dados} />

      {dados.problemas.length > 0 ? (
        <section className="plr-card plr-problemas-cartao">
          <h2 className="plr-card-tit"><AlertTriangle size={14} aria-hidden="true" /> Fora da conta</h2>
          <ul className="plr-problemas">
            {dados.problemas.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </section>
      ) : null}

      <CartaoResumo dados={dados} />

      <ResumoSetores dados={dados} />

      <FiltroNome valor={busca} onMudar={setBusca} />

      {gerencia.length > 0 ? <CartaoGerencia gerencia={gerencia} /> : null}

      {setores.map(({ setor, pessoas }) => (
        <CartaoSetorPessoas
          key={setor.id}
          setor={setor}
          multEmpresa={dados.multEmpresa}
          pessoas={pessoas}
          comTotal={semFiltro}
        />
      ))}

      {gerencia.length === 0 && setores.length === 0 ? (
        <div className="plr-vazio plr-vazio-filtro">Ninguém com esse nome.</div>
      ) : null}

      <section className="plr-card plr-legenda">
        <h2 className="plr-card-tit">Como ler</h2>
        <ul>
          <li><b>Multiplicador empresa</b> = {formatarPct(dados.multEmpresa)}, igual para todos os colaboradores.</li>
          <li><b>Valor % setor</b> = % do setor no HUB × {formatarPct(dados.metasSetor, 0)}.</li>
          <li><b>Multiplicador total</b> = Multiplicador empresa + Valor % setor.</li>
          <li><b>Multiplicador final</b> = tempo × cargo × Multiplicador total.</li>
          <li><b>Valor</b> = Multiplicador final × salário.</li>
        </ul>
        <p>O tempo é a parte do ano trabalhada (meses ÷ 12). Menos de 4 meses no ano contam como zero.</p>
      </section>
    </>
  );
}
