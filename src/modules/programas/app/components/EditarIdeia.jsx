import { useState } from 'react';
import { Loader2, Plus, Save, X } from 'lucide-react';
import {
  CATEGORIAS, SETORES, SITUACOES,
} from '../../../../config/programas';

/**
 * Formulário de edição, exibido dentro do popup de detalhe quando quem abriu é
 * o autor (ou o admin do módulo).
 *
 * Os campos são os mesmos do cadastro, com uma exceção deliberada: a FORMA
 * (ideia x iniciativa) não é editável. Trocá-la faria a linha violar o CHECK
 * por tipo do banco — uma ideia não tem data de início nem ferramenta, e uma
 * iniciativa não tem problema/benefícios. Quem errou a forma registra de novo.
 */

const VAZIO_FERRAMENTA = (id) => ({ id, valor: '' });

export default function EditarIdeia({ registro, salvando, erro, onCancelar, onSalvar }) {
  const ehIniciativa = registro.tipo === 'iniciativa';

  const [v, setV] = useState({
    titulo: registro.titulo || '',
    setor: registro.setor || '',
    categoria: registro.categoria || '',
    retorno: registro.retorno || '',
    situacao: registro.situacao || 'idealizado',
    descricao: registro.descricao || '',
    problema: registro.problema || '',
    beneficios: registro.beneficios || '',
    data_inicio: registro.data_inicio || '',
    finalidade: registro.finalidade || '',
    link: registro.link || '',
    observacoes: registro.observacoes || '',
  });

  const [ferramentas, setFerramentas] = useState(() => {
    const atuais = (registro.ferramentas || []).map((f, i) => ({ id: i + 1, valor: f }));
    return atuais.length ? atuais : [VAZIO_FERRAMENTA(1)];
  });
  const [proximoId, setProximoId] = useState((registro.ferramentas?.length || 0) + 1);

  const set = (campo) => (e) => setV((a) => ({ ...a, [campo]: e.target.value }));

  const addFerramenta = () => {
    setFerramentas((a) => [...a, VAZIO_FERRAMENTA(proximoId)]);
    setProximoId((n) => n + 1);
  };
  const removerFerramenta = (id) => setFerramentas((a) => (
    a.length === 1 ? [VAZIO_FERRAMENTA(proximoId)] : a.filter((f) => f.id !== id)
  ));

  const enviar = (e) => {
    e.preventDefault();
    onSalvar({ ...v, ferramentas: ferramentas.map((f) => f.valor) });
  };

  return (
    <form onSubmit={enviar}>
      {erro && <div className="pg-aviso tom-erro"><X size={16} /> {erro}</div>}

      <div className="pg-campo">
        <label htmlFor="e-titulo">
          {ehIniciativa ? 'O que está criando' : 'Título da ideia'}<span className="req">*</span>
        </label>
        <textarea
          id="e-titulo" className="pg-textarea" style={{ minHeight: 70 }}
          value={v.titulo} onChange={set('titulo')} required
        />
      </div>

      <div className="pg-dupla">
        <div className="pg-campo">
          <label htmlFor="e-setor">Setor<span className="req">*</span></label>
          <select id="e-setor" className="pg-select" value={v.setor} onChange={set('setor')} required>
            <option value="">Selecione…</option>
            {SETORES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className="pg-campo">
          <label htmlFor="e-situacao">Situação<span className="req">*</span></label>
          <select id="e-situacao" className="pg-select" value={v.situacao} onChange={set('situacao')}>
            {SITUACOES.map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="pg-campo">
        <label htmlFor="e-categoria">Tipo<span className="req">*</span></label>
        <select id="e-categoria" className="pg-select" value={v.categoria} onChange={set('categoria')} required>
          <option value="">Selecione…</option>
          {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
        </select>
      </div>

      {ehIniciativa ? (
        <>
          <div className="pg-campo">
            <label htmlFor="e-data">Data de início da criação<span className="req">*</span></label>
            <input id="e-data" type="date" className="pg-input" value={v.data_inicio} onChange={set('data_inicio')} required />
          </div>

          <div className="pg-campo">
            <label>Ferramenta usada<span className="req">*</span></label>
            <div className="pg-lista-campo">
              {ferramentas.map((f, i) => (
                <div className="pg-lista-linha" key={f.id}>
                  <input
                    className="pg-input" value={f.valor}
                    onChange={(e) => setFerramentas((a) => a.map(
                      (x) => (x.id === f.id ? { ...x, valor: e.target.value } : x)
                    ))}
                    aria-label={`Ferramenta ${i + 1}`}
                  />
                  <button
                    type="button" className="pg-lista-x" onClick={() => removerFerramenta(f.id)}
                    aria-label={`Remover ferramenta ${i + 1}`}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button type="button" className="pg-lista-add" onClick={addFerramenta}>
                <Plus size={14} /> Adicionar ferramenta
              </button>
            </div>
          </div>

          <div className="pg-campo">
            <label htmlFor="e-finalidade">Finalidade<span className="req">*</span></label>
            <textarea id="e-finalidade" className="pg-textarea" value={v.finalidade} onChange={set('finalidade')} required />
          </div>
        </>
      ) : (
        <>
          <div className="pg-campo">
            <label htmlFor="e-descricao">Descrição da ideia<span className="req">*</span></label>
            <textarea id="e-descricao" className="pg-textarea" value={v.descricao} onChange={set('descricao')} required />
          </div>
          <div className="pg-campo">
            <label htmlFor="e-problema">Problema que resolve<span className="req">*</span></label>
            <textarea id="e-problema" className="pg-textarea" value={v.problema} onChange={set('problema')} required />
          </div>
          <div className="pg-campo">
            <label htmlFor="e-beneficios">Benefícios esperados<span className="req">*</span></label>
            <textarea id="e-beneficios" className="pg-textarea" value={v.beneficios} onChange={set('beneficios')} required />
          </div>
        </>
      )}

      <div className="pg-campo">
        <label htmlFor="e-retorno">Retorno esperado<span className="req">*</span></label>
        <textarea id="e-retorno" className="pg-textarea" value={v.retorno} onChange={set('retorno')} required />
        {/* Os registros importados nasceram com este texto no lugar do retorno.
            Dizer isso aqui é o que transforma a pendência em tarefa. */}
        {registro.retorno?.startsWith('A preencher') && (
          <p className="pg-campo-dica">
            Este registro veio do formulário antigo, que não perguntava o retorno. É aqui que ele entra.
          </p>
        )}
      </div>

      <div className="pg-campo">
        <label htmlFor="e-link">Link do arquivo / pasta<span className="opc">(opcional)</span></label>
        <input id="e-link" className="pg-input" value={v.link} onChange={set('link')} placeholder="https://…" />
      </div>

      <div className="pg-campo">
        <label htmlFor="e-obs">Observações<span className="opc">(opcional)</span></label>
        <textarea id="e-obs" className="pg-textarea" style={{ minHeight: 80 }} value={v.observacoes} onChange={set('observacoes')} />
      </div>

      {/* Os botões ficam DENTRO do <form>, no fim: no rodapé fixo do popup eles
          precisariam de form="id" para submeter, e isso quebra o Enter em
          alguns navegadores. Rolar até o fim para salvar é o preço. */}
      <div className="pg-editar-acoes">
        <button type="button" className="pg-btn pg-btn-ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
        <button type="submit" className="pg-btn pg-btn-primary" disabled={salvando}>
          {salvando
            ? <><Loader2 size={16} className="pg-spin" /> Salvando…</>
            : <><Save size={16} /> Salvar</>}
        </button>
      </div>
    </form>
  );
}
