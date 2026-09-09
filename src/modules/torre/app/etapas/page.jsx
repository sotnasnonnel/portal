import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ListChecks, Loader2, AlertCircle, X, AlertTriangle, Eye, Headset, Route, History,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { semaforoDias } from '../../../../utils/semaforo';
import { listarEtapasDoQuadro } from '../../../mobilizacao/lib/mobilizacao';
import { listarChamadosDaLista } from '../../lib/chamadosTorre';
import {
  ORIGENS, montarLista, filtrarLista, opcoesDaLista, resumoDaLista,
} from '../../lib/listaTorre';

const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

const VAZIO = {
  busca: '', origem: '', grupo: '', status: '', responsavelId: '',
  atrasadas: false, incluirEncerradas: false,
};

/**
 * Etapas da Torre — o passo a passo de TUDO em lista: mobilizações e chamados
 * do Administrativo.
 *
 * Os chamados entraram porque o Mapa e o Quadro já mostravam os dois e só a
 * lista não: quem conferia item a item na reunião tinha de trocar de tela,
 * exatamente o que a Torre existe para evitar.
 *
 * O RECORTE é da RLS — cada um vê o que lhe diz respeito —, e é por isso que o
 * filtro por nome é o eixo da reunião: o responsável seleciona o próprio nome e
 * apresenta a sua parte.
 */
export default function EtapasTorre() {
  const { user } = useAuth();
  const [dados, setDados] = useState({ etapas: [], chamados: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [f, setF] = useState(VAZIO);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      // Em paralelo: são dois módulos independentes, e encadear dobraria a
      // espera sem nenhum ganho.
      const [etapas, chamados] = await Promise.all([
        listarEtapasDoQuadro({}), listarChamadosDaLista({}),
      ]);
      setDados({ etapas, chamados });
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const linhas = useMemo(
    () => montarLista({ etapas: dados.etapas, chamados: dados.chamados }),
    [dados],
  );
  const opcoes = useMemo(() => opcoesDaLista(linhas), [linhas]);
  const visiveis = filtrarLista(linhas, f);
  const resumo = resumoDaLista(visiveis);
  const filtrando = JSON.stringify(f) !== JSON.stringify(VAZIO);
  const trocar = (campo) => (ev) => setF((a) => ({ ...a, [campo]: ev.target.value }));

  return (
    <div className="mob-page mob-page-wide">
      <h1 className="mob-title"><ListChecks size={24} /> Etapas</h1>
      <p className="mob-sub">
        O passo a passo em lista — mobilizações e chamados do Administrativo juntos, para
        conferir item a item durante a reunião. O mais atrasado vem primeiro.
      </p>
      <p className="tor-nota">
        <Eye size={14} /> Tela de consulta: nada aqui pode ser alterado.
      </p>

      <div className="mob-filtros">
        {/* O filtro por nome é o eixo da reunião: cada responsável seleciona o
            próprio e apresenta a sua parte. */}
        <div className="mob-filtro">
          <label htmlFor="tor-e-resp">Responsável</label>
          <select id="tor-e-resp" value={f.responsavelId} onChange={trocar('responsavelId')}>
            <option value="">Todos</option>
            {user?.id && <option value={user.id}>Eu</option>}
            {opcoes.temSemResponsavel && <option value="sem">Sem responsável</option>}
            {opcoes.responsaveis.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="mob-filtro" style={{ minWidth: 220 }}>
          <label htmlFor="tor-e-busca">Buscar</label>
          <input id="tor-e-busca" type="text" value={f.busca} onChange={trocar('busca')}
            placeholder="Etapa, chamado, pessoa ou número" />
        </div>

        {/* O filtro que faz a lista unificada ser utilizável: numa reunião que
            fala só de mobilização, os chamados viram ruído — e vice-versa. */}
        <div className="mob-filtro">
          <label htmlFor="tor-e-origem">Tipo</label>
          <select id="tor-e-origem" value={f.origem} onChange={trocar('origem')}>
            <option value="">Tudo</option>
            {ORIGENS.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="tor-e-grupo">Fluxo</label>
          <select id="tor-e-grupo" value={f.grupo} onChange={trocar('grupo')}>
            <option value="">Todos</option>
            {opcoes.grupos.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="tor-e-status">Situação</label>
          <select id="tor-e-status" value={f.status} onChange={trocar('status')}>
            <option value="">Todas</option>
            {opcoes.situacoes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${f.atrasadas ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => setF((a) => ({ ...a, atrasadas: !a.atrasadas }))}>
          <AlertTriangle size={15} /> Só as atrasadas
        </button>

        {/* A lista abre com o que FALTA. O histórico existe, mas atrás de um
            clique: são ~1300 itens encerrados contra ~50 em jogo. */}
        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${f.incluirEncerradas ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => setF((a) => ({ ...a, incluirEncerradas: !a.incluirEncerradas }))}>
          <History size={15} /> Incluir encerradas
        </button>

        {filtrando && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm mob-filtro-limpa"
            onClick={() => setF(VAZIO)}>
            <X size={15} /> Limpar
          </button>
        )}
      </div>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div>
      ) : !visiveis.length ? (
        <div className="mob-vazio">
          {filtrando
            ? 'Nada com esses filtros.'
            : 'Nada no seu nome. Você enxerga o que lhe diz respeito.'}
        </div>
      ) : (
        <>
          <p className="mob-campo-dica">
            {resumo.total} item(ns) · {resumo.mobilizacao} de mobilização · {resumo.chamados} chamado(s)
            {resumo.atrasadas > 0 && ` · ${resumo.atrasadas} em atraso`}
            {filtrando && ` (de ${linhas.length} no total)`}
          </p>

          <div className="mob-tabela-scroll">
            <table className="mob-tabela">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Referente a</th>
                  <th>Tipo</th>
                  <th>Responsável</th>
                  <th>Situação</th>
                  <th>Previsto</th>
                  <th>Real</th>
                  <th className="num">Atraso</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => {
                  const tom = semaforoDias(l.diasAtraso);
                  return (
                    <tr key={l.chave}>
                      <td className="num">{l.numero}</td>
                      <td>{l.titulo}</td>
                      <td>{l.contexto || '—'}</td>
                      {/* O ícone diz de onde a linha veio antes de qualquer
                          leitura: as duas coisas convivem na tabela, mas não
                          são a mesma. */}
                      <td>
                        <span className="tor-origem">
                          {l.origem === 'adm' ? <Headset size={14} /> : <Route size={14} />}
                          {l.grupo}
                        </span>
                      </td>
                      <td>{l.responsavelNome || <span className="mob-cartao-sem-dono">sem responsável</span>}</td>
                      <td>{l.statusLabel}</td>
                      <td className="num">{dataBr(l.prazo)}</td>
                      <td className="num">{dataBr(l.real)}</td>
                      <td className={`num ${tom === 'vencido' ? 'is-vencido' : ''}`}>
                        {l.diasAtraso === null
                          ? '—'
                          : `${l.diasAtraso > 0 ? '+' : ''}${l.diasAtraso}d`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
