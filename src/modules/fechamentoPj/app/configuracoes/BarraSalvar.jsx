import { Save, RotateCcw } from 'lucide-react';

// Rodapé de aba: estado das alterações + Descartar/Salvar (e ações extras à esquerda).
export default function BarraSalvar({ sujo, salvando, onSalvar, onDescartar, children, rotulo = 'Salvar' }) {
  return (
    <div className="pj-cfg-barra">
      <div className="pj-cfg-barra-extra">{children}</div>
      <span className={`pj-cfg-estado ${sujo ? 'pj-cfg-estado--sujo' : ''}`}>
        {sujo ? 'Alterações não salvas' : 'Tudo salvo'}
      </span>
      {onDescartar && (
        <button type="button" className="btn btn-outline" onClick={onDescartar} disabled={!sujo || salvando}>
          <RotateCcw size={16} /> Descartar
        </button>
      )}
      <button type="button" className="btn btn-primary" onClick={onSalvar} disabled={!sujo || salvando}>
        <Save size={16} /> {salvando ? 'Salvando…' : rotulo}
      </button>
    </div>
  );
}
