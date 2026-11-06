import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BedDouble, Building2, Calendar, Check, CheckCircle2, Clock, KeyRound, Receipt, Search, Sofa, Users,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { nomeProprio } from '../../../../utils/pessoas';
import { nomeCurto } from '../../../../utils/formatters';
import { useBase } from '../../lib/useBase';
import {
  MES3, STATUS, alerts, alojs, byId, cap, compLabel, contratoInfo, curComp, custoFixo, fdate, fdm, initials, isOn, local, money,
  movimentos, norm, operando, pISO, plural, quartoNome, resumoCompetencia, staysOn, temCustoFixo, totalItem, vagas,
} from '../../lib/regras';
import { rotaDoAlerta, rotaFicha } from '../components/nav';
import { Barra, Carga, Kpi } from '../components/Ui';

function LinhaAlerta({ x, base }) {
  const a = x.aid ? byId(base, x.aid) : null;
  return (
    <Link className="aloj-alerta" to={rotaDoAlerta(x)}>
      <span className={`aloj-sev ${x.sev}`} />
      <span>
        <b>{x.title}</b>
        <small>{x.text}</small>
      </span>
      {a && <span className="onde">{a.nome}</span>}
    </Link>
  );
}

function Destaque({ base, lista }) {
  const top = lista.find((x) => x.aid && x.sev !== 'info') || lista.find((x) => x.aid);
  if (!top) {
    return (
      <div className="aloj-card aloj-destaque">
        <span className="aloj-destaque-ic"><CheckCircle2 size={22} /></span>
        <h3>Operação em dia</h3>
        <p>Nenhum alojamento precisa de decisão agora.</p>
        <Link className="aloj-btn primario" to="/alojamentos/lista"><Building2 size={14} /> Ver alojamentos</Link>
      </div>
    );
  }
  const a = byId(base, top.aid);
  const rotulo = top.tab === 'ocupacao' ? 'Chaves e moradores' : a.status === 'desmobilizacao' ? 'Desmobilização' : 'Contrato';
  const Icon = top.tab === 'ocupacao' ? KeyRound : Calendar;
  return (
    <div className="aloj-card aloj-destaque">
      <span className="aloj-destaque-ic"><Icon size={22} /></span>
      <h3>{a.nome}</h3>
      <span className="aloj-chip">{rotulo}</span>
      <p>{top.title}. {top.text}</p>
      <Link className="aloj-btn primario" to={rotaFicha(a.id, top.tab)}><ArrowRight size={14} /> Abrir alojamento</Link>
    </div>
  );
}

function ContratosAVencer({ base }) {
  const linhas = alojs(base, operando)
    .map((a) => ({ a, ci: contratoInfo(a) }))
    .filter((r) => r.ci.alvo)
    .sort((x, y) => x.ci.d - y.ci.d)
    .slice(0, 6);
  return (
    <div className="aloj-card">
      <div className="aloj-card-h"><h3><Calendar size={15} /> Contratos a vencer</h3></div>
      <div className="aloj-card-b">
        {linhas.length ? linhas.map(({ a, ci }) => {
          const ano = pISO(ci.alvo).getFullYear();
          return (
            <div key={a.id} className="aloj-linha">
              <span className="aloj-ini">{initials(a.nome)}</span>
              <span className="aloj-linha-tx">
                <b><Link to={rotaFicha(a.id)}>{a.nome}</Link></b>
                <small>{a.status === 'desmobilizacao' ? 'Entrega prevista' : a.contrato_renovacao_automatica ? 'Fim · prorrogação automática' : 'Fim do contrato'}</small>
              </span>
              <span className={`aloj-data ${ci.c}`}>
                {fdm(ci.alvo)}{ano !== new Date().getFullYear() ? `/${String(ano).slice(2)}` : ''}
              </span>
            </div>
          );
        }) : <p className="aloj-muted aloj-m0">Nenhum contrato com data de fim cadastrada.</p>}
      </div>
    </div>
  );
}

function Movimentacoes({ base }) {
  const ev = movimentos(base).slice(0, 6);
  return (
    <div className="aloj-card">
      <div className="aloj-card-h">
        <h3><Users size={15} /> Movimentações recentes</h3>
        <Link className="aloj-link" to="/alojamentos/ocupacao">Ver todas</Link>
      </div>
      <div className="aloj-card-b">
        {ev.length ? ev.map((m) => (
          <div key={`${m.e.id}-${m.t}`} className="aloj-linha">
            <span className={`aloj-ini${m.t === 'Saída' ? ' saida' : ''}`}>{initials(m.e.morador)}</span>
            <span className="aloj-linha-tx">
              <b>{m.e.morador}</b>
              <small>{m.t} · {m.a.nome}</small>
            </span>
            <span className="aloj-data">{fdm(m.d)}</span>
          </div>
        )) : <p className="aloj-muted aloj-m0">Sem entradas ou saídas registradas.</p>}
      </div>
    </div>
  );
}

function BuscaRapida({ base }) {
  const [texto, setTexto] = useState('');
  const q = norm(texto).trim();
  let resultado = null;
  if (q.length >= 2) {
    const al = base.alojamentos
      .filter((a) => norm([a.nome, a.sigla, a.cidade, a.uf, a.endereco, a.centro_custo, a.gerente].join(' ')).includes(q))
      .slice(0, 6);
    const mo = base.estadias
      .filter((e) => norm(e.morador).includes(q))
      .sort((x, y) => isOn(y) - isOn(x))
      .slice(0, 8);
    resultado = (
      <div className="aloj-busca-res">
        {!al.length && !mo.length && <p>Nada encontrado para “{texto}”.</p>}
        {al.map((a) => (
          <Link key={a.id} to={rotaFicha(a.id)}>
            <b>{a.nome}</b>
            <small>{local(a)} · {STATUS[a.status]?.l || ''}</small>
          </Link>
        ))}
        {mo.map((e) => {
          const a = byId(base, e.alojamento_id);
          return a && (
            <Link key={e.id} to={rotaFicha(a.id, 'ocupacao')}>
              <b>{e.morador}</b>
              <small>{a.nome} · {quartoNome(a, e)} · {isOn(e) ? 'morando' : `saiu em ${fdate(e.saida)}`}</small>
            </Link>
          );
        })}
      </div>
    );
  }
  return (
    <div className="aloj-busca">
      <label className="aloj-inline" htmlFor="aloj-qs">
        <Search size={15} />
        <input
          id="aloj-qs"
          autoComplete="off"
          placeholder="Buscar alojamento, morador ou endereço"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>
      {resultado}
    </div>
  );
}

function Conteudo({ base }) {
  const { user } = useAuth();
  const todos = base.alojamentos;
  const ops = todos.filter(operando);
  const ativos = todos.filter((a) => a.status === 'ativo').length;
  const desm = todos.filter((a) => a.status === 'desmobilizacao').length;
  const inat = todos.length - ops.length;
  const vt = ops.reduce((s, a) => s + vagas(a), 0);
  const oc = ops.reduce((s, a) => s + (vagas(a) ? Math.min(vagas(a), staysOn(base, a.id).length) : 0), 0);
  const moradores = ops.reduce((s, a) => s + staysOn(base, a.id).length, 0);
  const custo = ops.reduce((s, a) => s + custoFixo(a), 0);
  const semCusto = ops.filter((a) => !temCustoFixo(a));
  const comp = curComp();
  const mes = MES3[+comp.slice(5) - 1].toLowerCase();
  const { exp, lanc } = resumoCompetencia(base, comp);
  const inv = base.itens.reduce((s, i) => s + totalItem(i), 0);
  const invAloj = new Set(base.itens.map((i) => i.alojamento_id)).size;
  const lista = alerts(base);
  const att = lista.filter((x) => x.sev !== 'info').length;
  const hoje = cap(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()));
  const primeiro = nomeProprio(nomeCurto(user?.nome)).split(' ')[0];

  const custoLinhas = ops.filter(temCustoFixo).sort((a, b) => custoFixo(b) - custoFixo(a));
  const maxCusto = Math.max(1, ...custoLinhas.map(custoFixo));

  const modulos = [
    { to: 'lista', Icon: Building2, titulo: 'Alojamentos', desc: 'Cadastro, contratos, contatos e contas de consumo', chip: plural(todos.length, 'cadastro') },
    { to: 'ocupacao', Icon: BedDouble, titulo: 'Ocupação', desc: 'Quartos, moradores, entradas, saídas e status das chaves', chip: `${oc}/${vt} vagas` },
    { to: 'pagamentos', Icon: Receipt, titulo: 'Pagamentos', desc: 'Contas por competência, manutenção e faturas para conferência do Contas a Pagar', chip: `${lanc}/${exp} em ${mes}` },
    { to: 'mobiliario', Icon: Sofa, titulo: 'Mobiliário', desc: 'Itens comprados por alojamento e destino na devolução do imóvel', chip: money(inv) || 'R$ 0,00' },
  ];

  return (
    <>
      <section className="aloj-hero">
        <div>
          <h1>Olá{primeiro ? `, ${primeiro}` : ''}!</h1>
          <p>{hoje} · Gestão de Alojamentos</p>
        </div>
        <BuscaRapida base={base} />
      </section>

      <div className="aloj-home">
        <div>
          {att === 0 ? (
            <div className="aloj-card aloj-status ok">
              <span className="aloj-status-ic"><Check size={16} /></span>
              <p><b>Tudo em dia.</b> Nenhum contrato, chave ou desmobilização exigindo decisão agora.</p>
              <Link className="aloj-link" to="/alojamentos/pagamentos">Ver pagamentos</Link>
            </div>
          ) : (
            <div className="aloj-card aloj-status att">
              <span className="aloj-status-ic"><AlertTriangle size={16} /></span>
              <p><b>{plural(att, 'ponto de atenção', 'pontos de atenção')}.</b> Contratos, chaves ou desmobilizações aguardando a sua decisão.</p>
              <a className="aloj-link" href="#alertas">Ver alertas</a>
            </div>
          )}

          <h2 className="aloj-sec">Indicadores</h2>
          <div className="aloj-kpis">
            <Kpi
              rotulo="Alojamentos ativos"
              Icon={Building2}
              valor={ativos + desm}
              sub={`${desm ? `${desm} em desmobilização · ` : ''}${plural(inat, 'inativo')}`}
            />
            <Kpi
              rotulo="Ocupação"
              Icon={BedDouble}
              valor={<>{oc}<small> / {vt} vagas</small></>}
              sub={`${vt ? Math.round((oc / vt) * 100) : 0}% ocupado · ${plural(moradores, 'morador', 'moradores')}`}
            >
              <Barra pct={vt ? (oc / vt) * 100 : 0} tom="teal" />
            </Kpi>
            <Kpi
              rotulo="Custo fixo mensal"
              Icon={Receipt}
              valor={money(custo) || 'R$ 0,00'}
              sub={`aluguel + condomínio + IPTU${semCusto.length ? ` · ${semCusto.length} sem valor` : ''}`}
            />
            <Kpi
              rotulo={`Lançado em ${mes}`}
              Icon={Calendar}
              valor={<>{lanc}<small> / {exp} contas</small></>}
              sub={`competência ${compLabel(comp)}`}
            >
              <Barra pct={exp ? (lanc / exp) * 100 : 0} />
            </Kpi>
            <Kpi
              rotulo="Mobiliário"
              Icon={Sofa}
              valor={money(inv) || 'R$ 0,00'}
              sub={`${plural(base.itens.length, 'item', 'itens')} em ${plural(invAloj, 'alojamento')}`}
            />
          </div>

          <h2 className="aloj-sec" id="alertas">Alertas <small>{plural(lista.length, 'item', 'itens')}</small></h2>
          {lista.length ? (
            <div className="aloj-card">
              {lista.slice(0, 9).map((x) => <LinhaAlerta key={`${x.aid || x.go}-${x.title}`} x={x} base={base} />)}
              {lista.length > 9 && <div className="aloj-card-b aloj-muted">+ {lista.length - 9} alertas de menor prioridade</div>}
            </div>
          ) : (
            <div className="aloj-card aloj-card-b aloj-muted">Nenhum alerta por enquanto. Contratos, chaves e pagamentos estão em dia.</div>
          )}

          <h2 className="aloj-sec">Seus módulos</h2>
          <div className="aloj-mods">
            {modulos.map((m) => (
              <Link key={m.to} className="aloj-card aloj-mod" to={`/alojamentos/${m.to}`}>
                <div className="aloj-mod-top">
                  <span className="aloj-tile"><m.Icon size={20} /></span>
                  <span className="aloj-chip">{m.chip}</span>
                </div>
                <h3>{m.titulo}</h3>
                <p>{m.desc}</p>
                <span className="aloj-link">Acessar <ArrowRight size={14} /></span>
              </Link>
            ))}
          </div>

          {custoLinhas.length > 0 && (
            <>
              <h2 className="aloj-sec">Custo fixo mensal por alojamento</h2>
              <div className="aloj-card aloj-card-b">
                <div className="aloj-hbars">
                  {custoLinhas.map((a) => (
                    <div key={a.id} className="aloj-hbar">
                      <span className="lb" title={a.nome}>{a.nome}</span>
                      <div className="tr"><i style={{ width: `${((custoFixo(a) / maxCusto) * 100).toFixed(1)}%` }} /></div>
                      <span className="vl">{money(custoFixo(a))}</span>
                    </div>
                  ))}
                </div>
                {semCusto.length > 0 && (
                  <p className="aloj-muted aloj-pequeno aloj-mt">Sem valor cadastrado: {semCusto.map((a) => a.nome).join(', ')}.</p>
                )}
              </div>
            </>
          )}
        </div>

        <aside className="aloj-lado">
          <Destaque base={base} lista={lista} />
          <ContratosAVencer base={base} />
          <Movimentacoes base={base} />
        </aside>
      </div>
    </>
  );
}

export default function InicioAlojamentos() {
  const { base, carregando, erro } = useBase();
  return (
    <div className="aloj-page larga">
      <Carga carregando={carregando} erro={erro}>
        <Conteudo base={base} />
      </Carga>
    </div>
  );
}
