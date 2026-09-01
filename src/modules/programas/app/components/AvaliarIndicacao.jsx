import { useState } from 'react';
import { Check, Loader2, Mail, X } from 'lucide-react';
import {
  ELEGIBILIDADE_LABEL, PREMIO_PERCENTUAL, PREMIO_TETO, STATUS_ALAVANCA, calcularPremio,
} from '../../../../config/programas';

/**
 * Avaliação da indicação pelo time comercial: status, comentário e premiação
 * num formulário só, dentro do popup de detalhe (aba "Avaliação").
 *
 * Antes as três coisas eram editadas em lugares diferentes — o status num
 * <select> na linha, o comentário numa caixa que abria na célula, o valor num
 * diálogo que só existia para concluir. Cada uma gravava sozinha, e cada
 * gravação de status mandava um e-mail: quem indicou recebia três avisos de uma
 * mesma sentada de trabalho, e o comentário (que é o que explica a decisão)
 * chegava depois do status que ele explicava.
 *
 * Agora é uma edição, um salvar, um e-mail — com o comentário já dentro dele.
 *
 * Mora ao lado de EditarIndicacao e tem a mesma forma (formulário sem casca,
 * botões no próprio fim): são as duas metades da mesma indicação — o autor
 * corrige o que escreveu, o comercial registra o que decidiu — e o popup as
 * abre do mesmo jeito.
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

export default function AvaliarIndicacao({ indicacao, salvando, erro, onCancelar, onSalvar }) {
  const [status, setStatus] = useState(indicacao.status);
  const [elegibilidade, setElegibilidade] = useState(indicacao.elegibilidade);
  const [motivo, setMotivo] = useState(indicacao.elegibilidade_motivo || '');
  const [comentario, setComentario] = useState(indicacao.comentario || '');
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

  const concluindo = status === 'concluida';
  // Só a conclusão exige valor (regra do programa e CHECK do banco). Nos outros
  // status o valor fica editável do mesmo jeito: contrato assinado e prêmio
  // acertado costumam ser sabidos antes de alguém lembrar de fechar a linha.
  const faltaPremio = concluindo && !valorPremio;

  // Trocar o veredito da máquina OBRIGA a reescrever a explicação. O motivo
  // guardado é a frase que a checagem automática escreveu, e o e-mail a mostra
  // como "Motivo:" — mantida sob um veredito novo, ela argumentaria contra a
  // própria decisão para quem indicou.
  const trocouElegibilidade = elegibilidade !== indicacao.elegibilidade;
  const motivoIntocado = motivo.trim() === (indicacao.elegibilidade_motivo || '').trim();
  const faltaMotivo = trocouElegibilidade && (!motivo.trim() || motivoIntocado);

  const trocarContrato = (e) => {
    setContrato(e.target.value);
    if (!premioManual) {
      const novo = calcularPremio(paraNumero(e.target.value));
      setPremio(novo != null ? String(novo) : '');
    }
  };

  const enviar = (e) => {
    e.preventDefault();
    if (faltaPremio || faltaMotivo || salvando) return;
    onSalvar({
      status, elegibilidade, motivo, comentario, valorContrato, valorPremio, pagoEm,
    });
  };

  return (
    <form onSubmit={enviar}>
      {erro && <div className="pg-aviso tom-erro"><X size={16} /> {erro}</div>}

      <div className="pg-campo">
        <label htmlFor="av_status">Status<span className="req">*</span></label>
        <select
          id="av_status" className="pg-select"
          value={status} onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_ALAVANCA.map((s) => (
            <option key={s.valor} value={s.valor}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* A elegibilidade é decidida pela checagem automática no envio (ver
          lib/elegibilidade.js) — aqui ela é SOBREPOSIÇÃO, não preenchimento. É
          o que destrava "Depende do comercial": a máquina não sabe se a
          oportunidade já tinha sido mapeada, e sem este campo a indicação
          ficava nesse estado para sempre, com o painel pedindo uma confirmação
          que não existia em lugar nenhum. */}
      <div className="pg-campo">
        <label htmlFor="av_elegibilidade">Elegibilidade<span className="req">*</span></label>
        <select
          id="av_elegibilidade" className="pg-select"
          value={elegibilidade} onChange={(e) => setElegibilidade(e.target.value)}
        >
          {Object.entries(ELEGIBILIDADE_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </select>
        {indicacao.elegibilidade === 'em_analise' && !trocouElegibilidade && (
          <p className="pg-campo-dica tom-atencao">
            A empresa já está na base, mas o contato é novo. Vale se a oportunidade ainda não
            tiver sido mapeada — essa é a parte que só o comercial sabe.
          </p>
        )}
      </div>

      <div className="pg-campo">
        <label htmlFor="av_motivo">
          Por que esta elegibilidade
          {trocouElegibilidade ? <span className="req">*</span> : <span className="opc">(opcional)</span>}
        </label>
        <textarea
          id="av_motivo" className="pg-textarea"
          value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Explique a decisão — quem indicou lê isto no e-mail."
        />
        {faltaMotivo ? (
          <p className="pg-campo-dica tom-atencao">
            Você mudou a elegibilidade: reescreva o motivo. O texto atual é o da checagem
            automática e explicaria o veredito anterior.
          </p>
        ) : (
          <p className="pg-campo-dica">
            Preenchido pela checagem automática no envio. Trocar a elegibilidade acima obriga a
            reescrever.
          </p>
        )}
      </div>

      <div className="pg-campo">
        <label htmlFor="av_comentario">Comentário<span className="opc">(opcional)</span></label>
        <textarea
          id="av_comentario" className="pg-textarea"
          value={comentario} onChange={(e) => setComentario(e.target.value)}
          placeholder="Explique o andamento — é o que quem indicou vai ler no e-mail."
        />
      </div>

      <div className="pg-campo">
        <label htmlFor="av_contrato">Valor do contrato<span className="opc">(opcional)</span></label>
        <span className="pg-prefixado">
          <span className="pg-prefixo">R$</span>
          <input
            id="av_contrato" className="pg-input" inputMode="decimal"
            value={contrato} onChange={trocarContrato} placeholder="1.000.000,00"
          />
        </span>
        <p className="pg-campo-dica">
          Premiação pela regra: {(PREMIO_PERCENTUAL * 100).toLocaleString('pt-BR')}% do contrato,
          limitada a {dinheiro(PREMIO_TETO)}.
        </p>
      </div>

      <div className="pg-campo">
        <label htmlFor="av_premio">
          Valor da premiação
          {concluindo ? <span className="req">*</span> : <span className="opc">(opcional)</span>}
        </label>
        <span className="pg-prefixado">
          <span className="pg-prefixo">R$</span>
          <input
            id="av_premio" className="pg-input" inputMode="decimal"
            value={premio}
            onChange={(e) => { setPremioManual(true); setPremio(e.target.value); }}
            placeholder="5.000,00"
          />
        </span>
        {noTeto && <p className="pg-campo-dica">O cálculo bateu no teto: {dinheiro(PREMIO_TETO)}.</p>}
        {faltaPremio && (
          <p className="pg-campo-dica tom-atencao">
            Concluir exige o valor da premiação — é a regra do programa e o banco recusa sem ele.
          </p>
        )}
      </div>

      <div className="pg-campo">
        <label htmlFor="av_pago_em">Data de pagamento<span className="opc">(opcional)</span></label>
        <input
          id="av_pago_em" type="date" className="pg-input"
          value={pagoEm} onChange={(e) => setPagoEm(e.target.value)}
        />
        {/* A regra manda pagar depois do faturamento da 1ª medição — quase
            sempre em outra data. Deixar em branco agora é o normal. */}
        <p className="pg-campo-dica">
          O pagamento se dá após o faturamento da primeira medição. Deixe em branco se ainda
          não houver data; a indicação entra no mapa de vencedores como “A pagar”.
        </p>
      </div>

      {/* O e-mail é consequência do salvar, e quem salva precisa saber disso
          ANTES de clicar — não depois, quando já saiu. */}
      <p className="pg-aviso tom-atencao">
        <Mail size={16} />
        <span>
          Ao salvar, <strong>{indicacao.indicadorNome || 'quem indicou'}</strong> recebe um
          e-mail com a elegibilidade, o status, o comentário e os valores acima.
        </span>
      </p>

      <div className="pg-editar-acoes">
        <button type="button" className="pg-btn pg-btn-ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
        <button
          type="submit" className="pg-btn pg-btn-primary"
          disabled={faltaPremio || faltaMotivo || salvando}
        >
          {salvando
            ? <><Loader2 size={16} className="pg-spin" /> Salvando…</>
            : <><Check size={16} /> Salvar e avisar</>}
        </button>
      </div>
    </form>
  );
}
