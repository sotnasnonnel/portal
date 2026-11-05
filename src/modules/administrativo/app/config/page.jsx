import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Settings2, Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, AlertCircle, CheckCircle2,
  Search, X, Circle, CircleDashed, RotateCcw, Undo2,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { CLASSES_ADM, CAMPOS_EXTRAS_VISIVEIS } from '../../../../config/administrativo';
import SearchSelect from '../../../../components/UI/SearchSelect';
import { CabecalhoPagina, Carregando, Vazio } from '../components/ui';
import { listarConfigs, salvarConfigServico, listarPessoas } from '../../lib/chamados';
import { TIPOS_CAMPO, chaveUnica } from '../../lib/camposExtras';
import {
  situacaoDaConfig, filtrarServicos, contarSituacoes, rascunhoMudou,
} from '../../lib/configServico';
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

// Ícone E texto: "pronto" e "pendente" não podem depender só da cor na lista.
const SITUACAO = {
  pronto: { Icon: CheckCircle2, texto: 'Pronto' },
  parcial: { Icon: CircleDashed, texto: 'Incompleto' },
  vazio: { Icon: Circle, texto: 'Não configurado' },
};

export default function ConfigAdm() {
  const { modules } = useAuth();
  const [configs, setConfigs] = useState({});      // "classe/servico" -> config
  const [pessoas, setPessoas] = useState([]);
  const [sel, setSel] = useState(null);            // { classeSlug, classeLabel, slug, label }
  const [rascunho, setRascunho] = useState(CONFIG_VAZIA);
  const [carregando, setCarregando] = useState(true);
  const [falhouCarga, setFalhouCarga] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState('');
  const [busca, setBusca] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);
  const editorRef = useRef(null);
  const listaRef = useRef(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setFalhouCarga(false);
    setErro('');
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
      // Sem as configs, a lista diria "Não configurado" em tudo e o admin poderia
      // salvar por cima do que existe. A tela para aqui até conseguir ler.
      setFalhouCarga(true);
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const nomePessoa = useMemo(
    () => Object.fromEntries(pessoas.map((p) => [p.id, p.nome])),
    [pessoas],
  );
  const opcoesAtendente = useMemo(
    () => [{ value: '', label: 'Sem atendente definido' }, ...pessoas.map((p) => ({ value: p.id, label: p.nome }))],
    [pessoas],
  );

  const chaveSel = sel ? `${sel.classeSlug}/${sel.slug}` : null;
  const sujo = !!sel && rascunhoMudou(rascunho, configs[chaveSel]);

  // Fechar a aba com rascunho aberto perde o trabalho sem aviso. A troca de rota
  // dentro do portal fica de fora: o HashRouter não oferece bloqueio de navegação.
  useEffect(() => {
    if (!sujo) return undefined;
    const avisar = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sujo]);

  // A lista encolhe ao filtrar; sem voltar ao topo, ela abria no meio de um grupo,
  // com o título dele escondido acima da dobra.
  useEffect(() => {
    if (listaRef.current) listaRef.current.scrollTop = 0;
  }, [busca, soPendentes]);

  const grupos = useMemo(
    () => filtrarServicos(CLASSES_ADM, { busca, soPendentes, configs, nomePessoa }),
    [busca, soPendentes, configs, nomePessoa],
  );
  const contagem = useMemo(() => contarSituacoes(CLASSES_ADM, configs), [configs]);

  // Gate de UI — a RLS é quem realmente barra a escrita.
  if (modules?.administrativo !== 'admin') return <Navigate to="/administrativo/novo" replace />;

  const abrir = (classe, servicoItem) => {
    const mesmo = sel?.classeSlug === classe.slug && sel?.slug === servicoItem.slug;
    if (!mesmo && sujo
      && !window.confirm(`"${sel.label}" tem alterações não salvas. Descartar e abrir "${servicoItem.label}"?`)) return;
    if (!mesmo) {
      setSel(selecaoDe(classe, servicoItem));
      setRascunho(rascunhoDe(configs[`${classe.slug}/${servicoItem.slug}`]));
      setErro('');
      setSalvo('');
    }
    // Empilhado, o editor fica abaixo da lista: sem rolar, o toque no serviço
    // parece não ter feito nada.
    if (window.matchMedia('(max-width: 900px)').matches) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Toda edição passa por aqui: mexeu, o "salvo" de antes e o erro de antes já
  // não falam do que está na tela.
  const editar = (fn) => {
    setSalvo('');
    setErro('');
    setRascunho(fn);
  };

  const mexer = (patch) => editar((r) => ({ ...r, ...patch }));

  const descartar = () => {
    setRascunho(rascunhoDe(configs[chaveSel]));
    setErro('');
    setSalvo('');
  };

  // ---- campos extras ----
  // Campo novo nasce com uma chave temporária só para servir de key no React;
  // a chave definitiva é derivada do rótulo na hora de salvar. Campo já salvo
  // NUNCA tem a chave regerada — ela é o nome da propriedade em
  // chamados_adm.campos, e trocá-la faria os chamados antigos perderem o valor.
  const addCampo = () => editar((r) => ({
    ...r,
    campos_extras: [
      ...r.campos_extras,
      { chave: `${PREFIXO_NOVO}${crypto.randomUUID().slice(0, 8)}`, rotulo: '', tipo: 'texto', obrigatorio: false, opcoes: [] },
    ],
  }));

  const mudarCampo = (i, patch) => editar((r) => ({
    ...r,
    campos_extras: r.campos_extras.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
  }));

  const removerCampo = (i) => editar((r) => ({
    ...r, campos_extras: r.campos_extras.filter((_, idx) => idx !== i),
  }));

  const moverCampo = (i, delta) => editar((r) => {
    const destino = i + delta;
    if (destino < 0 || destino >= r.campos_extras.length) return r;
    const copia = [...r.campos_extras];
    [copia[i], copia[destino]] = [copia[destino], copia[i]];
    return { ...r, campos_extras: copia };
  });

  const salvar = async () => {
    // Rótulo vazio viraria um campo sem nome no formulário do solicitante.
    const semRotulo = rascunho.campos_extras.findIndex((c) => !c.rotulo.trim());
    if (semRotulo >= 0) {
      setErro(`Dê um nome ao campo ${semRotulo + 1}.`);
      document.getElementById(`cfg-campo-${semRotulo}`)?.focus();
      return;
    }
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
      setConfigs((m) => ({ ...m, [chaveSel]: { ...dados } }));
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
    partes.push(c.sla_dias_uteis
      ? `Prazo de ${c.sla_dias_uteis} ${c.sla_dias_uteis === 1 ? 'dia útil' : 'dias úteis'}`
      : 'Sem prazo');
    if (c.exige_aprovacao) partes.push('Com alçada');
    const n = (c.campos_extras || []).length;
    if (n) partes.push(`${n} campo${n > 1 ? 's' : ''}`);
    return partes.join(' · ');
  };

  const situacaoSel = sel ? situacaoDaConfig(configs[chaveSel]) : 'vazio';
  const SeloIcon = SITUACAO[situacaoSel].Icon;

  return (
    <div className="adm-page adm-page-wide">
      <CabecalhoPagina
        Icon={Settings2}
        titulo="Configuração dos serviços"
        subtitulo="Defina quem atende, o prazo de atendimento e a alçada de aprovação de cada serviço."
      />

      {carregando ? (
        <Carregando />
      ) : falhouCarga ? (
        <div className="adm-aviso tom-erro" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{erro}</span>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm adm-aviso-acao" onClick={carregar}>
            <RotateCcw size={14} aria-hidden="true" /> Tentar de novo
          </button>
        </div>
      ) : (
        <div className="adm-cfg">
          <aside className="adm-cfg-lista" aria-label="Serviços" ref={listaRef}>
            <div className="adm-cfg-topo">
              <div className="adm-cfg-busca">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  className="adm-input"
                  placeholder="Buscar serviço ou atendente…"
                  aria-label="Buscar serviço ou atendente"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                {busca && (
                  <button type="button" className="adm-cfg-limpa" aria-label="Limpar busca" onClick={() => setBusca('')}>
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="adm-cfg-filtro" role="group" aria-label="Filtrar serviços por situação">
                <button
                  type="button"
                  className={`adm-chip ${!soPendentes ? 'is-on' : ''}`}
                  aria-pressed={!soPendentes}
                  onClick={() => setSoPendentes(false)}
                >
                  Todos ({contagem.total})
                </button>
                <button
                  type="button"
                  className={`adm-chip ${soPendentes ? 'is-on' : ''}`}
                  aria-pressed={soPendentes}
                  onClick={() => setSoPendentes(true)}
                >
                  Pendentes ({contagem.pendentes})
                </button>
              </div>
            </div>

            {grupos.length === 0 ? (
              <p className="adm-cfg-nada">
                {soPendentes && !busca
                  ? 'Todos os serviços estão prontos.'
                  : 'Nenhum serviço encontrado.'}
              </p>
            ) : grupos.map((c) => (
              <div key={c.slug} className="adm-cfg-grupo">
                <div className="adm-cfg-grupo-tit">{c.label}</div>
                {c.servicos.map((s) => {
                  const chave = `${c.slug}/${s.slug}`;
                  const ativo = sel?.classeSlug === c.slug && sel?.slug === s.slug;
                  const situacao = situacaoDaConfig(configs[chave]);
                  const { Icon: IconeSit, texto } = SITUACAO[situacao];
                  return (
                    <button key={chave} type="button"
                      className={`adm-cfg-item ${ativo ? 'is-active' : ''}`}
                      aria-current={ativo ? 'true' : undefined}
                      onClick={() => abrir(c, s)}>
                      <span className={`adm-cfg-sit tom-${situacao}`} title={texto}>
                        <IconeSit size={15} role="img" aria-label={texto} />
                      </span>
                      <span className="adm-cfg-item-txt">
                        <strong>{s.label}</strong>
                        <small>{resumo(chave)}</small>
                      </span>
                      {ativo && sujo && <span className="adm-cfg-item-sujo" role="img" title="Alterações não salvas" aria-label="Alterações não salvas" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          <section className="adm-cfg-editor" ref={editorRef} aria-label="Editor do serviço">
            {!sel ? (
              <Vazio Icon={Settings2}>Escolha um serviço à esquerda para configurar.</Vazio>
            ) : (
              <>
                <div className="adm-card">
                  {/* O título era caixa-alta de 11px com classe e serviço juntos,
                      e não se via de relance o que estava aberto. */}
                  <header className="adm-cfg-ed-cab">
                    <div className="adm-cfg-ed-txt">
                      {sel.classeLabel !== sel.label && <small>{sel.classeLabel}</small>}
                      <h2>{sel.label}</h2>
                    </div>
                    <span className={`adm-cfg-selo tom-${situacaoSel}`}>
                      <SeloIcon size={14} aria-hidden="true" /> {SITUACAO[situacaoSel].texto}
                    </span>
                  </header>

                  <div className="adm-cfg-grade">
                    <div className="adm-campo">
                      <span className="adm-campo-rotulo">Atendente responsável</span>
                      <SearchSelect
                        value={rascunho.atendente_id || ''}
                        onChange={(v) => mexer({ atendente_id: v || null })}
                        options={opcoesAtendente}
                        // Atendente salvo que saiu da lista não pode aparecer como
                        // "sem atendente": o cadastro existe e continua valendo.
                        placeholder={rascunho.atendente_id ? 'Pessoa fora da lista' : 'Sem atendente definido'}
                        ariaLabel="Atendente responsável"
                      />
                      <span className="adm-campo-dica">
                        É o nome que aparece para o solicitante ao abrir o chamado.
                      </span>
                    </div>

                    <div className="adm-campo">
                      <label htmlFor="cfg-sla">Prazo de atendimento</label>
                      <div className="adm-cfg-sla">
                        <input id="cfg-sla" type="number" min="1" className="adm-input"
                          aria-describedby="cfg-sla-dica"
                          value={rascunho.sla_dias_uteis ?? ''}
                          onChange={(e) => mexer({ sla_dias_uteis: e.target.value ? Number(e.target.value) : null })} />
                        <span>dias úteis</span>
                      </div>
                      <span className="adm-campo-dica" id="cfg-sla-dica">
                        Sábado e domingo não contam. Com alçada, o prazo só começa depois da aprovação.
                      </span>
                    </div>
                  </div>

                  <div className="adm-campo">
                    <label className="adm-check">
                      <input type="checkbox" checked={rascunho.exige_aprovacao}
                        onChange={(e) => mexer({ exige_aprovacao: e.target.checked })} />
                      Exige aprovação antes de virar tarefa do Atendimento
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
                    <p className="adm-campo-dica adm-cfg-sem-campos">
                      Nenhum campo cadastrado — o solicitante verá só descrição e anexos.
                    </p>
                  )}

                  {rascunho.campos_extras.map((campo, i) => (
                    <div key={campo.chave} className="adm-cfg-campo">
                      <div className="adm-linha">
                        <input id={`cfg-campo-${i}`} type="text" className="adm-input" placeholder="Nome do campo"
                          aria-label={`Nome do campo ${i + 1}`}
                          value={campo.rotulo}
                          onChange={(e) => mudarCampo(i, { rotulo: e.target.value })} />
                        <select className="adm-select adm-select-curto" value={campo.tipo}
                          aria-label={`Tipo do campo ${i + 1}`}
                          onChange={(e) => mudarCampo(i, { tipo: e.target.value })}>
                          {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                        </select>
                        <button type="button" className="adm-anexo-x" title="Subir" aria-label={`Subir o campo ${i + 1}`}
                          disabled={i === 0}
                          onClick={() => moverCampo(i, -1)}><ChevronUp size={15} aria-hidden="true" /></button>
                        <button type="button" className="adm-anexo-x" title="Descer" aria-label={`Descer o campo ${i + 1}`}
                          disabled={i === rascunho.campos_extras.length - 1}
                          onClick={() => moverCampo(i, 1)}><ChevronDown size={15} aria-hidden="true" /></button>
                        <button type="button" className="adm-anexo-x" title="Remover" aria-label={`Remover o campo ${i + 1}`}
                          onClick={() => removerCampo(i)}><Trash2 size={15} aria-hidden="true" /></button>
                      </div>

                      {campo.tipo === 'selecao' && (
                        <input type="text" className="adm-input" placeholder="Opções separadas por vírgula"
                          aria-label={`Opções do campo ${i + 1}, separadas por vírgula`}
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
                    <Plus size={16} aria-hidden="true" /> Adicionar campo
                  </button>
                </div>
                )}

                {/* Grudada no pé da tela: com vários campos extras o botão saía
                    de vista, e o aviso de sucesso no topo da página também — a
                    pessoa salvava sem ver resposta nenhuma. */}
                <div className={`adm-cfg-barra${sujo ? ' is-sujo' : ''}`}>
                  <div className="adm-cfg-barra-msg" role="status">
                    {erro && <span className="is-erro"><AlertCircle size={15} aria-hidden="true" /> {erro}</span>}
                    {!erro && salvo && <span className="is-ok"><CheckCircle2 size={15} aria-hidden="true" /> {salvo}</span>}
                    {!erro && !salvo && sujo && <span className="is-sujo">Alterações não salvas</span>}
                    {!erro && !salvo && !sujo && <span className="is-calmo">Nenhuma alteração para salvar</span>}
                  </div>
                  <div className="adm-cfg-barra-acoes">
                    {sujo && (
                      <button type="button" className="adm-btn adm-btn-ghost" onClick={descartar} disabled={salvando}>
                        <Undo2 size={16} aria-hidden="true" /> Descartar
                      </button>
                    )}
                    <button type="button" className="adm-btn adm-btn-primary" onClick={salvar} disabled={salvando || !sujo}>
                      {salvando
                        ? <><Loader2 size={16} className="adm-spin" aria-hidden="true" /> Salvando…</>
                        : <><Save size={16} aria-hidden="true" /> Salvar</>}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
