import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, Send, AlertTriangle, CheckCircle2, Search, Inbox } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import {
  SLA_HORAS,
  TIPOS_FALE_CONOSCO,
  atrasado,
  ehSuporte,
  prazoRelativo,
  tipoFaleConosco,
} from '../../config/suporte';
import './FaleConosco.css';

// Caixa do "Fale conosco". Uma tela, dois públicos, porque a RLS já separa o
// que cada um enxerga (fale_conosco_select: o autor vê o que mandou, quem
// atende vê tudo):
//   - quem ATENDE  -> a fila, com o prazo de cada item e o campo de resposta;
//   - quem ESCREVEU -> o que mandou e o que foi respondido.
// É também para onde a notificação leva, dos dois lados.

const SELECT = `
  id, tipo, modulo, rota, mensagem, status, resposta, respondido_em, prazo_em, created_at,
  autor:colaboradores!autor_id (nome, email),
  respondente:colaboradores!respondido_por (nome)
`;

const dataHora = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function FaleConoscoCaixa() {
  const { user } = useAuth();
  const atende = ehSuporte(user);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('aberto');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [rascunho, setRascunho] = useState({});   // id -> texto da resposta
  const [salvando, setSalvando] = useState(null);

  // Sem setState antes do await: o primeiro efeito da tela chama esta função, e
  // mexer no estado de forma síncrona dentro do efeito dispara uma cascata de
  // render. Quem liga o "carregando" é quem clica em Atualizar; na montagem, o
  // estado já nasce true.
  const carregar = useCallback(async () => {
    // Abertos primeiro e, dentro deles, o mais perto de estourar o prazo no
    // topo — a fila ordenada pelo que vence, não pelo que chegou.
    const { data, error } = await supabase
      .from('fale_conosco')
      .select(SELECT)
      .order('status', { ascending: true })
      .order('prazo_em', { ascending: true });
    setErro(error?.message ?? '');
    setItens(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // A regra não enxerga que `carregar` só mexe no estado DEPOIS do await —
    // não há render em cascata aqui. Silenciada de propósito, e só nesta linha.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (atende && filtro !== 'todos' && i.status !== filtro) return false;
      if (tipoFiltro !== 'todos' && i.tipo !== tipoFiltro) return false;
      if (!termo) return true;
      // Busca no que se procura de verdade: o texto, quem escreveu e o módulo.
      return [i.mensagem, i.resposta, i.autor?.nome, i.modulo]
        .some((campo) => (campo || '').toLowerCase().includes(termo));
    });
  }, [itens, filtro, tipoFiltro, busca, atende]);

  const abertos = useMemo(() => itens.filter((i) => i.status === 'aberto'), [itens]);
  const vencidos = useMemo(() => abertos.filter(atrasado), [abertos]);

  async function responder(item) {
    const texto = (rascunho[item.id] || '').trim();
    if (!texto) return;
    setSalvando(item.id);
    const { error } = await supabase
      .from('fale_conosco')
      .update({
        resposta: texto,
        status: 'respondido',
        respondido_por: user?.id,
        respondido_em: new Date().toISOString(),
      })
      .eq('id', item.id);
    setSalvando(null);
    if (error) {
      window.alert('Não consegui salvar a resposta: ' + error.message);
      return;
    }
    setRascunho((r) => ({ ...r, [item.id]: '' }));
    carregar();
  }

  return (
    <div className="fcx-page">
      <header className="fcx-header">
        <Link to="/home" className="fcx-back">
          <ArrowLeft size={18} /> Portal
        </Link>
        <div className="fcx-titles">
          <h1>Fale conosco</h1>
          <p>
            {atende
              ? `Bugs, melhorias e elogios enviados pelo portal. Prazo de resposta: ${SLA_HORAS}h.`
              : `O que você enviou e o que foi respondido. Prazo de resposta: ${SLA_HORAS}h.`}
          </p>
        </div>
        <button
          type="button"
          className="fcx-refresh"
          onClick={() => { setLoading(true); carregar(); }}
          title="Recarregar"
        >
          <RefreshCw size={16} /> Atualizar
        </button>
      </header>

      <div className="fcx-toolbar">
        {atende ? (
          <div className="fcx-filtros">
            {[
              ['aberto', `Abertos (${abertos.length})`],
              ['respondido', 'Respondidos'],
              ['todos', 'Todos'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`fcx-filtro${filtro === id ? ' is-on' : ''}`}
                onClick={() => setFiltro(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Filtro por tipo: separar bug de elogio é o primeiro corte que se faz
            numa fila destas — um é trabalho, o outro é leitura. */}
        <div className="fcx-filtros">
          <button
            type="button"
            className={`fcx-filtro fcx-filtro-tipo${tipoFiltro === 'todos' ? ' is-on' : ''}`}
            onClick={() => setTipoFiltro('todos')}
          >
            Tudo
          </button>
          {TIPOS_FALE_CONOSCO.map((t) => {
            const Icon = t.Icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`fcx-filtro fcx-filtro-tipo${tipoFiltro === t.id ? ' is-on' : ''}`}
                onClick={() => setTipoFiltro(t.id)}
                title={t.ajuda}
              >
                <Icon size={14} aria-hidden="true" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="fcx-busca">
          <Search size={15} aria-hidden="true" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={atende ? 'Buscar por texto, pessoa ou módulo…' : 'Buscar…'}
            aria-label="Buscar"
          />
        </div>

        {atende && vencidos.length > 0 ? (
          <button
            type="button"
            className="fcx-vencidos"
            onClick={() => { setFiltro('aberto'); setTipoFiltro('todos'); setBusca(''); }}
            title="Mostrar os abertos"
          >
            <AlertTriangle size={14} /> {vencidos.length} fora do prazo
          </button>
        ) : null}
      </div>

      {erro ? <p className="fcx-erro">{erro}</p> : null}

      {loading ? (
        <p className="fcx-vazio">
          <Loader2 size={16} className="fc-spin" /> Carregando…
        </p>
      ) : filtrados.length === 0 ? (
        <div className="fcx-vazio fcx-vazio-bloco">
          <Inbox size={28} aria-hidden="true" />
          <strong>
            {busca.trim() || tipoFiltro !== 'todos'
              ? 'Nada com esse filtro'
              : atende
                ? 'Caixa limpa'
                : 'Você ainda não enviou nenhuma mensagem'}
          </strong>
          <span>
            {busca.trim() || tipoFiltro !== 'todos'
              ? 'Tente outro termo, ou volte para "Tudo".'
              : atende
                ? 'Nada esperando resposta por aqui.'
                : `Use o botão "Fale conosco" na barra do portal. Respondemos em até ${SLA_HORAS}h.`}
          </span>
        </div>
      ) : (
        <ul className="fcx-lista">
          {filtrados.map((item) => {
            const t = tipoFaleConosco(item.tipo);
            const Icon = t.Icon;
            const venceu = atrasado(item);
            return (
              <li key={item.id} className={`fcx-item${venceu ? ' is-late' : ''}`}>
                <div className="fcx-item-head">
                  <span className={`fcx-tag fcx-tag-${item.tipo}`}>
                    <Icon size={14} aria-hidden="true" /> {t.label}
                  </span>
                  {atende ? <strong className="fcx-autor">{item.autor?.nome || '—'}</strong> : null}
                  <span className="fcx-meta">
                    {dataHora(item.created_at)}
                    {item.modulo ? ` · ${item.modulo}` : ''}
                    {item.rota ? ` · ${item.rota}` : ''}
                  </span>
                  {item.status === 'aberto' ? (
                    <span className={`fcx-prazo${venceu ? ' is-late' : ''}`}>
                      {venceu ? 'venceu ' : 'responder '}
                      {prazoRelativo(item.prazo_em)}
                    </span>
                  ) : (
                    <span className="fcx-prazo is-done">
                      <CheckCircle2 size={13} /> respondido
                    </span>
                  )}
                </div>

                <p className="fcx-msg">{item.mensagem}</p>

                {item.resposta ? (
                  <div className="fcx-resposta">
                    <span>
                      Resposta
                      {item.respondente?.nome ? ` de ${item.respondente.nome}` : ''}
                      {item.respondido_em ? ` · ${dataHora(item.respondido_em)}` : ''}
                    </span>
                    <p>{item.resposta}</p>
                  </div>
                ) : atende ? (
                  <div className="fcx-responder">
                    <textarea
                      rows={2}
                      className="fc-textarea"
                      placeholder="Escrever a resposta…"
                      value={rascunho[item.id] || ''}
                      onChange={(e) => setRascunho((r) => ({ ...r, [item.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="fc-btn fc-btn-primary"
                      disabled={!((rascunho[item.id] || '').trim()) || salvando === item.id}
                      onClick={() => responder(item)}
                    >
                      {salvando === item.id ? (
                        <Loader2 size={16} className="fc-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      Responder
                    </button>
                  </div>
                ) : (
                  <p className="fcx-aguardando">Aguardando resposta.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
