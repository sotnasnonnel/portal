import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronRight, FileSignature, KeyRound, Laptop, Layers, Monitor, Package,
  Printer, Replace, Tablet, Users,
} from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useTi } from '../components/TiContext';
import {
  Busca, Chip, Esqueleto, Estado, Kpi, LinhaVazia, PageHead, Pill, Secao, Selecao,
} from '../components/Pecas';
import { fmtDate, linhaClicavel, money } from '../../lib/formato';
import {
  ROTA_TROCA_EQUIPAMENTO, emUso, emailChave, linkTrocaEquipamento, norm, pendenteTermo, resumoPorPessoa, uniq,
} from '../../lib/regras';
import './modelos.css';

const SEM_NINGUEM = 'Sem ninguém';
const SEM_RESPONSAVEL = 'Sem responsável';
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Ícone pelo tipo do equipamento (TIPOS em config/ti.js). */
function IconeTipo({ tipo }) {
  const p = { size: 18 };
  if (tipo === 'Notebook') return <Laptop {...p} />;
  if (tipo === 'Monitor') return <Monitor {...p} />;
  if (tipo === 'Impressora') return <Printer {...p} />;
  if (tipo === 'Tablet') return <Tablet {...p} />;
  if (tipo === 'Licença') return <KeyRound {...p} />;
  return <Package {...p} />;
}
const nomeEquip = (a) => (a.modelo || '').trim() || a.tipo || 'Equipamento';
const iniciais = (nome) => String(nome || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2)
  .map((p) => p[0].toUpperCase()).join('');
const porTipoModelo = (x, y) => (x.tipo || '').localeCompare(y.tipo || '', 'pt-BR')
  || nomeEquip(x).localeCompare(nomeEquip(y), 'pt-BR');

/** Data do aceite mais recente entre os equipamentos em uso (null se não houver). */
function ultimoAceite(ativos) {
  const datas = ativos.filter(emUso).map((a) => a.data_assinatura_termo).filter(Boolean).sort();
  return datas[datas.length - 1] || null;
}

/**
 * Resumo. Duas telas numa rota:
 *  - Time de TI ("Resumo por pessoa"): tabela de todos os ativos, uma linha por
 *    pessoa e modelo, com configuração e custo. O que está parado vai para o
 *    fim, em "Sem ninguém".
 *  - Gestor e usuário ("Resumo", tela inicial deles): o que está comigo, se
 *    falta aceitar o termo, como pedir troca e, para o gestor, a equipe.
 * Em qualquer perfil, quem tem termo pendente vê o atalho para /ti/termos.
 */
export default function ModelosTi() {
  const { podeEscrever } = useTi();
  return podeEscrever ? <VisaoTime /> : <VisaoConsulta />;
}

/* ============================ aviso do termo ============================ */

/**
 * Pendência do MEU termo. `mostrarOk`: quem só consulta também vê a
 * confirmação de que está tudo aceito; o time de TI só vê quando falta.
 */
function AvisoTermo({ meus, mostrarOk }) {
  const navigate = useNavigate();
  const { setFiltro } = useTi();
  const emUsoComigo = meus.filter(emUso);
  const pendentes = emUsoComigo.filter(pendenteTermo).length;
  const irParaTermo = () => {
    setFiltro('termos', { aba: 'meu' });
    navigate('/ti/termos');
  };

  if (pendentes) {
    return (
      <section className="ti-res-termo warn" aria-labelledby="ti-res-termo-t">
        <span className="ti-res-termo-ic" aria-hidden="true"><AlertTriangle size={20} /></span>
        <div className="ti-res-termo-tx">
          <h2 id="ti-res-termo-t">Falta aceitar o termo de responsabilidade</h2>
          <p>
            {pendentes === 1
              ? '1 equipamento com você ainda está sem termo aceito.'
              : `${pendentes} equipamentos com você ainda estão sem termo aceito.`}
            {' '}É rápido: leia o termo e aceite aqui mesmo no portal.
          </p>
        </div>
        <button type="button" className="ti-btn primary ti-res-termo-a" onClick={irParaTermo}>
          <FileSignature size={16} aria-hidden="true" /> Ler e aceitar o termo
        </button>
      </section>
    );
  }
  if (!mostrarOk || !emUsoComigo.length) return null;
  const em = ultimoAceite(emUsoComigo);
  return (
    <div className="ti-res-termo ok" role="status">
      <span className="ti-res-termo-ic" aria-hidden="true"><CheckCircle2 size={18} /></span>
      <p className="ti-res-termo-tx">
        <b>Termo de responsabilidade aceito</b>
        {em ? ` em ${fmtDate(em)}` : ''}. Nada pendente com você.
      </p>
      <button type="button" className="ti-link ti-res-termo-link" onClick={irParaTermo}>Ver o termo</button>
    </div>
  );
}

/* ============================ consulta (gestor e usuário) ============================ */

function PillEquip({ a }) {
  if (pendenteTermo(a)) return <Pill tone="warn">Termo pendente</Pill>;
  if (emUso(a)) return <Pill tone="ok">Termo aceito</Pill>;
  return <Pill>{a.situacao || 'Sem situação'}</Pill>;
}

/** Um equipamento: abre a ficha (que também tem "Pedir troca"). */
function ItemEquip({ a, comTroca = false }) {
  const { abrirAtivo } = useTi();
  const detalhe = [a.tipo, a.configuracao].filter(Boolean).join(' · ');
  return (
    <li className="ti-res-eq">
      <button type="button" className="ti-res-eq-main" onClick={() => abrirAtivo(a.id)}>
        <span className="ti-res-eq-ic" aria-hidden="true"><IconeTipo tipo={a.tipo} /></span>
        <span className="ti-res-eq-tx">
          <b>{nomeEquip(a)}</b>
          {detalhe && <span>{detalhe}</span>}
          {a.numero_serie && <span className="ti-res-serie">Série {a.numero_serie}</span>}
        </span>
        <span className="ti-res-eq-st"><PillEquip a={a} /></span>
        <ChevronRight size={16} className="ti-res-eq-seta" aria-hidden="true" />
      </button>
      {comTroca && (
        <Link to={linkTrocaEquipamento(a)} className="ti-btn ti-res-troca" aria-label={`Pedir troca de ${nomeEquip(a)}`}>
          <Replace size={15} aria-hidden="true" /> Pedir troca
        </Link>
      )}
    </li>
  );
}

function VisaoConsulta() {
  const navigate = useNavigate();
  const {
    dados, carregando, erro, meuEmail, nomeDe, setFiltro,
  } = useTi();
  const [q, setQ] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);

  const meus = useMemo(
    () => dados.ativos.filter((a) => emailChave(a.responsavel) === meuEmail).sort(porTipoModelo),
    [dados.ativos, meuEmail],
  );

  // Equipe: o que a RLS mostra além do meu, agrupado por pessoa.
  const equipe = useMemo(() => {
    const m = new Map();
    for (const a of dados.ativos) {
      const k = emailChave(a.responsavel);
      if (k === meuEmail) continue;
      if (!m.has(k)) m.set(k, { email: k, nome: k ? nomeDe(k) : SEM_RESPONSAVEL, ativos: [], pendentes: 0 });
      const p = m.get(k);
      p.ativos.push(a);
      if (pendenteTermo(a)) p.pendentes += 1;
    }
    return [...m.values()]
      .map((p) => ({ ...p, ativos: p.ativos.sort(porTipoModelo) }))
      .sort((x, y) => (!x.email - !y.email) || x.nome.localeCompare(y.nome, 'pt-BR'));
  }, [dados.ativos, meuEmail, nomeDe]);
  const pendentesEquipe = equipe.filter((p) => p.pendentes).length;
  const equipeVisivel = useMemo(() => equipe.filter((p) => (!soPendentes || p.pendentes)
    && (!q || norm(`${p.nome} ${p.email} ${p.ativos.map((a) => `${a.modelo} ${a.tipo} ${a.numero_serie}`).join(' ')}`).includes(norm(q)))), [equipe, soPendentes, q]);

  const verPendentesEquipe = () => {
    setFiltro('termos', { aba: 'equipe', status: 'pendente' });
    navigate('/ti/termos');
  };

  const temEquipe = equipe.length > 0;
  return (
    <div className="ti-page ti-stack ti-res">
      <PageHead
        Icon={Layers}
        titulo="Resumo"
        sub={temEquipe
          ? 'Os equipamentos da empresa que estão com você e com a sua equipe.'
          : 'Os equipamentos da empresa que estão com você.'}
      />
      <Estado />
      {carregando ? <Esqueleto linhas={4} /> : !erro && (
        <>
          <AvisoTermo meus={meus} mostrarOk />

          <Secao titulo="Com você" contagem={meus.length} className="ti-res-sec">
            {meus.length ? (
              <ul className="ti-res-lista">
                {meus.map((a) => <ItemEquip key={a.id} a={a} comTroca />)}
              </ul>
            ) : (
              <div className="ti-empty">
                <strong>Nenhum equipamento no seu nome</strong>
                Se algum equipamento da empresa está com você e não aparece aqui, fale com o time de TI.
              </div>
            )}
            <p className="ti-res-rodape">
              <Replace size={15} aria-hidden="true" />
              <span>
                Precisa trocar ou devolver um equipamento?{' '}
                <Link to={ROTA_TROCA_EQUIPAMENTO} className="ti-res-a">Abra um chamado no Atendimento</Link>.
                {meus.length > 0 && ' Toque no equipamento para ver todos os dados dele.'}
              </span>
            </p>
          </Secao>

          {temEquipe && (
            <Secao
              titulo="Sua equipe"
              contagem={plural(equipe.length, 'pessoa', 'pessoas')}
              className="ti-res-sec"
            >
              {pendentesEquipe > 0 && (
                <div className="ti-note warn ti-res-nota">
                  <Users size={16} aria-hidden="true" />
                  <span>
                    {pendentesEquipe === 1
                      ? '1 pessoa da equipe ainda não aceitou o termo.'
                      : `${pendentesEquipe} pessoas da equipe ainda não aceitaram o termo.`}
                    {' '}
                    <button type="button" className="ti-link" onClick={verPendentesEquipe}>Ver quem falta</button>
                  </span>
                </div>
              )}
              {(equipe.length > 6 || pendentesEquipe > 0) && (
                <div className="ti-res-filtros">
                  {equipe.length > 6 && (
                    <Busca id="ti-res-q" valor={q} onChange={setQ} placeholder="Nome, modelo ou série" />
                  )}
                  {pendentesEquipe > 0 && (
                    <div className="ti-chips">
                      <Chip ativo={!soPendentes} onClick={() => setSoPendentes(false)} contagem={equipe.length}>Todos</Chip>
                      <Chip ativo={soPendentes} onClick={() => setSoPendentes(true)} contagem={pendentesEquipe}>Termo pendente</Chip>
                    </div>
                  )}
                </div>
              )}
              {equipeVisivel.length ? (
                <ul className="ti-res-pessoas">
                  {equipeVisivel.map((p) => (
                    <li key={p.email || SEM_RESPONSAVEL}>
                      <details className="ti-res-pessoa">
                        <summary>
                          <span className="ti-avatar" aria-hidden="true">{iniciais(p.nome)}</span>
                          <span className="ti-res-pessoa-tx">
                            <b>{p.nome}</b>
                            <span>
                              {plural(p.ativos.length, 'equipamento', 'equipamentos')}
                              {' · '}
                              {uniq(p.ativos.map(nomeEquip)).join(', ')}
                            </span>
                          </span>
                          {p.pendentes > 0 && <Pill tone="warn">Termo pendente</Pill>}
                          <ChevronRight size={16} className="ti-res-pessoa-seta" aria-hidden="true" />
                        </summary>
                        <ul className="ti-res-lista ti-res-lista-in">
                          {p.ativos.map((a) => <ItemEquip key={a.id} a={a} />)}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="ti-empty">
                  <strong>Ninguém encontrado</strong>
                  Ajuste a busca ou o filtro.
                </div>
              )}
            </Secao>
          )}
        </>
      )}
    </div>
  );
}

/* ============================ time de TI ============================ */

function VisaoTime() {
  const navigate = useNavigate();
  const {
    dados, carregando, filtros, setFiltro, nomeDe, meuEmail,
  } = useTi();
  const f = filtros.modelos;
  const busca = f.q || '';
  const set = (patch) => setFiltro('modelos', patch);
  const temFiltro = !!(f.fornecedor || f.tipo || busca);

  const meus = useMemo(() => dados.ativos.filter((a) => emailChave(a.responsavel) === meuEmail), [dados.ativos, meuEmail]);
  const filtrados = useMemo(() => dados.ativos.filter((a) => (!f.fornecedor || a.fornecedor === f.fornecedor)
    && (!f.tipo || a.tipo === f.tipo)), [dados.ativos, f.fornecedor, f.tipo]);
  const pendentesPorEmail = useMemo(() => {
    const s = new Set();
    for (const a of filtrados) if (pendenteTermo(a)) s.add(emailChave(a.responsavel));
    return s;
  }, [filtrados]);

  // Linhas agrupadas por pessoa: o nome aparece uma vez (rowSpan) e o grupo
  // ganha um traço acima, para a tabela ler como uma lista de pessoas.
  const grupos = useMemo(() => {
    const nq = norm(busca);
    const linhas = resumoPorPessoa(filtrados)
      .map((l) => ({ ...l, nome: l.email ? nomeDe(l.email) : SEM_NINGUEM }))
      .filter((l) => !nq || norm(`${l.nome} ${l.email || ''} ${l.modelo} ${l.configuracao}`).includes(nq))
      .sort((x, y) => (!x.email - !y.email)
        || x.nome.localeCompare(y.nome, 'pt-BR')
        || y.quantidade - x.quantidade
        || x.modelo.localeCompare(y.modelo, 'pt-BR'));
    const m = new Map();
    for (const l of linhas) {
      const k = l.email || '';
      if (!m.has(k)) m.set(k, { email: l.email, nome: l.nome, linhas: [], quantidade: 0 });
      const g = m.get(k);
      g.linhas.push(l);
      g.quantidade += l.quantidade;
    }
    return [...m.values()];
  }, [filtrados, nomeDe, busca]);

  const linhas = useMemo(() => grupos.flatMap((g) => g.linhas), [grupos]);
  const quantidade = useMemo(() => linhas.reduce((t, l) => t + l.quantidade, 0), [linhas]);
  const pessoas = grupos.filter((g) => g.email).length;
  // Soma das linhas: já vem arredondada por linha, então o total bate com a tabela.
  const mensalTotal = useMemo(() => Math.round(linhas.reduce((t, l) => t + l.mensal, 0) * 100) / 100, [linhas]);
  const semNinguem = grupos.find((g) => !g.email)?.quantidade || 0;
  const pessoasPendentes = grupos.filter((g) => g.email && pendentesPorEmail.has(g.email)).length;

  // Abre "Ver ativos" buscando pela pessoa (ou pelo modelo, no que está parado).
  const verLinha = (l) => {
    const q = l.email || (l.modelo === 'Modelo não informado' ? '' : l.modelo);
    setFiltro('ativos', {
      q, fornecedor: f.fornecedor, tipo: f.tipo, situacao: '', termo: '',
    });
    navigate('/ti/ativos');
  };
  const verPendentes = () => {
    setFiltro('termos', { aba: 'equipe', status: 'pendente' });
    navigate('/ti/termos');
  };

  return (
    <div className="ti-page ti-stack ti-res">
      <PageHead Icon={Layers} titulo="Resumo por pessoa" sub="Com quem está cada equipamento: uma linha por pessoa e modelo, com a configuração e o custo mensal. Clique numa linha para abrir os ativos." />
      <Estado />
      {!carregando && <AvisoTermo meus={meus} mostrarOk={false} />}
      <div className="ti-card">
        <div className="ti-filters">
          <Busca id="tm-q" valor={busca} onChange={(q) => set({ q })} placeholder="Pessoa, e-mail ou modelo" />
          <Selecao id="tm-forn" label="Fornecedor" opcoes={uniq(dados.ativos.map((a) => a.fornecedor))} valor={f.fornecedor} onChange={(fornecedor) => set({ fornecedor })} todos="Todos os fornecedores" />
          <Selecao id="tm-tipo" label="Tipo" opcoes={uniq(dados.ativos.map((a) => a.tipo))} valor={f.tipo} onChange={(tipo) => set({ tipo })} todos="Todos os tipos" />
        </div>
      </div>
      {carregando ? <Esqueleto /> : (
        <>
          <div className="ti-kpis">
            <Kpi label="Equipamentos" valor={quantidade} sub={semNinguem ? `${semNinguem} sem ninguém` : 'Todos em uso'} destaque />
            <Kpi label="Valor mensal total" valor={money(mensalTotal)} sub="Soma da mensalidade dos equipamentos" />
            <Kpi label="Pessoas" valor={pessoas} sub="Com algum equipamento em uso" />
            <Kpi
              label="Termo pendente"
              valor={pessoasPendentes}
              tone={pessoasPendentes ? 'warn' : 'ok'}
              sub={pessoasPendentes ? `${plural(pessoasPendentes, 'pessoa', 'pessoas')} sem aceite · ver lista` : 'Todos aceitaram'}
              onClick={pessoasPendentes ? verPendentes : undefined}
            />
          </div>
          <TableScroll className="ti-tbl">
            <table className="ti-t ti-res-t">
              <caption className="ti-res-sr">Equipamentos por pessoa e modelo</caption>
              <thead>
                <tr>
                  <th scope="col">Pessoa</th><th scope="col">Modelo</th><th scope="col">Configuração</th><th scope="col">Tipo</th>
                  <th scope="col">Fornecedor</th><th scope="col" className="n">Qtd.</th><th scope="col" className="n">Mensal</th>
                </tr>
              </thead>
              {grupos.length ? grupos.map((g) => (
                <tbody key={g.email || ''} className={g.email ? 'ti-res-grp' : 'ti-res-grp parado'}>
                  {g.linhas.map((l, i) => (
                    <tr
                      key={l.modelo}
                      className="ti-click"
                      title={l.email ? `Ver os ativos de ${g.nome}` : `Ver os ativos do modelo ${l.modelo}`}
                      {...linhaClicavel(() => verLinha(l))}
                    >
                      {i === 0 && (
                        <th scope="rowgroup" rowSpan={g.linhas.length} className="ti-res-pes">
                          <span className={g.email ? 'nm' : 'nm ti-muted'}>{g.nome}</span>
                          {g.email && g.nome !== g.email && <span className="em">{g.email}</span>}
                          {g.email && pendentesPorEmail.has(g.email) && <Pill tone="warn">Termo pendente</Pill>}
                          {g.linhas.length > 1 && <span className="em">{plural(g.quantidade, 'equipamento', 'equipamentos')}</span>}
                        </th>
                      )}
                      <td>{l.modelo}</td>
                      <td className="wrap s">{l.configuracao || '—'}</td>
                      <td>{l.tipos.join(', ') || '—'}</td>
                      <td>{l.fornecedores.join(', ') || '—'}</td>
                      <td className="n">{l.quantidade}</td>
                      <td className="n">{money(l.mensal)}</td>
                    </tr>
                  ))}
                </tbody>
              )) : (
                <tbody>
                  <LinhaVazia
                    colunas={7}
                    titulo="Nenhum equipamento"
                    sub={temFiltro ? (
                      <span className="ti-res-vazio">
                        Nada com esses filtros.{' '}
                        <button type="button" className="ti-link" onClick={() => set({ q: '', fornecedor: '', tipo: '' })}>Limpar filtros</button>
                      </span>
                    ) : 'Ainda não há equipamentos cadastrados.'}
                  />
                </tbody>
              )}
              {linhas.length > 0 && (
                <tfoot>
                  <tr>
                    <td className="p" colSpan={5}>Total</td>
                    <td className="n p">{quantidade}</td>
                    <td className="n p">{money(mensalTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </TableScroll>
        </>
      )}
    </div>
  );
}
