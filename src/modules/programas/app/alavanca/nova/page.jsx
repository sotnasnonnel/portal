import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, CheckCircle2, Loader2, Rocket, Send, XCircle,
} from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { criarIndicacao } from '../../../lib/alavanca';
import { MENSAGEM_ELEGIBILIDADE } from '../../../lib/elegibilidade';
import TermosAlavanca from '../TermosAlavanca';

/**
 * Indicação do programa Alavanca PHD.
 *
 * Fluxo da planilha: REGRAS com aceite obrigatório -> formulário -> mensagem de
 * elegibilidade logo após o envio. O formulário só aparece depois do aceite.
 */

const VAZIO = {
  oportunidade: '', descricao: '', empresa: '',
  contato_nome: '', contato_cargo: '', contato_telefone: '', contato_email: '',
  tratativas: '',
};

const CAMPOS = [
  ['oportunidade', 'o nome da oportunidade'],
  ['descricao', 'a breve descrição da oportunidade'],
  ['empresa', 'o nome da empresa'],
  ['contato_nome', 'o nome do contato'],
  ['contato_cargo', 'o cargo do contato'],
  ['contato_telefone', 'o telefone'],
  ['contato_email', 'o e-mail'],
  ['tratativas', 'o que já foi tratado'],
];

// Ícone e tom do veredito. O texto ao lado diz a mesma coisa — a cor nunca
// carrega a informação sozinha.
const VEREDITO = {
  elegivel: { Icon: CheckCircle2, tom: 'tom-ok' },
  em_analise: { Icon: AlertTriangle, tom: 'tom-atencao' },
  nao_elegivel: { Icon: XCircle, tom: 'tom-erro' },
  pendente: { Icon: CheckCircle2, tom: 'tom-atencao' },
};

export default function NovaIndicacao() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [aceite, setAceite] = useState(null);       // ISO do aceite das regras
  const [termosAberto, setTermosAberto] = useState(false);
  const [marcado, setMarcado] = useState(false);

  const [v, setV] = useState(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(null);
  const avisoRef = useRef(null);

  const set = (campo) => (e) => setV((a) => ({ ...a, [campo]: e.target.value }));

  const faltando = useMemo(
    () => CAMPOS.filter(([c]) => !String(v[c] || '').trim()).map(([, rot]) => rot),
    [v]
  );

  const confirmarTermos = () => {
    setAceite(new Date().toISOString());
    setTermosAberto(false);
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (faltando.length) {
      setErro(`Ainda falta preencher: ${faltando.join(', ')}.`);
      avisoRef.current?.focus();
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      setPronto(await criarIndicacao({ ...v, aceite_em: aceite }, user.id));
    } catch (err) {
      setErro(err.message);
      avisoRef.current?.focus();
    } finally {
      setEnviando(false);
    }
  };

  if (pronto) {
    const chave = pronto.veredito?.elegibilidade || 'pendente';
    const { Icon, tom } = VEREDITO[chave] || VEREDITO.pendente;
    return (
      <div className="pg-page">
        <div className="pg-card pg-sucesso">
          <Icon size={44} className={tom} />
          <h2>{MENSAGEM_ELEGIBILIDADE[chave]}</h2>
          <p>
            Indicação <strong>#{pronto.numero}</strong> registrada. {pronto.veredito?.motivo}
          </p>
          {/* Barrada não é fim de linha: o comercial ainda enxerga a indicação e
              pode reabrir. Dizer isso evita a leitura de "meu trabalho sumiu". */}
          {chave === 'nao_elegivel' && (
            <p className="pg-campo-dica" style={{ marginTop: 10 }}>
              A indicação fica registrada e visível para o time comercial, que pode revê-la.
            </p>
          )}
          <div className="pg-acoes">
            <button type="button" className="pg-btn pg-btn-ghost" onClick={() => navigate('/programas/alavanca')}>
              Ver minhas indicações
            </button>
            <button
              type="button" className="pg-btn pg-btn-primary"
              onClick={() => { setPronto(null); setV(VAZIO); }}
            >
              Indicar outra
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pg-page">
      <div className="pg-form-cab">
        <span className="pg-prog-ico"><Rocket size={24} /></span>
        <div>
          <h1>Indicar oportunidade</h1>
          <small>Alavanca PHD — indicação comercial com premiação</small>
        </div>
      </div>

      <TermosAlavanca
        aceite={aceite}
        aberto={termosAberto}
        setAberto={setTermosAberto}
        marcado={marcado}
        setMarcado={setMarcado}
        confirmar={confirmarTermos}
      />

      {!aceite ? (
        <div className="pg-vazio">
          O formulário abre depois do aceite das regras.
        </div>
      ) : (
        <>
          {erro && (
            <div className="pg-aviso tom-erro" tabIndex={-1} ref={avisoRef}>
              <AlertCircle size={16} /> {erro}
            </div>
          )}

          <form onSubmit={enviar} noValidate>
            <div className="pg-card">
              <h2 className="pg-card-tit">A oportunidade</h2>
              <div className="pg-campo">
                <label htmlFor="oportunidade">Nome da oportunidade<span className="req">*</span></label>
                <input
                  id="oportunidade" className="pg-input" value={v.oportunidade} onChange={set('oportunidade')}
                  placeholder="Ex.: gerenciamento da ampliação da planta"
                />
              </div>
              <div className="pg-campo">
                <label htmlFor="descricao">Breve descrição da oportunidade<span className="req">*</span></label>
                <textarea id="descricao" className="pg-textarea" value={v.descricao} onChange={set('descricao')} />
              </div>
            </div>

            <div className="pg-card">
              <h2 className="pg-card-tit">A empresa e o contato</h2>
              <div className="pg-campo">
                <label htmlFor="empresa">Nome da empresa<span className="req">*</span></label>
                <input id="empresa" className="pg-input" value={v.empresa} onChange={set('empresa')} />
                {/* Dito antes do envio, e não depois: é a regra que mais reprova
                    indicação, e a pessoa ainda pode escolher outra empresa. */}
                <p className="pg-campo-dica">
                  A indicação só vale se o cliente ainda não tiver sido contatado pelo comercial da PHD.
                  A conferência é automática assim que você enviar.
                </p>
              </div>
              <div className="pg-dupla">
                <div className="pg-campo">
                  <label htmlFor="contato_nome">Nome do contato<span className="req">*</span></label>
                  <input id="contato_nome" className="pg-input" value={v.contato_nome} onChange={set('contato_nome')} />
                </div>
                <div className="pg-campo">
                  <label htmlFor="contato_cargo">Cargo<span className="req">*</span></label>
                  <input id="contato_cargo" className="pg-input" value={v.contato_cargo} onChange={set('contato_cargo')} />
                </div>
                <div className="pg-campo">
                  <label htmlFor="contato_telefone">Telefone<span className="req">*</span></label>
                  <input
                    id="contato_telefone" type="tel" className="pg-input"
                    value={v.contato_telefone} onChange={set('contato_telefone')}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="pg-campo">
                  <label htmlFor="contato_email">E-mail<span className="req">*</span></label>
                  <input
                    id="contato_email" type="email" className="pg-input"
                    value={v.contato_email} onChange={set('contato_email')}
                  />
                </div>
              </div>
            </div>

            <div className="pg-card">
              <h2 className="pg-card-tit">Contexto</h2>
              <div className="pg-campo">
                <label htmlFor="tratativas">
                  Descreva o que já foi tratado ou as informações que já temos da oportunidade
                  <span className="req">*</span>
                </label>
                <textarea id="tratativas" className="pg-textarea" value={v.tratativas} onChange={set('tratativas')} />
              </div>
            </div>

            <div className="pg-acoes">
              <button type="button" className="pg-btn pg-btn-ghost" onClick={() => navigate('/programas/alavanca')}>
                Cancelar
              </button>
              <button type="submit" className="pg-btn pg-btn-primary" disabled={enviando}>
                {enviando
                  ? <><Loader2 size={16} className="pg-spin" /> Verificando…</>
                  : <><Send size={16} /> Enviar indicação</>}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
