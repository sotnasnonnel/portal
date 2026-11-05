import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, BedDouble, Building2, Calendar, Home, MapPin, Pencil, Receipt, Sofa,
} from 'lucide-react';
import { useBase } from '../../lib/useBase';
import {
  byId, contratoInfo, custoFixo, doAloj, fdate, missing, money, num, pagoAno, plural, staysOn, temCustoFixo, invest, todayISO, vagas,
} from '../../lib/regras';
import { useAcoes } from '../components/useAcoes';
import Dialogos from '../components/Dialogos';
import {
  Barra, Carga, Kpi, Nil, Pill, PillStatus, Vazio,
} from '../components/Ui';
import AbaGeral from './AbaGeral';
import AbaOcupacao from './AbaOcupacao';
import AbaPagamentos from './AbaPagamentos';
import { AbaMobiliario, AbaOcorrencias } from './AbaRegistros';

function Ficha({
  a, base, acoes, ano, setAno,
}) {
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') || 'geral';
  const v = vagas(a);
  const on = staysOn(base, a.id);
  const ci = contratoInfo(a);
  const m = a.status === 'ativo' ? missing(a) : [];
  const nItens = doAloj(base.itens, a.id).length;
  const nOcorrencias = doAloj(base.ocorrencias, a.id).length;

  const abas = [
    ['geral', 'Visão geral', 0],
    ['ocupacao', 'Ocupação', on.length],
    ['pagamentos', 'Pagamentos', 0],
    ['mobiliario', 'Mobiliário', nItens],
    ['ocorrencias', 'Ocorrências', nOcorrencias],
  ];
  const metas = [
    a.cnpj_locacao && ['Locatário', a.cnpj_locacao],
    a.centro_custo && ['CC', a.centro_custo],
    a.gerente && ['Gerente', a.gerente],
    a.projeto && ['Projeto', a.projeto],
  ].filter(Boolean);
  const endereco = [
    a.endereco,
    [a.cidade, a.uf].filter(Boolean).join('/'),
    a.cep && `CEP ${a.cep}`,
    a.pais && a.pais !== 'Brasil' ? a.pais : '',
  ].filter(Boolean).join(' · ') || 'Endereço não cadastrado';
  const Icon = a.tipo === 'Casa' ? Home : a.tipo === 'Hotel' ? BedDouble : Building2;
  const tomTile = a.status === 'inativo' ? 'cinza' : a.status === 'desmobilizacao' ? 'laranja' : '';

  const dataFim = ci.alvo || a.devolucao_data;
  let subFim = '';
  if (a.status === 'inativo') subFim = a.devolucao_obs || '';
  else if (ci.d !== undefined && ci.d !== null) {
    subFim = ci.d < 0 ? <span className="ruim">vencido há {-ci.d} dias</span> : `faltam ${ci.d} dias`;
  }
  const lancadosAno = base.pagamentos.filter((p) => p.alojamento_id === a.id && String(p.competencia).startsWith(String(ano)));
  const semValorAno = lancadosAno.filter((p) => num(p.valor) === null).length;

  return (
    <>
      <section className="aloj-card aloj-ficha">
        <div className="aloj-ficha-id">
          <span className={`aloj-tile ${tomTile}`}><Icon size={22} /></span>
          <div>
            <div className="aloj-ficha-tit">
              <h1>{a.nome}</h1>
              {a.sigla && <span className="aloj-tag">{a.sigla}</span>}
              <PillStatus a={a} />
              {m.length > 0 && <Pill c="warn" semPonto title={`Falta: ${m.join(', ')}`}>Cadastro incompleto</Pill>}
            </div>
            <p className="aloj-ficha-end"><MapPin size={14} /><span>{endereco}</span></p>
            {(metas.length > 0 || a.tipo) && (
              <div className="aloj-metas">
                {metas.map(([rotulo, valor]) => <span key={rotulo} className="aloj-chip">{rotulo} <b>{valor}</b></span>)}
                {a.tipo && <span className="aloj-chip">{a.tipo}</span>}
              </div>
            )}
          </div>
        </div>
        <div className="aloj-acoes">
          <button type="button" className="aloj-btn" onClick={() => acoes.editarAlojamento(a)}><Pencil size={14} /> Editar cadastro</button>
        </div>
      </section>

      <div className="aloj-kpis">
        <Kpi
          rotulo="Aluguel"
          Icon={Home}
          valor={num(a.aluguel_valor) !== null ? money(a.aluguel_valor) : <Nil />}
          sub={a.aluguel_vencimento ? `vence dia ${a.aluguel_vencimento}` : ''}
        />
        <Kpi
          rotulo="Custo fixo / mês"
          Icon={Receipt}
          valor={temCustoFixo(a) ? money(custoFixo(a)) : <Nil />}
          sub="aluguel + cond. + IPTU"
        />
        <Kpi
          rotulo="Ocupação"
          Icon={BedDouble}
          valor={v ? <>{Math.min(on.length, v)}<small> / {v}</small></> : (on.length || <Nil />)}
          sub={v ? `${Math.round((Math.min(on.length, v) / v) * 100)}% das vagas` : 'quartos não configurados'}
        >
          {v > 0 && <Barra pct={(on.length / v) * 100} tom="teal" />}
        </Kpi>
        <Kpi
          rotulo={a.status === 'inativo' ? 'Encerramento' : a.status === 'desmobilizacao' ? 'Entrega prevista' : 'Fim do contrato'}
          Icon={Calendar}
          valor={dataFim ? fdate(dataFim) : <Nil />}
          sub={subFim}
        />
        <Kpi
          rotulo="Mobiliário"
          Icon={Sofa}
          valor={money(invest(base, a.id)) || 'R$ 0,00'}
          sub={plural(nItens, 'item', 'itens')}
        />
        <Kpi
          rotulo={`Lançado em ${ano}`}
          Icon={Calendar}
          valor={money(pagoAno(base, a.id, ano)) || 'R$ 0,00'}
          sub={`${plural(lancadosAno.length, 'lançamento')}${semValorAno ? ` · ${semValorAno} sem valor` : ''}`}
        />
      </div>

      <div className="aloj-abas" role="tablist">
        {abas.map(([k, rotulo, n]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={aba === k}
            onClick={() => setParams(k === 'geral' ? {} : { aba: k }, { replace: true })}
          >
            {rotulo}{n > 0 && <span className="ct">{n}</span>}
          </button>
        ))}
      </div>

      {aba === 'geral' && <AbaGeral a={a} acoes={acoes} />}
      {aba === 'ocupacao' && <AbaOcupacao a={a} base={base} acoes={acoes} />}
      {aba === 'pagamentos' && <AbaPagamentos a={a} base={base} acoes={acoes} ano={ano} setAno={setAno} />}
      {aba === 'mobiliario' && <AbaMobiliario a={a} base={base} acoes={acoes} />}
      {aba === 'ocorrencias' && <AbaOcorrencias a={a} base={base} acoes={acoes} />}
    </>
  );
}

export default function DetalheAlojamento() {
  const { id } = useParams();
  const { base, carregando, erro, recarregar } = useBase();
  const acoes = useAcoes({ base, recarregar });
  // O ano do quadro mora aqui porque o indicador "Lançado em" acima das abas
  // acompanha o mesmo seletor.
  const [ano, setAno] = useState(() => +todayISO().slice(0, 4));
  const a = byId(base, id);

  return (
    <div className="aloj-page larga">
      <Link className="aloj-voltar" to="/alojamentos/lista"><ArrowLeft size={14} /> Alojamentos</Link>
      <Carga carregando={carregando} erro={erro}>
        {a
          ? <Ficha a={a} base={base} acoes={acoes} ano={ano} setAno={setAno} />
          : (
            <div className="aloj-card">
              <Vazio titulo="Alojamento não encontrado" texto="Ele pode ter sido excluído. Volte para a lista." />
            </div>
          )}
      </Carga>
      <Dialogos acoes={acoes} />
    </div>
  );
}
