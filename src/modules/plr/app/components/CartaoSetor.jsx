import { nomeCurto, formatarDataHora } from '../../../../utils/formatters';
import { nomeProprio } from '../../../../utils/pessoas';
import {
  REGRAS, aderencia, contribuicao, formatarPct, formatarValor, percentualDaMeta,
  resumoSetor, situacao,
} from '../../lib/plr';
import { nomeResponsavel } from './rotulos';

/** Barra do total do setor (0 a 100%). */
export function BarraTotal({ valor }) {
  const largura = `${Math.max(0, Math.min(1, Number(valor) || 0)) * 100}%`;
  return (
    <div className="plr-barra" role="presentation">
      <span style={{ width: largura }} />
    </div>
  );
}

/**
 * Um setor como na aba SETORES: os indicadores com meta, resultado, aderência
 * e quanto cada um põe no total. Só leitura.
 */
export default function CartaoSetor({ setor }) {
  const r = resumoSetor(setor.indicadores);

  return (
    <section className="plr-card plr-setor" id={`plr-setor-${setor.id}`}>
      <header className="plr-setor-cab">
        <div className="plr-setor-tit">
          <h2>{setor.nome}</h2>
          <p>
            Responsável: <b>{nomeResponsavel(setor)}</b>
            {setor.referencia ? <span className="plr-chip">{setor.referencia}</span> : null}
          </p>
        </div>
        <div className="plr-setor-total">
          <strong>{formatarPct(r.total)}</strong>
          <span>do PLR do setor</span>
        </div>
      </header>
      <BarraTotal valor={r.total} />

      {r.pendentes > 0 ? (
        <p className="plr-aviso">
          {r.pendentes === 1
            ? '1 indicador ainda sem resultado. Ele conta zero até ser informado.'
            : `${r.pendentes} indicadores ainda sem resultado. Eles contam zero até serem informados.`}
        </p>
      ) : null}

      <div className="plr-tabela-scroll">
        <table className="plr-tabela">
          <thead>
            <tr>
              <th>Indicador</th>
              <th className="num">Peso</th>
              <th className="num">Meta</th>
              <th className="num">Resultado</th>
              <th className="num">% da meta</th>
              <th className="num">Aderência</th>
              <th className="num">Contribuição</th>
            </tr>
          </thead>
          <tbody>
            {setor.indicadores.map((ind) => (
              <tr key={ind.id}>
                <td className="plr-ind">
                  <span className="plr-ind-nome">{ind.nome}</span>
                  <span className="plr-ind-regra" title={REGRAS[ind.regra]?.descricao}>
                    {REGRAS[ind.regra]?.rotulo}
                  </span>
                </td>
                <td className="num" data-rot="Peso">{formatarPct(ind.peso, 0)}</td>
                <td className="num" data-rot="Meta">{formatarValor(ind.meta, ind.unidade)}</td>
                <td className="num" data-rot="Resultado">{formatarValor(ind.resultado, ind.unidade)}</td>
                <td className="num" data-rot="% da meta">{formatarPct(percentualDaMeta(ind))}</td>
                <td className="num" data-rot="Aderência">
                  <span className={`plr-pill is-${situacao(ind)}`}>{formatarPct(aderencia(ind))}</span>
                </td>
                <td className="num plr-contrib" data-rot="Contribuição">{formatarPct(contribuicao(ind))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td
                className={`num${r.pesosFecham ? '' : ' is-alerta'}`}
                data-rot="Peso"
                title={r.pesosFecham ? undefined : 'Os pesos deste setor não somam 100%.'}
              >
                {formatarPct(r.somaPesos, 0)}
              </td>
              <td colSpan={4} className="plr-cel-vazia" />
              <td className="num plr-contrib" data-rot="Contribuição">{formatarPct(r.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {setor.atualizado_em ? (
        <p className="plr-rodape">
          Atualizado em {formatarDataHora(setor.atualizado_em)}
          {setor.atualizado_por_nome ? ` por ${nomeProprio(nomeCurto(setor.atualizado_por_nome))}` : ''}
        </p>
      ) : null}
    </section>
  );
}
