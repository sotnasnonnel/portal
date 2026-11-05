import {
  AlertTriangle, BedDouble, Clock, LayoutGrid, LogIn, LogOut, Pencil, Trash2,
} from 'lucide-react';
import {
  daysBetween, doAloj, fdate, isOn, plural, quartoNome, todayISO, vagas,
} from '../../lib/regras';
import {
  Nil, Pill, PillChave, Vazio,
} from '../components/Ui';

function Quarto({
  q, on, a, acoes,
}) {
  const st = on.filter((e) => e.quarto_id === q.id);
  const vg = Math.max(1, +q.vagas || 1);
  let pill = <Pill>Livre</Pill>;
  if (st.length >= vg) pill = <Pill c="good">Ocupado</Pill>;
  else if (st.length) pill = <Pill c="warn">{st.length}/{vg} vagas</Pill>;
  return (
    <div className={`aloj-quarto${st.length ? '' : ' livre'}`}>
      <div className="aloj-quarto-h"><b>{q.nome}</b>{pill}</div>
      {st.map((e) => (
        <div key={e.id} className="aloj-ocup">
          <b>{e.morador}</b>
          <small>
            {e.entrada ? `Desde ${fdate(e.entrada)}` : 'Entrada não informada'} · {e.saida_prevista ? `saída prevista ${fdate(e.saida_prevista)}` : 'saída indeterminada'}
          </small>
          <div className="aloj-ocup-l">
            <PillChave e={e} />
            {e.chave_obs && <small>{e.chave_obs}</small>}
          </div>
          <div className="aloj-ocup-l">
            <button type="button" className="aloj-btn pequeno" onClick={() => acoes.saida(e)}><LogOut size={13} /> Registrar saída</button>
            <button type="button" className="aloj-mini" title="Editar" aria-label="Editar estadia" onClick={() => acoes.editarEstadia(e)}><Pencil size={14} /></button>
          </div>
        </div>
      ))}
      {st.length < vg && (
        <button type="button" className="aloj-link aloj-mt" onClick={() => acoes.entrada(a.id, q.id)}><LogIn size={14} /> Registrar entrada</button>
      )}
    </div>
  );
}

export default function AbaOcupacao({ a, base, acoes }) {
  const quartos = a.quartos || [];
  const todas = doAloj(base.estadias, a.id);
  const on = todas.filter((e) => isOn(e));
  const orfaos = on.filter((e) => !quartos.some((q) => q.id === e.quarto_id));
  const historico = [...todas].sort((x, y) => (isOn(y) - isOn(x)) || String(y.entrada || '').localeCompare(String(x.entrada || '')));

  return (
    <div className="aloj-pilha">
      <div className="aloj-card">
        <div className="aloj-card-h">
          <h3><BedDouble size={15} /> Quartos <small>{Math.min(on.length, vagas(a))}/{vagas(a)} vagas ocupadas</small></h3>
          <div className="aloj-acoes">
            <button type="button" className="aloj-btn pequeno" onClick={() => acoes.configurarQuartos(a)}><LayoutGrid size={14} /> Configurar quartos</button>
            {quartos.length > 0 && (
              <button type="button" className="aloj-btn pequeno primario" onClick={() => acoes.entrada(a.id)}><LogIn size={14} /> Registrar entrada</button>
            )}
          </div>
        </div>
        <div className="aloj-card-b">
          {quartos.length ? (
            <div className="aloj-quartos-g">
              {quartos.map((q) => <Quarto key={q.id} q={q} on={on} a={a} acoes={acoes} />)}
            </div>
          ) : (
            <Vazio titulo="Quartos não configurados" texto="Informe os quartos e as vagas de cada um para controlar a ocupação.">
              <button type="button" className="aloj-btn primario" onClick={() => acoes.configurarQuartos(a)}><LayoutGrid size={14} /> Configurar quartos</button>
            </Vazio>
          )}
          {orfaos.length > 0 && (
            <div className="aloj-nota tom-warn aloj-mt">
              <AlertTriangle size={14} />
              <p>{plural(orfaos.length, 'morador')} sem quarto válido: {orfaos.map((e) => e.morador).join(', ')}. Edite a estadia e escolha o quarto.</p>
            </div>
          )}
        </div>
      </div>

      <div className="aloj-card">
        <div className="aloj-card-h">
          <h3><Clock size={15} /> Histórico de moradores</h3>
          <span className="aloj-muted aloj-pequeno">{plural(todas.length, 'registro')}</span>
        </div>
        <div className="aloj-card-b">
          {historico.length ? (
            <div className="aloj-tab-scroll">
              <table className="aloj-tab">
                <thead>
                  <tr><th>Morador</th><th>Quarto</th><th>Entrada</th><th>Saída</th><th className="r">Dias</th><th>Chave</th><th className="acao" /></tr>
                </thead>
                <tbody>
                  {historico.map((e) => {
                    const d = e.entrada ? daysBetween(e.entrada, e.saida || todayISO()) : null;
                    return (
                      <tr key={e.id}>
                        <td><b>{e.morador}</b>{e.obs && <small>{e.obs}</small>}</td>
                        <td>{quartoNome(a, e)}</td>
                        <td>{fdate(e.entrada) || <Nil />}</td>
                        <td>{e.saida ? fdate(e.saida) : <Pill c="info" semPonto>Morando</Pill>}</td>
                        <td className="r">{d !== null ? d : <Nil />}</td>
                        <td><PillChave e={e} />{e.chave_obs && <small>{e.chave_obs}</small>}</td>
                        <td className="acao">
                          {isOn(e) && (
                            <button type="button" className="aloj-mini" title="Registrar saída" aria-label="Registrar saída" onClick={() => acoes.saida(e)}><LogOut size={14} /></button>
                          )}
                          <button type="button" className="aloj-mini" title="Editar" aria-label="Editar estadia" onClick={() => acoes.editarEstadia(e)}><Pencil size={14} /></button>
                          <button type="button" className="aloj-mini" title="Excluir" aria-label="Excluir estadia" onClick={() => acoes.excluirEstadia(e)}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Vazio titulo="Nenhum morador registrado" texto="Registre a primeira entrada para acompanhar quartos e chaves." />}
        </div>
      </div>
    </div>
  );
}
