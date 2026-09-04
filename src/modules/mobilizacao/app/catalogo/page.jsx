import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Settings2, Loader2, AlertCircle, Check, Plus, EyeOff, Info, TriangleAlert,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  ehAdminMobilizacao, FLUXOS, rotuloFluxo, PAPEIS_RESPONSAVEL,
} from '../../../../config/mobilizacao';
import { hojeIso } from '../../../../utils/diasUteis';
import { listarCatalogo, salvarEtapaCatalogo, desativarEtapaCatalogo, listarTime } from '../../lib/mobilizacao';
import { ordenarEtapas, validarCatalogo, temErro, codigoDoTitulo } from '../../lib/catalogo';
import { projetarDatas } from '../../lib/prazoEtapa';

const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

const NOVA = (fluxo, ordem) => ({
  fluxo, codigo: '', ordem, titulo: '', descricao: '',
  depende_de: '', sla_dias_uteis: 1, responsavel_id: '', responsavel_papel: '', ativo: true,
});

export default function CatalogoMob() {
  const { modules } = useAuth();
  const admin = ehAdminMobilizacao(modules);

  const [fluxo, setFluxo] = useState('mobilizacao_pessoa');
  const [catalogo, setCatalogo] = useState([]);
  const [time, setTime] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [salvando, setSalvando] = useState('');
  const [nova, setNova] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setCatalogo(await listarCatalogo());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { listarTime().then(setTime).catch(() => {}); }, []);

  const doFluxo = useMemo(
    () => ordenarEtapas(catalogo.filter((e) => e.fluxo === fluxo && e.ativo !== false)),
    [catalogo, fluxo],
  );

  const problemas = useMemo(() => validarCatalogo(doFluxo), [doFluxo]);

  // Prévia com a MESMA regra do banco, a partir de hoje: é o que deixa a
  // divergência entre o espelho JS e o plpgsql aparecer na hora, em vez de
  // depois, num processo real.
  const previa = useMemo(() => projetarDatas(doFluxo, hojeIso()), [doFluxo]);

  const salvar = async (etapa) => {
    const codigo = (etapa.codigo || codigoDoTitulo(etapa.titulo)).trim();
    if (!codigo || !etapa.titulo?.trim()) { setErro('Etapa precisa de título.'); return; }

    setSalvando(codigo);
    setErro('');
    setOk('');
    try {
      await salvarEtapaCatalogo({ ...etapa, codigo });
      await carregar();
      setNova(null);
      setOk(`Etapa "${etapa.titulo}" salva.`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando('');
    }
  };

  const desativar = async (id, titulo) => {
    setSalvando(id);
    setErro('');
    try {
      await desativarEtapaCatalogo(id);
      await carregar();
      setOk(`Etapa "${titulo}" desativada. Os processos em curso não mudam.`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando('');
    }
  };

  if (!admin) {
    return (
      <div className="mob-page">
        <h1 className="mob-title"><Settings2 size={24} /> Catálogo e SLAs</h1>
        <div className="mob-aviso tom-info">
          <Info size={16} /> Só o administrador do Administrativo configura o catálogo de etapas.
        </div>
      </div>
    );
  }

  return (
    <div className="mob-page mob-page-wide">
      <h1 className="mob-title"><Settings2 size={24} /> Catálogo e SLAs</h1>
      <p className="mob-sub">
        Os passos de cada fluxo, de quem cada um depende e quantos dias úteis leva.
        Mudança aqui vale para processos NOVOS: os que já estão rodando guardam os prazos
        com que nasceram, para não reescrever o passado.
      </p>

      <div className="mob-tabs">
        {FLUXOS.map((f) => (
          <button key={f.slug} type="button"
            className={`mob-tab ${fluxo === f.slug ? 'is-active' : ''}`}
            onClick={() => { setFluxo(f.slug); setNova(null); }}>
            <f.Icon size={15} /> {f.label}
          </button>
        ))}
      </div>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}
      {ok && <div className="mob-aviso tom-ok"><Check size={16} /> {ok}</div>}

      {problemas.map((p, i) => (
        <div key={`${p.codigo}-${i}`} className={`mob-aviso ${p.nivel === 'erro' ? 'tom-erro' : 'tom-alerta'}`}>
          <TriangleAlert size={16} /> <strong>{p.codigo || 'catálogo'}</strong>: {p.texto}
        </div>
      ))}
      {temErro(problemas) && (
        <p className="mob-campo-dica">
          Enquanto houver erro acima, um processo aberto neste fluxo pode nascer com etapas sem prazo.
        </p>
      )}

      {carregando ? (
        <div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div>
      ) : (
        <>
          {!doFluxo.length && (
            <div className="mob-aviso tom-alerta">
              <AlertCircle size={16} />
              O catálogo de {rotuloFluxo(fluxo)} está vazio: processos deste fluxo nascem sem passo nenhum.
            </div>
          )}

          {doFluxo.map((e) => (
            <LinhaEtapa
              key={e.id}
              etapa={e}
              irmas={doFluxo}
              time={time}
              previsto={previa[e.codigo]}
              salvando={salvando === e.codigo || salvando === e.id}
              onSalvar={salvar}
              onDesativar={() => desativar(e.id, e.titulo)}
            />
          ))}

          {nova ? (
            <LinhaEtapa
              etapa={nova}
              irmas={doFluxo}
              time={time}
              previsto={null}
              salvando={!!salvando}
              onSalvar={salvar}
              onCancelar={() => setNova(null)}
            />
          ) : (
            <button type="button" className="mob-btn mob-btn-ghost"
              onClick={() => setNova(NOVA(fluxo, (doFluxo.at(-1)?.ordem ?? -1) + 1))}>
              <Plus size={16} /> Nova etapa
            </button>
          )}

          <p className="mob-campo-dica" style={{ marginTop: 14 }}>
            A coluna &quot;Previsto&quot; simula um processo aberto hoje ({dataBr(hojeIso())}), com a mesma
            regra que o banco usa. Serve para conferir a cadeia antes de valer para alguém.
          </p>
        </>
      )}
    </div>
  );
}

function LinhaEtapa({ etapa, irmas, time, previsto, salvando, onSalvar, onDesativar, onCancelar }) {
  const [v, setV] = useState(etapa);
  useEffect(() => { setV(etapa); }, [etapa]);

  const trocar = (campo) => (ev) => setV((a) => ({ ...a, [campo]: ev.target.value }));
  const novo = !etapa.id;
  // Uma etapa não pode depender dela mesma, e oferecer a opção só convida ao erro.
  const candidatos = irmas.filter((x) => x.codigo !== v.codigo);

  return (
    <section className="mob-card">
      <h2 className="mob-card-tit">
        {novo ? 'Nova etapa' : `${etapa.ordem} · ${etapa.titulo}`}
        {previsto && <span style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none' }}>
          previsto {dataBr(previsto)}
        </span>}
      </h2>

      <div className="mob-grid2">
        <div className="mob-campo">
          <label htmlFor={`t-${v.codigo || 'novo'}`}>Título *</label>
          <input id={`t-${v.codigo || 'novo'}`} type="text" value={v.titulo} onChange={trocar('titulo')} />
        </div>

        <div className="mob-campo">
          <label htmlFor={`c-${v.codigo || 'novo'}`}>Código</label>
          <input id={`c-${v.codigo || 'novo'}`} type="text" value={v.codigo}
            onChange={trocar('codigo')} disabled={!novo}
            placeholder={codigoDoTitulo(v.titulo)} />
          <span className="mob-campo-dica">
            {novo
              ? 'Em branco, sai do título.'
              : 'Não muda: é por ele que as etapas já criadas se ligam a este passo.'}
          </span>
        </div>

        <div className="mob-campo">
          <label htmlFor={`o-${v.codigo || 'novo'}`}>Ordem</label>
          <input id={`o-${v.codigo || 'novo'}`} type="number" value={v.ordem} onChange={trocar('ordem')} />
        </div>

        <div className="mob-campo">
          <label htmlFor={`d-${v.codigo || 'novo'}`}>Depende de</label>
          <select id={`d-${v.codigo || 'novo'}`} value={v.depende_de || ''} onChange={trocar('depende_de')}>
            <option value="">— Etapa raiz (data informada na abertura) —</option>
            {candidatos.map((x) => <option key={x.codigo} value={x.codigo}>{x.titulo}</option>)}
          </select>
        </div>

        <div className="mob-campo">
          <label htmlFor={`s-${v.codigo || 'novo'}`}>SLA (dias úteis)</label>
          <input id={`s-${v.codigo || 'novo'}`} type="number" min="0"
            value={v.sla_dias_uteis ?? ''} onChange={trocar('sla_dias_uteis')} />
          <span className="mob-campo-dica">
            Contados a partir do passo anterior — ou da data-base, na etapa raiz.
          </span>
        </div>

        <div className="mob-campo">
          <label htmlFor={`p-${v.codigo || 'novo'}`}>Área responsável</label>
          <select id={`p-${v.codigo || 'novo'}`} value={v.responsavel_papel || ''} onChange={trocar('responsavel_papel')}>
            <option value="">—</option>
            {Object.entries(PAPEIS_RESPONSAVEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>

        <div className="mob-campo">
          <label htmlFor={`r-${v.codigo || 'novo'}`}>Responsável padrão</label>
          <select id={`r-${v.codigo || 'novo'}`} value={v.responsavel_id || ''} onChange={trocar('responsavel_id')}>
            <option value="">— Nasce sem dono —</option>
            {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="mob-campo">
        <label htmlFor={`de-${v.codigo || 'novo'}`}>Descrição</label>
        <textarea id={`de-${v.codigo || 'novo'}`} value={v.descricao || ''} onChange={trocar('descricao')}
          placeholder="O que precisa acontecer neste passo" />
      </div>

      <div className="mob-etapa-acoes" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="mob-btn mob-btn-primary mob-btn-sm"
          disabled={salvando} onClick={() => onSalvar(v)}>
          {salvando ? <Loader2 size={14} className="mob-spin" /> : <Check size={14} />} Salvar
        </button>

        {onCancelar && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm" onClick={onCancelar}>
            Cancelar
          </button>
        )}

        {/* Desativa, não apaga: excluir quebraria o vínculo das etapas já
            criadas e faria sumir do histórico um passo que aconteceu. */}
        {onDesativar && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm"
            disabled={salvando} onClick={onDesativar}
            title="Some dos processos novos; os em curso não mudam">
            <EyeOff size={14} /> Desativar
          </button>
        )}
      </div>
    </section>
  );
}
