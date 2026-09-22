import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, ClipboardList, AlertTriangle, UserX, Plus, Search, Wand2 } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Cabecalho, StatCard, Badge, Vazio, Modal, Aviso, Carregando } from '../components/ui';
import { salvarFornecedor, auditar } from '../../lib/dados';
import { statusFornecedor, RM_PADRAO } from '../../lib/totvs';
import { normalizar, digitos, mascararCnpj } from '../../lib/formato';
import EditorFornecedor from './EditorFornecedor';
import TableScroll from '../../../../components/UI/TableScroll';
import './fornecedores.css';

const FILTROS = [
  ['todos', 'Todos'],
  ['PRONTO', 'Pronto'],
  ['CADASTRO RM', 'Cadastro RM'],
  ['PENDENTE', 'Pendente'],
];

const RAIZ = '/admin/fechamento-pj';

// Nome da filial no banco do fornecedor: o RM usa a razão social do tomador,
// que é sempre a PHD Assessoria (filial 1) — a Engenharia não tem filial própria.
const FILIAL_NOME = 'PHD ASSESSORIA EM GESTAO LTDA';

/**
 * Cadastro Cliente/Fornecedor do TOTVS RM. É daqui que sai o código RM que o
 * TXT de pagamento exige. Um fornecedor se liga ao prestador pelo vínculo
 * explícito (prestador_id) ou, na falta dele, pelo CNPJ.
 */
export default function PaginaFornecedores() {
  const { fornecedores = [], prestadores = [], config, recarregar, notificar, carregando } = useFechamentoPj();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [editando, setEditando] = useState(null); // {} = novo; objeto = existente
  const [criarLote, setCriarLote] = useState(false);
  const [gravandoLote, setGravandoLote] = useState(false);

  const prestadorPorId = useMemo(() => new Map(prestadores.map((p) => [p.id, p])), [prestadores]);

  const linhas = useMemo(() => fornecedores.map((f) => ({
    ...f,
    status: statusFornecedor(f),
    prestador: f.prestador_id ? prestadorPorId.get(f.prestador_id) : null,
    bancosAtivos: (f.bancos || []).filter((b) => b.ativo !== false).length,
  })), [fornecedores, prestadorPorId]);

  // Prestador ativo sem fornecedor: nem vínculo direto nem CNPJ igual.
  const semFornecedor = useMemo(() => {
    const vinculados = new Set(fornecedores.map((f) => f.prestador_id).filter(Boolean));
    const cnpjs = new Set(fornecedores.map((f) => digitos(f.cnpj)).filter(Boolean));
    const ativos = prestadores.filter((p) => p.situacao === 'ativo' && !vinculados.has(p.id));
    return {
      criar: ativos.filter((p) => !digitos(p.cnpj) || !cnpjs.has(digitos(p.cnpj))),
      porCnpj: ativos.filter((p) => digitos(p.cnpj) && cnpjs.has(digitos(p.cnpj))),
    };
  }, [fornecedores, prestadores]);

  const stats = useMemo(() => ({
    total: linhas.length,
    pronto: linhas.filter((l) => l.status === 'PRONTO').length,
    cadastro: linhas.filter((l) => l.status === 'CADASTRO RM').length,
    pendente: linhas.filter((l) => l.status === 'PENDENTE').length,
  }), [linhas]);

  const filtradas = useMemo(() => {
    const q = normalizar(busca);
    const qDig = digitos(busca);
    return linhas
      .filter((l) => filtro === 'todos' || l.status === filtro)
      .filter((l) => {
        if (!q) return true;
        const texto = normalizar([l.codigo_rm, l.razao_social, l.nome_fantasia, l.cnpj, l.prestador?.nome].join(' '));
        return texto.includes(q) || (qDig.length >= 3 && digitos(l.cnpj).includes(qDig));
      })
      .sort((a, b) => normalizar(a.razao_social || a.nome_fantasia).localeCompare(normalizar(b.razao_social || b.nome_fantasia)));
  }, [linhas, busca, filtro]);

  async function criarAPartirDosPrestadores() {
    const rm = { ...RM_PADRAO, ...(config?.rm || {}) };
    setGravandoLote(true);
    let criados = 0;
    const falhas = [];
    try {
      // Um por vez: um CNPJ ou vínculo repetido não derruba o lote inteiro.
      for (const p of semFornecedor.criar) {
        const cnpj = digitos(p.cnpj) ? mascararCnpj(p.cnpj) : '';
        const razao = p.razao_social || p.nome;
        try {
          await salvarFornecedor({
            prestador_id: p.id,
            razao_social: razao,
            nome_fantasia: razao,
            cnpj: cnpj || null,
            classificacao: 'Fornecedor',
            categoria: 'Pessoa Jurídica',
            contatos: { email: p.email || '' },
            endereco: {},
            bancos: cnpj ? [{
              ref: 1, descricao: 'PIX CNPJ', ativo: true, filial: rm.filial,
              filialNome: FILIAL_NOME,
              formaPagamento: 'PIX Transferência', favorecido: razao, favorecidoDoc: cnpj, pixTipo: 'CNPJ', pixChave: cnpj,
            }] : [],
            origem: 'Criado a partir do prestador',
          });
          criados += 1;
        } catch (e) {
          falhas.push(`${p.nome}: ${e.message}`);
        }
      }
      if (criados) await auditar('Fornecedores TOTVS criados', `${criados} cadastro(s) criados a partir dos prestadores ativos`);
      await recarregar();
      if (falhas.length) {
        notificar(`${criados} criado(s), ${falhas.length} com erro. ${falhas[0]}`, 'alerta');
      } else {
        notificar(`${criados} cadastro(s) de fornecedor criados. Falta o código RM de cada um.`);
      }
      setCriarLote(false);
    } finally {
      setGravandoLote(false);
    }
  }

  if (carregando) return <Carregando />;

  return (
    <>
      <Cabecalho titulo="Fornecedores TOTVS"
        subtitulo="Cadastro Cliente/Fornecedor do TOTVS RM. Sem código RM, o prestador não entra no TXT de pagamento.">
        <button type="button" className="btn btn-outline" onClick={() => setCriarLote(true)} disabled={!semFornecedor.criar.length}>
          <Wand2 size={18} /> Criar a partir dos prestadores
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setEditando({})}>
          <Plus size={18} /> Novo cadastro
        </button>
      </Cabecalho>

      <div className="pj-kpis">
        <StatCard tom="secondary" icone={<Building2 size={22} />} valor={stats.total} rotulo="Cadastros"
          ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} />
        <StatCard tom="success" icone={<CheckCircle2 size={22} />} valor={stats.pronto} rotulo="Prontos"
          ativo={filtro === 'PRONTO'} onClick={() => setFiltro('PRONTO')} />
        <StatCard tom="warning" icone={<ClipboardList size={22} />} valor={stats.cadastro} rotulo="Cadastro RM (sem banco)"
          ativo={filtro === 'CADASTRO RM'} onClick={() => setFiltro('CADASTRO RM')} />
        <StatCard tom="danger" icone={<AlertTriangle size={22} />} valor={stats.pendente} rotulo="Pendentes"
          ativo={filtro === 'PENDENTE'} onClick={() => setFiltro('PENDENTE')} />
        <StatCard tom="accent" icone={<UserX size={22} />} valor={semFornecedor.criar.length + semFornecedor.porCnpj.length}
          rotulo="Prestadores ativos sem fornecedor" />
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Cadastros ({filtradas.length}/{linhas.length})</div>
          <div className="pj-toolbar">
            <div className="table-search">
              <Search size={16} />
              <input type="text" placeholder="Código RM, razão social, CNPJ, prestador…" value={busca}
                onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="filter-chips pj-forn-chips">
          {FILTROS.map(([v, rotulo]) => (
            <button key={v} type="button" className={`filter-chip ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>
              {rotulo}
            </button>
          ))}
        </div>
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr>
                <th>Código RM</th>
                <th>Razão social / nome fantasia</th>
                <th>CNPJ</th>
                <th>Prestador vinculado</th>
                <th className="pj-centro">Bancos ativos</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => (
                <tr key={f.id} className="pj-forn-linha" onClick={() => setEditando(f)}>
                  <td className="pj-num">{f.codigo_rm || <span className="pj-forn-falta">sem código</span>}</td>
                  <td>
                    <strong>{f.razao_social || '—'}</strong>
                    {f.nome_fantasia && f.nome_fantasia !== f.razao_social && <div className="pj-sub">{f.nome_fantasia}</div>}
                  </td>
                  <td className="pj-num">{f.cnpj || '—'}</td>
                  <td>
                    {f.prestador ? (
                      <Link className="pj-link" to={`${RAIZ}/prestadores/${f.prestador.id}`} onClick={(e) => e.stopPropagation()}>
                        {f.prestador.nome}
                      </Link>
                    ) : <span className="pj-sub">Sem vínculo</span>}
                  </td>
                  <td className="pj-centro">{f.bancosAtivos}</td>
                  <td><Badge tipo="fornecedor" valor={f.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtradas.length && (
            <Vazio>{linhas.length ? 'Nenhum cadastro com esses filtros.' : 'Nenhum fornecedor cadastrado ainda.'}</Vazio>
          )}
        </TableScroll>
      </div>

      {editando && (
        <EditorFornecedor fornecedor={editando} onFechar={() => setEditando(null)} />
      )}

      {criarLote && (
        <Modal titulo="Criar fornecedores a partir dos prestadores" onFechar={() => setCriarLote(false)} bloqueado={gravandoLote}
          rodape={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setCriarLote(false)} disabled={gravandoLote}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={criarAPartirDosPrestadores}
                disabled={gravandoLote || !semFornecedor.criar.length}>
                {gravandoLote ? 'Criando…' : `Criar ${semFornecedor.criar.length} cadastro(s)`}
              </button>
            </>
          )}>
          <p className="pj-forn-texto">
            Cria um cadastro para cada prestador <strong>ativo</strong> que ainda não tem fornecedor, com razão social,
            CNPJ e e-mail do prestador e, quando houver CNPJ, uma conta <strong>PIX CNPJ</strong>.
          </p>
          <Aviso tipo="alerta">
            O código RM e o endereço da empresa (cartão CNPJ) não vêm do prestador: preencha cada cadastro depois.
            O endereço do prestador é o residencial e não serve aqui.
          </Aviso>
          {semFornecedor.porCnpj.length > 0 && (
            <Aviso tipo="info">
              {semFornecedor.porCnpj.length} prestador(es) já têm um cadastro com o mesmo CNPJ, sem vínculo. Esses não serão
              duplicados: abra o cadastro e escolha o prestador no vínculo.
            </Aviso>
          )}
          <ul className="pj-forn-lista">
            {semFornecedor.criar.slice(0, 12).map((p) => (
              <li key={p.id}>{p.nome} <span className="pj-sub">{p.cnpj ? mascararCnpj(p.cnpj) : 'sem CNPJ (sem conta PIX)'}</span></li>
            ))}
            {semFornecedor.criar.length > 12 && <li className="pj-sub">+ {semFornecedor.criar.length - 12} outro(s)</li>}
          </ul>
        </Modal>
      )}
    </>
  );
}
