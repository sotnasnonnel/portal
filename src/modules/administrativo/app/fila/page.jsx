import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Inbox, AlertCircle, UserX, Clock, CalendarOff, CalendarRange, AlertTriangle,
  SlidersHorizontal, SearchX, CheckCircle2, X,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { listarFila } from '../../lib/chamados';
import {
  STATUS_LABEL as ROTULO_STATUS, STATUS_ABERTOS, STATUS_ENCERRADOS, ehEncerrado,
} from '../../lib/statusChamado';
import {
  filtrarFila, opcoesDaFila, precisaEncerrados, STATUS_TODOS, restaurarFiltro,
} from '../../lib/painel';
import { useEstadoPersistido } from '../../../../hooks/useEstadoPersistido';
import { descreverAusencia } from '../../../../utils/ausenciaColaborador';
import { CabecalhoPagina, Abas, StatusBadge, PrazoSla, Vazio, Carregando } from '../components/ui';

const FILTRO_VAZIO = {
  assunto: '', status: '', solicitanteId: '', atendenteId: '', atrasado: '', criadoDe: '', criadoAte: '',
};

const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
// O filtro de criação guarda 'AAAA-MM-DD'; na tela vai como se lê.
const diaDoFiltro = (dia) => dia.split('-').reverse().join('/');

function rotuloPeriodo(de, ate) {
  if (de && ate) return `Criação: ${diaDoFiltro(de)} a ${diaDoFiltro(ate)}`;
  return de ? `Criação: a partir de ${diaDoFiltro(de)}` : `Criação: até ${diaDoFiltro(ate)}`;
}

export default function FilaAdm() {
  const { user } = useAuth();
  // Filtro e aba PERSISTEM na aba do navegador (ver useEstadoPersistido): quem
  // avalia abre um chamado, volta, e encontra a Fila como deixou. Antes o filtro
  // era refeito a cada chamado avaliado. A chave leva o usuário para um
  // computador compartilhado não herdar o filtro de outra pessoa.
  const chave = (nome) => (user?.id ? `adm:fila:${nome}:${user.id}` : '');
  const [apenasMeus, setApenasMeus] = useEstadoPersistido(chave('meus'), false, {
    restaurar: (v) => v === true,
  });
  // O painel manda para cá com ?atrasado=sim quando a pessoa clica em "abrir na
  // fila" pela lista de vencidos. Esse link é uma intenção explícita e vence o
  // filtro guardado — senão ele abriria a Fila com o filtro de antes, e não com
  // os vencidos que a pessoa acabou de pedir.
  const [params, setParams] = useSearchParams();
  const vemDoPainel = params.get('atrasado') === 'sim';
  const [filtro, setFiltro] = useEstadoPersistido(
    chave('filtro'),
    vemDoPainel ? { ...FILTRO_VAZIO, atrasado: 'sim' } : FILTRO_VAZIO,
    { restaurar: (v) => restaurarFiltro(v, FILTRO_VAZIO), ignorarSalvo: vemDoPainel },
  );

  // Consumido o link, o parâmetro sai da URL (sem criar entrada no histórico).
  // Se ficasse, quem ajustasse o filtro, abrisse um chamado e voltasse pelo
  // botão do navegador reabriria a URL com `?atrasado=sim` — e o filtro voltaria
  // a "só atrasados", que é justamente o problema que a persistência resolve.
  useEffect(() => {
    if (!vemDoPainel) return;
    setParams((p) => { p.delete('atrasado'); return p; }, { replace: true });
  }, [vemDoPainel, setParams]);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  // Fechados por padrão: período é filtro de exceção, e no celular os filtros
  // empurravam a lista inteira para baixo da dobra.
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  // Quantos há em cada aba. A aba "Todos" já traz os dois números; a "Atribuídos
  // a mim" só sabe o dela, e a outra guarda o último visto em vez de ir ao banco
  // só para contar. Ligar os encerrados muda o universo: o número antigo não vale.
  const [totais, setTotais] = useState({});

  // A escolha de status decide se a consulta traz também os encerrados. Fica
  // aqui, e não dentro de `carregar`, para ser a dependência do useCallback:
  // trocar o filtro é o que dispara a segunda ida ao banco.
  const comEncerrados = precisaEncerrados(filtro.status);

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    setErro('');
    try {
      const lista = await listarFila(user.id, { apenasMeus, incluirEncerrados: comEncerrados });
      setLinhas(lista);
      setTotais((t) => {
        const base = t.comEncerrados === comEncerrados ? t : {};
        return apenasMeus
          ? { ...base, comEncerrados, meus: lista.length }
          : {
            comEncerrados,
            todos: lista.length,
            meus: lista.filter((c) => c.atendente_id === user.id).length,
          };
      });
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [user?.id, apenasMeus, comEncerrados]);

  useEffect(() => { carregar(); }, [carregar]);

  const agora = Date.now();
  // Filtro é no cliente: a fila cabe numa tela e ir ao banco a cada tecla
  // digitada no assunto deixaria a busca travada.
  const visiveis = filtrarFila(linhas, filtro, agora);
  const opcoes = opcoesDaFila(linhas, agora);
  // Encerrado sem responsável não é chamado "que ninguém está olhando" — já
  // acabou. Sem esta condição, ligar o filtro de encerrados inflava o aviso.
  const semDono = linhas.filter((c) => !c.atendente_id && !ehEncerrado(c.status)).length;
  const filtrando = Object.values(filtro).some(Boolean);
  const mudar = (campo, valor) => setFiltro((f) => ({ ...f, [campo]: valor }));
  const limpar = () => setFiltro(FILTRO_VAZIO);
  const nomeDe = (lista, id) => lista.find((o) => o.value === id)?.label || 'selecionado';

  // O que está ligado e não aparece nos atalhos. Sem isto, "Bruno Lima" num
  // seletor não diz se ele é o solicitante ou o responsável, e no celular os
  // seletores ficam recolhidos.
  const ativos = [
    filtro.status && {
      chave: 'status',
      rotulo: filtro.status === STATUS_TODOS
        ? 'Inclusive encerrados'
        : `Status: ${ROTULO_STATUS[filtro.status] || filtro.status}`,
      tirar: () => mudar('status', ''),
    },
    filtro.atrasado === 'nao' && {
      chave: 'prazo', rotulo: 'Dentro do prazo', tirar: () => mudar('atrasado', ''),
    },
    filtro.solicitanteId && {
      chave: 'solicitante',
      rotulo: `Solicitante: ${nomeDe(opcoes.solicitantes, filtro.solicitanteId)}`,
      tirar: () => mudar('solicitanteId', ''),
    },
    filtro.atendenteId && filtro.atendenteId !== 'sem' && {
      chave: 'responsavel',
      rotulo: `Responsável: ${nomeDe(opcoes.responsaveis, filtro.atendenteId)}`,
      tirar: () => mudar('atendenteId', ''),
    },
    (filtro.criadoDe || filtro.criadoAte) && {
      chave: 'periodo',
      rotulo: rotuloPeriodo(filtro.criadoDe, filtro.criadoAte),
      tirar: () => setFiltro((f) => ({ ...f, criadoDe: '', criadoAte: '' })),
    },
  ].filter(Boolean);

  const soSemDono = filtro.atendenteId === 'sem';
  const soAtrasados = filtro.atrasado === 'sim';
  // Contagem do botão "Filtros" do celular: o que está escondido atrás dele.
  // A busca fica fora porque está sempre à vista.
  const recolhidos = ativos.length + (soAtrasados ? 1 : 0) + (soSemDono ? 1 : 0);
  const classeFiltro = (valor) => `adm-select${valor ? ' is-ativo' : ''}`;

  return (
    <div className="adm-page adm-page-wide">
      <CabecalhoPagina
        Icon={Inbox}
        titulo="Fila de atendimento"
        subtitulo={comEncerrados
          ? 'Chamados do Atendimento, inclusive os já encerrados.'
          : 'Chamados em aberto do Atendimento.'}
      />

      <Abas
        rotulo="Recorte da fila"
        valor={apenasMeus ? 'meus' : 'todos'}
        onChange={(v) => setApenasMeus(v === 'meus')}
        itens={[
          { valor: 'todos', rotulo: 'Todos', Icon: Inbox, contagem: totais.todos },
          { valor: 'meus', rotulo: 'Atribuídos a mim', Icon: Clock, contagem: totais.meus },
        ]}
      />

      {/* Filtros por cima do que já veio: a fila cabe numa tela, e ir ao banco a
          cada tecla do assunto deixaria a busca travada. */}
      <div className="adm-fila-filtros">
        <input
          type="search" className={`adm-input adm-fila-busca${filtro.assunto ? ' is-ativo' : ''}`}
          placeholder="Buscar no assunto…" aria-label="Buscar no assunto"
          value={filtro.assunto} onChange={(e) => mudar('assunto', e.target.value)}
        />
        <button type="button" className="adm-btn adm-btn-ghost adm-fila-filtros-btn"
          aria-expanded={filtrosAbertos} aria-controls="adm-fila-mais"
          onClick={() => setFiltrosAbertos((v) => !v)}>
          <SlidersHorizontal size={15} aria-hidden="true" /> Filtros
          {recolhidos > 0 && <span className="adm-tab-cont">{recolhidos}</span>}
        </button>
        <div id="adm-fila-mais" className={`adm-fila-filtros-mais ${filtrosAbertos ? 'is-aberto' : ''}`}>
          {/* A lista é FIXA (todos os status cadastrados), não montada a partir
              do que foi carregado: era essa a razão de "Fechado" nunca aparecer
              aqui — a fila não trazia encerrado, logo a opção não nascia, logo
              não havia como pedir por ele. Escolher um encerrado (ou "inclusive
              encerrados") recarrega a lista do banco. */}
          <select className={classeFiltro(filtro.status)} aria-label="Status"
            value={filtro.status} onChange={(e) => mudar('status', e.target.value)}>
            <option value="">Status: em aberto</option>
            <option value={STATUS_TODOS}>Todos, inclusive encerrados</option>
            <optgroup label="Em aberto">
              {STATUS_ABERTOS.map((st) => (
                <option key={st} value={st}>{ROTULO_STATUS[st] || st}</option>
              ))}
            </optgroup>
            <optgroup label="Encerrados">
              {STATUS_ENCERRADOS.map((st) => (
                <option key={st} value={st}>{ROTULO_STATUS[st] || st}</option>
              ))}
            </optgroup>
          </select>
          {/* Prazo antes de solicitante: "o que está atrasado" é a primeira
              pergunta de quem abre a fila de manhã. */}
          <select className={classeFiltro(filtro.atrasado)} aria-label="Prazo"
            value={filtro.atrasado} onChange={(e) => mudar('atrasado', e.target.value)}>
            <option value="">Prazo: todos</option>
            <option value="sim">
              Só atrasados{opcoes.atrasados > 0 ? ` (${opcoes.atrasados})` : ''}
            </option>
            <option value="nao">Dentro do prazo</option>
          </select>
          <select className={classeFiltro(filtro.solicitanteId)} aria-label="Solicitante"
            value={filtro.solicitanteId} onChange={(e) => mudar('solicitanteId', e.target.value)}>
            <option value="">Solicitante: todos</option>
            {opcoes.solicitantes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className={classeFiltro(filtro.atendenteId)} aria-label="Responsável"
            value={filtro.atendenteId} onChange={(e) => mudar('atendenteId', e.target.value)}>
            <option value="">Responsável: todos</option>
            {/* `soSemDono`: o filtro guardado pode trazer este valor para uma
                lista que já não tem nenhum, e o seletor não pode ficar em branco. */}
            {(opcoes.temSemResponsavel || soSemDono) && <option value="sem">Sem responsável</option>}
            {opcoes.responsaveis.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="button"
            className={`adm-btn adm-btn-ghost adm-fila-periodo-btn${filtro.criadoDe || filtro.criadoAte ? ' is-ativo' : ''}`}
            aria-expanded={periodoAberto} aria-controls="adm-fila-periodo"
            onClick={() => setPeriodoAberto((v) => !v)}>
            <CalendarRange size={15} aria-hidden="true" /> Período
          </button>
        </div>
      </div>

      {/* Fora da grade dos filtros: uma peça ocupando a linha inteira impede o
          auto-fit de recolher as colunas vazias, e abrir o período encolheria
          todos os seletores. */}
      {periodoAberto && (
        <div id="adm-fila-periodo" className={`adm-fila-periodo-painel ${filtrosAbertos ? 'is-aberto' : ''}`}>
          <label className="adm-fila-periodo">
            <span>Criado de</span>
            <input type="date" className={`adm-input${filtro.criadoDe ? ' is-ativo' : ''}`}
              value={filtro.criadoDe} onChange={(e) => mudar('criadoDe', e.target.value)} />
          </label>
          <label className="adm-fila-periodo">
            <span>até</span>
            <input type="date" className={`adm-input${filtro.criadoAte ? ' is-ativo' : ''}`}
              value={filtro.criadoAte} onChange={(e) => mudar('criadoAte', e.target.value)} />
          </label>
        </div>
      )}

      {/* Os dois recortes de quem abre a fila de manhã, a um clique. Sem dono é o
          chamado que ninguém está olhando; antes era um aviso largo e parado, e
          para ver quais eram a pessoa ainda tinha de procurar no seletor. */}
      <div className="adm-fila-resumo">
        {!apenasMeus && (semDono > 0 || soSemDono) && (
          <button type="button" className={`adm-fila-atalho tom-sem-dono${soSemDono ? ' is-ativo' : ''}`}
            aria-pressed={soSemDono} onClick={() => mudar('atendenteId', soSemDono ? '' : 'sem')}>
            <UserX size={14} aria-hidden="true" />
            {semDono === 1 ? '1 sem responsável' : `${semDono} sem responsável`}
          </button>
        )}
        {(opcoes.atrasados > 0 || soAtrasados) && (
          <button type="button" className={`adm-fila-atalho tom-vencido${soAtrasados ? ' is-ativo' : ''}`}
            aria-pressed={soAtrasados} onClick={() => mudar('atrasado', soAtrasados ? '' : 'sim')}>
            <AlertTriangle size={14} aria-hidden="true" />
            {opcoes.atrasados === 1 ? '1 vencido' : `${opcoes.atrasados} vencidos`}
          </button>
        )}
        {ativos.map((a) => (
          <button key={a.chave} type="button" className="adm-fila-chip" onClick={a.tirar}
            aria-label={`Tirar o filtro ${a.rotulo}`}>
            {a.rotulo} <X size={13} aria-hidden="true" />
          </button>
        ))}
        {!carregando && !erro && (filtrando || linhas.length > 0) && (
          <span className="adm-fila-contagem" aria-live="polite">
            {filtrando
              ? `${visiveis.length} de ${linhas.length} chamados`
              : `${linhas.length} ${linhas.length === 1 ? 'chamado' : 'chamados'}`}
            {filtrando && (
              <button type="button" className="adm-link adm-link-btn" onClick={limpar}>Limpar filtros</button>
            )}
          </span>
        )}
      </div>

      {soSemDono && !carregando && visiveis.length > 0 && (
        <p className="adm-campo-dica adm-fila-dica">
          Abra o chamado e clique em &quot;Assumir chamado&quot; para colocá-lo no seu nome.
        </p>
      )}

      {erro && (
        <div className="adm-aviso tom-erro" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>
            {erro}{' '}
            <button type="button" className="adm-link adm-link-btn adm-fila-tentar" onClick={carregar}>
              Tentar de novo
            </button>
          </span>
        </div>
      )}

      {carregando ? (
        <Carregando />
      ) : erro && linhas.length === 0 ? (
        // Falhou ao carregar: dizer "nenhum chamado" aqui afirmaria o que não se sabe.
        null
      ) : linhas.length === 0 ? (
        apenasMeus ? (
          <Vazio
            Icon={Inbox}
            titulo="Nenhum chamado atribuído a você"
            acao={(
              <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm"
                onClick={() => setApenasMeus(false)}>Ver todos</button>
            )}
          >
            Em &quot;Todos&quot;, os sem responsável podem ser assumidos.
          </Vazio>
        ) : (
          <Vazio
            Icon={comEncerrados ? Inbox : CheckCircle2}
            tom={comEncerrados ? undefined : 'ok'}
            titulo={comEncerrados ? 'Nenhum chamado encontrado' : 'Nenhum chamado em aberto'}
          />
        )
      ) : visiveis.length === 0 ? (
        <Vazio
          Icon={SearchX}
          titulo="Nenhum chamado com esses filtros"
          acao={(
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={limpar}>
              Limpar filtros
            </button>
          )}
        >
          {linhas.length === 1 ? 'Há 1 chamado nesta aba.' : `Há ${linhas.length} chamados nesta aba.`}
        </Vazio>
      ) : (
        // A largura da lista muda com a barra lateral recolhida, por isso a
        // tabela responde ao espaço dela (@container) e não ao da janela.
        <div className="adm-fila-lista">
          <div className="adm-tabela-scroll">
            <table className="adm-tabela adm-fila-tabela">
              <thead>
                <tr>
                  <th className="adm-fila-c-id">ID</th>
                  <th className="adm-fila-c-assunto">Assunto</th>
                  <th className="adm-fila-c-status">Status</th>
                  <th className="adm-fila-c-solic">Solicitante</th>
                  <th className="adm-fila-c-resp">Responsável</th>
                  <th className="adm-fila-c-criado">Criação</th>
                  <th className="adm-fila-c-prazo">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => {
                  const encerrado = ehEncerrado(c.status);
                  // O que já encerrou nunca pinta: é a mesma régua do indicador
                  // "Vencidos agora", e sem ela a lista com encerrados nasceria
                  // cheia de vermelho de chamado que ninguém deve mais atender.
                  const vencido = !encerrado
                    && c.sla_vence_em && new Date(c.sla_vence_em).getTime() < agora;
                  // O link cobre a linha inteira, então um `title` em cada célula
                  // nunca apareceria: o dele carrega o que a linha pode cortar.
                  const dicaLinha = [
                    c.assunto,
                    `Solicitante: ${c.solicitanteNome || '—'}`,
                    `Responsável: ${c.atendenteNome || 'sem responsável'}`,
                    c.naoLidas > 0 && `${c.naoLidas} mensagem(ns) não lida(s)`,
                    ...(c.ausencias || []).map(descreverAusencia),
                  ].filter(Boolean).join('\n');
                  return (
                    <tr key={c.id} className={vencido ? 'is-vencido' : ''}>
                      <td className="num adm-fila-c-id">#{c.numero}</td>
                      <td className="adm-fila-c-assunto">
                        <div className="adm-fila-tit">
                          {/* Um link só, esticado sobre a linha (::after): Ctrl+clique e
                              teclado continuam valendo, e o Tab não para duas vezes no
                              mesmo chamado, como parava com o ID e o assunto. */}
                          <Link className="adm-fila-link" to={`/administrativo/chamado/${c.id}`}
                            title={dicaLinha}>
                            {c.assunto}
                          </Link>
                          {c.naoLidas > 0 && (
                            <span className="adm-nao-lidas" role="img"
                              aria-label={`${c.naoLidas} mensagem(ns) não lida(s)`}>
                              {c.naoLidas}
                            </span>
                          )}
                          {/* A pessoa do chamado tem folga ou ausência no período:
                              o detalhe diz as datas, aqui é só o sinal. */}
                          {c.ausencias?.length > 0 && (
                            <span className="adm-ausente" role="img"
                              aria-label="Colaborador com ausência no período">
                              <CalendarOff size={14} aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        {/* Só aparece quando a lista estreita e as colunas de
                            solicitante e criação saem: o dado muda de lugar, não some. */}
                        <small className="adm-fila-sub">
                          {c.solicitanteNome || 'Sem solicitante'} · criado em {dataCurta(c.criado_em)}
                        </small>
                      </td>
                      <td className="adm-fila-c-status"><StatusBadge status={c.status} /></td>
                      <td className="adm-fila-c-solic">{c.solicitanteNome || '—'}</td>
                      <td className="adm-fila-c-resp">
                        {/* Encerrado sem responsável já acabou: não é alerta. */}
                        {c.atendenteNome || (encerrado ? '—' : (
                          <span className="adm-fila-sem-dono">
                            <UserX size={13} aria-hidden="true" /> Sem responsável
                          </span>
                        ))}
                      </td>
                      <td className="num adm-fila-c-criado">{dataCurta(c.criado_em)}</td>
                      <td className="adm-fila-c-prazo">
                        <PrazoSla venceEm={c.sla_vence_em} encerrado={encerrado} agora={agora} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
