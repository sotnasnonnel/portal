import { useState, useEffect } from 'react';
import { Loader2, Check, AlertTriangle, Infinity as InfinityIcon } from 'lucide-react';
import CurrencyInput from '../../../../../components/CurrencyInput';
import { parseCurrency } from '../../../../../utils/currencyMask';
import { APLICACOES } from '../../../../../config/financeiro';
import MultiSelect from '../../components/MultiSelect';
import SearchSelect from '../../components/SearchSelect';
import { listarTodosContratos } from '../contratos';
import TermosAceite from './TermosAceite';
import ClassificacaoAlcada from './ClassificacaoAlcada';
import { useSolicitacaoFin } from './useSolicitacaoFin';
import '../../../../../components/UI/Components.css';

const estadoInicial = {
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
  observacao: '',
  // §6, pilar 1 — classificação obrigatória
  categoria: '',
  dentro_orcamento: null,
};

const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());

export default function FormCartaoVirtual({ sol }) {
  const t = useSolicitacaoFin(sol);
  const [form, setForm] = useState(estadoInicial);
  const [faltando, setFaltando] = useState([]);
  const [erroData, setErroData] = useState('');

  // CC = contratos do solicitante no organograma (banco backoffice, por nome).
  const [contratos, setContratos] = useState([]);
  const [loadingCC, setLoadingCC] = useState(true);
  const [erroCC, setErroCC] = useState(false);

  const set = (id, valor) => setForm((p) => ({ ...p, [id]: valor }));

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
    if (!form.nome_completo.trim()) falta.push('nome_completo');
    if (!emailValido(form.email)) falta.push('email');
    if (!form.telefone.trim()) falta.push('telefone');
    if (!form.centro_custo.trim()) falta.push('centro_custo');
    if (parseCurrency(form.valor) == null) falta.push('valor');
    if (form.aplicacao.length === 0) falta.push('aplicacao');
    if (!form.categoria) falta.push('categoria');
    if (form.dentro_orcamento == null) falta.push('dentro_orcamento');
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
      nome_despesa: form.descricao.trim(),   // coluna do envelope; rótulo = "Descrição do cartão"
      nome_completo: form.nome_completo.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      centro_custo: form.centro_custo.trim(),
      valor: parseCurrency(form.valor),
      vitalicio: form.vitalicio,
      periodo_inicio: form.vitalicio ? null : form.periodo_inicio,
      periodo_fim: form.vitalicio ? null : form.periodo_fim,
      aplicacao: form.aplicacao,
      observacao: form.observacao.trim() || null,
      categoria: form.categoria,
      dentro_orcamento: form.dentro_orcamento,
    }, () => setForm(estadoInicial));
  };

  const erro = (id) => faltando.includes(id);
  const Icon = sol.icon;

  // Botão só habilita com tudo pronto: obrigatórios preenchidos + termos aceitos.
  // (A ordem das datas continua validada no submit, com mensagem própria.)
  const camposOk = form.descricao.trim() && form.nome_completo.trim()
    && emailValido(form.email) && form.telefone.trim() && form.centro_custo.trim()
    && parseCurrency(form.valor) != null && form.aplicacao.length > 0
    && (form.vitalicio || (form.periodo_inicio && form.periodo_fim))
    && !!form.categoria && form.dentro_orcamento != null;
  const podeEnviar = !!t.aceite && !!camposOk && !t.semFluxo;

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
          <label className="form-label">Descrição do cartão <span className="required">*</span></label>
          <input className="form-input" type="text" placeholder="Ex.: Cartão para materiais da Obra X"
            value={form.descricao} onChange={(e) => set('descricao', e.target.value)} />
          {erro('descricao') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Nome completo <span className="required">*</span></label>
          <input className="form-input" type="text" placeholder="Nome completo do portador do cartão"
            value={form.nome_completo} onChange={(e) => set('nome_completo', e.target.value)} />
          {erro('nome_completo') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">E-mail <span className="required">*</span></label>
          <input className="form-input" type="email" inputMode="email" placeholder="nome@phdengenharia.eng.br"
            value={form.email} onChange={(e) => set('email', e.target.value)} />
          {erro('email') && <span className="fin-erro-campo">{form.email.trim() ? 'E-mail inválido' : 'Obrigatório'}</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Telefone <span className="required">*</span></label>
          <input className="form-input" type="tel" inputMode="tel" placeholder="(00) 00000-0000"
            value={form.telefone} onChange={(e) => set('telefone', e.target.value)} />
          {erro('telefone') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Centro de custo (CC) <span className="required">*</span></label>
          {loadingCC ? (
            <div className="fin-hint" style={{ marginTop: 0 }}><Loader2 size={13} className="animate-spin" /> Carregando seus contratos...</div>
          ) : erroCC ? (
            <div className="fin-aviso">Não foi possível carregar os contratos do organograma. Tente novamente mais tarde.</div>
          ) : contratos.length === 0 ? (
            <div className="fin-aviso">Nenhum contrato encontrado no organograma deste mês.</div>
          ) : (
            <>
              <SearchSelect
                value={form.centro_custo}
                onChange={(v) => set('centro_custo', v)}
                options={contratos.map((c) => ({ value: c, label: c }))}
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
          />
          {erro('aplicacao') && <span className="fin-erro-campo">Selecione ao menos uma</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Observação</label>
          <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Informações adicionais (opcional)"
            value={form.observacao} onChange={(e) => set('observacao', e.target.value)} />
        </div>

        <ClassificacaoAlcada
          valor={parseCurrency(form.valor)}
          categoria={form.categoria}
          dentroOrcamento={form.dentro_orcamento}
          solicitanteId={t.user?.id}
          erros={faltando}
          onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
        />

        <TermosAceite sol={sol} {...t} />

        {t.semFluxo && (
          <div className="fin-aviso" style={{ marginTop: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={15} /> O Financeiro ainda não configurou o fluxo de aprovação para você neste tipo de solicitação.
          </div>
        )}
        <button className="btn btn-primary" type="submit" disabled={t.submitting || !podeEnviar} style={{ width: '100%', marginTop: 'var(--space-lg)' }}>
          {t.submitting ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
          {t.submitting ? ' Enviando...' : ' Enviar solicitação'}
        </button>
      </form>
    </div>
  );
}
