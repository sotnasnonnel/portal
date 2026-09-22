import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Modal, Vazio } from '../components/ui';
import { planilhaFinanceira } from '../../lib/relatorios';
import { gravarXlsx } from '../../lib/arquivos';
import { fmtBRL, somar, normalizar, digitos, partesCompetencia } from '../../lib/formato';
import TableScroll from '../../../../components/UI/TableScroll';

const CABECALHO = ['Nome Completo', 'Valor Líquido para emissão da nota fiscal', 'Razão Social', 'CNPJ', 'Banco', 'Código banco',
  'Agência', 'Conta', 'PIX', 'Contabilidade'];

export default function PlanilhaFinanceira({ envelopes, prestadores, competencia, onExportado, onFechar }) {
  const linhas = useMemo(() => planilhaFinanceira({ envelopes, prestadores }), [envelopes, prestadores]);
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');

  const filtradas = useMemo(() => {
    const q = normalizar(busca);
    if (!q) return linhas;
    const qDig = digitos(busca);
    return linhas.filter((l) => normalizar([l.nome, l.razaoSocial, l.cnpj, l.banco].join(' ')).includes(q)
      || (qDig.length >= 3 && digitos(l.cnpj).includes(qDig)));
  }, [linhas, busca]);

  const resumo = useMemo(() => ({
    liquido: somar(linhas, 'liquido'),
    semBanco: linhas.filter((l) => l.semBanco).length,
  }), [linhas]);

  async function exportar() {
    const p = partesCompetencia(competencia);
    setExportando(true);
    setErro('');
    try {
      // Exporta a lista inteira: o Financeiro recebe todos, a busca é só da tela.
      await gravarXlsx([{
        nome: 'Planilha Financeiro',
        cabecalho: CABECALHO,
        linhas: linhas.map((l) => [l.nome, l.liquido, l.razaoSocial, l.cnpj, l.banco, l.bancoCodigo, l.agencia, l.conta, l.pix, l.contabilidade]),
        moeda: [1],
        larguras: [38, 22, 42, 20, 18, 12, 10, 16, 30, 16],
      }], `Planilha Financeiro ${p.mm}-${p.aaaa}.xlsx`);
      await onExportado?.();
    } catch (e) {
      setErro(e.message || 'Não foi possível gerar a planilha.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <Modal largura="xl" onFechar={onFechar} titulo="Planilha Financeira" bloqueado={exportando}
      rodape={(
        <>
          <button type="button" className="btn btn-outline" onClick={onFechar} disabled={exportando}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={exportar} disabled={exportando || !linhas.length}>
            <Download size={16} /> {exportando ? 'Gerando…' : 'Exportar Excel'}
          </button>
        </>
      )}>
      {erro && <div className="pj-aviso pj-aviso--erro">{erro}</div>}
      <div className="pj-rel-resumo">
        <div><small>Prestadores</small><b>{linhas.length}</b></div>
        <div><small>Valor líquido para NF</small><b>{fmtBRL(resumo.liquido)}</b></div>
        <div className={resumo.semBanco ? 'pj-rel-resumo--alerta' : ''}><small>Dados bancários pendentes</small><b>{resumo.semBanco}</b></div>
      </div>
      <div className="pj-toolbar pj-rel-busca">
        <div className="table-search">
          <Search size={16} />
          <input type="text" placeholder="Nome, razão social, CNPJ, banco…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <span className="pj-sub">{filtradas.length}/{linhas.length}</span>
      </div>
      <TableScroll>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th><th className="pj-direita">Líquido para NF</th><th>Razão social</th><th>CNPJ</th><th>Banco</th>
              <th>Código</th><th>Agência</th><th>Conta</th><th>PIX</th><th>Contabilidade</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => (
              <tr key={l.prestadorId}>
                <td><strong>{l.nome}</strong></td>
                <td className="pj-direita pj-num pj-num--forte">{fmtBRL(l.liquido)}</td>
                <td>{l.razaoSocial || '—'}</td>
                <td className="pj-num">{l.cnpj || '—'}</td>
                <td>{l.semBanco ? <span className="pj-rel-falta">Não informado</span> : l.banco}</td>
                <td>{l.bancoCodigo || '—'}</td>
                <td>{l.agencia || '—'}</td>
                <td>{l.conta || '—'}</td>
                <td>{l.pix || '—'}</td>
                <td>{l.contabilidade || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtradas.length && <Vazio>Nenhum prestador encontrado.</Vazio>}
      </TableScroll>
    </Modal>
  );
}
