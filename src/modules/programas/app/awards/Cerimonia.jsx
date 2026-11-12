import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Award, Loader2, Maximize2, X } from 'lucide-react';
import { AWARDS_CATEGORIAS, AWARDS_CATEGORIA_LABEL } from '../../../../config/programas';
import { publicarVencedores } from '../../lib/awards';
import { ordemDaRevelacao } from '../../lib/awardsRegras';

/**
 * A cerimônia de revelação, pedida pelo Lucas para o anúncio: tela cheia, uma
 * categoria por vez, do 3º para o 1º lugar, com contagem antes de cada nome e
 * confete no 1º. Quem apresenta avança no botão, na barra de espaço, no Enter ou
 * na seta para a direita (o passador de slides manda seta ou PageDown).
 *
 * O resultado só fica público (`publicar`) quando aparece o 1º lugar da ÚLTIMA
 * categoria: até lá a fase continua 'encerrada' e ninguém vê os vencedores
 * pelo celular antes da hora. Com `publicar` falso, é só rever a cerimônia.
 */

const SUSPENSE = { 1: 5, 2: 3, 3: 3 };
const TECLAS_AVANCAR = new Set([' ', 'Enter', 'ArrowRight', 'PageDown']);
const CORES_CONFETE = ['#e9b949', '#b4522a', '#ffffff', '#f0c9b4', '#c0c7d1'];

export default function Cerimonia({ podio, projetos, publicar, onPublicado, onFechar }) {
  const raiz = useRef(null);
  const porId = useMemo(() => new Map(projetos.map((p) => [p.id, p])), [projetos]);
  const ordem = useMemo(() => ordemDaRevelacao(podio, AWARDS_CATEGORIAS.map((c) => c.valor)), [podio]);

  const [comecou, setComecou] = useState(false);
  const [iCat, setICat] = useState(0);
  const [revelados, setRevelados] = useState(0);
  const [suspense, setSuspense] = useState(null);
  const [contagem, setContagem] = useState(0);
  const [festa, setFesta] = useState(0);
  const [publicacao, setPublicacao] = useState(publicar ? 'pendente' : 'feita');
  const [erro, setErro] = useState('');

  const atual = ordem[iCat];
  const ultimaCategoria = iCat === ordem.length - 1;
  const terminouCategoria = atual && revelados >= atual.posicoes.length;

  const publicarAgora = useCallback(async () => {
    setPublicacao('publicando');
    setErro('');
    try {
      await publicarVencedores();
      setPublicacao('feita');
      onPublicado?.();
    } catch (e) {
      setPublicacao('pendente');
      setErro(e.message);
    }
  }, [onPublicado]);

  // A contagem anda de 1 em 1 segundo; no fim, o nome aparece.
  useEffect(() => {
    if (suspense == null) return undefined;
    const t = setTimeout(() => {
      if (contagem > 1) {
        setContagem(contagem - 1);
        return;
      }
      setSuspense(null);
      setRevelados((r) => r + 1);
      if (suspense === 1) {
        setFesta((f) => f + 1);
        if (ultimaCategoria && publicar) publicarAgora();
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [suspense, contagem, ultimaCategoria, publicar, publicarAgora]);

  const fechar = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    onFechar();
  }, [onFechar]);

  const avancar = useCallback(() => {
    if (suspense != null || !atual) return;
    if (!comecou) { setComecou(true); return; }
    if (!terminouCategoria) {
      const posicao = atual.posicoes[revelados];
      setSuspense(posicao);
      setContagem(SUSPENSE[posicao]);
      return;
    }
    if (!ultimaCategoria) {
      setICat((i) => i + 1);
      setRevelados(0);
      return;
    }
    if (publicacao === 'feita') fechar();
  }, [suspense, atual, comecou, terminouCategoria, revelados, ultimaCategoria, publicacao, fechar]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { fechar(); return; }
      if (TECLAS_AVANCAR.has(e.key)) { e.preventDefault(); avancar(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [avancar, fechar]);

  const telaCheia = () => raiz.current?.requestFullscreen?.().catch(() => {});

  let rotulo = 'Começar';
  if (comecou && atual) {
    if (suspense != null) rotulo = '…';
    else if (!terminouCategoria) rotulo = `Revelar o ${atual.posicoes[revelados]}º lugar`;
    else if (!ultimaCategoria) rotulo = `Próxima categoria: ${AWARDS_CATEGORIA_LABEL[ordem[iCat + 1].categoria]}`;
    else if (publicacao === 'publicando') rotulo = 'Publicando o resultado…';
    else if (publicacao === 'pendente') rotulo = 'Publicar o resultado';
    else rotulo = 'Encerrar';
  }
  const aoClicar = comecou && terminouCategoria && ultimaCategoria && publicacao === 'pendente'
    ? publicarAgora
    : avancar;

  return (
    <div className="pg-cer" ref={raiz} role="dialog" aria-modal="true" aria-label="Revelação dos vencedores">
      <div className="pg-cer-topo">
        <span className="pg-cer-marca"><Award size={18} /> PHD Awards · Projetos do Ano</span>
        <span className="pg-cer-ferramentas">
          <button type="button" onClick={telaCheia} aria-label="Tela cheia" title="Tela cheia"><Maximize2 size={18} /></button>
          <button type="button" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><X size={20} /></button>
        </span>
      </div>

      {!atual ? (
        <div className="pg-cer-abertura"><p>Nenhum pódio confirmado para revelar.</p></div>
      ) : !comecou ? (
        <div className="pg-cer-abertura">
          <Award size={64} className="pg-cer-trofeu" />
          <h1>Projetos do Ano</h1>
          <p>E os vencedores são…</p>
        </div>
      ) : (
        <div className="pg-cer-palco" key={atual.categoria}>
          <h2 className="pg-cer-categoria">{AWARDS_CATEGORIA_LABEL[atual.categoria]}</h2>
          <div className="pg-cer-podio">
            {[2, 1, 3].filter((pos) => atual.posicoes.includes(pos)).map((pos) => {
              const ordemNaRevelacao = atual.posicoes.indexOf(pos);
              const revelado = ordemNaRevelacao < revelados;
              const projeto = porId.get(podio[atual.categoria][pos - 1]);
              return (
                <div className={`pg-cer-lugar lugar-${pos}`} key={pos}>
                  <div className={`pg-cer-cartao ${revelado ? 'is-revelado' : ''} ${suspense === pos ? 'is-suspense' : ''}`}>
                    {revelado && projeto ? (
                      <>
                        <span className="pg-cer-pos">{pos}º lugar</span>
                        <strong className="pg-cer-nome">{projeto.codigo_setor}</strong>
                        <span className="pg-cer-meta">Cadastrado por {projeto.autorNome || '—'}</span>
                        <span className="pg-cer-meta pg-cer-participantes">Participantes: {projeto.participantes}</span>
                      </>
                    ) : suspense === pos ? (
                      <span className="pg-cer-contagem" key={contagem}>{contagem}</span>
                    ) : (
                      <span className="pg-cer-oculto">?</span>
                    )}
                  </div>
                  <div className="pg-cer-degrau"><span>{pos}º</span></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {festa > 0 && <Confete key={festa} />}

      <div className="pg-cer-pe">
        {erro && <p className="pg-cer-erro">Não foi possível publicar o resultado: {erro}</p>}
        {atual && (
          <button
            type="button"
            className="pg-btn pg-btn-primary pg-cer-btn"
            onClick={aoClicar}
            disabled={suspense != null || publicacao === 'publicando'}
          >
            {publicacao === 'publicando' && <Loader2 size={18} className="pg-spin" />}
            {rotulo}
          </button>
        )}
      </div>
    </div>
  );
}

/** Confete só de CSS. Posições fixas por índice: o mesmo desenho toda vez, sem aleatório no render. */
function Confete() {
  return (
    <div className="pg-cer-confete" aria-hidden="true">
      {Array.from({ length: 70 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: CORES_CONFETE[i % CORES_CONFETE.length],
            animationDelay: `${((i * 53) % 25) / 10}s`,
            animationDuration: `${3 + ((i * 29) % 20) / 10}s`,
            '--giro': `${(i * 47) % 360}deg`,
          }}
        />
      ))}
    </div>
  );
}
