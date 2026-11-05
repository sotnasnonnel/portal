import { useState } from 'react';
import {
  Pencil, TriangleAlert, Trash2, Wrench,
} from 'lucide-react';
import { useFrota } from './FrotaContext';
import CascaDrawer from './CascaDrawer';
import Confirmar from './Confirmar';
import {
  Kpi, LinhaAuditoria, Pill, Placa,
} from './Pecas';
import {
  combOf, compLabel, isNum, ocTone, revisao, stTone, todayISO, totalOf,
} from '../../lib/regras';
import {
  fmtDate, fmtInt, int, km, linhaClicavel, money, money0,
} from '../../lib/formato';
import { excluirRegistro } from '../../lib/frota';

function Dado({ label, children }) {
  return <div><dt>{label}</dt><dd>{children == null || children === '' ? '—' : children}</dd></div>;
}

const porDataDesc = (a, b) => String(b.data || '').localeCompare(String(a.data || ''));

/** Ficha do veículo, com o que aconteceu com a placa. */
export default function DetalheVeiculo({ id }) {
  const {
    dados, cfg, abrirDetalhe, abrirForm, fecharDrawer, recarregar, toast, podeEscrever, podeExcluir,
  } = useFrota();
  const [confirma, setConfirma] = useState(false);
  const v = dados.veiculos.find((x) => x.id === id);
  if (!v) return null;

  const r = revisao(v, cfg);
  const ms = dados.mensal.filter((m) => m.placa && m.placa === v.placa).sort((a, b) => b.competencia.localeCompare(a.competencia));
  const oc = dados.ocorrencias.filter((o) => o.placa && o.placa === v.placa).sort(porDataDesc);
  const mn = dados.manutencoes.filter((m) => v.placa && m.placa === v.placa).sort(porDataDesc);
  const hist = v.historico || [];

  const excluir = async () => {
    try {
      await excluirRegistro('veiculos', id);
      await recarregar(['veiculos']);
      toast('Excluído');
      fecharDrawer();
    } catch (e) {
      setConfirma(false);
      toast(e.message, 'err');
    }
  };

  return (
    <CascaDrawer
      onFechar={fecharDrawer}
      cabecalho={(
        <div className="frota-cellv">
          <Placa placa={v.placa} />
          <div>
            <h2>{v.modelo || 'Veículo'}</h2>
            <p>{v.condutor || 'Sem condutor'} · {v.locadora || ''} <Pill tone={stTone(v.status)}>{v.status === 'Reservado' ? 'Retirada pendente' : v.status}</Pill></p>
          </div>
        </div>
      )}
      rodape={podeEscrever ? (
        <>
          {podeExcluir('veiculos') && (
            <button type="button" className="frota-btn danger" onClick={() => setConfirma(true)}><Trash2 size={15} /> Excluir</button>
          )}
          <span className="frota-sp" />
          <button type="button" className="frota-btn" onClick={() => abrirForm('manutencoes', null, { placa: v.placa, data: todayISO(), tipo: 'Revisão preventiva', km: v.km_atual, condutor: v.condutor })}><Wrench size={15} /> Manutenção</button>
          <button type="button" className="frota-btn" onClick={() => abrirForm('ocorrencias', null, { placa: v.placa, status: 'Aberta', tipo: 'Multa', data: todayISO(), condutor: v.condutor, modelo: v.modelo, locadora: v.locadora })}><TriangleAlert size={15} /> Ocorrência</button>
          <button type="button" className="frota-btn primary" onClick={() => abrirForm('veiculos', id)}><Pencil size={15} /> Editar</button>
        </>
      ) : (
        <>
          <span className="frota-sp" />
          <button type="button" className="frota-btn" onClick={fecharDrawer}>Fechar</button>
        </>
      )}
    >
      <div className="frota-stack">
        <div className="frota-kpis compacto">
          <Kpi label="Locação/mês" valor={money0(v.custo_mensal)} sub={v.custo_resp ? `por conta: ${v.custo_resp}` : ''} />
          <Kpi label="Km atual" valor={int(v.km_atual)} sub={isNum(v.km_contratado) ? `${fmtInt.format(v.km_contratado)} km/mês contratados` : ''} />
          <Kpi label="Revisão" valor={<Pill tone={r.tone}>{r.label}</Pill>} sub={r.prox != null ? `próxima em ${km(r.prox)}` : ''} />
        </div>

        <section className="frota-fsec">
          <h3>Contrato de locação</h3>
          <dl className="frota-dl">
            <Dado label="Locadora">{v.locadora}</Dado>
            <Dado label="Grupo">{v.grupo}</Dado>
            <Dado label="Nº contrato">{v.contrato}</Dado>
            <Dado label="Código de reserva">{v.codigo_reserva}</Dado>
            <Dado label="Tipo de contrato">{v.tipo_contrato}</Dado>
            <Dado label="R$ por km excedente">{isNum(v.valor_km_excedente) ? money(v.valor_km_excedente) : ''}</Dado>
            <Dado label="Retirada">{fmtDate(v.retirada)}</Dado>
            <Dado label="Devolução">{v.devolucao ? fmtDate(v.devolucao) : ''}</Dado>
            <Dado label="Próxima fatura">{v.proxima_fatura ? fmtDate(v.proxima_fatura) : ''}</Dado>
            <Dado label="Cidade">{v.cidade}</Dado>
          </dl>
        </section>

        <section className="frota-fsec">
          <h3>Alocação e equipamentos</h3>
          <dl className="frota-dl">
            <Dado label="Condutor">{v.condutor}</Dado>
            <Dado label="CT / Centro de custo">{v.ct}</Dado>
            <Dado label="GPS">{[v.gps, v.gps_numero].filter(Boolean).join(' · ')}</Dado>
            <Dado label="Mensalidade GPS">{isNum(v.gps_valor) ? money(v.gps_valor) : ''}</Dado>
            <Dado label="Adesivo">{v.adesivo}</Dado>
            <Dado label="Cartão combustível">{v.cartao_combustivel}</Dado>
            <Dado label="Recarga mensal">{isNum(v.recarga_mensal) ? money(v.recarga_mensal) : ''}</Dado>
            <Dado label="Cor">{v.cor}</Dado>
          </dl>
        </section>

        <section className="frota-fsec">
          <h3>Quilometragem e revisão</h3>
          <dl className="frota-dl">
            <Dado label="Km última manutenção">{isNum(v.km_ultima_manutencao) ? km(v.km_ultima_manutencao) : ''}</Dado>
            <Dado label="Data última revisão">{v.data_ultima_revisao ? fmtDate(v.data_ultima_revisao) : ''}</Dado>
            <Dado label="Km desde a revisão">{r.desde != null ? km(r.desde) : ''}</Dado>
            <Dado label="Data próxima revisão">{v.data_proxima_revisao ? fmtDate(v.data_proxima_revisao) : ''}</Dado>
          </dl>
        </section>

        {v.obs && <div className="frota-note warn"><span className="pre">{v.obs}</span></div>}

        <section className="frota-fsec">
          <h3>Histórico de condutores</h3>
          {hist.length ? (
            <div className="frota-hist">
              {hist.map((h, i) => (
                <div key={i} className="h">
                  <b>{h.condutor || '—'}</b> · {h.locadora || ''} {h.contrato ? `· contrato ${h.contrato}` : ''}
                  <br />
                  <span className="frota-muted">
                    {h.retirada ? `retirada ${fmtDate(h.retirada)}` : ''}
                    {h.devolucao ? ` · devolução ${fmtDate(h.devolucao)}` : ''}
                    {h.fonte ? ` · fonte: ${h.fonte}` : ''}
                  </span>
                </div>
              ))}
              <div className="h"><b>{v.condutor || '—'}</b> · atual</div>
            </div>
          ) : <p className="frota-muted">Sem troca de condutor registrada.</p>}
        </section>

        <section className="frota-fsec">
          <h3>Lançamentos mensais</h3>
          {ms.length ? (
            <table className="frota-mini">
              <thead><tr><th>Competência</th><th>Condutor</th><th className="n">Total</th><th className="n">Combustível</th><th className="n">Km</th></tr></thead>
              <tbody>
                {ms.map((m) => (
                  <tr key={m.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('mensal', m.id))}>
                    <td>{compLabel(m.competencia)}</td><td>{m.condutor}</td><td className="n">{money(totalOf(m))}</td><td className="n">{money(combOf(m))}</td><td className="n">{int(m.km_atual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="frota-muted">Nenhum lançamento.</p>}
        </section>

        <section className="frota-fsec">
          <h3>Multas e avarias</h3>
          {oc.length ? (
            <table className="frota-mini">
              <thead><tr><th>Data</th><th>Tipo</th><th>Condutor</th><th className="n">Valor</th><th>Status</th></tr></thead>
              <tbody>
                {oc.map((o) => (
                  <tr key={o.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('ocorrencias', o.id))}>
                    <td>{fmtDate(o.data)}</td><td>{o.tipo} · {o.categoria || ''}</td><td>{o.condutor || ''}</td><td className="n">{money(o.valor)}</td><td><Pill tone={ocTone(o.status || 'Aberta')}>{o.status || 'Aberta'}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="frota-muted">Nenhuma ocorrência para esta placa.</p>}
        </section>

        <section className="frota-fsec">
          <h3>Manutenções</h3>
          {mn.length ? (
            <table className="frota-mini">
              <thead><tr><th>Data</th><th>Serviço</th><th className="n">Km</th><th className="n">Valor</th></tr></thead>
              <tbody>
                {mn.map((m) => (
                  <tr key={m.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('manutencoes', m.id))}>
                    <td>{fmtDate(m.data)}</td><td>{m.tipo}</td><td className="n">{int(m.km)}</td><td className="n">{money(m.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="frota-muted">Nenhuma manutenção registrada.</p>}
        </section>

        <LinhaAuditoria doc={v} />
      </div>
      {confirma && (
        <Confirmar
          titulo="Excluir veículo?"
          texto={`“${v.placa || 'Retirada pendente'} · ${v.modelo || ''}” será removido da base para todos os usuários. Essa ação não pode ser desfeita.`}
          ok="Excluir"
          perigo
          onOk={excluir}
          onFechar={() => setConfirma(false)}
        />
      )}
    </CascaDrawer>
  );
}
