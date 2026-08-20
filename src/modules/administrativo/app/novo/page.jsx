import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Lock, Paperclip, X, Send, AlertCircle, FileText, CheckCircle2, Loader2, Star,
  Layers,
} from 'lucide-react';
import { getClasse, getServico, assuntoDoServico } from '../../../../config/administrativo';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  criarChamado, criarMobilizacaoComAdicionais, buscarConfigServico, listarPessoas,
  buscarAvaliacaoPendente, buscarCentroDeCusto,
} from '../../lib/chamados';
import { desdobrarMobilizacao } from '../../lib/desdobramento';
import { validarCamposExtras, limparValores, mesclarComExtras } from '../../lib/camposExtras';
import CampoExtra from './CampoExtra';
import { formDoServico } from './formularios';
import { usaDescricao, usaAnexo } from './formularios/schemas';

// O seletor "Tipo" do Milldesk (incidente/materiais/informação/serviço) saiu da
// tela: ninguém escolhia outra coisa, já que todo item do catálogo é serviço.
// A coluna continua no banco, preenchida com este valor.
const NATUREZA_PADRAO = 'solicitacao_servico';

/**
 * "Fulano", "Fulano e Beltrano", "Fulano, Beltrano e Sicrano" — na ordem em que
 * vão decidir. Nomear quem aprova evita a leitura de que dois pedidos parecidos
 * foram para pessoas diferentes por defeito: o que muda o aprovador é o valor.
 */
const listarNomes = (nomes = []) => (nomes.length <= 1
  ? (nomes[0] || '')
  : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);

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
  const [pendente, setPendente] = useState(null); // avaliação que trava a abertura
  // Centro de custo do organograma. '' = pessoa sem gerência; null = carregando.
  const [centroCusto, setCentroCusto] = useState(null);
  const avisoErro = useRef(null);
  // Contador de tentativas, não o texto do erro: errar DUAS vezes no mesmo campo
  // repete a mesma mensagem, e um efeito preso ao texto não dispararia de novo.
  const [tentativa, setTentativa] = useState(0);

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

  // A trava do POP 9.1 é da RLS, mas descobri-la só no envio faz a pessoa
  // preencher o formulário inteiro para levar um "não" — e sem saber qual
  // chamado avaliar. Consultada na abertura, ela vira um aviso com link.
  const verificarPendencia = useCallback(async () => {
    if (!user?.id) return;
    try {
      const p = await buscarAvaliacaoPendente(user.id);
      setPendente(p);
      // Quem avalia numa aba e volta para esta encontrava o aviso do envio
      // anterior ainda na tela: `erro` só é reescrito no envio seguinte, então
      // a mensagem sobrevivia ao próprio motivo dela.
      if (!p) setErro((atual) => (/avalia/i.test(atual) ? '' : atual));
    } catch {
      // Silencioso: a RLS barra de todo jeito no envio.
    }
  }, [user?.id]);

  // Revalidado ao voltar para a aba, e não só na montagem: avaliar acontece em
  // outra tela, e às vezes em outra janela.
  useEffect(() => {
    verificarPendencia();
    window.addEventListener('focus', verificarPendencia);
    return () => window.removeEventListener('focus', verificarPendencia);
  }, [verificarPendencia]);

  // Envio recusado: rola até o aviso e o foca. Sem isso, em serviço com muitos
  // campos o erro aparece fora da tela e o clique parece não ter funcionado.
  // Focar (e não só rolar) leva junto quem navega por teclado e faz o leitor de
  // tela anunciar o motivo.
  useEffect(() => {
    if (!tentativa || !avisoErro.current) return;
    const semAnimacao = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    avisoErro.current.scrollIntoView({
      behavior: semAnimacao ? 'auto' : 'smooth', block: 'center',
    });
    avisoErro.current.focus({ preventScroll: true });
  }, [tentativa]);

  // Centro de custo vem do organograma, não do teclado: digitado à mão, cada
  // pessoa escrevia de um jeito e nenhum relatório por CC fechava depois.
  useEffect(() => {
    let cancelado = false;
    buscarCentroDeCusto(user?.horasGerenciaId)
      .then((n) => { if (!cancelado) setCentroCusto(n); })
      .catch(() => { if (!cancelado) setCentroCusto(''); });
    return () => { cancelado = true; };
  }, [user?.horasGerenciaId]);

  // Preenche o campo assim que o nome chega, sem pisar no que a pessoa digitou
  // (nos casos em que ela pôde digitar, por não ter gerência).
  useEffect(() => {
    if (!centroCusto) return;
    setExtras((a) => (a.cc === centroCusto ? a : { ...a, cc: centroCusto }));
  }, [centroCusto, chaveAtual]);

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

  // Mobilização desdobra os adicionais em chamados próprios. Calculado durante
  // o preenchimento para a pessoa ver o que vai acontecer antes de enviar —
  // descobrir depois que "abriu 4 chamados" pareceria erro do sistema.
  const ehMobilizacao = classe === 'mobilizacao' && servico === 'mobilizacao';
  const desdobramentos = ehMobilizacao ? desdobrarMobilizacao(extras) : [];

  // Par (classe, serviço) inexistente: volta ao catálogo.
  if (!srv) return <Navigate to="/administrativo/novo" replace />;

  const Icon = cls.icon;

  const adicionarAnexos = (e) => {
    const novos = Array.from(e.target.files || []);
    if (novos.length) setAnexos((atual) => [...atual, ...novos]);
    e.target.value = ''; // permite reescolher o mesmo arquivo depois de remover
  };

  const removerAnexo = (idx) => setAnexos((atual) => atual.filter((_, i) => i !== idx));

  // O botão fica no fim do formulário e o aviso no topo: em serviço com muitos
  // campos, o erro nasce fora da tela e a pessoa acha que o clique não pegou.
  const falhar = (msg) => {
    setErro(msg);
    setTentativa((n) => n + 1);
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (temDescricao && !descricao.trim()) return falhar('A descrição é obrigatória.');
    const definicao = config?.campos_extras || [];
    // As duas validações: a do formulário do serviço e a dos campos cadastrados.
    // Antes só uma delas rodava, então campo extra obrigatório num serviço com
    // formulário próprio passava batido.
    const erroExtra = (form ? form.validar(extras) : '')
      || validarCamposExtras(definicao, extras);
    if (erroExtra) return falhar(erroExtra);
    setErro('');
    setEnviando(true);
    try {
      // Mobilização tem caminho próprio: além do pedido dela, abre um chamado
      // para cada adicional escolhido, no serviço que já cuida daquilo.
      if (ehMobilizacao) {
        const r = await criarMobilizacaoComAdicionais({
          assunto: assuntoDoServico(classe, servico, extras),
          natureza: NATUREZA_PADRAO,
          descricao,
          campos: extras,
          solicitanteId: user.id,
          config,
        });
        setSucesso({
          numero: r.chamado.numero,
          atendenteNome: r.atendenteNome,
          aprovadores: r.aprovadoresNomes,
          aguardandoAprovacao: r.chamado.status === 'aguardando_aprovacao',
          filhos: r.filhos,
        });
        return;
      }

      const { chamado, atendenteNome, aprovadoresNomes } = await criarChamado({
        classe,
        servico,
        // Mobilização define o assunto pelo seletor (nova x movimentação);
        // nos demais o assunto é o próprio rótulo do serviço.
        assunto: assuntoDoServico(classe, servico, extras),
        natureza: NATUREZA_PADRAO,
        descricao,
        // Campos do serviço + campos extras cadastrados, no mesmo objeto.
        campos: form ? mesclarComExtras(extras, definicao) : limparValores(definicao, extras),
        arquivos: temAnexo ? anexos : [],
        solicitanteId: user.id,
        config,
      });
      setSucesso({
        numero: chamado.numero,
        atendenteNome,
        aprovadores: aprovadoresNomes,
        aguardandoAprovacao: chamado.status === 'aguardando_aprovacao',
      });
    } catch (err) {
      // Também aqui: a recusa do servidor (alçada sem aprovador, RLS) chega
      // depois do upload, quando a pessoa já rolou a tela para baixo.
      falhar(err.message);
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
              Sua solicitação foi cadastrada e enviada para aprovação
              {sucesso.aprovadores?.length ? <> de <strong>{listarNomes(sucesso.aprovadores)}</strong></> : null}.
              {' '}O prazo de atendimento começa a contar assim que o gestor aprovar.
            </p>
          ) : (
            <p>
              {sucesso.atendenteNome
                ? <>Sua solicitação foi cadastrada e atribuída ao técnico <strong>{sucesso.atendenteNome}</strong>.</>
                : 'Sua solicitação foi cadastrada. O time do Administrativo vai definir o responsável.'}
            </p>
          )}
          {/* Os adicionais viraram pedidos próprios: dizer quais e com que
              número evita a impressão de que o portal abriu chamado demais. */}
          {sucesso.filhos?.length > 0 && (
            <div className="adm-sucesso-filhos">
              <strong>Também foram abertos, cada um com seu aprovador e prazo:</strong>
              <ul>
                {sucesso.filhos.map((f) => (
                  <li key={f.numero}>
                    #{f.numero} — {getServico(f.classe, f.servico)?.label || f.servico}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="adm-acoes">
            <Link className="adm-btn adm-btn-primary" to="/administrativo/meus">Ver meus chamados</Link>
            <Link className="adm-btn adm-btn-ghost" to="/administrativo/novo">Abrir outro</Link>
          </div>
        </div>
      ) : (
      <form onSubmit={enviar} noValidate>
        {erro && (
          <div className="adm-aviso tom-erro" ref={avisoErro} tabIndex={-1} role="alert">
            <AlertCircle size={16} /> {erro}
          </div>
        )}

        {/* Avisado aqui em cima, com o número e o link: a trava é da RLS e vale
            de qualquer jeito, mas descobri-la depois de preencher tudo — e sem
            saber qual chamado é — não ajuda ninguém. */}
        {pendente && (
          <div className="adm-aviso tom-erro">
            <Star size={16} />
            <span>
              O chamado <strong>#{pendente.numero} — {pendente.assunto}</strong> foi fechado e
              ainda espera sua avaliação. Avalie-o para poder abrir um novo.
              {' '}
              <Link className="adm-link" to={`/administrativo/chamado/${pendente.id}`}>
                Avaliar agora
              </Link>.
            </span>
          </div>
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
              classe={classe} servico={servico} travarCc={!!centroCusto} />
          )}

          {/* Depois dos campos do serviço, nunca no lugar deles: o que o time do
              Adm cadastra é um acréscimo àquele formulário, não um substituto. */}
          {(config?.campos_extras || []).map((campo) => (
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

        {/* Antes do botão, não depois: ver "serão abertos 4 chamados" só na tela
            de sucesso pareceria erro do sistema. */}
        {desdobramentos.length > 0 && (
          <div className="adm-aviso tom-info">
            <Layers size={16} />
            <span>
              Os adicionais escolhidos serão abertos como pedidos separados, cada um com
              seu aprovador e prazo — a mobilização segue inteira, como você preencheu.
              Serão {desdobramentos.length === 1 ? 'mais 1 chamado' : `mais ${desdobramentos.length} chamados`}:
              {' '}
              {desdobramentos
                .map((f) => getServico(f.classe, f.servico)?.label || f.servico)
                .join(', ')}.
            </span>
          </div>
        )}

        <div className="adm-acoes">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={enviando || !!pendente}>
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
