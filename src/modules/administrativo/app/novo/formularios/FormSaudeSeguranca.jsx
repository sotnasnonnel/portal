import { MOTIVOS } from './saudeSeguranca';
import SeletorPedido from '../../../../estoque/app/components/SeletorPedido';

/**
 * EPI, uniforme e outras demandas de Saúde e segurança. É o pedido AVULSO —
 * quem está sendo mobilizado pede esses itens dentro da própria mobilização.
 *
 * EPI e uniforme escolhem itens do CATÁLOGO DO ESTOQUE, com quantidade. Antes,
 * o EPI era uma lista de rótulos sem quantidade e o uniforme era texto livre
 * ("2 camisas polo M") — com isso o Administrativo não conseguia saber se tinha
 * o item nem descontar do saldo ao entregar. O saldo aparece ao lado de cada
 * item, mas não bloqueia: pedir o que está em falta é o que sinaliza a compra.
 *
 * Descrição e anexos não aparecem aqui: são os campos do chamado, logo abaixo.
 */
export default function FormSaudeSeguranca({ valores, onChange, servico }) {
  const mexer = (patch) => onChange({ ...valores, ...patch });
  const eEpi = servico === 'epi';
  const eUniforme = servico === 'uniforme';

  return (
    <>
      <div className="adm-campo">
        <label htmlFor="ss-cc">Centro de custo<span className="req">*</span></label>
        <input id="ss-cc" className="adm-input" value={valores.cc}
          onChange={(e) => mexer({ cc: e.target.value })} />
      </div>

      {(eEpi || eUniforme) && (
        <>
          <div className="adm-campo">
            <label>{eEpi ? 'EPIs' : 'Peças de uniforme'}<span className="req">*</span></label>
            <SeletorPedido
              itens={valores.itens || []}
              categoria={eEpi ? 'epi' : 'uniforme'}
              onMudar={(itens) => mexer({ itens })}
            />
            <span className="adm-campo-dica">
              Escolha o item e a quantidade. Não achou o que precisa? Descreva no campo de
              descrição, logo abaixo, que o Administrativo cadastra.
            </span>
          </div>

          <div className="adm-campo">
            <label>Motivo<span className="req">*</span></label>
            <div className="adm-radios">
              {MOTIVOS.map((m) => (
                <button key={m} type="button"
                  className={`adm-chip ${valores.motivo === m ? 'is-on' : ''}`}
                  onClick={() => mexer({ motivo: m })}
                  aria-pressed={valores.motivo === m}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="adm-campo">
            <label htmlFor="ss-local">Localização</label>
            <input id="ss-local" className="adm-input" value={valores.localizacao}
              onChange={(e) => mexer({ localizacao: e.target.value })}
              placeholder="Obra, sede ou alojamento onde o item será usado" />
          </div>
        </>
      )}

      {/* Observação só existe em "Outras demandas" na planilha; em EPI e
          uniforme o que há é a Descrição da necessidade, que é a descrição do
          próprio chamado. */}
      {!eEpi && !eUniforme && (
        <div className="adm-campo">
          <label htmlFor="ss-obs">Observação</label>
          <input id="ss-obs" className="adm-input" value={valores.observacao}
            onChange={(e) => mexer({ observacao: e.target.value })} />
        </div>
      )}
    </>
  );
}
