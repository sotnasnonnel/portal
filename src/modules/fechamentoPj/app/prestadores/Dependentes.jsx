import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Campo, Modal, Vazio } from '../components/ui';
import { cpfValido, dataBr, digitos, mascararCpf, maiusculo } from '../../lib/formato';
import { BENEFICIOS_DEPENDENTE, PARENTESCOS, situacaoDoDependente } from '../../lib/documentos';
import { salvarPrestador, auditar } from '../../lib/dados';
import TableScroll from '../../../../components/UI/TableScroll';

const PENDENTE = /INAT|NAO LOCALIZADO|NÃO LOCALIZADO|DIVERG|PEND|FALTA|INV[ÁA]LIDO|DESCARTADO|CONFIRMAR/i;

// Só estes campos são editáveis à mão: situação é calculada e fonte é a
// procedência do dado (de qual planilha ou arquivo ele veio).
const paraForm = (d) => ({
  nome: d.nome || '',
  cpf: d.cpf || '',
  nascimento: d.nascimento || '',
  sexo: d.sexo || '',
  parentesco: d.parentesco || '',
  beneficio: d.beneficio || '',
});

function validar(f) {
  const erros = {};
  if (!String(f.nome).trim()) erros.nome = 'Informe o nome.';
  if (f.cpf && !cpfValido(f.cpf)) erros.cpf = 'CPF inválido (confira os dígitos).';
  return erros;
}

/**
 * Dependentes do prestador: a lista que a Conferência Bradesco e a importação
 * documental alimentam, com correção manual linha a linha.
 *
 * A lista mora em `pj_prestadores.dependentes` (jsonb), então editar ou excluir
 * é gravar o array inteiro de novo. A situação nunca é digitada: sai de
 * `situacaoDoDependente`, a mesma regra da tela de importação.
 */
export default function Dependentes({ prestador }) {
  const { notificar, recarregar } = useFechamentoPj();
  const dependentes = Array.isArray(prestador.dependentes) ? prestador.dependentes : [];
  const [editando, setEditando] = useState(null); // { indice, form }
  const [erros, setErros] = useState({});
  const [excluindo, setExcluindo] = useState(null);
  const [gravando, setGravando] = useState(false);

  async function gravar(lista, mensagem, detalhe) {
    setGravando(true);
    try {
      await salvarPrestador({ id: prestador.id, dependentes: lista });
      await auditar('Dependente do prestador alterado', `${prestador.nome} • ${detalhe}`, { prestadorId: prestador.id });
      await recarregar();
      notificar(mensagem);
      return true;
    } catch (e) {
      notificar(e.message || 'Não foi possível salvar os dependentes.', 'erro');
      return false;
    } finally {
      setGravando(false);
    }
  }

  async function salvar() {
    const encontrados = validar(editando.form);
    setErros(encontrados);
    if (Object.keys(encontrados).length) return;

    const atual = dependentes[editando.indice];
    const editado = {
      ...atual,
      nome: maiusculo(editando.form.nome),
      cpf: editando.form.cpf || '',
      nascimento: editando.form.nascimento || null,
      sexo: editando.form.sexo || '',
      parentesco: editando.form.parentesco || '',
      beneficio: editando.form.beneficio || '',
    };
    editado.situacao = situacaoDoDependente(editado);

    const lista = dependentes.map((d, i) => (i === editando.indice ? editado : d));
    const mudou = Object.keys(paraForm(atual)).filter((k) => String(atual[k] ?? '') !== String(editado[k] ?? ''));
    if (!mudou.length) {
      setEditando(null);
      notificar('Nada mudou no dependente.', 'info');
      return;
    }
    const detalhe = `${atual.nome || '(sem nome)'} • ${mudou.join(', ')}`;
    if (await gravar(lista, 'Dependente atualizado.', detalhe)) setEditando(null);
  }

  async function excluir(indice) {
    const alvo = dependentes[indice];
    const lista = dependentes.filter((_, i) => i !== indice);
    if (await gravar(lista, 'Dependente excluído.', `${alvo.nome || '(sem nome)'} removido`)) setExcluindo(null);
  }

  const set = (campo, valor) => {
    setEditando((e) => ({ ...e, form: { ...e.form, [campo]: valor } }));
    if (erros[campo]) setErros((x) => { const n = { ...x }; delete n[campo]; return n; });
  };

  return (
    <>
      <div className="pj-secao-titulo">Dependentes cadastrados ({dependentes.length})</div>
      {dependentes.length ? (
        <>
          <TableScroll>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th><th>CPF</th><th>Nascimento</th><th>Parentesco</th>
                  <th>Situação</th><th>Fonte</th><th>Benefício</th><th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {dependentes.map((d, i) => (
                  <tr key={`${d.nome}-${i}`}>
                    <td>{d.nome}</td>
                    <td className="pjp-nowrap">{d.cpf ? mascararCpf(d.cpf) : '—'}</td>
                    <td className="pjp-nowrap">{dataBr(d.nascimento)}</td>
                    <td>{d.parentesco || '—'}</td>
                    <td>{d.situacao ? <span className={`badge ${PENDENTE.test(d.situacao) ? 'pj-neutro' : 'aprovada'}`}>{d.situacao}</span> : '—'}</td>
                    <td>{d.fonte || '—'}</td>
                    <td>{d.beneficio || '—'}</td>
                    <td className="pjp-nowrap">
                      {excluindo === i ? (
                        <>
                          <button type="button" className="btn btn-sm btn-danger" disabled={gravando}
                            onClick={() => excluir(i)}>Confirmar</button>
                          <button type="button" className="btn btn-sm btn-ghost" disabled={gravando}
                            onClick={() => setExcluindo(null)}>Não</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn-icon" title="Editar dependente"
                            onClick={() => { setErros({}); setEditando({ indice: i, form: paraForm(d) }); }}>
                            <Pencil size={16} />
                          </button>
                          <button type="button" className="btn-icon" title="Excluir dependente"
                            onClick={() => setExcluindo(i)}>
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <p className="form-hint">
            A correção vale para o cadastro. Dependente excluído volta a aparecer se a Conferência Bradesco ou a
            importação documental trouxerem o mesmo nome de novo.
          </p>
        </>
      ) : <Vazio>Nenhum dependente cadastrado.</Vazio>}

      {editando && (
        <Modal titulo="Editar dependente" subtitulo={dependentes[editando.indice]?.nome} largura="md"
          bloqueado={gravando} onFechar={() => setEditando(null)}
          rodape={(
            <>
              <button type="button" className="btn btn-ghost" disabled={gravando}
                onClick={() => setEditando(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={gravando} onClick={salvar}>
                {gravando ? 'Salvando…' : 'Salvar'}
              </button>
            </>
          )}>
          <div className="pj-form-grid">
            <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
              <input type="text" className="form-input" value={editando.form.nome}
                onChange={(e) => set('nome', e.target.value)} />
            </Campo>
            <Campo rotulo="CPF" erro={erros.cpf} dica="Deixe em branco se ainda não tiver.">
              <input type="text" className="form-input" inputMode="numeric" placeholder="000.000.000-00"
                value={mascararCpf(editando.form.cpf)}
                onChange={(e) => set('cpf', digitos(e.target.value).slice(0, 11))} />
            </Campo>
            <Campo rotulo="Nascimento">
              <input type="date" className="form-input" value={editando.form.nascimento || ''}
                onChange={(e) => set('nascimento', e.target.value)} />
            </Campo>
            <Campo rotulo="Sexo">
              <select className="form-input" value={editando.form.sexo} onChange={(e) => set('sexo', e.target.value)}>
                <option value="">—</option>
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
              </select>
            </Campo>
            <Campo rotulo="Parentesco">
              <select className="form-input" value={editando.form.parentesco}
                onChange={(e) => set('parentesco', e.target.value)}>
                <option value="">—</option>
                {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Benefício">
              <select className="form-input" value={editando.form.beneficio}
                onChange={(e) => set('beneficio', e.target.value)}>
                <option value="">—</option>
                {BENEFICIOS_DEPENDENTE.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Campo>
          </div>
          <p className="form-hint">
            A situação é recalculada sozinha a partir do que estiver preenchido. A fonte do dado não muda — ela guarda
            de onde a informação veio.
          </p>
        </Modal>
      )}
    </>
  );
}
