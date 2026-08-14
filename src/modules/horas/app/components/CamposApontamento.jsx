import SearchableSelect from './SearchableSelect';

// Os campos que a EQUIPE configurou em /horas/config/apontamento, renderizados
// no apontamento. Um só componente para o cronômetro e o lançamento manual, para
// os dois não saírem do ar um do outro.
//  - campos: [{ id, label, tipo, opcoes, obrigatorio }] (ver lib/camposEquipe)
//  - valores: { [campoId]: string }
//  - onChange(campoId, valor)
// Campo aqui é independente: não existe mais a cadeia em que um filtrava o outro
// (era regra do catálogo fixo, que a configuração livre não consegue expressar).
export default function CamposApontamento({ campos = [], valores = {}, onChange, disabled = false }) {
  return (
    <>
      {campos.map((c) => {
        const valor = valores[c.id] || '';
        return (
          <div className={`horas-fld${ehLargo(c) ? ' horas-fld-largo' : ''}`} key={c.id}>
            <label>
              {c.label}
              {c.obrigatorio ? null : <span className="horas-muted"> (opcional)</span>}
            </label>
            {c.tipo === 'texto' ? (
              <input
                type="text"
                value={valor}
                disabled={disabled}
                placeholder={`Digite ${c.label.toLowerCase()}…`}
                onChange={(e) => onChange(c.id, e.target.value)}
              />
            ) : (
              <SearchableSelect
                value={valor}
                disabled={disabled}
                placeholder={`Selecione ${c.label.toLowerCase()}…`}
                onChange={(v) => onChange(c.id, v)}
                options={opcoesCom(c, valor)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// Um cronômetro pode estar rodando com um valor que a equipe tirou da lista
// depois. Sem isto o combobox mostraria o placeholder, como se estivesse vazio.
function opcoesCom(campo, valor) {
  const opcoes = campo.opcoes.map((v) => ({ value: v, label: v }));
  if (valor && !campo.opcoes.includes(valor)) {
    opcoes.unshift({ value: valor, label: `${valor} (fora da lista atual)` });
  }
  return opcoes;
}

// Lista com opções longas (ex.: nomes de tarefa de ~80 caracteres) ocupa duas
// colunas do grid para não sair cortada.
const ehLargo = (campo) => campo.opcoes.some((o) => o.length > 40);
