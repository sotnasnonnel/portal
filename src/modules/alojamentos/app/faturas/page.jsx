import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Building2, Calendar, Clock, Download, Droplet, FileCheck2, FileText, Filter, Flame, Home, Lock, Pencil, Plus, Receipt,
  Sofa, Upload, Wifi, Wrench, X, Zap,
} from 'lucide-react';
import { useBase } from '../../lib/useBase';
import {
  ATALHOS_FATURA, CONF, CONTAS, FAT0, alojs, byId, compLabel, curComp, daysUntil, fatChip, fatChipOn, fatFiltrar,
  fdate, filtroAtivo, local, money, num, operando, plural, resumoFaturas, todayISO, vencida,
} from '../../lib/regras';
import { exportarFaturas } from '../../lib/exportar';
import { rotaFicha } from '../components/nav';
import { useAcoes } from '../components/useAcoes';
import Dialogos from '../components/Dialogos';
import { AnexosCompactos } from '../components/Anexos';
import { CelulaConferencia } from '../components/Conferencia';
import {
  Barra, Carga, Kpi, Nil, PillPagamento, SubnavPagamentos, Vazio,
} from '../components/Ui';

const ICONE_CONTA = {
  Aluguel: Home, 'Condomínio': Building2, IPTU: FileText, 'Água': Droplet, Energia: Zap, Internet: Wifi, 'Gás': Flame, Faxina: Sofa,
  'Manutenção': Wrench, 'Caução': Lock,
};

// O alerta do Início e o link "Conferir faturas desta competência" abrem a tela
// já filtrada (?atalho= / ?comp=). Daí em diante o filtro é só estado da tela.
function filtroInicial(params, hoje) {
  const atalho = params.get('atalho');
  const comp = params.get('comp');
  if (atalho) return fatChip(FAT0(), atalho, hoje, true);
  if (comp) return { ...FAT0(), comp };
  return { ...FAT0(), comp: curComp(hoje) };
}

function SituacaoVencimento({ p, hoje }) {
  if (!p.vencimento) return null;
  const d = daysUntil(p.vencimento, hoje);
  if (vencida(p, hoje)) return <small className="t-bad">vencida há {plural(-d, 'dia')}</small>;
  if (p.status !== 'pago' && d <= 3) return <small className="t-warn">{d === 0 ? 'vence hoje' : `vence em ${plural(d, 'dia')}`}</small>;
  return null;
}

function Linha({
  p, base, acoes, hoje,
}) {
  const a = byId(base, p.alojamento_id);
  const Icone = ICONE_CONTA[p.conta] || Receipt;
  return (
    <tr className={vencida(p, hoje) ? 'late' : ''}>
      <td><b>{fdate(p.vencimento) || <Nil />}</b><SituacaoVencimento p={p} hoje={hoje} /></td>
      <td>{compLabel(p.competencia)}</td>
      <td>
        <Link to={rotaFicha(a.id, 'pagamentos')}><b>{a.nome}</b></Link>
        <small>{[a.centro_custo, a.cnpj_locacao].filter(Boolean).join(' · ') || local(a)}</small>
      </td>
      <td>
        <b className="aloj-ic-txt"><Icone size={14} aria-hidden="true" /> {p.conta}</b>
        {(p.fornecedor || p.documento) && <small>{[p.fornecedor, p.documento && `Doc. ${p.documento}`].filter(Boolean).join(' · ')}</small>}
      </td>
      <td className="r"><b>{num(p.valor) !== null ? money(p.valor) : <Nil />}</b></td>
      <td>
        <PillPagamento p={p} />
        {p.data_pagamento && <small>em {fdate(p.data_pagamento)}{p.forma ? ` · ${p.forma}` : ''}</small>}
      </td>
      <td>
        <AnexosCompactos
          lista={p.anexos}
          onErro={acoes.avisar}
          vazio={(
            <>
              <span className="aloj-muted">Sem fatura</span>
              <button type="button" className="aloj-link aloj-pequeno" onClick={() => acoes.editarPagamento(p)}><Upload size={13} /> Anexar</button>
            </>
          )}
        />
      </td>
      <td><CelulaConferencia p={p} /></td>
      <td className="acao">
        <button type="button" className="aloj-btn pequeno" onClick={() => acoes.conferir(p)}><FileCheck2 size={14} /> Conferir</button>
        <button type="button" className="aloj-mini" title="Editar lançamento" aria-label="Editar lançamento" onClick={() => acoes.editarPagamento(p)}><Pencil size={14} /></button>
      </td>
    </tr>
  );
}

function Conteudo({
  base, acoes, f, setF, hoje,
}) {
  const lista = fatFiltrar(base, f, hoje);
  const r = resumoFaturas(lista, hoje);
  const alo = alojs(base, (a) => operando(a) || base.pagamentos.some((p) => p.alojamento_id === a.id));
  const mudar = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const n = lista.length;
  const titulo = [
    plural(n, 'lançamento'),
    f.comp && `competência ${compLabel(f.comp)}`,
    (f.de || f.ate) && `vencimento ${f.de ? `de ${fdate(f.de)}` : ''} ${f.ate ? `até ${fdate(f.ate)}` : ''}`.trim(),
  ].filter(Boolean).join(' · ');
  const rotuloAtalho = (k, l) => (k === 'mes' ? `Vencimento em ${compLabel(f.comp || curComp(hoje))}` : l);

  return (
    <>
      <div className="aloj-card aloj-card-b">
        <div className="aloj-fgrid4">
          <div className="aloj-campo">
            <label htmlFor="fat-comp">Mês de referência (competência)</label>
            <div className="aloj-inrow">
              <input type="month" id="fat-comp" value={f.comp} onChange={mudar('comp')} />
              {f.comp && <button type="button" className="aloj-mini" title="Todos os meses" aria-label="Limpar mês" onClick={() => setF({ ...f, comp: '' })}><X size={14} /></button>}
            </div>
          </div>
          <div className="aloj-campo">
            <label htmlFor="fat-de">Vencimento de</label>
            <input type="date" id="fat-de" value={f.de} onChange={mudar('de')} />
          </div>
          <div className="aloj-campo">
            <label htmlFor="fat-ate">Vencimento até</label>
            <input type="date" id="fat-ate" value={f.ate} onChange={mudar('ate')} />
          </div>
          <div className="aloj-campo">
            <label htmlFor="fat-q">Buscar</label>
            <input id="fat-q" value={f.q} onChange={mudar('q')} placeholder="Fornecedor, nº do documento, alojamento…" autoComplete="off" />
          </div>
          <div className="aloj-campo">
            <label htmlFor="fat-aloj">Alojamento</label>
            <select id="fat-aloj" value={f.aloj} onChange={mudar('aloj')}>
              <option value="">Todos</option>
              {alo.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div className="aloj-campo">
            <label htmlFor="fat-conta">Conta</label>
            <select id="fat-conta" value={f.conta} onChange={mudar('conta')}>
              <option value="">Todas</option>
              {CONTAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="aloj-campo">
            <label htmlFor="fat-sit">Pagamento</label>
            <select id="fat-sit" value={f.sit} onChange={mudar('sit')}>
              <option value="">Todos</option>
              <option value="apagar">A pagar (pendente ou agendado)</option>
              <option value="pago">Pagos</option>
              <option value="vencidas">Vencidos sem pagamento</option>
            </select>
          </div>
          <div className="aloj-campo">
            <label htmlFor="fat-conf">Conferência</label>
            <select id="fat-conf" value={f.conf} onChange={mudar('conf')}>
              <option value="">Todas</option>
              <option value="pendente">{CONF.pendente.l}</option>
              <option value="conferida">Conferidas</option>
              <option value="divergencia">Com divergência</option>
            </select>
          </div>
        </div>
        <div className="aloj-atalhos">
          <span className="rot"><Filter size={14} /> Atalhos</span>
          <div className="aloj-seg">
            {ATALHOS_FATURA.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={fatChipOn(f, k, hoje)} onClick={() => setF(fatChip(f, k, hoje))}>{rotuloAtalho(k, l)}</button>
            ))}
          </div>
          <label className="aloj-inline" htmlFor="fat-anexo">
            Fatura
            <select id="fat-anexo" value={f.anexo} onChange={mudar('anexo')}>
              <option value="">com e sem anexo</option>
              <option value="com">anexada</option>
              <option value="sem">não anexada</option>
            </select>
          </label>
          {filtroAtivo(f) && (
            <button type="button" className="aloj-link fim" onClick={() => setF(FAT0())}><X size={14} /> Limpar filtros</button>
          )}
        </div>
      </div>

      <div className="aloj-kpis aloj-mt">
        <Kpi rotulo="Lançamentos no filtro" Icon={Receipt} valor={n} sub={`${r.comAnexo} com fatura anexada`}>
          <Barra pct={n ? (r.comAnexo / n) * 100 : 0} />
        </Kpi>
        <Kpi rotulo="Valor total" Icon={Calendar} valor={money(r.total) || 'R$ 0,00'} sub={r.semValor ? `${r.semValor} sem valor informado` : 'soma do filtro'} />
        <Kpi rotulo="Conferidas" Icon={FileCheck2} valor={<>{r.conferidas}<small> / {n}</small></>} sub={`${n - r.conferidas - r.divergencias} a conferir`}>
          <Barra pct={n ? (r.conferidas / n) * 100 : 0} tom="teal" />
        </Kpi>
        <Kpi rotulo="Divergências" Icon={AlertTriangle} valor={r.divergencias} sub={r.divergencias ? 'verificar com o Administrativo' : 'nenhuma registrada'} />
        <Kpi rotulo="Vencidas sem pagamento" Icon={Clock} valor={r.vencidas} sub={r.vencidas ? money(r.valorVencido) : 'nenhuma em atraso'} />
      </div>

      <div className="aloj-card aloj-mt">
        <div className="aloj-card-h"><h3><FileCheck2 size={15} /> {titulo}</h3></div>
        <div className="aloj-card-b">
          {n ? (
            <div className="aloj-tab-scroll">
              <table className="aloj-tab">
                <thead>
                  <tr>
                    <th>Vencimento</th><th>Competência</th><th>Alojamento</th><th>Conta / fornecedor</th><th className="r">Valor</th>
                    <th>Pagamento</th><th>Fatura</th><th>Conferência</th><th className="acao" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => <Linha key={p.id} p={p} base={base} acoes={acoes} hoje={hoje} />)}
                </tbody>
                <tfoot><tr><td colSpan={4}>Total do filtro</td><td className="r">{money(r.total)}</td><td colSpan={4} /></tr></tfoot>
              </table>
            </div>
          ) : (
            <Vazio
              titulo="Nenhuma fatura neste filtro"
              texto={filtroAtivo(f) ? 'Ajuste o mês, o vencimento ou limpe os filtros.' : 'Lance um pagamento com a fatura anexada para começar.'}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default function FaturasAlojamentos() {
  const { base, carregando, erro, recarregar } = useBase();
  const acoes = useAcoes({ base, recarregar });
  const [params] = useSearchParams();
  const hoje = todayISO();
  const [f, setF] = useState(() => filtroInicial(params, hoje));
  const [exportando, setExportando] = useState(false);

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarFaturas(base, fatFiltrar(base, f, hoje), f);
    } catch (e) {
      acoes.avisar(`Não foi possível gerar a planilha: ${e.message}`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="aloj-page larga">
      <div className="aloj-head">
        <div>
          <h1>Faturas</h1>
          <p>Conferência das faturas pelo Contas a Pagar: filtre por competência ou vencimento, abra a fatura e registre a conferência</p>
        </div>
        <div className="aloj-acoes">
          <button type="button" className="aloj-btn" onClick={exportar} disabled={exportando || carregando}><Download size={14} /> {exportando ? 'Gerando…' : 'Exportar lista'}</button>
          <button type="button" className="aloj-btn primario" onClick={() => acoes.novaFatura({ competencia: f.comp || curComp(hoje) })}><Plus size={14} /> Lançar fatura</button>
        </div>
      </div>
      <SubnavPagamentos atual="faturas" />
      <Carga carregando={carregando} erro={erro}>
        <Conteudo base={base} acoes={acoes} f={f} setF={setF} hoje={hoje} />
      </Carga>
      <Dialogos acoes={acoes} />
    </div>
  );
}
