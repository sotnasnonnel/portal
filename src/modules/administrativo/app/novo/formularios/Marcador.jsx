import { ChevronDown, Check } from 'lucide-react';

/**
 * Marcador expansível: fechado é uma linha com o resumo, aberto mostra as
 * opções. É o "adicional" da mobilização — exames, treinamento, equipamento,
 * software, EPI.
 *
 * Fechado mostra a CONTAGEM do que foi marcado, não só o título: quem aprova
 * precisa ver o que foi pedido sem abrir cada bloco.
 */
export default function Marcador({
  titulo, dica, itens, valor, onChange, aberto, onToggle, textoLivre = false, placeholder,
}) {
  // Adicional cuja lista ainda não existe no portal (uniforme) entra como texto
  // livre em vez de ficar de fora: melhor o solicitante escrever do que abrir
  // um chamado à parte só para isso.
  const marcados = textoLivre ? (valor || '') : (valor || []);
  const preenchido = textoLivre ? !!marcados.trim() : marcados.length > 0;

  const alternarItem = (item) => {
    onChange(marcados.includes(item) ? marcados.filter((v) => v !== item) : [...marcados, item]);
  };

  return (
    <div className={`adm-marc ${aberto ? 'is-open' : ''}`}>
      <button type="button" className="adm-marc-cab" onClick={onToggle} aria-expanded={aberto}>
        <span className="adm-marc-tit">
          {titulo}
          {!textoLivre && preenchido && <span className="adm-marc-cont">{marcados.length}</span>}
        </span>
        {!aberto && preenchido && (
          <span className="adm-marc-resumo">{textoLivre ? marcados : marcados.join(', ')}</span>
        )}
        <ChevronDown className="adm-marc-chev" size={16} />
      </button>

      {aberto && (
        <div className="adm-marc-corpo">
          {dica && <p className="adm-campo-dica">{dica}</p>}
          {textoLivre ? (
            <textarea
              className="adm-textarea adm-textarea-curto"
              value={marcados}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <div className="adm-marc-itens">
              {itens.map((item) => {
                const marcado = marcados.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    className={`adm-chip ${marcado ? 'is-on' : ''}`}
                    onClick={() => alternarItem(item)}
                    aria-pressed={marcado}
                  >
                    {marcado && <Check size={13} />}
                    {item}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
