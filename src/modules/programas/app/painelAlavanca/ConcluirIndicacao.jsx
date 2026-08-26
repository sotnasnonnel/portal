import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import {
  PREMIO_PERCENTUAL, PREMIO_TETO, calcularPremio,
} from '../../../../config/programas';

/**
 * Diálogo de conclusão da indicação.
 *
 * Existe porque concluir sem valor de prêmio é impossível ("mandatório inserir
 * valor a ser pago para quem cadastrou", e o CHECK do banco cobra o mesmo).
 * Pelo <select> do mapa, a conclusão gravaria pela metade e explodiria no banco.
 *
 * O prêmio é CALCULADO a partir do contrato (0,5%, teto de R$ 10.000), mas
 * continua editável: quando o valor efetivo diverge da regra, ganha o que o
 * comercial digitou — a tela não pode impedir de registrar o que foi pago.
 */
const dinheiro = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const paraNumero = (texto) => {
  const limpo = String(texto ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function ConcluirIndicacao({ indicacao, salvando, onFechar, onConfirmar }) {
  const [contrato, setContrato] = useState(
    indicacao.valor_contrato != null ? String(indicacao.valor_contrato) : ''
  );
  const [premio, setPremio] = useState(
    indicacao.valor_premio != null ? String(indicacao.valor_premio) : ''
  );
  const [pagoEm, setPagoEm] = useState(indicacao.pago_em || '');
  // Enquanto o comercial não mexe no prêmio, ele acompanha o contrato. Depois
  // de editado, para de acompanhar — senão o valor digitado seria sobrescrito
  // a cada tecla no campo do contrato.
  const [premioManual, setPremioManual] = useState(indicacao.valor_premio != null);

  const valorContrato = paraNumero(contrato);
  const sugerido = calcularPremio(valorContrato);
  const valorPremio = premioManual ? paraNumero(premio) : sugerido;
  const noTeto = sugerido != null && sugerido >= PREMIO_TETO;

  const trocarContrato = (e) => {
    setContrato(e.target.value);
    if (!premioManual) {
      const novo = calcularPremio(paraNumero(e.target.value));
      setPremio(novo != null ? String(novo) : '');
    }
  };

  return (
    <div className="pg-modal-overlay" onClick={onFechar}>
      <div
        className="pg-modal" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Concluir indicação"
      >
        <div className="pg-modal-cab">
          <h2>Concluir indicação #{indicacao.numero}</h2>
          <button type="button" className="pg-modal-x" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="pg-modal-corpo">
          <p className="pg-campo-dica" style={{ marginBottom: 14 }}>
            Contrato firmado com <strong>{indicacao.empresa}</strong>, indicado por{' '}
            <strong>{indicacao.indicadorNome || 'colaborador não identificado'}</strong>. O valor da
            premiação é obrigatório para concluir.
          </p>

          <div className="pg-campo">
            <label htmlFor="valor_contrato">Valor do contrato<span className="req">*</span></label>
            <span className="pg-prefixado">
              <span className="pg-prefixo">R$</span>
              <input
                id="valor_contrato" className="pg-input" inputMode="decimal"
                value={contrato} onChange={trocarContrato} placeholder="1.000.000,00"
              />
            </span>
            <p className="pg-campo-dica">
              Premiação pela regra: {(PREMIO_PERCENTUAL * 100).toLocaleString('pt-BR')}% do contrato,
              limitada a {dinheiro(PREMIO_TETO)}.
            </p>
          </div>

          <div className="pg-campo">
            <label htmlFor="valor_premio">Valor da premiação<span className="req">*</span></label>
            <span className="pg-prefixado">
              <span className="pg-prefixo">R$</span>
              <input
                id="valor_premio" className="pg-input" inputMode="decimal"
                value={premio}
                onChange={(e) => { setPremioManual(true); setPremio(e.target.value); }}
                placeholder="5.000,00"
              />
            </span>
            {noTeto && (
              <p className="pg-campo-dica">
                O cálculo bateu no teto: {dinheiro(PREMIO_TETO)}.
              </p>
            )}
          </div>

          <div className="pg-campo">
            <label htmlFor="pago_em">Data de pagamento<span className="opc">(opcional)</span></label>
            <input
              id="pago_em" type="date" className="pg-input"
              value={pagoEm} onChange={(e) => setPagoEm(e.target.value)}
            />
            {/* A regra manda pagar depois do faturamento da 1ª medição — quase
                sempre em outra data. Deixar em branco agora é o normal. */}
            <p className="pg-campo-dica">
              O pagamento se dá após o faturamento da primeira medição. Deixe em branco se ainda
              não houver data; a indicação entra no mapa de vencedores como “A pagar”.
            </p>
          </div>
        </div>

        <div className="pg-modal-pe">
          <button type="button" className="pg-btn pg-btn-ghost" onClick={onFechar}>Cancelar</button>
          <button
            type="button" className="pg-btn pg-btn-primary"
            disabled={!valorPremio || salvando}
            onClick={() => onConfirmar({ valorContrato, valorPremio, pagoEm })}
          >
            {salvando
              ? <><Loader2 size={16} className="pg-spin" /> Salvando…</>
              : <><Check size={16} /> Concluir com {dinheiro(valorPremio)}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
