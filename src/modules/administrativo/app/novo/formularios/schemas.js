/**
 * Campos de cada serviço, transcritos de referencia/Exemplo.rev.xlsx.
 *
 * São DADOS, não componentes: um renderizador só desenha todos, então os 22
 * serviços saem iguais entre si e ninguém precisa lembrar de repetir estilo,
 * validação ou ordem. Mobilização e Saúde e segurança ficam de fora porque têm
 * lógica condicional (marcadores, campos que somem) que não cabe em tabela.
 *
 * Convenções, aplicadas a todos:
 * - A "Descrição" que aparece nas abas é a DESCRIÇÃO DO CHAMADO, que já é
 *   obrigatória no formulário. Não vira campo aqui — seria a mesma coisa duas
 *   vezes, escrita em dois lugares e lida em dois lugares.
 * - "Observação" é campo à parte, porque nas abas ela convive com a descrição.
 * - Anexo idem: é o do chamado.
 *
 * tipo: texto | texto_longo | numero | data | hora | datahora | selecao | sim_nao | pessoa
 */

const TIPOS_EQUIP_TI = ['Notebook', 'Desktop', 'Monitor', 'Teclado', 'Mouse', 'Headset'];

// A planilha escreve as opções separadas por hífen, como nos outros campos:
// "Quebra - infraestrutura (água-luz-infiltração)".
const TIPOS_MANUTENCAO = ['Quebra', 'Infraestrutura (água, luz, infiltração)'];

// Campos que se repetem literalmente em vários serviços.
const cc = (obrigatorio = true) => ({ chave: 'cc', rotulo: 'Centro de custo', tipo: 'texto', obrigatorio });
const observacao = () => ({ chave: 'observacao', rotulo: 'Observação', tipo: 'texto_longo', obrigatorio: false });
const placa = () => ({ chave: 'placa', rotulo: 'Placa', tipo: 'texto', obrigatorio: true });
const dataNecessidade = () => ({ chave: 'data_necessidade', rotulo: 'Data de necessidade', tipo: 'data', obrigatorio: true });

// Uber e Correio pedem exatamente a mesma coisa: um deslocamento.
const deslocamento = () => [
  cc(),
  { chave: 'origem', rotulo: 'Origem', tipo: 'texto', obrigatorio: true },
  { chave: 'destino', rotulo: 'Destino', tipo: 'texto', obrigatorio: true },
  { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
  { chave: 'horario', rotulo: 'Horário', tipo: 'hora', obrigatorio: true },
  { chave: 'justificativa', rotulo: 'Justificativa', tipo: 'texto_longo', obrigatorio: true },
];

// Passagem e hospedagem repetem o bloco de identificação do viajante.
const viajante = (rotuloPessoa) => [
  { chave: 'pessoa_id', rotulo: rotuloPessoa, tipo: 'pessoa', obrigatorio: true },
  { chave: 'cpf', rotulo: 'CPF', tipo: 'texto', obrigatorio: true },
  { chave: 'rg', rotulo: 'RG', tipo: 'texto', obrigatorio: false },
  { chave: 'nascimento', rotulo: 'Data de nascimento', tipo: 'data', obrigatorio: false },
  { chave: 'contato', rotulo: 'Contato', tipo: 'texto', obrigatorio: true },
  { chave: 'email', rotulo: 'E-mail', tipo: 'texto', obrigatorio: false },
  cc(),
];

export const SCHEMAS = {
  // ---------------- Compras ----------------
  'compra/solicitacao-compra': [
    cc(),
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'selecao', obrigatorio: true, opcoes: ['Produto', 'Serviço'] },
    { chave: 'valor_base', rotulo: 'Valor base', tipo: 'numero', formato: 'moeda', obrigatorio: true },
    dataNecessidade(),
    observacao(),
  ],

  // ---------------- Gestão de frota ----------------
  'frota/manutencao-veiculo-programada': [
    placa(),
    { chave: 'km_atual', rotulo: 'KM atual', tipo: 'numero', obrigatorio: true },
    { chave: 'data_manutencao', rotulo: 'Data da manutenção (prevista)', tipo: 'data', obrigatorio: true },
  ],
  'frota/manutencao-veiculo-corretiva': [
    placa(),
    { chave: 'km_atual', rotulo: 'KM atual', tipo: 'numero', obrigatorio: true },
    { chave: 'data_manutencao', rotulo: 'Data da manutenção (prevista)', tipo: 'data', obrigatorio: true },
    { chave: 'motivo', rotulo: 'Motivo', tipo: 'texto_longo', obrigatorio: true },
  ],
  'frota/recarga-ticket-log': [
    placa(),
    { chave: 'valor', rotulo: 'Valor', tipo: 'numero', formato: 'moeda', obrigatorio: true },
    { chave: 'motivo', rotulo: 'Motivo', tipo: 'texto_longo', obrigatorio: true },
    dataNecessidade(),
  ],
  'frota/reserva-veiculos': [
    cc(),
    { chave: 'local_retirada', rotulo: 'Local de retirada', tipo: 'texto', obrigatorio: true },
    { chave: 'retirada_em', rotulo: 'Data e horário de retirada', tipo: 'datahora', obrigatorio: true },
    { chave: 'local_devolucao', rotulo: 'Local da devolução', tipo: 'texto', obrigatorio: true },
    { chave: 'devolucao_em', rotulo: 'Data e horário da devolução', tipo: 'datahora', obrigatorio: true },
    observacao(),
  ],

  // ---------------- Uber e Correio ----------------
  'uber/viagem-uber': deslocamento(),
  'correio/correio': deslocamento(),

  // ---------------- Manutenção predial ----------------
  'manutencao-predial/manutencao-alojamento': [
    cc(),
    { chave: 'cidade', rotulo: 'Cidade', tipo: 'texto', obrigatorio: true },
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'selecao', obrigatorio: true, opcoes: TIPOS_MANUTENCAO },
    { chave: 'comodo', rotulo: 'Cômodo', tipo: 'texto', obrigatorio: true },
    dataNecessidade(),
  ],
  // Sede não pede CC nem data na planilha — não inventei os dois.
  'manutencao-predial/manutencao-sede': [
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'selecao', obrigatorio: true, opcoes: TIPOS_MANUTENCAO },
    { chave: 'comodo', rotulo: 'Cômodo', tipo: 'texto', obrigatorio: true },
  ],

  // ---------------- Manutenção & Instalação TI ----------------
  'ti/instalacao-software': [
    cc(),
    { chave: 'software', rotulo: 'Software', tipo: 'texto', obrigatorio: true },
    { chave: 'homologado', rotulo: 'Homologado', tipo: 'sim_nao', obrigatorio: true },
    dataNecessidade(),
    observacao(),
  ],
  'ti/solicitacao-equipamentos': [
    cc(),
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'selecao', obrigatorio: true, opcoes: TIPOS_EQUIP_TI },
    { chave: 'localizacao', rotulo: 'Localização', tipo: 'texto', obrigatorio: true },
    dataNecessidade(),
    observacao(),
  ],
  'ti/troca-equipamentos': [
    cc(),
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'selecao', obrigatorio: true, opcoes: TIPOS_EQUIP_TI },
    { chave: 'numero_serie', rotulo: 'Número de série', tipo: 'texto', obrigatorio: false },
    { chave: 'patrimonio', rotulo: 'Patrimônio', tipo: 'texto', obrigatorio: false },
    { chave: 'motivo', rotulo: 'Motivo', tipo: 'selecao', obrigatorio: true, opcoes: ['Upgrade', 'Quebra'] },
    { chave: 'localizacao', rotulo: 'Localização', tipo: 'texto', obrigatorio: true },
    dataNecessidade(),
    observacao(),
  ],
  'ti/liberacao-acessos': [
    { chave: 'tipo', rotulo: 'Tipo de acesso', tipo: 'selecao', obrigatorio: true, opcoes: ['Comum', 'VPN'] },
    { chave: 'pasta', rotulo: 'Qual pasta', tipo: 'texto', obrigatorio: false },
    { chave: 'nome_arquivo', rotulo: 'Nome do arquivo', tipo: 'texto', obrigatorio: false },
    observacao(),
  ],
  'ti/impressoras': [
    { chave: 'local_equipamento', rotulo: 'Local do equipamento', tipo: 'texto', obrigatorio: true },
    { chave: 'numero_serie', rotulo: 'Número de série da impressora', tipo: 'texto', obrigatorio: true },
    observacao(),
  ],
  'ti/manutencao-infraestrutura': [
    {
      chave: 'tipo', rotulo: 'Tipo', tipo: 'selecao', obrigatorio: true,
      opcoes: ['Internet', 'Infraestrutura', 'Backup', 'Acessórios'],
    },
    dataNecessidade(),
  ],
  'ti/verificacoes': [
    {
      chave: 'motivo', rotulo: 'Motivo', tipo: 'selecao', obrigatorio: true,
      opcoes: ['Reunião estratégica', 'Visitas'],
    },
    dataNecessidade(),
  ],

  // ---------------- Viagem e hospedagem ----------------
  'viagem-hospedagem/passagem': [
    ...viajante('Passageiro'),
    {
      chave: 'tipo', rotulo: 'Tipo', tipo: 'selecao', obrigatorio: true,
      opcoes: ['Aéreo', 'Rodoviário', 'Balsa', 'Trem', 'Outros'],
    },
    { chave: 'origem', rotulo: 'Origem', tipo: 'texto', obrigatorio: true },
    { chave: 'destino', rotulo: 'Destino', tipo: 'texto', obrigatorio: true },
    { chave: 'data_ida', rotulo: 'Data da ida', tipo: 'data', obrigatorio: true },
    { chave: 'data_volta', rotulo: 'Data da volta', tipo: 'data', obrigatorio: false },
    {
      chave: 'preferencia_horario', rotulo: 'Preferência de horário', tipo: 'selecao', obrigatorio: false,
      opcoes: ['Manhã', 'Tarde', 'Noite', 'Madrugada'],
    },
    observacao(),
  ],
  'viagem-hospedagem/hospedagem': [
    ...viajante('Hóspede'),
    { chave: 'local', rotulo: 'Local', tipo: 'texto', obrigatorio: true },
    { chave: 'check_in', rotulo: 'Data de check-in', tipo: 'data', obrigatorio: true },
    { chave: 'check_out', rotulo: 'Data de check-out', tipo: 'data', obrigatorio: true },
    observacao(),
  ],
  'viagem-hospedagem/vagas-alojamento-phd': [
    { chave: 'pessoa_id', rotulo: 'Profissional', tipo: 'pessoa', obrigatorio: true },
    cc(),
    { chave: 'entrada', rotulo: 'Entrada', tipo: 'data', obrigatorio: true },
    { chave: 'saida', rotulo: 'Saída', tipo: 'data', obrigatorio: false },
    { chave: 'local', rotulo: 'Local', tipo: 'texto', obrigatorio: true },
    observacao(),
  ],
  'viagem-hospedagem/locacao-imovel': [
    { chave: 'local', rotulo: 'Local', tipo: 'texto', obrigatorio: true },
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'selecao', obrigatorio: true, opcoes: ['Apartamento', 'Casa'] },
    { chave: 'inicio', rotulo: 'Início', tipo: 'data', obrigatorio: true },
    { chave: 'termino', rotulo: 'Término', tipo: 'data', obrigatorio: false },
    { chave: 'qtd_pessoas', rotulo: 'Quantidade de pessoas', tipo: 'numero', obrigatorio: true },
    {
      chave: 'publico', rotulo: 'Público', tipo: 'selecao', obrigatorio: false,
      opcoes: ['Masculino', 'Feminino', 'Misto'],
    },
    { chave: 'custo_previsto', rotulo: 'Custo previsto', tipo: 'numero', formato: 'moeda', obrigatorio: false },
    { chave: 'incluso_custo', rotulo: 'Incluso no custo', tipo: 'texto_longo', obrigatorio: false },
    observacao(),
  ],
};

export const schemaDoServico = (classe, servico) => SCHEMAS[`${classe}/${servico}`] || null;

/**
 * Descrição e anexo não são de todo serviço — a planilha só os pede em alguns,
 * e pedir "descreva a solicitação" depois de a pessoa já ter preenchido placa,
 * KM e data é ruído. Quem não estiver nas listas abaixo não mostra o campo.
 *
 * Os balcões gerais ("Outras demandas") aparecem nas duas: sem esquema próprio,
 * a descrição é o único lugar onde o pedido cabe.
 */
const COM_DESCRICAO = new Set([
  'mobilizacao/mobilizacao',
  'compra/solicitacao-compra',
  'manutencao-predial/manutencao-alojamento',
  'manutencao-predial/manutencao-sede',
  'ti/manutencao-infraestrutura',
  'ti/verificacoes',
  'saude-seguranca/epi',
  'saude-seguranca/uniforme',
  'saude-seguranca/outras-demandas',
  'frota/outras-demandas',
  'outras-demandas/outras-demandas',
]);

/**
 * Anexo é por EXCLUSÃO, e não por lista: todo serviço aceita arquivo, menos os
 * daqui. Assim um serviço novo já nasce podendo anexar — poder anexar e não
 * precisar é inofensivo; precisar e não poder trava o pedido.
 */
const SEM_ANEXO = new Set([
  'mobilizacao/mobilizacao',
]);

/**
 * Rótulos dos campos dos formulários escritos em código. A tela de detalhe
 * mostra o que foi preenchido, e sem isto ela exibiria a chave crua
 * ("data_inicio_cliente") para quem só quer ler o pedido.
 */
const ROTULOS_CODIFICADOS = {
  movimento: 'Movimentação', profissional: 'Profissional', gestor: 'Gestor',
  cc: 'Centro de custo', local_obra: 'Local da obra',
  data_inicio_cliente: 'Data de início no cliente', equipamentos: 'Equipamento e acessórios',
  softwares: 'Software', epis: 'EPI', uniforme: 'Uniforme',
  contato_cliente: 'Contato do setor do cliente', devolucao: 'Há devolução',
  devolucao_descricao: 'O que será devolvido',
  tipo: 'Tipo', tipo_livre: 'Peças e tamanhos', motivo: 'Motivo',
  localizacao: 'Localização', observacao: 'Observação',
  // Fica aqui como defesa: `itens` é renderizado por um bloco próprio na tela
  // do chamado (está em CAMPOS_OCULTOS), mas se um dia escapar para a lista
  // genérica é melhor sair "Itens solicitados" do que "itens".
  itens: 'Itens solicitados',
};

/** Rótulo de um campo gravado em chamados_adm.campos. */
export function rotuloDoCampo(classe, servico, chave) {
  const doSchema = (schemaDoServico(classe, servico) || []).find((c) => c.chave === chave);
  if (doSchema) return doSchema.rotulo;
  if (ROTULOS_CODIFICADOS[chave]) return ROTULOS_CODIFICADOS[chave];
  return chave.replace(/_/g, ' ');
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Data vinda de <input type="date"> é "2026-09-01" — texto, não instante.
 * Passar isso por `new Date()` interpreta como UTC e, no nosso fuso, exibe o
 * DIA ANTERIOR. Por isso a formatação é feita quebrando a string.
 */
const dataBr = (v) => {
  const [ano, mes, dia] = String(v).slice(0, 10).split('-');
  return (ano && mes && dia) ? `${dia}/${mes}/${ano}` : String(v);
};

/**
 * Formata o valor de um campo para leitura, usando o TIPO declarado no esquema
 * — não o formato do texto. Adivinhar pelo conteúdo erraria em campo de texto
 * que por acaso parece número (patrimônio, número de série).
 */
export function formatarValorCampo(classe, servico, chave, valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (Array.isArray(valor)) return valor.join(', ');
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';

  const def = (schemaDoServico(classe, servico) || []).find((c) => c.chave === chave);

  if (def?.formato === 'moeda') {
    const n = Number(valor);
    return Number.isFinite(n) ? BRL.format(n) : String(valor);
  }
  if (def?.tipo === 'data') return dataBr(valor);
  if (def?.tipo === 'datahora') {
    const [d, h] = String(valor).split('T');
    return h ? `${dataBr(d)} ${h.slice(0, 5)}` : dataBr(d);
  }
  if (def?.tipo === 'hora') return String(valor).slice(0, 5);
  if (def?.tipo === 'sim_nao') return valor === 'sim' ? 'Sim' : 'Não';

  return String(valor);
}

/**
 * Campos internos que não fazem sentido exibir como dado do pedido.
 *
 * `itens` (o pedido de EPI/uniforme) entra aqui porque é um ARRAY DE OBJETOS e
 * formatarValorCampo faz `valor.join(', ')` em qualquer array — sairia
 * "[object Object]". A tela do chamado o renderiza numa tabela própria, com
 * quantidade e saldo.
 */
export const CAMPOS_OCULTOS = new Set(['profissional_id', 'pessoa_id', 'itens']);

export const usaDescricao = (classe, servico) => COM_DESCRICAO.has(`${classe}/${servico}`);
export const usaAnexo = (classe, servico) => !SEM_ANEXO.has(`${classe}/${servico}`);

/** Campo de pessoa exige carregar a lista de colaboradores. */
export const schemaUsaPessoa = (schema) => (schema || []).some((c) => c.tipo === 'pessoa');

/** Estado inicial com todas as chaves presentes — evita input trocando de não-controlado para controlado. */
export const inicialDoSchema = (schema) => Object.fromEntries((schema || []).map((c) => [c.chave, '']));
