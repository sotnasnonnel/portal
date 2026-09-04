import { Fragment } from 'react';
import { UserCheck } from 'lucide-react';
import CampoExtra from '../CampoExtra';
import { schemaDoServico } from './schemas';

/**
 * Desenha o formulário de um serviço a partir do esquema declarado em
 * schemas.js. Um componente só para os 22 serviços transcritos da planilha —
 * o que muda entre eles é dado, não código.
 *
 * Campos com `grupo` ganham um subtítulo e, quando o grupo tem atalho de
 * autopreenchimento (hoje só o condutor), o botão "Sou eu mesmo".
 */

const TITULO_GRUPO = {
  condutor: 'Quem vai dirigir',
};

const DICA_GRUPO = {
  condutor: 'A locadora emite o contrato no nome do condutor e confere a CNH na retirada.',
};

/**
 * O que o portal consegue preencher sozinho: nome e e-mail, que são o cadastro
 * de colaboradores. CPF e CNH não existem em lugar nenhum aqui, então continuam
 * digitados — preencher metade e avisar é melhor do que não oferecer o atalho.
 */
const EU_PREENCHE = {
  condutor: (eu) => ({ condutor_nome: eu.nome || '', condutor_email: eu.email || '' }),
};

export default function FormSchema({
  valores, onChange, pessoas = [], classe, servico, travarCc = false, eu = null,
}) {
  const schema = schemaDoServico(classe, servico) || [];
  const mexer = (chave, valor) => onChange({ ...valores, [chave]: valor });

  const souEu = (grupo) => onChange({ ...valores, ...EU_PREENCHE[grupo](eu) });

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
            <div>
              <h3>{TITULO_GRUPO[campo.grupo] || campo.grupo}</h3>
              {DICA_GRUPO[campo.grupo] && <p>{DICA_GRUPO[campo.grupo]}</p>}
            </div>
            {eu && EU_PREENCHE[campo.grupo] && (
              <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm"
                onClick={() => souEu(campo.grupo)}>
                <UserCheck size={15} /> Sou eu mesmo
              </button>
            )}
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
