import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, ChevronRight, FileSignature, LayoutDashboard, Laptop, RefreshCw, Replace,
} from 'lucide-react';
import { useTi } from '../components/TiContext';
import { Estado, PageHead, Secao } from '../components/Pecas';
import { money, tomSituacao } from '../../lib/formato';
import {
  ROTA_TROCA_EQUIPAMENTO, contarPor, pendenteTermo, resumoPainel,
} from '../../lib/regras';
import './painel.css';

// Rótulos que a regra cria para o campo vazio: a lista de ativos não filtra por vazio.
const SEM_FILTRO = new Set(['Não informado', 'Sem fornecedor']);
const fmtN = new Intl.NumberFormat('pt-BR');
const n = (v) => fmtN.format(v);
const pct = (parte, todo) => (todo ? Math.round((parte / todo) * 100) : 0);
const plural = (v, um, varios) => `${n(v)} ${v === 1 ? um : varios}`;

/**
 * Lista de barras do painel. Cada linha leva o rótulo e o número em cima e a barra
 * embaixo, para caber no celular sem cortar o rótulo. Com `onPick`, a linha vira
 * botão e leva para a lista de ativos filtrada; "Não informado" não tem filtro na
 * lista de ativos, então fica só como leitura (o mesmo vale para "Sem fornecedor").
 */
function Barras({
  itens, total, onPick, tom, detalhe, acao = 'Ver na lista de ativos',
}) {
  if (!itens.length) return <p className="ti-painel-vazio-sec">Nada para mostrar aqui.</p>;
  const max = Math.max(...itens.map((i) => i.v), 1);
  return (
    <ul className="ti-painel-barras">
      {itens.map((i) => {
        const p = pct(i.v, total);
        const clicavel = onPick && !SEM_FILTRO.has(i.l);
        const extra = detalhe?.(i);
        const corpo = (
          <>
            <span className="ti-painel-barra-topo">
              {tom && <i className={`ti-painel-dot ${tom(i.l)}`} aria-hidden="true" />}
              <span className="ti-painel-barra-l">{i.l}</span>
              <span className="ti-painel-barra-v">
                <b>{n(i.v)}</b>
                <span className="ti-painel-barra-p">{p}%</span>
              </span>
              {clicavel && <ChevronRight size={16} className="ti-painel-seta" aria-hidden="true" />}
            </span>
            {extra && <span className="ti-painel-barra-extra">{extra}</span>}
            <span className="ti-painel-trilho" aria-hidden="true">
              <span style={{ width: `${Math.max(1, (i.v / max) * 100).toFixed(2)}%` }} />
            </span>
          </>
        );
        const rotulo = `${i.l}: ${n(i.v)} (${p}% do total)${extra ? `, ${extra}` : ''}`;
        return (
          <li key={i.l}>
            {clicavel ? (
              <button
                type="button"
                className="ti-painel-barra is-link"
                onClick={() => onPick(i.l)}
                aria-label={`${rotulo}. ${acao}`}
              >
                {corpo}
              </button>
            ) : (
              <div className="ti-painel-barra" aria-label={rotulo} role="group">{corpo}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Esqueleto no desenho da página: três números em cima e quatro cartões embaixo. */
function EsqueletoPainel() {
  return (
    <div className="ti-stack" aria-busy="true" aria-live="polite">
      <span className="ti-painel-sr">Carregando o painel…</span>
      <div className="ti-painel-topo" aria-hidden="true">
        {[0, 1, 2].map((k) => (
          <div key={k} className={`ti-card ti-painel-skel-card ${k === 0 ? 'ti-painel-prioridade' : ''}`}>
            <div className="ti-skel" style={{ width: '45%' }} />
            <div className="ti-skel ti-painel-skel-n" />
            <div className="ti-skel" style={{ width: '70%' }} />
          </div>
        ))}
      </div>
      <div className="ti-grid g2" aria-hidden="true">
        {[0, 1, 2, 3].map((k) => (
          <div key={k} className="ti-card ti-stack">
            <div className="ti-skel" style={{ width: '35%' }} />
            {[80, 60, 40].map((w) => <div key={w} className="ti-skel" style={{ width: `${w}%` }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PainelTi() {
  const navigate = useNavigate();
  const {
    dados, carregando, erro, recarregar, setFiltro, podeEscrever,
  } = useTi();
  const r = useMemo(() => resumoPainel(dados.ativos), [dados.ativos]);
  const porSituacao = useMemo(() => contarPor(dados.ativos, 'situacao'), [dados.ativos]);
  const porTipo = useMemo(() => contarPor(dados.ativos, 'tipo'), [dados.ativos]);
  const porTermo = useMemo(() => contarPor(dados.ativos.filter(pendenteTermo), 'situacao_termo'), [dados.ativos]);
  const porFornecedor = useMemo(
    () => r.fornecedores.map((f) => ({ l: f.fornecedor, v: f.quantidade, mensal: f.mensal })),
    [r.fornecedores],
  );

  const verAtivos = (patch) => {
    setFiltro('ativos', {
      q: '', fornecedor: '', tipo: '', situacao: '', termo: '', ...patch,
    });
    navigate('/ti/ativos');
  };
  const verTermosPendentes = () => {
    setFiltro('termos', { status: 'pendente', aba: 'equipe' });
    navigate('/ti/termos');
  };

  // Progresso do termo: dos equipamentos que estão com alguém, quantos já têm termo.
  const assinados = Math.max(0, r.emUso - r.pendentes);
  const progresso = pct(assinados, r.emUso);
  const foraDeUso = r.total - r.emUso;
  const semAtivos = !carregando && !erro && dados.ativos.length === 0;

  let conteudo;
  if (carregando) {
    conteudo = <EsqueletoPainel />;
  } else if (erro) {
    conteudo = (
      <div className="ti-card ti-painel-estado">
        <p>Os números do painel aparecem quando a lista de ativos carregar.</p>
        <button type="button" className="ti-btn" onClick={recarregar}><RefreshCw size={15} aria-hidden="true" /> Tentar de novo</button>
      </div>
    );
  } else if (semAtivos) {
    conteudo = (
      <div className="ti-card ti-painel-estado">
        <Laptop size={28} aria-hidden="true" />
        <p><strong>Nenhum ativo por aqui ainda.</strong></p>
        <p>
          {podeEscrever
            ? 'Quando os equipamentos forem cadastrados, os números de uso, custo e termo aparecem neste painel.'
            : 'Não há equipamentos com você nem com a sua equipe.'}
        </p>
      </div>
    );
  } else {
    conteudo = (
      <>
        <h2 className="ti-painel-sr">Resumo</h2>
        <div className="ti-painel-topo">
          <button
            type="button"
            className={`ti-card ti-painel-num ti-painel-prioridade ${r.pendentes ? 'is-warn' : 'is-ok'}`}
            onClick={verTermosPendentes}
          >
            <span className="ti-painel-num-l"><FileSignature size={16} aria-hidden="true" /> Termos de responsabilidade</span>
            {r.pendentes ? (
              <>
                <span className="ti-painel-num-n">
                  {n(r.responsaveisPendentes)}
                  <small>{r.responsaveisPendentes === 1 ? 'pessoa sem aceitar' : 'pessoas sem aceitar'}</small>
                </span>
                <span className="ti-painel-num-s">
                  {plural(r.pendentes, 'equipamento em uso está', 'equipamentos em uso estão')} sem termo assinado.
                </span>
              </>
            ) : (
              <>
                <span className="ti-painel-num-n">Em dia</span>
                <span className="ti-painel-num-s">Todo equipamento em uso tem termo assinado.</span>
              </>
            )}
            {r.emUso > 0 && (
              <span className="ti-painel-meta">
                <span
                  className="ti-painel-medidor"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progresso}
                  aria-label="Equipamentos em uso com termo assinado"
                >
                  <span style={{ width: `${progresso}%` }} />
                </span>
                <span className="ti-painel-meta-t">
                  <b>{progresso}%</b> com termo ({n(assinados)} de {n(r.emUso)})
                </span>
              </span>
            )}
            <span className="ti-painel-cta">Ver quem falta <ChevronRight size={16} aria-hidden="true" /></span>
          </button>

          <button type="button" className="ti-card ti-painel-num" onClick={() => verAtivos({})}>
            <span className="ti-painel-num-l">{podeEscrever ? 'Ativos cadastrados' : 'Seus e da sua equipe'}</span>
            <span className="ti-painel-num-n">{n(r.total)}</span>
            <span className="ti-painel-num-s">
              <b>{n(r.emUso)}</b> em uso com alguém · <b>{n(foraDeUso)}</b> nas demais situações
            </span>
            <span className="ti-painel-cta">Ver todos <ChevronRight size={16} aria-hidden="true" /></span>
          </button>

          <div className="ti-card ti-painel-num">
            <span className="ti-painel-num-l">Custo mensal</span>
            <span className="ti-painel-num-n">{money(r.mensal)}</span>
            <span className="ti-painel-num-s">
              Soma das mensalidades{r.fornecedores.length > 1 ? ` de ${plural(r.fornecedores.length, 'fornecedor', 'fornecedores')}` : ''}.
            </span>
          </div>
        </div>

        <div className="ti-grid g2">
          {r.pendentes > 0 && (
            <Secao titulo="Termos pendentes, por situação do termo" contagem={n(r.pendentes)}>
              <Barras itens={porTermo} total={r.pendentes} />
              <button type="button" className="ti-btn ti-painel-rodape" onClick={verTermosPendentes}>
                <FileSignature size={15} aria-hidden="true" /> Abrir termos pendentes
              </button>
            </Secao>
          )}
          <Secao titulo="Por fornecedor" contagem={n(porFornecedor.length)}>
            <Barras
              itens={porFornecedor}
              total={r.total}
              detalhe={(i) => (i.mensal ? `${money(i.mensal)} por mês` : 'sem mensalidade')}
              onPick={(fornecedor) => verAtivos({ fornecedor })}
            />
          </Secao>
          <Secao titulo="Por situação" contagem={n(porSituacao.length)}>
            <Barras itens={porSituacao} total={r.total} tom={tomSituacao} onPick={(situacao) => verAtivos({ situacao })} />
          </Secao>
          <Secao titulo="Por tipo" contagem={n(porTipo.length)}>
            <Barras itens={porTipo} total={r.total} onPick={(tipo) => verAtivos({ tipo })} />
          </Secao>
        </div>
      </>
    );
  }

  return (
    <div className="ti-page ti-stack ti-painel-page">
      <PageHead Icon={LayoutDashboard} titulo="Controle de ativos" sub="Equipamentos de TI da PHD: com quem está cada um, quanto custa por mês e se o termo de responsabilidade foi assinado.">
        {podeEscrever
          ? <button type="button" className="ti-btn" onClick={() => navigate('/ti/movimentar')}><ArrowLeftRight size={15} aria-hidden="true" /> Movimentar ativo</button>
          : <button type="button" className="ti-btn" onClick={() => navigate(ROTA_TROCA_EQUIPAMENTO)}><Replace size={15} aria-hidden="true" /> Pedir troca de equipamento</button>}
        <button type="button" className="ti-btn primary" onClick={() => navigate('/ti/ativos')}><Laptop size={15} aria-hidden="true" /> Ver ativos</button>
      </PageHead>
      <Estado />
      {conteudo}
    </div>
  );
}
