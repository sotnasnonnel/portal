// Texto do Termo de Empréstimo de Equipamentos, nos três modelos do jurídico
// ("Termo de responsabilidade - CLT/PJ/Socio Cotista.pdf"). Fica separado do
// PDF para a tela de aceite e o PDF saírem do MESMO texto.
//
// Qual modelo vale para cada pessoa sai de colaboradores.formato
// (modeloDoVinculo; a mesma regra de app_private.ti_modelo_termo no banco).
//
// Mudou o texto? Suba VERSAO_TERMO E cadastre a versão nova como vigente em
// app_private.ti_termo_textos (ver supabase_migration_ti_termo_prova.sql), no
// mesmo deploy: o aceite grava o texto OFICIAL do banco e recusa se a tela
// mostrar outro. O PDF de um termo aceito sai do texto guardado no aceite
// (ti_termos.texto_aceito): mudar este arquivo não muda termo já aceito.

export const EMPRESA_TERMO = 'PHD SOLUCOES EM ENGENHARIA LTDA';
export const TITULO_TERMO = 'TERMO DE EMPRÉSTIMO DE EQUIPAMENTOS';
export const VERSAO_TERMO = '2026-11';

export const MODELOS = ['CLT', 'PJ', 'Sócio Cotista'];

/** Mesma regra de app_private.ti_modelo_termo. */
export function modeloDoVinculo(formato) {
  if (formato === 'PJ') return 'PJ';
  if (formato === 'Sócio Cotista' || formato === 'Diretoria') return 'Sócio Cotista';
  return 'CLT';
}

const USO_COMUM = {
  instalar: 'Não instalar programas sem licença ou sem autorização da área de tecnologia, não remover etiquetas de patrimônio ou lacres e não alterar configurações de segurança;',
  adesivos: 'Não efetuar a colagem de adesivos nos equipamentos, pois fere o código de bom uso dos fornecedores;',
  dados: [
    'Os equipamentos e as informações neles contidas pertencem à PHD e podem ser inspecionados, monitorados ou recolhidos a qualquer tempo, conforme a política de segurança da informação da empresa;',
    'Não armazenar arquivos pessoais nos equipamentos. Na devolução, os dados poderão ser apagados sem aviso prévio.',
  ],
};

const CLT = {
  identificacao: 'IDENTIFICAÇÃO DO EMPREGADO',
  abertura: `Recebi da empresa ${EMPRESA_TERMO}, a título de empréstimo gratuito, os equipamentos de sua propriedade descritos neste termo, `
    + 'para uso exclusivo nas minhas atividades profissionais para a PHD. Declaro que os recebi completos, em funcionamento e no estado '
    + 'de conservação registrado na descrição abaixo, e me comprometo a cumprir as condições a seguir.',
  clausulas: [
    {
      titulo: '1. USO E GUARDA',
      itens: [
        'Usar os equipamentos apenas para a finalidade a que se destinam, sendo vedado o uso por terceiros, inclusive familiares;',
        'Responsabilizar-me por sua guarda e conservação, não os deixando sem supervisão em veículos, locais públicos ou canteiros de obra;',
        USO_COMUM.instalar,
        'Não realizar troca de qualquer equipamento entre profissionais sem a devida formalização para o setor de TI e autorização formal pela gerência;',
        USO_COMUM.adesivos,
        'Comunicar ao setor de TI, via chamado, qualquer defeito ou alteração que torne o equipamento impróprio para uso, sendo vedado o reparo por conta própria ou em assistência não autorizada.',
      ],
    },
    {
      titulo: '2. MAU USO E DANOS',
      itens: [
        'Considera-se mau uso, entre outros: queda, contato com líquidos, uso em desacordo com as orientações do fabricante, reparo ou abertura não autorizados, violação de lacre, uso por terceiros e descuido na guarda;',
        'O desgaste natural decorrente do uso regular não gera responsabilidade ao empregado;',
        'Constatado o mau uso pelo Comitê de Avaria e Fornecedor, o custo do reparo ou, se este for inviável, da reposição por equipamento equivalente será repassado ao empregado, na forma do item 5.',
      ],
    },
    {
      titulo: '3. EXTRAVIO, FURTO OU ROUBO',
      itens: [
        'Em caso de furto ou roubo, registrar boletim de ocorrência e comunicar o setor Administrativo e TI, por e-mail, em até 24 (vinte e quatro) horas do fato ou de sua ciência, apresentando o boletim e o relato das circunstâncias;',
        'A responsabilidade será avaliada pelo Comitê de Avaria, com base nas evidências apresentadas. Havendo extravio, ou furto ou roubo em que se comprove descuido do empregado ou descumprimento deste termo, o custo de reposição será repassado ao empregado, na forma do item 5;',
        'A ausência do boletim de ocorrência ou a comunicação fora do prazo será considerada pelo Comitê na avaliação da responsabilidade.',
      ],
    },
    {
      titulo: '4. DEVOLUÇÃO',
      itens: [
        'Devolver os equipamentos completos e em perfeito estado de conservação, ressalvado o desgaste natural, sempre que solicitado pela PHD ou até o último dia de trabalho em caso de desligamento;',
        'Esgotado o prazo sem devolução, o equipamento será considerado não devolvido e o seu valor de reposição será descontado, acrescido dos custos comprovados com equipamento substituto durante o período de atraso;',
        'Caso o equipamento seja devolvido após o desconto e em condições de uso, o valor será restituído, deduzidos os custos do atraso e eventuais reparos.',
      ],
    },
    {
      titulo: '5. APURAÇÃO E DESCONTO',
      itens: [
        'Antes de qualquer decisão do Comitê de Avaria, será assegurado ao empregado apresentar sua versão e as evidências que julgar pertinentes;',
        'O valor de referência será o de mercado de equipamento equivalente ao entregue, na data da apuração, comprovado por orçamento;',
        'Nos termos do art. 462, § 1º, da CLT, autorizo expressamente o desconto em salário ou em verbas rescisórias dos valores apurados conforme os itens 2, 3 e 4, após ciência formal da decisão do Comitê, respeitados os limites legais. Eventual saldo remanescente poderá ser cobrado pelos meios legais cabíveis.',
      ],
    },
    { titulo: '6. DADOS E INFORMAÇÕES', itens: USO_COMUM.dados },
  ],
  declaracao: 'Declaro, para os devidos fins, que recebi e me responsabilizo pelos equipamentos descritos nesta ficha.',
  assinatura: 'Empregado',
};

const PJ = {
  identificacao: 'IDENTIFICAÇÃO DA CONTRATADA',
  abertura: `A ${EMPRESA_TERMO} (COMODANTE) entrega à CONTRATADA identificada acima (COMODATÁRIA), a título de comodato, nos termos `
    + 'dos arts. 579 a 585 do Código Civil, os equipamentos de sua propriedade descritos neste termo, para uso exclusivo na execução dos '
    + 'serviços objeto do contrato indicado, do qual este termo é parte integrante. A CONTRATADA declara recebê-los completos, em '
    + 'funcionamento e no estado registrado na descrição abaixo, e obriga-se às condições a seguir.',
  clausulas: [
    {
      titulo: '1. USO E GUARDA',
      itens: [
        'Utilizar os equipamentos exclusivamente na execução do objeto do contrato, respondendo pelo uso feito por seus sócios, empregados ou prepostos;',
        'Conservar os equipamentos como se seus fossem, não os deixando sem supervisão em veículos, locais públicos ou canteiros de obra;',
        'Não ceder, emprestar ou transferir os equipamentos a terceiros sem autorização prévia e por escrito da PHD;',
        'Não instalar programas sem licença ou sem autorização da PHD, não remover etiquetas de patrimônio ou lacres e não alterar configurações de segurança;',
        USO_COMUM.adesivos,
        'Comunicar à PHD, por escrito, qualquer defeito ou alteração que torne o equipamento impróprio para uso, sendo vedado o reparo por conta própria ou em assistência não autorizada.',
      ],
    },
    {
      titulo: '2. DANOS',
      itens: [
        'A CONTRATADA responde pelos danos causados aos equipamentos, exceto os decorrentes do desgaste natural pelo uso regular;',
        'O dano será apurado por vistoria técnica da PHD, com laudo ou orçamento, assegurado à CONTRATADA manifestar-se por escrito em até 5 (cinco) dias úteis do recebimento;',
        'Será devido o custo do reparo ou, se este for inviável, o valor de reposição por equipamento equivalente.',
      ],
    },
    {
      titulo: '3. EXTRAVIO, FURTO OU ROUBO',
      itens: [
        'Em caso de furto ou roubo, registrar boletim de ocorrência e comunicar a PHD, por e-mail, em até 24 (vinte e quatro) horas do fato ou de sua ciência, apresentando o boletim e o relato das circunstâncias;',
        'A CONTRATADA responde pelo valor de reposição em caso de extravio, furto ou roubo, salvo se comprovar que o fato decorreu de caso fortuito ou força maior, sem qualquer culpa sua ou de seus prepostos;',
        'A ausência do boletim de ocorrência ou a comunicação fora do prazo afasta a exceção prevista no item anterior.',
      ],
    },
    {
      titulo: '4. DEVOLUÇÃO E MORA',
      itens: [
        'Devolver os equipamentos completos e em perfeito estado de conservação, ressalvado o desgaste natural, da solicitação da PHD ou do término do contrato, qualquer que seja o motivo;',
        'Esgotado o prazo, a CONTRATADA estará em mora independentemente de notificação e pagará, nos termos do art. 582 do Código Civil, aluguel de 5% do valor de referência do equipamento por dia de atraso, até a efetiva devolução;',
        'Decorridos 3 dias de atraso, o equipamento será considerado não devolvido e será devido também o seu valor de reposição, sem prejuízo das medidas judiciais cabíveis, inclusive reintegração de posse.',
      ],
    },
    {
      titulo: '5. APURAÇÃO E COBRANÇA',
      itens: [
        'O valor de referência será o de mercado de equipamento equivalente ao entregue, na data da apuração, comprovado por orçamento;',
        'A CONTRATADA autoriza expressamente a compensação dos valores devidos com quaisquer pagamentos a que tenha direito no contrato, mediante comunicação prévia e por escrito da PHD, acompanhada do demonstrativo do cálculo;',
        'O saldo não compensado deverá ser pago em até 10 (dez) dias do recebimento da comunicação, sob pena de cobrança pelos meios legais cabíveis.',
      ],
    },
    {
      titulo: '6. DADOS E DISPOSIÇÕES GERAIS',
      itens: [
        'Os equipamentos e as informações neles contidas pertencem à PHD, que poderá inspecioná-los ou recolhê-los a qualquer tempo, aplicando-se as cláusulas de sigilo e proteção de dados do contrato;',
        'Este termo integra o contrato de prestação de serviços indicado, prevalecendo o contrato em caso de conflito, e fica eleito o mesmo foro nele previsto.',
      ],
    },
  ],
  declaracao: 'E, por estarem de acordo, as partes assinam este termo.',
  assinatura: 'CONTRATADA (representante legal)',
};

const SOCIO = {
  identificacao: 'IDENTIFICAÇÃO DO SÓCIO',
  abertura: `Recebi da ${EMPRESA_TERMO}, na condição de sócio quotista, a título de comodato, nos termos dos arts. 579 a 585 do `
    + 'Código Civil, os equipamentos de sua propriedade descritos neste termo, para uso exclusivo nas atividades que exerço para a PHD. '
    + 'Declaro que os recebi completos, em funcionamento e no estado de conservação registrado na descrição abaixo, e me comprometo a '
    + 'cumprir as condições a seguir.',
  clausulas: [
    {
      titulo: '1. USO E GUARDA',
      itens: [
        'Usar os equipamentos apenas para as atividades da PHD, sendo vedado o uso por terceiros, inclusive familiares;',
        'Conservar os equipamentos como se meus fossem, não os deixando sem supervisão em veículos, locais públicos ou canteiros de obra;',
        USO_COMUM.instalar,
        'Não realizar troca de qualquer equipamento sem a devida formalização ao setor de TI;',
        USO_COMUM.adesivos,
        'Comunicar ao setor TI, via chamado, qualquer defeito ou alteração que torne o equipamento impróprio para uso, sendo vedado o reparo por conta própria ou em assistência não autorizada.',
      ],
    },
    {
      titulo: '2. MAU USO E DANOS',
      itens: [
        'Considera-se mau uso, entre outros: queda, contato com líquidos, uso em desacordo com as orientações do fabricante, reparo ou abertura não autorizados, violação de lacre, uso por terceiros e descuido na guarda;',
        'O desgaste natural decorrente do uso regular não gera responsabilidade ao sócio;',
        'Constatado o mau uso, com base em laudo ou orçamento técnico, o custo do reparo ou, se este for inviável, da reposição por equipamento equivalente será de responsabilidade do sócio, na forma do item 5.',
      ],
    },
    {
      titulo: '3. EXTRAVIO, FURTO OU ROUBO',
      itens: [
        'Em caso de furto ou roubo, registrar boletim de ocorrência e comunicar o setor Administrativo e TI, por e-mail, em até 24 (vinte e quatro) horas do fato ou de sua ciência, apresentando o boletim e o relato das circunstâncias;',
        'Havendo extravio, ou furto ou roubo em que se comprove descuido do sócio ou descumprimento deste termo, o custo de reposição será de sua responsabilidade, na forma do item 5;',
        'A ausência do boletim de ocorrência ou a comunicação fora do prazo será considerada na avaliação da responsabilidade.',
      ],
    },
    {
      titulo: '4. DEVOLUÇÃO E MORA',
      itens: [
        'Devolver os equipamentos completos e em perfeito estado de conservação, ressalvado o desgaste natural, por solicitação da PHD, ou até a data de minha retirada da sociedade ou do encerramento de minhas atividades na PHD;',
        'Esgotado o prazo, estarei em mora independentemente de notificação e pagarei, nos termos do art. 582 do Código Civil, aluguel de 5% do valor de referência do equipamento por dia de atraso, até a efetiva devolução;',
        'Decorridos 3 dias de atraso, o equipamento será considerado não devolvido e será devido também o seu valor de reposição.',
      ],
    },
    {
      titulo: '5. APURAÇÃO E COMPENSAÇÃO',
      itens: [
        'A responsabilidade será apurada pela administração da sociedade, com impedimento do sócio envolvido, assegurado a este apresentar sua versão e evidências antes da decisão;',
        'O valor de referência será o de mercado de equipamento equivalente ao entregue, na data da apuração, comprovado por orçamento;',
        'Autorizo expressamente a compensação dos valores apurados com lucros distribuídos, haveres a que eu tenha direito em caso de retirada;',
        'Este termo não altera o contrato social nem o acordo de sócios, que prevalecem em caso de conflito.',
      ],
    },
    { titulo: '6. DADOS E INFORMAÇÕES', itens: USO_COMUM.dados },
  ],
  declaracao: 'Declaro, para os devidos fins, que recebi e me responsabilizo pelos equipamentos descritos nesta ficha.',
  assinatura: 'Sócio',
};

const TEXTOS = { CLT, PJ, 'Sócio Cotista': SOCIO };

/** Texto completo de um modelo (cai no CLT se vier vazio, como os termos antigos). */
export const textoDoModelo = (modelo) => TEXTOS[modelo] || CLT;

/**
 * O texto como vai para o banco no aceite (ti_termos.texto_aceito): só o que a
 * pessoa leu, no formato que o PDF usa. É a prova do conteúdo aceito.
 */
export function textoParaAceite(modelo) {
  const t = textoDoModelo(modelo);
  return {
    identificacao: t.identificacao, abertura: t.abertura, clausulas: t.clausulas, declaracao: t.declaracao, assinatura: t.assinatura,
  };
}

/** Texto de um termo já registrado: o aceito, se guardado; senão o do modelo. */
export const textoDoTermo = (termo) => termo?.texto_aceito || textoDoModelo(termo?.modelo);

const fmtData = (iso) => {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
};

/**
 * Quadro de identificação, na ordem do PDF do jurídico. `t`: o termo
 * ({pessoa_nome, cpf, pessoa_email, data_admissao, data_termo, identificacao}).
 */
export function camposIdentificacao(modelo, t) {
  const id = t.identificacao || {};
  const pessoa = [
    ['Nome da pessoa responsável', t.pessoa_nome],
    ['CPF', t.cpf],
    ['E-mail', t.pessoa_email],
  ];
  if (modelo === 'PJ') {
    return [
      ['Razão social', id.razao_social],
      ['CNPJ', id.cnpj],
      ['Representante legal', id.representante],
      ['CPF do representante', id.cpf_representante],
      ['Data de emissão do termo', fmtData(t.data_termo)],
      ...pessoa,
    ];
  }
  if (modelo === 'Sócio Cotista') {
    return [
      ['Área de atuação', id.area_atuacao],
      ['Data de ingresso', fmtData(t.data_admissao)],
      ['Data de emissão do termo', fmtData(t.data_termo)],
      ...pessoa,
    ];
  }
  return [...pessoa, ['Data de admissão', fmtData(t.data_admissao)]];
}

const fmtBRL = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Linhas "rótulo: valor" de um equipamento no quadro DESCRIÇÃO DO EQUIPAMENTO. */
export function linhasEquipamento(a) {
  const v = a.valor_mensal == null || a.valor_mensal === '' ? null : Number(a.valor_mensal);
  return [
    ['Equipamento', a.tipo],
    ['Modelo', a.modelo],
    ['Número de série', a.numero_serie],
    ['Descrição', a.descricao],
    ['Configuração', a.configuracao],
    ['Fornecedor', a.fornecedor],
    ['Valor mensal de locação (R$)', Number.isFinite(v) && v > 0 ? fmtBRL.format(v) : null],
  ].filter(([, valor]) => valor != null && valor !== '');
}

/** "Belo Horizonte, 16/11/2026." */
export function localEData(cidade, dataISO) {
  const c = String(cidade || 'Belo Horizonte').toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase());
  return `${c}, ${fmtData(dataISO)}.`;
}

/** "Aceito eletronicamente no Portal PHD em 17/11/2026 às 09:42 (IP 1.2.3.4)." */
export function linhaAceite(t) {
  if (!t.aceite_em) return '';
  const d = new Date(t.aceite_em);
  const data = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return `Aceito eletronicamente no Portal PHD em ${data} às ${hora}${t.aceite_ip ? ` (IP ${t.aceite_ip})` : ''}${t.versao_texto ? `, versão ${t.versao_texto} do termo` : ''}.`;
}
