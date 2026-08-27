import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, Infinity as InfinityIcon, Truck } from 'lucide-react';
import CurrencyInput from '../../../../../components/CurrencyInput';
import { parseCurrency } from '../../../../../utils/currencyMask';
import { mascaraTelefone, telefoneValido } from '../../../../../utils/phoneMask';
import { APLICACOES, MODALIDADES_CARTAO, PRAZO_CARTAO_FISICO } from '../../../../../config/financeiro';
import {
  ENDERECO_VAZIO, UFS, mascaraCep, faltasEndereco, enderecoCompleto, formatarEnderecoEntrega,
} from '../endereco';
import MultiSelect from '../../components/MultiSelect';
import SearchSelect from '../../components/SearchSelect';
import { listarTodosContratos } from '../contratos';
import TermosAceite from './TermosAceite';
import PreviaAprovacao from './PreviaAprovacao';
import { useSolicitacaoFin } from './useSolicitacaoFin';
import '../../../../../components/UI/Components.css';

const estadoInicial = {
  modalidade: 'virtual',        // virtual | fisico
  endereco: ENDERECO_VAZIO,     // só no físico (vira uma string no envio)
  descricao: '',
  nome_completo: '',
  email: '',
  telefone: '',
  centro_custo: '',
  valor: '',
  vitalicio: false,
  periodo_inicio: '',
  periodo_fim: '',
  aplicacao: [],
  aplicacao_outros: '',        // texto livre quando marcam "Outros"
  observacao: '',
};

const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());

// Opção "Outro" do seletor de CC. Prefixo improvável de colidir com um código
// de contrato de verdade.
const CC_OUTRO = '__outro__';

// Última categoria de APLICACOES: marcada, abre o campo livre.
const APLICACAO_OUTROS = 'Outros';

export default function FormCartaoVirtual({ sol }) {
  const t = useSolicitacaoFin(sol);
  const [form, setForm] = useState(estadoInicial);
  const [faltando, setFaltando] = useState([]);
  const [erroData, setErroData] = useState('');
  // Preenchido pela prévia quando a cadeia de aprovação não fecha.
  const [bloqueio, setBloqueio] = useState(null);
  const aoBloquear = useCallback((b) => setBloqueio(b), []);

  // CC = contratos do solicitante no organograma (banco backoffice, por nome).
  const [contratos, setContratos] = useState([]);
  const [loadingCC, setLoadingCC] = useState(true);
  const [erroCC, setErroCC] = useState(false);
  // "Outro": a lista do organograma nem sempre tem o CC do pedido (contrato
  // novo, rateio, centro administrativo). Marcado, o campo vira digitável.
  const [ccOutro, setCcOutro] = useState(false);

  const set = (id, valor) => setForm((p) => ({ ...p, [id]: valor }));

  // Cartão físico: exige endereço de entrega e avisa o prazo estimado.
  const fisico = form.modalidade === 'fisico';
  const setEndereco = (campo, valor) =>
    setForm((p) => ({ ...p, endereco: { ...p.endereco, [campo]: valor } }));

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await listarTodosContratos();
        if (vivo) { setContratos(lista); setLoadingCC(false); }
      } catch {
        if (vivo) { setErroCC(true); setLoadingCC(false); }
      }
    })();
    return () => { vivo = false; };
  }, []);

  // Nome e e-mail do PORTADOR saem do login: na prática o portador é quem
  // solicita, e digitar de novo só rendia erro de digitação no e-mail que a
  // operadora usa. Derivados (e não copiados por efeito) para não brigar com o
  // momento em que o perfil termina de carregar; continuam editáveis, para o
  // caso de o cartão ser para outra pessoa.
  const nomePortador = form.nome_completo || t.user?.nome || '';
  const emailPortador = form.email || t.user?.email || '';

  // Vitalício: a vigência é irrelevante — o range some e as datas são limpas.
  const setVitalicio = (marcado) => {
    setErroData('');
    setForm((p) => ({ ...p, vitalicio: marcado, periodo_inicio: '', periodo_fim: '' }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    t.setSucesso(null);
    setErroData('');

    const falta = [];
    if (!form.descricao.trim()) falta.push('descricao');
    if (fisico) falta.push(...faltasEndereco(form.endereco));
    if (!nomePortador.trim()) falta.push('nome_completo');
    if (!emailValido(emailPortador)) falta.push('email');
    if (!telefoneValido(form.telefone)) falta.push('telefone');
    if (!form.centro_custo.trim()) falta.push('centro_custo');
    if (parseCurrency(form.valor) == null) falta.push('valor');
    if (form.aplicacao.length === 0) falta.push('aplicacao');
    if (temOutrasAplicacoes && !form.aplicacao_outros.trim()) falta.push('aplicacao_outros');
    if (!form.vitalicio) {
      if (!form.periodo_inicio) falta.push('periodo_inicio');
      if (!form.periodo_fim) falta.push('periodo_fim');
    }
    setFaltando(falta);
    if (falta.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    if (!form.vitalicio && form.periodo_fim < form.periodo_inicio) {
      setErroData('A data final não pode ser anterior à inicial.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!t.aceite) { t.setTermosOpen(true); return; }

    await t.enviar({
      modalidade_cartao: form.modalidade,
      endereco_entrega: fisico ? formatarEnderecoEntrega(form.endereco) : null,
      nome_despesa: form.descricao.trim(),   // coluna do envelope; rótulo = "Descrição do cartão"
      nome_completo: nomePortador.trim(),
      email: emailPortador.trim(),
      telefone: form.telefone.trim(),
      centro_custo: form.centro_custo.trim(),
      valor: parseCurrency(form.valor),
      vitalicio: form.vitalicio,
      periodo_inicio: form.vitalicio ? null : form.periodo_inicio,
      periodo_fim: form.vitalicio ? null : form.periodo_fim,
      aplicacao: aplicacaoFinal,
      observacao: form.observacao.trim() || null,
    }, () => { setForm(estadoInicial); setCcOutro(false); });
  };

  // "Outros" na Aplicação abre um campo livre, como o "Outro" do CC: a lista de
  // categorias é fechada e nunca cobre tudo. O que vai para o banco é o texto
  // digitado, marcado como Outros — quem aprova precisa saber o que é.
  const temOutrasAplicacoes = form.aplicacao.includes(APLICACAO_OUTROS);
  const aplicacaoFinal = form.aplicacao.map((a) => (
    a === APLICACAO_OUTROS && form.aplicacao_outros.trim()
      ? `${APLICACAO_OUTROS}: ${form.aplicacao_outros.trim()}`
      : a
  ));

  // Sem contratos para escolher (erro de rede ou mês sem alocação), o CC vira
  // campo digitável — e por escolha da pessoa, via "Outro".
  const semLista = erroCC || contratos.length === 0;
  const ccDigitavel = semLista || ccOutro;

  const erro = (id) => faltando.includes(id);
  const Icon = sol.icon;

  // Botão só habilita com tudo pronto: obrigatórios preenchidos + termos aceitos.
  // (A ordem das datas continua validada no submit, com mensagem própria.)
  const camposOk = form.descricao.trim() && (!fisico || enderecoCompleto(form.endereco)) && nomePortador.trim()
    && emailValido(emailPortador) && telefoneValido(form.telefone) && form.centro_custo.trim()
    && parseCurrency(form.valor) != null && form.aplicacao.length > 0
    && (!temOutrasAplicacoes || form.aplicacao_outros.trim())
    && (form.vitalicio || (form.periodo_inicio && form.periodo_fim));
  const podeEnviar = !!t.aceite && !!camposOk && !bloqueio;

  return (
    <div className="table-container">
      <form onSubmit={onSubmit} style={{ padding: 'var(--space-xl)' }}>
        {t.sucesso && (
          <div className="fin-success" style={{ marginBottom: 'var(--space-lg)' }}>
            <Check size={16} /> Solicitação {t.sucesso.numero != null ? `#${t.sucesso.numero} ` : ''}enviada com sucesso!
          </div>
        )}
        {(faltando.length > 0 || erroData) && (
          <div className="fin-aviso" style={{ marginBottom: 'var(--space-lg)' }}>
            {erroData || 'Preencha os campos obrigatórios destacados.'}
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Tipo de cartão <span className="required">*</span></label>
          <div className="alc-radios">
            {MODALIDADES_CARTAO.map((m) => (
              <label key={m.value} className={`alc-radio ${form.modalidade === m.value ? 'is-on' : ''}`}>
                <input
                  type="radio" name="modalidade_cartao" checked={form.modalidade === m.value}
                  onChange={() => setForm((p) => ({
                    ...p,
                    modalidade: m.value,
                    // trocar para virtual limpa o endereço (não vai para o banco)
                    endereco: m.value === 'fisico' ? p.endereco : ENDERECO_VAZIO,
                  }))}
                />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
          {fisico && (
            <div className="alc-modificador">
              <Truck size={13} />
              {PRAZO_CARTAO_FISICO}
            </div>
          )}
        </div>

        {/* Endereço em campos separados: no campo único o pedido chegava ao
            Financeiro sem número ou sem CEP. */}
        {fisico && (
          <fieldset className="fin-endereco">
            <legend>Endereço de entrega <span className="required">*</span></legend>
            <div className="fin-endereco-grid">
              <div className="form-group campo-cep">
                <label className="form-label">CEP <span className="required">*</span></label>
                <input className="form-input" type="text" inputMode="numeric" placeholder="00000-000"
                  value={form.endereco.cep} onChange={(e) => setEndereco('cep', mascaraCep(e.target.value))} />
                {erro('cep') && <span className="fin-erro-campo">CEP incompleto</span>}
              </div>
              <div className="form-group campo-logradouro">
                <label className="form-label">Logradouro <span className="required">*</span></label>
                <input className="form-input" type="text" placeholder="Rua, avenida, rodovia..."
                  value={form.endereco.logradouro} onChange={(e) => setEndereco('logradouro', e.target.value)} />
                {erro('logradouro') && <span className="fin-erro-campo">Obrigatório</span>}
              </div>
              <div className="form-group campo-numero">
                <label className="form-label">Número <span className="required">*</span></label>
                <input className="form-input" type="text" placeholder="123"
                  value={form.endereco.numero} onChange={(e) => setEndereco('numero', e.target.value)} />
                {erro('numero') && <span className="fin-erro-campo">Obrigatório</span>}
              </div>
              <div className="form-group campo-complemento">
                <label className="form-label">Complemento</label>
                <input className="form-input" type="text" placeholder="Apto, bloco, sala (opcional)"
                  value={form.endereco.complemento} onChange={(e) => setEndereco('complemento', e.target.value)} />
              </div>
              <div className="form-group campo-bairro">
                <label className="form-label">Bairro <span className="required">*</span></label>
                <input className="form-input" type="text" placeholder="Bairro"
                  value={form.endereco.bairro} onChange={(e) => setEndereco('bairro', e.target.value)} />
                {erro('bairro') && <span className="fin-erro-campo">Obrigatório</span>}
              </div>
              <div className="form-group campo-cidade">
                <label className="form-label">Cidade <span className="required">*</span></label>
                <input className="form-input" type="text" placeholder="Cidade"
                  value={form.endereco.cidade} onChange={(e) => setEndereco('cidade', e.target.value)} />
                {erro('cidade') && <span className="fin-erro-campo">Obrigatório</span>}
              </div>
              <div className="form-group campo-uf">
                <label className="form-label">UF <span className="required">*</span></label>
                <select className="form-select" value={form.endereco.uf}
                  onChange={(e) => setEndereco('uf', e.target.value)}>
                  <option value="">--</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
                {erro('uf') && <span className="fin-erro-campo">Obrigatório</span>}
              </div>
            </div>
          </fieldset>
        )}

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Descrição do cartão <span className="required">*</span></label>
          <input className="form-input" type="text" placeholder="Ex.: Cartão para materiais da Obra X"
            value={form.descricao} onChange={(e) => set('descricao', e.target.value)} />
          {erro('descricao') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Nome completo <span className="required">*</span></label>
          <input className="form-input" type="text" placeholder="Nome completo do portador do cartão"
            value={nomePortador} onChange={(e) => set('nome_completo', e.target.value)} />
          <span className="fin-hint">Preenchido pelo seu login — altere se o portador for outra pessoa.</span>
          {erro('nome_completo') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">E-mail <span className="required">*</span></label>
          <input className="form-input" type="email" inputMode="email" placeholder="nome@phdengenharia.eng.br"
            value={emailPortador} onChange={(e) => set('email', e.target.value)} />
          <span className="fin-hint">Preenchido pelo seu login — altere se o portador for outra pessoa.</span>
          {erro('email') && <span className="fin-erro-campo">{emailPortador.trim() ? 'E-mail inválido' : 'Obrigatório'}</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Telefone <span className="required">*</span></label>
          <input className="form-input" type="tel" inputMode="tel" placeholder="(31) 9 9999-9999"
            value={form.telefone} onChange={(e) => set('telefone', mascaraTelefone(e.target.value))} />
          {erro('telefone') && (
            <span className="fin-erro-campo">
              {form.telefone.trim() ? 'Telefone incompleto' : 'Obrigatório'}
            </span>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Centro de custo (CC) <span className="required">*</span></label>
          {loadingCC ? (
            <div className="fin-hint" style={{ marginTop: 0 }}><Loader2 size={13} className="animate-spin" /> Carregando seus contratos...</div>
          ) : ccDigitavel ? (
            /* Digitado: ou porque o organograma não trouxe lista, ou porque a
               pessoa escolheu "Outro". Melhor do que não conseguir pedir — o
               Financeiro confere o CC na execução. */
            <>
              <input className="form-input" type="text" placeholder="Digite o centro de custo (ex.: CORP&gt;ADM)"
                value={form.centro_custo} onChange={(e) => set('centro_custo', e.target.value)} />
              <span className="fin-hint">
                {erroCC
                  ? 'Não foi possível carregar os contratos do organograma — informe o CC manualmente.'
                  : contratos.length === 0
                    ? 'Nenhum contrato encontrado no organograma deste mês — informe o CC manualmente.'
                    : 'CC digitado à mão.'}
                {!semLista && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="fin-link"
                      onClick={() => { setCcOutro(false); set('centro_custo', ''); }}
                    >
                      Escolher da lista
                    </button>
                  </>
                )}
              </span>
              {erro('centro_custo') && <span className="fin-erro-campo">Obrigatório</span>}
            </>
          ) : (
            <>
              <SearchSelect
                value={form.centro_custo}
                onChange={(v) => {
                  if (v === CC_OUTRO) { setCcOutro(true); set('centro_custo', ''); return; }
                  set('centro_custo', v);
                }}
                options={[
                  ...contratos.map((c) => ({ value: c, label: c })),
                  { value: CC_OUTRO, label: 'Outro (digitar o CC)' },
                ]}
                placeholder="Selecione o contrato (CC)..."
              />
              {erro('centro_custo') && <span className="fin-erro-campo">Selecione o contrato</span>}
            </>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Valor (R$) <span className="required">*</span></label>
          <CurrencyInput value={form.valor} onChange={(v) => set('valor', v)} placeholder="0,00" />
          {erro('valor') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        {/* Vigência: vitalício desliga o range (a data deixa de ser necessária) */}
        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Vigência {!form.vitalicio && <span className="required">*</span>}</label>
          <label className="fin-check">
            <input type="checkbox" checked={form.vitalicio} onChange={(e) => setVitalicio(e.target.checked)} />
            <InfinityIcon size={14} />
            <span>Cartão vitalício (sem prazo de validade)</span>
          </label>

          {!form.vitalicio && (
            <div className="fin-range">
              <div>
                <span className="fin-range-lab">De</span>
                <input className="form-input" type="date" value={form.periodo_inicio}
                  onChange={(e) => set('periodo_inicio', e.target.value)} />
                {erro('periodo_inicio') && <span className="fin-erro-campo">Obrigatório</span>}
              </div>
              <div>
                <span className="fin-range-lab">Até</span>
                <input className="form-input" type="date" value={form.periodo_fim}
                  min={form.periodo_inicio || undefined}
                  onChange={(e) => set('periodo_fim', e.target.value)} />
                {erro('periodo_fim') && <span className="fin-erro-campo">Obrigatório</span>}
              </div>
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Aplicação <span className="required">*</span></label>
          <MultiSelect
            value={form.aplicacao}
            onChange={(v) => set('aplicacao', v)}
            options={APLICACOES}
            placeholder="Selecione uma ou mais categorias..."
            fecharAoSelecionar
          />
          {erro('aplicacao') && <span className="fin-erro-campo">Selecione ao menos uma</span>}
          {temOutrasAplicacoes && (
            <>
              <input
                className="form-input"
                style={{ marginTop: 8 }}
                type="text"
                placeholder="Qual? (ex.: materiais elétricos)"
                value={form.aplicacao_outros}
                onChange={(e) => set('aplicacao_outros', e.target.value)}
              />
              <span className="fin-hint">Descreva o uso — vai junto da aplicação para quem aprova.</span>
              {erro('aplicacao_outros') && <span className="fin-erro-campo">Descreva a aplicação</span>}
            </>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Observação</label>
          <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Informações adicionais (opcional)"
            value={form.observacao} onChange={(e) => set('observacao', e.target.value)} />
        </div>

        <PreviaAprovacao
          valor={parseCurrency(form.valor)}
          solicitanteId={t.user?.id}
          tipoDb={sol.tipoDb}
          onBloqueio={aoBloquear}
        />

        <TermosAceite sol={sol} {...t} />

        <button className="btn btn-primary" type="submit" disabled={t.submitting || !podeEnviar} style={{ width: '100%', marginTop: 'var(--space-lg)' }}>
          {t.submitting ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
          {t.submitting ? ' Enviando...' : ' Enviar solicitação'}
        </button>
      </form>
    </div>
  );
}
