import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ArrowDown, CheckCircle2, Download, FileSignature, Mail, ShieldCheck,
} from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useAuth } from '../../../../contexts/AuthContext';
import { useTi } from '../components/TiContext';
import {
  Busca, Chip, Esqueleto, LinhaVazia, PageHead, Pill, Secao,
} from '../components/Pecas';
import { fmtDate } from '../../lib/formato';
import {
  cpfValido, emUso, emailChave, formatarCnpj, formatarCpf, listaTermos, norm, pendenteTermo,
} from '../../lib/regras';
import {
  TITULO_TERMO, VERSAO_TERMO, camposIdentificacao, linhaAceite, linhasEquipamento, localEData, modeloDoVinculo, textoDoModelo, textoParaAceite,
} from '../../lib/termoTexto';
import { aceitarTermo, carregarLembretes, carregarMeuTermo } from '../../lib/ti';
import './termos.css';

async function baixarPdf(termo) {
  const { gerarTermoPdf, nomeArquivoTermo } = await import('../../lib/termoPdf');
  gerarTermoPdf(termo).save(nomeArquivoTermo(termo));
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Último termo aceito/assinado de cada pessoa (o time de TI lê todos; os demais, só o próprio). */
function ultimoTermoPorEmail(termos) {
  const m = new Map();
  for (const t of termos) {
    if (t.status !== 'Assinado') continue;
    const k = emailChave(t.pessoa_email);
    const atual = m.get(k);
    if (!atual || String(t.criado_em) > String(atual.criado_em)) m.set(k, t);
  }
  return m;
}

/** Botão "Baixar PDF" com estado de geração (o gerador é carregado sob demanda). */
function BotaoPdf({
  termo, rotulo = 'Baixar o termo em PDF', className = 'ti-btn', ariaLabel,
}) {
  const { toast } = useTi();
  const [gerando, setGerando] = useState(false);
  const baixar = async () => {
    setGerando(true);
    try {
      await baixarPdf(termo);
    } catch (e) {
      toast(`Não foi possível gerar o PDF. ${e.message}`, 'err');
    } finally {
      setGerando(false);
    }
  };
  return (
    <button type="button" className={className} onClick={baixar} disabled={gerando} aria-label={ariaLabel} aria-busy={gerando}>
      <Download size={15} aria-hidden="true" /> {gerando ? 'Gerando…' : rotulo}
    </button>
  );
}

/**
 * Termo de responsabilidade (substitui "Preparar termos" e "Pendências de termos").
 *  - Quem tem equipamento em uso lê o termo do seu vínculo (CLT, PJ ou Sócio
 *    Cotista) e aceita aqui. Enquanto não aceita, recebe um e-mail por dia
 *    (edge function notify-termo-ti). A maioria chega pelo botão do e-mail,
 *    muitas vezes pelo celular: a leitura e o aceite vêm primeiro.
 *  - O gestor vê a equipe (a RLS já recorta pela hierarquia): quem aceitou e
 *    quem está pendente.
 *  - O time de TI vê todo mundo, o último lembrete e baixa o termo aceito.
 */
export default function TermosTi() {
  const {
    dados, carregando, erro, filtros, setFiltro, podeEscrever, meuEmail,
  } = useTi();
  const f = filtros.termos;
  const set = (patch) => setFiltro('termos', patch);

  const lista = useMemo(() => listaTermos(dados.ativos, dados.pessoas), [dados.ativos, dados.pessoas]);
  const meus = useMemo(
    () => dados.ativos.filter((a) => emUso(a) && emailChave(a.responsavel) === meuEmail),
    [dados.ativos, meuEmail],
  );
  const euPendente = meus.some(pendenteTermo);
  // Equipe: o time de TI vê todos; o gestor, quando enxerga alguém além dele.
  const temEquipe = podeEscrever || lista.some((p) => p.email !== meuEmail);
  const aba = f.aba || (euPendente || !temEquipe ? 'meu' : 'equipe');
  const pendentesEquipe = lista.filter((p) => p.situacao === 'pendente').length;

  const abas = [
    { id: 'meu', rotulo: 'Meu termo', marca: euPendente ? 'pendente' : null },
    { id: 'equipe', rotulo: podeEscrever ? 'Todas as pessoas' : 'Minha equipe', marca: pendentesEquipe || null },
  ];
  const refsAba = useRef({});
  const teclaAba = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const outra = aba === 'meu' ? 'equipe' : 'meu';
    set({ aba: outra });
    refsAba.current[outra]?.focus();
  };

  return (
    <div className="ti-page ti-stack">
      <PageHead
        Icon={FileSignature}
        titulo="Termo de responsabilidade"
        sub={temEquipe
          ? 'Leia e aceite o termo dos equipamentos que estão com você, e acompanhe quem já aceitou.'
          : 'Leia e aceite o termo dos equipamentos que estão com você.'}
      />
      {erro && (
        <div className="ti-note crit" role="alert">
          <span>Não foi possível carregar os equipamentos. {erro}</span>
        </div>
      )}
      {temEquipe && (
        <div className="ti-termo-abas" role="tablist" aria-label="Visão">
          {abas.map((a) => (
            <button
              key={a.id}
              ref={(el) => { refsAba.current[a.id] = el; }}
              type="button"
              role="tab"
              id={`tt-aba-${a.id}`}
              aria-selected={aba === a.id}
              aria-controls={`tt-painel-${a.id}`}
              tabIndex={aba === a.id ? 0 : -1}
              className={`ti-termo-aba ${aba === a.id ? 'on' : ''}`}
              onClick={() => set({ aba: a.id })}
              onKeyDown={teclaAba}
            >
              {a.rotulo}
              {a.marca != null && (
                <span className="ti-termo-aba-n">
                  {a.id === 'meu' ? 'pendente' : a.marca}
                  {a.id !== 'meu' && <span className="ti-termo-sr"> pendentes</span>}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <div
        id={`tt-painel-${aba}`}
        role={temEquipe ? 'tabpanel' : undefined}
        aria-labelledby={temEquipe ? `tt-aba-${aba}` : undefined}
      >
        {carregando && <Esqueleto />}
        {!carregando && aba === 'meu' && <MeuTermo meus={meus} pendente={euPendente} />}
        {!carregando && aba === 'equipe' && (
          <Equipe lista={lista} euPendente={euPendente} irParaMeu={() => set({ aba: 'meu' })} />
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- meu termo
function MeuTermo({ meus, pendente }) {
  const { dados, meuEmail } = useTi();
  const meuUltimo = ultimoTermoPorEmail(dados.termos).get(meuEmail) || null;
  // Logo depois do aceite a tela troca para a confirmação; quem estava no fim
  // do documento volta ao topo e o leitor de tela anuncia o título.
  const [recemAceito, setRecemAceito] = useState(false);

  if (!meus.length) {
    return (
      <div className="ti-card">
        <div className="ti-empty">
          <strong>Nenhum equipamento em uso com você</strong>
          Quando a TI entregar um equipamento, o termo aparece aqui para você aceitar.
          Se você já recebeu um e ele não aparece, fale com o time de TI.
        </div>
      </div>
    );
  }
  if (!pendente) return <TermoAceito meus={meus} termo={meuUltimo} recemAceito={recemAceito} />;
  return <AceitarTermo meus={meus} onAceito={() => setRecemAceito(true)} />;
}

function TermoAceito({ meus, termo, recemAceito }) {
  const tituloRef = useRef(null);
  useEffect(() => {
    if (!recemAceito) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    tituloRef.current?.focus({ preventScroll: true });
  }, [recemAceito]);

  const quando = termo?.data_assinatura ? ` em ${fmtDate(termo.data_assinatura)}` : '';
  return (
    <div className="ti-stack ti-termo-coluna">
      <section className="ti-card ti-termo-ok" aria-labelledby="tt-ok-t">
        <span className="ti-termo-ok-ic" aria-hidden="true"><CheckCircle2 size={28} /></span>
        <div className="ti-termo-ok-tx">
          <h2 id="tt-ok-t" ref={tituloRef} tabIndex={-1}>
            {recemAceito ? 'Pronto, termo aceito' : 'Termo aceito'}
          </h2>
          <p>
            Você aceitou o termo {meus.length === 1 ? 'do equipamento que está' : `dos ${meus.length} equipamentos que estão`} com você{quando}.
            Não precisa fazer mais nada e os lembretes por e-mail param.
          </p>
          {termo && linhaAceite(termo) && <p className="ti-hint">{linhaAceite(termo)}</p>}
          {termo && (
            <div className="ti-ph-a ti-termo-ok-a">
              <BotaoPdf termo={termo} className="ti-btn primary" />
            </div>
          )}
        </div>
      </section>
      <Secao titulo="Equipamentos com você" contagem={meus.length}>
        <ListaEquipamentos ativos={meus} />
        <p className="ti-hint ti-mt">Se receber outro equipamento, o termo dele aparece aqui para você aceitar.</p>
      </Secao>
    </div>
  );
}

function ListaEquipamentos({ ativos }) {
  return (
    <ul className="ti-equip ti-termo-lst">
      {ativos.map((a) => (
        <li key={a.id} className="ti-equip-i">
          <div className="tx">
            <b>{[a.tipo, a.modelo].filter(Boolean).join(' · ') || a.numero_serie}</b>
            <span>Série {a.numero_serie}{a.configuracao ? ` · ${a.configuracao}` : ''}</span>
          </div>
          {a.situacao_termo === 'Assinado' ? <Pill tone="ok">Aceito</Pill> : <Pill tone="warn">Aguardando aceite</Pill>}
        </li>
      ))}
    </ul>
  );
}

// Rótulos do quadro de identificação que a pessoa preenche (os demais vêm do cadastro).
const PREENCHIDOS = ['CPF', 'Razão social', 'CNPJ', 'Representante legal', 'CPF do representante', 'Área de atuação'];

/** Erros por campo, na ordem da tela. Mesmas regras de antes; nada é enviado com erro. */
function errosDoAceite(form, modelo, li) {
  const e = {};
  if (modelo === 'PJ') {
    if (!form.razao_social.trim()) e.razao_social = 'Informe a razão social.';
    if (form.cnpj.replace(/\D/g, '').length !== 14) e.cnpj = 'Informe o CNPJ completo (14 números).';
    if (!form.representante.trim()) e.representante = 'Informe o representante legal.';
    if (!cpfValido(form.cpf_representante)) {
      e.cpf_representante = form.cpf_representante ? 'CPF do representante inválido. Confira os números.' : 'Informe o CPF do representante.';
    }
  }
  if (!cpfValido(form.cpf)) e.cpf = form.cpf ? 'CPF inválido. Confira os números.' : 'Informe o seu CPF.';
  if (!li) e.li = 'Marque que leu e concorda com o termo.';
  return e;
}

const ID_CAMPO = {
  razao_social: 'tt-rs', cnpj: 'tt-cnpj', representante: 'tt-rep', cpf_representante: 'tt-cpfr', cpf: 'tt-cpf', li: 'tt-li',
};
const NOME_CAMPO = {
  razao_social: 'razão social', cnpj: 'CNPJ', representante: 'representante legal', cpf_representante: 'CPF do representante', cpf: 'CPF', li: 'confirmação de leitura',
};

function AceitarTermo({ meus, onAceito }) {
  const { recarregar, toast } = useTi();
  const { verComo } = useAuth();
  const [info, setInfo] = useState(null);
  const [erroInfo, setErroInfo] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [form, setForm] = useState({});
  const [li, setLi] = useState(false);
  const [tocados, setTocados] = useState({});
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const aceiteRef = useRef(null);

  useEffect(() => {
    let vivo = true;
    carregarMeuTermo()
      .then((d) => {
        if (!vivo) return;
        setErroInfo('');
        setInfo(d || {});
        setForm({
          cpf: formatarCpf(d?.cpf || ''),
          razao_social: d?.razao_social || '',
          cnpj: formatarCnpj(d?.cnpj || ''),
          representante: d?.representante || d?.nome || '',
          cpf_representante: formatarCpf(d?.cpf_representante || d?.cpf || ''),
          area_atuacao: d?.area_atuacao || d?.funcao || '',
        });
      })
      .catch((e) => { if (vivo) setErroInfo(e.message); });
    return () => { vivo = false; };
  }, [tentativa]);

  if (erroInfo) {
    return (
      <div className="ti-note crit ti-termo-erro" role="alert">
        <span>{erroInfo}</span>
        <button type="button" className="ti-btn" onClick={() => { setErroInfo(''); setTentativa((n) => n + 1); }}>Tentar de novo</button>
      </div>
    );
  }
  if (!info) return <Esqueleto linhas={8} />;

  const modelo = info.modelo || modeloDoVinculo(info.vinculo);
  const txt = textoDoModelo(modelo);
  const pendentes = meus.filter(pendenteTermo).length;
  const campo = (k) => (e) => {
    const v = e.target.value;
    const mascara = { cpf: formatarCpf, cpf_representante: formatarCpf, cnpj: formatarCnpj }[k];
    setForm((x) => ({ ...x, [k]: mascara ? mascara(v) : v }));
  };
  const tocar = (k) => () => setTocados((t) => ({ ...t, [k]: true }));
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const previa = {
    pessoa_nome: info.nome, pessoa_email: info.email, cpf: form.cpf, data_admissao: info.data_admissao, data_termo: hoje,
    identificacao: form,
  };
  const quadro = camposIdentificacao(modelo, previa);
  const doCadastro = quadro.filter(([r]) => !PREENCHIDOS.includes(r));

  const erros = errosDoAceite(form, modelo, li);
  const chavesErro = Object.keys(erros);
  const erroDe = (k) => ((tentou || tocados[k]) ? erros[k] : '');

  const irParaAceite = () => {
    aceiteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    aceiteRef.current?.focus({ preventScroll: true });
  };

  const aceitar = async () => {
    if (verComo || enviando) return;
    if (chavesErro.length) {
      setTentou(true);
      document.getElementById(ID_CAMPO[chavesErro[0]])?.focus();
      return;
    }
    setEnviando(true);
    try {
      const identificacao = modelo === 'PJ'
        ? {
          razao_social: form.razao_social, cnpj: form.cnpj, representante: form.representante, cpf_representante: form.cpf_representante,
        }
        : modelo === 'Sócio Cotista' ? { area_atuacao: form.area_atuacao } : {};
      await aceitarTermo({
        cpf: form.cpf, identificacao, versao: `${modelo} ${VERSAO_TERMO}`, texto: textoParaAceite(modelo),
      });
      onAceito();
      await recarregar();
      toast('Termo aceito. Obrigado!');
    } catch (e) {
      toast(`Não foi possível registrar o aceite. ${e.message}`, 'err');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="ti-stack ti-termo-coluna">
      {/* 1. O que é e o que fazer */}
      <section className="ti-card ti-termo-intro" aria-labelledby="tt-intro-t">
        <h2 id="tt-intro-t" className="ti-termo-intro-t">Seu termo está esperando o aceite</h2>
        <p className="ti-termo-intro-p">
          {meus.length === 1
            ? 'Você está com 1 equipamento da empresa. '
            : `Você está com ${meus.length} equipamentos da empresa${pendentes < meus.length ? `, ${pendentes} ainda sem aceite` : ''}. `}
          O termo explica como usar, guardar e devolver. O aceite vale como a sua assinatura e cobre {meus.length === 1 ? 'o equipamento' : 'todos eles'}.
        </p>
        <ListaEquipamentos ativos={meus} />
        <ol className="ti-termo-passos">
          <li><b>Leia o termo</b><span>Modelo {modelo}, o do seu vínculo.</span></li>
          <li><b>Confirme seus dados</b><span>{modelo === 'PJ' ? 'CPF e dados da empresa contratada.' : 'Só o seu CPF.'}</span></li>
          <li><b>Aceite</b><span>No fim desta página.</span></li>
        </ol>
        <div className="ti-termo-intro-pe">
          <p className="ti-hint ti-termo-ic">
            <Mail size={14} aria-hidden="true" /> Até aceitar, você recebe um lembrete por e-mail por dia.
          </p>
          <button type="button" className="ti-btn" onClick={irParaAceite}>
            Já li, ir para o aceite <ArrowDown size={15} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 2. O documento, como vai sair no PDF */}
      <article className="ti-card ti-termo-doc" aria-labelledby="tt-doc-t">
        <header className="ti-termo-doc-h">
          <p className="ti-termo-kicker">Modelo {modelo}{info.vinculo && info.vinculo !== modelo ? ` (vínculo ${info.vinculo})` : ''} · versão {VERSAO_TERMO}</p>
          <h2 id="tt-doc-t" className="ti-termo-titulo">{TITULO_TERMO}</h2>
        </header>

        <h3>{txt.identificacao}</h3>
        <dl className="ti-termo-quadro">
          {quadro.map(([r, v]) => (
            <div key={r}>
              <dt>{r}</dt>
              <dd>{v || (PREENCHIDOS.includes(r) ? <span className="ti-termo-vazio">a preencher no fim da página</span> : '—')}</dd>
            </div>
          ))}
        </dl>

        <p className="ti-termo-par">{txt.abertura}</p>
        {txt.clausulas.map((c) => (
          <section key={c.titulo}>
            <h3>{c.titulo}</h3>
            <ul className="ti-termo-itens">{c.itens.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
        ))}

        <h3>DESCRIÇÃO DO EQUIPAMENTO</h3>
        <div className="ti-termo-equips">
          {meus.map((a) => (
            <dl key={a.id} className="ti-termo-equip">
              {linhasEquipamento(a).map(([r, v]) => (
                <div key={r}><dt>{r}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          ))}
        </div>

        <p className="ti-termo-par">{txt.declaracao}</p>
        <p className="ti-termo-par ti-termo-local">{localEData(meus.find((a) => a.cidade)?.cidade, hoje)}</p>
      </article>

      {/* 3. Dados e aceite */}
      <section
        ref={aceiteRef}
        tabIndex={-1}
        className="ti-card ti-termo-aceite"
        aria-labelledby="tt-aceite-t"
      >
        <h2 id="tt-aceite-t" className="ti-termo-sec-t">Confirme seus dados e aceite</h2>
        <p className="ti-termo-why">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>
            {modelo === 'PJ'
              ? 'O comodato é feito com a empresa contratada, por isso o termo leva os dados dela e do representante legal, além do seu CPF.'
              : 'O CPF identifica você no termo, que tem valor de assinatura.'}
            {' '}Esses dados ficam só no seu termo: o time de TI tem acesso, o seu gestor não.
          </span>
        </p>

        {doCadastro.length > 0 && (
          <dl className="ti-termo-cad" aria-label="Dados que vêm do seu cadastro">
            {doCadastro.map(([r, v]) => (
              <div key={r}><dt>{r}</dt><dd>{v || '—'}</dd></div>
            ))}
          </dl>
        )}

        <fieldset className="ti-termo-form" disabled={enviando}>
          <legend className="ti-termo-legenda">Preencha</legend>
          <div className="ti-fgrid">
            {modelo === 'PJ' && (
              <>
                <Campo id={ID_CAMPO.razao_social} label="Razão social" valor={form.razao_social} onChange={campo('razao_social')} onBlur={tocar('razao_social')} erro={erroDe('razao_social')} autoComplete="organization" />
                <Campo id={ID_CAMPO.cnpj} label="CNPJ" valor={form.cnpj} onChange={campo('cnpj')} onBlur={tocar('cnpj')} erro={erroDe('cnpj')} numerico placeholder="00.000.000/0000-00" />
                <Campo id={ID_CAMPO.representante} label="Representante legal" valor={form.representante} onChange={campo('representante')} onBlur={tocar('representante')} erro={erroDe('representante')} autoComplete="name" />
                <Campo id={ID_CAMPO.cpf_representante} label="CPF do representante" valor={form.cpf_representante} onChange={campo('cpf_representante')} onBlur={tocar('cpf_representante')} erro={erroDe('cpf_representante')} numerico placeholder="000.000.000-00" />
              </>
            )}
            {modelo === 'Sócio Cotista' && (
              <Campo id="tt-area" label="Área de atuação" valor={form.area_atuacao} onChange={campo('area_atuacao')} />
            )}
            <Campo
              id={ID_CAMPO.cpf}
              label="Seu CPF"
              valor={form.cpf}
              onChange={campo('cpf')}
              onBlur={tocar('cpf')}
              erro={erroDe('cpf')}
              numerico
              placeholder="000.000.000-00"
              ajuda={modelo === 'PJ' ? 'O CPF de quem fica com os equipamentos.' : undefined}
            />
          </div>

          <label className={`ti-termo-concordo ${li ? 'on' : ''} ${erroDe('li') ? 'err' : ''}`} htmlFor={ID_CAMPO.li}>
            <input
              id={ID_CAMPO.li}
              type="checkbox"
              checked={li}
              onChange={(e) => setLi(e.target.checked)}
              aria-invalid={!!erroDe('li')}
              aria-describedby={erroDe('li') ? 'tt-li-err' : undefined}
            />
            <span>Li o termo e concordo com as condições. O aceite vale como a minha assinatura.</span>
          </label>
          {erroDe('li') && <p id="tt-li-err" className="ti-termo-err">{erroDe('li')}</p>}
        </fieldset>

        {verComo && (
          <div className="ti-note warn">
            <span>Você está no &quot;ver como&quot;: dá para ler o termo da outra pessoa, mas só ela pode aceitar.</span>
          </div>
        )}
        {tentou && chavesErro.length > 0 && (
          <div className="ti-note warn" role="alert">
            <span>Falta {chavesErro.map((k) => NOME_CAMPO[k]).join(', ')}.</span>
          </div>
        )}

        <div className="ti-termo-aceite-a">
          <button
            type="button"
            className="ti-btn primary ti-termo-btn-aceitar"
            disabled={!!verComo || enviando}
            aria-busy={enviando}
            onClick={aceitar}
          >
            <CheckCircle2 size={16} aria-hidden="true" /> {enviando ? 'Registrando o aceite…' : 'Aceitar termo'}
          </button>
          <p className="ti-hint">
            O portal registra a data, a hora e o IP do aceite e guarda uma cópia do termo com {meus.length === 1 ? 'o equipamento listado' : `os ${meus.length} equipamentos listados`}.
            Depois você baixa o PDF por aqui.
          </p>
        </div>
      </section>
    </div>
  );
}

function Campo({
  id, label, valor, onChange, onBlur, erro, ajuda, numerico = false, placeholder, autoComplete = 'off',
}) {
  const desc = [erro ? `${id}-err` : null, ajuda ? `${id}-aj` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="ti-fld">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`ti-inp ${erro ? 'ti-termo-inp-err' : ''}`}
        value={valor}
        onChange={onChange}
        onBlur={onBlur}
        inputMode={numerico ? 'numeric' : undefined}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!erro}
        aria-describedby={desc}
      />
      {ajuda && !erro && <span id={`${id}-aj`} className="ti-hint">{ajuda}</span>}
      {erro && <span id={`${id}-err`} className="ti-termo-err">{erro}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ equipe
const FILTROS_STATUS = [['', 'Todos'], ['pendente', 'Pendentes'], ['aceito', 'Aceitaram']];

function Equipe({ lista, euPendente, irParaMeu }) {
  const {
    dados, filtros, setFiltro, podeEscrever, abrirAtivo,
  } = useTi();
  const f = filtros.termos;
  const set = (patch) => setFiltro('termos', patch);
  const [lembretes, setLembretes] = useState(() => new Map());
  useEffect(() => {
    if (!podeEscrever) return undefined;
    let vivo = true;
    carregarLembretes().then((m) => { if (vivo) setLembretes(m); });
    return () => { vivo = false; };
  }, [podeEscrever]);
  const termos = useMemo(() => ultimoTermoPorEmail(dados.termos), [dados.termos]);

  const pendentes = lista.filter((p) => p.situacao === 'pendente');
  const contagem = {
    '': lista.length,
    pendente: pendentes.length,
    aceito: lista.filter((p) => p.situacao === 'aceito').length,
  };
  const pct = lista.length ? Math.round((contagem.aceito / lista.length) * 100) : 0;
  const rows = lista.filter((p) => (!f.status || p.situacao === f.status)
    && (!f.q || norm(`${p.nome} ${p.email} ${p.ativos.map((a) => a.numero_serie).join(' ')}`).includes(norm(f.q))));
  const colunas = podeEscrever ? 6 : 4;

  if (!lista.length) {
    return (
      <div className="ti-card">
        <div className="ti-empty">
          <strong>Ninguém com equipamento por aqui</strong>
          {podeEscrever ? 'Nenhum equipamento está em uso com alguém agora.' : 'Ninguém da sua equipe está com equipamento da empresa agora.'}
        </div>
      </div>
    );
  }

  return (
    <div className="ti-stack">
      {euPendente && (
        <div className="ti-note warn ti-termo-eu">
          <span>Você ainda não aceitou o seu termo.</span>
          <button type="button" className="ti-btn" onClick={irParaMeu}>Ler e aceitar</button>
        </div>
      )}

      <section className="ti-card ti-termo-resumo" aria-labelledby="tt-resumo-t">
        <div className="ti-termo-resumo-tx">
          <h2 id="tt-resumo-t" className="ti-termo-resumo-n">
            <b>{contagem.aceito}</b> de {plural(lista.length, 'pessoa aceitou', 'pessoas aceitaram')}
          </h2>
          <div
            className="ti-termo-barra"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Pessoas que aceitaram o termo"
          >
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="ti-hint">
            {contagem.pendente
              ? `${plural(contagem.pendente, 'pessoa pendente', 'pessoas pendentes')}. Cada uma recebe um lembrete por e-mail por dia até aceitar.`
              : 'Todo mundo com equipamento já aceitou o termo.'}
          </p>
        </div>
      </section>

      <div className="ti-card ti-termo-filtros">
        <div className="ti-filters">
          <Busca id="tt-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Nome, e-mail ou número de série" />
        </div>
        <div className="ti-chips" role="group" aria-label="Situação">
          {FILTROS_STATUS.map(([v, l]) => (
            <Chip key={v || 'todos'} ativo={f.status === v} onClick={() => set({ status: v })} contagem={contagem[v]}>{l}</Chip>
          ))}
        </div>
      </div>

      <p className="ti-hint" aria-live="polite">
        {rows.length === lista.length ? `Mostrando todas as ${lista.length} pessoas, pendentes primeiro.` : `Mostrando ${rows.length} de ${lista.length} pessoas.`}
      </p>

      <TableScroll className="ti-tbl ti-termo-tbl">
        <table className="ti-t ti-termo-lista">
          <thead>
            <tr>
              <th scope="col">Pessoa</th>
              <th scope="col">Situação</th>
              <th scope="col">Equipamentos</th>
              <th scope="col">Modelo</th>
              {podeEscrever && <th scope="col">Último lembrete</th>}
              {podeEscrever && <th scope="col"><span className="ti-termo-sr">Ações</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((p) => {
              const termo = termos.get(p.email);
              const lemb = lembretes.get(p.email);
              const pendente = p.situacao === 'pendente';
              return (
                <tr key={p.email} className={pendente ? 'pend' : ''}>
                  <td className="ti-termo-pessoa">
                    <div className="p">{p.nome}</div>
                    <div className="s">{p.email}{!p.cadastrado ? ' · fora do cadastro' : ''}</div>
                  </td>
                  <td data-label="Situação">
                    {pendente
                      ? (
                        <Pill tone="warn">
                          Pendente{p.ativos.length > 1 ? ` · ${p.pendentes} de ${p.ativos.length}` : ''}
                        </Pill>
                      )
                      : <Pill tone="ok">Aceito{p.aceitoEm ? ` em ${fmtDate(p.aceitoEm)}` : ''}</Pill>}
                  </td>
                  <td className="wrap" data-label="Equipamentos">
                    <span className="ti-termo-series">
                      {p.ativos.map((a) => {
                        const nome = [a.tipo, a.modelo].filter(Boolean).join(' · ');
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className="ti-termo-serie"
                            onClick={() => abrirAtivo(a.id)}
                            title={nome}
                            aria-label={`Abrir ${nome || 'equipamento'}, série ${a.numero_serie}`}
                          >
                            {a.numero_serie}
                          </button>
                        );
                      })}
                    </span>
                  </td>
                  <td data-label="Modelo">{modeloDoVinculo(p.vinculo)}</td>
                  {podeEscrever && (
                    <td data-label="Último lembrete">
                      {lemb
                        ? (
                          <span className="s ti-termo-ic">
                            <Mail size={12} aria-hidden="true" /> {fmtDate(lemb.ultimo)} · {plural(lemb.quantidade, 'e-mail', 'e-mails')}
                          </span>
                        )
                        : <span className="s">{pendente ? 'Nenhum ainda' : '—'}</span>}
                    </td>
                  )}
                  {podeEscrever && (
                    <td className="ti-termo-acoes">
                      {termo && (
                        <span title={linhaAceite(termo) || `Termo assinado em ${fmtDate(termo.data_assinatura)}`}>
                          <BotaoPdf termo={termo} rotulo="PDF" className="ti-btn ti-termo-btn-pdf" ariaLabel={`Baixar o termo de ${p.nome} em PDF`} />
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            }) : <LinhaVazia colunas={colunas} titulo="Ninguém neste filtro" sub="Tente outro nome ou limpe o filtro de situação." />}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
