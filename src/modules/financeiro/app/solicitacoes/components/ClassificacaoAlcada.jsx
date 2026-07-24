import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck, TrendingUp } from 'lucide-react';
import { CATEGORIAS, avaliarAlcada } from '../../../../../config/alcadas';
import { resolverPapeis } from '../../../../../services/alcadas';
import { formatarMoeda } from '../../../../../utils/formatters';

/**
 * §6, pilar 1 — Classificação obrigatória (categoria + dentro/fora do orçamento)
 * e pilar 2 — Workflow por faixa, mostrado ANTES do envio.
 *
 * O preview existe para tirar a alçada da caixa-preta: quem solicita vê, ainda
 * digitando, em que nível caiu e quem vai precisar aprovar. Isso também expõe
 * cedo a lacuna de papel não atribuído (ex.: Jurídico), que bloquearia o envio.
 */
export default function ClassificacaoAlcada({
  valor, categoria, dentroOrcamento, onChange, solicitanteId, erros = [],
}) {
  const [previa, setPrevia] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const temErro = (id) => erros.includes(id);
  const classificado = !!categoria && dentroOrcamento != null;

  // Recalcula a prévia quando valor/categoria/orçamento mudam. O debounce evita
  // uma chamada por tecla digitada no campo de valor.
  useEffect(() => {
    if (!classificado || !solicitanteId) { setPrevia(null); return undefined; }

    let vivo = true;
    const t = setTimeout(async () => {
      setCarregando(true);
      try {
        const decisao = avaliarAlcada({
          tabela: 'compras',
          valor: Number(valor) || 0,
          modificadores: dentroOrcamento === false ? ['fora_orcamento'] : [],
          gatilhos: categoria === 'capex' ? ['capex_relevante'] : [],
        });
        const [alcada, parecer] = await Promise.all([
          resolverPapeis(solicitanteId, decisao.papeis),
          resolverPapeis(solicitanteId, decisao.pareceres),
        ]);
        if (vivo) {
          setPrevia({
            decisao,
            aprovadores: [...alcada.etapas, ...parecer.etapas],
            lacunas: [...alcada.lacunas, ...parecer.lacunas],
          });
        }
      } catch {
        if (vivo) setPrevia(null);   // preview é auxiliar: falhar aqui não bloqueia o form
      } finally {
        if (vivo) setCarregando(false);
      }
    }, 400);

    return () => { vivo = false; clearTimeout(t); };
  }, [valor, categoria, dentroOrcamento, solicitanteId, classificado]);

  return (
    <div className="alc-bloco">
      <div className="alc-bloco-head">
        <ShieldCheck size={15} />
        <span>Classificação da despesa</span>
        <small>Obrigatória para o sistema definir a alçada</small>
      </div>

      <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
        <label className="form-label">Categoria <span className="required">*</span></label>
        <select
          className="form-select"
          value={categoria || ''}
          onChange={(e) => onChange({ categoria: e.target.value || null })}
        >
          <option value="">Selecione a natureza da despesa...</option>
          {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
        </select>
        {temErro('categoria') && <span className="fin-erro-campo">Obrigatório</span>}
      </div>

      <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
        <label className="form-label">Orçamento <span className="required">*</span></label>
        <div className="alc-radios">
          <label className={`alc-radio ${dentroOrcamento === true ? 'is-on' : ''}`}>
            <input
              type="radio" name="dentro_orcamento" checked={dentroOrcamento === true}
              onChange={() => onChange({ dentro_orcamento: true })}
            />
            <span>Dentro do orçamento aprovado</span>
          </label>
          <label className={`alc-radio ${dentroOrcamento === false ? 'is-on' : ''}`}>
            <input
              type="radio" name="dentro_orcamento" checked={dentroOrcamento === false}
              onChange={() => onChange({ dentro_orcamento: false })}
            />
            <span>Fora do orçamento</span>
          </label>
        </div>
        {temErro('dentro_orcamento') && <span className="fin-erro-campo">Escolha uma opção</span>}
        {dentroOrcamento === false && (
          <div className="alc-modificador">
            <TrendingUp size={13} />
            Despesa fora do orçamento sobe <strong>+1 nível</strong> de alçada e gera alerta à diretoria.
          </div>
        )}
      </div>

      {carregando && (
        <div className="fin-hint"><Loader2 size={13} className="animate-spin" /> Calculando a alçada...</div>
      )}

      {!carregando && previa && (
        <div className={`alc-previa ${previa.lacunas.length ? 'is-bloqueado' : ''}`}>
          <div className="alc-previa-head">
            <span className="alc-nivel">Nível {previa.decisao.nivelFinal}</span>
            <span className="alc-rotulo">{previa.decisao.rotuloNivel}</span>
            <span className="alc-valor">{formatarMoeda(Number(valor) || 0)}</span>
          </div>

          {previa.decisao.degrausAplicados > 0 && (
            <div className="alc-previa-mods">
              Elevado do nível {previa.decisao.nivelBase} para o {previa.decisao.nivelFinal}:
              {' '}{previa.decisao.excecoes.join(' · ')}
            </div>
          )}

          {previa.lacunas.length > 0 ? (
            <div className="fin-aviso" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <AlertTriangle size={15} />
              Esta alçada exige um papel sem ninguém atribuído. O envio ficará bloqueado até
              o Financeiro configurar em Alçadas → Papéis.
            </div>
          ) : (
            <ul className="alc-previa-lista">
              {previa.aprovadores.map((a, i) => (
                <li key={`${a.papel}-${i}`}>
                  <span className="alc-previa-num">{i + 1}</span>
                  <strong>{a.nome}</strong>
                  {a.candidatos.length > 1 && (
                    <em> — qualquer um: {a.candidatos.map((c) => c.nome).join(', ')}</em>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="alc-previa-nota">
            Estes aprovadores entram <strong>além</strong> da sua cadeia configurada em Fluxos.
          </p>
        </div>
      )}
    </div>
  );
}
