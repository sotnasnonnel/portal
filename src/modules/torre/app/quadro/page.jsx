import { useCallback, useEffect, useState } from 'react';
import { Radar, Loader2, AlertCircle, X, AlertTriangle, Eye, User } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { STATUS_LABEL as STATUS_ADM } from '../../../administrativo/lib/statusChamado';
import { listarTorre } from '../../../mobilizacao/lib/mobilizacao';
import {
  agruparTorre, filtrarTorre, opcoesDaTorre, estaVencido, ROTULO_ORIGEM,
} from '../../../mobilizacao/lib/torre';
import { rotuloStatus } from '../../../mobilizacao/lib/statusEtapa';
import { iniciais } from '../../../mobilizacao/lib/painelEtapas';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : 'sem prazo');

const rotulo = (item) => (item.origem === 'adm'
  ? (STATUS_ADM[item.status] || item.status)
  : rotuloStatus(item.status));

const VAZIO = { origem: '', responsavelId: '', cc: '', atrasados: false };

/**
 * Quadro da Torre — a mesma visão de /mobilizacao/torre, sem ação nenhuma.
 *
 * Não repete as regras: agrupamento, tradução de status e filtros vêm de
 * lib/torre.js, que é a mesma peça que a Mobilização usa. Se um status novo
 * aparecer em qualquer um dos dois módulos, o teste daquele arquivo quebra
 * antes de o cartão sumir calado daqui.
 *
 * O cartão NÃO é link: quem abre esta tela normalmente não tem acesso ao módulo
 * de Mobilização, e um link que devolve para a Home é pior que nenhum. Tudo o
 * que a reunião precisa está na face do cartão.
 *
 * O RECORTE é da RLS: cada um vê os chamados e as etapas em que está
 * envolvido. É o que faz "filtrar pelo meu nome" ter sentido sem expor a base
 * inteira a quem não deve.
 */
export default function QuadroTorre() {
  const { user } = useAuth();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [f, setF] = useState(VAZIO);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setItens(await listarTorre());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const opcoes = opcoesDaTorre(itens);
  const visiveis = filtrarTorre(itens, f);
  const colunas = agruparTorre(visiveis);
  const filtrando = JSON.stringify(f) !== JSON.stringify(VAZIO);
  const trocar = (campo) => (ev) => setF((a) => ({ ...a, [campo]: ev.target.value }));

  return (
    <div className="mob-page mob-page-full mob-page-quadro">
      <h1 className="mob-title"><Radar size={24} /> Quadro</h1>
      <p className="mob-sub">
        Chamados do Administrativo e etapas de Mobilização lado a lado, do jeito que a reunião de
        torre acompanha.
      </p>
      <p className="tor-nota">
        <Eye size={14} /> Tela de consulta: nada aqui pode ser alterado.
      </p>

      <div className="mob-filtros">
        <div className="mob-filtro">
          <label htmlFor="tor-q-resp">Responsável</label>
          <select id="tor-q-resp" value={f.responsavelId} onChange={trocar('responsavelId')}>
            <option value="">Todos</option>
            {/* Atalho para o caso mais comum da reunião: "o que é meu?". */}
            {user?.id && <option value={user.id}>Eu</option>}
            <option value="sem">Sem responsável</option>
            {opcoes.responsaveis.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="tor-q-origem">Origem</label>
          <select id="tor-q-origem" value={f.origem} onChange={trocar('origem')}>
            <option value="">Tudo</option>
            <option value="adm">Chamados do Administrativo</option>
            <option value="mobilizacao">Etapas de Mobilização</option>
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="tor-q-cc">Centro de custo</label>
          <select id="tor-q-cc" value={f.cc} onChange={trocar('cc')}>
            <option value="">Todos</option>
            {opcoes.ccs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${f.atrasados ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => setF((a) => ({ ...a, atrasados: !a.atrasados }))}>
          <AlertTriangle size={15} /> Só os vencidos
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
      ) : (
        <div className="mob-quadro">
          {colunas.map((col) => (
            <section key={col.chave} className="mob-col">
              <header className="mob-col-cab">
                <h2>{col.titulo}</h2>
                <span className="mob-col-cont">{col.itens.length}</span>
              </header>
              <div className="mob-col-corpo">
                {!col.itens.length && <p className="mob-col-vazia">—</p>}
                {col.itens.map((i) => (
                  <article key={`${i.origem}-${i.id}`} className="mob-cartao">
                    <div className="mob-cartao-topo">
                      <span className={`mob-torre-origem origem-${i.origem}`}>{ROTULO_ORIGEM[i.origem]}</span>
                      <span className="mob-cartao-num">#{i.numero}</span>
                    </div>
                    <strong className="mob-cartao-titulo">{i.titulo}</strong>
                    <span className="mob-cartao-proc">{rotulo(i)}{i.cc ? ` · ${i.cc}` : ''}</span>
                    <div className="mob-cartao-rodape">
                      {i.responsavelNome ? (
                        <span className="mob-cartao-dono" title={i.responsavelNome}>
                          {iniciais(i.responsavelNome)}
                        </span>
                      ) : (
                        <span className="mob-cartao-sem-dono">sem responsável</span>
                      )}
                      <span className={`mob-prazo ${estaVencido(i) ? 'tom-vencido' : 'tom-ok'}`}>
                        {dataBr(i.prazo)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!carregando && !visiveis.length && (
        <p className="mob-campo-dica">
          {filtrando
            ? 'Nada em aberto com esses filtros.'
            : 'Nada em aberto no seu nome. Você enxerga os chamados e as etapas em que está envolvido.'}
        </p>
      )}

      {!carregando && !!visiveis.length && filtrando && (
        <p className="mob-campo-dica">
          <User size={13} style={{ verticalAlign: '-2px' }} /> Mostrando {visiveis.length} de {itens.length} itens.
        </p>
      )}
    </div>
  );
}
