import FormMobilizacao from './FormMobilizacao';
import { inicialMobilizacao as inicialMob, validarMobilizacao as validarMob } from './mobilizacao';
import FormSaudeSeguranca from './FormSaudeSeguranca';
import { inicialSaudeSeguranca as inicialSS, validarSaudeSeguranca as validarSS } from './saudeSeguranca';
import FormSchema from './FormSchema';
import { SCHEMAS, inicialDoSchema, schemaUsaPessoa } from './schemas';
import { validarCamposExtras } from '../../../lib/camposExtras';

// Os três serviços de Saúde e segurança dividem o mesmo componente; o serviço
// é que decide quais campos aparecem e o que é exigido.
const saudeSeguranca = (servico) => ({
  Componente: FormSaudeSeguranca,
  estadoInicial: inicialSS,
  validar: (v) => validarSS(v, servico),
});

// Serviço declarado em schemas.js: mesmo componente, mesma validação, muda só
// a tabela de campos. Gerado a partir do próprio esquema para não haver
// registro esquecido nem esquema órfão.
const porSchema = (schema) => ({
  Componente: FormSchema,
  estadoInicial: () => inicialDoSchema(schema),
  validar: (v) => validarCamposExtras(schema, v),
  precisaPessoas: schemaUsaPessoa(schema),
});

/**
 * Serviços com formulário próprio.
 *
 * Dois grupos: os DECLARATIVOS (schemas.js), que são a maioria, e os que têm
 * lógica condicional demais para caber numa tabela — mobilização (marcadores e
 * campos que somem conforme o movimento) e saúde e segurança (o tipo é lista
 * num serviço e texto no outro).
 *
 * A chave é o par classe/serviço, como no resto do módulo.
 */
export const FORMS_SERVICO = {
  ...Object.fromEntries(Object.entries(SCHEMAS).map(([chave, schema]) => [chave, porSchema(schema)])),

  // Um serviço só cobre nova mobilização, movimentação e desmobilização — o
  // seletor dentro do formulário decide quais campos aparecem.
  'mobilizacao/mobilizacao': {
    Componente: FormMobilizacao, estadoInicial: inicialMob, validar: validarMob, precisaPessoas: true,
  },
  'saude-seguranca/epi': saudeSeguranca('epi'),
  'saude-seguranca/uniforme': saudeSeguranca('uniforme'),
  'saude-seguranca/outras-demandas': saudeSeguranca('outras'),
};

export const formDoServico = (classe, servico) => FORMS_SERVICO[`${classe}/${servico}`] || null;
