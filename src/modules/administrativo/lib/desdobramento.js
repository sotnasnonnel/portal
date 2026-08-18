/**
 * Desdobramento da mobilização em chamados próprios.
 *
 * O pedido de mobilização continua inteiro, do jeito que foi preenchido. O que
 * muda é que os ADICIONAIS (equipamento, software, EPI, uniforme) também saem
 * como chamados independentes, cada um no serviço que já existe no catálogo —
 * com o aprovador, o técnico e o prazo daquele serviço.
 *
 * A razão é operacional: quem aprova equipamento não deveria precisar abrir
 * mobilizações de pessoa para achar o que lhe cabe.
 *
 * Sem imports de propósito — igual a mobilizacao.js. As listas de opções vivem
 * em opcoes.js, que puxa os catálogos do DP e por isso não roda sob
 * `node --test`; importá-las aqui deixaria estas regras sem teste.
 */

/** Rótulo exato da segunda tela na lista de equipamentos (veja opcoes.js). */
export const SEGUNDA_TELA = '2° tela';

/**
 * A mobilização oferece ESPECIFICAÇÃO de máquina ("Gamer 32RAM + 1TB"); o
 * serviço de TI pede CATEGORIA ("Notebook"), em escolha única. Toda a lista de
 * equipamentos do portal é variante de notebook, e a segunda tela é monitor —
 * então a tradução é fechada, e a especificação exata vai na observação para
 * não se perder no caminho.
 */
export const categoriaDoEquipamento = (item) => (item === SEGUNDA_TELA ? 'Monitor' : 'Notebook');

/** Item fora do catálogo homologado do DP. */
const NAO_HOMOLOGADO = 'Outra';

const preenchido = (v) => typeof v === 'string' && v.trim() !== '';

/** "Para FULANO (mobilização)." — dá contexto a quem recebe o chamado solto. */
function origemTexto(valores) {
  const quem = preenchido(valores.profissional) ? valores.profissional.trim() : 'profissional mobilizado';
  return `Para ${quem} (gerado pela mobilização).`;
}

/**
 * Campos comuns a todos os filhos. O centro de custo, a obra e a data de início
 * vêm da mobilização — repetir isso à mão em cada pedido é justamente o
 * trabalho que este desdobramento existe para evitar.
 */
const comuns = (valores) => ({
  cc: (valores.cc || '').trim(),
  localizacao: (valores.local_obra || '').trim(),
});

/**
 * Quais chamados nascem junto com esta mobilização.
 *
 * @returns {Array<{classe, servico, campos, descricao}>} vazio quando não há
 *          adicional escolhido — inclusive na desmobilização, que não os tem.
 */
export function desdobrarMobilizacao(valores = {}) {
  const filhos = [];
  const origem = origemTexto(valores);
  const base = comuns(valores);
  const dataNecessidade = valores.data_inicio_cliente || '';

  // --- Equipamentos: agrupados por categoria, porque o campo "Tipo" do serviço
  // de TI é de escolha única. Notebook e segunda tela viram dois chamados.
  const porCategoria = new Map();
  for (const item of valores.equipamentos || []) {
    const cat = categoriaDoEquipamento(item);
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat).push(item);
  }
  for (const [categoria, itens] of porCategoria) {
    filhos.push({
      classe: 'ti',
      servico: 'solicitacao-equipamentos',
      descricao: origem,
      campos: {
        ...base,
        tipo: categoria,
        data_necessidade: dataNecessidade,
        observacao: `${origem} Itens: ${itens.join(', ')}.`,
      },
    });
  }

  // --- Softwares: um chamado por software. O serviço pede "Homologado" por
  // item, e juntar vários num campo de texto só apagaria essa distinção.
  for (const software of valores.softwares || []) {
    filhos.push({
      classe: 'ti',
      servico: 'instalacao-software',
      descricao: origem,
      campos: {
        cc: base.cc,
        software,
        // A lista vem do catálogo homologado do DP; só "Outra" fica de fora dele.
        homologado: software === NAO_HOMOLOGADO ? 'nao' : 'sim',
        data_necessidade: dataNecessidade,
        observacao: origem,
      },
    });
  }

  // --- EPI: um chamado com todos os itens, que é como o serviço já pede (o
  // campo aceita lista). Motivo "Item novo": ninguém está substituindo nada
  // numa mobilização.
  if ((valores.epis || []).length) {
    filhos.push({
      classe: 'saude-seguranca',
      servico: 'epi',
      descricao: origem,
      campos: {
        ...base,
        tipo: [...valores.epis],
        motivo: 'Item novo',
        observacao: origem,
      },
    });
  }

  // --- Uniforme: texto livre, porque a lista de uniformes não existe no portal.
  if (preenchido(valores.uniforme)) {
    filhos.push({
      classe: 'saude-seguranca',
      servico: 'uniforme',
      descricao: origem,
      campos: {
        ...base,
        tipo_livre: valores.uniforme.trim(),
        motivo: 'Item novo',
        observacao: origem,
      },
    });
  }

  return filhos;
}
