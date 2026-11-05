import { formatarPct } from '../../lib/plr';

/** Nome, responsável, % e multiplicador total do setor. */
export default function CabecalhoSetor({ setor, multEmpresa }) {
  return (
    <header className="plr-setor-cab plr-calc-cab">
      <div className="plr-setor-tit">
        <h2>{setor.nome}</h2>
        <p>
          {setor.responsavel ? <>Responsável: <b>{setor.responsavel}</b></> : null}
          <span className="plr-chip">{formatarPct(setor.pct)} do setor</span>
        </p>
      </div>
      <dl className="plr-calc-mult">
        <div>
          <dt>Mult. total YTD</dt>
          <dd>{formatarPct(setor.multTotal)}</dd>
          <small>{formatarPct(multEmpresa)} + {formatarPct(setor.valorSetor)}</small>
        </div>
      </dl>
    </header>
  );
}
