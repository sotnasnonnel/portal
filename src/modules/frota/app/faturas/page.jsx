import { useMemo } from 'react';
import {
  Download, FileText, Info, Paperclip, Plus, X,
} from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useFrota } from '../components/FrotaContext';
import {
  Busca, Chip, Esqueleto, Estado, Hbars, Kpi, LinhaVazia, PageHead, Pill, Placa, Secao, Selecao,
} from '../components/Pecas';
import {
  compLabel, daysUntil, groupSum, lastComp, sum, todayISO, uniq,
} from '../../lib/regras';
import {
  FAT_STATUS, agendaDePagamentos, difRelevante, fatDif, fatTone, fatVenc, filtrarFaturas, ordenarFaturas,
  resumoFaturas, veiculosParaFatura,
} from '../../lib/faturas';
import {
  decZ, fmtDate, linhaClicavel, money,
} from '../../lib/formato';
import { fmtDec } from '../../lib/schemas';
import { COLS_FAT } from '../../lib/relatorios';
import { exportarLinhas } from '../../lib/exportar';

const CHAVES_FILTRO = ['q', 'comp', 'mesVenc', 'de', 'ate', 'status', 'locadora', 'placa', 'venc'];

export default function FaturasFrota() {
  const {
    dados, ctx, carregando, ausentes, filtros, setFiltro, limparFiltros, abrirDetalhe, abrirForm, podeEscrever, toast,
  } = useFrota();
  const f = filtros.faturas;
  const set = (patch) => setFiltro('faturas', patch);
  const fs = dados.faturas;
  const semTabela = ausentes.includes('faturas');

  const rows = useMemo(() => ordenarFaturas(filtrarFaturas(fs, f)), [fs, f]);
  const r = resumoFaturas(rows);
  const algumFiltro = CHAVES_FILTRO.some((k) => f[k]);
  const ativos = veiculosParaFatura(dados.veiculos);
  const modeloDe = (placa) => (dados.veiculos.find((v) => v.placa === placa) || {}).modelo || '';

  const agenda = agendaDePagamentos(rows).map((x) => ({
    l: `${fmtDate(x.l)}${daysUntil(x.l) < 0 ? ' · vencida' : ''}`, v: x.v,
  }));
  const porLocadora = groupSum(rows, (x) => x.locadora, (x) => x.valor, 6).map((g) => ({
    ...g, t: `${rows.filter((x) => (x.locadora || 'Não informado') === g.l).length} fatura(s)`,
  }));

  const nova = () => abrirForm('faturas', null, {
    competencia: f.comp || lastComp(dados.mensal) || todayISO().slice(0, 7),
    tipo: 'Locação mensal',
    status: 'Aguardando conferência',
    placa: f.placa && ativos.some((v) => v.placa === f.placa) ? f.placa : '',
  });
  const exportar = () => exportarLinhas({
    base: `faturas-veiculos${f.comp ? `-${f.comp}` : ''}${f.mesVenc ? `-venc-${f.mesVenc}` : ''}`,
    cols: COLS_FAT, rows, aba: 'Faturas', ctx,
  }).catch((e) => toast(e.message, 'err'));

  return (
    <div className="frota-page frota-stack">
      <PageHead
        Icon={FileText}
        titulo="Faturas de veículos"
        sub="Faturas das locadoras por veículo, para conferência e pagamento pelo Contas a Pagar. Lance a fatura escolhendo um veículo ativo, anexe o PDF e acompanhe vencimento e conferência."
      >
        <button type="button" className="frota-btn" onClick={exportar}><Download size={15} /> Exportar</button>
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
      <div className="frota-kpis">
        <Kpi destaque label="Faturas no filtro" valor={rows.length} sub={money(sum(rows, 'valor'))} />
        <Kpi label="Aguardando conferência" valor={r.aguardando.length} sub={money(sum(r.aguardando, 'valor'))} tone={r.aguardando.length ? 'warn' : 'ok'} onClick={() => set({ status: 'Aguardando conferência' })} />
        <Kpi label="Com divergência" valor={r.divergencia.length} sub={money(sum(r.divergencia, 'valor'))} tone={r.divergencia.length ? 'crit' : 'ok'} onClick={() => set({ status: 'Divergência' })} />
        <Kpi label="Vencidas sem pagamento" valor={r.vencidas.length} sub={money(sum(r.vencidas, 'valor'))} tone={r.vencidas.length ? 'crit' : 'ok'} onClick={() => set({ venc: 'vencidas' })} />
        <Kpi label="Vencem em até 7 dias" valor={r.proximas.length} sub={money(sum(r.proximas, 'valor'))} tone={r.proximas.length ? 'warn' : ''} onClick={() => set({ venc: '7d' })} />
        <Kpi label="Pagas" valor={r.pagas.length} sub={money(sum(r.pagas, 'valor'))} onClick={() => set({ status: 'Paga' })} />
      </div>
      <div className="frota-card frota-stack">
        <div className="frota-filters">
          <Busca id="ff-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Nº da fatura, placa, condutor, contrato ou CT" />
          <div className="frota-fld">
            <label htmlFor="ff-comp">Mês de referência</label>
            <select id="ff-comp" className="frota-inp" value={f.comp} onChange={(e) => set({ comp: e.target.value })}>
              <option value="">Todos</option>
              {uniq(fs.map((x) => x.competencia)).reverse().map((c) => <option key={c} value={c}>{compLabel(c)}</option>)}
            </select>
          </div>
          <div className="frota-fld">
            <label htmlFor="ff-mv">Mês de vencimento</label>
            <input id="ff-mv" type="month" className="frota-inp" value={f.mesVenc} onChange={(e) => set({ mesVenc: e.target.value })} />
          </div>
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
        </div>
        <div className="frota-chips">
          <Chip ativo={f.status === ''} onClick={() => set({ status: '' })}>Qualquer situação</Chip>
          {FAT_STATUS.map((s) => (
            <Chip key={s} ativo={f.status === s} onClick={() => set({ status: s })} contagem={fs.filter((x) => x.status === s).length}>{s}</Chip>
          ))}
          <span className="sep" aria-hidden="true" />
          <Chip ativo={f.venc === ''} onClick={() => set({ venc: '' })}>Qualquer vencimento</Chip>
          <Chip ativo={f.venc === 'vencidas'} onClick={() => set({ venc: 'vencidas' })}>Vencidas</Chip>
          <Chip ativo={f.venc === '7d'} onClick={() => set({ venc: '7d' })}>Próximos 7 dias</Chip>
          <Chip ativo={f.venc === 'sem'} onClick={() => set({ venc: 'sem' })} contagem={fs.filter((x) => !x.vencimento).length}>Sem vencimento</Chip>
          {algumFiltro && <Chip onClick={() => limparFiltros('faturas')}><X size={13} aria-hidden="true" /> Limpar filtros</Chip>}
        </div>
      </div>
      {r.semVencimento.length > 0 && (
        <div className="frota-note warn">
          <Info size={16} aria-hidden="true" />
          <span>{r.semVencimento.length} fatura(s) em aberto sem data de vencimento: não aparecem nos filtros por vencimento. Abra cada uma e complete nº, emissão e vencimento.</span>
        </div>
      )}
      {carregando ? <Esqueleto /> : (
        <TableScroll className="frota-tbl">
          <table className="frota-t">
            <thead>
              <tr>
                <th>Vencimento</th><th>Referência</th><th>Veículo</th><th>Locadora / fatura</th><th>Condutor / CT</th><th>Tipo</th>
                <th className="n">Valor R$</th><th className="n">Previsto R$</th><th>Conferência</th><th aria-label="Anexos" />
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((x) => {
                const vs = fatVenc(x);
                const dif = fatDif(x);
                const anexos = (x.anexos || []).length;
                return (
                  <tr key={x.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('faturas', x.id))}>
                    <td><div className="p">{x.vencimento ? fmtDate(x.vencimento) : '—'}</div><div className="s"><Pill tone={vs.tone}>{vs.label}</Pill></div></td>
                    <td>{compLabel(x.competencia)}{x.emissao && <div className="s">emitida {fmtDate(x.emissao)}</div>}</td>
                    <td><div className="frota-cellv"><Placa placa={x.placa} /><div className="s">{modeloDe(x.placa)}</div></div></td>
                    <td>{x.locadora || '—'}<div className="s">{x.numero_fatura ? `Nº ${x.numero_fatura}` : 'sem nº'}{x.contrato ? ` · contr. ${x.contrato}` : ''}</div></td>
                    <td><div className="p">{x.condutor || '—'}</div><div className="s">{x.ct || ''}{x.custo_resp ? ` · ${x.custo_resp}` : ''}</div></td>
                    <td>{x.tipo || '—'}</td>
                    <td className="n"><b>{decZ(x.valor)}</b></td>
                    <td className="n">
                      {decZ(x.valor_previsto)}
                      {dif ? <div className={`s ${difRelevante(dif) ? 'dif' : ''}`}>{dif > 0 ? '+' : ''}{fmtDec.format(dif)}</div> : null}
                    </td>
                    <td>
                      <Pill tone={fatTone(x.status)}>{x.status}</Pill>
                      {x.conferido_em && <div className="s">{x.conferido_por_nome ? `${x.conferido_por_nome} · ` : ''}{fmtDate(String(x.conferido_em).slice(0, 10))}</div>}
                    </td>
                    <td>
                      {anexos
                        ? <Pill><Paperclip size={12} aria-label="Anexos" /> {anexos}</Pill>
                        : <span className="frota-muted" title="Sem fatura anexada"><Paperclip size={14} aria-label="Sem fatura anexada" /></span>}
                    </td>
                  </tr>
                );
              }) : (
                <LinhaVazia
                  colunas={10}
                  titulo={fs.length ? 'Nenhuma fatura com esses filtros' : 'Nenhuma fatura lançada'}
                  sub={fs.length ? 'Ajuste o mês ou o período de vencimento.' : (podeEscrever && !semTabela ? 'Use “Nova fatura” e escolha um veículo ativo.' : '')}
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
        <Secao titulo="Agenda de pagamentos" nota="faturas em aberto, por vencimento">
          <Hbars itens={agenda} fmt={money} />
        </Secao>
        <Secao titulo="Valor por locadora" nota="faturas do filtro">
          <Hbars itens={porLocadora} fmt={money} />
        </Secao>
      </div>
    </div>
  );
}
