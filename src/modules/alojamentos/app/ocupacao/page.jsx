import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BedDouble, Clock, KeyRound, LayoutGrid, LogIn, LogOut, Search, Users,
} from 'lucide-react';
import { useBase } from '../../lib/useBase';
import {
  CHAVE, MES3, alojs, byId, chaveARecolher, compLabel, curComp, fdate, isOn, local, movimentos, norm, operando, plural, quartoNome, staysOn, vagas,
} from '../../lib/regras';
import { rotaFicha } from '../components/nav';
import { useAcoes } from '../components/useAcoes';
import Dialogos from '../components/Dialogos';
import {
  Barra, Carga, Kpi, Nil, Pill, PillChave, Vazio,
} from '../components/Ui';

function CartaoMapa({ a, base, acoes }) {
  const st = staysOn(base, a.id);
  const v = vagas(a);
  const tom = v && st.length >= v ? 'good' : st.length ? 'warn' : '';
  return (
    <div className="aloj-card">
      <div className="aloj-card-h">
        <h3><Link to={rotaFicha(a.id, 'ocupacao')}>{a.nome}</Link> <small>{local(a)}</small></h3>
        <Pill c={tom} semPonto>{v ? `${Math.min(st.length, v)}/${v}` : st.length} vagas</Pill>
      </div>
      <div className="aloj-card-b">
        {v > 0 && <Barra pct={(st.length / v) * 100} tom="teal" />}
        <div className="aloj-metas">
          {(a.quartos || []).map((q) => {
            const ps = st.filter((e) => e.quarto_id === q.id);
            if (!ps.length) return <span key={q.id} className="aloj-chip livre"><b>{q.nome}</b> livre</span>;
            return ps.map((e) => <span key={e.id} className="aloj-chip" title={q.nome}><b>{q.nome}</b> {e.morador}</span>);
          })}
        </div>
        <button type="button" className="aloj-link aloj-mt" onClick={() => acoes.entrada(a.id)}><LogIn size={14} /> Registrar entrada</button>
      </div>
    </div>
  );
}

function Conteudo({ base, acoes }) {
  const [busca, setBusca] = useState('');
  const ops = alojs(base, operando);
  const vt = ops.reduce((s, a) => s + vagas(a), 0);
  const oc = ops.reduce((s, a) => s + (vagas(a) ? Math.min(vagas(a), staysOn(base, a.id).length) : 0), 0);
  const on = base.estadias.filter((e) => isOn(e) && byId(base, e.alojamento_id));
  const chaves = base.estadias.filter((e) => chaveARecolher(e));
  const comp = curComp();
  const mesEnt = base.estadias.filter((e) => String(e.entrada).startsWith(comp)).length;
  const mesSai = base.estadias.filter((e) => String(e.saida).startsWith(comp)).length;
  const q = norm(busca).trim();
  const quadros = ops.filter((a) => vagas(a) || staysOn(base, a.id).length);
  const nomeAloj = (e) => byId(base, e.alojamento_id).nome;
  const linhas = on
    .filter((e) => !q || norm(`${e.morador} ${nomeAloj(e)}`).includes(q))
    .sort((x, y) => String(nomeAloj(x)).localeCompare(nomeAloj(y)) || String(x.quarto_id).localeCompare(String(y.quarto_id)));
  const mov = movimentos(base).slice(0, 12);

  return (
    <>
      <div className="aloj-kpis">
        <Kpi
          rotulo="Ocupação geral"
          Icon={BedDouble}
          valor={<>{oc}<small> / {vt} vagas</small></>}
          sub={`${vt ? Math.round((oc / vt) * 100) : 0}% ocupado`}
        >
          <Barra pct={vt ? (oc / vt) * 100 : 0} tom="teal" />
        </Kpi>
        <Kpi
          rotulo="Vagas livres"
          Icon={LayoutGrid}
          valor={Math.max(0, vt - oc)}
          sub={`em ${plural(ops.filter((a) => vagas(a) > staysOn(base, a.id).length).length, 'alojamento')}`}
        />
        <Kpi rotulo="Moradores" Icon={Users} valor={on.length} sub="com estadia em aberto" />
        <Kpi
          rotulo="Chaves pendentes"
          Icon={KeyRound}
          valor={chaves.length}
          sub={chaves.length ? 'saída registrada sem devolução' : 'todas devolvidas'}
        />
        <Kpi
          rotulo={`Movimento em ${MES3[+comp.slice(5) - 1].toLowerCase()}`}
          Icon={Clock}
          valor={<>{mesEnt}<small> ent.</small> · {mesSai}<small> saí.</small></>}
          sub={compLabel(comp)}
        />
      </div>

      {chaves.length > 0 && (
        <>
          <h2 className="aloj-sec">Chaves a recolher</h2>
          <div className="aloj-card">
            {chaves.map((e) => {
              const a = byId(base, e.alojamento_id);
              return a && (
                <button key={e.id} type="button" className="aloj-alerta" onClick={() => acoes.editarEstadia(e)}>
                  <span className="aloj-sev bad" />
                  <span>
                    <b>{e.morador}</b>
                    <small>
                      {a.nome} · {quartoNome(a, e)}{e.saida ? ` · saiu em ${fdate(e.saida)}` : ''} · {CHAVE[e.chave]?.l || ''}{e.chave_obs ? ` (${e.chave_obs})` : ''}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <h2 className="aloj-sec">Mapa de quartos</h2>
      {quadros.length ? (
        <div className="aloj-g2">
          {quadros.map((a) => <CartaoMapa key={a.id} a={a} base={base} acoes={acoes} />)}
        </div>
      ) : (
        <div className="aloj-card">
          <Vazio titulo="Nenhum alojamento com quartos configurados" texto="Abra um alojamento e configure os quartos na aba Ocupação." />
        </div>
      )}

      <div className="aloj-g2" style={{ marginTop: 28 }}>
        <div className="aloj-card">
          <div className="aloj-card-h">
            <h3><Users size={15} /> Moradores atuais</h3>
            <label className="aloj-inline" htmlFor="aloj-oc-q">
              <Search size={14} />
              <input id="aloj-oc-q" placeholder="Buscar morador" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
          </div>
          <div className="aloj-card-b">
            {linhas.length ? (
              <div className="aloj-tab-scroll">
                <table className="aloj-tab">
                  <thead><tr><th>Morador</th><th>Alojamento</th><th>Entrada</th><th>Chave</th><th className="acao" /></tr></thead>
                  <tbody>
                    {linhas.map((e) => {
                      const a = byId(base, e.alojamento_id);
                      return (
                        <tr key={e.id}>
                          <td><b>{e.morador}</b><small>{quartoNome(a, e)}</small></td>
                          <td>{a.nome}</td>
                          <td>{fdate(e.entrada) || <Nil />}</td>
                          <td><PillChave e={e} /></td>
                          <td className="acao">
                            <button type="button" className="aloj-mini" title="Registrar saída" aria-label="Registrar saída" onClick={() => acoes.saida(e)}><LogOut size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Vazio
                titulo={q ? 'Ninguém encontrado' : 'Nenhum morador no momento'}
                texto={q ? 'Tente outro nome.' : 'Registre uma entrada para começar.'}
              />
            )}
          </div>
        </div>

        <div className="aloj-card">
          <div className="aloj-card-h"><h3><Clock size={15} /> Últimas movimentações</h3></div>
          <div className="aloj-card-b">
            {mov.length ? mov.map((m) => (
              <div key={`${m.e.id}-${m.t}`} className="aloj-linha">
                <span className={`aloj-ini${m.t === 'Saída' ? ' saida' : ''}`}>{m.t === 'Entrada' ? <LogIn size={14} /> : <LogOut size={14} />}</span>
                <span className="aloj-linha-tx">
                  <b>{m.e.morador}</b>
                  <small>{m.t} · {m.a.nome} · {quartoNome(m.a, m.e)}</small>
                </span>
                <span className="aloj-data">{fdate(m.d)}</span>
              </div>
            )) : <p className="aloj-muted aloj-m0">Sem movimentações com data registrada.</p>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function OcupacaoAlojamentos() {
  const { base, carregando, erro, recarregar } = useBase();
  const acoes = useAcoes({ base, recarregar });
  return (
    <div className="aloj-page larga">
      <div className="aloj-head">
        <div>
          <h1>Ocupação</h1>
          <p>Quartos, moradores, entradas, saídas e chaves de todos os alojamentos em operação</p>
        </div>
        <div className="aloj-acoes">
          <button type="button" className="aloj-btn primario" onClick={() => acoes.entrada()}><LogIn size={14} /> Registrar entrada</button>
        </div>
      </div>
      <Carga carregando={carregando} erro={erro}>
        <Conteudo base={base} acoes={acoes} />
      </Carga>
      <Dialogos acoes={acoes} />
    </div>
  );
}
