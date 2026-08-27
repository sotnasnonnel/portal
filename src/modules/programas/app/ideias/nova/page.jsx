import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, AlertCircle, CheckCircle2, Loader2, Plus, Send, X,
} from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import {
  CATEGORIAS, SETORES, SITUACOES, getForma,
} from '../../../../../config/programas';
import { criarIdeia } from '../../../lib/ideias';

/**
 * Formulário do Campo de Ideias. Uma tela para as duas formas (ideia e
 * iniciativa): o que muda é o conjunto de campos, não o fluxo. Duas telas
 * separadas duplicariam validação, envio e confirmação para ganhar nada.
 *
 * Todo campo é obrigatório, com a exceção que a planilha registra: link e
 * observações da iniciativa.
 */

const VAZIO = {
  titulo: '', setor: '', categoria: '', retorno: '',
  descricao: '', problema: '', beneficios: '',
  data_inicio: '', finalidade: '', situacao: 'idealizado',
  link: '', observacoes: '',
};

export default function NovaIdeia() {
  const { tipo } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const forma = getForma(tipo);
  const ehIniciativa = tipo === 'iniciativa';

  const [v, setV] = useState(VAZIO);
  // Ferramentas é lista ("prever mais de uma"): começa com uma caixa vazia para
  // o campo não parecer um botão a ser descoberto. Cada linha carrega um id
  // próprio — com a posição como chave, remover a 1ª faria o React reaproveitar
  // o input errado e o cursor pular de campo enquanto se digita.
  const [ferramentas, setFerramentas] = useState([{ id: 1, valor: '' }]);
  const proximoId = useRef(2);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(null);
  const avisoRef = useRef(null);

  const set = (campo) => (e) => setV((a) => ({ ...a, [campo]: e.target.value }));

  const trocarFerramenta = (id, valor) =>
    setFerramentas((a) => a.map((f) => (f.id === id ? { ...f, valor } : f)));
  const removerFerramenta = (id) =>
    setFerramentas((a) => (a.length === 1
      ? [{ id: proximoId.current++, valor: '' }]
      : a.filter((f) => f.id !== id)));
  const adicionarFerramenta = () =>
    setFerramentas((a) => [...a, { id: proximoId.current++, valor: '' }]);

  // O que falta preencher, na ordem em que aparece na tela — a primeira
  // pendência é a que a mensagem de erro cita.
  const faltando = useMemo(() => {
    const obrig = ehIniciativa
      ? [
        ['data_inicio', 'a data de início da criação'],
        ['setor', 'o setor'],
        ['titulo', 'o que você está criando'],
        ['finalidade', 'a finalidade'],
        ['categoria', 'o tipo'],
        ['situacao', 'a situação'],
        ['retorno', 'o retorno da iniciativa'],
      ]
      : [
        ['titulo', 'o título da ideia'],
        ['setor', 'o setor'],
        ['descricao', 'a descrição da ideia'],
        ['problema', 'o problema que ela resolve'],
        ['beneficios', 'os benefícios esperados'],
        ['categoria', 'o tipo'],
        ['retorno', 'o retorno da iniciativa'],
      ];
    const pendentes = obrig.filter(([campo]) => !String(v[campo] || '').trim()).map(([, rot]) => rot);
    if (ehIniciativa && !ferramentas.some((f) => f.valor.trim())) pendentes.push('a ferramenta usada');
    return pendentes;
  }, [v, ferramentas, ehIniciativa]);

  if (!forma) {
    return (
      <div className="pg-page">
        <div className="pg-vazio">
          Formulário não encontrado. <Link className="pg-link" to="/programas/ideias">Voltar ao Campo de Ideias</Link>.
        </div>
      </div>
    );
  }

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
      const registro = await criarIdeia(
        { ...v, tipo, ferramentas: ferramentas.map((f) => f.valor).filter((f) => f.trim()) },
        user.id
      );
      setPronto(registro);
    } catch (err) {
      setErro(err.message);
      avisoRef.current?.focus();
    } finally {
      setEnviando(false);
    }
  };

  if (pronto) {
    return (
      <div className="pg-page">
        <div className="pg-card pg-sucesso">
          <CheckCircle2 size={44} className="tom-ok" />
          <h2>{forma.label} registrada!</h2>
          <p>
            Sua {forma.label.toLowerCase()} <strong>#{pronto.numero} — {pronto.titulo}</strong> entrou
            no Campo de Ideias e já aparece no Painel da Inovação para toda a empresa.
          </p>
          <div className="pg-acoes">
            <button type="button" className="pg-btn pg-btn-ghost" onClick={() => navigate('/programas/dashboard')}>
              Ver no Painel da Inovação
            </button>
            <button
              type="button"
              className="pg-btn pg-btn-primary"
              onClick={() => {
                setPronto(null);
                setV(VAZIO);
                setFerramentas([{ id: proximoId.current++, valor: '' }]);
              }}
            >
              Registrar outra
            </button>
          </div>
        </div>
      </div>
    );
  }

  const Icon = forma.icon;

  return (
    <div className="pg-page">
      <button type="button" className="pg-back" onClick={() => navigate('/programas/ideias')}>
        <ArrowLeft size={15} /> Trocar de formulário
      </button>

      <div className="pg-form-cab">
        <span className="pg-prog-ico"><Icon size={24} /></span>
        <div>
          <h1>{ehIniciativa ? 'Cadastrar iniciativa' : 'Registrar ideia'}</h1>
          <small>{forma.ajuda}</small>
        </div>
      </div>

      {erro && (
        <div className="pg-aviso tom-erro" tabIndex={-1} ref={avisoRef}>
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      <form onSubmit={enviar} noValidate>
        {ehIniciativa && (
          <div className="pg-card">
            <h2 className="pg-card-tit">Origem</h2>
            <div className="pg-campo">
              <label htmlFor="data_inicio">Data de início da criação<span className="req">*</span></label>
              <input
                id="data_inicio" type="date" className="pg-input"
                value={v.data_inicio} onChange={set('data_inicio')}
              />
            </div>
          </div>
        )}

        <div className="pg-card">
          <h2 className="pg-card-tit">{ehIniciativa ? 'A iniciativa' : 'A ideia'}</h2>

          <div className="pg-campo">
            <label htmlFor="titulo">
              {ehIniciativa ? 'O que está criando' : 'Título da ideia'}<span className="req">*</span>
            </label>
            <input
              id="titulo" className="pg-input" value={v.titulo} onChange={set('titulo')}
              placeholder={ehIniciativa
                ? 'Ex.: painel de acompanhamento de medições'
                : 'Ex.: plataforma de aconselhamento virtual para empreendedores'}
            />
          </div>

          {/* Setor vale para as duas formas: é a dimensão do gráfico do
              Dashboard, que separa ideias de iniciativas por setor. */}
          <div className="pg-campo">
            <label htmlFor="setor">Setor<span className="req">*</span></label>
            <select id="setor" className="pg-select" value={v.setor} onChange={set('setor')}>
              <option value="">Selecione…</option>
              {SETORES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            {!ehIniciativa && (
              <p className="pg-campo-dica">
                A que área a ideia se aplica — não precisa ser a sua.
              </p>
            )}
          </div>

          {!ehIniciativa && (
            <>
              <div className="pg-campo">
                <label htmlFor="descricao">Descrição da ideia<span className="req">*</span></label>
                <textarea
                  id="descricao" className="pg-textarea" value={v.descricao} onChange={set('descricao')}
                  placeholder="Ex.: criar plataforma online que conecta empreendedores e mentores…"
                />
              </div>
              <div className="pg-campo">
                <label htmlFor="problema">Problema que resolve<span className="req">*</span></label>
                <textarea
                  id="problema" className="pg-textarea" value={v.problema} onChange={set('problema')}
                  placeholder="Ex.: falta de acesso a conselheiros especializados…"
                />
              </div>
              <div className="pg-campo">
                <label htmlFor="beneficios">Benefícios esperados<span className="req">*</span></label>
                <textarea
                  id="beneficios" className="pg-textarea" value={v.beneficios} onChange={set('beneficios')}
                  placeholder="Ex.: melhora no desempenho dos negócios…"
                />
              </div>
            </>
          )}

          {ehIniciativa && (
            <>
              <div className="pg-campo">
                <label>Ferramenta usada<span className="req">*</span></label>
                <p className="pg-campo-dica">Pode ser mais de uma — adicione uma linha por ferramenta.</p>
                <div className="pg-lista-campo">
                  {ferramentas.map((f, i) => (
                    <div className="pg-lista-linha" key={f.id}>
                      <input
                        className="pg-input" value={f.valor}
                        onChange={(e) => trocarFerramenta(f.id, e.target.value)}
                        placeholder="Ex.: Power BI, Excel, n8n, Python…"
                        aria-label={`Ferramenta ${i + 1}`}
                      />
                      <button
                        type="button" className="pg-lista-x"
                        onClick={() => removerFerramenta(f.id)}
                        title="Remover ferramenta"
                        aria-label={`Remover ferramenta ${i + 1}`}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="pg-lista-add" onClick={adicionarFerramenta}>
                    <Plus size={14} /> Adicionar ferramenta
                  </button>
                </div>
              </div>

              <div className="pg-campo">
                <label htmlFor="finalidade">Finalidade<span className="req">*</span></label>
                <textarea
                  id="finalidade" className="pg-textarea" value={v.finalidade} onChange={set('finalidade')}
                  placeholder="Para que serve e quem usa."
                />
              </div>
            </>
          )}
        </div>

        <div className="pg-card">
          <h2 className="pg-card-tit">Classificação</h2>

          <div className="pg-campo">
            <label>Tipo<span className="req">*</span></label>
            <p className="pg-campo-dica">É por aqui que o quadro do painel se organiza.</p>
            <div className="pg-chips">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.valor} type="button"
                  className={`pg-chip ${v.categoria === c.valor ? 'is-on' : ''}`}
                  aria-pressed={v.categoria === c.valor}
                  onClick={() => setV((a) => ({ ...a, categoria: c.valor }))}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {ehIniciativa && (
            <div className="pg-campo">
              <label>Situação<span className="req">*</span></label>
              <div className="pg-chips">
                {SITUACOES.map((s) => (
                  <button
                    key={s.valor} type="button"
                    className={`pg-chip ${v.situacao === s.valor ? 'is-on' : ''}`}
                    aria-pressed={v.situacao === s.valor}
                    onClick={() => setV((a) => ({ ...a, situacao: s.valor }))}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pg-campo">
            <label htmlFor="retorno">Retorno da iniciativa<span className="req">*</span></label>
            <textarea
              id="retorno" className="pg-textarea" value={v.retorno} onChange={set('retorno')}
              placeholder="Descreva o ganho financeiro, de tempo ou de produtividade esperado. Ex.: redução de rotina em 2 horas semanais."
            />
          </div>
        </div>

        {ehIniciativa && (
          <div className="pg-card">
            <h2 className="pg-card-tit">Complementos</h2>
            <div className="pg-campo">
              <label htmlFor="link">Link do arquivo / pasta<span className="opc">(opcional)</span></label>
              <input
                id="link" className="pg-input" value={v.link} onChange={set('link')}
                placeholder="https://…"
              />
            </div>
            <div className="pg-campo">
              <label htmlFor="observacoes">Observações<span className="opc">(opcional)</span></label>
              <textarea id="observacoes" className="pg-textarea" value={v.observacoes} onChange={set('observacoes')} />
            </div>
          </div>
        )}

        <div className="pg-acoes">
          <button type="button" className="pg-btn pg-btn-ghost" onClick={() => navigate('/programas/ideias')}>
            Cancelar
          </button>
          <button type="submit" className="pg-btn pg-btn-primary" disabled={enviando}>
            {enviando ? <><Loader2 size={16} className="pg-spin" /> Enviando…</> : <><Send size={16} /> Registrar</>}
          </button>
        </div>
      </form>
    </div>
  );
}
