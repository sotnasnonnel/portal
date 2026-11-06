import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Building2, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileCheck2, Pencil, Plus, Receipt, Trash2,
} from 'lucide-react';
import { useBase } from '../../lib/useBase';
import {
  SEMPRE, STATUS, addMonths, alojs, byId, compLabel, compLong, contasDoQuadro, curComp, esperado, fdate, money, moneyCurto, num, operando, pagsDe, plural,
  resumoCompetencia,
} from '../../lib/regras';
import { rotaFaturas, rotaFicha } from '../components/nav';
import { useAcoes } from '../components/useAcoes';
import Dialogos from '../components/Dialogos';
import { AnexosCompactos } from '../components/Anexos';
import {
  Barra, Carga, CelulaPagamento, Kpi, LegendaPagamentos, Nil, PillPagamento, SubnavPagamentos, Vazio,
} from '../components/Ui';

const somaValor = (lista) => lista.reduce((s, p) => s + (num(p.valor) || 0), 0);

function Conteudo({ base, acoes, comp }) {
  const ops = alojs(base, operando);
  const doMes = base.pagamentos.filter((p) => p.competencia === comp);
  const contas = contasDoQuadro(ops.flatMap((a) => a.contas_controladas || []), doMes.map((p) => p.conta));
  const { exp, lanc, pend } = resumoCompetencia(base, comp);
  const total = somaValor(doMes);
  const semValor = doMes.filter((p) => num(p.valor) === null).length;
  const inativosComLancamento = alojs(base, (a) => !operando(a) && doMes.some((p) => p.alojamento_id === a.id));
  const linhas = [...ops, ...inativosComLancamento];
  const totAloj = (a) => somaValor(doMes.filter((p) => p.alojamento_id === a.id));
  const totConta = (c) => somaValor(doMes.filter((p) => p.conta === c));
  const nomeAloj = (p) => byId(base, p.alojamento_id).nome;
  const lista = doMes
    .filter((p) => byId(base, p.alojamento_id))
    .sort((x, y) => String(nomeAloj(x)).localeCompare(nomeAloj(y)) || String(x.conta).localeCompare(y.conta));

  return (
    <>
      <div className="aloj-kpis">
        <Kpi
          rotulo="Contas lançadas"
          Icon={CheckCircle2}
          valor={<>{lanc}<small> / {exp}</small></>}
          sub={`${exp ? Math.round((lanc / exp) * 100) : 0}% das contas controladas`}
        >
          <Barra pct={exp ? (lanc / exp) * 100 : 0} />
        </Kpi>
        <Kpi rotulo="A lançar" Icon={AlertTriangle} valor={exp - lanc} sub="contas controladas sem registro" />
        <Kpi rotulo="Pendentes / agendadas" Icon={Clock} valor={pend} sub="lançadas, ainda não pagas" />
        <Kpi
          rotulo="Valor lançado"
          Icon={Receipt}
          valor={money(total) || 'R$ 0,00'}
          sub={semValor ? `${plural(semValor, 'lançamento')} sem valor` : compLabel(comp)}
        />
        <Kpi rotulo="Alojamentos" Icon={Building2} valor={ops.length} sub="em operação nesta competência" />
      </div>

      <h2 className="aloj-sec">Quadro da competência</h2>
      <div className="aloj-card aloj-card-b">
        {ops.length ? (
          <div className="aloj-tab-scroll">
            <table className="aloj-mx">
              <thead>
                <tr>
                  <th className="rowh">Alojamento</th>
                  {contas.map((c) => <th key={c}>{c}</th>)}
                  <th className="tot">Total</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((a) => (
                  <tr key={a.id}>
                    <th className="rowh">
                      <Link to={rotaFicha(a.id, 'pagamentos')}>{a.nome}</Link>
                      {a.status !== 'ativo' && <small>{STATUS[a.status].l}</small>}
                    </th>
                    {contas.map((c) => {
                      const controlada = (a.contas_controladas || []).includes(c) || SEMPRE.includes(c);
                      const temLancamento = pagsDe(base, a.id, c, comp).length > 0;
                      return (
                        <td key={c}>
                          {controlada || temLancamento
                            ? <CelulaPagamento base={base} aid={a.id} conta={c} comp={comp} esperada={esperado(a, c, comp, base)} acoes={acoes} />
                            : <span className="nao-controlada">·</span>}
                        </td>
                      );
                    })}
                    <td className="tot">{totAloj(a) ? money(totAloj(a)) : <Nil />}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th className="rowh">Total</th>
                  {contas.map((c) => <td key={c}>{totConta(c) ? moneyCurto(totConta(c)) : ''}</td>)}
                  <td className="tot">{money(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : <Vazio titulo="Nenhum alojamento em operação" texto="Cadastre alojamentos ativos para controlar as contas." />}
        <LegendaPagamentos>Clique em uma célula para lançar ou editar · Manutenção aceita vários lançamentos no mês · “·” = conta não controlada no alojamento</LegendaPagamentos>
      </div>

      <h2 className="aloj-sec">
        Lançamentos de {compLabel(comp)}
        <Link className="aloj-link" to={rotaFaturas({ comp })}><FileCheck2 size={14} /> Conferir faturas desta competência</Link>
      </h2>
      <div className="aloj-card aloj-card-b">
        {lista.length ? (
          <div className="aloj-tab-scroll">
            <table className="aloj-tab">
              <thead>
                <tr><th>Alojamento</th><th>Conta</th><th className="r">Valor</th><th>Vencimento</th><th>Pagamento</th><th>Situação</th><th>Fatura</th><th>Observação</th><th className="acao" /></tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td><b>{nomeAloj(p)}</b></td>
                    <td>{p.conta}{p.fornecedor && <small>{p.fornecedor}</small>}</td>
                    <td className="r">{num(p.valor) !== null ? money(p.valor) : <Nil />}</td>
                    <td>{fdate(p.vencimento) || <Nil />}</td>
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
        ) : <Vazio titulo="Nenhum lançamento nesta competência" texto="Clique em uma célula do quadro para lançar." />}
      </div>
    </>
  );
}

export default function PagamentosAlojamentos() {
  const { base, carregando, erro, recarregar } = useBase();
  const acoes = useAcoes({ base, recarregar });
  const [comp, setComp] = useState(() => curComp());

  return (
    <div className="aloj-page larga">
      <div className="aloj-head">
        <div>
          <h1>Pagamentos</h1>
          <p>Contas fixas e manutenção por competência (mês/ano de referência), com valor e data de pagamento</p>
        </div>
        <div className="aloj-acoes">
          <div className="aloj-comp">
            <button type="button" className="aloj-mini" title="Mês anterior" aria-label="Mês anterior" onClick={() => setComp((c) => addMonths(c, -1))}><ChevronLeft size={15} /></button>
            <strong>{compLong(comp)}</strong>
            <button type="button" className="aloj-mini" title="Próximo mês" aria-label="Próximo mês" onClick={() => setComp((c) => addMonths(c, 1))}><ChevronRight size={15} /></button>
          </div>
          {comp !== curComp() && <button type="button" className="aloj-btn" onClick={() => setComp(curComp())}>Mês atual</button>}
          <button type="button" className="aloj-btn primario" onClick={() => acoes.novoPagamento({ competencia: comp })}><Plus size={14} /> Lançar pagamento</button>
        </div>
      </div>
      <SubnavPagamentos atual="pagamentos" />
      <Carga carregando={carregando} erro={erro}>
        <Conteudo base={base} acoes={acoes} comp={comp} />
      </Carga>
      <Dialogos acoes={acoes} />
    </div>
  );
}
