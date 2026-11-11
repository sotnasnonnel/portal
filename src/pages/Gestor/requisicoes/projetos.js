// Projeto e função das requisições na tela "Aprovar / Acompanhar".
//
// Funções puras (sem Supabase) para rodar no `node --test`. A busca dos dados
// fica em detalhesRequisicoes.js.
//
// O código do projeto vem do Formulário de Contratação, campo LIVRE
// ("Código da(o) proposta/projeto"): chega como "ADMB-CT27", "AURA-CT07-ENBH",
// "Engenharia Digital", "N/A"... Por isso o agrupamento compara o texto
// normalizado e o nome é só um complemento, quando dá para achar.

const SEM_CODIGO = /^(?:-+|\.+|N\/?A|NA|NENHUM|NAO SE APLICA|NÃO SE APLICA|SEM CODIGO|SEM CÓDIGO)$/;

/** Código comparável (maiúsculo, sem espaço sobrando) ou null quando não é código. */
export function normalizarCodigo(txt) {
  const c = String(txt ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!c || SEM_CODIGO.test(c)) return null;
  return c;
}

// "ADMB-CT27" / "ADMB-CT27-DESC" -> "ADMB": a sigla do cliente nos códigos PHD.
// PBI-* são painéis, não clientes, e ficam de fora.
function siglaCliente(codigo) {
  const m = /^([A-Z0-9&]{3,6})-CT\d+/.exec(codigo || '');
  return m && m[1] !== 'PBI' ? m[1] : null;
}

/**
 * Monta o resolvedor de nome a partir das duas fontes:
 *  - obras: portal_organograma_obra do Backoffice ({ cod_phd, cod_ct }), que
 *    completa "ADMB-CT27" em "ADMB-CT27-DESC";
 *  - projetos: horas_projetos do portal ({ nome, cliente, origem_cod_phd }),
 *    que dá o cliente. Pelo código exato e, se não houver, pela sigla — a sigla
 *    é sempre do mesmo cliente (ADMB = ADM DO BRASIL).
 * Devolve (codigo) => { completo, cliente } com null no que não achou.
 */
export function criarResolvedorProjeto({ obras = [], projetos = [] } = {}) {
  const phdPorCodigo = new Map();   // COD_PHD -> cod_phd
  const phdPorCt = new Map();       // COD_CT  -> Set(cod_phd)
  for (const o of obras) {
    const phd = String(o.cod_phd || '').trim();
    if (!phd) continue;
    phdPorCodigo.set(phd.toUpperCase(), phd);
    const ct = String(o.cod_ct || '').trim().toUpperCase();
    if (ct) {
      if (!phdPorCt.has(ct)) phdPorCt.set(ct, new Set());
      phdPorCt.get(ct).add(phd);
    }
  }

  const clientePorCodigo = new Map(); // CODIGO -> cliente
  const clientesPorSigla = new Map(); // SIGLA  -> Set(cliente)
  for (const p of projetos) {
    const cliente = String(p.cliente || '').trim();
    if (!cliente) continue;
    for (const k of [p.origem_cod_phd, p.nome]) {
      const cod = normalizarCodigo(k);
      if (!cod) continue;
      clientePorCodigo.set(cod, cliente);
      const sigla = siglaCliente(cod);
      if (sigla) {
        if (!clientesPorSigla.has(sigla)) clientesPorSigla.set(sigla, new Map());
        clientesPorSigla.get(sigla).set(cliente.toUpperCase(), cliente);
      }
    }
  }

  return (codigo) => {
    const c = normalizarCodigo(codigo);
    if (!c) return { completo: null, cliente: null };

    let completo = phdPorCodigo.get(c) || null;
    if (!completo && phdPorCt.has(c) && phdPorCt.get(c).size === 1) {
      completo = [...phdPorCt.get(c)][0];
    }

    let cliente = clientePorCodigo.get(c)
      || (completo && clientePorCodigo.get(completo.toUpperCase()))
      || null;
    if (!cliente) {
      const sigla = siglaCliente(c);
      const opcoes = sigla && clientesPorSigla.get(sigla);
      if (opcoes && opcoes.size === 1) cliente = [...opcoes.values()][0];
    }

    return {
      completo: completo && completo.toUpperCase() !== c ? completo : null,
      cliente,
    };
  };
}

/** "ADM DO BRASIL · ADMB-CT27-DESC" — o que dá para mostrar como nome do projeto. */
export function nomeProjeto(info) {
  return [info?.cliente, info?.completo].filter(Boolean).join(' · ');
}

/**
 * Função (cargo) que a requisição trata, para aparecer no card.
 * `det` é a linha do formulário de detalhe (contratação, vaga, mapeamento).
 */
export function funcaoDaRequisicao(s, det) {
  switch (s.tipo) {
    case 'formulario_contratacao': return det?.cargo_nivel?.trim() || null;
    case 'nova_vaga':
    case 'mapeamento': return det?.funcao?.trim() || null;
    case 'aumento_salario': return s.funcao_proposta?.trim() || s.colaborador?.funcao?.trim() || null;
    default: return s.colaborador?.funcao?.trim() || null;
  }
}

/** Código de projeto que agrupa a requisição (hoje só as contratações). */
export function codigoDeAgrupamento(s, det) {
  if (s.tipo !== 'formulario_contratacao') return null;
  return normalizarCodigo(det?.codigo_proposta_projeto);
}

/**
 * Junta as contratações do mesmo projeto. A lista mantém a ordem original e o
 * grupo entra no lugar da primeira (mais recente) contratação dele. Projeto com
 * uma contratação só não vira grupo: fica como card comum.
 * Itens: { tipo: 'sol', sol } | { tipo: 'grupo', chave, codigo, sols }.
 */
export function agruparPorProjeto(lista, detalhes = {}) {
  const porChave = new Map();
  for (const s of lista) {
    const chave = codigoDeAgrupamento(s, detalhes[s.id]);
    if (!chave) continue;
    if (!porChave.has(chave)) porChave.set(chave, []);
    porChave.get(chave).push(s);
  }

  const saida = [];
  const emitidos = new Set();
  for (const s of lista) {
    const chave = codigoDeAgrupamento(s, detalhes[s.id]);
    const membros = chave ? porChave.get(chave) : null;
    if (!membros || membros.length < 2) { saida.push({ tipo: 'sol', sol: s }); continue; }
    if (emitidos.has(chave)) continue;
    emitidos.add(chave);
    saida.push({
      tipo: 'grupo',
      chave,
      // Mostra o código como foi digitado na contratação mais recente.
      codigo: String(detalhes[s.id].codigo_proposta_projeto).trim(),
      sols: membros,
    });
  }
  return saida;
}
