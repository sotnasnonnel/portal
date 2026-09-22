import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Pencil, Save, X, CalendarX, FileText, Ban, HeartPulse, Stethoscope, Smile,
  FolderArchive,
} from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Abas, Aviso, Badge, Campo, Carregando, Moeda, Vazio } from '../components/ui';
import CurrencyInput from '../../../../components/CurrencyInput';
import { numeroParaMascara, parseCurrency } from '../../../../utils/currencyMask';
import {
  competenciaRotulo, cnpjValido, cpfValido, dataBr, dataHoraBr, digitos, fmtBRL, fmtNum, idade, maiusculo,
  mascararCnpj, mascararCpf, round2,
} from '../../lib/formato';
import {
  salvarPrestador, historicoValores, envelopesDoPrestador, listarEncerramentos, nomesColaboradores, incluirNoMes, auditar,
} from '../../lib/dados';
import { EMPRESAS, ROTA_FOLHA, ROTA_PRESTADORES } from './comum';
import RateioEditor from './RateioEditor';
import Encerramento, { CancelarEncerramento } from './Encerramento';
import Distrato from './Distrato';
import ImportarOrganograma from './ImportarOrganograma';
import ImportarDocumentos from './ImportarDocumentos';
import ConferenciaBradesco from './ConferenciaBradesco';
import TableScroll from '../../../../components/UI/TableScroll';
import './prestadores.css';

const CAMPOS = ['nome', 'situacao', 'sexo', 'email', 'email_pessoal', 'telefone', 'empresa', 'razao_social', 'cnpj', 'cpf', 'rg',
  'data_nascimento', 'cep', 'tipo_logradouro', 'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf', 'pais',
  'modalidade', 'data_inicio', 'data_fim', 'funcao', 'projeto', 'gestor', 'secao_codigo', 'secao_nome', 'municipio_atuacao',
  'uf_atuacao', 'valor_mensal', 'banco', 'banco_codigo', 'agencia', 'conta', 'pix', 'contabilidade'];

const ROTULOS = {
  nome: 'Nome', situacao: 'Situação', sexo: 'Sexo', email: 'E-mail corporativo', email_pessoal: 'E-mail pessoal', telefone: 'Telefone',
  empresa: 'Empresa', razao_social: 'Razão social', cnpj: 'CNPJ', cpf: 'CPF', rg: 'RG', data_nascimento: 'Nascimento', cep: 'CEP',
  tipo_logradouro: 'Tipo de logradouro', logradouro: 'Logradouro', numero: 'Número', complemento: 'Complemento', bairro: 'Bairro',
  municipio: 'Município', uf: 'UF', pais: 'País', modalidade: 'Modalidade', data_inicio: 'Início', data_fim: 'Término',
  funcao: 'Função', projeto: 'Projeto', gestor: 'Gestor', secao_codigo: 'Código da seção', secao_nome: 'Seção',
  municipio_atuacao: 'Município de atuação', uf_atuacao: 'UF de atuação', valor_mensal: 'Valor mensal', banco: 'Banco',
  banco_codigo: 'Código do banco', agencia: 'Agência', conta: 'Conta', pix: 'PIX', contabilidade: 'Contabilidade',
};

// Em que aba cada campo mora (para levar o usuário ao erro).
const ABA_DO_CAMPO = {
  identificacao: ['nome', 'situacao', 'sexo', 'email', 'email_pessoal', 'telefone', 'empresa'],
  documentacao: ['razao_social', 'cnpj', 'cpf', 'rg', 'data_nascimento'],
  endereco: ['cep', 'tipo_logradouro', 'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf', 'pais'],
  contrato: ['modalidade', 'data_inicio', 'data_fim', 'funcao', 'projeto', 'gestor', 'secao_codigo', 'secao_nome', 'municipio_atuacao', 'uf_atuacao', 'valor_mensal'],
  pagamento: ['banco', 'banco_codigo', 'agencia', 'conta', 'pix', 'contabilidade'],
};
const abaDoCampo = (campo) => Object.keys(ABA_DO_CAMPO).find((a) => ABA_DO_CAMPO[a].includes(campo));

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function paraForm(p, config) {
  if (!p) {
    const vazio = Object.fromEntries(CAMPOS.map((k) => [k, '']));
    return { ...vazio, situacao: 'ativo', empresa: config?.empresa_padrao || 'PHD ASSESSORIA', modalidade: 'CNPJ', pais: 'Brasil' };
  }
  const form = Object.fromEntries(CAMPOS.map((k) => [k, p[k] ?? '']));
  form.valor_mensal = numeroParaMascara(p.valor_mensal);
  return form;
}

function deForm(f) {
  const t = (v) => String(v ?? '').trim();
  const linha = Object.fromEntries(CAMPOS.map((k) => [k, t(f[k])]));
  linha.nome = maiusculo(f.nome);
  linha.razao_social = maiusculo(f.razao_social);
  linha.cpf = digitos(f.cpf).length === 11 ? mascararCpf(f.cpf) : t(f.cpf);
  linha.cnpj = digitos(f.cnpj).length === 14 ? mascararCnpj(f.cnpj) : t(f.cnpj);
  linha.email = t(f.email).toLowerCase();
  linha.email_pessoal = t(f.email_pessoal).toLowerCase();
  linha.uf = t(f.uf).toUpperCase();
  linha.uf_atuacao = t(f.uf_atuacao).toUpperCase();
  linha.valor_mensal = round2(parseCurrency(f.valor_mensal) ?? 0);
  linha.modalidade = t(f.modalidade) || 'CNPJ';
  return linha;
}

function validar(f, { prestadores, id }) {
  const erros = {};
  if (!String(f.nome).trim()) erros.nome = 'Informe o nome.';
  if (String(f.cpf).trim() && !cpfValido(f.cpf)) erros.cpf = 'CPF inválido (confira os dígitos).';
  if (String(f.cnpj).trim() && !cnpjValido(f.cnpj)) erros.cnpj = 'CNPJ inválido (confira os dígitos).';
  if (String(f.email).trim() && !EMAIL_REGEX.test(String(f.email).trim())) erros.email = 'E-mail inválido.';
  if (String(f.email_pessoal).trim() && !EMAIL_REGEX.test(String(f.email_pessoal).trim())) erros.email_pessoal = 'E-mail inválido.';
  if (f.data_inicio && f.data_fim && f.data_fim < f.data_inicio) erros.data_fim = 'O término não pode ser antes do início.';
  if (String(f.valor_mensal).trim() && parseCurrency(f.valor_mensal) === null) erros.valor_mensal = 'Valor inválido.';
  // CPF/CNPJ repetido quebra o casamento das planilhas: não deixa gravar.
  const outros = prestadores.filter((p) => p.id !== id);
  const cpf = digitos(f.cpf);
  const cnpj = digitos(f.cnpj);
  const cpfDe = cpf.length === 11 && outros.find((p) => digitos(p.cpf) === cpf);
  const cnpjDe = cnpj.length === 14 && outros.find((p) => digitos(p.cnpj) === cnpj);
  if (!erros.cpf && cpfDe) erros.cpf = `CPF já cadastrado em ${cpfDe.nome}.`;
  if (!erros.cnpj && cnpjDe) erros.cnpj = `CNPJ já cadastrado em ${cnpjDe.nome}.`;
  return erros;
}

export default function Detalhe() {
  const { id } = useParams();
  // key = id: trocar de prestador zera rascunho, abas e dados carregados.
  return <DetalheConteudo key={id} id={id} />;
}

function DetalheConteudo({ id }) {
  const novo = id === 'novo';
  const ctx = useFechamentoPj();
  const {
    carregando, prestadores = [], competencias = [], encerramentos = [], config, recarregar, notificar,
  } = ctx;
  const navigate = useNavigate();
  const location = useLocation();
  const prestador = novo ? null : prestadores.find((p) => p.id === id) || null;

  const [aba, setAba] = useState('identificacao');
  const [rascunho, setRascunho] = useState(() => (novo ? paraForm(null, config) : null));
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [avisoRecalculo, setAvisoRecalculo] = useState(false);
  const [modal, setModal] = useState(null);
  const [incluindo, setIncluindo] = useState(false);
  const [versao, setVersao] = useState(0);
  const [extras, setExtras] = useState({ carregando: !novo, erro: '', historico: [], envelopes: [], encerramentos: [], nomes: new Map() });

  const editando = rascunho !== null;
  const form = editando ? rascunho : paraForm(prestador, config);

  useEffect(() => {
    if (novo) return undefined;
    let vivo = true;
    (async () => {
      try {
        const [historico, envelopes, lista] = await Promise.all([
          historicoValores(id), envelopesDoPrestador(id), listarEncerramentos({ prestadorId: id }),
        ]);
        const nomes = await nomesColaboradores([...historico.map((h) => h.registrado_por), ...lista.map((e) => e.registrado_por)]);
        if (vivo) setExtras({ carregando: false, erro: '', historico, envelopes, encerramentos: lista, nomes });
      } catch (e) {
        if (vivo) setExtras((x) => ({ ...x, carregando: false, erro: e.message }));
      }
    })();
    return () => { vivo = false; };
  }, [id, novo, versao]);
  const recarregarExtras = () => setVersao((v) => v + 1);

  // Navegação anterior/próximo: a ordem da grade de onde o usuário veio, senão o cadastro todo.
  const ordem = useMemo(() => {
    const ids = location.state?.ids;
    return Array.isArray(ids) && ids.length ? ids : prestadores.map((p) => p.id);
  }, [location.state, prestadores]);
  const posicao = ordem.indexOf(id);
  const irPara = (i) => navigate(`${ROTA_PRESTADORES}/${ordem[i]}`, { state: location.state });

  const competenciaAberta = competencias.find((c) => c.status === 'aberta') || null;
  const envelopeAberto = competenciaAberta ? extras.envelopes.find((e) => e.competencia === competenciaAberta.competencia) : null;
  const vigente = prestador ? encerramentos.find((e) => e.prestador_id === prestador.id) : null;

  const errosPorAba = useMemo(() => {
    const contagem = {};
    Object.keys(erros).forEach((c) => { const a = abaDoCampo(c); contagem[a] = (contagem[a] || 0) + 1; });
    return contagem;
  }, [erros]);

  if (carregando) return <Carregando texto="Carregando prestador…" />;
  if (!novo && !prestador) {
    return (
      <Vazio>
        Prestador não encontrado. <Link to={ROTA_PRESTADORES}>Voltar para a lista</Link>
      </Vazio>
    );
  }

  const set = (campo, valor) => {
    setRascunho((r) => ({ ...r, [campo]: valor }));
    if (erros[campo]) setErros((e) => { const n = { ...e }; delete n[campo]; return n; });
  };

  function iniciarEdicao() {
    setRascunho(paraForm(prestador, config));
    setErros({});
    setAvisoRecalculo(false);
  }

  function cancelar() {
    if (novo) { navigate(ROTA_PRESTADORES); return; }
    setRascunho(null);
    setErros({});
  }

  async function salvar() {
    const encontrados = validar(rascunho, { prestadores, id: prestador?.id });
    setErros(encontrados);
    const campos = Object.keys(encontrados);
    if (campos.length) {
      setAba(abaDoCampo(campos[0]));
      notificar('Corrija os campos destacados antes de salvar.', 'erro');
      return;
    }
    setSalvando(true);
    try {
      const linha = deForm(rascunho);
      if (novo) {
        const criado = await salvarPrestador({ ...linha, cadastro_origem: 'manual' });
        await auditar('Prestador cadastrado', `${criado.codigo} - ${criado.nome}`, { prestadorId: criado.id });
        await recarregar();
        notificar(`Prestador ${criado.codigo} cadastrado.`);
        navigate(`${ROTA_PRESTADORES}/${criado.id}`, { replace: true });
        return;
      }
      const antes = deForm(paraForm(prestador, config));
      const mudou = CAMPOS.filter((k) => String(antes[k] ?? '') !== String(linha[k] ?? ''));
      if (!mudou.length) {
        setRascunho(null);
        notificar('Nada mudou no cadastro.', 'info');
        return;
      }
      await salvarPrestador({ ...Object.fromEntries(mudou.map((k) => [k, linha[k]])), id: prestador.id });
      const detalhe = mudou.map((k) => (k === 'valor_mensal'
        ? `${ROTULOS[k]}: ${fmtBRL(antes[k])} → ${fmtBRL(linha[k])}`
        : `${ROTULOS[k]}: ${antes[k] || '—'} → ${linha[k] || '—'}`)).join('; ');
      await auditar('Cadastro do prestador atualizado', `${prestador.nome} • ${detalhe}`, { prestadorId: prestador.id });
      await recarregar();
      setRascunho(null);
      recarregarExtras();
      // Valor e datas mudam o envelope, mas o recálculo é decisão de quem fecha a folha.
      const afetaEnvelope = mudou.some((k) => ['valor_mensal', 'data_inicio', 'data_fim'].includes(k));
      if (afetaEnvelope && envelopeAberto) {
        setAvisoRecalculo(true);
        notificar('Cadastro salvo. O envelope do mês aberto precisa ser recalculado.', 'alerta');
      } else {
        notificar('Cadastro salvo.');
      }
    } catch (e) {
      notificar(e.message || 'Não foi possível salvar o prestador.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function incluirNaCompetencia() {
    setIncluindo(true);
    try {
      await incluirNoMes(competenciaAberta.competencia, prestador.id);
      await auditar('Prestador incluído na competência', prestador.nome, { competencia: competenciaAberta.competencia, prestadorId: prestador.id });
      notificar(`Incluído em ${competenciaRotulo(competenciaAberta.competencia)}. O envelope fica pendente de cálculo na Folha do mês.`);
      recarregarExtras();
    } catch (e) {
      notificar(e.message, 'erro');
    } finally {
      setIncluindo(false);
    }
  }

  const abas = [
    { id: 'identificacao', rotulo: 'Identificação' },
    { id: 'documentacao', rotulo: 'Documentação' },
    { id: 'endereco', rotulo: 'Endereço' },
    { id: 'contrato', rotulo: 'Contrato' },
    { id: 'pagamento', rotulo: 'Pagamento' },
    ...(novo ? [] : [
      { id: 'beneficios', rotulo: 'Benefícios' },
      { id: 'rateio', rotulo: 'Rateio' },
      { id: 'envelopes', rotulo: 'Envelopes' },
      { id: 'encerramentos', rotulo: 'Encerramentos' },
    ]),
  ].map((a) => ({ ...a, contador: errosPorAba[a.id] }));

  // Campo de texto ligado ao formulário.
  const texto = (campo, rotulo, props = {}) => {
    const { largura, obrigatorio, dica, ...resto } = props;
    return (
      <Campo rotulo={rotulo} obrigatorio={obrigatorio} dica={dica} erro={erros[campo]} largura={largura}>
        <input className="form-input" value={form[campo] ?? ''} disabled={!editando} onChange={(e) => set(campo, e.target.value)} {...resto} />
      </Campo>
    );
  };
  const selecao = (campo, rotulo, opcoes, props = {}) => (
    <Campo rotulo={rotulo} erro={erros[campo]} largura={props.largura}>
      <select className="form-select" value={form[campo] ?? ''} disabled={!editando} onChange={(e) => set(campo, e.target.value)}>
        {opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Campo>
  );
  const data = (campo, rotulo, props = {}) => texto(campo, rotulo, { type: 'date', ...props });
  const ufOpcoes = [['', '—'], ...UFS.map((u) => [u, u])];
  const idadeAtual = idade(form.data_nascimento);

  return (
    <>
      <div className="pjp-topo">
        <div>
          <Link to={ROTA_PRESTADORES} className="pjp-voltar"><ArrowLeft size={14} /> Prestadores</Link>
          <div className="pjp-titulo-linha">
            <h1 className="page-title">{novo ? 'Novo prestador' : prestador.nome}</h1>
            {!novo && <Badge tipo="situacao" valor={prestador.situacao} />}
            {vigente && <Badge tipo="encerramento" valor={vigente.status} />}
          </div>
          <p className="page-subtitle">
            {novo ? 'O código é gerado ao salvar.' : `Código ${prestador.codigo} • ${prestador.empresa}${prestador.funcao ? ` • ${prestador.funcao}` : ''}`}
          </p>
        </div>
        <div className="pjp-acoes">
          {!novo && posicao >= 0 && (
            <>
              <button type="button" className="btn btn-ghost btn-icon" title="Anterior" disabled={editando || posicao <= 0} onClick={() => irPara(posicao - 1)}>
                <ChevronLeft size={18} />
              </button>
              <span className="pjp-registro">{posicao + 1} de {ordem.length}</span>
              <button type="button" className="btn btn-ghost btn-icon" title="Próximo" disabled={editando || posicao >= ordem.length - 1} onClick={() => irPara(posicao + 1)}>
                <ChevronRight size={18} />
              </button>
            </>
          )}
          {editando ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={cancelar} disabled={salvando}><X size={18} /> Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
                <Save size={18} /> {salvando ? 'Salvando…' : (novo ? 'Cadastrar prestador' : 'Salvar')}
              </button>
            </>
          ) : (
            <>
              {!novo && (
                <button type="button" className="btn btn-outline" onClick={() => setModal({ tipo: 'documentos' })}>
                  <FolderArchive size={18} /> Importar pasta do prestador
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={iniciarEdicao}><Pencil size={18} /> Editar</button>
            </>
          )}
        </div>
      </div>

      {avisoRecalculo && (
        <Aviso tipo="alerta" acao={<button type="button" className="btn btn-sm btn-ghost" onClick={() => setAvisoRecalculo(false)}>Ok</button>}>
          Valor mensal ou datas do contrato mudaram e o prestador já tem envelope em {competenciaRotulo(competenciaAberta?.competencia)}.
          O envelope não foi recalculado: recalcule na <Link to={ROTA_FOLHA}>Folha do mês</Link>.
        </Aviso>
      )}
      {!novo && !editando && prestador.situacao === 'ativo' && competenciaAberta && !extras.carregando && !extras.erro && !envelopeAberto && (
        <Aviso tipo="info" acao={(
          <button type="button" className="btn btn-sm btn-outline" onClick={incluirNaCompetencia} disabled={incluindo}>
            {incluindo ? 'Incluindo…' : 'Incluir na competência aberta'}
          </button>
        )}>
          Este prestador ativo não tem envelope em {competenciaRotulo(competenciaAberta.competencia)}.
        </Aviso>
      )}
      {extras.erro && <Aviso tipo="erro">{extras.erro}</Aviso>}

      <div className="table-container">
        <Abas abas={abas} ativa={aba} onTrocar={setAba} />

        {aba === 'identificacao' && (
          <div className="pjp-painel">
            <div className="pj-form-grid">
              {texto('nome', 'Nome completo', { obrigatorio: true, largura: 'largo' })}
              {selecao('situacao', 'Situação', [['ativo', 'Ativo'], ['desligado', 'Desligado']])}
              {selecao('sexo', 'Sexo', [['', '—'], ['F', 'Feminino'], ['M', 'Masculino']])}
              {texto('email', 'E-mail corporativo', { type: 'email', dica: 'Recebe o termo para emissão da NF.' })}
              {texto('email_pessoal', 'E-mail pessoal', { type: 'email' })}
              {texto('telefone', 'Telefone', { type: 'tel' })}
              {selecao('empresa', 'Empresa do fechamento', EMPRESAS)}
            </div>
          </div>
        )}

        {aba === 'documentacao' && (
          <div className="pjp-painel">
            <div className="pj-form-grid">
              {texto('razao_social', 'Razão social', { largura: 'largo' })}
              {texto('cnpj', 'CNPJ', { inputMode: 'numeric', placeholder: '00.000.000/0000-00' })}
              {texto('cpf', 'CPF do responsável', { inputMode: 'numeric', placeholder: '000.000.000-00' })}
              {texto('rg', 'RG do responsável')}
              {data('data_nascimento', 'Data de nascimento', { dica: idadeAtual !== null ? `${idadeAtual} anos` : undefined })}
            </div>
          </div>
        )}

        {aba === 'endereco' && (
          <div className="pjp-painel">
            <p className="form-hint">Fonte: comprovante de endereço da pasta do prestador.</p>
            <div className="pj-form-grid">
              {texto('cep', 'CEP', { inputMode: 'numeric' })}
              {texto('tipo_logradouro', 'Tipo do logradouro', { placeholder: 'Rua, Avenida…' })}
              {texto('logradouro', 'Logradouro', { largura: 'largo' })}
              {texto('numero', 'Número')}
              {texto('complemento', 'Complemento')}
              {texto('bairro', 'Bairro')}
              {texto('municipio', 'Município')}
              {selecao('uf', 'UF', ufOpcoes)}
              {texto('pais', 'País')}
            </div>
          </div>
        )}

        {aba === 'contrato' && (
          <div className="pjp-painel">
            <div className="pj-toolbar">
              <div className="pj-secao-titulo">Contrato</div>
              {!novo && (
                <div className="pj-toolbar-direita">
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setModal({ tipo: 'encerrar' })} disabled={editando}>
                    <CalendarX size={14} /> Encerrar contrato
                  </button>
                </div>
              )}
            </div>
            <div className="pj-form-grid">
              {texto('modalidade', 'Modalidade')}
              {data('data_inicio', 'Início do contrato')}
              {data('data_fim', 'Término / encerramento', { dica: vigente ? 'Definido pelo encerramento registrado.' : undefined })}
              <Campo rotulo="Valor mensal de referência" erro={erros.valor_mensal}>
                {editando
                  ? <CurrencyInput value={form.valor_mensal} onChange={(v) => set('valor_mensal', v)} placeholder="0,00" />
                  : <input className="form-input" disabled value={form.valor_mensal ? `R$ ${form.valor_mensal}` : ''} />}
              </Campo>
              {texto('funcao', 'Serviço / função', { largura: 'largo' })}
              {texto('projeto', 'Projeto')}
              {texto('gestor', 'Gestor responsável')}
            </div>
            <div className="pj-secao-titulo">Seção e atuação</div>
            <div className="pj-form-grid">
              {texto('secao_codigo', 'Código da seção')}
              {texto('secao_nome', 'Descrição da seção', { largura: 'largo' })}
              {texto('municipio_atuacao', 'Município de atuação')}
              {selecao('uf_atuacao', 'UF de atuação', ufOpcoes)}
            </div>
            {!novo && <HistoricoSalarial extras={extras} />}
          </div>
        )}

        {aba === 'pagamento' && (
          <div className="pjp-painel">
            <p className="form-hint">Estes dados alimentam a Planilha Financeira.</p>
            <div className="pj-form-grid">
              {texto('banco', 'Banco')}
              {texto('banco_codigo', 'Código do banco', { inputMode: 'numeric' })}
              {texto('agencia', 'Agência')}
              {texto('conta', 'Conta')}
              {texto('pix', 'Chave PIX', { largura: 'largo' })}
              {selecao('contabilidade', 'Contabilidade', [['', '—'], ['Montservice', 'Montservice'], ['Externo', 'Externo']])}
            </div>
          </div>
        )}

        {aba === 'beneficios' && prestador && (
          <Beneficios prestador={prestador} onBradesco={() => setModal({ tipo: 'bradesco' })} />
        )}

        {aba === 'rateio' && prestador && (
          <RateioEditor prestador={prestador} temEnvelopeAberto={Boolean(envelopeAberto)} onImportar={() => setModal({ tipo: 'organograma' })} />
        )}

        {aba === 'envelopes' && <Envelopes extras={extras} />}

        {aba === 'encerramentos' && prestador && (
          <Encerramentos extras={extras} onDistrato={(e) => setModal({ tipo: 'distrato', encerramento: e })}
            onCancelar={(e) => setModal({ tipo: 'cancelar', encerramento: e })} onNovo={() => setModal({ tipo: 'encerrar' })} />
        )}
      </div>

      {modal?.tipo === 'encerrar' && (
        <Encerramento prestador={prestador} onFechar={() => setModal(null)}
          onConcluido={(registro, atualizado) => {
            recarregarExtras();
            setAba('encerramentos');
            setModal({ tipo: 'distrato', encerramento: registro, prestador: atualizado });
          }} />
      )}
      {modal?.tipo === 'cancelar' && (
        <CancelarEncerramento encerramento={modal.encerramento} prestador={prestador} onFechar={() => setModal(null)}
          onConcluido={() => { recarregarExtras(); setModal(null); }} />
      )}
      {modal?.tipo === 'distrato' && (
        <Distrato encerramento={modal.encerramento} prestador={modal.prestador || prestador} onFechar={() => setModal(null)} />
      )}
      {modal?.tipo === 'organograma' && <ImportarOrganograma onFechar={() => setModal(null)} />}
      {modal?.tipo === 'documentos' && <ImportarDocumentos prestador={prestador} onFechar={() => setModal(null)} />}
      {modal?.tipo === 'bradesco' && <ConferenciaBradesco onFechar={() => setModal(null)} />}
    </>
  );
}

function HistoricoSalarial({ extras }) {
  return (
    <>
      <div className="pj-secao-titulo">Histórico de valor e função</div>
      {extras.carregando ? <Carregando /> : extras.historico.length ? (
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr>
                <th>Vigência</th><th className="pj-direita">Anterior</th><th className="pj-direita">Novo</th><th className="pj-direita">Diferença</th>
                <th className="pj-direita">%</th><th>Função</th><th>Motivo</th><th>Registrado por</th><th>Em</th>
              </tr>
            </thead>
            <tbody>
              {extras.historico.map((h) => {
                const anterior = Number(h.valor_anterior) || 0;
                const novoValor = Number(h.valor_novo) || 0;
                const dif = round2(novoValor - anterior);
                const funcaoMudou = (h.funcao_anterior || '') !== (h.funcao_nova || '');
                return (
                  <tr key={h.id}>
                    <td className="pjp-nowrap">{dataBr(h.vigencia)}</td>
                    <td className="pj-direita"><Moeda valor={anterior} /></td>
                    <td className="pj-direita"><Moeda valor={novoValor} forte /></td>
                    <td className={`pj-direita pj-num ${dif > 0 ? 'pjp-ok' : ''}`}>{dif === 0 ? '—' : `${dif > 0 ? '↑' : '↓'} ${fmtBRL(Math.abs(dif))}`}</td>
                    <td className="pj-direita pj-num">{anterior && dif ? `${fmtNum((dif / anterior) * 100)} %` : '—'}</td>
                    <td>{funcaoMudou ? `${h.funcao_anterior || '—'} → ${h.funcao_nova || '—'}` : (h.funcao_nova || '—')}</td>
                    <td>{h.motivo}</td>
                    <td>{extras.nomes.get(h.registrado_por) || '—'}</td>
                    <td className="pjp-nowrap">{dataHoraBr(h.registrado_em)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      ) : <p className="form-hint">Nenhuma alteração de valor ou função registrada. As mudanças são gravadas automaticamente ao salvar.</p>}
    </>
  );
}

function CartaoBeneficio({ titulo, icone, beneficio }) {
  const ativo = Boolean(beneficio?.ativo);
  return (
    <div className="pj-cartao pjp-cartao-beneficio">
      <h3>
        <span className="pjp-titulo-linha">{icone} {titulo}</span>
        {ativo ? <span className="badge ativo">Ativo</span> : <span className="badge pj-neutro">Não cadastrado</span>}
      </h3>
      {beneficio ? (
        <div className="pj-pares">
          <div className="pj-par"><small>Plano</small><b>{beneficio.plano || '—'}</b></div>
          <div className="pj-par"><small>Valor</small><b><Moeda valor={beneficio.valor} /></b></div>
          <div className="pj-par"><small>Vidas</small><b>{beneficio.vidas ?? '—'}</b></div>
          <div className="pj-par"><small>Atualizado em</small><b>{dataBr(beneficio.atualizadoEm)}</b></div>
          <div className="pj-par pj-campo--total"><small>Fonte</small><b>{beneficio.fonte || '—'}</b></div>
        </div>
      ) : <p>Sem informação importada.</p>}
    </div>
  );
}

const PENDENTE = /INAT|NAO LOCALIZADO|NÃO LOCALIZADO|DIVERG|PEND/i;

function Beneficios({ prestador, onBradesco }) {
  const dependentes = Array.isArray(prestador.dependentes) ? prestador.dependentes : [];
  return (
    <div className="pjp-painel">
      <div className="pj-toolbar">
        <p className="form-hint">Plano médico e dependentes vêm da Conferência Bradesco.</p>
        <div className="pj-toolbar-direita">
          <button type="button" className="btn btn-sm btn-outline" onClick={onBradesco}><HeartPulse size={14} /> Conferência Bradesco</button>
        </div>
      </div>
      <div className="pj-cartoes">
        <CartaoBeneficio titulo="Plano médico" icone={<Stethoscope size={18} />} beneficio={prestador.beneficios?.medico} />
        <CartaoBeneficio titulo="Plano odontológico" icone={<Smile size={18} />} beneficio={prestador.beneficios?.odonto} />
      </div>
      <div className="pj-secao-titulo">Dependentes cadastrados ({dependentes.length})</div>
      {dependentes.length ? (
        <TableScroll>
          <table className="data-table">
            <thead><tr><th>Nome</th><th>CPF</th><th>Nascimento</th><th>Parentesco</th><th>Situação</th><th>Fonte</th><th>Benefício</th></tr></thead>
            <tbody>
              {dependentes.map((d, i) => (
                <tr key={`${d.nome}-${i}`}>
                  <td>{d.nome}</td>
                  <td className="pjp-nowrap">{d.cpf ? mascararCpf(d.cpf) : '—'}</td>
                  <td className="pjp-nowrap">{dataBr(d.nascimento)}</td>
                  <td>{d.parentesco || '—'}</td>
                  <td>{d.situacao ? <span className={`badge ${PENDENTE.test(d.situacao) ? 'pj-neutro' : 'aprovada'}`}>{d.situacao}</span> : '—'}</td>
                  <td>{d.fonte || '—'}</td>
                  <td>{d.beneficio || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : <Vazio>Nenhum dependente cadastrado.</Vazio>}
    </div>
  );
}

function Envelopes({ extras }) {
  if (extras.carregando) return <Carregando />;
  if (!extras.envelopes.length) return <Vazio>O prestador ainda não tem envelopes.</Vazio>;
  return (
    <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>Competência</th><th className="pj-direita">Bruto</th><th className="pj-direita">Descontos</th><th className="pj-direita">Líquido</th>
            <th>Conferência</th><th>Termo</th><th>Envio</th><th>Calculado em</th>
          </tr>
        </thead>
        <tbody>
          {extras.envelopes.map((e) => (
            <tr key={e.id}>
              <td>{competenciaRotulo(e.competencia)}</td>
              <td className="pj-direita"><Moeda valor={e.bruto} /></td>
              <td className="pj-direita"><Moeda valor={e.descontos} /></td>
              <td className="pj-direita"><Moeda valor={e.liquido} forte /></td>
              <td><Badge tipo="conferencia" valor={e.conferencia} /></td>
              <td><Badge tipo="termo" valor={e.termo} /></td>
              <td><Badge tipo="envio" valor={e.envio} /></td>
              <td className="pjp-nowrap">{e.calculado_em ? dataHoraBr(e.calculado_em) : <span className="pjp-muted">Pendente</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function Encerramentos({ extras, onDistrato, onCancelar, onNovo }) {
  if (extras.carregando) return <Carregando />;
  return (
    <div className="pjp-painel">
      <div className="pj-toolbar">
        <p className="form-hint">Encerramentos registrados, inclusive os cancelados.</p>
        <div className="pj-toolbar-direita">
          <button type="button" className="btn btn-sm btn-outline" onClick={onNovo}><CalendarX size={14} /> Encerrar contrato</button>
        </div>
      </div>
      {extras.encerramentos.length ? (
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr>
                <th>Competência</th><th>Encerramento</th><th>Motivo</th><th className="pj-direita">Dias</th><th className="pj-direita">Proporcional</th>
                <th className="pj-direita">Indenização</th><th>Status</th><th>Registrado</th><th className="pj-direita">Ações</th>
              </tr>
            </thead>
            <tbody>
              {extras.encerramentos.map((e) => (
                <tr key={e.id}>
                  <td>{competenciaRotulo(e.competencia)}</td>
                  <td className="pjp-nowrap">
                    {dataBr(e.data_encerramento)}
                    <div className="pj-sub">Pagamento {dataBr(e.data_pagamento)}</div>
                  </td>
                  <td>
                    {e.motivo}
                    {e.observacao && <div className="pj-sub">{e.observacao}</div>}
                  </td>
                  <td className="pj-direita pj-num">{e.dias_ativos ?? '—'}/{e.divisor ?? '—'}</td>
                  <td className="pj-direita"><Moeda valor={e.valor_proporcional} /></td>
                  <td className="pj-direita">{Number(e.valor_indenizacao) ? <Moeda valor={e.valor_indenizacao} /> : '—'}</td>
                  <td>
                    <Badge tipo="encerramento" valor={e.status} />
                    {e.cancelado_em && <div className="pj-sub">em {dataHoraBr(e.cancelado_em)}</div>}
                  </td>
                  <td className="pjp-nowrap">
                    {dataHoraBr(e.registrado_em)}
                    <div className="pj-sub">{extras.nomes.get(e.registrado_por) || ''}</div>
                  </td>
                  <td>
                    {e.status !== 'cancelado' && (
                      <div className="pj-acoes-linha">
                        <button type="button" className="btn-icon" title="Prévia do distrato" onClick={() => onDistrato(e)}><FileText size={16} /></button>
                        <button type="button" className="btn-icon" title="Cancelar encerramento" onClick={() => onCancelar(e)}><Ban size={16} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : <Vazio>Nenhum encerramento registrado.</Vazio>}
    </div>
  );
}
