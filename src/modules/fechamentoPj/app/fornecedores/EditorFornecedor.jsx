import { useMemo, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal, Abas, Campo, Aviso, Badge } from '../components/ui';
import { salvarFornecedor, excluirFornecedor, auditar } from '../../lib/dados';
import { statusFornecedor, RM_PADRAO } from '../../lib/totvs';
import { cnpjValido, digitos, mascararCnpj, normalizar } from '../../lib/formato';

const CAMPOS_ENDERECO = [
  ['cep', 'CEP'], ['tipoRua', 'Tipo de rua'], ['rua', 'Rua', 'largo'], ['numero', 'Número'], ['complemento', 'Complemento'],
  ['tipoBairro', 'Tipo de bairro'], ['bairro', 'Bairro'], ['paisCodigo', 'País — código'], ['pais', 'País'],
  ['ufCodigo', 'Estado — código'], ['uf', 'Estado'], ['municipioCodigo', 'Município — código'], ['municipio', 'Município'],
];

const CAMPOS_CONTATO = [
  ['telefone', 'Telefone'], ['celular', 'Celular'], ['fax', 'Fax'], ['email', 'E-mail'], ['contato', 'Contato'],
];

const PIX_TIPOS = ['CNPJ', 'CPF', 'Celular', 'E-mail', 'Aleatória'];

const vazio = () => ({
  prestador_id: '', codigo_rm: '', nome_fantasia: '', razao_social: '', cnpj: '',
  classificacao: 'Fornecedor', categoria: 'Pessoa Jurídica', inscricao_estadual: '', inscricao_municipal: '',
  tipo_codigo: '2', tipo_descricao: 'SERVIÇO', global: true, ativo: true, bloqueado: false,
  endereco: { tipoRua: 'RUA', tipoBairro: 'BAIRRO', paisCodigo: '1', pais: 'Brasil' },
  contatos: {}, bancos: [], origem: 'Manual',
});

const novoBanco = (ref, form, rm) => ({
  ref, descricao: 'PIX CNPJ', ativo: true, filial: rm.filial, filialNome: 'PHD ASSESSORIA EM GESTAO LTDA',
  formaPagamento: 'PIX Transferência', banco: '', agencia: '', agenciaDigito: '', agenciaNome: '', conta: '', contaDigito: '',
  tipoConta: '', camara: '', favorecido: form.razao_social || '', favorecidoDoc: form.cnpj || '', pixTipo: 'CNPJ', pixChave: form.cnpj || '',
});

// Só o que vai para o banco (CAMPOS_FORNECEDOR de dados.js); o resto é da tela.
const paraGravar = (f) => ({
  id: f.id, prestador_id: f.prestador_id || null, codigo_rm: f.codigo_rm || null, nome_fantasia: f.nome_fantasia?.trim() || null,
  razao_social: f.razao_social?.trim() || null, cnpj: f.cnpj?.trim() || null, classificacao: f.classificacao, categoria: f.categoria,
  inscricao_estadual: f.inscricao_estadual || null, inscricao_municipal: f.inscricao_municipal || null,
  tipo_codigo: f.tipo_codigo || null, tipo_descricao: f.tipo_descricao || null, global: f.global, ativo: f.ativo, bloqueado: f.bloqueado,
  endereco: f.endereco || {}, contatos: f.contatos || {}, bancos: f.bancos || [], origem: f.origem || 'Manual',
});

export default function EditorFornecedor({ fornecedor, onFechar }) {
  const { prestadores = [], fornecedores = [], config, recarregar, notificar } = useFechamentoPj();
  const rm = useMemo(() => ({ ...RM_PADRAO, ...(config?.rm || {}) }), [config]);
  const novo = !fornecedor.id;
  const [inicial] = useState(() => (novo ? vazio() : {
    ...vazio(), ...fornecedor,
    endereco: { ...(fornecedor.endereco || {}) }, contatos: { ...(fornecedor.contatos || {}) },
    bancos: (fornecedor.bancos || []).map((b) => ({ ...b })),
  }));
  const [form, setForm] = useState(inicial);
  const [aba, setAba] = useState('identificacao');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const sujo = useMemo(() => JSON.stringify(paraGravar(form)) !== JSON.stringify(paraGravar(inicial)), [form, inicial]);

  // Vínculo: prestadores sem fornecedor, mais o que já está ligado a este cadastro.
  const opcoesPrestador = useMemo(() => {
    const ocupados = new Set(fornecedores.filter((f) => f.prestador_id && f.id !== fornecedor.id).map((f) => f.prestador_id));
    return prestadores.filter((p) => !ocupados.has(p.id)).sort((a, b) => normalizar(a.nome).localeCompare(normalizar(b.nome)));
  }, [prestadores, fornecedores, fornecedor.id]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const setSub = (grupo, campo, valor) => setForm((f) => ({ ...f, [grupo]: { ...(f[grupo] || {}), [campo]: valor } }));
  const setBanco = (i, campo, valor) => setForm((f) => ({
    ...f, bancos: f.bancos.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)),
  }));

  const cnpjAviso = form.cnpj && !cnpjValido(form.cnpj) ? 'CNPJ com dígito verificador inválido — confira no cartão CNPJ.' : '';
  const codigoErro = form.codigo_rm && !/^\d{7}$/.test(form.codigo_rm) ? 'O código RM tem 7 dígitos.' : '';
  const status = statusFornecedor(form);

  function fechar() {
    if (salvando) return;
    if (sujo && !window.confirm('Descartar as alterações deste cadastro?')) return;
    onFechar();
  }

  function aoSairCodigo() {
    const d = digitos(form.codigo_rm);
    // Quem digita "543" quer dizer 0000543 (é assim que o RM mostra).
    if (d && d.length <= 7) set('codigo_rm', d.padStart(7, '0'));
  }

  function aoSairCnpj() {
    if (digitos(form.cnpj).length === 14) set('cnpj', mascararCnpj(form.cnpj));
  }

  async function salvar() {
    setErro('');
    if (!form.razao_social?.trim()) { setAba('identificacao'); setErro('Informe a razão social.'); return; }
    if (codigoErro) { setAba('identificacao'); setErro(codigoErro); return; }
    const refs = form.bancos.map((b) => String(b.ref));
    if (new Set(refs).size !== refs.length) { setAba('bancos'); setErro('Há contas bancárias com a mesma referência.'); return; }
    setSalvando(true);
    try {
      const gravado = await salvarFornecedor(paraGravar(form));
      await auditar(novo ? 'Fornecedor TOTVS cadastrado' : 'Fornecedor TOTVS alterado',
        `${gravado.codigo_rm || 'sem código RM'} • ${gravado.razao_social}`, { prestadorId: gravado.prestador_id });
      await recarregar();
      notificar(novo ? 'Fornecedor cadastrado.' : 'Fornecedor atualizado.');
      onFechar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!window.confirm(`Excluir o cadastro de ${form.razao_social || 'fornecedor'}? O prestador perde o código RM no pagamento.`)) return;
    setSalvando(true);
    try {
      await excluirFornecedor(fornecedor.id);
      await auditar('Fornecedor TOTVS excluído', `${fornecedor.codigo_rm || 'sem código RM'} • ${fornecedor.razao_social || ''}`,
        { prestadorId: fornecedor.prestador_id });
      await recarregar();
      notificar('Fornecedor excluído.');
      onFechar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const input = (campo, props = {}) => (
    <input className="form-input" value={form[campo] ?? ''} onChange={(e) => set(campo, e.target.value)} {...props} />
  );

  return (
    <Modal largura="xl" onFechar={fechar} bloqueado={salvando}
      titulo={novo ? 'Novo cadastro Cliente/Fornecedor' : `Fornecedor ${form.codigo_rm || '(sem código RM)'}`}
      subtitulo={(
        <span className="pj-forn-subtitulo">
          <Badge tipo="fornecedor" valor={status} />
          {sujo && <span className="pj-forn-sujo">Alterações não salvas</span>}
        </span>
      )}
      rodape={(
        <>
          {!novo && (
            <button type="button" className="btn btn-danger pj-forn-excluir" onClick={excluir} disabled={salvando}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={fechar} disabled={salvando}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando || (!sujo && !novo)}>
            <Save size={16} /> {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}>
      <Abas ativa={aba} onTrocar={setAba} abas={[
        { id: 'identificacao', rotulo: 'Identificação' },
        { id: 'bancos', rotulo: `Dados bancários (${form.bancos.length})` },
      ]} />

      <div className="pj-forn-corpo">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        {aba === 'identificacao' && (
          <>
            <div className="pj-secao-titulo">Identificação</div>
            <div className="pj-form-grid">
              <Campo rotulo="Cliente/Fornecedor (código RM)" erro={codigoErro} dica="7 dígitos, como no RM">
                {input('codigo_rm', { inputMode: 'numeric', maxLength: 7, onBlur: aoSairCodigo, placeholder: '0000000' })}
              </Campo>
              <Campo rotulo="Nome fantasia" largura="largo">{input('nome_fantasia')}</Campo>
              <Campo rotulo="Razão social" obrigatorio largura="largo">{input('razao_social')}</Campo>
              <Campo rotulo="CNPJ" dica={cnpjAviso ? undefined : 'Somente números ou com máscara'}>
                {input('cnpj', { onBlur: aoSairCnpj, placeholder: '00.000.000/0000-00' })}
                {cnpjAviso && <span className="pj-forn-alerta">{cnpjAviso}</span>}
              </Campo>
              <Campo rotulo="Classificação">
                <select className="form-select" value={form.classificacao} onChange={(e) => set('classificacao', e.target.value)}>
                  <option>Cliente</option><option>Fornecedor</option><option>Ambos</option>
                </select>
              </Campo>
              <Campo rotulo="Categoria">
                <select className="form-select" value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
                  <option>Pessoa Jurídica</option><option>Pessoa Física</option>
                </select>
              </Campo>
              <Campo rotulo="Inscrição estadual">{input('inscricao_estadual')}</Campo>
              <Campo rotulo="Inscrição municipal">{input('inscricao_municipal')}</Campo>
              <Campo rotulo="Tipo — código">{input('tipo_codigo')}</Campo>
              <Campo rotulo="Tipo — descrição">{input('tipo_descricao')}</Campo>
              <Campo rotulo="Prestador vinculado" largura="largo"
                dica="O pagamento acha o fornecedor pelo vínculo; sem vínculo, tenta pelo CNPJ.">
                <select className="form-select" value={form.prestador_id || ''} onChange={(e) => set('prestador_id', e.target.value)}>
                  <option value="">Sem vínculo</option>
                  {opcoesPrestador.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}{p.situacao === 'desligado' ? ' (desligado)' : ''}</option>
                  ))}
                </select>
              </Campo>
            </div>
            <div className="pj-forn-checks">
              {[['global', 'Global'], ['ativo', 'Ativo'], ['bloqueado', 'Bloqueado']].map(([campo, rotulo]) => (
                <label key={campo} className="pj-check">
                  <input type="checkbox" checked={Boolean(form[campo])} onChange={(e) => set(campo, e.target.checked)} /> {rotulo}
                </label>
              ))}
            </div>

            <div className="pj-secao-titulo">Endereço da empresa <span className="pj-forn-fonte">Fonte: cartão CNPJ</span></div>
            <div className="pj-form-grid">
              {CAMPOS_ENDERECO.map(([campo, rotulo, largura]) => (
                <Campo key={campo} rotulo={rotulo} largura={largura}>
                  <input className="form-input" value={form.endereco?.[campo] ?? ''} onChange={(e) => setSub('endereco', campo, e.target.value)} />
                </Campo>
              ))}
            </div>

            <div className="pj-secao-titulo">Contatos</div>
            <div className="pj-form-grid">
              {CAMPOS_CONTATO.map(([campo, rotulo]) => (
                <Campo key={campo} rotulo={rotulo}>
                  <input className="form-input" type={campo === 'email' ? 'email' : 'text'} value={form.contatos?.[campo] ?? ''}
                    onChange={(e) => setSub('contatos', campo, e.target.value)} />
                </Campo>
              ))}
            </div>
          </>
        )}

        {aba === 'bancos' && (
          <>
            <div className="pj-toolbar">
              <span className="pj-sub">
                Para ficar <strong>Pronto</strong>: uma conta ativa com forma de pagamento, CNPJ/CPF do favorecido e chave PIX ou conta.
              </span>
              <div className="pj-toolbar-direita">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm((f) => ({
                  ...f, bancos: [...f.bancos, novoBanco(Math.max(0, ...f.bancos.map((b) => Number(b.ref) || 0)) + 1, f, rm)],
                }))}>
                  <Plus size={16} /> Adicionar conta
                </button>
              </div>
            </div>
            {!form.bancos.length && <div className="pj-vazio table-empty">Nenhuma conta bancária cadastrada.</div>}
            {form.bancos.map((b, i) => (
              <div key={i} className="pj-cartao pj-forn-banco">
                <div className="pj-forn-banco-topo">
                  <strong>Conta {b.ref}{b.descricao ? ` — ${b.descricao}` : ''}</strong>
                  <label className="pj-check">
                    <input type="checkbox" checked={b.ativo !== false} onChange={(e) => setBanco(i, 'ativo', e.target.checked)} /> Ativa
                  </label>
                  <button type="button" className="btn btn-ghost btn-sm pj-forn-banco-remover"
                    onClick={() => setForm((f) => ({ ...f, bancos: f.bancos.filter((_, j) => j !== i) }))}>
                    <Trash2 size={16} /> Remover
                  </button>
                </div>
                <div className="pj-form-grid">
                  <Campo rotulo="Ref.">
                    <input className="form-input" inputMode="numeric" value={b.ref ?? ''}
                      onChange={(e) => setBanco(i, 'ref', digitos(e.target.value) ? Number(digitos(e.target.value)) : '')} />
                  </Campo>
                  {[
                    ['descricao', 'Descrição'], ['filial', 'Filial'], ['filialNome', 'Nome da filial', 'largo'],
                    ['formaPagamento', 'Forma de pagamento'], ['banco', 'Banco'], ['agencia', 'Agência'], ['agenciaDigito', 'Dígito agência'],
                    ['agenciaNome', 'Nome da agência'], ['conta', 'Conta corrente'], ['contaDigito', 'Dígito conta'], ['tipoConta', 'Tipo da conta'],
                    ['camara', 'Câmara comp.'], ['favorecido', 'Favorecido', 'largo'], ['favorecidoDoc', 'CNPJ/CPF do favorecido'],
                  ].map(([campo, rotulo, largura]) => (
                    <Campo key={campo} rotulo={rotulo} largura={largura}>
                      <input className="form-input" value={b[campo] ?? ''} onChange={(e) => setBanco(i, campo, e.target.value)} />
                    </Campo>
                  ))}
                  <Campo rotulo="Tipo de chave PIX">
                    <select className="form-select" value={b.pixTipo || ''} onChange={(e) => setBanco(i, 'pixTipo', e.target.value)}>
                      <option value="">—</option>
                      {PIX_TIPOS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Campo>
                  <Campo rotulo="Chave PIX" largura="largo">
                    <input className="form-input" value={b.pixChave ?? ''} onChange={(e) => setBanco(i, 'pixChave', e.target.value)} />
                  </Campo>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
