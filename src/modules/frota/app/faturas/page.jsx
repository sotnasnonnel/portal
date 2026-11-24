import { useMemo, useState } from 'react';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Clock, Download, FileText, Info, Plus, Sparkles, X,
} from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useFrota } from '../components/FrotaContext';
import Confirmar from '../components/Confirmar';
import {
  Busca, Chip, Esqueleto, Estado, Hbars, Kpi, LinhaVazia, PageHead, Pill, Placa, Secao, Selecao,
} from '../components/Pecas';
import {
  compLabel, compLong, daysUntil, groupSum, isNum, sum, todayISO, uniq,
} from '../../lib/regras';
import {
  FAT_STATUS, agendaDePagamentos, difRelevante, faturasDoMes, fatDif, fatTone, fatVenc, filtrarFaturas,
  gerarFaturasPrevistas, mesVizinho, ordenarFaturas, resumoFaturas, veiculosParaFatura,
} from '../../lib/faturas';
import {
  decZ, fmtDate, linhaClicavel, money,
} from '../../lib/formato';
import { fmtDec } from '../../lib/schemas';
import { COLS_FAT } from '../../lib/relatorios';
import { exportarLinhas } from '../../lib/exportar';
import { inserirVarios, urlDoAnexo } from '../../lib/frota';

const CHAVES_FILTRO = ['q', 'de', 'ate', 'status', 'locadora', 'placa', 'venc'];
const mesAtual = () => todayISO().slice(0, 7);

/** Até 3 documentos com o tipo ("Fatura", "Boleto"…) e "+N" para o resto. */
function Documentos({ anexos, toast }) {
  const lista = anexos || [];
  if (!lista.length) return <span className="frota-muted">—</span>;
  const abrir = async (e, a) => {
    e.stopPropagation();
    try {
      window.open(await urlDoAnexo(a.path), '_blank', 'noopener');
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  return (
    <span className="frota-docs">
      {lista.slice(0, 3).map((a) => (
        <button key={a.path} type="button" className="frota-doc-link" onClick={(e) => abrir(e, a)} title={a.nome}>
          {String(a.tipo_doc || a.nome || 'Arquivo').split(/\s+/)[0]}
        </button>
      ))}
      {lista.length > 3 && <span className="frota-muted">+{lista.length - 3}</span>}
    </span>
  );
}

export default function FaturasFrota() {
  const {
    dados, ctx, carregando, ausentes, filtros, setFiltro, limparFiltros, abrirDetalhe, abrirForm, podeEscrever, toast,
    recarregar,
  } = useFrota();
  const f = filtros.faturas;
  const set = (patch) => setFiltro('faturas', patch);
  const fs = dados.faturas;
  const semTabela = ausentes.includes('faturas');
  const [gerar, setGerar] = useState(null);

  const doMes = useMemo(() => faturasDoMes(fs, f), [fs, f]);
  const rows = useMemo(() => ordenarFaturas(filtrarFaturas(fs, f), f.ord), [fs, f]);
  const r = resumoFaturas(rows);
  const algumFiltro = CHAVES_FILTRO.some((k) => f[k]);
  const ativos = veiculosParaFatura(dados.veiculos);
  const modeloDe = (placa) => (dados.veiculos.find((v) => v.placa === placa) || {}).modelo || '';
  const semDia = dados.veiculos.filter((v) => v.status === 'Ativo' && v.placa && !isNum(v.dia_vencimento_fatura)).length;
  const abertasSemVenc = fs.filter((x) => !['Paga', 'Cancelada'].includes(x.status) && !x.vencimento).length;
  const rotuloMes = f.mes ? compLabel(f.mes) : 'todas';

  const agenda = agendaDePagamentos(rows).map((x) => ({
    l: `${fmtDate(x.l)}${daysUntil(x.l) < 0 ? ' · vencida' : ''}`, v: x.v,
  }));
  const porLocadora = groupSum(rows, (x) => x.locadora, (x) => x.valor, 6).map((g) => ({
    ...g, t: `${rows.filter((x) => (x.locadora || 'Não informado') === g.l).length} fatura(s)`,
  }));

  const nova = () => abrirForm('faturas', null, {
    competencia: f.mes || mesAtual(),
    tipo: 'Locação mensal',
    status: 'Aguardando conferência',
    placa: f.placa && ativos.some((v) => v.placa === f.placa) ? f.placa : '',
  });
  const exportar = () => exportarLinhas({
    base: `faturas-veiculos${f.mes ? `-${f.base === 'ref' ? 'ref' : 'venc'}-${f.mes}` : ''}`,
    cols: COLS_FAT, rows, aba: 'Faturas', ctx,
  }).catch((e) => toast(e.message, 'err'));

  const pedirGerar = () => setGerar(gerarFaturasPrevistas(f.mes, dados));
  const confirmarGerar = async () => {
    try {
      await inserirVarios('faturas', gerar.todo);
      await recarregar(['faturas']);
      toast(`${gerar.todo.length} faturas previstas criadas para ${compLabel(f.mes)}`);
      setGerar(null);
    } catch (e) {
      toast(e.message, 'err');
    }
  };
  let textoGerar = '';
  if (gerar) {
    textoGerar = gerar.todo.length
      ? `Serão criadas ${gerar.todo.length} faturas “Prevista” (locação mensal), com vencimento no dia cadastrado em cada veículo e valor estimado pelo contrato.${gerar.ja ? ` ${gerar.ja} veículo(s) já têm fatura de locação com vencimento neste mês e foram ignorados.` : ''}${gerar.sem ? ` ${gerar.sem} veículo(s) ativo(s) estão sem dia de vencimento cadastrado e ficaram de fora.` : ''}`
      : `Nenhuma fatura a gerar: ${gerar.sem ? `${gerar.sem} veículo(s) ativo(s) estão sem “dia de vencimento da fatura” no cadastro` : 'todos os veículos já têm fatura de locação neste mês'}.`;
  }

  return (
    <div className="frota-page frota-stack">
      <PageHead
        Icon={FileText}
        titulo="Faturas de veículos"
        sub="Faturas das locadoras por veículo, para conferência e pagamento pelo Contas a Pagar. Lance a fatura escolhendo um veículo ativo, anexe o PDF e acompanhe vencimento e conferência."
      >
        <button type="button" className="frota-btn" onClick={exportar}><Download size={15} /> Exportar</button>
        {podeEscrever && !semTabela && f.mes && (
          <button type="button" className="frota-btn" onClick={pedirGerar}><Sparkles size={15} /> Gerar faturas de {compLabel(f.mes)}</button>
        )}
        {podeEscrever && !semTabela && (
          <button type="button" className="frota-btn primary" onClick={nova}><Plus size={15} /> Nova fatura</button>
        )}
      </PageHead>
      <Estado />
      {semTabela && (
        <div className="frota-note warn" role="alert">
          <Info size={16} aria-hidden="true" />
          <span>A tabela de faturas ainda não existe no banco. Falta aplicar supabase_migration_frota_faturas.sql; o resto da Frota funciona normalmente.</span>
        </div>
      )}

      <div className="frota-card frota-mesbar">
        <button type="button" className="frota-ibtn" onClick={() => set({ mes: mesVizinho(f.mes, -1) })} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
        <div className="frota-mesbar-t">
          <span className="frota-lbl">{f.base === 'ref' ? 'Mês de referência' : 'Mês de vencimento'}</span>
          <strong>{f.mes ? compLong(f.mes) : 'Todos os meses'}</strong>
        </div>
        <button type="button" className="frota-ibtn" onClick={() => set({ mes: mesVizinho(f.mes, 1) })} aria-label="Próximo mês"><ChevronRight size={16} /></button>
        <div className="frota-seg" role="group" aria-label="Base do mês">
          <button type="button" className={f.base !== 'ref' ? 'on' : ''} aria-pressed={f.base !== 'ref'} onClick={() => set({ base: 'venc' })}>Por vencimento</button>
          <button type="button" className={f.base === 'ref' ? 'on' : ''} aria-pressed={f.base === 'ref'} onClick={() => set({ base: 'ref' })}>Por referência</button>
        </div>
        <input type="month" className="frota-inp" aria-label="Escolher mês" value={f.mes} onChange={(e) => set({ mes: e.target.value })} />
        {f.mes
          ? <Chip onClick={() => set({ mes: '' })}>Todos os meses</Chip>
          : <Chip onClick={() => set({ mes: mesAtual() })}>Mês atual</Chip>}
      </div>

      <div className="frota-kpis compacto">
        <Kpi destaque label={`Faturas · ${rotuloMes}`} valor={rows.length} sub={money(sum(rows, 'valor'))} />
        <Kpi label="Vencidas" valor={r.vencidas.length} sub={money(sum(r.vencidas, 'valor'))} tone={r.vencidas.length ? 'crit' : 'ok'} onClick={() => set({ venc: 'vencidas' })} />
        <Kpi label="Vencem em até 2 dias" valor={r.ate2.length} sub={money(sum(r.ate2, 'valor'))} tone={r.ate2.length ? 'crit' : ''} onClick={() => set({ venc: '2d' })} />
        <Kpi label="Vencem em 3 a 7 dias" valor={r.ate7.length} sub={money(sum(r.ate7, 'valor'))} tone={r.ate7.length ? 'warn' : ''} onClick={() => set({ venc: '7d' })} />
        <Kpi label="Aguardando conferência" valor={r.aguardando.length} sub={money(sum(r.aguardando, 'valor'))} tone={r.aguardando.length ? 'warn' : 'ok'} onClick={() => set({ status: 'Aguardando conferência' })} />
        <Kpi label="Com divergência" valor={r.divergencia.length} sub={money(sum(r.divergencia, 'valor'))} tone={r.divergencia.length ? 'crit' : 'ok'} onClick={() => set({ status: 'Divergência' })} />
        <Kpi label="Pagas" valor={r.pagas.length} sub={money(sum(r.pagas, 'valor'))} onClick={() => set({ status: 'Paga' })} />
      </div>

      <div className="frota-card frota-stack">
        <div className="frota-filters">
          <Busca id="ff-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Nº da fatura, placa, condutor, contrato ou CT" />
          <div className="frota-fld">
            <label htmlFor="ff-de">Vencimento de</label>
            <input id="ff-de" type="date" className="frota-inp" value={f.de} onChange={(e) => set({ de: e.target.value })} />
          </div>
          <div className="frota-fld">
            <label htmlFor="ff-ate">Vencimento até</label>
            <input id="ff-ate" type="date" className="frota-inp" value={f.ate} onChange={(e) => set({ ate: e.target.value })} />
          </div>
          <Selecao id="ff-loc" label="Locadora" opcoes={uniq(fs.map((x) => x.locadora))} valor={f.locadora} onChange={(locadora) => set({ locadora })} todos="Todas" />
          <Selecao id="ff-pl" label="Veículo" opcoes={uniq([...ativos.map((v) => v.placa), ...fs.map((x) => x.placa)])} valor={f.placa} onChange={(placa) => set({ placa })} />
          <div className="frota-fld">
            <label htmlFor="ff-ord">Ordenar por vencimento</label>
            <select id="ff-ord" className="frota-inp" value={f.ord} onChange={(e) => set({ ord: e.target.value })}>
              <option value="asc">Crescente ↑</option>
              <option value="desc">Decrescente ↓</option>
            </select>
          </div>
        </div>
        <div className="frota-chips">
          <Chip ativo={f.status === ''} onClick={() => set({ status: '' })}>Qualquer situação</Chip>
          {FAT_STATUS.map((s) => (
            <Chip key={s} ativo={f.status === s} onClick={() => set({ status: s })} contagem={doMes.filter((x) => x.status === s).length}>{s}</Chip>
          ))}
          <span className="sep" aria-hidden="true" />
          <Chip ativo={f.venc === ''} onClick={() => set({ venc: '' })}>Qualquer vencimento</Chip>
          <Chip ativo={f.venc === 'vencidas'} onClick={() => set({ venc: 'vencidas' })}>Vencidas</Chip>
          <Chip ativo={f.venc === '2d'} onClick={() => set({ venc: '2d' })}>Até 2 dias</Chip>
          <Chip ativo={f.venc === '7d'} onClick={() => set({ venc: '7d' })}>3 a 7 dias</Chip>
          <Chip ativo={f.venc === 'sem'} onClick={() => set({ venc: 'sem' })} contagem={fs.filter((x) => !x.vencimento).length}>Sem vencimento</Chip>
          {algumFiltro && <Chip onClick={() => limparFiltros('faturas')}><X size={13} aria-hidden="true" /> Limpar filtros</Chip>}
        </div>
      </div>

      {abertasSemVenc > 0 && (
        <div className="frota-note warn">
          <Info size={16} aria-hidden="true" />
          <span>{abertasSemVenc} fatura(s) em aberto sem data de vencimento — ficam fora do mês e dos alertas.</span>
          <button type="button" className="frota-btn sm" onClick={() => set({ mes: '', venc: 'sem' })}>Mostrar e completar</button>
        </div>
      )}
      {podeEscrever && f.mes && semDia > 0 && (
        <div className="frota-note warn">
          <Info size={16} aria-hidden="true" />
          <span>{semDia} veículo(s) ativo(s) sem “dia de vencimento da fatura” no cadastro — informe em Veículos › Editar para que as faturas previstas sejam geradas todo mês.</span>
        </div>
      )}

      {carregando ? <Esqueleto /> : (
        <TableScroll className="frota-tbl">
          <table className="frota-t">
            <thead>
              <tr>
                <th>
                  <button type="button" className="frota-th-sort" onClick={() => set({ ord: f.ord === 'desc' ? 'asc' : 'desc' })}>
                    Vencimento {f.ord === 'desc' ? '↓' : '↑'}
                  </button>
                </th>
                <th>Veículo</th><th>Locadora / fatura</th><th>Referência</th><th>Condutor / CT</th><th>Tipo</th>
                <th className="n">Valor R$</th><th className="n">Previsto R$</th><th>Conferência</th><th>Documentos</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((x) => {
                const vs = fatVenc(x);
                const dif = fatDif(x);
                const aberta = !['Paga', 'Cancelada'].includes(x.status);
                let Icone = null;
                if (aberta && vs.lvl >= 2) Icone = AlertTriangle;
                else if (aberta && vs.lvl === 1) Icone = Clock;
                return (
                  <tr key={x.id} className={`frota-click ${aberta && vs.lvl ? `lv${vs.lvl}` : ''}`} {...linhaClicavel(() => abrirDetalhe('faturas', x.id))}>
                    <td>
                      <div className="p">{x.vencimento ? fmtDate(x.vencimento) : '—'}</div>
                      <div className="s"><Pill tone={vs.tone}>{Icone && <Icone size={11} aria-hidden="true" />} {vs.label}</Pill></div>
                    </td>
                    <td><div className="frota-cellv"><Placa placa={x.placa} /><div className="s">{modeloDe(x.placa)}</div></div></td>
                    <td>{x.locadora || '—'}<div className="s">{x.numero_fatura ? `Nº ${x.numero_fatura}` : 'sem nº'}{x.contrato ? ` · contr. ${x.contrato}` : ''}</div></td>
                    <td>{compLabel(x.competencia)}{x.emissao && <div className="s">emitida {fmtDate(x.emissao)}</div>}</td>
                    <td><div className="p">{x.condutor || '—'}</div><div className="s">{x.ct || ''}{x.custo_resp ? ` · ${x.custo_resp}` : ''}</div></td>
                    <td>{x.tipo || '—'}</td>
                    <td className="n">
                      <b>{decZ(x.valor)}</b>
                      {x.status === 'Prevista' && <div className="s">estimado</div>}
                    </td>
                    <td className="n">
                      {decZ(x.valor_previsto)}
                      {dif ? <div className={`s ${difRelevante(dif) ? 'dif' : ''}`}>{dif > 0 ? '+' : ''}{fmtDec.format(dif)}</div> : null}
                    </td>
                    <td>
                      <Pill tone={fatTone(x.status)}>{x.status}</Pill>
                      {x.conferido_em && <div className="s">{x.conferido_por_nome ? `${x.conferido_por_nome} · ` : ''}{fmtDate(String(x.conferido_em).slice(0, 10))}</div>}
                    </td>
                    <td><Documentos anexos={x.anexos} toast={toast} /></td>
                  </tr>
                );
              }) : (
                <LinhaVazia
                  colunas={10}
                  titulo={fs.length ? `Nenhuma fatura em ${f.mes ? compLong(f.mes) : 'nenhum mês'} com esses filtros` : 'Nenhuma fatura lançada'}
                  sub={fs.length ? 'Troque o mês no seletor acima ou limpe os filtros.' : (podeEscrever && !semTabela ? 'Use “Nova fatura” e escolha um veículo ativo.' : '')}
                />
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6}>{rows.length} fatura(s)</td>
                  <td className="n">{decZ(sum(rows, 'valor'))}</td>
                  <td className="n">{decZ(sum(rows, 'valor_previsto'))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </TableScroll>
      )}
      <div className="frota-grid g2">
        <Secao titulo={`Agenda de pagamentos · ${f.mes ? compLabel(f.mes) : 'todos os meses'}`} nota="faturas em aberto, por vencimento">
          <Hbars itens={agenda} fmt={money} />
        </Secao>
        <Secao titulo="Valor por locadora" nota="faturas do filtro">
          <Hbars itens={porLocadora} fmt={money} />
        </Secao>
      </div>
      {gerar && (
        <Confirmar
          titulo={`Gerar faturas previstas de ${compLong(f.mes)}`}
          texto={textoGerar}
          ok={gerar.todo.length ? `Gerar ${gerar.todo.length} faturas` : 'Fechar'}
          onOk={gerar.todo.length ? confirmarGerar : async () => setGerar(null)}
          onFechar={() => setGerar(null)}
        />
      )}
    </div>
  );
}
