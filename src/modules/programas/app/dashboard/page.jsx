import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ExternalLink, LayoutDashboard, Loader2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  CATEGORIA_LABEL, SITUACOES, SITUACAO_LABEL, corDoSetor, ehAdminProgramas,
} from '../../../../config/programas';
import { COR_FORMA } from '../../lib/paleta';
import { listarIdeias, atualizarSituacao } from '../../lib/ideias';
import { resumoIdeias } from '../../lib/indicadores';

/**
 * Dashboard do Campo de Ideias — item 4 da planilha, "Liberado para todos".
 *
 * A planilha lista exatamente quatro blocos, e a tela tem exatamente eles, na
 * mesma ordem:
 *   card    Quantidade de iniciativas
 *   gráfico Quantidade de iniciativas por setor
 *   Kanban  cards com o nome da iniciativa, posicionados conforme o tipo
 *           + legenda de cards coloridos por setor
 *           + legenda de borda colorida para ideia ou iniciativa
 *   Tabela  Mapa de iniciativas, com atualizar status
 */

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export default function DashboardIdeias() {
  const { user, modules } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setLinhas(await listarIdeias());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const r = useMemo(() => resumoIdeias(linhas), [linhas]);
  const maiorSetor = Math.max(1, ...r.porSetor.map((s) => s.total));
  const souAdmin = ehAdminProgramas(modules);

  const trocarSituacao = async (registro, nova) => {
    setSalvando(registro.id);
    setErro('');
    try {
      const atualizado = await atualizarSituacao(registro, nova, user.id);
      setLinhas((atual) => atual.map((l) => (l.id === registro.id ? atualizado : l)));
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando('');
    }
  };

  return (
    <div className="pg-page pg-page-full">
      <h1 className="pg-title"><LayoutDashboard size={24} /> Dashboard</h1>
      <p className="pg-sub">Campo de Ideias — o que a PHD está inventando.</p>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : r.total === 0 ? (
        <div className="pg-vazio">
          Nada registrado ainda.{' '}
          <Link className="pg-link" to="/programas/ideias">Registrar a primeira ideia</Link>.
        </div>
      ) : (
        <>
          {/* ---- card: Quantidade de iniciativas ---- */}
          <div className="pg-tiles">
            <div className="pg-card pg-tile is-destaque">
              <span className="pg-tile-rot">Quantidade de iniciativas</span>
              <strong className="pg-tile-num">{r.total}</strong>
              <span className="pg-tile-pe">{r.iniciativas} iniciativa(s) · {r.ideias} ideia(s)</span>
            </div>
          </div>

          {/* ---- gráfico: Quantidade de iniciativas por setor ---- */}
          <div className="pg-card">
            <h2 className="pg-card-tit">Quantidade de iniciativas por setor</h2>
            {/* Oculto para leitor de tela: o mapa no fim da página tem os mesmos
                dados em tabela, que lê melhor do que um gráfico narrado. */}
            <div
              className="pg-barras"
              role="img"
              aria-label={`Quantidade por setor. ${r.porSetor.map((s) => `${s.nome}: ${s.total}`).join('. ')}.`}
            >
              {r.porSetor.map((s) => (
                <div className="pg-barra-linha" key={s.nome} aria-hidden="true">
                  <span className="pg-barra-nome" title={s.nome}>{s.nome}</span>
                  <span className="pg-barra-trilho">
                    <span
                      className="pg-barra"
                      style={{ width: `${(s.total / maiorSetor) * 100}%`, background: corDoSetor(s.nome) }}
                    />
                  </span>
                  <span className="pg-barra-valor">{s.total}</span>
                </div>
              ))}
            </div>
            {/* A ideia não pede setor no formulário; dizer isso evita que a
                faixa "Sem setor" pareça cadastro mal preenchido. */}
            <p className="pg-campo-dica">
              Ideias entram como “Sem setor” — o setor só é perguntado na iniciativa.
            </p>
          </div>

          {/* ---- Kanban por tipo, com as duas legendas ---- */}
          <div className="pg-card">
            <h2 className="pg-card-tit">Kanban por tipo</h2>

            <div className="pg-legendas">
              <div className="pg-legenda">
                <span className="pg-legenda-tit">Setor</span>
                {r.porSetor.map((s) => (
                  <span key={s.nome}>
                    <i style={{ background: corDoSetor(s.nome) }} /> {s.nome}
                  </span>
                ))}
              </div>
              <div className="pg-legenda">
                <span className="pg-legenda-tit">Borda</span>
                <span><i className="borda" style={{ borderColor: COR_FORMA.iniciativa }} /> Iniciativa</span>
                <span><i className="borda" style={{ borderColor: COR_FORMA.ideia }} /> Ideia</span>
              </div>
            </div>

            <div className="pg-quadro">
              {r.porCategoria.map((col) => (
                <section key={col.valor} className="pg-col">
                  <div className="pg-col-cab">
                    <h2>{col.label}</h2>
                    <span className="pg-col-cont">{col.cards.length}</span>
                  </div>
                  <div className="pg-col-corpo">
                    {col.cards.length === 0 ? (
                      <p className="pg-col-vazia">Nada aqui ainda</p>
                    ) : col.cards.map((c) => (
                      <article
                        key={c.id}
                        className="pg-cartao"
                        style={{
                          // Card colorido = setor; borda colorida = ideia ou
                          // iniciativa. É a leitura literal das duas legendas da
                          // planilha. A cor nunca decide sozinha: os dois dados
                          // vêm escritos no próprio cartão.
                          background: `color-mix(in srgb, ${corDoSetor(c.setor)} 14%, #fff)`,
                          borderColor: COR_FORMA[c.tipo],
                        }}
                      >
                        <div className="pg-cartao-topo">
                          <span
                            className="pg-cartao-forma"
                            style={{ color: COR_FORMA[c.tipo], borderColor: COR_FORMA[c.tipo] }}
                          >
                            {c.tipo === 'ideia' ? 'Ideia' : 'Iniciativa'}
                          </span>
                          <span className={`pg-badge tom-${c.situacao}`}>{SITUACAO_LABEL[c.situacao]}</span>
                        </div>
                        <span className="pg-cartao-tit">{c.titulo}</span>
                        <div className="pg-cartao-pe">
                          <span className="pg-cartao-setor">
                            <i style={{ background: corDoSetor(c.setor) }} />
                            {c.setor || 'Sem setor'}
                          </span>
                          <span>· {c.autorNome || 'Autor não identificado'}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {/* ---- Tabela: Mapa de iniciativas, com atualizar status ---- */}
          <div className="pg-card">
            <h2 className="pg-card-tit">Mapa de iniciativas</h2>
            <p className="pg-campo-dica">
              {souAdmin
                ? 'Você administra o módulo: pode atualizar a situação de qualquer registro.'
                : 'Você pode atualizar a situação dos registros que você mesmo criou.'}
            </p>

            <div className="pg-tabela-scroll">
              <table className="pg-tabela">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Título</th>
                    <th>Forma</th>
                    <th>Setor</th>
                    <th>Tipo</th>
                    <th>Autor</th>
                    <th>Registro</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const podeEditar = souAdmin || l.autor_id === user?.id;
                    return (
                      <tr key={l.id}>
                        <td className="num">#{l.numero}</td>
                        <td>
                          {l.titulo}
                          {l.link && (
                            <>
                              {' '}
                              <a className="pg-link" href={l.link} target="_blank" rel="noreferrer" title="Abrir arquivo/pasta">
                                <ExternalLink size={13} />
                              </a>
                            </>
                          )}
                        </td>
                        <td>{l.tipo === 'ideia' ? 'Ideia' : 'Iniciativa'}</td>
                        <td>{l.setor || '—'}</td>
                        <td>{CATEGORIA_LABEL[l.categoria] || l.categoria}</td>
                        <td>{l.autorNome || '—'}</td>
                        <td className="num">{data(l.criado_em)}</td>
                        <td>
                          {podeEditar ? (
                            <select
                              className="pg-select"
                              value={l.situacao}
                              disabled={salvando === l.id}
                              onChange={(e) => trocarSituacao(l, e.target.value)}
                              aria-label={`Situação de ${l.titulo}`}
                            >
                              {SITUACOES.map((s) => (
                                <option key={s.valor} value={s.valor}>{s.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`pg-badge tom-${l.situacao}`}>{SITUACAO_LABEL[l.situacao]}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
