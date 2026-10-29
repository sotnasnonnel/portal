import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PencilLine, Save } from 'lucide-react';
import { PLR_ANO } from '../../../../config/plr';
import { carregarPainel, salvarSetor } from '../../lib/dados';
import {
  REGRAS, UNIDADES, aderencia, contribuicao, deCampo, formatarPct, paraCampo,
  problemasDaEdicao, resumoSetor, situacao,
} from '../../lib/plr';
import { rotuloSetor } from '../components/rotulos';

// O setor como os campos o mostram: números em texto, na unidade de quem digita.
const formDoSetor = (setor) => ({
  referencia: setor.referencia || '',
  linhas: setor.indicadores.map((i) => ({
    id: i.id,
    nome: i.nome,
    unidade: i.unidade,
    regra: i.regra,
    peso: paraCampo(i.peso, 'percentual'),
    meta: paraCampo(i.meta, i.unidade),
    resultado: paraCampo(i.resultado, i.unidade),
  })),
});

// Linha dos campos → indicador com números, para a prévia e para gravar.
const indicadorDaLinha = (l) => ({
  id: l.id,
  nome: l.nome.trim(),
  unidade: l.unidade,
  regra: l.regra,
  meta: deCampo(l.meta, l.unidade),
  resultado: deCampo(l.resultado, l.unidade),
  peso: deCampo(l.peso, 'percentual'),
});

// Editar resultados: um setor por vez. Mexe nos indicadores que a carga trouxe
// (nome, unidade, regra, peso, meta e resultado) e na referência do período;
// aderência e total são recalculados na hora, para quem edita ver o efeito
// antes de salvar.
export default function EditarPlr() {
  const [setores, setSetores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [setorId, setSetorId] = useState('');
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const recarregar = useCallback(async (manterId) => {
    setCarregando(true);
    setErroCarga('');
    try {
      const { setores: lista } = await carregarPainel(PLR_ANO);
      setSetores(lista);
      const alvo = lista.find((s) => s.id === manterId) || lista[0];
      setSetorId(alvo?.id || '');
      setForm(alvo ? formDoSetor(alvo) : null);
    } catch (e) {
      setErroCarga(e?.message || 'Erro ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  const setor = setores.find((s) => s.id === setorId) || null;
  const sujo = useMemo(
    () => !!setor && !!form && JSON.stringify(form) !== JSON.stringify(formDoSetor(setor)),
    [setor, form],
  );
  const previa = useMemo(() => (form ? form.linhas.map(indicadorDaLinha) : []), [form]);
  const resumo = resumoSetor(previa);
  const problemas = form ? problemasDaEdicao(form.linhas) : [];

  const trocarSetor = (id) => {
    if (sujo && !window.confirm('Há alterações não salvas neste setor. Descartar?')) return;
    const alvo = setores.find((s) => s.id === id);
    setSetorId(id);
    setForm(alvo ? formDoSetor(alvo) : null);
    setMsg(null);
  };

  const mudarLinha = (idx, campo, valor) => {
    setMsg(null);
    setForm((f) => ({
      ...f,
      linhas: f.linhas.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)),
    }));
  };

  const descartar = () => {
    if (setor) setForm(formDoSetor(setor));
    setMsg(null);
  };

  const salvar = async () => {
    if (!setor || problemas.length) return;
    setSalvando(true);
    setMsg(null);
    try {
      await salvarSetor(setor.id, form.referencia.trim(), form.linhas.map(indicadorDaLinha));
      await recarregar(setor.id);
      setMsg({ tipo: 'ok', texto: 'Salvo. Quem vê o setor já enxerga os números novos.' });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: `Não foi possível salvar: ${e?.message || 'erro desconhecido'}` });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="plr-page plr-page-wide">
      <div className="plr-cab">
        <h1 className="plr-title"><PencilLine size={24} /> Editar resultados</h1>
        <p className="plr-sub">
          Os números que cada setor vê no PLR {PLR_ANO}. Aderência e total são calculados a partir daqui.
        </p>
      </div>

      {carregando && !form ? (
        <div className="plr-vazio"><Loader2 size={22} className="plr-spin" /> Carregando…</div>
      ) : erroCarga ? (
        <div className="plr-vazio plr-erro">Não foi possível carregar o PLR: {erroCarga}</div>
      ) : !form ? (
        <div className="plr-vazio">Nenhum setor cadastrado para {PLR_ANO}.</div>
      ) : (
        <section className="plr-card">
          <div className="plr-linha">
            <div className="plr-campo">
              <label htmlFor="plr-setor">Setor</label>
              <select
                id="plr-setor"
                className="plr-select"
                value={setorId}
                onChange={(e) => trocarSetor(e.target.value)}
                disabled={salvando}
              >
                {setores.map((s) => <option key={s.id} value={s.id}>{rotuloSetor(s)}</option>)}
              </select>
            </div>
            <div className="plr-campo">
              <label htmlFor="plr-ref">Referência dos resultados</label>
              <input
                id="plr-ref"
                className="plr-input"
                value={form.referencia}
                maxLength={120}
                placeholder="Ex.: YTD Julho"
                onChange={(e) => { setMsg(null); setForm((f) => ({ ...f, referencia: e.target.value })); }}
              />
            </div>
          </div>

          <div className="plr-tabela-scroll">
            <table className="plr-tabela plr-tabela-edicao">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Unidade</th>
                  <th>Regra</th>
                  <th className="num">Peso (%)</th>
                  <th className="num">Meta</th>
                  <th className="num">Resultado</th>
                  <th className="num">Aderência</th>
                  <th className="num">Contribuição</th>
                </tr>
              </thead>
              <tbody>
                {form.linhas.map((l, idx) => {
                  const ind = previa[idx];
                  const sufixo = UNIDADES[l.unidade]?.campo;
                  return (
                    <tr key={l.id}>
                      <td className="plr-col-nome">
                        <input
                          className="plr-input"
                          value={l.nome}
                          title={l.nome}
                          maxLength={300}
                          aria-label={`Nome do indicador ${idx + 1}`}
                          onChange={(e) => mudarLinha(idx, 'nome', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="plr-select"
                          value={l.unidade}
                          aria-label="Unidade"
                          onChange={(e) => mudarLinha(idx, 'unidade', e.target.value)}
                        >
                          {Object.entries(UNIDADES).map(([k, u]) => <option key={k} value={k}>{u.rotulo}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          className="plr-select"
                          value={l.regra}
                          aria-label="Regra de aderência"
                          title={REGRAS[l.regra]?.descricao}
                          onChange={(e) => mudarLinha(idx, 'regra', e.target.value)}
                        >
                          {Object.entries(REGRAS).map(([k, r]) => <option key={k} value={k}>{r.rotulo}</option>)}
                        </select>
                      </td>
                      <td className="num">
                        <input
                          className="plr-input plr-input-num"
                          value={l.peso}
                          inputMode="decimal"
                          aria-label="Peso em %"
                          onChange={(e) => mudarLinha(idx, 'peso', e.target.value)}
                        />
                      </td>
                      <td className="num">
                        <span className="plr-input-sufixo">
                          <input
                            className="plr-input plr-input-num"
                            value={l.meta}
                            inputMode="decimal"
                            aria-label="Meta"
                            onChange={(e) => mudarLinha(idx, 'meta', e.target.value)}
                          />
                          {sufixo ? <small>{sufixo}</small> : null}
                        </span>
                      </td>
                      <td className="num">
                        <span className="plr-input-sufixo">
                          <input
                            className="plr-input plr-input-num"
                            value={l.resultado}
                            inputMode="decimal"
                            placeholder="—"
                            aria-label="Resultado"
                            onChange={(e) => mudarLinha(idx, 'resultado', e.target.value)}
                          />
                          {sufixo ? <small>{sufixo}</small> : null}
                        </span>
                      </td>
                      <td className="num">
                        <span className={`plr-pill is-${situacao(ind)}`}>{formatarPct(aderencia(ind))}</span>
                      </td>
                      <td className="num plr-contrib">{formatarPct(contribuicao(ind))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className={`num${resumo.pesosFecham ? '' : ' is-alerta'}`}>{formatarPct(resumo.somaPesos, 0)}</td>
                  <td colSpan={3} />
                  <td className="num plr-contrib">{formatarPct(resumo.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {!resumo.pesosFecham ? (
            <p className="plr-aviso">
              <AlertTriangle size={14} /> Os pesos deste setor somam {formatarPct(resumo.somaPesos, 0)}, não 100%.
              Dá para salvar assim, mas o total do setor nunca chega a 100%.
            </p>
          ) : null}

          {problemas.length ? (
            <ul className="plr-problemas">
              {problemas.map((p) => <li key={p}>{p}</li>)}
            </ul>
          ) : null}

          {msg ? (
            <p className={`plr-msg is-${msg.tipo}`}>
              {msg.tipo === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {msg.texto}
            </p>
          ) : null}

          <div className="plr-acoes">
            <button
              type="button"
              className="plr-btn plr-btn-primary"
              onClick={salvar}
              disabled={!sujo || salvando || problemas.length > 0}
            >
              {salvando ? <Loader2 size={16} className="plr-spin" /> : <Save size={16} />} Salvar
            </button>
            <button type="button" className="plr-btn plr-btn-ghost" onClick={descartar} disabled={!sujo || salvando}>
              Descartar alterações
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
