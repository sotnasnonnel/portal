import { useMemo } from 'react';
import {
  Download, Paperclip, Pencil, Plus, ShieldCheck,
} from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useFrota } from '../components/FrotaContext';
import {
  Busca, Chip, Esqueleto, Estado, Kpi, LinhaVazia, PageHead, Pill, Placa,
} from '../components/Pecas';
import {
  conformidade, norm, ocsDe, sum,
} from '../../lib/regras';
import {
  fmtDate, iniciais, linhaClicavel, money,
} from '../../lib/formato';
import { COLS_COND } from '../../lib/relatorios';
import { exportarLinhas } from '../../lib/exportar';

export default function CondutoresFrota() {
  const {
    dados, cfg, ctx, carregando, filtros, setFiltro, abrirDetalhe, abrirForm, podeEscrever, toast,
  } = useFrota();
  const f = filtros.condutores;
  const set = (patch) => setFiltro('condutores', patch);
  const cs = dados.condutores;

  const rows = useMemo(() => {
    const q = norm(f.q);
    return cs
      .map((c) => ({ c, k: conformidade(c, dados.veiculos, cfg) }))
      .filter(({ c, k }) => (!f.sit || c.situacao === f.sit)
        && (!f.conf || (f.conf === 'pend' ? k.geral.lvl > 0 : k.geral.label === f.conf))
        && (!q || norm([c.nome, c.email, c.cnh_categoria, k.placaAtual, c.ct].join(' ')).includes(q)))
      .sort((a, b) => b.k.geral.lvl - a.k.geral.lvl || a.c.nome.localeCompare(b.c.nome, 'pt-BR'));
  }, [cs, dados.veiculos, cfg, f]);

  const at = cs.filter((c) => c.situacao === 'Ativo').map((c) => conformidade(c, dados.veiculos, cfg));
  const n = (l) => at.filter((k) => k.geral.label === l).length;

  const exportar = () => exportarLinhas({
    base: 'condutores-e-termos', cols: COLS_COND, rows: rows.map((x) => x.c), aba: 'Condutores', ctx,
  }).catch((e) => toast(e.message, 'err'));

  return (
    <div className="frota-page frota-stack">
      <PageHead
        Icon={ShieldCheck}
        titulo="Condutores e termos"
        sub={`CNH e termo de responsabilidade de cada motorista. O termo vale ${cfg.validade_termo_meses} meses e deve ser refeito na troca de veículo; alertas a partir de ${cfg.alerta_dias} dias do vencimento.`}
      >
        <button type="button" className="frota-btn" onClick={exportar}><Download size={15} /> Exportar</button>
        {podeEscrever && (
          <button type="button" className="frota-btn primary" onClick={() => abrirForm('condutores', null, { situacao: 'Ativo' })}><Plus size={15} /> Novo condutor</button>
        )}
      </PageHead>
      <Estado />
      <div className="frota-kpis">
        <Kpi destaque label="Condutores ativos" valor={at.length} sub={`${cs.length} no cadastro`} onClick={() => set({ conf: '' })} />
        <Kpi label="Regulares" valor={n('Regular')} sub="CNH válida e termo em dia" tone="ok" onClick={() => set({ conf: 'Regular' })} />
        <Kpi label="Atenção" valor={n('Atenção')} sub="vencimento próximo ou termo sem anexo" tone={n('Atenção') ? 'warn' : ''} onClick={() => set({ conf: 'Atenção' })} />
        <Kpi label="Irregulares" valor={n('Irregular')} sub="CNH vencida/ausente ou termo pendente" tone={n('Irregular') ? 'crit' : 'ok'} onClick={() => set({ conf: 'Irregular' })} />
      </div>
      <div className="frota-card frota-stack">
        <div className="frota-filters">
          <Busca id="cd-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Nome, e-mail, placa ou CT" />
        </div>
        <div className="frota-chips">
          <Chip ativo={f.sit === 'Ativo'} onClick={() => set({ sit: 'Ativo' })} contagem={cs.filter((c) => c.situacao === 'Ativo').length}>Ativos</Chip>
          <Chip ativo={f.sit === 'Inativo'} onClick={() => set({ sit: 'Inativo' })} contagem={cs.filter((c) => c.situacao === 'Inativo').length}>Inativos</Chip>
          <Chip ativo={f.sit === 'Desligado'} onClick={() => set({ sit: 'Desligado' })} contagem={cs.filter((c) => c.situacao === 'Desligado').length}>Desligados</Chip>
          <Chip ativo={f.sit === ''} onClick={() => set({ sit: '' })} contagem={cs.length}>Todos</Chip>
          <span className="frota-chip-sep" />
          <Chip ativo={f.conf === ''} onClick={() => set({ conf: '' })}>Qualquer situação</Chip>
          <Chip ativo={f.conf === 'pend'} onClick={() => set({ conf: 'pend' })}>Com pendência</Chip>
          <Chip ativo={f.conf === 'Regular'} onClick={() => set({ conf: 'Regular' })}>Regulares</Chip>
          <Chip ativo={f.conf === 'Irregular'} onClick={() => set({ conf: 'Irregular' })}>Irregulares</Chip>
        </div>
      </div>
      {carregando ? <Esqueleto /> : (
        <TableScroll className="frota-tbl">
          <table className="frota-t">
            <thead>
              <tr>
                <th>Condutor</th><th>Veículo atual</th><th>CNH</th><th>Termo de responsabilidade</th><th>Situação</th><th className="n">Ocorrências</th><th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map(({ c, k }) => {
                const oc = ocsDe(c.nome, dados.ocorrencias);
                return (
                  <tr key={c.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('condutores', c.id))}>
                    <td><div className="frota-cellv"><span className="frota-avatar">{iniciais(c.nome)}</span><div><div className="p">{c.nome}</div><div className="s">{c.email || c.situacao || ''}</div></div></div></td>
                    <td>{k.placaAtual ? <Placa placa={k.placaAtual} /> : <span className="frota-muted">—</span>}</td>
                    <td>
                      <Pill tone={k.cnh.tone}>{k.cnh.label}</Pill>
                      <div className="s">
                        {c.cnh_categoria ? `Cat. ${c.cnh_categoria} · ` : ''}{c.cnh_validade ? `val. ${fmtDate(c.cnh_validade)}` : 'sem validade'}
                        {c.cnh_arquivo && <> · <Paperclip size={11} aria-label="Com anexo" /></>}
                      </div>
                    </td>
                    <td>
                      <Pill tone={k.termo.tone}>{k.termo.label}</Pill>
                      <div className="s">
                        {c.termo_assinatura ? `assinado ${fmtDate(c.termo_assinatura)}` : 'não assinado'}{k.termoVal ? ` · até ${fmtDate(k.termoVal)}` : ''}
                        {c.termo_arquivo && <> · <Paperclip size={11} aria-label="Com anexo" /></>}
                      </div>
                    </td>
                    <td>{c.situacao === 'Ativo' ? <Pill tone={k.geral.tone}>{k.geral.label}</Pill> : <Pill>{c.situacao || 'Inativo'}</Pill>}</td>
                    <td className="n">{oc.length ? <>{oc.length}<div className="s">{money(sum(oc, 'valor'))}</div></> : <span className="frota-muted">0</span>}</td>
                    <td>
                      {podeEscrever && (
                        <button type="button" className="frota-ibtn" aria-label="Editar" onClick={(e) => { e.stopPropagation(); abrirForm('condutores', c.id); }}><Pencil size={15} /></button>
                      )}
                    </td>
                  </tr>
                );
              }) : <LinhaVazia colunas={7} titulo="Nenhum condutor encontrado" />}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}
