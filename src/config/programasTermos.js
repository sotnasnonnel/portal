/**
 * REGRAS dos programas, exibidas em popup com aceite obrigatório antes do
 * formulário (planilha, aba "Alavanca", item 1).
 *
 * O texto da Alavanca é transcrição literal do card de regras do programa
 * (a imagem embutida na aba "Alavanca" da planilha) — não reescrever sem o
 * time comercial, é o que o colaborador declara ter lido.
 */
export const TERMOS_PROGRAMAS = {
  alavanca: {
    titulo: 'Regras do Programa — Alavanca PHD',
    intro: 'Ao prosseguir com a indicação, você declara estar ciente e de acordo com as regras do programa:',
    itens: [
      // "Canal da indicação" saiu a pedido: a regra dizia que a indicação deve
      // ser feita por formulário específico — e o popup só existe DENTRO desse
      // formulário. Quem está lendo já cumpriu a regra.
      ['Cliente ainda não contatado', 'a indicação só será considerada válida caso o cliente indicado não tenha sido contatado previamente pela equipe comercial da PHD Engenharia.'],
      ['Nova oportunidade em cliente existente', 'caso a indicação seja de uma nova oportunidade em um cliente já existente, a pontuação será concedida apenas se a oportunidade não tiver sido previamente mapeada pelo time comercial.'],
      ['Indicação em duplicidade', 'caso um mesmo cliente seja indicado por mais de um colaborador, a premiação será concedida para quem tiver feito a indicação primeiro, considerando a data de envio do formulário.'],
      ['Quem pode ser premiado', 'a premiação será por colaborador e apenas para as funções até o nível de coordenação, mediante a efetivação de contrato com o cliente da indicação realizada, conforme critérios do programa.'],
      ['Valor e pagamento', 'o pagamento da premiação se dará após o faturamento da primeira medição do contrato firmado pelo programa. O valor será de 0,5% do valor do contrato, limitado a R$ 10.000,00. Ex.: contrato de R$ 1.000.000,00, comissão de R$ 5.000,00.'],
    ],
  },
};

export const getTermosPrograma = (slug) => TERMOS_PROGRAMAS[slug] || null;

/**
 * REGRAS DO PROGRAMA DE INOVAÇÃO 2026 — transcrição dos slides 3, 4 e 5 de
 * referencia/referencia_folga_de_campo.pptx (o arquivo tem esse nome, mas o
 * conteúdo é a apresentação do Programa de Inovação 2026).
 *
 * Ficam no Campo de Ideias porque é lá que a solução é registrada, e o registro
 * até 30/11/2026 é condição de elegibilidade (regra 4). Não há aceite: isto é
 * informação do programa, não declaração do colaborador — por isso o popup é
 * só de leitura, diferente do TERMOS_PROGRAMAS da Alavanca.
 *
 * Texto literal dos slides. A regra 6 cita "a regra número 5", então a
 * elegibilidade é NUMERADA na tela (`numerada`) — mudar a ordem quebra a
 * referência.
 */
export const REGRAS_INOVACAO = {
  titulo: 'Regras do Programa de Inovação 2026',
  intro: 'As soluções registradas no Campo de Ideias concorrem à premiação do Programa de Inovação 2026.',
  secoes: [
    {
      titulo: 'Critérios de elegibilidade',
      numerada: true,
      itens: [
        'Ser um colaborador ativo da empresa até a data de premiação;',
        'Ter participado de pelo menos 1 workshop realizado pela PHD;',
        'Ser uma solução original desenvolvida para um desafio, problema ou oportunidade real do seu próprio projeto, área ou processo de trabalho;',
        'Ter a solução cadastrada no programa Campo de Ideias, até a data de 30/11/26;',
        'Apresentar medição de retorno (ROI), com dados levantados durante o tempo de uso da solução (comparativo antes e depois);',
        'Ser uma solução ou ferramenta de mercado desde que atenda à regra número 5 e neste caso o retorno deve descontar o valor da ferramenta.',
      ],
    },
    {
      titulo: 'Critérios de premiação',
      intro: 'As soluções serão comparadas entre si em três critérios: redução de custo, economia de tempo e facilidade de implantação e utilização.',
      itens: [
        'Em cada critério, as três melhores soluções recebem: 1º lugar 3 pontos, 2º lugar 2 pontos e 3º lugar 1 ponto.',
        'A pontuação total define as 3 soluções vencedoras.',
        'Em caso de empate, prevalece o dono da solução que mais engajou no programa de inovação, considerando a participação nos workshops e registros no programa Campo de Ideias.',
      ],
    },
    {
      titulo: 'Considerações gerais',
      itens: [
        'Ideias não são contabilizadas no programa;',
        'Iniciativas com investimento dentro da estratégia da empresa não serão contabilizados no programa;',
        'Os responsáveis pelas soluções devem apresentar relatório com os resultados, conforme critérios da premiação, até 30/11/2026;',
        'A equipe de Inovação irá validar os números apresentados;',
        'A premiação dos vencedores acontecerá na festa de fim de ano da PHD.',
      ],
    },
  ],
};
