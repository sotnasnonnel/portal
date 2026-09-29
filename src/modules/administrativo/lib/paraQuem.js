// Para quem é o chamado — o `colaborador_id` dele.
//
// É essa pessoa que o banco confronta com a Folga de Campo e a Ausência
// Programada: se ela estiver fora, o chamado mostra o período e o SLA só começa
// na volta (supabase_migration_administrativo_colaborador_ausente.sql).
//
// Serviço que já pergunta a pessoa no próprio formulário (o profissional da
// mobilização, o passageiro, o hóspede) não pergunta de novo: seriam duas
// respostas para a mesma pergunta, e elas poderiam divergir.

import { schemaDoServico } from '../app/novo/formularios/schemas.js';

export const PARA_MIM = 'mim';
export const PARA_OUTRA = 'outra';

/** Chave do formulário que já diz quem é a pessoa, ou null. */
export function chavePessoaDoServico(classe, servico) {
  if (classe === 'mobilizacao' && servico === 'mobilizacao') return 'profissional_id';
  const temPessoa = (schemaDoServico(classe, servico) || []).some((c) => c.chave === 'pessoa_id');
  return temPessoa ? 'pessoa_id' : null;
}

export const perguntaParaQuem = (classe, servico) => !chavePessoaDoServico(classe, servico);

export function colaboradorDoChamado({
  classe, servico, campos = {}, paraQuem = PARA_MIM, outraPessoaId = '', solicitanteId,
}) {
  const chave = chavePessoaDoServico(classe, servico);
  if (chave) return campos?.[chave] || null;
  if (paraQuem === PARA_OUTRA) return outraPessoaId || null;
  return solicitanteId || null;
}

export function validarParaQuem({ classe, servico, paraQuem, outraPessoaId }) {
  if (!perguntaParaQuem(classe, servico)) return '';
  if (paraQuem === PARA_OUTRA && !outraPessoaId) return 'Escolha para quem é o chamado.';
  return '';
}
