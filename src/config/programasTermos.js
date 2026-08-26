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
