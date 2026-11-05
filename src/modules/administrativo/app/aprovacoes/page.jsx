import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, Check, CheckCircle2, X, Loader2, AlertCircle, Paperclip, ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { getClasse, getServico } from '../../../../config/administrativo';
import { rotuloDoCampo, formatarValorCampo } from '../novo/formularios/schemas';
import { contextoDoChamado } from '../../lib/rotulos';
import { listarAprovacoesPendentes, decidirChamado } from '../../lib/chamados';
import { formatarDataHora } from '../../../../utils/formatters';
import { CabecalhoPagina, Vazio, Carregando } from '../components/ui';

const dataHora = (iso) => formatarDataHora(iso, '—');

export default function AprovacoesAdm() {
  const { user } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  // Chamado em processamento e qual botão foi apertado: o giro aparece nele.
  const [decidindo, setDecidindo] = useState(null);
  const [justificativas, setJustificativas] = useState({});
  // Erro de decisão fica DENTRO do cartão. No topo da página ele ficava fora da
  // tela de quem estava decidindo o quinto chamado da lista: o botão parecia não
  // fazer nada.
  const [errosDoCartao, setErrosDoCartao] = useState({});
  // A última decisão. O cartão some na hora, e sem esse retorno não dava para
  // saber se tinha funcionado.
  const [feito, setFeito] = useState(null);
  const refFeito = useRef(null);

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    setErro('');
    try {
      setLinhas(await listarAprovacoesPendentes(user.id));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  // O botão apertado sai da tela junto com o cartão, e o foco cairia no início
  // da página. preventScroll: quem está no meio da lista continua onde estava,
  // e o aviso é grudado no alto, então aparece de qualquer jeito.
  useEffect(() => {
    if (feito) refFeito.current?.focus({ preventScroll: true });
  }, [feito]);

  const mudarErroDoCartao = (id, msg) => setErrosDoCartao((e) => ({ ...e, [id]: msg }));

  const decidir = async (chamado, aprovar) => {
    const justificativa = justificativas[chamado.id] || '';
    // Reprovar sem dizer por quê deixa o solicitante sem saber o que corrigir.
    if (!aprovar && !justificativa.trim()) {
      mudarErroDoCartao(chamado.id, 'Explique o motivo para reprovar este chamado.');
      document.getElementById(`just-${chamado.id}`)?.focus();
      return;
    }
    setDecidindo({ id: chamado.id, aprovar });
    mudarErroDoCartao(chamado.id, '');
    try {
      await decidirChamado({
        chamadoId: chamado.id, etapaId: chamado.etapaId, aprovar, justificativa,
      });
      setLinhas((atual) => atual.filter((c) => c.id !== chamado.id));
      setFeito({ id: chamado.id, numero: chamado.numero, aprovar });
    } catch (e) {
      mudarErroDoCartao(chamado.id, e.message);
    } finally {
      setDecidindo(null);
    }
  };

  return (
    <div className={`adm-page adm-page-wide${feito ? ' adm-aprov-tem-feito' : ''}`}>
      <CabecalhoPagina
        Icon={ClipboardCheck}
        titulo="Aprovações"
        subtitulo="Chamados abertos pela sua equipe que dependem da sua liberação. O prazo de atendimento só começa a contar depois da aprovação."
        acao={!carregando && linhas.length > 0 && (
          <span className="adm-aprov-cont">
            {linhas.length === 1 ? '1 pendente' : `${linhas.length} pendentes`}
          </span>
        )}
      />

      {feito && (
        <div ref={refFeito} tabIndex={-1} role="status" className="adm-aviso adm-aprov-feito">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>
            {feito.aprovar ? 'Aprovação' : 'Reprovação'} do chamado #{feito.numero} registrada.
            {' '}
            {linhas.length === 0 && !carregando && 'Não há mais pendências.'}
            {linhas.length === 1 && 'Falta 1.'}
            {linhas.length > 1 && `Faltam ${linhas.length}.`}
            {' '}
            <Link className="adm-link" to={`/administrativo/chamado/${feito.id}`}>Abrir chamado</Link>
          </span>
          {/* Fica grudado ao rolar: quem já leu precisa poder tirar da frente. */}
          <button type="button" className="adm-aprov-feito-x" aria-label="Fechar aviso"
            onClick={() => setFeito(null)}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {erro && (
        <div className="adm-aviso tom-erro" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>
            {erro}{' '}
            <button type="button" className="adm-link adm-link-btn adm-fila-tentar" onClick={carregar}>
              Tentar de novo
            </button>
          </span>
        </div>
      )}

      {carregando ? (
        <Carregando />
      ) : erro && linhas.length === 0 ? (
        // Falhou ao carregar: "nada esperando" aqui faria o aprovador ir embora
        // com pedido parado na mão dele.
        null
      ) : linhas.length === 0 ? (
        <Vazio Icon={CheckCircle2} tom="ok" titulo="Tudo em dia">
          Nenhum chamado esperando a sua aprovação.
        </Vazio>
      ) : (
        linhas.map((c) => {
          const cls = getClasse(c.classe);
          const srv = getServico(c.classe, c.servico);
          const campos = Object.entries(c.campos || {});
          const ocupado = decidindo?.id === c.id;
          const erroCartao = errosDoCartao[c.id];
          const qtdAnexos = (c.anexos || []).length;
          return (
            <article key={c.id} className="adm-card adm-aprov" aria-labelledby={`aprov-${c.id}`}>
              {/* Pedido de um lado, decisão do outro: a ação fica à vista sem rolar,
                  mesmo com descrição longa, e dá para escrever o motivo da recusa
                  lendo o pedido ao lado. */}
              <div className="adm-aprov-grade">
                <div className="adm-aprov-pedido">
                  <div className="adm-aprov-cab">
                    <div>
                      <h2 id={`aprov-${c.id}`}>#{c.numero} · {srv?.label || c.assunto}</h2>
                      <small>
                        {[
                          contextoDoChamado({
                            classeLabel: cls?.label || c.classe,
                            assunto: srv?.label || c.assunto,
                          }),
                          c.solicitanteNome || 'Solicitante',
                          `aberto em ${dataHora(c.criado_em)}`,
                        ].filter(Boolean).join(' · ')}
                      </small>
                    </div>
                  </div>

                  <p className="adm-aprov-desc">{c.descricao}</p>

                  {campos.length > 0 && (
                    // O rótulo cadastrado vive na config do serviço; aqui a própria
                    // chave já é legível (ela é derivada do rótulo).
                    <dl className="adm-aprov-campos">
                      {campos.map(([chave, valor]) => (
                        <div key={chave}>
                          <dt>{rotuloDoCampo(c.classe, c.servico, chave)}</dt>
                          <dd>{formatarValorCampo(c.classe, c.servico, chave, valor)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {/* Em nova aba: o que já foi escrito na observação não pode se
                      perder só porque a pessoa quis ver um anexo antes de decidir. */}
                  <p className="adm-aprov-rodape">
                    {qtdAnexos > 0 && (
                      <span className="adm-aprov-anexos">
                        <Paperclip size={14} aria-hidden="true" />
                        {qtdAnexos === 1 ? '1 anexo no chamado' : `${qtdAnexos} anexos no chamado`}
                      </span>
                    )}
                    <Link className="adm-link adm-aprov-abrir" to={`/administrativo/chamado/${c.id}`}
                      target="_blank" rel="noopener noreferrer">
                      Abrir chamado completo <ExternalLink size={13} aria-hidden="true" />
                      <span className="adm-visualmente-oculto"> (abre em nova aba)</span>
                    </Link>
                  </p>
                </div>

                <div className="adm-aprov-decisao">
                  <div className="adm-campo">
                    <label htmlFor={`just-${c.id}`}>Observação (obrigatória para reprovar)</label>
                    <textarea
                      id={`just-${c.id}`}
                      className={`adm-textarea adm-textarea-curto${erroCartao ? ' is-invalido' : ''}`}
                      value={justificativas[c.id] || ''}
                      disabled={ocupado}
                      aria-invalid={erroCartao ? 'true' : undefined}
                      aria-describedby={erroCartao ? `just-erro-${c.id}` : undefined}
                      onChange={(e) => {
                        const texto = e.target.value;
                        setJustificativas((j) => ({ ...j, [c.id]: texto }));
                        if (erroCartao) mudarErroDoCartao(c.id, '');
                      }}
                      placeholder="Motivo da reprovação, ou uma observação para o time do Atendimento."
                    />
                  </div>

                  {erroCartao && (
                    <p id={`just-erro-${c.id}`} className="adm-aprov-erro" role="alert">
                      <AlertCircle size={14} aria-hidden="true" /> {erroCartao}
                    </p>
                  )}

                  <div className="adm-acoes">
                    <button type="button" className="adm-btn adm-btn-primary"
                      disabled={ocupado} onClick={() => decidir(c, true)}>
                      {ocupado && decidindo.aprovar
                        ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
                        : <Check size={16} aria-hidden="true" />} Aprovar
                    </button>
                    <button type="button" className="adm-btn adm-btn-recusa"
                      disabled={ocupado} onClick={() => decidir(c, false)}>
                      {ocupado && !decidindo.aprovar
                        ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
                        : <X size={16} aria-hidden="true" />} Reprovar
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
