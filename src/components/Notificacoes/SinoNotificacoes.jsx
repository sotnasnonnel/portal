import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Clock, ThumbsUp, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  listarNotificacoes, marcarLida, marcarTodasLidas, ouvirNotificacoes, NOTIF_EVENT,
} from '../../services/notificacoes';
import './Notificacoes.css';

/**
 * Sino da barra superior: o que aconteceu com os pedidos da pessoa e o que
 * está esperando decisão dela.
 *
 * Fica no PortalHeader, então vale para os módulos todos de uma vez — quem cria
 * as notificações são gatilhos no banco, não as telas.
 */

const VISUAL = {
  sua_vez: { Icon: Clock, tom: 'vez' },
  andamento: { Icon: ThumbsUp, tom: 'andamento' },
  concluida: { Icon: Check, tom: 'ok' },
  reprovada: { Icon: AlertTriangle, tom: 'nao' },
};

const MODULO_LABEL = {
  financeiro: 'Financeiro',
  reembolso: 'Reembolso',
  administrativo: 'Administrativo',
  dp: 'Gestão de Pessoas',
  horas: 'Controle de Horas',
  programas: 'Programas',
  estoque: 'Estoque',
};

// "agora", "há 5 min", "ontem" — data cheia só quando passa de uma semana.
function quando(iso) {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString('pt-BR');
}

export default function SinoNotificacoes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState([]);
  const rootRef = useRef(null);

  // Carga inicial e as três formas de atualizar: chegada em tempo real, foco na
  // aba (socket caído não pode congelar a lista) e o evento interno de "marquei
  // como lida". Tudo num efeito só, para não haver duas fontes de verdade.
  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    // Notificação é acessório: falha de rede aqui não pode quebrar a barra.
    const buscar = () => {
      listarNotificacoes()
        .then((d) => { if (vivo) setLista(d); })
        .catch(() => {});
    };
    buscar();
    const parar = ouvirNotificacoes(user.id, buscar);
    window.addEventListener('focus', buscar);
    window.addEventListener(NOTIF_EVENT, buscar);
    return () => {
      vivo = false;
      parar();
      window.removeEventListener('focus', buscar);
      window.removeEventListener(NOTIF_EVENT, buscar);
    };
  }, [user]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      window.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const naoLidas = lista.filter((n) => !n.lida_em).length;

  const abrir = async (n) => {
    setAberto(false);
    if (!n.lida_em) {
      try { await marcarLida(n.id); } catch { /* abrir é mais importante que a baixa */ }
      setLista((p) => p.map((x) => (x.id === n.id ? { ...x, lida_em: new Date().toISOString() } : x)));
    }
    if (n.href) navigate(n.href);
  };

  const lerTodas = async () => {
    try {
      await marcarTodasLidas();
      const agora = new Date().toISOString();
      setLista((p) => p.map((x) => (x.lida_em ? x : { ...x, lida_em: agora })));
    } catch { /* silencioso: o contador volta na próxima carga */ }
  };

  if (!user?.id) return null;

  return (
    <div className="notif" ref={rootRef}>
      <button
        type="button"
        className="portal-header-help notif-btn"
        onClick={() => setAberto((o) => !o)}
        aria-label={naoLidas ? `Notificações (${naoLidas} não lidas)` : 'Notificações'}
        title="Notificações"
        aria-expanded={aberto}
      >
        <Bell size={20} />
        {naoLidas > 0 && <span className="notif-contador">{naoLidas > 9 ? '9+' : naoLidas}</span>}
      </button>

      {aberto && (
        <div className="notif-pop" role="dialog" aria-label="Notificações">
          <div className="notif-head">
            <strong>Notificações</strong>
            {naoLidas > 0 && (
              <button type="button" className="notif-lertodas" onClick={lerTodas}>
                <CheckCheck size={14} /> Marcar todas como lidas
              </button>
            )}
            <button type="button" className="notif-fechar" onClick={() => setAberto(false)} aria-label="Fechar">
              <X size={16} />
            </button>
          </div>

          {lista.length === 0 ? (
            <div className="notif-vazio">
              <Bell size={22} />
              <span>Nada por aqui ainda.</span>
              <small>Avisamos quando um pedido seu andar ou quando algo precisar de você.</small>
            </div>
          ) : (
            <ul className="notif-lista">
              {lista.map((n) => {
                const v = VISUAL[n.tipo] || VISUAL.andamento;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`notif-item tom-${v.tom} ${n.lida_em ? '' : 'is-nova'}`}
                      onClick={() => abrir(n)}
                    >
                      <span className="notif-ico"><v.Icon size={15} /></span>
                      <span className="notif-corpo">
                        <strong>{n.titulo}</strong>
                        {n.descricao && <span className="notif-desc">{n.descricao}</span>}
                        <span className="notif-meta">
                          {MODULO_LABEL[n.modulo] || n.modulo} · {quando(n.created_at)}
                        </span>
                      </span>
                      {!n.lida_em && <span className="notif-ponto" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
