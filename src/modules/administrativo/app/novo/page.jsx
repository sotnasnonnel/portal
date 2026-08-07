import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Lock, Paperclip, X, Send, AlertCircle, FileText, CheckCircle2, Loader2,
} from 'lucide-react';
import { getClasse, getServico, assuntoDoServico } from '../../../../config/administrativo';
import { useAuth } from '../../../../contexts/AuthContext';
import { criarChamado, buscarConfigServico, listarPessoas } from '../../lib/chamados';
import { validarCamposExtras, limparValores } from '../../lib/camposExtras';
import CampoExtra from './CampoExtra';
import { formDoServico } from './formularios';
import { usaDescricao, usaAnexo } from './formularios/schemas';

// O seletor "Tipo" do Milldesk (incidente/materiais/informação/serviço) saiu da
// tela: ninguém escolhia outra coisa, já que todo item do catálogo é serviço.
// A coluna continua no banco, preenchida com este valor.
const NATUREZA_PADRAO = 'solicitacao_servico';

const formatarTamanho = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function NovoChamadoAdm() {
  const { classe, servico } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputArquivo = useRef(null);

  const [descricao, setDescricao] = useState('');
  const [anexos, setAnexos] = useState([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(null);   // { numero, atendenteNome, aguardandoAprovacao }
  const [config, setConfig] = useState(null);     // null = ainda carregando
  const [pessoas, setPessoas] = useState([]);

  // Serviço com formulário próprio (mobilização) traz o estado inicial dele;
  // os demais começam com os campos extras cadastrados, que são chave/valor.
  const form = formDoServico(classe, servico);
  const [extras, setExtras] = useState(() => (form ? form.estadoInicial() : {}));

  // Trocar de serviço limpa o formulário (reset durante o render, padrão
  // recomendado pelo React em vez de setState dentro de useEffect).
  const chaveAtual = `${classe}/${servico}`;
  const [chaveAnterior, setChaveAnterior] = useState(chaveAtual);
  if (chaveAtual !== chaveAnterior) {
    setChaveAnterior(chaveAtual);
    setDescricao('');
    setAnexos([]);
    setErro('');
    setSucesso(null);
    setExtras(form ? form.estadoInicial() : {});
    setConfig(null);
  }

  // Lista de pessoas para os seletores com busca. Só os formulários que pedem
  // (mobilização/desmobilização) pagam essa consulta.
  useEffect(() => {
    if (!form?.precisaPessoas) return undefined;
    let cancelado = false;
    listarPessoas()
      .then((lista) => { if (!cancelado) setPessoas(lista); })
      .catch((e) => { if (!cancelado) setErro(e.message); });
    return () => { cancelado = true; };
  }, [form?.precisaPessoas]);

  // Definição dos campos extras: vem do cadastro, por serviço.
  useEffect(() => {
    let cancelado = false;
    buscarConfigServico(classe, servico)
      .then((cfg) => { if (!cancelado) setConfig(cfg); })
      .catch((e) => { if (!cancelado) { setConfig({ campos_extras: [] }); setErro(e.message); } });
    return () => { cancelado = true; };
  }, [classe, servico]);

  const cls = getClasse(classe);
  const srv = getServico(classe, servico);
  // Descrição e anexo só onde a planilha pede.
  const temDescricao = usaDescricao(classe, servico);
  const temAnexo = usaAnexo(classe, servico);

  // Par (classe, serviço) inexistente: volta ao catálogo.
  if (!srv) return <Navigate to="/administrativo/novo" replace />;

  const Icon = cls.icon;

  const adicionarAnexos = (e) => {
    const novos = Array.from(e.target.files || []);
    if (novos.length) setAnexos((atual) => [...atual, ...novos]);
    e.target.value = ''; // permite reescolher o mesmo arquivo depois de remover
  };

  const removerAnexo = (idx) => setAnexos((atual) => atual.filter((_, i) => i !== idx));

  const enviar = async (e) => {
    e.preventDefault();
    if (temDescricao && !descricao.trim()) return setErro('A descrição é obrigatória.');
    const definicao = config?.campos_extras || [];
    const erroExtra = form ? form.validar(extras) : validarCamposExtras(definicao, extras);
    if (erroExtra) return setErro(erroExtra);
    setErro('');
    setEnviando(true);
    try {
      const { chamado, atendenteNome } = await criarChamado({
        classe,
        servico,
        // Mobilização define o assunto pelo seletor (nova x movimentação);
        // nos demais o assunto é o próprio rótulo do serviço.
        assunto: assuntoDoServico(classe, servico, extras),
        natureza: NATUREZA_PADRAO,
        descricao,
        campos: form ? extras : limparValores(definicao, extras),
        arquivos: temAnexo ? anexos : [],
        solicitanteId: user.id,
        config,
      });
      setSucesso({
        numero: chamado.numero,
        atendenteNome,
        aguardandoAprovacao: chamado.status === 'aguardando_aprovacao',
      });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="adm-page">
      <button type="button" className="adm-back" onClick={() => navigate('/administrativo/novo')}>
        <ArrowLeft size={16} /> Voltar ao catálogo
      </button>

      <div className="adm-form-cab">
        <span className="adm-cat-ico"><Icon size={24} /></span>
        <div>
          <h1>{srv.label}</h1>
          <small>{cls.label}</small>
        </div>
      </div>

      {/* Passo 5 do POP: ao salvar, o solicitante precisa saber o número e com
          quem o chamado ficou. Aqui isso é a tela toda, não um alert. */}
      {sucesso ? (
        <div className="adm-card adm-sucesso">
          <CheckCircle2 size={40} />
          <h2>Chamado #{sucesso.numero} aberto</h2>
          {sucesso.aguardandoAprovacao ? (
            <p>
              Sua solicitação foi cadastrada e enviada para aprovação. O prazo de atendimento
              começa a contar assim que o gestor aprovar.
            </p>
          ) : (
            <p>
              {sucesso.atendenteNome
                ? <>Sua solicitação foi cadastrada e atribuída ao técnico <strong>{sucesso.atendenteNome}</strong>.</>
                : 'Sua solicitação foi cadastrada. O time do Administrativo vai definir o responsável.'}
            </p>
          )}
          <div className="adm-acoes">
            <Link className="adm-btn adm-btn-primary" to="/administrativo/meus">Ver meus chamados</Link>
            <Link className="adm-btn adm-btn-ghost" to="/administrativo/novo">Abrir outro</Link>
          </div>
        </div>
      ) : (
      <form onSubmit={enviar} noValidate>
        {erro && (
          <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>
        )}

        {/* UM cartão só. Antes os campos do serviço vinham num segundo cartão e
            a tela parecia dois formulários empilhados. */}
        <div className="adm-card">
          {/* Assunto não é digitado: é o título do serviço. Quando o serviço
              tira o assunto de um campo (mobilização), o seletor já é o assunto
              — repetir num campo travado logo abaixo só confundiria. */}
          {!srv.assuntoPorCampo && (
            <div className="adm-campo">
              <label htmlFor="adm-assunto">Assunto</label>
              <div className="adm-travado">
                <input id="adm-assunto" className="adm-input" value={srv.label} readOnly tabIndex={-1} />
                <Lock size={15} aria-hidden="true" />
              </div>
              <span className="adm-campo-dica">Definido pelo serviço escolhido.</span>
            </div>
          )}

          {/* Campos do serviço: no mesmo cartão, na sequência natural. */}
          {form && (
            <form.Componente valores={extras} onChange={setExtras} pessoas={pessoas}
              classe={classe} servico={servico} />
          )}

          {!form && (config?.campos_extras || []).map((campo) => (
            <CampoExtra
              key={campo.chave}
              campo={campo}
              valor={extras[campo.chave]}
              onChange={(chave, valor) => setExtras((a) => ({ ...a, [chave]: valor }))}
            />
          ))}

          {temDescricao && (
          <div className="adm-campo">
            <label htmlFor="adm-descricao">Descrição<span className="req">*</span></label>
            <textarea
              id="adm-descricao"
              className="adm-textarea"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva a solicitação com o máximo de detalhes."
            />
          </div>
          )}

          {temAnexo && (
          <div className="adm-campo">
            <label htmlFor="adm-anexos">Anexos</label>
            <input
              id="adm-anexos"
              ref={inputArquivo}
              type="file"
              multiple
              onChange={adicionarAnexos}
              style={{ display: 'none' }}
            />
            <button type="button" className="adm-anexo-btn" onClick={() => inputArquivo.current?.click()}>
              <Paperclip size={16} /> Anexar arquivos
            </button>
            {anexos.length > 0 && (
              <ul className="adm-anexo-lista">
                {anexos.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="adm-anexo-item">
                    <FileText size={16} />
                    <span className="adm-anexo-nome" title={a.name}>{a.name}</span>
                    <span className="adm-anexo-tam">{formatarTamanho(a.size)}</span>
                    <button type="button" className="adm-anexo-x" onClick={() => removerAnexo(i)} title="Remover">
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}
        </div>

        <div className="adm-acoes">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={enviando}>
            {enviando ? <><Loader2 size={16} className="adm-spin" /> Enviando…</> : <><Send size={16} /> Abrir chamado</>}
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" disabled={enviando}
            onClick={() => navigate('/administrativo/novo')}>
            Cancelar
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
