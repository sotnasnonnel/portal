import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import {
  fetchGerencias,
  fetchCamposEquipe,
  createCampoEquipe,
  updateCampoEquipe,
  deleteCampoEquipe,
  reordenarCamposEquipe,
  criarCamposEmLote,
} from '../../../lib/data';
import { equipesConfiguraveis, podeConfigurarApontamento } from '../../../lib/roles';
import {
  TIPOS,
  campoNovo,
  deRascunho,
  erroDeConfiguracao,
  paraRascunho,
} from '../../../lib/camposEquipe';
import { MODELO_PADRAO } from '../../../lib/catalogoTarefas';
import ConfirmModal from '../../components/ConfirmModal';
import Aviso, { Carregando } from '../../components/Aviso';

// Configuração do APONTAMENTO: os campos que cada equipe preenche antes de dar
// play no cronômetro. Diferente da tela de projetos, esta é CENTRAL — a lista
// nominal de podeConfigurarHoras edita TODAS as equipes, escolhendo uma
// no seletor. Quem foi liberado por equipe (CONFIG_APONTAMENTO_POR_EQUIPE) só
// recebe a sua. A RLS repete as duas regras no banco.
// Os projetos continuam em "Configuração" — aqui é só o formulário.
export default function ConfigApontamentoPage() {
  const { user } = useAuth();
  const minhaGerencia = user?.horasGerenciaId || null;

  const [gerencias, setGerencias] = useState([]);
  const [sel, setSel] = useState(minhaGerencia || '');
  const [campos, setCampos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState(() => paraRascunho(campoNovo()));
  const [aExcluir, setAExcluir] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setGerencias(await fetchGerencias());
      } catch (e) {
        setErro(e?.message || 'Falha ao carregar as áreas.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const equipes = useMemo(() => equipesConfiguraveis(user, gerencias), [user, gerencias]);

  // Abre na própria equipe (o caso mais comum) e cai na primeira se quem
  // configura não estiver vinculado a nenhuma que possa editar.
  useEffect(() => {
    if (!equipes.length) return;
    setSel((s) => {
      if (equipes.some((g) => g.id === s)) return s;
      return equipes.some((g) => g.id === minhaGerencia) ? minhaGerencia : equipes[0].id;
    });
  }, [equipes, minhaGerencia]);

  const carregar = useCallback(async () => {
    if (!sel) return;
    setErro('');
    try {
      setCampos(await fetchCamposEquipe(sel));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar os campos.');
    }
  }, [sel]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Gate de UI (a RLS é quem protege as escritas de verdade).
  if (!podeConfigurarApontamento(user)) return <Navigate to="/horas/apontar" replace />;

  async function adicionar() {
    const campo = deRascunho(novo);
    const problema = erroDeConfiguracao(campo, campos);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro('');
    try {
      await createCampoEquipe(sel, { ...campo, ordem: campos.length });
      setNovo(paraRascunho(campoNovo()));
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao criar o campo.');
    }
  }

  async function salvar(rascunho) {
    const campo = deRascunho(rascunho);
    const problema = erroDeConfiguracao(campo, campos);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro('');
    try {
      await updateCampoEquipe(campo.id, campo);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar o campo.');
    }
  }

  async function mover(indice, direcao) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= campos.length) return;
    const lista = [...campos];
    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
    setCampos(lista.map((c, i) => ({ ...c, ordem: i })));
    try {
      await reordenarCamposEquipe(lista);
    } catch (e) {
      setErro(e?.message || 'Falha ao reordenar.');
      await carregar();
    }
  }

  async function usarModeloPadrao() {
    setErro('');
    try {
      await criarCamposEmLote(sel, MODELO_PADRAO);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao criar os campos do modelo padrão.');
    }
  }

  async function confirmarExclusao() {
    const c = aExcluir;
    setAExcluir(null);
    if (!c) return;
    try {
      await deleteCampoEquipe(c.id);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir.');
    }
  }

  if (loading) {
    return (
      <>
        <h1>Configuração do Apontamento</h1>
        <Carregando />
      </>
    );
  }

  if (!equipes.length) {
    return (
      <>
        <h1>Configuração do Apontamento</h1>
        <Aviso>Nenhuma equipe cadastrada ainda.</Aviso>
      </>
    );
  }

  const equipe = equipes.find((g) => g.id === sel);
  const variasEquipes = equipes.length > 1;

  return (
    <>
      <h1>Configuração do Apontamento</h1>
      <p className="horas-sub">
        {variasEquipes ? 'Escolha a equipe e defina' : 'Defina'} os campos que ela preenche antes de
        iniciar o cronômetro — na ordem em que aparecem na tela.
      </p>

      <Aviso>
        Cada equipe tem os seus. Renomear um campo ou apagá-lo <b>não</b> muda os apontamentos já
        registrados: cada um guarda o rótulo como estava no dia. O <b>projeto</b> continua vindo de{' '}
        <b>Configuração</b> e a <b>descrição</b> é sempre opcional.
      </Aviso>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <div className="horas-card">
        <div className="horas-toolbar" style={{ marginBottom: 0 }}>
          <div className="horas-fld" style={{ maxWidth: 420 }}>
            <label htmlFor="horas-cfgap-equipe">
              {variasEquipes ? `Equipe (${equipes.length} no total)` : 'Equipe'}
            </label>
            <select id="horas-cfgap-equipe" value={sel} disabled={!variasEquipes} onChange={(e) => setSel(e.target.value)}>
              {equipes.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <h2 className="horas-sec" style={{ marginTop: 22 }}>
        Campos de {equipe?.nome || 'equipe'}
        {campos.length ? ` (${campos.length})` : ''}
      </h2>

      {campos.length === 0 ? (
        <div className="horas-card">
          <div className="horas-empty" style={{ paddingBottom: 14 }}>
            Nenhum campo configurado — a equipe aponta só com projeto e descrição. Comece pelo modelo
            padrão ou crie os campos um a um abaixo.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="horas-btn2" type="button" onClick={usarModeloPadrao}>
              <Sparkles size={16} /> Começar com o modelo padrão (Sigla, Tarefa, Etiqueta, Tarefa 2)
            </button>
          </div>
        </div>
      ) : null}

      {campos.map((campo, i) => (
        <CampoCard
          key={campo.id}
          campo={campo}
          primeiro={i === 0}
          ultimo={i === campos.length - 1}
          onSalvar={salvar}
          onExcluir={() => setAExcluir(campo)}
          onMover={(dir) => mover(i, dir)}
        />
      ))}

      <section className="horas-card" aria-labelledby="horas-cfgap-novo-tit">
        <h2 className="horas-sec" id="horas-cfgap-novo-tit">
          Novo campo
        </h2>
        <CampoForm campo={novo} onChange={setNovo} />
        <div className="horas-modal-acoes">
          <button className="horas-btn" type="button" onClick={adicionar} disabled={!sel}>
            <Plus size={16} /> Adicionar campo
          </button>
        </div>
      </section>

      <ConfirmModal
        open={!!aExcluir}
        title="Excluir campo"
        message={`Excluir o campo "${aExcluir?.label || ''}"? A equipe deixa de preenchê-lo nos próximos apontamentos. Os que já foram registrados continuam mostrando o que foi preenchido.`}
        onConfirm={confirmarExclusao}
        onCancel={() => setAExcluir(null)}
      />
    </>
  );
}

// Um campo já salvo: edita em rascunho local e só grava no "Salvar", para não
// disparar uma escrita por tecla digitada.
function CampoCard({ campo, primeiro, ultimo, onSalvar, onExcluir, onMover }) {
  const original = paraRascunho(campo);
  const [rascunho, setRascunho] = useState(original);

  // O campo pode ter sido recarregado (salvar, reordenar, trocar de equipe) —
  // aí o rascunho volta a espelhar o servidor. Ajuste DURANTE o render, não num
  // efeito: é o padrão do React para estado derivado de prop.
  const [visto, setVisto] = useState(campo);
  if (visto !== campo) {
    setVisto(campo);
    setRascunho(original);
  }

  const mudou =
    rascunho.label !== original.label ||
    rascunho.tipo !== original.tipo ||
    rascunho.obrigatorio !== original.obrigatorio ||
    rascunho.opcoesTxt !== original.opcoesTxt;

  const nome = campo.label || 'Campo sem nome';

  return (
    <section className="horas-card" aria-label={`Campo ${nome}`}>
      <div className="horas-campo-topo">
        <h3 className="horas-sec" style={{ margin: 0 }}>
          {nome}
        </h3>
        <div style={{ whiteSpace: 'nowrap' }}>
          <button
            className="horas-btn-icon"
            type="button"
            title="Mover para cima"
            aria-label={`Mover ${nome} para cima`}
            disabled={primeiro}
            onClick={() => onMover(-1)}
          >
            <ChevronUp size={15} />
          </button>
          <button
            className="horas-btn-icon"
            type="button"
            title="Mover para baixo"
            aria-label={`Mover ${nome} para baixo`}
            disabled={ultimo}
            onClick={() => onMover(1)}
          >
            <ChevronDown size={15} />
          </button>
          <button
            className="horas-btn-icon is-danger"
            type="button"
            title="Excluir"
            aria-label={`Excluir o campo ${nome}`}
            onClick={onExcluir}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <CampoForm campo={rascunho} onChange={setRascunho} />

      {/* O Salvar desabilitado não dizia por quê: agora o card avisa quando há
          alteração pendente e dá para desfazê-la. */}
      <div className="horas-modal-acoes" style={{ alignItems: 'center' }}>
        {mudou ? (
          <>
            <span className="horas-pendente" role="status">
              Alterações não salvas
            </span>
            <button className="horas-btn2" type="button" onClick={() => setRascunho(original)}>
              Descartar
            </button>
          </>
        ) : null}
        <button className="horas-btn" type="button" disabled={!mudou} onClick={() => onSalvar(rascunho)}>
          Salvar campo
        </button>
      </div>
    </section>
  );
}

// O formulário de um campo (novo ou existente). As opções são editadas como
// texto, uma por linha — é o jeito mais rápido de colar uma lista de planilha.
function CampoForm({ campo, onChange }) {
  const set = (patch) => onChange({ ...campo, ...patch });
  const uid = useId();

  return (
    <>
      <div className="horas-toolbar" style={{ marginBottom: campo.tipo === 'texto' ? 0 : 14 }}>
        <div className="horas-fld" style={{ maxWidth: 280 }}>
          <label htmlFor={`${uid}-nome`}>Nome do campo</label>
          <input
            id={`${uid}-nome`}
            type="text"
            placeholder="Ex.: Frente de serviço"
            value={campo.label}
            onChange={(e) => set({ label: e.target.value })}
          />
        </div>
        <div className="horas-fld" style={{ maxWidth: 200 }}>
          <label htmlFor={`${uid}-tipo`}>Tipo</label>
          <select id={`${uid}-tipo`} value={campo.tipo} onChange={(e) => set({ tipo: e.target.value })}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="horas-fld" style={{ maxWidth: 220 }}>
          <label htmlFor={`${uid}-obrig`}>Preenchimento</label>
          <select
            id={`${uid}-obrig`}
            value={campo.obrigatorio ? 'sim' : 'nao'}
            onChange={(e) => set({ obrigatorio: e.target.value === 'sim' })}
          >
            <option value="sim">Obrigatório</option>
            <option value="nao">Opcional</option>
          </select>
        </div>
      </div>

      {campo.tipo === 'texto' ? null : (
        <div className="horas-fld">
          <label htmlFor={`${uid}-opcoes`}>Opções da lista — uma por linha</label>
          <textarea
            id={`${uid}-opcoes`}
            aria-describedby={`${uid}-opcoes-ajuda`}
            className="horas-opcoes"
            rows={Math.min(12, Math.max(4, campo.opcoesTxt.split('\n').length))}
            placeholder={'Civil\nMontagem\nElétrica'}
            value={campo.opcoesTxt}
            onChange={(e) => set({ opcoesTxt: e.target.value })}
          />
          <div className="horas-desc" id={`${uid}-opcoes-ajuda`}>
            {deRascunho(campo).opcoes.length} opção(ões). Linhas em branco e repetidas são
            ignoradas.
          </div>
        </div>
      )}
    </>
  );
}
