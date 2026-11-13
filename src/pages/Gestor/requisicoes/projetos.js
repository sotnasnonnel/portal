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
    if (!c) return { codigo: null, completo: null, cliente: null };

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
      codigo: c,
      completo: completo && completo.toUpperCase() !== c ? completo : null,
      cliente,
    };
  };
}

/**
 * "ADM DO BRASIL · ADMB-CT27-DESC" — o que dá para mostrar como nome do projeto.
 * `informado` é o nome digitado no próprio formulário (Nome do Cliente da vaga):
 * entra quando o cadastro não achou o cliente, e se não for só o código repetido.
 */
export function nomeProjeto(info, informado) {
  let cliente = info?.cliente || null;
  const inf = String(informado ?? '').trim();
  if (!cliente && normalizarCodigo(inf) && normalizarCodigo(inf) !== normalizarCodigo(info?.codigo)) cliente = inf;
  return [cliente, info?.completo].filter(Boolean).join(' · ');
}

// Campo do formulário que traz o código do projeto, por tipo de requisição.
const CAMPO_PROJETO = {
  formulario_contratacao: 'codigo_proposta_projeto',
  nova_vaga: 'codigo_cliente',
  mapeamento: 'codigo_proposta_cliente',
};

// Campo com o nome do cliente digitado no formulário (só a vaga tem). O
// mapeamento pede apenas o código, então o nome dele vem só do cadastro.
const CAMPO_NOME = { nova_vaga: 'nome_cliente' };

/** Código do projeto como foi digitado, ou null se a requisição não tem/não é código. */
export function codigoProjetoTexto(s, det) {
  const campo = CAMPO_PROJETO[s.tipo];
  const bruto = campo ? det?.[campo] : null;
  return normalizarCodigo(bruto) ? String(bruto).trim() : null;
}

/** Nome do cliente digitado no formulário (só nova vaga), para complementar o nome. */
export function nomeInformado(s, det) {
  const campo = CAMPO_NOME[s.tipo];
  return campo ? det?.[campo] || null : null;
}

// Rótulo da contagem no cabeçalho do grupo.
const ROTULO_GRUPO = {
  formulario_contratacao: ['contratação', 'contratações'],
  nova_vaga: ['vaga', 'vagas'],
  mapeamento: ['mapeamento', 'mapeamentos'],
};

export function rotuloGrupo(tipo, n) {
  const [um, varios] = ROTULO_GRUPO[tipo] || ['requisição', 'requisições'];
  return `${n} ${n === 1 ? um : varios}`;
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

/**
 * Chave que agrupa a requisição: tipo + código. Mapeamento, contratação e vaga
 * do mesmo projeto ficam em grupos separados — são etapas diferentes do
 * processo (o mapeamento é insumo da vaga, que precede a contratação).
 */
export function codigoDeAgrupamento(s, det) {
  const cod = codigoProjetoTexto(s, det);
  return cod ? `${s.tipo}:${normalizarCodigo(cod)}` : null;
}

/**
 * Junta as requisições do mesmo projeto — mapeamentos, vagas e contratações,
 * cada tipo no seu grupo. A lista mantém a ordem original e o grupo entra no
 * lugar da primeira (mais recente) requisição dele.
 * Projeto com uma requisição só não vira grupo: fica como card comum.
 * Itens: { tipo: 'sol', sol } | { tipo: 'grupo', chave, tipoReq, codigo, nomeInformado, sols }.
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
      tipoReq: s.tipo,
      // Mostra o código como foi digitado na requisição mais recente.
      codigo: codigoProjetoTexto(s, detalhes[s.id]),
      nomeInformado: membros.map((m) => nomeInformado(m, detalhes[m.id])).find(Boolean) || null,
      sols: membros,
    });
  }
  return saida;
}
