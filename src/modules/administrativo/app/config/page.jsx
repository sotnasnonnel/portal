import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Settings2, Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { CLASSES_ADM, CAMPOS_EXTRAS_VISIVEIS } from '../../../../config/administrativo';
import { listarConfigs, salvarConfigServico, listarPessoas } from '../../lib/chamados';
import { TIPOS_CAMPO, chaveUnica } from '../../lib/camposExtras';
import { schemaDoServico } from '../novo/formularios/schemas';

const PREFIXO_NOVO = '__novo_';

const CONFIG_VAZIA = {
  atendente_id: null, sla_dias_uteis: null, exige_aprovacao: false, aprovadores: [], campos_extras: [],
};

// Cópia editável da config salva (nunca mutar o objeto que veio do banco).
const rascunhoDe = (cfg = CONFIG_VAZIA) => ({
  atendente_id: cfg.atendente_id ?? null,
  sla_dias_uteis: cfg.sla_dias_uteis ?? null,
  exige_aprovacao: !!cfg.exige_aprovacao,
  aprovadores: [...(cfg.aprovadores || [])],
  campos_extras: (cfg.campos_extras || []).map((c) => ({ ...c })),
});

const selecaoDe = (classe, servicoItem) => ({
  classeSlug: classe.slug, classeLabel: classe.label,
  slug: servicoItem.slug, label: servicoItem.label,
});

export default function ConfigAdm() {
  const { modules } = useAuth();
  const [configs, setConfigs] = useState({});      // "classe/servico" -> config
  const [pessoas, setPessoas] = useState([]);
  const [sel, setSel] = useState(null);            // { classeSlug, classeLabel, slug, label }
  const [rascunho, setRascunho] = useState(CONFIG_VAZIA);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [lista, gente] = await Promise.all([listarConfigs(), listarPessoas()]);
        const mapa = {};
        lista.forEach((c) => { mapa[`${c.classe}/${c.servico}`] = c; });
        setConfigs(mapa);
        setPessoas(gente);
        // Já abre no primeiro serviço: o editor (e o botão de adicionar campo)
        // precisa estar à vista, senão a tela parece só uma lista.
        const primeira = CLASSES_ADM[0];
        const primeiro = primeira.servicos[0];
        setSel(selecaoDe(primeira, primeiro));
        setRascunho(rascunhoDe(mapa[`${primeira.slug}/${primeiro.slug}`]));
      } catch (e) {
        setErro(e.message);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const nomePessoa = useMemo(
    () => Object.fromEntries(pessoas.map((p) => [p.id, p.nome])),
    [pessoas],
  );

  // Gate de UI — a RLS é quem realmente barra a escrita.
  if (modules?.administrativo !== 'admin') return <Navigate to="/administrativo/novo" replace />;

  const abrir = (classe, servicoItem) => {
    setSel(selecaoDe(classe, servicoItem));
    setRascunho(rascunhoDe(configs[`${classe.slug}/${servicoItem.slug}`]));
    setErro('');
    setSalvo('');
  };

  const mexer = (patch) => setRascunho((r) => ({ ...r, ...patch }));

  // ---- campos extras ----
  // Campo novo nasce com uma chave temporária só para servir de key no React;
  // a chave definitiva é derivada do rótulo na hora de salvar. Campo já salvo
  // NUNCA tem a chave regerada — ela é o nome da propriedade em
  // chamados_adm.campos, e trocá-la faria os chamados antigos perderem o valor.
  const addCampo = () => setRascunho((r) => ({
    ...r,
    campos_extras: [
      ...r.campos_extras,
      { chave: `${PREFIXO_NOVO}${crypto.randomUUID().slice(0, 8)}`, rotulo: '', tipo: 'texto', obrigatorio: false, opcoes: [] },
    ],
  }));

  const mudarCampo = (i, patch) => setRascunho((r) => ({
    ...r,
    campos_extras: r.campos_extras.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
  }));

  const removerCampo = (i) => setRascunho((r) => ({
    ...r, campos_extras: r.campos_extras.filter((_, idx) => idx !== i),
  }));

  const moverCampo = (i, delta) => setRascunho((r) => {
    const destino = i + delta;
    if (destino < 0 || destino >= r.campos_extras.length) return r;
    const copia = [...r.campos_extras];
    [copia[i], copia[destino]] = [copia[destino], copia[i]];
    return { ...r, campos_extras: copia };
  });

  const salvar = async () => {
    // Rótulo vazio viraria um campo sem nome no formulário do solicitante.
    const semRotulo = rascunho.campos_extras.findIndex((c) => !c.rotulo.trim());
    if (semRotulo >= 0) return setErro(`Dê um nome ao campo ${semRotulo + 1}.`);
    setSalvando(true);
    setErro('');
    try {
      // Chave definitiva dos campos novos, derivada do rótulo. As já salvas
      // passam intactas para não órfãos os valores gravados nos chamados.
      //
      // As chaves do próprio serviço entram na lista de ocupadas: um campo
      // extra chamado "Valor base" geraria a chave `valor_base` e sobrescreveria
      // o campo do formulário dentro do mesmo jsonb, sem aviso.
      const usadas = [
        ...(schemaDoServico(sel.classeSlug, sel.slug) || []).map((c) => c.chave),
        ...rascunho.campos_extras
          .filter((c) => !c.chave.startsWith(PREFIXO_NOVO)).map((c) => c.chave),
      ];
      const dados = {
        ...rascunho,
        sla_dias_uteis: rascunho.sla_dias_uteis === '' ? null : rascunho.sla_dias_uteis,
        campos_extras: rascunho.campos_extras.map((c) => {
          let { chave } = c;
          if (chave.startsWith(PREFIXO_NOVO)) {
            chave = chaveUnica(c.rotulo, usadas);
            usadas.push(chave);
          }
          return {
            chave,
            rotulo: c.rotulo.trim(),
            tipo: c.tipo,
            obrigatorio: !!c.obrigatorio,
            opcoes: c.tipo === 'selecao' ? (c.opcoes || []).filter(Boolean) : [],
          };
        }),
      };
      await salvarConfigServico(sel.classeSlug, sel.slug, dados);
      setConfigs((m) => ({ ...m, [`${sel.classeSlug}/${sel.slug}`]: { ...dados } }));
      // Devolve o rascunho já com as chaves definitivas: sem isto, salvar duas
      // vezes seguidas geraria chave nova para os mesmos campos.
      setRascunho(dados);
      setSalvo('Configuração salva.');
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const resumo = (chave) => {
    const c = configs[chave];
    if (!c) return 'Não configurado';
    const partes = [];
    partes.push(c.atendente_id ? (nomePessoa[c.atendente_id] || 'Atendente definido') : 'Sem atendente');
    partes.push(c.sla_dias_uteis ? `SLA ${c.sla_dias_uteis} dia${c.sla_dias_uteis > 1 ? 's' : ''} úteis` : 'Sem SLA');
    if (c.exige_aprovacao) partes.push('Com alçada');
    const n = (c.campos_extras || []).length;
    if (n) partes.push(`${n} campo${n > 1 ? 's' : ''}`);
    return partes.join(' · ');
  };

  return (
    <div className="adm-page adm-page-wide">
      <h1 className="adm-title"><Settings2 size={24} /> Configuração dos serviços</h1>
      <p className="adm-sub">
        Defina quem atende, o prazo de atendimento e a alçada de aprovação de cada serviço.
      </p>

      {erro && <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}
      {salvo && <div className="adm-aviso tom-info"><CheckCircle2 size={16} /> {salvo}</div>}

      {carregando ? (
        <div className="adm-vazio"><Loader2 size={20} className="adm-spin" /> Carregando…</div>
      ) : (
        <div className="adm-cfg">
          <aside className="adm-cfg-lista">
            {CLASSES_ADM.map((c) => (
              <div key={c.slug} className="adm-cfg-grupo">
                <div className="adm-cfg-grupo-tit">{c.label}</div>
                {c.servicos.map((s) => {
                  const chave = `${c.slug}/${s.slug}`;
                  const ativo = sel?.classeSlug === c.slug && sel?.slug === s.slug;
                  return (
                    <button key={chave} type="button"
                      className={`adm-cfg-item ${ativo ? 'is-active' : ''}`}
                      onClick={() => abrir(c, s)}>
                      <strong>{s.label}</strong>
                      <small>{resumo(chave)}</small>
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          <section className="adm-cfg-editor">
            {!sel ? (
              <div className="adm-vazio">Escolha um serviço à esquerda para configurar.</div>
            ) : (
              <>
                <div className="adm-card">
                  <h2 className="adm-card-tit">{sel.classeLabel} · {sel.label}</h2>

                  <div className="adm-campo">
                    <label htmlFor="cfg-atendente">Atendente responsável</label>
                    <select id="cfg-atendente" className="adm-select"
                      value={rascunho.atendente_id || ''}
                      onChange={(e) => mexer({ atendente_id: e.target.value || null })}>
                      <option value="">Sem atendente definido</option>
                      {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                    <span className="adm-campo-dica">
                      É o nome que aparece para o solicitante ao abrir o chamado.
                    </span>
                  </div>

                  <div className="adm-campo">
                    <label htmlFor="cfg-sla">Prazo de atendimento (dias úteis)</label>
                    <input id="cfg-sla" type="number" min="1" className="adm-input"
                      value={rascunho.sla_dias_uteis ?? ''}
                      onChange={(e) => mexer({ sla_dias_uteis: e.target.value ? Number(e.target.value) : null })} />
                    <span className="adm-campo-dica">
                      Sábado e domingo não contam. Com alçada, o prazo só começa depois da aprovação.
                    </span>
                  </div>

                  <div className="adm-campo">
                    <label className="adm-check">
                      <input type="checkbox" checked={rascunho.exige_aprovacao}
                        onChange={(e) => mexer({ exige_aprovacao: e.target.checked })} />
                      Exige aprovação antes de virar tarefa do Administrativo
                    </label>
                  </div>

                  {/* Não há aprovador a escolher: quem aprova é o superior
                      direto de quem abriu, lido do organograma da Gestão de
                      Pessoas — mesma regra das horas extras. */}
                  {rascunho.exige_aprovacao && (
                    <p className="adm-campo-dica">
                      O chamado vai para o fluxo cadastrado do solicitante ou, na falta dele,
                      para o superior direto. Quem não tem nenhum dos dois não consegue abrir
                      o chamado — só a direção, que não tem a quem recorrer, passa direto.
                    </p>
                  )}
                </div>

                {/* Escondido enquanto a tela não é validada. O rascunho carrega
                    os campos já gravados e os devolve intactos no salvar, então
                    esconder aqui não apaga nada de quem já cadastrou. */}
                {CAMPOS_EXTRAS_VISIVEIS && (
                <div className="adm-card">
                  <h2 className="adm-card-tit">Campos extras</h2>
                  {rascunho.campos_extras.length === 0 && (
                    <p className="adm-campo-dica">
                      Nenhum campo cadastrado — o solicitante verá só descrição e anexos.
                    </p>
                  )}

                  {rascunho.campos_extras.map((campo, i) => (
                    <div key={campo.chave} className="adm-cfg-campo">
                      <div className="adm-linha">
                        <input type="text" className="adm-input" placeholder="Nome do campo"
                          value={campo.rotulo}
                          onChange={(e) => mudarCampo(i, { rotulo: e.target.value })} />
                        <select className="adm-select adm-select-curto" value={campo.tipo}
                          onChange={(e) => mudarCampo(i, { tipo: e.target.value })}>
                          {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                        </select>
                        <button type="button" className="adm-anexo-x" title="Subir"
                          onClick={() => moverCampo(i, -1)}><ChevronUp size={15} /></button>
                        <button type="button" className="adm-anexo-x" title="Descer"
                          onClick={() => moverCampo(i, 1)}><ChevronDown size={15} /></button>
                        <button type="button" className="adm-anexo-x" title="Remover"
                          onClick={() => removerCampo(i)}><Trash2 size={15} /></button>
                      </div>

                      {campo.tipo === 'selecao' && (
                        <input type="text" className="adm-input" placeholder="Opções separadas por vírgula"
                          value={(campo.opcoes || []).join(', ')}
                          onChange={(e) => mudarCampo(i, {
                            opcoes: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                          })} />
                      )}

                      <label className="adm-check">
                        <input type="checkbox" checked={!!campo.obrigatorio}
                          onChange={(e) => mudarCampo(i, { obrigatorio: e.target.checked })} />
                        Obrigatório
                      </label>
                    </div>
                  ))}

                  <button type="button" className="adm-anexo-btn" onClick={addCampo}>
                    <Plus size={16} /> Adicionar campo
                  </button>
                </div>
                )}

                <div className="adm-acoes">
                  <button type="button" className="adm-btn adm-btn-primary" onClick={salvar} disabled={salvando}>
                    {salvando ? <><Loader2 size={16} className="adm-spin" /> Salvando…</> : <><Save size={16} /> Salvar</>}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
