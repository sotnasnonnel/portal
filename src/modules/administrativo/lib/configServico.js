/**
 * Regras de tela da Configuração dos serviços.
 *
 * Lógica pura — sem Supabase, sem React — para poder ser testada. Nada aqui
 * decide o que é gravado: só como a lista se organiza e o que está pendente.
 */

/**
 * Em que pé está a configuração de um serviço.
 *
 * "Pronto" pede atendente E prazo porque são os dois que o solicitante e os
 * indicadores sentem: sem prazo, o chamado fica fora do cumprimento de prazo; sem
 * atendente, ninguém aparece como responsável ao abrir. Alçada e campos extras
 * são opcionais de verdade e não contam.
 *
 * @returns {'pronto'|'parcial'|'vazio'}
 */
export function situacaoDaConfig(cfg) {
  if (!cfg) return 'vazio';
  const atendente = !!cfg.atendente_id;
  const prazo = !!cfg.sla_dias_uteis;
  if (atendente && prazo) return 'pronto';
  const algo = atendente || prazo || !!cfg.exige_aprovacao || (cfg.campos_extras || []).length > 0;
  return algo ? 'parcial' : 'vazio';
}

/** Busca sem ligar para acento nem caixa: "manutencao" acha "Manutenção". */
export function normalizarBusca(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtra o catálogo mantendo os grupos, sem os que ficaram vazios.
 *
 * A busca olha também a classe e o nome do atendente: "quais serviços são da
 * Ana?" é uma pergunta tão comum quanto procurar um serviço pelo nome.
 *
 * @param classes [{ slug, label, servicos: [{ slug, label }] }]
 * @param opcoes.busca texto digitado
 * @param opcoes.soPendentes só o que não está pronto
 * @param opcoes.configs mapa "classe/servico" -> config
 * @param opcoes.nomePessoa mapa id -> nome
 */
export function filtrarServicos(classes = [], {
  busca = '', soPendentes = false, configs = {}, nomePessoa = {},
} = {}) {
  const q = normalizarBusca(busca);
  return classes
    .map((classe) => ({
      ...classe,
      servicos: classe.servicos.filter((s) => {
        const cfg = configs[`${classe.slug}/${s.slug}`];
        if (soPendentes && situacaoDaConfig(cfg) === 'pronto') return false;
        if (!q) return true;
        const onde = [s.label, classe.label, nomePessoa[cfg?.atendente_id]];
        return onde.some((t) => normalizarBusca(t).includes(q));
      }),
    }))
    .filter((classe) => classe.servicos.length > 0);
}

/** Quantos serviços do catálogo existem e quantos já estão prontos. */
export function contarSituacoes(classes = [], configs = {}) {
  let total = 0;
  let prontos = 0;
  for (const classe of classes) {
    for (const s of classe.servicos) {
      total += 1;
      if (situacaoDaConfig(configs[`${classe.slug}/${s.slug}`]) === 'pronto') prontos += 1;
    }
  }
  return { total, prontos, pendentes: total - prontos };
}

/** Só os campos que o editor mexe, em ordem fixa, para comparar sem falso alarme. */
function assinatura(cfg) {
  return JSON.stringify({
    atendente: cfg?.atendente_id ?? null,
    // Campo apagado chega como '' ou null; os dois querem dizer "sem prazo".
    prazo: cfg?.sla_dias_uteis || null,
    aprovacao: !!cfg?.exige_aprovacao,
    aprovadores: cfg?.aprovadores || [],
    campos: (cfg?.campos_extras || []).map((c) => ({
      chave: c.chave,
      rotulo: c.rotulo,
      tipo: c.tipo,
      obrigatorio: !!c.obrigatorio,
      opcoes: c.opcoes || [],
    })),
  });
}

/** O rascunho difere do que está salvo? Serviço sem linha conta como config vazia. */
export function rascunhoMudou(rascunho, salvo) {
  return assinatura(rascunho) !== assinatura(salvo);
}
