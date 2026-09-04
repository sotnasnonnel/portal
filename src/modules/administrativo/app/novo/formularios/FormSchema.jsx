import { Fragment } from 'react';
import CampoExtra from '../CampoExtra';
import { schemaDoServico } from './schemas';

/**
 * Desenha o formulário de um serviço a partir do esquema declarado em
 * schemas.js. Um componente só para os 22 serviços transcritos da planilha —
 * o que muda entre eles é dado, não código.
 *
 * Campos com `grupo` ganham um subtítulo, para um bloco de campos do mesmo
 * assunto não se confundir com o resto da lista.
 */

const TITULO_GRUPO = {
  condutor: 'Documentos do condutor',
};

const DICA_GRUPO = {
  condutor: 'A locadora confere a CNH na retirada — vencida, o carro não sai.',
};

export default function FormSchema({ valores, onChange, pessoas = [], classe, servico, travarCc = false }) {
  const schema = schemaDoServico(classe, servico) || [];
  const mexer = (chave, valor) => onChange({ ...valores, [chave]: valor });

  return schema.map((campo, i) => {
    // Cabeçalho no PRIMEIRO campo do grupo: o esquema é uma lista plana, e
    // aninhar os campos só para desenhar um título tornaria o dado mais
    // complicado do que a tela que ele descreve.
    const abreGrupo = campo.grupo && campo.grupo !== schema[i - 1]?.grupo;

    // Fragmento, e não <div> em volta: os campos são irmãos diretos do cartão
    // (é o que faz `.adm-campo:last-child` zerar a margem do último), e
    // embrulhá-los zeraria a margem de todos.
    return (
      <Fragment key={campo.chave}>
        {abreGrupo && (
          <div className="adm-grupo-cab">
            <h3>{TITULO_GRUPO[campo.grupo] || campo.grupo}</h3>
            {DICA_GRUPO[campo.grupo] && <p>{DICA_GRUPO[campo.grupo]}</p>}
          </div>
        )}
        <CampoExtra
          campo={campo}
          valor={valores[campo.chave]}
          onChange={mexer}
          pessoas={pessoas}
          travado={travarCc && campo.chave === 'cc'}
        />
      </Fragment>
    );
  });
}
