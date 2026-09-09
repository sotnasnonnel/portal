import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Loader2, AlertCircle, X, AlertTriangle, Eye, Headset } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { FLUXOS } from '../../../../config/mobilizacao';
import { listarCatalogo } from '../../../mobilizacao/lib/mobilizacao';
import { lerParaMatriz, lerChamados } from '../../lib/dados';
import { montarMatriz, linhaEmAndamento } from '../../../mobilizacao/lib/matriz';
import MatrizEtapas, { LegendaMatriz } from '../../../mobilizacao/app/components/MatrizEtapas';
import { montarMatrizChamados } from '../../lib/matrizChamados';
import MatrizChamados, { LegendaChamados } from '../components/MatrizChamados';

const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * O mapa: a matriz de bolinhas que a planilha dava e a lista não dá.
 *
 * É a tela da reunião de torre. A leitura importante é a VERTICAL — uma coluna
 * inteira de vermelho diz que aquele passo travou todo mundo, coisa que numa
 * lista de 400 etapas ninguém enxerga.
 *
 * Só leitura, como o resto do módulo. As regras (cor, ordem, colunas) vivem em
 * lib/matriz.js, testadas.
 */
export default function MapaTorre() {
  const { user } = useAuth();
  const [dados, setDados] = useState({ processos: [], etapas: [] });
  const [catalogo, setCatalogo] = useState([]);
  const [chamados, setChamados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [busca, setBusca] = useState('');
  const [fFluxo, setFFluxo] = useState('');
  const [soMeus, setSoMeus] = useState(false);
  const [soAtrasados, setSoAtrasados] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      // O catalogo continua vindo direto da tabela: a RLS dele ja e `select
      // true`, porque o front precisa do SLA para prever prazo.
      const [m, c, ch] = await Promise.all([
        lerParaMatriz(), listarCatalogo(), lerChamados({ diasFechados: 0 }),
      ]);
      setDados(m);
      setCatalogo(c);
      setChamados(ch);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const blocos = useMemo(() => {
    const termo = semAcento(busca).trim();

    // O filtro por PESSOA olha o processo e as etapas: na reunião, "o que é
    // meu" tanto pode ser um processo que eu conduzo quanto um passo solto que
    // caiu no meu nome dentro do processo de outra pessoa.
    const meusProcessos = new Set(
      dados.etapas.filter((e) => e.responsavel_id === user?.id).map((e) => e.processo_id),
    );

    const processos = dados.processos.filter((p) => {
      if (fFluxo && p.fluxo !== fFluxo) return false;
      if (soMeus && p.responsavel_id !== user?.id && !meusProcessos.has(p.id)) return false;
      if (termo) {
        const alvo = [p.titulo, p.profissional_nome, p.cliente_phd, p.local_obra, p.cod_ct,
          p.responsavelNome].filter(Boolean).join(' ');
        if (!semAcento(alvo).includes(termo)) return false;
      }
      return true;
    });

    const montada = montarMatriz(processos, dados.etapas, catalogo, FLUXOS);

    // "Só os atrasados" filtra LINHAS depois de montar, e não processos antes:
    // é a linha que sabe quantas células ficaram vermelhas.
    if (!soAtrasados) return montada;
    return montada
      .map((b) => ({ ...b, linhas: b.linhas.filter((l) => l.vencidas > 0) }))
      .filter((b) => b.linhas.length);
  }, [dados, catalogo, busca, fFluxo, soMeus, soAtrasados, user?.id]);

  // A matriz de chamados responde a BUSCA e ao "so os meus" (por atendente). Os
  // outros dois filtros sao de mobilizacao — fluxo nao existe em chamado, e
  // "so os travados" ja e o que a cor da celula diz.
  const linhasChamados = useMemo(() => {
    const termo = semAcento(busca).trim();
    const visiveis = chamados.filter((c) => {
      if (soMeus && c.atendente_id !== user?.id) return false;
      if (termo && !semAcento(`${c.assunto || ''} ${c.numero || ''}`).includes(termo)) return false;
      return true;
    });
    // O instante sai daqui e desce junto: cor das celulas e contagem do rodape
    // tem de olhar o mesmo relogio.
    const agora = Date.now();
    return { linhas: montarMatrizChamados(visiveis, { agora }), agora };
  }, [chamados, busca, soMeus, user?.id]);

  const filtrando = !!busca || !!fFluxo || soMeus || soAtrasados;
  const totalLinhas = blocos.reduce((s, b) => s + b.linhas.length, 0);
  const travadas = blocos.reduce((s, b) => s + b.linhas.filter((l) => l.vencidas > 0).length, 0);
  const concluindo = blocos.reduce((s, b) => s + b.linhas.filter((l) => !linhaEmAndamento(l)).length, 0);
  const totalChamados = linhasChamados.linhas.reduce((s, l) => s + l.total, 0);

  return (
    <div className="mob-page mob-page-full">
      <h1 className="mob-title"><LayoutGrid size={24} /> Mapa</h1>
      <p className="mob-sub">
        Uma linha por mobilização, uma coluna por passo. A leitura útil é de cima para baixo:
        uma coluna inteira de vermelho é um passo que travou todo mundo.
      </p>
      <p className="tor-nota">
        <Eye size={14} /> Tela de consulta: nada aqui pode ser alterado.
      </p>

      <div className="mob-filtros">
        <div className="mob-filtro" style={{ minWidth: 240 }}>
          <label htmlFor="tor-m-busca">Buscar</label>
          <input id="tor-m-busca" type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Pessoa, cliente, obra ou código" />
        </div>

        <div className="mob-filtro">
          <label htmlFor="tor-m-fluxo">Fluxo</label>
          <select id="tor-m-fluxo" value={fFluxo} onChange={(e) => setFFluxo(e.target.value)}>
            <option value="">Todos</option>
            {FLUXOS.map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
          </select>
        </div>

        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${soMeus ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => setSoMeus((v) => !v)}>
          Só os meus
        </button>

        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${soAtrasados ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => setSoAtrasados((v) => !v)}>
          <AlertTriangle size={15} /> Só os travados
        </button>

        {filtrando && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm mob-filtro-limpa"
            onClick={() => { setBusca(''); setFFluxo(''); setSoMeus(false); setSoAtrasados(false); }}>
            <X size={15} /> Limpar
          </button>
        )}
      </div>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div>
      ) : (
        <>
          <p className="mob-campo-dica">
            {totalLinhas} mobilização(ões) em andamento
            {travadas > 0 && ` · ${travadas} com passo vencido`}
            {concluindo > 0 && ` · ${concluindo} com todos os passos resolvidos`}
            {filtrando && ` (de ${dados.processos.length} no total)`}
          </p>

          <LegendaMatriz />
          <MatrizEtapas blocos={blocos} />

          {/* Os chamados do Adm na MESMA tela: o pedido era nao ter que trocar
              de pagina no meio da reuniao. */}
          <section className="mob-card mob-matriz-card">
            <h2 className="mob-card-tit">
              <Headset size={18} /> Chamados do Administrativo
              <span className="mob-matriz-cont">{totalChamados}</span>
            </h2>
            <p className="mob-campo-dica">
              Tipo de chamado na linha, situação na coluna. O número é quantos há ali, e a cor é o
              pior caso entre eles — uma célula com nove em dia e um vencido é vermelha.
            </p>
            <LegendaChamados />
            <MatrizChamados linhas={linhasChamados.linhas} agora={linhasChamados.agora} />
          </section>
        </>
      )}
    </div>
  );
}
