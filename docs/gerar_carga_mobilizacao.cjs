/* Gera o SQL de carga do histórico de Mobilização a partir da planilha.
 *
 *   Entrada: referencia/planilha_modulo_mobilizacao.xlsx
 *   Saída:   supabase/supabase_import_mobilizacao_2026.sql
 *
 *   node docs/gerar_carga_mobilizacao.cjs
 *
 * O CATÁLOGO de etapas NÃO sai daqui: ele é escrito à mão em
 * supabase/supabase_seed_mobilizacao_catalogo.sql, porque a cadeia de
 * dependências só existe dentro das FÓRMULAS das colunas "DATA PREV", e
 * interpretar fórmula de Excel para descobrir 24 linhas estáveis não se paga.
 * O que muda com a planilha é o histórico, e é ele que sai daqui.
 *
 * LAYOUT DA PLANILHA (as três abas seguem o mesmo desenho):
 *   linha 1 = SLA de cada etapa, acima da coluna "DATA PREV" dela
 *   linha 2 = nome da etapa, com índice ("2 - EXAMES")
 *   linha 3 = cabeçalho
 *   linha 4+ = dados
 *
 * ARMADILHA: o `!ref` das abas começa em B, então os índices do array devolvido
 * por sheet_to_json ficam DESLOCADOS UM À ESQUERDA das letras do Excel — o que
 * o Excel chama de AK é o índice 35 aqui. Os índices abaixo são os do array.
 *
 * O QUE NÃO É IMPORTADO, de propósito: as datas PREVISTAS. Elas foram
 * calculadas com a régua antiga (MOB.PESSOAS somava dias CORRIDOS, as outras
 * duas usavam WORKDAY), e trazê-las deixaria o histórico com duas réguas
 * conflitantes. Entra o que aconteceu — data real e situação — e a previsão é
 * recalculada pelo banco com a regra nova, igual para todos.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
// O nome do arquivo muda a cada versao que o time exporta. Fica numa constante
// so, e o cabecalho do SQL gerado imprime ESTE valor — assim o SQL sempre diz
// de qual arquivo ele saiu, sem depender de alguem lembrar de atualizar o texto.
const PLANILHA = 'ADM_GESTAO_DE_MOBILIZACAO_ATUALIZADA (1).xlsx';
const ENTRADA = path.join(RAIZ, 'referencia', PLANILHA);
const SAIDA = path.join(RAIZ, 'supabase', 'supabase_import_mobilizacao_2026.sql');

/**
 * Só 2026 (definição do cliente) — com uma exceção: processo em andamento entra
 * de qualquer ano, porque é trabalho que ainda está na mão do time.
 */
const ANO = '2026';

// ---------------------------------------------------------------------------
// Mapeamento das abas
//
// `corte` é a coluna de data que decide se a linha é de 2026. Vale a data REAL
// quando existe, e a prevista como reserva: linha em andamento ainda não tem
// data real, e descartá-la deixaria de fora justamente o que está rodando.
//
// `etapas` casa cada passo do catálogo (mesmo `codigo` do seed) com o par de
// colunas [DATA REAL, célula de "feito"] da planilha.
// ---------------------------------------------------------------------------
const ABAS = [
  {
    aba: 'MOB.PESSOAS',
    fluxo: 'mobilizacao_pessoa',
    status: 0,
    responsavel: 1,
    identidade: 4,          // COLABORADOR
    corte: [36, 35],        // DATA REAL - FORMS, senão DATA PREV - FORMS
    dataBase: [36, 35],
    campos: {
      coo_phd: 22, ger_phd: 23, empresa_phd: 26, cliente_phd: 27,
      cliente_final: 28, local_obra: 29, cod_ct: 30, cod_phd: 31, observacoes: 65,
    },
    etapas: [
      { codigo: 'assinatura_contrato', real: 33 },
      { codigo: 'abertura_chamado', real: 36 },
      { codigo: 'exames', real: 39 },
      { codigo: 'emissao_aso', real: 42 },
      { codigo: 'treinamentos_agendados', real: 45 },
      { codigo: 'conclusao_treinamentos', real: 48 },
      { codigo: 'alteracao_contratual', real: 51 },
      { codigo: 'envio_dossie', real: 54 },
      { codigo: 'postagem_cliente', real: 57 },
      { codigo: 'aprovacao_cliente_final', real: 60 },
      // Criada no catalogo DEPOIS da planilha, entao nao tem coluna: `real:
      // null`. No dia a dia ela fica pendente, como qualquer passo sem data; o
      // que muda e a linha FINALIZADA, onde ela e concluida junto com o resto,
      // porque um processo que a planilha da por encerrado nao pode ter passo
      // em aberto na Torre.
      { codigo: 'integracao_no_cliente', real: null },
      { codigo: 'liberacao_cracha', real: 63 },
    ],
    // DATA REAL FINALIZAÇÃO — a data que fecha a linha inteira.
    fim: 17,
  },
  {
    aba: 'MOB.EMPRESAS',
    fluxo: 'mobilizacao_empresa',
    status: 0,
    responsavel: 1,
    identidade: 3,          // CLIENTE
    corte: [31, 30],        // DATA REAL - EMAIL, senão DATA PREV - EMAIL
    dataBase: [31, 30],
    campos: {
      coo_phd: 17, ger_phd: 18, empresa_phd: 21, cliente_final: 22,
      local_obra: 23, cod_ct: 24, cod_phd: 25, contrato: 26, observacoes: 51,
    },
    identidadeCampo: 'cliente_phd',
    etapas: [
      { codigo: 'assinatura_contrato', real: 28 },
      { codigo: 'email_novo_contrato', real: 31 },
      { codigo: 'contato_cliente_doc', real: 34 },
      { codigo: 'envio_anexo_06', real: 37 },
      { codigo: 'solicitacao_programas_legais', real: 40 },
      { codigo: 'envio_programas_legais', real: 43 },
      { codigo: 'postagem_cliente', real: 46 },
      { codigo: 'aprovacao', real: 49 },
      // Mesma situacao da integracao no fluxo de pessoas: etapa nova, sem coluna.
      { codigo: 'aprovacao_da_subcontratacao_phd', real: null },
    ],
    fim: 13,
  },
  {
    aba: 'DESMOB. PESSOAS',
    fluxo: 'desmobilizacao_pessoa',
    status: 0,
    responsavel: null,      // esta aba não tem coluna de responsável
    identidade: 4,          // COLABORADOR
    // Esta aba não tem DATA REAL - FORMS confiável (só 24 das 69 linhas têm) e
    // a coluna de devolução do crachá cobre mais casos. A conferência de 2026
    // usa a primeira que existir.
    corte: [22, 21, 2, 28],
    dataBase: [22, 21, 2],
    campos: {
      coo_phd: 14, empresa_phd: 15, cliente_phd: 16, cliente_final: 17,
      local_obra: 18, cod_ct: 19, cod_phd: 20, observacoes: 36,
    },
    etapas: [
      { codigo: 'abertura_chamado', real: 22 },
      { codigo: 'recebimento_cracha', real: 25 },
      { codigo: 'entrega_cracha_cliente', real: 28 },
      { codigo: 'envio_protocolo_cracha', real: 31 },
      { codigo: 'desmobilizacao_finalizada', real: 34 },
    ],
    // Esta aba nao tem coluna de "data real de finalizacao"; o fecho cai na
    // maior data real da propria linha.
    fim: null,
  },
];

/**
 * Vocabulário da planilha -> o do banco. É literal de propósito: os três
 * valores da coluna STATUS PROCESSO viraram o check de mobilizacao_processos.
 */
const STATUS = {
  'em andamento': 'em_andamento',
  finalizado: 'finalizado',
  cancelado: 'cancelado',
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Serial do Excel -> 'AAAA-MM-DD'. Fora da faixa plausível, devolve null. */
function data(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000 || n > 60000) return null;
  // 30/12/1899 é a época do Excel; a conta em UTC evita o escorregão de fuso
  // que jogaria toda data para o dia anterior.
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
}

const texto = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};

/** Escape de aspas simples para literal SQL. */
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const jsonSql = (obj) => `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;

/** Sem acento, minúsculo, espaços colapsados — para a chave e para o de-para. */
const normal = (v) => String(v ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().replace(/\s+/g, ' ')
  .toLowerCase();

/** Primeira das colunas candidatas que tiver data. */
const primeiraData = (linha, colunas) => {
  for (const c of colunas) {
    const d = data(linha[c]);
    if (d) return d;
  }
  return null;
};

/**
 * CHAVE NATURAL da linha — o que identifica um processo entre recargas.
 *
 * A coluna "NÚMERO DO CHAMADO" existe na planilha mas está VAZIA em todas as
 * linhas, então não serve. Sobram identidade + fluxo + data-base, que é o que
 * distingue "mobilizar o Fulano em março" de "mobilizar o Fulano em setembro".
 *
 * A chave vai gravada em mobilizacao_processos.carga_chave, com índice único
 * parcial: é ela que faz a segunda carga atualizar em vez de duplicar.
 */
const chaveDe = (fluxo, identidade, dataBase) =>
  [fluxo, normal(identidade), dataBase || 'sem-data'].join('|');

/**
 * A linha entra na carga?
 *
 * Só 2026, sem exceção — que é o recorte combinado desde o início.
 *
 * Houve uma exceção aqui: "processo em andamento entra de qualquer ano", pela
 * ideia de que trabalho aberto é trabalho de hoje. Ela foi removida em
 * 09/09/2026 porque o que arrastou não foi trabalho: foram as 2 únicas linhas
 * de DESMOB. PESSOAS marcadas "Em andamento", ambas mortas — uma parada desde
 * outubro de 2025, a outra sem data nenhuma e com zero passos feitos. Elas
 * apareciam na reunião de torre como desmobilizações ativas, e não são.
 *
 * Conferido antes de tirar: com a regra estrita, PESSOAS e EMPRESAS não perdem
 * NENHUMA linha (todo o trabalho aberto delas já é de 2026). O único efeito é
 * a desmobilização voltar a zero, que é o número real.
 */
const entraNaCarga = (status, corte) => Boolean(corte) && corte.startsWith(ANO);

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
function lerAba(wb, cfg) {
  const ws = wb.Sheets[cfg.aba];
  if (!ws) throw new Error(`Aba não encontrada: ${cfg.aba}`);

  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
  const dados = linhas.slice(3).filter((r) => r && (texto(r[cfg.identidade]) || texto(r[cfg.status])));

  const processos = [];
  const descartadas = { semAno: 0, semIdentidade: 0, semStatus: 0 };
  const chaves = new Set();
  const duplicadas = [];

  for (const linha of dados) {
    const identidade = texto(linha[cfg.identidade]);
    if (!identidade) { descartadas.semIdentidade += 1; continue; }

    const statusBruto = normal(linha[cfg.status]);
    const status = STATUS[statusBruto];
    if (!status) { descartadas.semStatus += 1; continue; }

    const corte = primeiraData(linha, cfg.corte);
    if (!entraNaCarga(status, corte)) { descartadas.semAno += 1; continue; }

    const dataBase = primeiraData(linha, cfg.dataBase);
    const chave = chaveDe(cfg.fluxo, identidade, dataBase);
    if (chaves.has(chave)) { duplicadas.push(chave); continue; }
    chaves.add(chave);

    const campos = {};
    for (const [alvo, col] of Object.entries(cfg.campos)) {
      const v = texto(linha[col]);
      if (v) campos[alvo] = v;
    }
    const campoIdentidade = cfg.identidadeCampo || 'profissional_nome';

    const etapas = [];
    for (const e of cfg.etapas) {
      const real = e.real === null ? null : data(linha[e.real]);
      if (real) etapas.push({ codigo: e.codigo, status: 'concluida', real });
    }

    // Linha FINALIZADA: nenhum passo dela pode ficar pendente.
    //
    // A regra antiga era "sem data real, o passo fica pendente", para não
    // inventar data. O efeito colateral apareceu na Torre: a planilha diz 220
    // mobilizações de pessoas finalizadas, mas quase nenhuma tem as 12 datas
    // preenchidas — e `mob_recalcular` deduz o status do processo CONTANDO
    // etapas concluídas, então uma data faltando ressuscitava o processo inteiro
    // como "em andamento". Deu 34 processos em andamento onde a planilha tem 13,
    // e ~1189 etapas de trabalho já encerrado enchendo a tela da reunião.
    //
    // A coluna STATUS da planilha é a autoridade — é ela que o time atualiza. Se
    // ela diz Finalizado, o que falta é registro, não trabalho. A data usada é a
    // de fecho da linha (DATA REAL FINALIZAÇÃO), que é um limite superior real:
    // o processo terminou naquele dia, então cada passo terminou até lá.
    if (status === 'finalizado') {
      const jaTem = new Map(etapas.map((e) => [e.codigo, e.real]));
      const dataFim = (cfg.fim !== null && cfg.fim !== undefined ? data(linha[cfg.fim]) : null)
        || [...jaTem.values()].sort().pop()
        || dataBase;
      // Sem data nenhuma na linha não há o que fechar: fica como está, e a
      // conferência do fim do arquivo mostra o caso.
      if (dataFim) {
        etapas.length = 0;
        for (const e of cfg.etapas) {
          etapas.push({ codigo: e.codigo, status: 'concluida', real: jaTem.get(e.codigo) || dataFim });
        }
      }
    }

    processos.push({
      fluxo: cfg.fluxo,
      dados: {
        [campoIdentidade]: identidade,
        titulo: identidade,
        data_base: dataBase,
        carga_chave: chave,
        ...campos,
      },
      status,
      responsavel: cfg.responsavel === null ? null : texto(linha[cfg.responsavel]),
      etapas,
    });
  }

  return { processos, descartadas, duplicadas };
}

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------
function gerar() {
  const wb = XLSX.readFile(ENTRADA);
  const out = [];
  const resumo = [];
  const responsaveis = new Set();

  out.push('-- Import: histórico de Mobilização de 2026');
  out.push('-- ============================================================================');
  out.push(`-- GERADO por docs/gerar_carga_mobilizacao.cjs em ${new Date().toISOString().slice(0, 10)}.`);
  out.push('-- NÃO EDITAR À MÃO: se a planilha mudar, regere.');
  out.push('--');
  out.push(`-- Fonte: referencia/${PLANILHA}`);
  out.push(`-- Recorte: só ${ANO} (definição do cliente), MAIS todo processo ainda`);
  out.push('-- em andamento de anos anteriores — esse continua sendo trabalho de hoje.');
  out.push('--');
  out.push('-- CHAVE NATURAL (grava em mobilizacao_processos.carga_chave, índice único');
  out.push('-- parcial): fluxo | identidade normalizada | data-base. A coluna');
  out.push('-- "NÚMERO DO CHAMADO" da planilha existe mas está vazia em TODAS as linhas,');
  out.push('-- por isso não serve de chave — ela passa a ser preenchida pelo gatilho do');
  out.push('-- Administrativo daqui para frente.');
  out.push('--');
  out.push('-- RECARGA: rodar de novo NÃO duplica (mob_abrir devolve o processo existente)');
  out.push('-- e NÃO sobrescreve etapa já tocada pelo portal (mob_carga_etapa só grava');
  out.push('-- quando tocada_no_portal is false). O contrário não vale: quem atualizar só');
  out.push('-- no portal deixa a planilha desatualizada — isso é combinado operacional.');
  out.push('--');
  out.push('-- PRÉ-REQUISITO: supabase_seed_mobilizacao_catalogo.sql aplicado antes. Sem');
  out.push('-- catálogo os processos nascem sem etapa nenhuma e a carga não tem o que');
  out.push('-- atualizar.');
  out.push('-- ============================================================================');
  out.push('');
  out.push('begin;');
  out.push('');

  for (const cfg of ABAS) {
    const { processos, descartadas, duplicadas } = lerAba(wb, cfg);
    resumo.push({ aba: cfg.aba, total: processos.length, descartadas, duplicadas: duplicadas.length });

    out.push(`-- ${'-'.repeat(74)}`);
    out.push(`-- ${cfg.aba} -> ${cfg.fluxo}: ${processos.length} processo(s) de ${ANO}`);
    out.push(`--   descartados: ${descartadas.semAno} fora de ${ANO}, `
      + `${descartadas.semIdentidade} sem identificação, ${descartadas.semStatus} sem situação`
      + (duplicadas.length ? `, ${duplicadas.length} repetido(s) pela chave natural` : ''));
    out.push(`-- ${'-'.repeat(74)}`);

    if (!processos.length) {
      out.push(`-- Nada a importar desta aba em ${ANO}.`);
      out.push('');
      continue;
    }

    for (const p of processos) {
      if (p.responsavel) responsaveis.add(p.responsavel);
      // Uma linha por processo, com as etapas dentro do jsonb.
      //
      // O status viaja SEMPRE. Antes só 'cancelado' ia, e os outros dois eram
      // deduzidos das etapas pelo recálculo — o que fazia o banco discordar da
      // planilha toda vez que faltasse uma data. Agora a planilha manda: para
      // 'finalizado' as etapas já vão todas concluídas (ver acima), então o
      // recálculo chega sozinho à mesma conclusão e os dois nunca divergem.
      const dados = { ...p.dados, etapas: Object.fromEntries(p.etapas.map((e) => [e.codigo, e.real])) };
      if (p.status !== 'em_andamento') dados.status = p.status;
      out.push(`select app_private.mob_carga_processo(${q(p.fluxo)}, ${jsonSql(dados)});`);
    }
    out.push('');
  }

  out.push('commit;');
  out.push('');
  out.push('-- Conferência.');
  out.push('do $$');
  out.push('begin');
  out.push("  raise notice 'Processos de carga: %', (select count(*) from public.mobilizacao_processos where origem = 'planilha');");
  out.push('end $$;');
  out.push('');

  if (responsaveis.size) {
    out.push('-- ----------------------------------------------------------------------------');
    out.push('-- RESPONSÁVEIS que a planilha cita, ainda como texto solto.');
    out.push('--');
    out.push('-- A planilha guarda só o primeiro nome ("Edijane", "Ivone"), e o banco quer');
    out.push('-- o id do colaborador. Todas são do time do Administrativo, então o de-para');
    out.push('-- casa com quem já tem administrativo_role. Rode o UPDATE abaixo depois de');
    out.push('-- conferir os nomes — a carga NÃO chuta ninguém.');
    out.push('--');
    for (const r of [...responsaveis].sort()) {
      out.push(`--   ${r}`);
    }
    out.push('--');
    out.push('-- Exemplo:');
    out.push('--   update public.mobilizacao_processos p');
    out.push("--      set responsavel_id = (select id from public.colaboradores where nome ilike 'Edijane%' limit 1)");
    out.push("--    where p.origem = 'planilha' and p.responsavel_id is null;");
    out.push('-- ----------------------------------------------------------------------------');
  }

  fs.writeFileSync(SAIDA, `${out.join('\n')}\n`, 'utf8');

  // Relatório no terminal — é o que diz se o recorte fez sentido.
  console.log(`\nGerado: ${path.relative(RAIZ, SAIDA)}\n`);
  for (const r of resumo) {
    console.log(`  ${r.aba.padEnd(18)} ${String(r.total).padStart(4)} processo(s) de ${ANO}`
      + `   (descartados: ${r.descartadas.semAno} de outro ano, `
      + `${r.descartadas.semIdentidade} sem identificação, ${r.descartadas.semStatus} sem situação`
      + (r.duplicadas ? `, ${r.duplicadas} repetidos` : '') + ')');
  }
  const total = resumo.reduce((s, r) => s + r.total, 0);
  console.log(`\n  TOTAL: ${total} processo(s).`);
  if (responsaveis.size) {
    console.log(`  Responsáveis a mapear para colaboradores: ${[...responsaveis].sort().join(', ')}`);
  }
  console.log('');
}

// Roda só quando invocado direto. Exportado para os testes: a conversão de
// data serial do Excel e a normalização da chave são as duas contas que, se
// errarem, duplicam processo ou jogam o ano inteiro fora — e nenhuma das duas
// dá para conferir olhando o SQL gerado.
if (require.main === module) gerar();

module.exports = { data, normal, chaveDe, primeiraData, entraNaCarga, q, ABAS, STATUS };
