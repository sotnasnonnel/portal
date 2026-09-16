import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus, Network, HeartPulse, Download, Search, Users, UserX, PieChart, Landmark, CreditCard, Stethoscope,
  AlertTriangle,
} from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Cabecalho, StatCard, Badge, Moeda, Carregando, Vazio } from '../components/ui';
import { dataBr, idade, mascararCpf, fmtNum } from '../../lib/formato';
import { gravarXlsx } from '../../lib/arquivos';
import { statusFornecedor } from '../../lib/totvs';
import {
  ROTA_PRESTADORES, rateiosDoPrestador, situacaoRateio, temDadosBancarios, temPlanoMedico, casaBusca, hojeIso,
} from './comum';
import ImportarOrganograma from './ImportarOrganograma';
import ConferenciaBradesco from './ConferenciaBradesco';
import './prestadores.css';

const CHIPS = [
  ['ativos', 'Ativos'],
  ['desligados', 'Desligados'],
  ['todos', 'Todos'],
  ['pendencias', 'Pendências'],
];

const ROTULO_FILTRO = {
  sem_rateio: 'ativos sem rateio 100%',
  sem_rm: 'ativos com CC sem código RM',
  sem_banco: 'ativos sem dados bancários',
  com_plano: 'com plano médico',
};

export default function Pagina() {
  const {
    carregando, prestadores = [], rateios = [], fornecedores = [], centrosMapa, notificar,
  } = useFechamentoPj();
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('ativos');
  const [modal, setModal] = useState(null);
  const [exportando, setExportando] = useState(false);

  // Uma passada só: tudo que a grade, os cards e os filtros precisam por prestador.
  const linhas = useMemo(() => {
    const fornPorPrestador = new Map(fornecedores.filter((f) => f.prestador_id).map((f) => [f.prestador_id, f]));
    return prestadores.map((p) => {
      const rateio = situacaoRateio(rateiosDoPrestador(rateios, p.id), centrosMapa);
      const ativo = p.situacao === 'ativo';
      const semBanco = !temDadosBancarios(p);
      return {
        p,
        ativo,
        rateio,
        idade: idade(p.data_nascimento),
        fornecedor: statusFornecedor(fornPorPrestador.get(p.id)),
        semRateio: ativo && !rateio.fecha100,
        semRm: ativo && rateio.semRm.length > 0,
        semBanco: ativo && semBanco,
        plano: temPlanoMedico(p),
      };
    });
  }, [prestadores, rateios, fornecedores, centrosMapa]);

  const stats = useMemo(() => ({
    ativos: linhas.filter((l) => l.ativo).length,
    desligados: linhas.filter((l) => !l.ativo).length,
    semRateio: linhas.filter((l) => l.semRateio).length,
    semRm: linhas.filter((l) => l.semRm).length,
    semBanco: linhas.filter((l) => l.semBanco).length,
    plano: linhas.filter((l) => l.plano).length,
  }), [linhas]);

  const visiveis = useMemo(() => linhas.filter((l) => {
    if (filtro === 'ativos' && !l.ativo) return false;
    if (filtro === 'desligados' && l.ativo) return false;
    if (filtro === 'pendencias' && !(l.semRateio || l.semRm || l.semBanco)) return false;
    if (filtro === 'sem_rateio' && !l.semRateio) return false;
    if (filtro === 'sem_rm' && !l.semRm) return false;
    if (filtro === 'sem_banco' && !l.semBanco) return false;
    if (filtro === 'com_plano' && !l.plano) return false;
    return casaBusca(l.p, busca);
  }), [linhas, filtro, busca]);

  const abrir = (id) => navigate(`${ROTA_PRESTADORES}/${id}`, { state: { ids: visiveis.map((l) => l.p.id) } });

  async function exportar() {
    setExportando(true);
    try {
      const cabecalho = ['Código', 'Nome', 'Empresa', 'CPF', 'CNPJ', 'Razão social', 'E-mail', 'Início', 'Valor mensal',
        'Função', 'Situação', 'Término', 'Idade', 'Seção', 'Rateio (%)', 'CC sem código RM', 'Dados bancários', 'Plano médico', 'Fornecedor RM'];
      const dados = visiveis.map((l) => [
        l.p.codigo, l.p.nome, l.p.empresa, l.p.cpf || '', l.p.cnpj || '', l.p.razao_social || '', l.p.email || '',
        l.p.data_inicio ? dataBr(l.p.data_inicio) : '', Number(l.p.valor_mensal) || 0, l.p.funcao || '',
        l.ativo ? 'Ativo' : 'Desligado', l.p.data_fim ? dataBr(l.p.data_fim) : '', l.idade ?? '',
        [l.p.secao_codigo, l.p.secao_nome].filter(Boolean).join(' - '), l.rateio.vazio ? '' : l.rateio.total,
        l.rateio.semRm.join(', '), temDadosBancarios(l.p) ? 'Sim' : 'Não', l.plano ? 'Sim' : 'Não', l.fornecedor,
      ]);
      await gravarXlsx([{ nome: 'Prestadores', cabecalho, linhas: dados, moeda: [8], larguras: [9, 36, 16, 16, 20, 36, 30, 12, 14, 30, 11, 12, 7, 30, 10, 20, 10, 10, 14] }],
        `Prestadores PJ ${dataBr(hojeIso()).replaceAll('/', '-')}.xlsx`);
    } catch (e) {
      notificar(e.message || 'Não foi possível exportar.', 'erro');
    } finally {
      setExportando(false);
    }
  }

  const trocarFiltroCard = (f) => setFiltro((atual) => (atual === f ? 'ativos' : f));

  return (
    <>
      <Cabecalho titulo="Prestadores" subtitulo="Cadastro dos prestadores PJ: contrato, pagamento, benefícios e rateio.">
        <button type="button" className="btn btn-outline" onClick={() => setModal('organograma')}>
          <Network size={18} /> Importar organograma
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setModal('bradesco')}>
          <HeartPulse size={18} /> Conferência Bradesco
        </button>
        <button type="button" className="btn btn-outline" onClick={exportar} disabled={exportando || !visiveis.length}>
          <Download size={18} /> {exportando ? 'Exportando…' : 'Exportar'}
        </button>
        <Link className="btn btn-primary" to={`${ROTA_PRESTADORES}/novo`}>
          <UserPlus size={18} /> Novo prestador
        </Link>
      </Cabecalho>

      <div className="pj-kpis pj-kpis--3">
        <StatCard tom="success" icone={<Users size={22} />} valor={stats.ativos} rotulo="Ativos"
          ativo={filtro === 'ativos'} onClick={() => setFiltro('ativos')} />
        <StatCard tom="secondary" icone={<UserX size={22} />} valor={stats.desligados} rotulo="Desligados"
          ativo={filtro === 'desligados'} onClick={() => setFiltro('desligados')} />
        <StatCard tom="warning" icone={<PieChart size={22} />} valor={stats.semRateio} rotulo="Sem rateio 100%"
          detalhe="ativos" ativo={filtro === 'sem_rateio'} onClick={() => trocarFiltroCard('sem_rateio')} />
        <StatCard tom="warning" icone={<Landmark size={22} />} valor={stats.semRm} rotulo="CC sem código RM"
          detalhe="ativos" ativo={filtro === 'sem_rm'} onClick={() => trocarFiltroCard('sem_rm')} />
        <StatCard tom="danger" icone={<CreditCard size={22} />} valor={stats.semBanco} rotulo="Sem dados bancários"
          detalhe="ativos" ativo={filtro === 'sem_banco'} onClick={() => trocarFiltroCard('sem_banco')} />
        <StatCard tom="primary" icone={<Stethoscope size={22} />} valor={stats.plano} rotulo="Com plano médico"
          ativo={filtro === 'com_plano'} onClick={() => trocarFiltroCard('com_plano')} />
      </div>

      <div className="table-container">
        <div className="pjp-filtros">
          <div className="filter-chips">
            {CHIPS.map(([v, l]) => (
              <button key={v} type="button" className={`filter-chip ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>
                {l}
              </button>
            ))}
            {ROTULO_FILTRO[filtro] && (
              <button type="button" className="filter-chip active" onClick={() => setFiltro('ativos')} title="Limpar filtro">
                {ROTULO_FILTRO[filtro]} ×
              </button>
            )}
          </div>
          <div className="table-search">
            <Search size={16} />
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Código, nome, e-mail, CPF, CNPJ, razão social, função, seção…" aria-label="Buscar prestador" />
          </div>
          <span className="pjp-registro">{visiveis.length}/{prestadores.length} prestadores</span>
        </div>

        {carregando ? <Carregando texto="Carregando prestadores…" /> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Início</th>
                  <th className="pj-direita">Valor mensal</th>
                  <th>Função</th>
                  <th>Situação</th>
                  <th>Término</th>
                  <th className="pj-centro">Idade</th>
                  <th>Seção</th>
                  <th className="pj-direita">Rateio</th>
                  <th>Fornecedor RM</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <tr key={l.p.id}>
                    <td className="pjp-nome-celula">
                      <button type="button" className="pj-link" onClick={() => abrir(l.p.id)}>{l.p.nome}</button>
                      <div className="pj-sub">Código {l.p.codigo} • {l.p.empresa}</div>
                    </td>
                    <td className="pjp-nowrap">{l.p.cpf ? mascararCpf(l.p.cpf) : '—'}</td>
                    <td className="pjp-nowrap">{dataBr(l.p.data_inicio)}</td>
                    <td className="pj-direita"><Moeda valor={l.p.valor_mensal} /></td>
                    <td>{l.p.funcao || '—'}</td>
                    <td><Badge tipo="situacao" valor={l.p.situacao} /></td>
                    <td className="pjp-nowrap">{dataBr(l.p.data_fim)}</td>
                    <td className="pj-centro">{l.idade ?? '—'}</td>
                    <td>
                      {l.p.secao_nome || '—'}
                      {l.p.secao_codigo && <div className="pj-sub">{l.p.secao_codigo}</div>}
                    </td>
                    <td className="pj-direita pjp-nowrap">
                      <CelulaRateio rateio={l.rateio} />
                    </td>
                    <td><Badge tipo="fornecedor" valor={l.fornecedor} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visiveis.length && (
              <Vazio>{prestadores.length ? 'Nenhum prestador com esses filtros.' : 'Nenhum prestador cadastrado ainda.'}</Vazio>
            )}
          </div>
        )}
      </div>

      {modal === 'organograma' && <ImportarOrganograma onFechar={() => setModal(null)} />}
      {modal === 'bradesco' && <ConferenciaBradesco onFechar={() => setModal(null)} />}
    </>
  );
}

function CelulaRateio({ rateio }) {
  if (rateio.vazio) {
    return <span className="pjp-muted" title="Sem rateio cadastrado">— <AlertTriangle size={14} className="pjp-alerta-icone" /></span>;
  }
  const avisos = [];
  if (!rateio.fecha100) avisos.push(`Soma ${fmtNum(rateio.total)} %`);
  if (rateio.semRm.length) avisos.push(`Sem código RM: ${rateio.semRm.join(', ')}`);
  return (
    <span className="pj-num" title={avisos.join(' • ') || undefined}>
      {fmtNum(rateio.total)} %
      {avisos.length > 0 && <AlertTriangle size={14} className="pjp-alerta-icone" />}
    </span>
  );
}
