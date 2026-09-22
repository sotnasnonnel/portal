import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal, Campo, Aviso, Vazio } from '../components/ui';
import { salvarCodigo, excluirCodigo, auditar } from '../../lib/dados';
import TableScroll from '../../../../components/UI/TableScroll';

const NOVO = { codigo: '', descricao: '', natureza: 'desconto', ativo: true };

export default function AbaCodigos() {
  const { codigos = [], recarregar, notificar } = useFechamentoPj();
  const [editando, setEditando] = useState(null); // { ...codigo, novo }
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const planilha = codigos.filter((c) => /planilha|base de ativos/i.test(c.origem || '')).length;

  function abrir(c) {
    setErro('');
    setEditando(c ? { ...c, novo: false } : { ...NOVO, novo: true });
  }

  async function gravar() {
    const codigo = editando.codigo.trim().toUpperCase();
    const descricao = editando.descricao.trim();
    if (!/^[0-9A-Z]{1,8}$/.test(codigo)) { setErro('Código com 1 a 8 letras ou números, sem espaço.'); return; }
    if (!descricao) { setErro('Informe a descrição.'); return; }
    if (editando.novo && codigos.some((c) => c.codigo === codigo)) { setErro(`O código ${codigo} já existe.`); return; }
    setSalvando(true);
    setErro('');
    try {
      await salvarCodigo({ ...editando, codigo, descricao }, { novo: editando.novo });
      await auditar(editando.novo ? 'Código de cálculo cadastrado' : 'Código de cálculo alterado',
        `${codigo} • ${descricao.toLocaleUpperCase('pt-BR')} • ${editando.natureza}${editando.ativo ? '' : ' • inativo'}`);
      await recarregar();
      notificar(`Código ${codigo} salvo.`);
      setEditando(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c) {
    if (!window.confirm(`Excluir o código ${c.codigo} — ${c.descricao}?`)) return;
    try {
      await excluirCodigo(c.codigo);
      await auditar('Código de cálculo excluído', `${c.codigo} • ${c.descricao}`);
      await recarregar();
      notificar(`Código ${c.codigo} excluído.`);
    } catch (e) {
      notificar(e.message, 'erro');
    }
  }

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-header-title">Códigos de cálculo ({codigos.length} · {planilha} alimentado(s) por planilha)</div>
        <button type="button" className="btn btn-primary" onClick={() => abrir(null)}><Plus size={16} /> Novo código</button>
      </div>
      <TableScroll>
        <table className="data-table">
          <thead>
            <tr><th>Código</th><th>Descrição</th><th>Natureza</th><th>Origem</th><th>Situação</th><th /></tr>
          </thead>
          <tbody>
            {codigos.map((c) => (
              <tr key={c.codigo} className="pj-cfg-clicavel" onClick={() => abrir(c)}>
                <td className="pj-num"><strong>{c.codigo}</strong></td>
                <td>{c.descricao}</td>
                <td><span className={`badge ${c.natureza === 'provento' ? 'aprovada' : 'reprovada'}`}>{c.natureza === 'provento' ? 'Provento' : 'Desconto'}</span></td>
                <td className="pj-sub">{c.origem || '—'}</td>
                <td><span className={`badge ${c.ativo ? 'ativo' : 'inativo'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td className="pj-direita">
                  <button type="button" className="btn btn-ghost btn-icon" aria-label={`Excluir ${c.codigo}`}
                    onClick={(e) => { e.stopPropagation(); excluir(c); }}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!codigos.length && <Vazio>Nenhum código cadastrado.</Vazio>}
      </TableScroll>
      <p className="pj-sub pj-cfg-nota">Código usado em algum envelope não pode ser excluído — inative para tirá-lo de novos lançamentos.</p>

      {editando && (
        <Modal titulo={editando.novo ? 'Novo código' : `Código ${editando.codigo}`} onFechar={() => setEditando(null)} bloqueado={salvando}
          rodape={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setEditando(null)} disabled={salvando}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={gravar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar código'}</button>
            </>
          )}>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="pj-form-grid pj-cfg-modal-grid">
            <Campo rotulo="Código" obrigatorio dica={editando.novo ? 'Até 8 caracteres, maiúsculo.' : 'O código não muda depois de criado.'}>
              <input className="form-input" maxLength={8} value={editando.codigo} readOnly={!editando.novo}
                onChange={(e) => setEditando((c) => ({ ...c, codigo: e.target.value.toUpperCase().replace(/\s/g, '') }))} />
            </Campo>
            <Campo rotulo="Natureza do cálculo" obrigatorio>
              <select className="form-select" value={editando.natureza} onChange={(e) => setEditando((c) => ({ ...c, natureza: e.target.value }))}>
                <option value="provento">Provento — soma ao valor bruto</option>
                <option value="desconto">Desconto — reduz o líquido</option>
              </select>
            </Campo>
            <Campo rotulo="Descrição" obrigatorio largura="total">
              <input className="form-input" value={editando.descricao} onChange={(e) => setEditando((c) => ({ ...c, descricao: e.target.value }))} />
            </Campo>
          </div>
          <label className="pj-check pj-cfg-espaco">
            <input type="checkbox" checked={editando.ativo} onChange={(e) => setEditando((c) => ({ ...c, ativo: e.target.checked }))} />
            Código ativo para novos lançamentos
          </label>
          {!editando.novo && (
            <Aviso tipo="info">
              Mudar a descrição ou a natureza vale para os próximos lançamentos. Os eventos já lançados nos envelopes
              guardam a própria descrição e natureza e não são reescritos.
            </Aviso>
          )}
        </Modal>
      )}
    </div>
  );
}
