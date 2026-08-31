import { MOTIVOS } from './saudeSeguranca';
import SeletorPedido from '../../../../estoque/app/components/SeletorPedido';

/**
 * EPI, uniforme e outras demandas de Saúde e segurança. É o pedido AVULSO —
 * quem está sendo mobilizado pede esses itens dentro da própria mobilização.
 *
 * O pedido tem DOIS caminhos, e eles convivem de propósito:
 *
 *  · CATÁLOGO — escolher a variação e a quantidade. É o que permite ao Adm ver
 *    o saldo ao lado do pedido e dar baixa ao entregar. O saldo aparece, mas
 *    NUNCA bloqueia: pedir o que está em falta é o que sinaliza a compra.
 *
 *  · TEXTO LIVRE — para o que não está cadastrado. Enquanto o almoxarifado não
 *    terminar o catálogo (ou quando o item simplesmente não existe lá), é por
 *    aqui que o pedido passa. Preencher um dos dois basta.
 *
 * O estado do estoque não pode impedir alguém de pedir EPI. Essa é a regra que
 * decide o desenho desta tela.
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
            <label>{eEpi ? 'EPIs do catálogo' : 'Peças do catálogo'}</label>
            <SeletorPedido
              itens={valores.itens || []}
              categoria={eEpi ? 'epi' : 'uniforme'}
              onMudar={(itens) => mexer({ itens })}
            />
            <span className="adm-campo-dica">
              A quantidade em estoque aparece ao lado de cada item — é só informação,
              não impede o pedido.
            </span>
          </div>

          <div className="adm-campo">
            <label htmlFor="ss-unif">
              {eEpi ? 'Outros EPIs (não achou no catálogo?)' : 'Outras peças e tamanhos'}
            </label>
            <textarea id="ss-unif" className="adm-textarea adm-textarea-curto"
              value={valores.tipo_livre}
              placeholder={eEpi
                ? 'Ex.: 1 luva anticorte tamanho 9'
                : 'Ex.: 2 camisas polo M, 1 blusão G'}
              onChange={(e) => mexer({ tipo_livre: e.target.value })} />
            <span className="adm-campo-dica">
              Descreva aqui o que não estiver na lista acima. Preencher o catálogo
              <strong> ou </strong> este campo já basta para abrir o chamado.
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
