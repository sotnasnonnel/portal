import { useEffect, useState } from 'react';
import { AlertCircle, Boxes, Loader2, X } from 'lucide-react';

/**
 * Classificar uma iniciativa do Campo de Ideias como item do catálogo da
 * empresa — a lista de "Iniciativas em uso", que mora no backoffice.
 *
 * Área e estágio são PERGUNTADOS, não deduzidos: o setor daqui (RH, TI,
 * Financeiro…) não tem correspondência com as três áreas de lá (INO, OPE,
 * PAR), e adivinhar poria no catálogo da empresa um palpite meu com cara de
 * dado. O responsável já vem preenchido com quem registrou.
 */

const AREAS = [
  { valor: 'INO', label: 'INO — Inovação' },
  { valor: 'OPE', label: 'OPE — Operação' },
  { valor: 'PAR', label: 'PAR — Parceria' },
];

// As três que existem hoje no backoffice. A tabela de lá não tem CHECK: aceitar
// texto livre encheria o catálogo do mesmo estágio escrito de três jeitos.
const ESTAGIOS = ['IDEIA', 'USO EM ATUAÇÃO', 'FATURAMENTO'];

export default function ClassificarModal({ registro, autorNome = '', onFechar, onClassificar }) {
  const [area, setArea] = useState('INO');
  const [estagio, setEstagio] = useState('USO EM ATUAÇÃO');
  const [responsavel, setResponsavel] = useState(autorNome);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !salvando) onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar, salvando]);

  const enviar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await onClassificar({ area, estagio, responsavel });
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  };

  return (
    <div className="pg-modal-overlay" onClick={() => !salvando && onFechar()}>
      <form
        className="pg-modal pg-classificar-modal" onClick={(e) => e.stopPropagation()}
        onSubmit={enviar} role="dialog" aria-modal="true" aria-label="Classificar iniciativa"
      >
        <div className="pg-modal-cab">
          <h2>Classificar como iniciativa em uso</h2>
          <button type="button" className="pg-modal-x" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="pg-modal-corpo">
          <p className="pg-pedir-alvo">#{registro.numero} — {registro.titulo}</p>
          <p className="pg-campo-dica">
            Ela passa a aparecer em <strong>Iniciativas em uso</strong>, para a empresa
            inteira, e entra no catálogo da Inovação. Título e descrição vão como
            foram escritos aqui.
          </p>

          {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

          <div className="pg-dupla">
            <div className="pg-campo">
              <label htmlFor="clf-area">Área</label>
              <select id="clf-area" className="pg-select" value={area} onChange={(e) => setArea(e.target.value)}>
                {AREAS.map((a) => <option key={a.valor} value={a.valor}>{a.label}</option>)}
              </select>
            </div>
            <div className="pg-campo">
              <label htmlFor="clf-estagio">Estágio</label>
              <select id="clf-estagio" className="pg-select" value={estagio} onChange={(e) => setEstagio(e.target.value)}>
                {ESTAGIOS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>

          <div className="pg-campo">
            <label htmlFor="clf-resp">Responsável</label>
            <input
              id="clf-resp" className="pg-input" value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Quem responde pela iniciativa"
            />
          </div>
        </div>

        <div className="pg-modal-pe">
          <button type="button" className="pg-btn pg-btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="pg-btn pg-btn-primary" disabled={salvando}>
            {salvando ? <Loader2 size={15} className="pg-spin" /> : <Boxes size={15} />}
            {salvando ? 'Classificando…' : 'Classificar'}
          </button>
        </div>
      </form>
    </div>
  );
}
