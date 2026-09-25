import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Send, Loader2, CheckCircle2, Inbox, Paperclip, FileText, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { modulosVisiveis, moduloPadrao } from '../../config/modulosPortal';
import { supabase } from '../../services/supabase';
import { enviarAnexosFaleConosco, descartarAnexosFaleConosco } from '../../services/faleConoscoAnexos';
import {
  ANEXOS_FC,
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
//
// Aceita anexos (até ANEXOS_FC.max) por botão ou COLANDO o print com Ctrl+V —
// quem tira print para mostrar um bug quase nunca salva o arquivo antes.
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
  const [arquivos, setArquivos] = useState([]);   // File[]
  const [erroAnexo, setErroAnexo] = useState('');
  const inputRef = useRef(null);

  // Miniatura das imagens escolhidas. As object URLs são liberadas quando a
  // lista muda ou o modal desmonta — senão cada print colado fica na memória.
  const previas = useMemo(
    () => arquivos.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)),
    [arquivos],
  );
  useEffect(() => () => previas.forEach((u) => u && URL.revokeObjectURL(u)), [previas]);

  useEffect(() => {
    const abrir = () => {
      setTipo('bug');
      setMensagem('');
      setArquivos([]);
      setErroAnexo('');
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

  // Valida antes de aceitar: tipo e tamanho errados só apareceriam no envio,
  // como a recusa crua do Storage.
  function adicionar(lista) {
    const novos = Array.from(lista || []);
    if (!novos.length) return;
    const problemas = [];
    const ok = [];
    for (const f of novos) {
      if (!ANEXOS_FC.tipos.includes(f.type)) problemas.push(`"${f.name}" não é imagem (PNG, JPG) nem PDF.`);
      else if (f.size > ANEXOS_FC.maxMb * 1024 * 1024) problemas.push(`"${f.name}" passa de ${ANEXOS_FC.maxMb} MB.`);
      else ok.push(f);
    }
    const chave = (f) => `${f.name}::${f.size}`;
    const vistos = new Set(arquivos.map(chave));
    const unicos = ok.filter((f) => !vistos.has(chave(f)));
    const cabem = unicos.slice(0, Math.max(0, ANEXOS_FC.max - arquivos.length));
    if (cabem.length < unicos.length) problemas.push(`No máximo ${ANEXOS_FC.max} anexos.`);
    setErroAnexo(problemas.join(' '));
    if (cabem.length) setArquivos((prev) => [...prev, ...cabem]);
    if (inputRef.current) inputRef.current.value = '';
  }

  const remover = (i) => {
    setErroAnexo('');
    setArquivos((prev) => prev.filter((_, j) => j !== i));
  };

  // Print colado chega como "image.png", sempre com o mesmo nome: renomeia
  // para os dois prints da mesma mensagem não se confundirem na caixa.
  function colar(event) {
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length) return;           // colar texto segue normal
    event.preventDefault();
    const hora = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
    adicionar(files.map((f, i) => {
      if (!f.type.startsWith('image/') || (f.name && f.name !== 'image.png')) return f;
      const ext = f.type === 'image/jpeg' ? 'jpg' : f.type.split('/')[1];
      return new File([f], `print-${hora}${files.length > 1 ? `-${i + 1}` : ''}.${ext}`, { type: f.type });
    }));
  }

  async function enviar(event) {
    event.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro('');
    // Os anexos sobem ANTES da mensagem: depois de gravada, o autor não edita
    // mais a linha (RLS), então não há como pendurá-los depois.
    let anexos = [];
    try {
      anexos = await enviarAnexosFaleConosco(user?.id, arquivos);
    } catch (e) {
      setEnviando(false);
      setErro(e.message);
      return;
    }
    const { error } = await supabase.from('fale_conosco').insert({
      autor_id: user?.id,
      tipo,
      modulo: sobre,
      // O portal roda em HashRouter: o que identifica a tela é o hash.
      rota: window.location.hash.replace(/^#/, '') || '/',
      mensagem: mensagem.trim(),
      anexos,
    });
    setEnviando(false);
    if (error) {
      await descartarAnexosFaleConosco(anexos);
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
          <form className="fc-body" onSubmit={enviar} onPaste={colar}>
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

            <div className="fc-anexos">
              <div className="fc-anexos-barra">
                <button
                  type="button"
                  className="fc-btn fc-btn-ghost fc-btn-sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={arquivos.length >= ANEXOS_FC.max || enviando}
                >
                  <Paperclip size={15} /> Anexar
                </button>
                <span className="fc-anexos-dica">
                  ou cole um print (Ctrl+V) · imagem ou PDF, até {ANEXOS_FC.max} de {ANEXOS_FC.maxMb} MB
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ANEXOS_FC.accept}
                  multiple
                  hidden
                  onChange={(e) => adicionar(e.target.files)}
                />
              </div>

              {arquivos.length ? (
                <ul className="fc-anexos-lista">
                  {arquivos.map((f, i) => (
                    <li key={`${f.name}::${f.size}`} className="fc-anexo">
                      {previas[i] ? (
                        <img src={previas[i]} alt="" className="fc-anexo-thumb" />
                      ) : (
                        <span className="fc-anexo-thumb fc-anexo-pdf"><FileText size={18} /></span>
                      )}
                      <span className="fc-anexo-nome" title={f.name}>{f.name}</span>
                      <button
                        type="button"
                        className="fc-anexo-x"
                        onClick={() => remover(i)}
                        aria-label={`Remover ${f.name}`}
                        disabled={enviando}
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {erroAnexo ? <p className="fc-erro">{erroAnexo}</p> : null}

              {/* Print mostra o que estava na tela, inclusive o que não é da
                  pessoa. O aviso fica sempre à vista, não só depois de anexar:
                  é antes de tirar o print que dá para evitar o problema. */}
              <p className="fc-aviso-sensivel">
                <ShieldAlert size={15} aria-hidden="true" />
                <span>
                  Antes de anexar, confira o que aparece: evite prints com dados pessoais
                  ou sigilosos (seus ou de outras pessoas), como salário, CPF, dados
                  bancários ou de saúde. Se a tela tiver, recorte ou cubra essa parte.
                </span>
              </p>
            </div>

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
