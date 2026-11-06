import {
  Clock, Pencil, Plus, Receipt, Trash2,
} from 'lucide-react';
import {
  MES3, compLabel, contasDoQuadro, curComp, doAloj, esperado, fdate, money, moneyCurto, num, plural, todayISO,
} from '../../lib/regras';
import { AnexosCompactos } from '../components/Anexos';
import {
  CelulaPagamento, LegendaPagamentos, Nil, PillPagamento, Vazio,
} from '../components/Ui';

const somaValor = (lista) => lista.reduce((s, p) => s + (num(p.valor) || 0), 0);

export default function AbaPagamentos({
  a, base, acoes, ano, setAno,
}) {
  const comps = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
  const pags = doAloj(base.pagamentos, a.id);
  const doAno = (p) => String(p.competencia).startsWith(String(ano));
  const anos = [...new Set([...pags.map((p) => +String(p.competencia).slice(0, 4)), +todayISO().slice(0, 4)])].filter(Boolean).sort();
  const ctrl = a.contas_controladas || [];
  const contas = contasDoQuadro(ctrl, pags.filter(doAno).map((p) => p.conta));
  const totConta = (c) => somaValor(pags.filter((p) => p.conta === c && doAno(p)));
  const totMes = (m) => somaValor(pags.filter((p) => p.competencia === m));
  const atual = curComp();
  const lista = [...pags]
    .sort((x, y) => String(y.competencia).localeCompare(String(x.competencia)) || String(x.conta).localeCompare(String(y.conta)))
    .slice(0, 40);

  return (
    <div className="aloj-pilha">
      <div className="aloj-card">
        <div className="aloj-card-h">
          <h3><Receipt size={15} /> Controle de pagamentos</h3>
          <div className="aloj-acoes">
            <label className="aloj-inline" htmlFor="aloj-ano">
              Ano
              <select id="aloj-ano" value={ano} onChange={(e) => setAno(+e.target.value)}>
                {anos.map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            <button type="button" className="aloj-btn pequeno primario" onClick={() => acoes.novoPagamento({ alojamento_id: a.id })}>
              <Plus size={14} /> Lançar pagamento
            </button>
          </div>
        </div>
        <div className="aloj-card-b">
          {contas.length ? (
            <div className="aloj-tab-scroll">
              <table className="aloj-mx">
                <thead>
                  <tr>
                    <th className="rowh">Conta</th>
                    {comps.map((m) => <th key={m} className={m === atual ? 'cur' : ''}>{MES3[+m.slice(5) - 1]}</th>)}
                    <th className="tot">Total {ano}</th>
                  </tr>
                </thead>
                <tbody>
                  {contas.map((c) => (
                    <tr key={c}>
                      <th className="rowh">{c}</th>
                      {comps.map((m) => (
                        <td key={m} className={m === atual ? 'cur' : ''}>
                          <CelulaPagamento base={base} aid={a.id} conta={c} comp={m} esperada={esperado(a, c, m, base)} acoes={acoes} />
                        </td>
                      ))}
                      <td className="tot">{totConta(c) ? money(totConta(c)) : <Nil />}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th className="rowh">Total do mês</th>
                    {comps.map((m) => <td key={m} className={m === atual ? 'cur' : ''}>{totMes(m) ? moneyCurto(totMes(m)) : ''}</td>)}
                    <td className="tot">{money(contas.reduce((s, c) => s + totConta(c), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : <Vazio titulo="Nenhuma conta controlada" texto="Edite o cadastro e marque as contas que entram no controle mensal." />}
          <LegendaPagamentos>“a lançar” = conta controlada sem lançamento · Manutenção aceita vários lançamentos no mês</LegendaPagamentos>
        </div>
      </div>

      <div className="aloj-card">
        <div className="aloj-card-h">
          <h3><Clock size={15} /> Lançamentos</h3>
          <span className="aloj-muted aloj-pequeno">
            {lista.length < pags.length ? `40 mais recentes de ${pags.length}` : plural(pags.length, 'lançamento')}
          </span>
        </div>
        <div className="aloj-card-b">
          {lista.length ? (
            <div className="aloj-tab-scroll">
              <table className="aloj-tab">
                <thead>
                  <tr><th>Competência</th><th>Conta</th><th className="r">Valor</th><th>Pagamento</th><th>Situação</th><th>Fatura</th><th>Observação</th><th className="acao" /></tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id}>
                      <td><b>{compLabel(p.competencia)}</b>{p.vencimento && <small>vence {fdate(p.vencimento)}</small>}</td>
                      <td>{p.conta}{p.fornecedor && <small>{p.fornecedor}</small>}</td>
                      <td className="r">{num(p.valor) !== null ? money(p.valor) : <Nil />}</td>
                      <td>{fdate(p.data_pagamento) || <Nil />}{p.forma && <small>{p.forma}</small>}</td>
                      <td><PillPagamento p={p} /></td>
                      <td><AnexosCompactos lista={p.anexos} onErro={acoes.avisar} vazio={<Nil />} /></td>
                      <td>{p.obs || <Nil />}</td>
                      <td className="acao">
                        <button type="button" className="aloj-mini" title="Editar" aria-label="Editar pagamento" onClick={() => acoes.editarPagamento(p)}><Pencil size={14} /></button>
                        <button type="button" className="aloj-mini" title="Excluir" aria-label="Excluir pagamento" onClick={() => acoes.excluirPagamento(p)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Vazio titulo="Nenhum pagamento lançado" texto="Use o quadro acima ou o botão Lançar pagamento." />}
        </div>
      </div>
    </div>
  );
}
