import { useState } from 'react';
import {
  ArrowLeftRight, ArrowRight, Copy, ExternalLink, FileText, Paperclip, Pencil, Replace, Trash2, Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SECOES_ATIVO } from '../../lib/campos';
import {
  enviarAnexo, excluirAtivo, removerAnexos, salvarAtivo, urlDoAnexo,
} from '../../lib/ti';
import { emailChave, ehEmail, linkTrocaEquipamento } from '../../lib/regras';
import CascaDrawer from './CascaDrawer';
import Confirmar from './Confirmar';
import { Pill } from './Pecas';
import { fmtDate, money, tomSituacao, tomTermo } from '../../lib/formato';
import { useTi } from './TiContext';
import '../ativos/ativos.css';

// Na ficha, o que se pergunta primeiro é "com quem está e o termo está em dia":
// Uso e Termo sobem; Identificação, Contrato e Base vêm depois. O formulário
// segue a ordem da planilha (SECOES_ATIVO).
const ORDEM_FICHA = ['Uso', 'Termo de responsabilidade', 'Identificação', 'Contrato', 'Base do fornecedor'];
const SECOES_FICHA = [...SECOES_ATIVO].sort((x, y) => {
  const ix = ORDEM_FICHA.indexOf(x.titulo);
  const iy = ORDEM_FICHA.indexOf(y.titulo);
  return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
});
const HISTORICO_CURTO = 5;

const vazio = (v) => v == null || String(v).trim() === '';

function tomStatusTermo(s) {
  if (s === 'Assinado') return 'ok';
  if (s === 'Cancelado') return 'neutral';
  return 'info';
}

export default function DetalheAtivo({ id }) {
  const navigate = useNavigate();
  const {
    dados, setDados, trocarAtivos, toast, fecharDrawer, abrirForm, podeEscrever, nomeDe,
  } = useTi();
  const a = dados.ativos.find((x) => x.id === id);
  const [confirmar, setConfirmar] = useState(false);
  const [tirando, setTirando] = useState(null); // anexo à espera de confirmação
  const [enviando, setEnviando] = useState(false);
  const [historicoTodo, setHistoricoTodo] = useState(false);

  if (!a) return null;

  const historico = dados.movimentacoes
    .filter((m) => m.ativo_id === a.id)
    .sort((x, y) => String(y.data).localeCompare(String(x.data)) || String(y.criado_em).localeCompare(String(x.criado_em)));
  const historicoVisivel = historicoTodo ? historico : historico.slice(0, HISTORICO_CURTO);
  const termos = dados.termos
    .filter((t) => (t.ativos || []).some((x) => x.id === a.id))
    .sort((x, y) => String(y.data_termo).localeCompare(String(x.data_termo)));
  const anexos = a.anexos || [];

  const excluir = async () => {
    try {
      await excluirAtivo(a.id);
      await removerAnexos(anexos.map((f) => f.path));
      setDados((d) => ({ ...d, ativos: d.ativos.filter((x) => x.id !== a.id) }));
      toast('Ativo excluído.');
      fecharDrawer();
    } catch (e) {
      toast(e.message, 'err');
      setConfirmar(false);
    }
  };

  const anexar = async (file) => {
    if (!file) return;
    setEnviando(true);
    try {
      const novo = await enviarAnexo(`ativos/${a.id}`, file);
      trocarAtivos([await salvarAtivo(a.id, { anexos: [...anexos, novo] })]);
      toast('Anexo enviado.');
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setEnviando(false);
    }
  };

  const abrirAnexo = async (path) => {
    try {
      window.open(await urlDoAnexo(path), '_blank', 'noopener');
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const tirarAnexo = async () => {
    const path = tirando?.path;
    try {
      trocarAtivos([await salvarAtivo(a.id, { anexos: anexos.filter((f) => f.path !== path) })]);
      await removerAnexos([path]);
      toast('Anexo removido.');
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setTirando(null);
    }
  };

  const copiarSerie = async () => {
    try {
      await navigator.clipboard.writeText(a.numero_serie);
      toast('Número de série copiado.');
    } catch {
      toast('Não foi possível copiar. Selecione o número e copie à mão.', 'err');
    }
  };

  // Pessoa: nome em destaque e o e-mail embaixo (clicável), em vez de e-mail · nome.
  const pessoa = (email) => {
    const nome = nomeDe(email);
    const temNome = nome && emailChave(nome) !== emailChave(email);
    return (
      <span className="ti-ativos-pessoa">
        <span>{temNome ? nome : email}</span>
        {temNome && (ehEmail(email)
          ? <a href={`mailto:${email}`} className="ti-ativos-sub">{email}</a>
          : <span className="ti-ativos-sub">{email}</span>)}
      </span>
    );
  };

  const valor = (c) => {
    const v = a[c.k];
    if (vazio(v)) return <span className="ti-ativos-vazio">Não informado</span>;
    if (c.pessoas) return pessoa(v);
    if (c.t === 'date') return fmtDate(v);
    if (c.t === 'money') return money(v);
    if (c.t === 'select' && c.k === 'situacao') return <Pill tone={tomSituacao(v)}>{v}</Pill>;
    if (c.t === 'select' && c.k === 'situacao_termo') return <Pill tone={tomTermo(v)}>{v}</Pill>;
    if (c.k === 'link_termo' && /^https?:\/\//.test(v)) {
      return (
        <a href={v} target="_blank" rel="noreferrer" className="ti-ativos-link">
          Abrir termo <ExternalLink size={12} aria-hidden="true" />
        </a>
      );
    }
    return String(v);
  };

  // Quem só consulta não precisa de uma parede de "Não informado": a ficha mostra
  // o que existe. O time de TI vê tudo, para saber o que falta preencher.
  const secoes = SECOES_FICHA
    .map((s) => ({ ...s, campos: podeEscrever ? s.campos : s.campos.filter((c) => !vazio(a[c.k])) }))
    .filter((s) => s.campos.length);

  const subtitulo = [a.tipo, a.modelo, a.fornecedor].filter(Boolean).join(' · ');

  return (
    <CascaDrawer
      onFechar={fecharDrawer}
      cabecalho={(
        <>
          <div className="ti-ativos-serie">
            <h2>{a.numero_serie}</h2>
            <button type="button" className="ti-ibtn" onClick={copiarSerie} aria-label="Copiar número de série" title="Copiar número de série">
              <Copy size={14} />
            </button>
          </div>
          {subtitulo && <p>{subtitulo}</p>}
          <div className="ti-chips ti-ativos-cab-pills">
            <Pill tone={tomSituacao(a.situacao)}>{a.situacao || 'Sem situação'}</Pill>
            {a.situacao_termo && <Pill tone={tomTermo(a.situacao_termo)}>Termo: {a.situacao_termo}</Pill>}
          </div>
        </>
      )}
      rodape={podeEscrever ? (
        <>
          <button type="button" className="ti-btn danger" onClick={() => setConfirmar(true)}><Trash2 size={15} /> Excluir</button>
          <span className="ti-sp" />
          <button type="button" className="ti-btn" onClick={() => { fecharDrawer(); navigate(`/ti/movimentar?ativo=${a.id}`); }}>
            <ArrowLeftRight size={15} /> Movimentar
          </button>
          <button type="button" className="ti-btn primary" onClick={() => abrirForm(a.id)}><Pencil size={15} /> Editar</button>
        </>
      ) : (
        <>
          <span className="ti-hint ti-ativos-rodape-dica">Para trocar este equipamento, abra um chamado no Atendimento.</span>
          <span className="ti-sp" />
          <button type="button" className="ti-btn primary" onClick={() => { fecharDrawer(); navigate(linkTrocaEquipamento(a)); }}>
            <Replace size={15} /> Pedir troca
          </button>
        </>
      )}
    >
      {secoes.map((s) => (
        <section key={s.titulo} className="ti-card" aria-label={s.titulo}>
          <div className="ti-card-h"><h3>{s.titulo}</h3></div>
          <dl className="ti-dl">
            {s.campos.map((c) => (
              <div key={c.k} className={c.full ? 'ti-ativos-dl-full' : undefined}>
                <dt>{c.l}</dt>
                <dd className={c.t === 'area' ? 'ti-ativos-texto' : undefined}>{valor(c)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {(podeEscrever || anexos.length > 0) && (
        <section className="ti-card" aria-label="Anexos">
          <div className="ti-card-h"><h3>Anexos</h3><span className="ti-count">{anexos.length}</span></div>
          <div className="ti-files">
            {anexos.map((f) => (
              <div key={f.path} className="ti-file">
                <Paperclip size={15} aria-hidden="true" />
                <span className="fn"><b title={f.nome}>{f.nome}</b><span>Enviado em {fmtDate(f.enviado_em)}</span></span>
                <button type="button" className="ti-btn" onClick={() => abrirAnexo(f.path)} aria-label={`Abrir ${f.nome}`}>Abrir</button>
                {podeEscrever && (
                  <button type="button" className="ti-ibtn" aria-label={`Remover ${f.nome}`} title="Remover anexo" onClick={() => setTirando(f)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {!anexos.length && <p className="ti-muted">Nenhum arquivo anexado. Guarde aqui a nota fiscal, o termo assinado ou fotos do equipamento.</p>}
            {podeEscrever && (
              <label className={`ti-upl ${enviando ? 'busy' : ''}`}>
                <Upload size={15} aria-hidden="true" /> {enviando ? 'Enviando…' : 'Anexar arquivo (PDF ou imagem)'}
                <input type="file" accept=".pdf,image/*" disabled={enviando} onChange={(e) => { anexar(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </section>
      )}

      <section className="ti-card" aria-label="Movimentações">
        <div className="ti-card-h"><h3>Movimentações</h3><span className="ti-count">{historico.length}</span></div>
        {historico.length ? (
          <>
            <ol className="ti-ativos-tl">
              {historicoVisivel.map((m) => {
                const trocouPessoa = emailChave(m.de_responsavel) !== emailChave(m.para_responsavel);
                const trocouSituacao = m.de_situacao !== m.para_situacao;
                return (
                  <li key={m.id}>
                    <span className="ti-ativos-tl-data">{fmtDate(m.data)}</span>
                    {trocouPessoa && (
                      <span className="ti-ativos-tl-mud">
                        {nomeDe(m.de_responsavel) || 'Ninguém'}
                        <ArrowRight size={12} aria-hidden="true" /><span className="ti-ativos-sr">para</span>
                        {nomeDe(m.para_responsavel) || 'Ninguém'}
                      </span>
                    )}
                    {trocouSituacao && (
                      <span className="ti-ativos-tl-mud">
                        {m.de_situacao || 'Sem situação'}
                        <ArrowRight size={12} aria-hidden="true" /><span className="ti-ativos-sr">para</span>
                        {m.para_situacao || 'Sem situação'}
                      </span>
                    )}
                    {!trocouPessoa && !trocouSituacao && <span className="ti-ativos-tl-mud">Registro sem mudança de responsável ou situação</span>}
                    {m.obs && <span className="ti-ativos-tl-obs">{m.obs}</span>}
                    {m.atualizado_por_nome && <span className="ti-ativos-sub">por {m.atualizado_por_nome}</span>}
                  </li>
                );
              })}
            </ol>
            {historico.length > HISTORICO_CURTO && (
              <button type="button" className="ti-link ti-ativos-mais" onClick={() => setHistoricoTodo((v) => !v)} aria-expanded={historicoTodo}>
                {historicoTodo ? 'Mostrar só as recentes' : `Ver todas as ${historico.length} movimentações`}
              </button>
            )}
          </>
        ) : <p className="ti-muted">Nenhuma movimentação registrada no portal.</p>}
      </section>

      {termos.length > 0 && (
        <section className="ti-card" aria-label="Termos gerados">
          <div className="ti-card-h"><h3>Termos gerados</h3><span className="ti-count">{termos.length}</span></div>
          <ul className="ti-ativos-termos">
            {termos.map((t) => (
              <li key={t.id}>
                <FileText size={14} aria-hidden="true" />
                <span className="ti-ativos-termos-tx">
                  <b>{t.pessoa_nome || t.pessoa_email}</b>
                  <span className="ti-ativos-sub">
                    {t.status === 'Assinado' && t.data_assinatura ? `Assinado em ${fmtDate(t.data_assinatura)}` : `Gerado em ${fmtDate(t.data_termo)}`}
                  </span>
                </span>
                <Pill tone={tomStatusTermo(t.status)}>{t.status}</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}

      {a.atualizado_em && (
        <p className="ti-hint">
          Última alteração em {new Date(a.atualizado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          {a.atualizado_por_nome ? ` por ${a.atualizado_por_nome}` : ''}.
        </p>
      )}

      {confirmar && (
        <Confirmar
          titulo="Excluir ativo?"
          texto={`O ativo ${a.numero_serie} e o histórico de movimentações dele serão apagados. Os termos já gerados continuam guardados.`}
          ok="Excluir"
          perigo
          onOk={excluir}
          onFechar={() => setConfirmar(false)}
        />
      )}
      {tirando && (
        <Confirmar
          titulo="Remover anexo?"
          texto={`O arquivo ${tirando.nome} sai da ficha e é apagado do armazenamento.`}
          ok="Remover"
          perigo
          onOk={tirarAnexo}
          onFechar={() => setTirando(null)}
        />
      )}
    </CascaDrawer>
  );
}
