// Importação do relatório "Distância percorrida" do rastreador Cobli (v3 do
// protótipo docs/ref/"HTML Gestão de Frota PHD v3.html", cobliParse/cbPlan/cbApply).
// Regras puras, sem React e sem Supabase: roda sob `node --test`. Recebe as
// linhas já lidas por lib/planilhas.js (matriz de células, datas em dd/mm/aaaa)
// e devolve o km rodado do mês por placa; a gravação fica na tela.
import { isNum, norm, numDe, placaDe } from './regras.js';

export const ERRO_CABECALHO = 'Não encontrei as colunas “Placa” e “Distância percorrida”. Confira se é o relatório de Distância percorrida exportado do Cobli.';
export const OBS_CRIADO_PELO_COBLI = 'Lançamento criado pela importação do Cobli — completar custos do mês.';

/** Quantas linhas do topo procurar pelo cabeçalho: o Cobli põe título e filtros antes. */
const LINHAS_CABECALHO = 40;

const PERIODO_RE = /per[ií]odo:?\s*(\d{2})\/(\d{2})\/(\d{4})\s*(?:at[ée]|a|-)\s*(\d{2})\/(\d{2})\/(\d{4})/i;
// Nome do arquivo exportado: ..._AAMMDD_hhmm_AAMMDD...
const PERIODO_NOME_RE = /(\d{2})(\d{2})(\d{2})_\d{4}_(\d{2})(\d{2})(\d{2})/;
const TOTAL_RE = /dist[aâ]ncia total percorrida:?\s*([\d.,]+)/i;

const r2 = (n) => Math.round(n * 100) / 100;
const texto = (v) => String(v ?? '').trim();

/**
 * Lê uma aba do relatório. Lança Error quando não acha o cabeçalho.
 * Devolve { ini, fim, total, soma, linhas: [{ placa, km, grupo, modelo }], comp }:
 * ini/fim em AAAA-MM-DD (ou ''), total = "Distância total percorrida" do topo
 * (ou null), soma = soma das linhas, comp = AAAA-MM do início do período.
 */
export function cobliParse(linhas, nomeArquivo) {
  const rows = Array.isArray(linhas) ? linhas : [];
  let h = -1;
  let cP = -1;
  let cD = -1;
  let cG = -1;
  let cM = -1;
  for (let i = 0; i < Math.min(LINHAS_CABECALHO, rows.length); i += 1) {
    const r = (rows[i] || []).map((x) => norm(x));
    const ip = r.findIndex((x) => x === 'placa');
    const id = r.findIndex((x) => x.includes('distancia'));
    if (ip >= 0 && id >= 0) {
      h = i; cP = ip; cD = id;
      cG = r.findIndex((x) => x === 'grupo');
      cM = r.findIndex((x) => x === 'modelo');
      break;
    }
  }
  if (h < 0) throw new Error(ERRO_CABECALHO);

  // Período e total ficam no bloco acima do cabeçalho.
  const topo = rows.slice(0, h).map((r) => (r || []).join(' ')).join(' ');
  let ini = '';
  let fim = '';
  const m = topo.match(PERIODO_RE);
  if (m) {
    ini = `${m[3]}-${m[2]}-${m[1]}`;
    fim = `${m[6]}-${m[5]}-${m[4]}`;
  } else {
    const f = String(nomeArquivo || '').match(PERIODO_NOME_RE);
    if (f) {
      ini = `20${f[1]}-${f[2]}-${f[3]}`;
      fim = `20${f[4]}-${f[5]}-${f[6]}`;
    }
  }
  const t = topo.match(TOTAL_RE);

  // Placa repetida (o veículo trocou de grupo no mês, por exemplo) soma o km;
  // grupo e modelo ficam os da primeira linha.
  const porPlaca = new Map();
  rows.slice(h + 1).forEach((r) => {
    if (!r) return;
    const placa = placaDe(r[cP]);
    const km = numDe(r[cD]);
    if (!placa || km == null) return;
    const atual = porPlaca.get(placa);
    if (atual) atual.km += km;
    else {
      porPlaca.set(placa, {
        placa, km, grupo: cG >= 0 ? texto(r[cG]) : '', modelo: cM >= 0 ? texto(r[cM]) : '',
      });
    }
  });
  const itens = [...porPlaca.values()].map((l) => ({ ...l, km: r2(l.km) }));
  return {
    ini,
    fim,
    total: t ? numDe(t[1]) : null,
    soma: r2(itens.reduce((a, l) => a + l.km, 0)),
    linhas: itens,
    comp: ini ? ini.slice(0, 7) : '',
  };
}

/**
 * O que a importação faz com cada placa do relatório na competência `comp`.
 * `criar`: cria o lançamento do mês para veículo Ativo que ainda não tem.
 * `zero`: inclui placas com 0 km (sem isso elas são ignoradas).
 * `dados`: { veiculos, mensal } do módulo.
 * Cada item: { placa, km, grupo, modelo, v, ms, acao, tom, grava }, com os que
 * gravam primeiro, depois km decrescente, depois placa.
 */
export function planoCobli(linhas, comp, { criar = true, zero = false } = {}, dados = {}) {
  const veiculos = dados.veiculos || [];
  const mensal = dados.mensal || [];
  return (linhas || []).map((l) => {
    const v = veiculos.find((x) => x.placa === l.placa) || null;
    const ms = mensal.find((x) => x.competencia === comp && x.placa === l.placa) || null;
    let acao;
    let tom = 'neutral';
    let grava = false;
    if (l.km === 0 && !zero) {
      acao = 'Ignorado (0 km)';
    } else if (ms) {
      if (isNum(ms.km_rodado_inf) && Math.abs(ms.km_rodado_inf - l.km) < 0.01) {
        acao = 'Já preenchido';
      } else {
        acao = isNum(ms.km_rodado_inf) ? 'Atualizar' : 'Preencher';
        tom = 'ok';
        grava = true;
      }
    } else if (v && v.status !== 'Ativo') {
      acao = 'Veículo inativo sem lançamento no mês'; tom = 'warn';
    } else if (v && criar) {
      acao = 'Criar lançamento e preencher'; tom = 'info'; grava = true;
    } else if (v) {
      acao = 'Sem lançamento no mês'; tom = 'warn';
    } else {
      acao = 'Placa não cadastrada'; tom = 'warn';
    }
    return {
      ...l, v, ms, acao, tom, grava,
    };
  }).sort((a, b) => (Number(b.grava) - Number(a.grava)) || (b.km - a.km) || a.placa.localeCompare(b.placa));
}

/**
 * Lançamento novo do mês para um veículo cadastrado que ainda não tem, já com o
 * km do Cobli. Copia o contrato do veículo; custos do mês ficam para completar.
 */
export function novoMensalDoCobli(v, comp, km, agoraISO) {
  return {
    competencia: comp,
    status: 'Ativo',
    condutor: v.condutor ?? null,
    placa: v.placa,
    modelo: v.modelo ?? null,
    locadora: v.locadora ?? null,
    grupo: v.grupo ?? null,
    codigo_reserva: v.codigo_reserva ?? null,
    contrato: v.contrato ?? null,
    retirada: v.retirada ?? null,
    devolucao: v.devolucao ?? null,
    ct: v.ct ?? null,
    custo_resp: v.custo_resp ?? null,
    gps_valor: v.gps_valor ?? null,
    gps_numero: v.gps_numero ?? null,
    km_contratado: v.km_contratado ?? null,
    custo_locacao: v.custo_mensal ?? null,
    recarga_mensal: v.recarga_mensal ?? null,
    km_rodado_inf: km,
    km_fonte: 'Cobli',
    km_importado_em: agoraISO,
    obs: OBS_CRIADO_PELO_COBLI,
  };
}
