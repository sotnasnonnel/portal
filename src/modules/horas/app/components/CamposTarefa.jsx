import {
  CAMPOS,
  SELECAO_VAZIA,
  opcoesDe,
  aplicarSelecao,
  campoBloqueado,
} from '../../lib/catalogoTarefas';
import SearchableSelect from './SearchableSelect';

// Os 4 dropdowns fixos do apontamento (Sigla · Tarefa · Etiqueta · Tarefa 2).
// Vêm do catálogo da empresa; quem manda na cadeia de filtro é o
// lib/catalogoTarefas, aqui é só a tela. Usado pelo cronômetro e pelo lançamento
// manual, para os dois não saírem do ar um do outro.
//  - valor: { sigla, tarefa, etiqueta, tarefa2 }
//  - onChange(novaSelecao): já vem reconciliada (ex.: trocar a sigla limpa a
//    tarefa que não pertence mais a ela).
// Campo filtrado por outro nasce BLOQUEADO: sem a sigla não dá para saber quais
// tarefas oferecer, então o dropdown só abre depois dela.
export default function CamposTarefa({ valor = SELECAO_VAZIA, onChange, disabled = false }) {
  const opcoes = opcoesDe(valor);
  const rotulo = (chave) => CAMPOS.find((c) => c.chave === chave)?.label || chave;

  return (
    <>
      {CAMPOS.map(({ chave, label, dependeDe }) => {
        const bloqueado = campoBloqueado(valor, chave);
        return (
          <div className={`horas-fld${chave === 'tarefa' ? ' horas-fld-largo' : ''}`} key={chave}>
            <label>{label}</label>
            <SearchableSelect
              value={valor[chave] || ''}
              disabled={disabled || bloqueado}
              placeholder={
                bloqueado
                  ? `Selecione ${rotulo(dependeDe).toLowerCase()} primeiro…`
                  : `Selecione ${label.toLowerCase()}…`
              }
              onChange={(v) => onChange(aplicarSelecao(valor, chave, v))}
              options={opcoes[chave].map((v) => ({ value: v, label: v }))}
            />
          </div>
        );
      })}
    </>
  );
}
