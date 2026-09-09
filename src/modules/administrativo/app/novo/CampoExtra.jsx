import { Check } from 'lucide-react';
import SearchSelect from '../../../../components/UI/SearchSelect';

// Tipos com desenho próprio. O que não estiver aqui cai no input de texto, para
// um tipo desconhecido (cadastro antigo, por exemplo) não sumir da tela.
const COM_DESENHO_PROPRIO = [
  'texto_longo', 'numero', 'data', 'hora', 'datahora', 'selecao', 'selecao_multipla', 'sim_nao', 'pessoa',
];

/**
 * Desenha um campo a partir da definição — venha ela do cadastro do Adm
 * (campos extras) ou do esquema em código de um serviço (schemas.js).
 *
 * É o ponto único de renderização de campo do módulo: assim os 22 serviços
 * ficam idênticos entre si sem ninguém precisar repetir estilo e marcação.
 */
export default function CampoExtra({ campo, valor, onChange, pessoas = [] }) {
  const id = `extra-${campo.chave}`;
  const comum = {
    id,
    value: valor ?? '',
    onChange: (e) => onChange(campo.chave, e.target.value),
  };

  // Múltipla escolha tem marcação própria: são vários botões, e um <label
  // htmlFor> não aponta para um controle só. O grupo é rotulado pelo texto.
  if (campo.tipo === 'selecao_multipla') {
    const marcados = Array.isArray(valor) ? valor : [];
    const alternar = (o) => onChange(
      campo.chave,
      marcados.includes(o) ? marcados.filter((v) => v !== o) : [...marcados, o],
    );
    return (
      <div className="adm-campo" role="group" aria-labelledby={`${id}-rot`}>
        <span className="adm-campo-rotulo" id={`${id}-rot`}>
          {campo.rotulo}
          {campo.obrigatorio && <span className="req">*</span>}
        </span>
        <div className="adm-opcoes">
          {(campo.opcoes || []).map((o) => {
            const marcado = marcados.includes(o);
            return (
              <button
                key={o}
                type="button"
                className={`adm-chip ${marcado ? 'is-on' : ''}`}
                aria-pressed={marcado}
                onClick={() => alternar(o)}
              >
                {marcado && <Check size={13} />}
                {o}
              </button>
            );
          })}
        </div>
        <span className="adm-campo-dica">Pode marcar mais de um.</span>
      </div>
    );
  }

  return (
    <div className="adm-campo">
      <label htmlFor={id}>
        {campo.rotulo}
        {campo.obrigatorio && <span className="req">*</span>}
      </label>

      {campo.tipo === 'texto_longo' && <textarea className="adm-textarea adm-textarea-curto" {...comum} />}
      {campo.tipo === 'numero' && (campo.formato === 'moeda' ? (
        // Prefixo dentro do campo: o rótulo não precisa carregar "(R$)", e na
        // leitura o valor já sai formatado como moeda.
        <span className="adm-prefixado">
          <span className="adm-prefixo">R$</span>
          <input type="number" step="0.01" min="0" className="adm-input" {...comum} />
        </span>
      ) : (
        <input type="number" className="adm-input" {...comum} />
      ))}
      {campo.tipo === 'data' && <input type="date" className="adm-input" {...comum} />}
      {campo.tipo === 'hora' && <input type="time" className="adm-input" {...comum} />}
      {campo.tipo === 'datahora' && <input type="datetime-local" className="adm-input" {...comum} />}

      {/* Toda pessoa no módulo é escolhida do mesmo jeito: seletor com busca. */}
      {campo.tipo === 'pessoa' && (
        <SearchSelect
          value={valor ?? ''}
          onChange={(v) => onChange(campo.chave, v)}
          options={pessoas.map((p) => ({ value: p.id, label: p.nome }))}
          placeholder="Busque pelo nome…"
          ariaLabel={campo.rotulo}
        />
      )}

      {campo.tipo === 'selecao' && (
        <select className="adm-select" {...comum}>
          <option value="">Selecione…</option>
          {(campo.opcoes || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {campo.tipo === 'sim_nao' && (
        <select className="adm-select" {...comum}>
          <option value="">Selecione…</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      )}

      {!COM_DESENHO_PROPRIO.includes(campo.tipo) && (
        <input type="text" className="adm-input" {...comum} />
      )}
    </div>
  );
}
