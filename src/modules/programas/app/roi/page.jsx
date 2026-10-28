import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, Calculator, CheckCircle2, Circle, Loader2, Save,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { buscarIdeia } from '../../lib/ideias';
import {
  FACILIDADE, PRAZO_RELATORIO, UNIDADES, VALIDACAO_LABEL,
  buscarFicha, calcularFinanceiro, calcularTempo, elegibilidade, notaFacilidade,
  prontidao, salvarFicha,
} from '../../lib/roi';

/**
 * Ficha de ROI do Programa de Inovação 2026 — uma por registro do Campo de
 * Ideias, preenchida por quem registrou. Mesmos campos e contas do mockup
 * (Programa_Inovacao_2026_ficha.html), no layout do módulo.
 *
 * Saiu do mockup o "Gerar resumo para colar na ficha oficial": a ficha agora É
 * a oficial, e a equipe de Inovação lê e valida direto no Ranking.
 *
 * Quem não é o autor abre a mesma tela só para leitura — é o "ver ficha" do
 * Ranking, e uma segunda tela de leitura repetiria todos os campos.
 */

const VAZIO = {
  workshop: null, workshop_qual: '', problema: '',
  medicao_inicio: '', medicao_fim: '',
  tempo_antes: '', tempo_depois: '', tempo_unidade: '', tempo_execucoes: '', detalhe_tempo: '',
  gasto_descricao: '', gasto_antes: '', gasto_atual: '', custo_solucao: '', detalhe_financeiro: '',
  fac_desenvolver: null, fac_implantar: null, fac_treinamento: null, fac_autonomia: null,
};

const doBanco = (f) => Object.fromEntries(
  Object.keys(VAZIO).map((k) => [k, f[k] ?? VAZIO[k]])
);

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const horasFmt = (n) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: n < 10 ? 2 : 1 }).format(n);

// O selo do bloco: o mesmo "Pendente / Revisar / A validar" do mockup.
const SELO = {
  pendente: { label: 'Pendente', tom: 'tom-neutro' },
  revisar: { label: 'Revisar', tom: 'tom-recusado' },
  ok: { label: 'A validar', tom: 'tom-andamento' },
};

export default function FichaRoi() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [registro, setRegistro] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [v, setV] = useState(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const avisoRef = useRef(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [r, f] = await Promise.all([buscarIdeia(id), buscarFicha(id)]);
      setRegistro(r);
      setFicha(f);
      setV(f ? doBanco(f) : VAZIO);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const podeEditar = Boolean(registro) && registro.autor_id === user?.id;

  const set = (campo) => (e) => {
    setV((a) => ({ ...a, [campo]: e.target.value }));
  };
  const escolher = (campo, valor) => {
    setV((a) => ({ ...a, [campo]: valor }));
  };

  const tempo = useMemo(() => calcularTempo(v), [v]);
  const fin = useMemo(() => calcularFinanceiro(v), [v]);
  const fac = useMemo(() => notaFacilidade(v), [v]);
  const checks = useMemo(() => prontidao(v), [v]);
  const eleg = elegibilidade(v);
  const faltam = checks.filter((c) => !c.ok).length;

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await salvarFicha(id, ficha, v, user.id);
      // Salvou, fecha: ficar na mesma tela com os campos preenchidos parecia que
      // nada tinha acontecido. A confirmação aparece no Campo de Ideias.
      navigate('/programas/ideias', {
        state: {
          aviso: faltam
            ? `Ficha de ROI de "${registro.titulo}" salva. Faltam ${faltam} item(ns) para ela ir à validação.`
            : `Ficha de ROI de "${registro.titulo}" salva e completa. Agora é com a equipe de Inovação.`,
        },
      });
    } catch (err) {
      setErro(err.message);
      avisoRef.current?.focus();
      setSalvando(false);
    }
  };

  if (carregando) {
    return <div className="pg-page"><div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div></div>;
  }

  if (!registro) {
    return (
      <div className="pg-page">
        {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}
        <div className="pg-vazio">
          Registro não encontrado. <Link className="pg-link" to="/programas/ideias">Voltar ao Campo de Ideias</Link>.
        </div>
      </div>
    );
  }

  // Ficha é só de INICIATIVA: ideia é o que ainda não existe, e não tem antes e
  // depois para medir. O banco recusa também (programas_roi_insert).
  if (registro.tipo !== 'iniciativa') {
    return (
      <div className="pg-page">
        <div className="pg-vazio">
          A ficha de ROI é só para iniciativas — <strong>#{registro.numero} — {registro.titulo}</strong> é
          uma ideia, e ainda não há resultado para medir.{' '}
          <Link className="pg-link" to="/programas/ideias">Voltar ao Campo de Ideias</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="pg-page">
      <button type="button" className="pg-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={15} /> Voltar
      </button>

      <div className="pg-form-cab">
        <span className="pg-prog-ico"><Calculator size={24} /></span>
        <div>
          <h1>Ficha de ROI</h1>
          <small>Programa de Inovação 2026 · relatório até {PRAZO_RELATORIO}</small>
        </div>
      </div>

      {/* O parecer da equipe vem antes de tudo: é o que o autor abre a ficha
          para saber. */}
      {ficha && ficha.validacao !== 'pendente' && (
        <div className={`pg-aviso ${ficha.validacao === 'validada' ? 'tom-ok' : 'tom-erro'}`}>
          {ficha.validacao === 'validada' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>
            <strong>{VALIDACAO_LABEL[ficha.validacao]} pela equipe de Inovação.</strong>
            {ficha.parecer && <> {ficha.parecer}</>}
            {podeEditar && ficha.validacao === 'validada' && (
              <> Alterar a ficha a devolve para validação.</>
            )}
          </span>
        </div>
      )}
      {!podeEditar && (
        <div className="pg-aviso tom-info">
          <AlertCircle size={16} /> Só quem registrou a solução preenche a ficha. Você está vendo para consulta.
        </div>
      )}

      {erro && (
        <div className="pg-aviso tom-erro" tabIndex={-1} ref={avisoRef}>
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      <form onSubmit={salvar} noValidate>
        {/* fieldset desabilitado trava todos os campos de uma vez para quem só lê. */}
        <fieldset className="pg-roi-fieldset" disabled={!podeEditar}>
          <div className="pg-card">
            <h2 className="pg-card-tit">Dados da solução</h2>

            {/* Nome, responsável e área vêm do registro: digitar de novo aqui
                abriria duas versões do mesmo dado. */}
            <dl className="pg-valores pg-roi-ident">
              <div><dt>Solução</dt><dd>#{registro.numero} — {registro.titulo}</dd></div>
              <div><dt>Responsável · área</dt><dd>{registro.autorNome || '—'} · {registro.setor}</dd></div>
            </dl>

            <div className="pg-campo">
              <label>Participou de workshop da PHD?<span className="req">*</span></label>
              <div className="pg-chips">
                {[[true, 'Sim'], [false, 'Não']].map(([valor, label]) => (
                  <button
                    key={label} type="button"
                    className={`pg-chip ${v.workshop === valor ? 'is-on' : ''}`}
                    aria-pressed={v.workshop === valor}
                    onClick={() => escolher('workshop', valor)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {v.workshop === true && (
              <div className="pg-campo">
                <label htmlFor="workshop_qual">Qual workshop?<span className="req">*</span></label>
                <input
                  id="workshop_qual" className="pg-input" value={v.workshop_qual} onChange={set('workshop_qual')}
                  placeholder="Ex.: Workshop de automação de processos"
                />
              </div>
            )}

            <div className="pg-campo">
              <label htmlFor="problema">Problema e melhoria<span className="req">*</span></label>
              <textarea
                id="problema" className="pg-textarea" value={v.problema} onChange={set('problema')}
                placeholder="Qual desafio real foi resolvido e o que mudou na prática?"
              />
            </div>

            <div className="pg-dupla">
              <div className="pg-campo">
                <label htmlFor="medicao_inicio">Início da medição<span className="req">*</span></label>
                <input id="medicao_inicio" type="date" className="pg-input" value={v.medicao_inicio} onChange={set('medicao_inicio')} />
              </div>
              <div className="pg-campo">
                <label htmlFor="medicao_fim">Fim da medição<span className="req">*</span></label>
                <input id="medicao_fim" type="date" className="pg-input" value={v.medicao_fim} onChange={set('medicao_fim')} />
              </div>
            </div>
          </div>

          <div className="pg-card">
            <div className="pg-roi-cab">
              <h2 className="pg-card-tit">Economia de tempo</h2>
              <span className={`pg-badge ${SELO[tempo.estado].tom}`}>{SELO[tempo.estado].label}</span>
            </div>

            <div className="pg-dupla">
              <div className="pg-campo">
                <label htmlFor="tempo_antes">Tempo antes, por execução<span className="req">*</span></label>
                <input id="tempo_antes" type="number" min="0" step="0.1" inputMode="decimal" className="pg-input" value={v.tempo_antes} onChange={set('tempo_antes')} placeholder="0" />
              </div>
              <div className="pg-campo">
                <label htmlFor="tempo_depois">Tempo depois, por execução<span className="req">*</span></label>
                <input id="tempo_depois" type="number" min="0" step="0.1" inputMode="decimal" className="pg-input" value={v.tempo_depois} onChange={set('tempo_depois')} placeholder="0" />
              </div>
              <div className="pg-campo">
                <label htmlFor="tempo_unidade">Unidade<span className="req">*</span></label>
                <select id="tempo_unidade" className="pg-select" value={v.tempo_unidade} onChange={set('tempo_unidade')}>
                  <option value="">Selecione…</option>
                  {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.label}</option>)}
                </select>
              </div>
              <div className="pg-campo">
                <label htmlFor="tempo_execucoes">Medições realizadas<span className="req">*</span></label>
                <input id="tempo_execucoes" type="number" min="0" step="1" inputMode="numeric" className="pg-input" value={v.tempo_execucoes} onChange={set('tempo_execucoes')} placeholder="0" />
              </div>
            </div>

            <dl className="pg-valores pg-roi-metricas">
              <div><dt>Horas poupadas</dt><dd>{tempo.estado === 'ok' ? `${horasFmt(tempo.horas)} h` : '—'}</dd></div>
              <div><dt>Redução de tempo</dt><dd>{tempo.estado === 'ok' ? pct.format(tempo.reducao) : '—'}</dd></div>
            </dl>
            {tempo.estado === 'revisar' && (
              <p className="pg-roi-revisar">O tempo depois não pode ser maior que o de antes, e antes e medições precisam ser maiores que zero.</p>
            )}

            <div className="pg-campo pg-roi-depois">
              <label htmlFor="detalhe_tempo">Detalhar economia de tempo<span className="req">*</span></label>
              <textarea
                id="detalhe_tempo" className="pg-textarea" value={v.detalhe_tempo} onChange={set('detalhe_tempo')}
                placeholder="Como a medição foi feita, qual período foi usado, quais etapas foram contadas e quem pode confirmar."
              />
              <p className="pg-campo-dica">
                Conte preparação, execução, conferência e retrabalho. Some o esforço das pessoas envolvidas uma única vez.
              </p>
            </div>
          </div>

          <div className="pg-card">
            <div className="pg-roi-cab">
              <h2 className="pg-card-tit">Retorno financeiro</h2>
              <span className={`pg-badge ${SELO[fin.estado].tom}`}>{SELO[fin.estado].label}</span>
            </div>

            <div className="pg-campo">
              <label htmlFor="gasto_descricao">Gasto reduzido ou evitado</label>
              <input
                id="gasto_descricao" className="pg-input" value={v.gasto_descricao} onChange={set('gasto_descricao')}
                placeholder="Ex.: horas extras, retrabalho, contratação, material"
              />
            </div>

            <div className="pg-dupla">
              {[
                ['gasto_antes', 'Gasto antes, no período'],
                ['gasto_atual', 'Gasto atual, sem o custo da solução'],
                ['custo_solucao', 'Custo da solução no período'],
              ].map(([campo, rotulo]) => (
                <div className="pg-campo" key={campo}>
                  <label htmlFor={campo}>{rotulo}<span className="req">*</span></label>
                  <span className="pg-prefixado">
                    <span className="pg-prefixo">R$</span>
                    <input
                      id={campo} type="number" min="0" step="0.01" inputMode="decimal"
                      className="pg-input" value={v[campo]} onChange={set(campo)} placeholder="0,00"
                    />
                  </span>
                </div>
              ))}
            </div>

            <dl className="pg-valores pg-roi-metricas">
              <div><dt>Economia líquida</dt><dd>{fin.estado === 'ok' ? brl.format(fin.economia) : '—'}</dd></div>
              <div><dt>Redução de custo</dt><dd>{fin.estado !== 'ok' ? '—' : fin.reducao === null ? 'n.a.' : pct.format(fin.reducao)}</dd></div>
              <div><dt>ROI financeiro</dt><dd>{fin.estado !== 'ok' ? '—' : fin.roi === null ? 'n.a.' : pct.format(fin.roi)}</dd></div>
            </dl>
            {fin.estado === 'revisar' && (
              <p className="pg-roi-revisar">O gasto atual mais o custo da solução passa do gasto de antes: a economia ficaria negativa.</p>
            )}

            <div className="pg-campo pg-roi-depois">
              <label htmlFor="detalhe_financeiro">Detalhar retorno financeiro<span className="req">*</span></label>
              <textarea
                id="detalhe_financeiro" className="pg-textarea" value={v.detalhe_financeiro} onChange={set('detalhe_financeiro')}
                placeholder="Base de cálculo, evidências, fontes dos valores, período considerado e quem pode confirmar."
              />
              <p className="pg-campo-dica">
                “Gasto atual” exclui o custo da solução para não contar duas vezes. Ferramenta de mercado só é
                elegível se o retorno descontar o valor da ferramenta.
              </p>
            </div>
          </div>

          <div className="pg-card">
            <div className="pg-roi-cab">
              <h2 className="pg-card-tit">Facilidade de implantação e uso</h2>
              <span className={`pg-badge ${fac.completa ? 'tom-andamento' : 'tom-neutro'}`}>
                {fac.completa ? `${fac.nota}/8` : 'Pendente'}
              </span>
            </div>

            {FACILIDADE.map((q) => (
              <div className="pg-campo" key={q.campo}>
                <label>{q.pergunta}<span className="req">*</span></label>
                <div className="pg-chips">
                  {q.opcoes.map((o) => (
                    <button
                      key={o.pontos} type="button"
                      className={`pg-chip ${v[q.campo] === o.pontos ? 'is-on' : ''}`}
                      aria-pressed={v[q.campo] === o.pontos}
                      onClick={() => escolher(q.campo, o.pontos)}
                    >
                      {o.label} <span className="pg-roi-pts">· {o.pontos} pt{o.pontos === 1 ? '' : 's'}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="pg-card">
          <div className="pg-roi-cab">
            <h2 className="pg-card-tit">Prontidão para avaliação</h2>
            <span className={`pg-badge ${faltam ? 'tom-neutro' : 'tom-ok'}`}>
              {faltam ? `Pendências: ${faltam}` : 'Completa'}
            </span>
          </div>

          <ul className="pg-roi-checklist">
            {checks.map((c) => (
              <li key={c.chave} className={c.ok ? 'is-ok' : ''}>
                {c.ok
                  ? <CheckCircle2 size={16} role="img" aria-label="ok:" />
                  : <Circle size={16} role="img" aria-label="pendente:" />}
                {c.label}
              </li>
            ))}
          </ul>

          {eleg === 'elegivel' && (
            <p className="pg-roi-eleg tom-ok">
              <strong>Elegível ao ranking.</strong> Workshop registrado. A equipe de Inovação ainda valida os
              números e os demais critérios.
            </p>
          )}
          {eleg === 'nao_elegivel' && (
            <p className="pg-roi-eleg tom-atencao">
              <strong>Não elegível ao ranking.</strong> Sem workshop da PHD, a ficha é enviada do mesmo jeito,
              mas a solução não concorre ao ranking nem à premiação.
            </p>
          )}
          <p className="pg-campo-dica">
            Dá para salvar com pendências e voltar depois. Só ficha completa e validada pela equipe de
            Inovação entra no <Link className="pg-link" to="/programas/ranking">Ranking</Link>.
          </p>
        </div>

        {podeEditar && (
          <>
            <div className="pg-acoes">
              <button type="button" className="pg-btn pg-btn-ghost" onClick={() => navigate('/programas/ideias')}>
                Cancelar
              </button>
              <button type="submit" className="pg-btn pg-btn-primary" disabled={salvando}>
                {salvando ? <><Loader2 size={16} className="pg-spin" /> Salvando…</> : <><Save size={16} /> Salvar ficha</>}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
