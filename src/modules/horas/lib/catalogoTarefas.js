// ============================================================================
// Catálogo FIXO de tarefas do Controle de Horas.
// Fonte: referencia/Cópia de Clockify tarefas.xlsx (aba "Clockify") — gerado a
// partir das colunas SIGLA / TAREFAS / ETIQUETAS / TAREFA 2, sem alterar texto.
//
// Substituiu as "atividades controladas" que cada gerência configurava: os
// campos do apontamento agora são os mesmos para toda a empresa.
//
// Cadeia de filtro (regra da planilha):
//   SIGLA -> TAREFA  — só existem os pares listados em CATALOGO. A tarefa fica
//                      BLOQUEADA até a sigla ser escolhida, e trocar a sigla
//                      derruba a tarefa que não pertence mais a ela.
//   ETIQUETA e TAREFA 2 — listas fechadas independentes: na planilha essas duas
//                      colunas não acompanham a linha da tarefa (só as 13
//                      primeiras linhas estão preenchidas, sem relação com a
//                      sigla), então valem para qualquer par sigla/tarefa e não
//                      dependem de campo nenhum.
//
// A mesma tarefa pode existir em mais de uma sigla (ex.: "CURVA FINANCEIRA"
// está em PTA e POP) — por isso a validação é sempre pelo PAR, nunca pela
// tarefa sozinha.
// ============================================================================

// [sigla, tarefa]
export const CATALOGO = [
  ['PTA', 'REUNIÃO GERENCIAL E CONTRATUAL'],
  ['POP', 'CHECK-IN/OUT'],
  ['PTA', 'GESTÃO DE PENDÊNCIAS'],
  ['PTA', 'VALIDAÇÃO DO AVANÇO SEMANAL DAS EMPREITEIRAS'],
  ['PTA', 'CONTROLE PBI'],
  ['POP', 'ATUALIZAÇÃO DAS DEMANDAS DIÁRIAS NO ONENOTE/PLANNER'],
  ['POP', 'ROTINA DE LEVANTAMENTO E ALINHAMENTOS DE CAMPO'],
  ['PTA', 'LISTA DE PENDÊNCIA ESTRATÉGICA / PLANO DE AÇÃO'],
  ['PTA', '6WLA'],
  ['POP', 'ATUALIZAÇÃO DO CRONOGRAMA MASTER E CURVAS'],
  ['PTA', 'REUNIÃO DE ACOMPANHAMENTO SEMANAL COM TERCEIRAS'],
  ['PTA', 'REUNIÃO DE ALINHAMENTO COM O CLIENTE'],
  ['PTA', 'REUNIÃO DE ALINHAMENTO INTERNA'],
  ['POP', 'ATUALIZAÇÃO DE HIGHLIGHTS E PRÓXIMOS PASSOS'],
  ['PTA', 'GESTÃO A VISTA'],
  ['POP', 'PROGRAMAÇÃO SEMANAL'],
  ['POP', 'MAPA DE CONTROLE'],
  ['POP', 'CRONOGRAMA'],
  ['PTA', 'REUNIÃO DE FOLLOW-UP'],
  ['PTA', 'REUNIÃO SEMANAL DE STAFF PHD INTERNA E COM O CLIENTE'],
  ['PTA', 'CONTROLE DE ENGENHARIA'],
  ['PTA', 'RELATÓRIO SEMANAL'],
  ['PES', 'ATUALIZAÇÃO E ANÁLISE MASTER'],
  ['PES', 'ATUALIZAÇÃO DE CRONOGRAMA DE ENTREGA'],
  ['POP', 'ATUALIZAR RELATÓRIO DO WAVE'],
  ['PTA', 'ELABORAÇÃO DE CRONOGRAMA FEL'],
  ['PTA', 'APOIO AO HANDOVER'],
  ['POP', 'ATUALIZAÇÃO DO CRONOGRAMA MASTER DE INFORMAÇÕES DE SUPRIMENTO E ENGENHARIA'],
  ['PTA', 'DESVIOS DA OBRA'],
  ['PTA', 'REUNIÃO DE ALINHAMENTO DAS ATIVIDADES ALFA'],
  ['PES', 'GERAR DOCUMENTO DE PLANO DE GERENCIAMENTO PHD'],
  ['PES', 'PLANEJAMENTO DETALHADO JUNTO ÀS EMPREITEIRAS (ANÁLISE DE CRONOGRAMAS)'],
  ['PTA', 'REUNIÃO DE ALINHAMENTO DAS ATIVIDADES TMSA'],
  ['PES', 'MAPA DE SUPRIMENTOS'],
  ['PTA', 'ACOMPANHAMENTO E VALIDAÇÃO DA LD'],
  ['PTA', 'GESTÃO DE INTERFACES DA ENGENHARIA COM SUPRIMENTOS'],
  ['PTA', 'CURVA FÍSICA'],
  ['PTA', 'ANÁLISE CURVA E AVANÇOS'],
  ['PTA', 'CRONOGRAMA DE ENGENHARIA'],
  ['PTA', 'ANÁLISE DETALHADA DOS SUPRIMENTOS CRÍTICOS'],
  ['PTA', 'RELATÓRIO MENSAL DE RESULTADOS'],
  ['POP', 'ABERTURA DE REQUISIÇÕES DE COMPRAS NO MAXIMO'],
  ['PTA', 'NÁLISE DE DESVIOS'],
  ['PTA', 'ALIMENTAR BASE DE DADOS PBI E INDICADORES - LPS'],
  ['PTA', 'PROGRAMAÇÃO SEMANAL'],
  ['PES', 'TAKE-OFF'],
  ['PES', 'PULL PLANNING'],
  ['POP', 'HISTOGRAMA'],
  ['PTA', 'SUPORTE A REUNIÕES DE STATUS E TOMADA DE DECISÃO'],
  ['PTA', 'CURVA FINANCEIRA'],
  ['PTA', 'GESTÃO DA DOCUMENTAÇÃO'],
  ['PTA', 'DASHBOARD DE ACOMPANHAMENTO'],
  ['PTA', 'VALIDAÇÃO DE CRONOGRAMA'],
  ['POP', 'PROGRAMAÇÃO SEMANAL DE MONTAGEM'],
  ['PTA', 'ESTRUTURAÇÃO DAS COMPOSIÇÕES DO ORÇAMENTO'],
  ['PTA', 'LISTA DE PENDÊNCIA ESTRATÉGICA'],
  ['POP', 'CHECK-IN/ OUT'],
  ['PTA', 'RAO / DESVIOS DA OBRA'],
  ['POP', 'CURVA DE COMMODITIES'],
  ['PTA', 'REUNIÃO DE ALINHAMENTO DAS ATIVIDADES COM A EMPRESA SANTANNA'],
  ['POP', 'CURVA FISICA'],
  ['PTA', 'MEDIÇÃO'],
  ['PTA', 'CURVA FISICA'],
  ['PTA', 'REUNIÃO DE AQUISIÇÃO - SUPRIMENTOS GOIASA'],
  ['PTA', 'REUNIÃO COM FORNECEDORES'],
  ['PTA', 'REUNIÃO DE PLANEJAMENTO - CIVIL E MONTAGEM'],
  ['PTA', 'CONTROLE DE ARMAZENAMENTO DE MATERIAIS'],
  ['PTA', 'REUNIÃO GERENCIAIS E CONTRATUAL'],
  ['PES', 'ANÁLISE DA DOCUMENTAÇÃO'],
  ['POP', 'ENVIO DO PPC'],
  ['PTA', 'ATUALIZAÇÃO DE CRONOGRAMA - INTERNO'],
  ['PTA', 'PLANEJAMENTO DETALHADO JUNTO ÀS EMPREITEIRAS (IMPLANTAÇÃO LPS)'],
  ['PTA', 'REUNIÃO DE PROGRAMAÇÃO SEMANAL'],
  ['PES', 'PLANEJAMENTO 90 DIAS'],
  ['PES', 'DETALHAMENTO DO CAMINHO DA CONSTRUÇÃO COM VALIDAÇÃO DE ENGENHARIA E SUPRIMENTOS'],
  ['POP', 'DASHBOARD DE ACOMPANHAMENTO / RELATÓRIO SEMANAL'],
  ['PTA', 'ANALISE DO RELATORIO DE DELIGENCIAMENTO'],
  ['PES', 'ELABORAÇÃO DE CRONOGRAMA DO PROJETO'],
  ['PTA', 'GESTÃO DE INTERFACES ENTRE ENGENHARIA, SUPRIMENTOS E OBRAS'],
  ['POP', 'ATUALIZAR RELATÓRIOS'],
  ['PTA', 'VERIFICAÇÃO DE COMPLETUDE E CONSISTÊNCIA DOS ENTREGÁVEIS'],
  ['POP', 'LISTA DE PENDÊNCIA PARA COMISSIONAMENTO / PLANO DE AÇÃO'],
  ['PTA', 'ELABORAÇÃO REORÇAMENTO'],
  ['POP', 'FUP DO PROCESSO DE COMPRAS'],
  ['PTA', 'REUNIÃO ONE TO ONE COM GESTORES PARA PLANEJAMENTO'],
  ['POP', 'CURVA FINANCEIRA'],
  ['PES', 'ELABORAÇÃO DE MEMÓRIA DE CÁLCULO'],
  ['PES', 'ESTRATÉGIA DE MOBILIZAÇÃO'],
  ['POP', 'PPC - CAUSA DE RAIZ DE DESVIOS'],
  ['PTA', 'APRESENTAÇÃO SEMANAL'],
  ['PES', 'DEFINIÇÃO DE BASELINE DE PRAZOS DE SUPRIMENTOS'],
  ['PTA', 'GESTÃO DE CONTRATADAS, CONTROLE DA EVOLUÇÃO FÍSICA DA MANUFATURA'],
  ['POP', 'ATUALIZAÇÕES DAS AÇÕES LOOKAHEAD'],
  ['POP', 'CONTROLE DE DESVIOS DE ESCOPO DE SUPRIMENTOS, MANUFATURA E MOBILIZAÇÃO'],
  ['PTA', 'ACOMPANHAMENTO DO CRONOGRAMA DE ENGENHARIA'],
  ['POP', 'CONSTRUÇÃO, ATUALIZAÇÃO E REPORTING DO CRONOGRAMA MASTER'],
  ['POP', 'CONTROLE DE PRIORIDADES DE ENGENHARIA PARA OBRA'],
  ['POP', 'ENVIO DE REPORTING SEMANAL DOS PONTOS CRÍTICOS E DESVIOS DA ENGENHARIA CLIENTE E CONTRATADA'],
  ['PTA', 'ELABORAÇÃO DA DECLARAÇÃO DE ESCOPO'],
  ['PTA', 'META FINANCEIRA'],
  ['PTA', 'ANÁLISE DA PROGRAMAÇÃO SEMANAL E ADERENCIA DE INDICADORES'],
  ['PTA', 'CONTROLE DE SUPRIMENTOS / AQUISIÇÕES'],
  ['PTA', 'CONSOLIDAÇÃO DO STATUS DO MAPA DE SUPRIMENTOS E REPORTING'],
  ['PTA', 'ANÁLISE DE CAMINHO CRÍTICO DE ENGENHARIA'],
  ['PTA', 'HISTOGRAMA'],
  ['POP', 'CONTROLE DE DESVIOS DE ESCOPO - LOOK AHEAD E RITMO, PREVISIBILIDADE E TENDENCIA DE ENGENHARIA'],
  ['PES', 'ELABORAÇÃO DE PLANO DE ATAQUE'],
  ['PES', 'DEFINIÇÃO DE MARCOS CRÍTICOS DE AQUISIÇÃO'],
  ['PTA', 'ANÁLISE DE IMPACTO DE ATRASOS DE ENGENHARIA EM SUPRIMENTOS'],
  ['PTA', 'MEMÓRIA DE CALCULO'],
  ['POP', 'REPORT DIÁRIO'],
  ['PTA', 'DIRECIONAMENTO ESTRATÉGICO'],
  ['PTA', 'MAPEAMENTO DE ITENS CRÍTICOS'],
  ['PTA', 'REPORT PROGRAMAÇÃO SEMANAL'],
  ['PTA', 'ELABORAÇÃO DA BASE DO PBI'],
  ['POP', 'REUNIÃO ONE TO ONE COM GESTORES PARA ATUALIZAÇÃO DE FORECAST'],
  ['PTA', 'EAP'],
  ['PES', 'EDIÇÃO DO MAPA DE SUPRIMENTOS'],
  ['PTA', 'PLANEJAMENTO DETALHADO JUNTO ÀS EMPREITEIRAS (ANÁLISE DE CRONOGRAMAS)'],
  ['PES', 'POC (APRESENTAÇÃO DO POC)'],
  ['PES', 'ATUALIZAÇÃO BASE DE DADOS - ENGEFORM'],
  ['POP', 'REPORTING DE TENDENCIA POR DISCIPLINA'],
  ['POP', 'RDO'],
  ['POP', 'INCLUSÃO, ORGANIZAÇÃO, ENVIO PARA PAGAMENTO E CONTROLE DE NOTAS FISCAIS'],
  ['POP', 'FUP DO HELPDESK CENTRAL DE NOTAS E CADASTROS'],
  ['PTA', 'CRONOGRAMA DETALHADO DE COMISSIONAMENTO'],
  ['PES', 'ANÁLISE DETALHADA DOS SUPRIMENTOS CRÍTICOS'],
  ['PTA', 'ELABORAÇÃO DE RAO / DESVIOS DA OBRA'],
  ['PTA', 'CHECK LIST PARA ANÁLISE FINANCEIRA DOS PROJETOS'],
  ['PES', 'RMA VALE ATÉ 1°DIA útil'],
  ['PES', 'ELABORAÇÃO DE PLANEJAMENTO 30 DIAS ATÉ DIA 28 DE CADA MÊS - VALE'],
  ['PES', 'ELABORAÇÃO DO PLANEJAMENTO DO PLANO DE COMISSIONAMENTO'],
  ['POP', 'CONTROLE DE CB E ESCAVADEIRA (VIAGENS)'],
  ['PTA', 'REUNIÃO DO MAPA DE PARADAS'],
  ['POP', 'EXTRAÇÃO DE RELATÓRIOS PARA ANÁLISE CRÍTICA FINANCEIRA'],
  ['POP', 'CADASTRO DE PRODUTOS NO MAXIMO'],
  ['POP', 'WASTE TIME'],
  ['PES', 'ELEABORAÇÃO DO PLANO DE ATAQUE'],
  ['POP', 'RDC'],
  ['PTA', 'ELABORAÇÃO DO REPLANEJAMENTO DAS ATIVIDADES'],
  ['PES', 'RELATÓRIO MENSAL VALE'],
  ['POP', 'CONTROLE DE MARCOS'],
  ['PES', 'LABORAÇÃO DE REPLANEJAMENTO'],
  ['PES', 'RELATÓRIO SEMANAL'],
  ['POP', 'ENVIO DE ONE PAGE NAS PARADAS'],
  ['POP', 'ORGANIZAÇÃO DE DOCUMENTAÇÃO DAS PASTAS CONFORME INSTRUÇÃO DE TRABALHO CLIENTE'],
  ['PTO', 'SOLICITAÇÃO, CADASTRO DE FORNECEDORES E CONTA BANCARIA NO MAXIMO'],
  ['POP', 'RESPONDER E-MAILS'],
  ['PTA', 'ALIMENTAR BASE DE DADOS PBI E INDICADORES - FÍSICO / FINANCEIRO'],
  ['PTA', 'ALIMENTAR BASE DE DADOS PBI E INDICADORES - FÍSICO / FINNANCEIRO'],
  ['PTA', 'ELABORAÇÃO DE PLANO DE AÇÃO DO CRONOGRAMA CORRENTE'],
  ['PES', 'ENVIO DE REPORT ANÁLITICO DO PROJETO INTERNO'],
  ['PES', 'REUNIÃO SEMANAL DO MAS'],
  ['PTA', 'REUNIÃO PROGRAMAÇÃO SEMANAL VALE'],
  ['POP', 'PREENCHIMENTO E APOIO DAS PLANILHAS DE CAPITALIZAÇÃO JUNTO A CONTROLADORIA'],
  ['PTA', 'CURSOS ADM COURSEMILL'],
  ['PTA', 'VALIDAÇÃO CURVA FISICA'],
  ['POP', 'CRIAÇÕES NO POWERBI E AJUSTES SOLICITADOS'],
  ['PES', 'RMA VALE'],
  ['POP', 'ATUALIZAÇÃO MENTOR CONSTRUÇÃO'],
  ['POP', 'INCLUSÃO DE CONTROLE DE ORDENS DE COMRAS'],
  ['PTA', 'ATUALIZAÇÃO DE CRONOGRAMA'],
];

export const ETIQUETAS = ['FIN', 'ENG', 'LPS', 'PLA'];

export const TAREFAS2 = ['CONTROLAR', 'ELABORAR', 'REVISAR'];

// Campos na ordem em que aparecem na tela. `chave` é o nome no formulário e na
// coluna do banco; o rótulo é o mesmo cabeçalho da planilha. `dependeDe` marca
// o campo que filtra este — a tela usa isso para bloquear o dropdown enquanto o
// anterior não for escolhido.
export const CAMPOS = [
  { chave: 'sigla', label: 'Sigla' },
  { chave: 'tarefa', label: 'Tarefa', dependeDe: 'sigla' },
  { chave: 'etiqueta', label: 'Etiqueta' },
  { chave: 'tarefa2', label: 'Tarefa 2' },
];

const ordenar = (arr) => [...arr].sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const SIGLAS = ordenar([...new Set(CATALOGO.map(([s]) => s))]);

// Tarefas de uma sigla. Sem sigla não há o que oferecer: o campo Tarefa fica
// bloqueado até a sigla ser escolhida.
export function tarefasDe(sigla) {
  if (!sigla) return [];
  return ordenar([...new Set(CATALOGO.filter(([s]) => s === sigla).map(([, t]) => t))]);
}

export const SELECAO_VAZIA = { sigla: '', tarefa: '', etiqueta: '', tarefa2: '' };

// Opções de cada dropdown para a seleção atual — é aqui que a sigla filtra a
// tarefa. Etiqueta e Tarefa 2 são sempre as listas inteiras.
export function opcoesDe(sel = SELECAO_VAZIA) {
  return {
    sigla: SIGLAS,
    tarefa: tarefasDe(sel.sigla),
    etiqueta: ETIQUETAS,
    tarefa2: TAREFAS2,
  };
}

// Um campo está bloqueado enquanto o campo que o filtra não tiver valor.
export function campoBloqueado(sel = SELECAO_VAZIA, chave) {
  const { dependeDe } = CAMPOS.find((c) => c.chave === chave) || {};
  return !!dependeDe && !sel[dependeDe];
}

// Aplica a escolha de um campo e reconcilia o que depende dele: trocar (ou
// limpar) a sigla derruba a tarefa que não pertence mais a ela — senão ficaria
// gravado um par que não existe na planilha.
export function aplicarSelecao(sel, campo, valor) {
  const novo = { ...SELECAO_VAZIA, ...sel, [campo]: valor };
  if (campo === 'sigla' && !tarefasDe(novo.sigla).includes(novo.tarefa)) novo.tarefa = '';
  return novo;
}

// Todo apontamento precisa dos 4 campos preenchidos e coerentes.
export function selecaoValida(sel = SELECAO_VAZIA) {
  return (
    CATALOGO.some(([s, t]) => s === sel.sigla && t === sel.tarefa) &&
    ETIQUETAS.includes(sel.etiqueta) &&
    TAREFAS2.includes(sel.tarefa2)
  );
}
