import { MOTIVOS } from './saudeSeguranca';
import { OPCOES_EPI } from './opcoes';
import { ESTOQUE_VITRINE } from '../../../../../config/estoqueModo';
import SeletorPedido from '../../../../estoque/app/components/SeletorPedido';

/**
 * EPI, uniforme e outras demandas de Saúde e segurança. É o pedido AVULSO —
 * quem está sendo mobilizado pede esses itens dentro da própria mobilização.
 *
 * O pedido tem DOIS formatos, e o interruptor é ESTOQUE_VITRINE:
 *
 *  · vitrine (hoje) — formato antigo: lista de EPIs por chip e texto livre para
 *    uniforme. É o que continua valendo enquanto o catálogo do Estoque não foi
 *    importado; com ele vazio, o formato novo não teria o que oferecer e
 *    ninguém conseguiria abrir o chamado.
 *
 *  · módulo ligado — itens do CATÁLOGO com quantidade, o que permite ao Adm
 *    conferir o saldo e dar baixa ao entregar. O saldo aparece ao lado de cada
 *    item mas NÃO bloqueia: pedir o que está em falta é o que sinaliza a compra.
 *
 * Os dois formatos convivem na leitura — chamado aberto num, exibido em ambos.
 *
 * Descrição e anexos não aparecem aqui: são os campos do chamado, logo abaixo.
 */
export default function FormSaudeSeguranca({ valores, onChange, servico }) {
  const mexer = (patch) => onChange({ ...valores, ...patch });
  const eEpi = servico === 'epi';
  const eUniforme = servico === 'uniforme';

  const alternarTipo = (item) => {
    const atual = valores.tipo || [];
    mexer({ tipo: atual.includes(item) ? atual.filter((t) => t !== item) : [...atual, item] });
  };

  return (
    <>
      <div className="adm-campo">
        <label htmlFor="ss-cc">Centro de custo<span className="req">*</span></label>
        <input id="ss-cc" className="adm-input" value={valores.cc}
          onChange={(e) => mexer({ cc: e.target.value })} />
      </div>

      {/* ---- formato antigo (modo vitrine) ---- */}
      {ESTOQUE_VITRINE && eEpi && (
        <div className="adm-campo">
          <label>EPIs<span className="req">*</span></label>
          <div className="adm-marc-itens">
            {OPCOES_EPI.map((item) => (
              <button key={item} type="button"
                className={`adm-chip ${(valores.tipo || []).includes(item) ? 'is-on' : ''}`}
                onClick={() => alternarTipo(item)}
                aria-pressed={(valores.tipo || []).includes(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {ESTOQUE_VITRINE && eUniforme && (
        <div className="adm-campo">
          <label htmlFor="ss-unif">Peças e tamanhos<span className="req">*</span></label>
          <textarea id="ss-unif" className="adm-textarea adm-textarea-curto"
            value={valores.tipo_livre} placeholder="Ex.: 2 camisas polo M, 1 blusão G"
            onChange={(e) => mexer({ tipo_livre: e.target.value })} />
          <span className="adm-campo-dica">
            A lista de uniformes ainda não está cadastrada no portal.
          </span>
        </div>
      )}

      {/* ---- formato novo (módulo de Estoque ligado) ---- */}
      {!ESTOQUE_VITRINE && (eEpi || eUniforme) && (
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
      )}

      {(eEpi || eUniforme) && (
        <>
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
