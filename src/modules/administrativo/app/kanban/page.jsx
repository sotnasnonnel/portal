import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Loader2, AlertCircle, Inbox, Clock, MessageSquare, X } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { getClasse } from '../../../../config/administrativo';
import { listarQuadro } from '../../lib/chamados';
import { agruparEmColunas, semaforoPrazo, iniciais, filtrarQuadro, opcoesDoQuadro } from '../../lib/painel';
import SearchSelect from '../../../../components/UI/SearchSelect';

const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : 'sem prazo');

const TEXTO_PRAZO = {
  vencido: 'Vencido', perto: 'Vence em breve', ok: 'No prazo', 'sem-prazo': 'Sem prazo',
};

export default function KanbanAdm() {
  const { user, modules } = useAuth();
  const [apenasMeus, setApenasMeus] = useState(false);
  const [chamados, setChamados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [fSolicitante, setFSolicitante] = useState('');
  const [fCc, setFCc] = useState('');

  const souAdm = modules?.administrativo === 'admin' || modules?.administrativo === 'atendente';

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    setErro('');
    try {
      setChamados(await listarQuadro(user.id, { apenasMeus, souTime: souAdm }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [user?.id, apenasMeus, souAdm]);

  useEffect(() => { carregar(); }, [carregar]);

  const agora = Date.now();
  // Filtro do Adm: "como está tudo do projeto crítico". O CC é o que amarra os
  // chamados de um mesmo projeto, mesmo espalhados por classes diferentes.
  const { solicitantes, ccs } = opcoesDoQuadro(chamados);
  const visiveis = souAdm ? filtrarQuadro(chamados, { solicitanteId: fSolicitante, cc: fCc }) : chamados;
  const colunas = agruparEmColunas(visiveis);
  const filtrando = !!(fSolicitante || fCc);

  return (
    <div className="adm-page adm-page-full">
      <h1 className="adm-title"><LayoutGrid size={24} /> Quadro</h1>
      <p className="adm-sub">
        {souAdm
          ? 'Onde cada chamado está, quem responde por ele e quanto falta do prazo. Clique num cartão para abrir e agir.'
          : 'Onde estão os seus chamados e quanto falta do prazo. Clique num cartão para abrir.'}
      </p>

      {/* Filtros só para quem atende — o solicitante já vê apenas o que é dele
          (RLS), então filtrar por outra pessoa não teria efeito nenhum. */}
      {souAdm && (
        <>
          <div className="adm-tabs">
            <button type="button" className={`adm-tab ${!apenasMeus ? 'is-active' : ''}`}
              onClick={() => setApenasMeus(false)}>
              <Inbox size={15} /> Todos
            </button>
            <button type="button" className={`adm-tab ${apenasMeus ? 'is-active' : ''}`}
              onClick={() => setApenasMeus(true)}>
              <Clock size={15} /> Atribuídos a mim
            </button>
          </div>

          <div className="adm-filtros">
            <div className="adm-filtro">
              <label>Solicitante</label>
              <SearchSelect value={fSolicitante} onChange={setFSolicitante}
                options={[{ value: '', label: 'Todos' }, ...solicitantes]}
                placeholder="Todos" ariaLabel="Filtrar por solicitante" />
            </div>
            <div className="adm-filtro">
              <label>Centro de custo</label>
              <SearchSelect value={fCc} onChange={setFCc}
                options={[{ value: '', label: 'Todos' }, ...ccs.map((v) => ({ value: v, label: v }))]}
                placeholder="Todos" ariaLabel="Filtrar por centro de custo" />
            </div>
            {filtrando && (
              <button type="button" className="adm-btn adm-btn-ghost adm-filtro-limpa"
                onClick={() => { setFSolicitante(''); setFCc(''); }}>
                <X size={15} /> Limpar filtros
              </button>
            )}
          </div>

          {filtrando && (
            <p className="adm-campo-dica">
              Mostrando {visiveis.length} de {chamados.length} chamados.
            </p>
          )}
        </>
      )}

      {erro && <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="adm-vazio"><Loader2 size={20} className="adm-spin" /> Carregando…</div>
      ) : (
        <div className="adm-quadro">
          {colunas.map((col) => (
            <section key={col.chave} className="adm-col">
              <header className="adm-col-cab">
                <h2>{col.titulo}</h2>
                <span className="adm-col-cont">{col.itens.length}</span>
              </header>

              <div className="adm-col-corpo">
                {col.itens.length === 0 ? (
                  <p className="adm-col-vazia">—</p>
                ) : col.itens.map((c) => {
                  const prazo = semaforoPrazo(c.sla_vence_em, agora);
                  const cls = getClasse(c.classe);
                  return (
                    <Link key={c.id} to={`/administrativo/chamado/${c.id}`} className="adm-cartao">
                      <div className="adm-cartao-topo">
                        <span className="adm-cartao-num">#{c.numero}</span>
                        {c.naoLidas > 0 && (
                          <span className="adm-cartao-msg" title={`${c.naoLidas} mensagem(ns) não lida(s)`}>
                            <MessageSquare size={12} /> {c.naoLidas}
                          </span>
                        )}
                      </div>
                      <strong className="adm-cartao-assunto">{c.assunto}</strong>
                      <span className="adm-cartao-classe">{cls?.label || c.classe}</span>

                      <div className="adm-cartao-rodape">
                        {/* Sem responsável é o estado que precisa saltar: é o
                            chamado que ninguém está olhando. */}
                        {c.atendenteNome ? (
                          <span className="adm-cartao-dono" title={c.atendenteNome}>
                            {iniciais(c.atendenteNome)}
                          </span>
                        ) : (
                          <span className="adm-cartao-sem-dono">sem responsável</span>
                        )}
                        <span className={`adm-prazo tom-${prazo}`} title={TEXTO_PRAZO[prazo]}>
                          {dataHora(c.sla_vence_em)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
