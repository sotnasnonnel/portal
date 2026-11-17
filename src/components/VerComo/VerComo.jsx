import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, GripVertical, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import SearchSelect from '../UI/SearchSelect';
import {
  gravarPosicao, lerPosicao, limitarPosicao, posicaoPadrao,
} from './verComoPosicao';
import './VerComo.css';

// "Ver como" (regra em config/verComo.js), no mesmo desenho do HUB PHD:
//   desligado → botão discreto "Ver como…", arrastável, que lembra onde ficou;
//   ligado    → faixa no topo dizendo de quem é a visão, com "Trocar" e "Sair".
// Só aparece para o super admin, pelo usuário REAL.

function useArrasteSalvo(caixaRef) {
  const janela = () => ({ largura: window.innerWidth, altura: window.innerHeight });
  const [pos, setPos] = useState(() => lerPosicao(window.localStorage) || posicaoPadrao(janela(), null));
  const [arrastando, setArrastando] = useState(false);
  const posRef = useRef(pos);
  const arrasteRef = useRef(null);
  const ignorarCliqueRef = useRef(false);

  const mover = useCallback((alvo) => {
    const el = caixaRef.current;
    const novo = limitarPosicao(alvo, janela(), { largura: el?.offsetWidth, altura: el?.offsetHeight });
    posRef.current = novo;
    setPos(novo);
  }, [caixaRef]);

  useEffect(() => {
    const aoRedimensionar = () => mover(posRef.current);
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, [mover]);

  const puxador = {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      arrasteRef.current = {
        dx: e.clientX - posRef.current.left, dy: e.clientY - posRef.current.top, x0: e.clientX, y0: e.clientY, moveu: false,
      };
      setArrastando(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e) => {
      const a = arrasteRef.current;
      if (!a) return;
      if (Math.abs(e.clientX - a.x0) > 3 || Math.abs(e.clientY - a.y0) > 3) a.moveu = true;
      mover({ left: e.clientX - a.dx, top: e.clientY - a.dy });
    },
    onPointerUp: (e) => {
      const a = arrasteRef.current;
      if (!a) return;
      arrasteRef.current = null;
      setArrastando(false);
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      if (!a.moveu) return;
      ignorarCliqueRef.current = true;
      gravarPosicao(window.localStorage, posRef.current);
    },
  };
  puxador.onPointerCancel = puxador.onPointerUp;

  const foiArraste = () => {
    const sim = ignorarCliqueRef.current;
    ignorarCliqueRef.current = false;
    return sim;
  };

  return {
    pos, arrastando, puxador, foiArraste,
  };
}

function usePessoas(ativo) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    if (!ativo || lista) return undefined;
    let vivo = true;
    supabase.from('colaboradores').select('id, nome, email, perfil, funcao').eq('ativo', true).order('nome')
      .then(({ data }) => { if (vivo) setLista(data || []); });
    return () => { vivo = false; };
  }, [ativo, lista]);
  return lista;
}

export default function VerComo() {
  const {
    podeVerComo, verComo, usuarioReal, iniciarVerComo, encerrarVerComo,
  } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const lista = usePessoas(podeVerComo && (aberto || !!verComo));
  const caixaRef = useRef(null);
  const {
    pos, arrastando, puxador, foiArraste,
  } = useArrasteSalvo(caixaRef);

  const opcoes = useMemo(() => (lista || [])
    .filter((c) => c.id !== usuarioReal?.id)
    .map((c) => ({ value: c.id, label: `${c.nome}${c.funcao ? ` — ${c.funcao}` : ''}` })), [lista, usuarioReal]);

  // Folga no fim da página para a faixa não tapar o último conteúdo.
  const ligado = podeVerComo && !!verComo;
  useEffect(() => {
    document.body.classList.toggle('em-vercomo', ligado);
    return () => document.body.classList.remove('em-vercomo');
  }, [ligado]);

  if (!podeVerComo) return null;

  const escolher = async (id) => {
    if (!id) return;
    setErro('');
    setCarregando(true);
    const r = await iniciarVerComo(id);
    setCarregando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setAberto(false);
    // Começa pela Home, como a pessoa entraria: a tela de agora pode nem existir
    // para ela (a guarda de rota mandaria para outro lugar sem avisar).
    navigate('/home');
  };

  const sair = () => {
    encerrarVerComo();
    setAberto(false);
    navigate('/home');
  };

  if (verComo) {
    return (
      <div className="vercomo-faixa" role="status">
        <Eye size={16} aria-hidden="true" />
        <span className="vercomo-texto">
          Vendo como <strong>{verComo.nome}</strong> — somente leitura. Cards, menus e acessos são os dela;
          {' '}o que o banco filtra por pessoa ainda chega com o seu acesso (o TI já recorta como ela vê).
        </span>
        <span className="vercomo-acoes">
          <span className="vercomo-trocar">
            <SearchSelect
              options={opcoes}
              value={verComo.id}
              onChange={escolher}
              placeholder={lista ? 'Trocar pessoa…' : 'Carregando…'}
              ariaLabel="Trocar a pessoa do ver como"
            />
          </span>
          <button type="button" className="vercomo-sair" onClick={sair}>
            <X size={14} aria-hidden="true" /> Sair do ver como
          </button>
        </span>
        {erro && <span className="vercomo-erro">{erro}</span>}
      </div>
    );
  }

  return (
    <div ref={caixaRef} className="vercomo-flutuante" style={{ left: pos.left, top: pos.top }}>
      {aberto ? (
        <div className="vercomo-painel">
          <div className="vercomo-painel-h">
            <span className="vercomo-titulo">
              <span {...puxador} className={`vercomo-alca ${arrastando ? 'arrastando' : ''}`} title="Arraste para mover" aria-hidden="true">
                <GripVertical size={14} />
              </span>
              Ver o portal como…
            </span>
            <button type="button" className="vercomo-x" onClick={() => setAberto(false)} aria-label="Fechar"><X size={14} /></button>
          </div>
          {lista === null
            ? <span className="vercomo-hint">Carregando pessoas…</span>
            : (
              <SearchSelect
                options={opcoes}
                value=""
                onChange={escolher}
                placeholder="Escolha a pessoa…"
                ariaLabel="Pessoa para ver o portal como ela"
              />
            )}
          {carregando && <span className="vercomo-hint">Abrindo…</span>}
          {erro && <span className="vercomo-erro">{erro}</span>}
          <span className="vercomo-hint">Fica somente leitura enquanto durar.</span>
        </div>
      ) : (
        <button
          type="button"
          {...puxador}
          className={`vercomo-botao ${arrastando ? 'arrastando' : ''}`}
          onClick={() => { if (!foiArraste()) setAberto(true); }}
          title="Ver o portal como outra pessoa (só super admin) — arraste para mover"
        >
          <Eye size={14} aria-hidden="true" /> Ver como…
        </button>
      )}
    </div>
  );
}
