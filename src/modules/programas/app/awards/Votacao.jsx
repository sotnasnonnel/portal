import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { AWARDS_CATEGORIAS } from '../../../../config/programas';
import { votar } from '../../lib/awards';
import { PONTOS_POR_POSICAO, erroDoVoto, posicoesExigidas } from '../../lib/awardsRegras';

/**
 * Os projetos na votação de cada categoria e o voto da pessoa (1º, 2º e 3º). Com a
 * votação encerrada, mostra só os projetos e o voto que ficou.
 */
export default function Votacao({ finalistas, meusVotos, aberta, onVotou, onVer }) {
  return AWARDS_CATEGORIAS.map((c) => (
    <VotoCategoria
      key={c.valor}
      categoria={c}
      projetos={finalistas.filter((p) => p.categoria === c.valor)}
      voto={meusVotos[c.valor] || []}
      aberta={aberta}
      onVotou={(ids) => onVotou(c.valor, ids)}
      onVer={onVer}
    />
  ));
}

function VotoCategoria({ categoria, projetos, voto, aberta, onVotou, onVer }) {
  const exigidas = posicoesExigidas(projetos.length);
  const [escolhas, setEscolhas] = useState(() => [0, 1, 2].map((i) => voto[i] || ''));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const jaVotou = voto.filter(Boolean).length > 0;
  const nome = (id) => projetos.find((p) => p.id === id)?.codigo_setor || '—';

  const escolher = (i, id) => {
    setEscolhas((atual) => atual.map((v, j) => (j === i ? id : v)));
    setSalvo(false);
    setErro('');
  };

  const salvar = async () => {
    const ids = escolhas.slice(0, exigidas);
    const problema = erroDoVoto(ids, projetos.length);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro('');
    try {
      await votar(categoria.valor, ids);
      onVotou(ids);
      setSalvo(true);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="pg-card">
      <h2 className="pg-card-tit">{categoria.label}</h2>

      {projetos.length === 0 ? (
        <p className="pg-aw-dica">Nenhum projeto nesta categoria.</p>
      ) : (
        <ul className="pg-aw-finalistas">
          {projetos.map((p) => (
            <li key={p.id}>
              <button type="button" className="pg-link" onClick={() => onVer(p)}>{p.codigo_setor}</button>
              <span>{p.autorNome}</span>
            </li>
          ))}
        </ul>
      )}

      {aberta && exigidas > 0 && (
        <>
          <div className="pg-aw-voto">
            {Array.from({ length: exigidas }, (_, i) => (
              <div className="pg-campo" key={i}>
                <label htmlFor={`voto-${categoria.valor}-${i}`}>
                  {i + 1}º lugar <span className="opc">({PONTOS_POR_POSICAO[i]} {PONTOS_POR_POSICAO[i] === 1 ? 'ponto' : 'pontos'})</span>
                </label>
                <select
                  id={`voto-${categoria.valor}-${i}`}
                  className="pg-input pg-select"
                  value={escolhas[i]}
                  onChange={(e) => escolher(i, e.target.value)}
                >
                  <option value="">Escolha um projeto</option>
                  {projetos.map((p) => (
                    <option key={p.id} value={p.id} disabled={escolhas.some((id, j) => j !== i && id === p.id)}>
                      {p.codigo_setor}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}
          {salvo && <div className="pg-aviso tom-ok"><CheckCircle2 size={16} /> Voto registrado. Você pode mudar até o encerramento.</div>}

          <div className="pg-acoes" style={{ marginTop: 0 }}>
            <button type="button" className="pg-btn pg-btn-primary" onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 size={15} className="pg-spin" />}
              {jaVotou ? 'Atualizar voto' : 'Votar'}
            </button>
          </div>
        </>
      )}

      {!aberta && (
        <p className="pg-aw-dica">
          {jaVotou
            ? `Seu voto: ${voto.map((id, i) => `${i + 1}º ${nome(id)}`).join(' · ')}`
            : 'Você não votou nesta categoria.'}
        </p>
      )}
    </section>
  );
}
