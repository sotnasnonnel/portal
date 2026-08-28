import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Upload, TriangleAlert, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { CATEGORIAS, ehOperadorEstoque } from '../../../../config/estoque';
import { listarPosicao, importarLinhas } from '../../lib/estoque';
import { normalizarPlanilha, planejarImportacao } from '../../lib/importar';
import { detalheVariante } from '../../lib/catalogo';

export default function ImportarEstoque() {
  const { modules } = useAuth();
  const operador = ehOperadorEstoque(modules);
  const inputRef = useRef(null);

  const [posicao, setPosicao] = useState([]);
  const [arquivo, setArquivo] = useState('');
  const [abas, setAbas] = useState([]);
  const [aba, setAba] = useState('');
  const [matrizes, setMatrizes] = useState({});
  const [categoria, setCategoria] = useState('epi');
  const [leitura, setLeitura] = useState(null);   // { linhas, avisos, ignoradas }
  const [plano, setPlano] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (!operador) return;
    listarPosicao({ incluirInativas: true }).then(setPosicao).catch((e) => setErro(e.message));
  }, [operador]);

  const escolherArquivo = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro('');
    setResultado(null);
    setLeitura(null);
    setPlano(null);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const porAba = {};
      for (const nome of wb.SheetNames) {
        // raw:true é o que impede o CA 45021 de chegar como "45,021" — e o CA
        // faz parte da chave da variante. Ver o cabeçalho de lib/importar.js.
        porAba[nome] = XLSX.utils.sheet_to_json(wb.Sheets[nome], {
          header: 1, raw: true, defval: '',
        });
      }
      setArquivo(f.name);
      setAbas(wb.SheetNames);
      setMatrizes(porAba);
      // Palpite: a aba cujo cabeçalho tem "descrição" costuma ser a da tabela.
      const provavel = wb.SheetNames.find((n) => porAba[n].some(
        (l) => (l || []).some((c) => String(c).toLowerCase().includes('descri')),
      ));
      setAba(provavel || wb.SheetNames[0]);
      // Nome do arquivo dá o palpite da categoria; continua trocável.
      if (/uniforme/i.test(f.name)) setCategoria('uniforme');
      else if (/epi/i.test(f.name)) setCategoria('epi');
    } catch (err) {
      setErro(`Não foi possível ler o arquivo: ${err.message}`);
    }
  };

  const conferir = () => {
    setErro('');
    setResultado(null);
    const matriz = matrizes[aba];
    if (!matriz) { setErro('Escolha a aba da planilha.'); return; }
    const r = normalizarPlanilha(matriz, categoria);
    setLeitura(r);
    setPlano(r.linhas.length ? planejarImportacao(r.linhas, posicao) : null);
  };

  const importar = async () => {
    if (!plano) return;
    setOcupado(true);
    setErro('');
    setProgresso({ feitas: 0, total: plano.criar.length + plano.atualizar.length });
    try {
      const r = await importarLinhas(plano, (feitas, total) => setProgresso({ feitas, total }));
      setResultado(r);
      setPlano(null);
      setLeitura(null);
      setPosicao(await listarPosicao({ incluirInativas: true }));
      if (inputRef.current) inputRef.current.value = '';
      setArquivo('');
      setAbas([]);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
      setProgresso(null);
    }
  };

  if (!operador) {
    return (
      <div className="est-page">
        <div className="est-aviso tom-info">
          <AlertCircle size={16} />
          Só o time do Administrativo importa planilhas. Você pode{' '}
          <Link to="/estoque/posicao">consultar a posição</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="est-page est-page-wide">
      <div className="est-cab">
        <div className="est-cab-txt">
          <h1 className="est-title"><FileSpreadsheet size={22} /> Importar planilha</h1>
          <p className="est-sub">
            Carga do catálogo a partir das planilhas de EPIs e de uniformes. Pode ser
            repetida: item que já existe não é duplicado, e saldo diferente vira um
            ajuste — não uma segunda entrada.
          </p>
        </div>
      </div>

      {erro && <div className="est-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {resultado && (
        <div className={`est-aviso ${resultado.erros.length ? 'tom-alerta' : 'tom-ok'}`}>
          {resultado.erros.length ? <TriangleAlert size={16} /> : <CheckCircle2 size={16} />}
          <div>
            <strong>
              {resultado.criadas} {resultado.criadas === 1 ? 'variação criada' : 'variações criadas'}
              {resultado.atualizadas ? `, ${resultado.atualizadas} atualizada(s)` : ''}
              {resultado.ajustadas ? `, ${resultado.ajustadas} ajuste(s) de saldo` : ''}.
            </strong>
            {resultado.erros.length > 0 && (
              <>
                <div style={{ marginTop: 6 }}>
                  {resultado.erros.length} linha(s) falharam. Corrija e importe de novo — o que
                  já entrou não será duplicado.
                </div>
                <ul>{resultado.erros.slice(0, 12).map((m, i) => <li key={i}>{m}</li>)}</ul>
              </>
            )}
            <div style={{ marginTop: 6 }}>
              <Link className="est-link" to="/estoque/posicao">Ver a posição de estoque</Link>
            </div>
          </div>
        </div>
      )}

      <div className="est-card">
        <h2 className="est-card-tit">1 · Arquivo</h2>
        <div className="est-campo">
          <label htmlFor="i-arq">Planilha (.xlsx)</label>
          <input id="i-arq" ref={inputRef} className="est-input" type="file"
            accept=".xlsx,.xls" onChange={escolherArquivo} disabled={ocupado} />
          {arquivo && <span className="est-campo-dica">{arquivo}</span>}
        </div>

        {abas.length > 0 && (
          <div className="est-linha">
            <div className="est-campo">
              <label htmlFor="i-aba">Aba</label>
              <select id="i-aba" className="est-select" value={aba}
                onChange={(e) => { setAba(e.target.value); setLeitura(null); setPlano(null); }}>
                {abas.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="est-campo">
              <label htmlFor="i-cat">Categoria</label>
              <select id="i-cat" className="est-select" value={categoria}
                onChange={(e) => { setCategoria(e.target.value); setLeitura(null); setPlano(null); }}>
                {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.plural}</option>)}
              </select>
              <span className="est-campo-dica">
                Uniformes lêem setor e gênero; EPIs lêem o CA. Escolher errado agrupa itens
                que não deveriam se juntar.
              </span>
            </div>
          </div>
        )}

        {abas.length > 0 && (
          <div className="est-acoes">
            <button type="button" className="est-btn est-btn-ghost" onClick={conferir} disabled={ocupado}>
              <ArrowRight size={16} /> Conferir antes de importar
            </button>
          </div>
        )}
      </div>

      {leitura && (
        <div className="est-card">
          <h2 className="est-card-tit">2 · Conferência</h2>

          {leitura.linhas.length === 0 ? (
            <div className="est-aviso tom-erro">
              <AlertCircle size={16} />
              Nenhuma linha aproveitável nesta aba. {leitura.avisos[0] || ''}
            </div>
          ) : (
            <>
              <div className="est-tiles">
                <div className="est-tile">
                  <strong>{plano.resumo.criar}</strong><span>variações a criar</span>
                </div>
                <div className="est-tile">
                  <strong>{plano.resumo.pecas}</strong><span>peças de entrada inicial</span>
                </div>
                <div className={`est-tile ${plano.resumo.ajustes ? 'is-alerta' : ''}`}>
                  <strong>{plano.resumo.ajustes}</strong><span>ajustes de saldo</span>
                </div>
                <div className="est-tile">
                  <strong>{plano.resumo.semMudanca}</strong><span>já conferem</span>
                </div>
                <div className="est-tile">
                  <strong>{leitura.ignoradas}</strong><span>linhas ignoradas</span>
                </div>
              </div>

              {leitura.avisos.length > 0 && (
                <div className="est-aviso tom-alerta">
                  <TriangleAlert size={16} />
                  <div>
                    <strong>{leitura.avisos.length} ponto(s) de atenção:</strong>
                    <ul>{leitura.avisos.slice(0, 10).map((a, i) => <li key={i}>{a}</li>)}</ul>
                    {leitura.avisos.length > 10 && <div>…e mais {leitura.avisos.length - 10}.</div>}
                  </div>
                </div>
              )}

              <div className="est-tabela-scroll" style={{ maxHeight: 380, overflowY: 'auto' }}>
                <table className="est-tabela">
                  <thead>
                    <tr>
                      <th className="num">Linha</th>
                      <th>Item</th>
                      <th className="num">Planilha</th>
                      <th className="num">Sistema</th>
                      <th>O que vai acontecer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...plano.criar.map((l) => ({ ...l, acao: 'criar' })),
                      ...plano.atualizar.map((l) => ({ ...l, acao: 'atualizar' }))]
                      .sort((a, b) => a.linhaPlanilha - b.linhaPlanilha)
                      .map((l) => (
                        <tr key={l.chave}>
                          <td className="num">{l.linhaPlanilha}</td>
                          <td>
                            <span className="est-item-nome">{l.descricao}</span>
                            <span className="est-item-det">{detalheVariante(l) || '—'}</span>
                          </td>
                          <td className="num">{l.saldo}</td>
                          <td className="num">{l.acao === 'criar' ? '—' : l.saldoAtual}</td>
                          <td>
                            {l.acao === 'criar'
                              ? <span className="est-badge tom-info">Criar {l.saldo > 0 ? `+ entrada de ${l.saldo}` : 'sem saldo'}</span>
                              : (
                                <>
                                  {l.delta !== 0 && (
                                    <span className="est-badge tom-alerta">
                                      Ajuste {l.delta > 0 ? `+${l.delta}` : l.delta}
                                    </span>
                                  )}
                                  {l.mudouCadastro && <span className="est-badge tom-ok" style={{ marginLeft: 6 }}>Atualizar cadastro</span>}
                                </>
                              )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="est-acoes">
                {progresso && (
                  <span className="est-campo-dica">
                    Gravando {progresso.feitas} de {progresso.total}…
                  </span>
                )}
                <button type="button" className="est-btn est-btn-primary est-acoes-fim"
                  onClick={importar}
                  disabled={ocupado || (!plano.resumo.criar && !plano.resumo.atualizar)}>
                  {ocupado ? <Loader2 size={16} className="est-spin" /> : <Upload size={16} />}
                  Importar {plano.resumo.criar + plano.resumo.atualizar} linha(s)
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
