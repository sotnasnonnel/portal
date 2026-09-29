// Períodos de Folga de Campo e Ausência Programada, como o banco devolve em
// `chamados_adm_ausencias` e `mobilizacao_ausencias`: { tipo, data_inicio,
// data_fim }, datas em 'AAAA-MM-DD'. Fica em utils porque o Atendimento e a
// Mobilização mostram a mesma coisa, com o mesmo texto.

export const ROTULO_AUSENCIA = {
  ausencia_programada: 'Ausência Programada',
  folga_campo: 'Folga de Campo',
};

// A data chega sem hora; passar por `new Date` a jogaria para o dia anterior
// no fuso de Brasília.
const dataBR = (iso) => {
  const [a, m, d] = String(iso || '').slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
};

/** "Folga de Campo de 12/10/2026 a 14/10/2026" — ou "em 12/10/2026", se for um dia só. */
export function descreverAusencia({ tipo, data_inicio, data_fim } = {}) {
  const rotulo = ROTULO_AUSENCIA[tipo] || 'Ausência';
  if (!data_fim || data_fim === data_inicio) return `${rotulo} em ${dataBR(data_inicio)}`;
  return `${rotulo} de ${dataBR(data_inicio)} a ${dataBR(data_fim)}`;
}

/** Algum dos períodos cobre o dia (AAAA-MM-DD)? */
export const ausenteNoDia = (ausencias = [], diaIso) => ausencias.some(
  (a) => a.data_inicio <= diaIso && diaIso <= a.data_fim,
);

/** Dia local em AAAA-MM-DD, para comparar com as datas do banco. */
export const diaLocalIso = (quando = new Date()) => {
  const d = new Date(quando);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
