export const formatarData = (data) => {
  if (!data) return '—';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

export const formatarMoeda = (valor) => {
  if (!valor && valor !== 0) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Extrai a data e o texto da justificativa de uma solicitação de desligamento,
 * que é gravada no formato "Data solicitada para desligamento: dd/mm/aaaa\n\nJustificativa: ...".
 * Retorna { data, texto }.
 */
export const parseDesligamento = (just) => {
  if (just?.includes('Data solicitada para desligamento:')) {
    const m = just.match(/Data solicitada para desligamento: (.*?)\n\nJustificativa: (.*)/s);
    if (m) return { data: m[1], texto: m[2] };
  }
  return { data: null, texto: just };
};

// Dias de ausência concedidos por período aquisitivo (P.A.).
export const DIAS_POR_PA = 21;

/**
 * Calcula o saldo de dias de ausência de um colaborador a partir dos seus
 * ciclos (linhas de ciclos_ausencia), agrupando por período aquisitivo (P.A.).
 *
 * O direito de cada P.A. vem da coluna `dias_direito` (importada da planilha de
 * controle); quando ausente, assume DIAS_POR_PA (21). O saldo de cada P.A. é
 * `dias_direito - dias agendados` (parcelas com ausência marcada), de modo que o
 * número bate exatamente com a coluna DIAS PENDENTES da planilha.
 *
 * @param {Array} ciclos - linhas de ciclos_ausencia de UM colaborador (cru do banco).
 * @returns {Object} { saldoDisponivel, saldoTotal, periodos }
 *   - saldoDisponivel: soma dos saldos dos P.A.s ainda dentro do prazo de gozo (limite_efetiva >= hoje).
 *   - saldoTotal: soma dos saldos de todos os P.A.s (inclui períodos já vencidos).
 *   - periodos: detalhamento por P.A. [{ inicio_pa, fim_pa, limite_efetiva, direito, saldo, vencido }].
 */
export const calcularSaldoAusencia = (ciclos = []) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const grupos = {};
  ciclos.forEach((c) => {
    const inicioPA = c.inicio_periodo_aquisitivo || c.inicio_pa;
    if (!inicioPA) return;

    if (!grupos[inicioPA]) {
      grupos[inicioPA] = {
        inicio_pa: inicioPA,
        fim_pa: c.fim_periodo_aquisitivo || c.fim_pa || null,
        limite_efetiva: c.limite_ausencia_efetiva || c.limite_efetiva || null,
        direito: null,
        agendado: 0,
      };
    }

    // Garante que o limite seja preenchido por qualquer linha do grupo.
    if (!grupos[inicioPA].limite_efetiva) {
      grupos[inicioPA].limite_efetiva = c.limite_ausencia_efetiva || c.limite_efetiva || null;
    }

    // Direito real do período (planilha). Usa o maior valor encontrado nas linhas do P.A.
    if (c.dias_direito != null && c.dias_direito !== '') {
      const d = Number(c.dias_direito);
      if (!Number.isNaN(d) && (grupos[inicioPA].direito == null || d > grupos[inicioPA].direito)) {
        grupos[inicioPA].direito = d;
      }
    }

    const temAusencia = c.ausencia_agendada_inicio || c.inicio_ausencia;
    if (temAusencia) {
      grupos[inicioPA].agendado += c.dias_solicitados || c.dias_pendentes || 0;
    }
  });

  const periodos = Object.values(grupos).map((g) => {
    const direito = g.direito != null ? g.direito : DIAS_POR_PA;
    const saldo = direito - g.agendado;
    const limite = g.limite_efetiva ? new Date(g.limite_efetiva + 'T00:00:00') : null;
    return {
      inicio_pa: g.inicio_pa,
      fim_pa: g.fim_pa,
      limite_efetiva: g.limite_efetiva,
      direito,
      saldo,
      vencido: limite ? limite < hoje : false,
    };
  });

  const saldoDisponivel = periodos
    .filter((g) => !g.vencido)
    .reduce((acc, g) => acc + Math.max(g.saldo, 0), 0);

  const saldoTotal = periodos.reduce((acc, g) => acc + Math.max(g.saldo, 0), 0);

  return { saldoDisponivel, saldoTotal, periodos };
};

export const calcularPeriodoAquisitivo = (dataAdmissao) => {
  if (!dataAdmissao) return { inicio: null, fim: null, texto: '—' };
  const admissao = new Date(dataAdmissao + 'T00:00:00');
  const hoje = new Date();
  let inicioPA = new Date(admissao);

  while (true) {
    const fimPA = new Date(inicioPA);
    fimPA.setFullYear(fimPA.getFullYear() + 1);
    if (fimPA >= hoje) {
      return {
        inicio: inicioPA,
        fim: fimPA,
        texto: `${formatarData(inicioPA.toISOString().split('T')[0])} - ${formatarData(fimPA.toISOString().split('T')[0])}`,
      };
    }
    inicioPA.setFullYear(inicioPA.getFullYear() + 1);
  }
};

/**
 * Gera todos os períodos aquisitivos teóricos desde a admissão até o limite futuro.
 * @param {string} dataAdmissao 
 * @param {number} anosFuturos - Quantos anos além de hoje devemos prever.
 * @returns {Array} List of {inicio_pa, fim_pa, limite_efetiva}
 */
export const gerarCiclosTeoricos = (dataAdmissao, anosFuturos = 1) => {
  if (!dataAdmissao) return [];
  const admissao = new Date(dataAdmissao + 'T00:00:00');
  const hoje = new Date();
  const dataLimite = new Date(hoje);
  dataLimite.setFullYear(dataLimite.getFullYear() + anosFuturos);

  const ciclos = [];
  let inicioPA = new Date(admissao);

  while (inicioPA < dataLimite) {
    const fimPA = new Date(inicioPA);
    fimPA.setFullYear(fimPA.getFullYear() + 1);
    
    const limiteEfetiva = new Date(fimPA);
    limiteEfetiva.setFullYear(limiteEfetiva.getFullYear() + 1);

    ciclos.push({
      inicio_pa: inicioPA.toISOString().split('T')[0],
      fim_pa: fimPA.toISOString().split('T')[0],
      limite_efetiva: limiteEfetiva.toISOString().split('T')[0]
    });

    inicioPA = new Date(inicioPA);
    inicioPA.setFullYear(inicioPA.getFullYear() + 1);
  }

  return ciclos;
};

/**
 * Retorna apenas o ciclo vigente (aquele que sobrepõe a data de hoje).
 * @param {string} dataAdmissao 
 * @returns {Object} {inicio_pa, fim_pa, limite_efetiva}
 */
export const getCicloAtual = (dataAdmissao) => {
  if (!dataAdmissao) return null;
  const admissao = new Date(dataAdmissao + 'T00:00:00');
  const hoje = new Date();
  let inicioPA = new Date(admissao);

  while (true) {
    const fimPA = new Date(inicioPA);
    fimPA.setFullYear(fimPA.getFullYear() + 1);
    
    // Se o hoje estiver dentro desse ciclo ou for anterior ao seu término
    if (hoje < fimPA) {
      const limiteEfetiva = new Date(fimPA);
      limiteEfetiva.setFullYear(limiteEfetiva.getFullYear() + 1);

      return {
        inicio_pa: inicioPA.toISOString().split('T')[0],
        fim_pa: fimPA.toISOString().split('T')[0],
        limite_efetiva: limiteEfetiva.toISOString().split('T')[0]
      };
    }
    inicioPA.setFullYear(inicioPA.getFullYear() + 1);
    
    // Proteção contra loop infinito (caso data de admissão seja inválida/futura)
    if (inicioPA > hoje && hoje < admissao) return null;
  }
};

/**
 * Retorna o status calculado da ausência baseado nas regras de negócio.
 * @param {Object} ausencia - Objeto contendo dados da ausência.
 * @returns {Object} - { label, cor, status, nota }
 */
export const getStatusCalculado = (ausencia) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const statusOriginal = ausencia.status_original || ausencia.status;
  const fimPA = (ausencia.fim_pa || ausencia.fim_periodo_aquisitivo) ? new Date((ausencia.fim_pa || ausencia.fim_periodo_aquisitivo) + 'T00:00:00') : null;

  // Cores da Paleta oficial
  const PALETTE = {
    VERDE: '#00a49a',     // Ausência Marcada
    AZUL: '#26405d',      // OK
    TERRACOTTA: '#c35e1e', // Sem direito ainda (Aviso)
    VERMELHO: '#e74c3c'    // Atrasado para marcar
  };

  // Normalização para comparação robusta
  const statusLower = (statusOriginal || '').toString().toLowerCase().trim();

  // 1. Ausência em Gozo (Prioridade máxima: se hoje está entre as datas)
  if (ausencia.ausencia_agendada_inicio && ausencia.ausencia_agendada_fim) {
    const inicio = new Date(ausencia.ausencia_agendada_inicio + 'T00:00:00');
    const fim = new Date(ausencia.ausencia_agendada_fim + 'T00:00:00');
    
    if (hoje >= inicio && hoje <= fim) {
      return { label: 'Em Gozo', cor: '#9b59b6', status: 'em-gozo', icon: 'Plane' };
    }
  }

  // 2. Status Aprovado/Marcado
  if (statusLower === 'ausência marcada' || statusLower === 'ausencia marcada' || statusLower === 'aprovada') {
    return { label: 'Ausência Marcada', cor: PALETTE.VERDE, status: 'aprovada', icon: 'CheckCircle' };
  }
  
  // 2. OK (já gozou, histórico)
  if (statusOriginal === 'OK' || statusOriginal === 'concluida') {
    return { label: 'OK', cor: PALETTE.AZUL, status: 'concluida', icon: 'History' };
  }
  
  // 3. Sem direito ainda
  if (statusOriginal === 'Sem direito ainda' || statusOriginal === 'bloqueada') {
    if (fimPA) {
      const tresMesesAntes = new Date(fimPA);
      tresMesesAntes.setMonth(tresMesesAntes.getMonth() - 3);
      if (hoje >= tresMesesAntes) {
        return { 
          label: 'Sem direito ainda', 
          cor: PALETTE.TERRACOTTA, 
          status: 'aviso', 
          nota: 'Faltam menos de 3 meses para o fim do P.A.',
          icon: 'AlertTriangle' 
        };
      }
    }
    return { label: 'Sem direito ainda', cor: '#999', status: 'bloqueada', icon: 'Lock' };
  }
  
  // 4. Pendente (Digitada mas não aprovada)
  if (statusLower === 'marcação pendente' || statusLower === 'marcacao pendente' || statusLower === 'pendente') {
    const dataLimite = new Date(ausencia.limite_ausencia_efetiva + 'T00:00:00');
    const avisoAtraso = new Date(dataLimite);
    avisoAtraso.setMonth(avisoAtraso.getMonth() - 3);

    if (hoje > dataLimite) {
      return { label: 'Marcação Atrasada', cor: PALETTE.VERMELHO, status: 'atrasada', icon: 'AlertTriangle' };
    }
    
    return { label: 'Marcação Pendente', cor: '#f39c12', status: 'pendente', icon: 'Clock' };
  }

  return { label: statusOriginal, cor: '#999', status: 'desconhecido', icon: 'HelpCircle' };
};
