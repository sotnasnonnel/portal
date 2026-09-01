import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Send, Loader2, CheckCircle2, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { modulosVisiveis, moduloPadrao } from '../../config/modulosPortal';
import { supabase } from '../../services/supabase';
import {
  FALE_CONOSCO_OPEN_EVENT,
  SLA_HORAS,
  TIPOS_FALE_CONOSCO,
  ehSuporte,
  tipoFaleConosco,
} from '../../config/suporte';
import './FaleConosco.css';

// Modal do "Fale conosco". Abre pelo botão da barra superior (evento
// FALE_CONOSCO_OPEN_EVENT) e mora dentro do PortalHeader, que é compartilhado
// pelos módulos — assim o canal existe em qualquer tela, sem cada app montar o
// seu.
//
// Grava o MÓDULO e a ROTA de onde a pessoa estava: "não consigo salvar" sem a
// tela é um bug que ninguém reproduz. O módulo vem escolhido pela tela em que
// ela está, mas é EDITÁVEL — quem tropeça no Estoque muitas vezes só vai
// escrever depois, já de volta na Home, e travar o campo faria o relato chegar
// com o módulo errado. A lista oferece só os módulos que a pessoa enxerga.
export default function FaleConoscoModal({ modulo = '', caixa = null }) {
  const { user, modules } = useAuth();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState('bug');
  const disponiveis = useMemo(() => modulosVisiveis(user, modules), [user, modules]);
  const [sobre, setSobre] = useState(() => moduloPadrao(modulo, disponiveis));
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const abrir = () => {
      setTipo('bug');
      setMensagem('');
      setSobre(moduloPadrao(modulo, disponiveis));
      setEnviado(false);
      setErro('');
      setOpen(true);
    };
    window.addEventListener(FALE_CONOSCO_OPEN_EVENT, abrir);
    return () => window.removeEventListener(FALE_CONOSCO_OPEN_EVENT, abrir);
  }, [modulo, disponiveis]);

  const fechar = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, fechar]);

  if (!open) return null;

  const info = tipoFaleConosco(tipo);
  const podeEnviar = mensagem.trim().length >= 5 && !enviando;

  async function enviar(event) {
    event.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro('');
    const { error } = await supabase.from('fale_conosco').insert({
      autor_id: user?.id,
      tipo,
      modulo: sobre,
      // O portal roda em HashRouter: o que identifica a tela é o hash.
      rota: window.location.hash.replace(/^#/, '') || '/',
      mensagem: mensagem.trim(),
    });
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEnviado(true);
    caixa?.recarregar?.();
  }

  return (
    <div className="guia-overlay" role="dialog" aria-modal="true" aria-label="Fale conosco">
      <div className="guia-modal fc-modal">
        <div className="fc-head">
          <div>
            <strong>Fale conosco</strong>
            <span>Bug, melhoria ou elogio — sobre o portal</span>
          </div>
          {/* Para quem atende, a caixa é destino próprio e fica no topo, com o
              que está esperando. Antes era um botão colado no "Enviar": uma
              navegação disputando espaço com a ação principal do formulário —
              e sem dizer que havia fila. */}
          {ehSuporte(user) ? (
            <Link
              className={`fc-caixa-link${caixa?.atrasados > 0 ? ' is-late' : ''}`}
              to="/fale-conosco"
              onClick={fechar}
            >
              <Inbox size={15} />
              {caixa?.abertos > 0 ? `Caixa · ${caixa.abertos}` : 'Caixa'}
            </Link>
          ) : null}
          <button type="button" className="guia-close" onClick={fechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {enviado ? (
          <div className="fc-ok">
            <CheckCircle2 size={40} aria-hidden="true" />
            <strong>Recebido!</strong>
            <p>
              Respondemos em até {SLA_HORAS}h, e o aviso chega no sino aqui do portal.
            </p>
            <div className="fc-ok-acoes">
              {/* Depois de enviar, o caminho para acompanhar a resposta tem de
                  estar à mão — senão o único rastro é a notificação. */}
              <Link className="fc-btn fc-btn-ghost" to="/fale-conosco" onClick={fechar}>
                <Inbox size={16} /> Acompanhar
              </Link>
              <button type="button" className="fc-btn fc-btn-primary" onClick={fechar}>
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form className="fc-body" onSubmit={enviar}>
            <div className="fc-tipos" role="radiogroup" aria-label="Tipo">
              {TIPOS_FALE_CONOSCO.map((t) => {
                const Icon = t.Icon;
                const ativo = t.id === tipo;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    className={`fc-tipo${ativo ? ' is-on' : ''}`}
                    onClick={() => setTipo(t.id)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="fc-ajuda">{info.ajuda}</p>

            <label className="fc-label" htmlFor="fc-sobre">
              Sobre qual módulo
            </label>
            <select
              id="fc-sobre"
              className="fc-select"
              value={sobre}
              onChange={(e) => setSobre(e.target.value)}
            >
              {disponiveis.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <label className="fc-label fc-label-sep" htmlFor="fc-msg">
              Sua mensagem
            </label>
            <textarea
              id="fc-msg"
              className="fc-textarea"
              rows={5}
              value={mensagem}
              placeholder={info.placeholder}
              onChange={(e) => setMensagem(e.target.value)}
              autoFocus
            />

            {erro ? <p className="fc-erro">Não consegui enviar: {erro}</p> : null}

            <p className="fc-sla">
              Vai identificado com o seu nome — é assim que a resposta encontra você.
              Prazo de resposta: <strong>{SLA_HORAS}h</strong>.
            </p>

            <div className="fc-acoes">
              <button type="submit" className="fc-btn fc-btn-primary" disabled={!podeEnviar}>
                {enviando ? <Loader2 size={16} className="fc-spin" /> : <Send size={16} />}
                Enviar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
