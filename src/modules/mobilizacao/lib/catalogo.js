/**
 * Regras do catálogo de etapas.
 *
 * O catálogo é DADO (tabela mobilizacao_catalogo_etapas), não código: a
 * planilha continua viva e vai mudar, e nome de etapa em .js exigiria deploy.
 * O que mora aqui são as regras que dizem se um catálogo faz sentido — e elas
 * precisam existir no cliente porque um catálogo mal formado só apareceria
 * depois, como processo travado, longe de quem o cadastrou.
 *
 * Lógica pura, testável.
 */

/** Ordena por `ordem` e, no empate, por título — para a lista não dançar. */
export const ordenarEtapas = (lista = []) =>
  [...lista].sort((a, b) => (a.ordem - b.ordem) || String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'));

/**
 * A condição do catálogo, avaliada contra os dados do processo.
 *
 * Formato: `{"movimento": ["Nova mobilização"]}` — a etapa só nasce quando o
 * campo `movimento` do processo for um dos valores listados. É o que permite
 * UMA lista de etapas atender "Nova mobilização" e "Movimentação de
 * profissional" sem duplicar o fluxo inteiro para omitir três passos.
 *
 * Espelha app_private.mob_condicao_ok. Chave ausente nos dados NÃO atende:
 * criar uma etapa condicional quando não se sabe a condição é o erro mais caro
 * dos dois (dá trabalho a alguém), então o silêncio pende para não criar.
 */
export function condicaoAtendida(condicao, dados = {}) {
  if (!condicao || typeof condicao !== 'object') return true;
  const chaves = Object.keys(condicao);
  if (chaves.length === 0) return true;

  return chaves.every((k) => {
    const aceitos = condicao[k];
    if (!Array.isArray(aceitos)) return true;
    return aceitos.includes(dados[k] ?? '');
  });
}

/** Quais etapas nascem num processo deste fluxo com estes dados. */
export function etapasPrevistas(catalogo = [], fluxo, dados = {}) {
  return ordenarEtapas(
    catalogo.filter((e) => e.fluxo === fluxo && e.ativo !== false && condicaoAtendida(e.condicao, dados)),
  );
}

/**
 * Problemas de um catálogo de fluxo. Lista vazia = pode salvar.
 *
 * @returns {Array<{codigo: string, nivel: 'erro'|'aviso', texto: string}>}
 */
export function validarCatalogo(etapas = []) {
  const problemas = [];
  const porCodigo = new Map();

  for (const e of etapas) {
    const codigo = String(e.codigo || '').trim();
    if (!codigo) {
      problemas.push({ codigo: '', nivel: 'erro', texto: 'Etapa sem código.' });
      continue;
    }
    if (porCodigo.has(codigo)) {
      problemas.push({ codigo, nivel: 'erro', texto: `Código "${codigo}" repetido no fluxo.` });
      continue;
    }
    porCodigo.set(codigo, e);
  }

  for (const [codigo, e] of porCodigo) {
    if (!String(e.titulo || '').trim()) {
      problemas.push({ codigo, nivel: 'erro', texto: 'Etapa sem título.' });
    }
    const sla = e.sla_dias_uteis;
    if (sla !== null && sla !== undefined && sla !== '' && (!Number.isFinite(Number(sla)) || Number(sla) < 0)) {
      problemas.push({ codigo, nivel: 'erro', texto: 'SLA precisa ser um número de dias não negativo.' });
    }

    const dep = e.depende_de;
    if (!dep) continue;

    if (dep === codigo) {
      problemas.push({ codigo, nivel: 'erro', texto: 'A etapa não pode depender dela mesma.' });
      continue;
    }
    if (!porCodigo.has(dep)) {
      problemas.push({ codigo, nivel: 'erro', texto: `Depende de "${dep}", que não existe neste fluxo.` });
      continue;
    }
    // Predecessor que vem DEPOIS na lista não quebra o cálculo (o recálculo do
    // banco itera até estabilizar), mas confunde quem lê o passo a passo.
    if (Number(porCodigo.get(dep).ordem) >= Number(e.ordem)) {
      problemas.push({
        codigo, nivel: 'aviso',
        texto: `Depende de "${dep}", que aparece depois dela na lista.`,
      });
    }
  }

  for (const codigo of detectarCiclos(porCodigo)) {
    problemas.push({ codigo, nivel: 'erro', texto: 'A cadeia de dependências volta para esta etapa (ciclo).' });
  }

  return problemas;
}

/**
 * Códigos presos num ciclo de dependências.
 *
 * Um ciclo não é teórico: basta trocar o predecessor de dois passos sem olhar o
 * outro. O banco tem um limite de iterações que o impede de girar para sempre,
 * mas as etapas ficariam sem prazo e caladas — daí a validação antes de salvar.
 */
function detectarCiclos(porCodigo) {
  const presos = new Set();

  for (const inicio of porCodigo.keys()) {
    const vistos = new Set();
    let atual = inicio;
    while (atual && porCodigo.has(atual)) {
      if (vistos.has(atual)) { presos.add(inicio); break; }
      vistos.add(atual);
      atual = porCodigo.get(atual).depende_de || null;
    }
  }
  return [...presos];
}

/** Só os erros travam o salvamento; aviso é para ler, não para barrar. */
export const temErro = (problemas = []) => problemas.some((p) => p.nivel === 'erro');

/** Sugere um código a partir do título, no formato que o banco usa. */
export function codigoDoTitulo(titulo) {
  return String(titulo || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
