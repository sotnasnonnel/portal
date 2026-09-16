// Peças pequenas repetidas nos assistentes de prestadores.

export function Contador({ valor, rotulo, alerta }) {
  return (
    <div className={`pjp-contador ${alerta ? 'pjp-contador--alerta' : ''}`}>
      <b>{valor}</b>
      <span>{rotulo}</span>
    </div>
  );
}

export function Etapas({ etapas, atual }) {
  return (
    <div className="pj-etapas">
      {etapas.map((rotulo, i) => (
        <span key={rotulo} className={`pj-etapa ${atual === i + 1 ? 'ativa' : ''}`}><b>{i + 1}</b> {rotulo}</span>
      ))}
    </div>
  );
}

export function Progresso({ feitos, total, rotulo }) {
  return (
    <div>
      <div className="form-hint">{rotulo}: {feitos} de {total}</div>
      <div className="pjp-progresso"><div style={{ width: `${total ? (feitos / total) * 100 : 100}%` }} /></div>
    </div>
  );
}

const TOM_CONFERENCIA_VIDA = {
  'Dados localizados': 'aprovada',
  'Vínculo divergente': 'reprovada',
  'Não localizado na base ativa': 'pendente',
};

export function BadgeVida({ valor }) {
  return <span className={`badge ${TOM_CONFERENCIA_VIDA[valor] || 'pj-neutro'}`}>{valor || '—'}</span>;
}
