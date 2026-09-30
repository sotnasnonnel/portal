import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';
import {
  GRUPOS_RESUMO, mesesComDados, resumoDoMes, evolucaoMensal, rotuloMes,
} from '../../lib/resumoMensal';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const dias = (n) => (n === null || n === undefined ? '—' : `${n} ${n === 1 ? 'dia' : 'dias'}`);

/**
 * Resumo mensal das mobilizações (pedido da Edijane, 30/09/2026): o mês
 * escolhido, com Pessoas e Empresas em tabelas separadas, e a evolução de
 * quantidade e média mês a mês. Tempos em dias úteis (lib/resumoMensal.js).
 */
export default function ResumoMensal({ processos }) {
  const meses = mesesComDados(processos);
  const [mes, setMes] = useState(meses[0] || '');
  if (!meses.length) return null;
  const evolucao = evolucaoMensal(processos);

  return (
    <section className="mob-card">
      <div className="mob-resumo-cab">
        <h2 className="mob-card-tit"><CalendarRange size={16} /> Resumo mensal de mobilizações</h2>
        <label className="mob-resumo-mes">
          Mês
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {meses.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
          </select>
        </label>
      </div>
      <p className="mob-campo-dica">
        Mobilizações concluídas no mês (pela data real da última etapa). Tempo total da data-base até a
        conclusão, em dias úteis, contando o primeiro e o último dia.
      </p>

      <div className="mob-resumo-grupos">
        {GRUPOS_RESUMO.map((g) => {
          const r = resumoDoMes(processos, g.fluxo, mes);
          const ehEmpresa = g.fluxo === 'mobilizacao_empresa';
          return (
            <div key={g.fluxo} className="mob-resumo-grupo">
              <h3>{g.titulo}</h3>
              <div className="mob-resumo-num">
                <span><strong>{r.quantidade}</strong> {r.quantidade === 1 ? 'mobilização' : 'mobilizações'}</span>
                <span>média de <strong>{dias(r.media)}</strong></span>
              </div>
              {r.quantidade === 0 ? (
                <p className="mob-campo-dica">Nenhuma concluída neste mês.</p>
              ) : (
                <div className="mob-tabela-scroll">
                  <table className="mob-tabela">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{ehEmpresa ? 'Cliente' : 'Colaborador'}</th>
                        <th>CNPJ PHD</th>
                        <th>Cód. CT</th>
                        <th>Início</th>
                        <th>Conclusão</th>
                        <th className="num">Tempo total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.itens.map((p) => (
                        <tr key={p.id}>
                          <td className="num"><Link className="mob-link" to={`/mobilizacao/processo/${p.id}`}>#{p.numero}</Link></td>
                          <td>{(ehEmpresa ? p.cliente_phd : p.profissional_nome) || p.titulo}</td>
                          <td>{p.empresa_phd || '—'}</td>
                          <td>{p.cod_ct || '—'}</td>
                          <td className="num">{dataBr(p.data_base)}</td>
                          <td className="num">{dataBr(p.concluido_real)}</td>
                          <td className="num"><strong>{dias(p.dias)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6}>Média do mês</td>
                        <td className="num"><strong>{dias(r.media)}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mês a mês: é o que mostra se a média está caindo. Clicar na linha
          abre aquele mês nas tabelas acima. */}
      <h3 className="mob-resumo-sub">Evolução mês a mês</h3>
      <div className="mob-tabela-scroll">
        <table className="mob-tabela">
          <thead>
            <tr>
              <th>Mês</th>
              <th className="num">Pessoas</th>
              <th className="num">Média pessoas</th>
              <th className="num">Empresas</th>
              <th className="num">Média empresas</th>
            </tr>
          </thead>
          <tbody>
            {evolucao.map((linha) => (
              <tr key={linha.mes} className={linha.mes === mes ? 'is-selecionado' : ''}>
                <td>
                  <button type="button" className="mob-link mob-link-btn" onClick={() => setMes(linha.mes)}>
                    {rotuloMes(linha.mes)}
                  </button>
                </td>
                {linha.grupos.map((g) => (
                  <Fragment key={g.fluxo}>
                    <td className="num">{g.quantidade || '—'}</td>
                    <td className="num">{dias(g.media)}</td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
