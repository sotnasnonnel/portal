import { useState, useEffect } from 'react';
import { Loader2, Check, AlertTriangle, CreditCard, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import CurrencyInput from '../../../../../components/CurrencyInput';
import { parseCurrency } from '../../../../../utils/currencyMask';
import { formatarMoeda } from '../../../../../utils/formatters';
import SearchSelect from '../../components/SearchSelect';
import TermosAceite from './TermosAceite';
import { useSolicitacaoFin } from './useSolicitacaoFin';
import { listarCartoesDoSolicitante } from '../cartoes';
import '../../../../../components/UI/Components.css';

const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');
const vigenciaDe = (c) => (c.vitalicio ? 'Vitalício' : `${fmtData(c.periodo_inicio)} até ${fmtData(c.periodo_fim)}`);

/**
 * Aumento de Limite: o CARTÃO identifica a solicitação (no lugar de um nome).
 * CC, vigência e aplicação não são digitados — vêm do cartão escolhido e são
 * copiados (snapshot) no envio. `valor` = NOVO LIMITE TOTAL do cartão.
 */
export default function FormAumentoLimite({ sol }) {
  const t = useSolicitacaoFin(sol);
  const [cartoes, setCartoes] = useState([]);
  const [loadingCartoes, setLoadingCartoes] = useState(true);
  const [cartaoId, setCartaoId] = useState('');
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [faltando, setFaltando] = useState([]);
  const [erroValor, setErroValor] = useState('');

  useEffect(() => {
    if (!t.user?.id) return undefined;
    let vivo = true;
    (async () => {
      const lista = await listarCartoesDoSolicitante(t.user.id).catch(() => []);
      if (vivo) { setCartoes(lista); setLoadingCartoes(false); }
    })();
    return () => { vivo = false; };
  }, [t.user]);

  const cartao = cartoes.find((c) => c.id === cartaoId) || null;

  const onSubmit = async (e) => {
    e.preventDefault();
    t.setSucesso(null);
    setErroValor('');

    const falta = [];
    if (!cartaoId) falta.push('cartao');
    const novo = parseCurrency(valor);
    if (novo == null) falta.push('valor');
    setFaltando(falta);
    if (falta.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    // "Novo valor" é o limite TOTAL: precisa ser maior que o vigente.
    if (cartao && novo <= cartao.limite) {
      setErroValor(`O novo limite precisa ser maior que o atual (${formatarMoeda(cartao.limite)}).`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!t.aceite) { t.setTermosOpen(true); return; }

    await t.enviar({
      cartao_id: cartao.id,
      // Snapshot do cartão — as telas e o e-mail leem as colunas do próprio registro.
      nome_despesa: cartao.nome_despesa,
      centro_custo: cartao.centro_custo,
      aplicacao: cartao.aplicacao,
      vitalicio: cartao.vitalicio,
      periodo_inicio: cartao.periodo_inicio,
      periodo_fim: cartao.periodo_fim,
      valor: novo,
      observacao: observacao.trim() || null,
    }, () => { setCartaoId(''); setValor(''); setObservacao(''); });
  };

  const erro = (id) => faltando.includes(id);
  const Icon = sol.icon;

  // Botão só habilita com cartão escolhido, novo valor informado e termos aceitos.
  // (A regra "novo valor > limite atual" continua validada no submit, com mensagem.)
  const podeEnviar = !!t.aceite && !!cartaoId && parseCurrency(valor) != null && !t.semFluxo;

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-header-title"><Icon size={18} /> {sol.curto}</div>
      </div>

      <form onSubmit={onSubmit} style={{ padding: 'var(--space-xl)' }}>
        {t.sucesso && (
          <div className="fin-success" style={{ marginBottom: 'var(--space-lg)' }}>
            <Check size={16} /> Solicitação {t.sucesso.numero != null ? `#${t.sucesso.numero} ` : ''}enviada com sucesso!
          </div>
        )}
        {(faltando.length > 0 || erroValor) && (
          <div className="fin-aviso" style={{ marginBottom: 'var(--space-lg)' }}>
            {erroValor || 'Preencha os campos obrigatórios destacados.'}
          </div>
        )}

        {/* Sem cartão ativo não há o que aumentar. */}
        {!loadingCartoes && cartoes.length === 0 ? (
          <div className="fin-construcao" style={{ marginTop: 0 }}>
            <Inbox size={28} />
            <strong>Você não tem cartões ativos</strong>
            <span>
              O aumento de limite se aplica a um cartão já existente. Abra uma{' '}
              <Link to="/financeiro/solicitacoes/nova/cartao-virtual">Solicitação de Cartão Virtual</Link> primeiro.
            </span>
          </div>
        ) : (
          <>
            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">Cartão <span className="required">*</span></label>
              <SearchSelect
                value={cartaoId}
                onChange={setCartaoId}
                disabled={loadingCartoes}
                placeholder={loadingCartoes ? 'Carregando seus cartões...' : 'Selecione o cartão...'}
                options={cartoes.map((c) => ({
                  value: c.id,
                  label: `#${c.numero} · ${c.nome_despesa} — ${formatarMoeda(c.limite)}`,
                }))}
              />
              {erro('cartao') && <span className="fin-erro-campo">Selecione o cartão</span>}
            </div>

            {/* Dados que vêm do cartão — não são digitados */}
            {cartao && (
              <div className="fin-cartao-box">
                <div className="fin-cartao-head"><CreditCard size={15} /> Dados do cartão selecionado</div>
                <div className="fin-sol-grid" style={{ margin: 0 }}>
                  <div><span>Limite atual</span><strong>{formatarMoeda(cartao.limite)}</strong></div>
                  <div><span>Centro de custo</span><strong>{cartao.centro_custo || '—'}</strong></div>
                  <div><span>Vigência</span><strong>{vigenciaDe(cartao)}</strong></div>
                  <div>
                    <span>Aplicação</span>
                    <strong>{Array.isArray(cartao.aplicacao) && cartao.aplicacao.length ? cartao.aplicacao.join(', ') : '—'}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">Novo valor (R$) <span className="required">*</span></label>
              <CurrencyInput value={valor} onChange={setValor} placeholder="0,00" />
              <span className="fin-hint">
                Limite total que o cartão passará a ter{cartao ? ` (hoje: ${formatarMoeda(cartao.limite)})` : ''}.
              </span>
              {erro('valor') && <span className="fin-erro-campo">Obrigatório</span>}
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">Observação</label>
              <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Justifique o aumento (opcional)"
                value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>

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
          </>
        )}
      </form>
    </div>
  );
}
