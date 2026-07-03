# Cadastro por seleção + Fluxos por tipo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o cadastro de colaborador em "selecionar existente + editar só RH" e dar a cada tipo de requisição seu próprio fluxo de aprovação configurável, pré-preenchido com o comportamento atual.

**Architecture:** Mudanças no front React (páginas Admin + hook de requisição + form de Mapeamento + config de aprovação) mais uma migration de dados (seed) no Supabase compartilhado. Reaproveita a tabela `solicitacoes_rh_fluxos` chaveando por `(solicitante_id, tipo, iniciativa='')`.

**Tech Stack:** React 19 + Vite, react-router, @supabase/supabase-js, Postgres/Supabase (`bogsuuhrgvopzgcceoqz`).

## Global Constraints

- **Sem framework de teste no repo.** Verificação por tarefa = `npm run lint` (sem erros novos; o erro pré-existente `react-refresh/only-export-components` em `AuthContext.jsx` não conta) + `npm run build` (✓ built) + verificação manual/SQL quando indicado.
- **Banco compartilhado** `bogsuuhrgvopzgcceoqz`. Migrations via `apply_migration` (MCP) e registradas como arquivo `supabase_migration_*.sql` na raiz, seguindo a convenção do repo.
- **Colaboradores admin** são excluídos das listas de seleção/edição (`perfil !== 'admin'`), como já faz a Listagem.
- **IDs fixos:** Admin executor `c2318237-b3f7-49ec-bb48-9d2a0c0c555d`; Lucas Ferraz (default Mapeamento) `554ec9c1-c4fb-4b5a-b4a6-040c835acca5`.
- **Tipos de requisição** (ordem de exibição): `aumento_salario`, `desligamento`, `formulario_contratacao`, `ajuda_custo`, `nova_vaga`, `mapeamento`. Rótulos em `TIPO_LABEL` / `TIPO_LABEL_CURTO` (`src/config/aprovacao.js`).
- **Commits:** seguir a preferência do usuário (branch a partir da `main` antes de commitar; commitar quando autorizado). Os passos de commit abaixo são o ponto de corte de cada tarefa.

---

## Parte 1 — Cadastro

### Task 1: `AdminCadastro` vira selecionar-existente + editar RH

**Files:**
- Modify: `src/pages/Admin/AdminCadastro.jsx` (reescrita do componente)

**Interfaces:**
- Consumes: `supabase` de `../../services/supabase`; tabela `colaboradores`.
- Produces: nenhuma exportação nova (componente default).

- [ ] **Step 1: Trocar o estado e o carregamento — listar colaboradores e adicionar seleção**

Substituir o bloco de estado/efeito do topo do componente. Manter `FORMATO_OPCOES`. Novo estado:

```jsx
export default function AdminCadastro() {
  const [colaboradores, setColaboradores] = useState([]); // ativos, não-admin
  const [gestores, setGestores] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    perfil: 'usuario', formato: '', dataNascimento: '', funcao: '',
    superior: '', dataAdmissao: '', salario: '', ultimoAumento: '',
  });
  const [sucesso, setSucesso] = useState(false);
  const superiorObrigatorio = formData.perfil !== 'gestor';
  const selecionado = colaboradores.find((c) => c.id === selecionadoId) || null;

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      const lista = (data || []).filter((c) => c.perfil !== 'admin');
      setColaboradores(lista);
      setGestores(lista.filter((c) => c.perfil === 'gestor'));
    };
    carregar();
  }, []);
```

- [ ] **Step 2: Ao selecionar um colaborador, popular o formulário**

Adicionar handler de seleção que carrega os campos de RH do colaborador escolhido:

```jsx
  const handleSelecionar = (e) => {
    const id = e.target.value;
    setSelecionadoId(id);
    setSucesso(false);
    const c = colaboradores.find((x) => x.id === id);
    if (!c) {
      setFormData({ perfil: 'usuario', formato: '', dataNascimento: '', funcao: '', superior: '', dataAdmissao: '', salario: '', ultimoAumento: '' });
      return;
    }
    setFormData({
      perfil: c.perfil || 'usuario',
      formato: c.formato || '',
      dataNascimento: c.data_nascimento || '',
      funcao: c.funcao || '',
      superior: c.superior_id || '',
      dataAdmissao: c.data_admissao || '',
      salario: c.salario ?? '',
      ultimoAumento: c.ultimo_aumento || '',
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'perfil' && value === 'gestor' ? { superior: '' } : {}),
    }));
    setSucesso(false);
  };
```

- [ ] **Step 3: Trocar o submit de INSERT para UPDATE**

```jsx
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selecionadoId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('colaboradores')
        .update({
          perfil: formData.perfil,
          formato: formData.formato || null,
          funcao: formData.funcao,
          superior_id: superiorObrigatorio ? (formData.superior || null) : null,
          data_admissao: formData.dataAdmissao || null,
          data_nascimento: formData.dataNascimento || null,
          salario: formData.salario === '' ? null : Number(formData.salario),
          ultimo_aumento: formData.ultimoAumento || null,
        })
        .eq('id', selecionadoId);
      if (error) throw error;
      setSucesso(true);
      setColaboradores((prev) => prev.map((c) => c.id === selecionadoId
        ? { ...c, perfil: formData.perfil, formato: formData.formato || null, funcao: formData.funcao,
            superior_id: superiorObrigatorio ? (formData.superior || null) : null,
            data_admissao: formData.dataAdmissao || null, data_nascimento: formData.dataNascimento || null,
            salario: formData.salario === '' ? null : Number(formData.salario), ultimo_aumento: formData.ultimoAumento || null }
        : c));
      setTimeout(() => setSucesso(false), 4000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar os dados do colaborador. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 4: Atualizar o JSX — título, seletor, campos nome/e-mail somente-leitura**

Trocar o título/subtítulo e o cabeçalho do card:

```jsx
      <h1 className="page-title"><UserPlus size={28} /> Editar dados do colaborador</h1>
      <p className="page-subtitle">Selecione um colaborador para completar ou atualizar os dados de RH. Nome e e-mail vêm da conta Microsoft.</p>
```

No corpo do form, ANTES do `form-grid`, adicionar o seletor e o cabeçalho read-only; só renderizar o restante quando houver `selecionado`:

```jsx
      <div className="form-group" style={{ maxWidth: 480 }}>
        <label className="form-label">Colaborador <span className="required">*</span></label>
        <select className="form-select" value={selecionadoId} onChange={handleSelecionar} required>
          <option value="">Selecione o colaborador...</option>
          {colaboradores.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>

      {selecionado && (
        <>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nome Completo</label>
              <input className="form-input" value={selecionado.nome || ''} readOnly disabled />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" value={selecionado.email || ''} readOnly disabled />
              <span className="form-hint">O acesso é feito com a conta Microsoft da PHD usando este e-mail.</span>
            </div>
            {/* ...os 8 campos de RH (perfil, formato, dataNascimento, funcao, superior, dataAdmissao, salario, ultimoAumento)
                reaproveitando exatamente os <div className="form-group"> que já existem hoje no componente... */}
          </div>
        </>
      )}
```

Os 8 campos de RH são os mesmos `form-group` já presentes no componente atual (perfil, formato, data de nascimento, função, superior condicional a `superiorObrigatorio`, data de admissão, salário, último aumento) — mover para dentro do bloco `{selecionado && ...}`. O dropdown de superior usa `gestores` (já filtrado para gestor, exclui o próprio: adicionar `.filter((g) => g.id !== selecionadoId)`).

- [ ] **Step 5: Ajustar o rodapé do form**

Botão "Limpar" vira "Trocar colaborador" (reseta seleção); botão de submit vira "Salvar":

```jsx
        <button type="button" className="btn btn-outline" onClick={() => { setSelecionadoId(''); setSucesso(false); }}>
          Trocar colaborador
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading || !selecionadoId}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
```

A mensagem de sucesso passa a "Dados atualizados com sucesso!".

- [ ] **Step 6: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos; `✓ built`.

- [ ] **Step 7: Verificação manual**

Run: `npm run dev`, logar como admin, abrir Cadastro. Confirmar: não há campos de digitar nome/e-mail novos; selecionar um colaborador popula os campos; nome/e-mail aparecem travados; salvar atualiza e reflete na Listagem.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Admin/AdminCadastro.jsx
git commit -m "feat: cadastro vira selecionar colaborador existente + editar so RH (nome/email read-only)"
```

---

### Task 2: Nome/e-mail somente-leitura no modal de edição da Listagem

**Files:**
- Modify: `src/pages/Admin/AdminListagem.jsx` (modal de edição + payload do UPDATE)

**Interfaces:**
- Consumes: estado `editForm` já existente.
- Produces: nenhuma mudança de interface.

- [ ] **Step 1: Tornar os inputs de Nome e E-mail somente-leitura no modal**

Nos dois `form-group` de Nome e E-mail dentro do modal (`AdminListagem.jsx`, ~linhas 433-454), trocar os `<input>` editáveis por travados:

```jsx
<div className="form-group">
  <label className="form-label">Nome Completo</label>
  <input className="form-input" value={editForm.nome} readOnly disabled />
</div>

<div className="form-group">
  <label className="form-label">E-mail</label>
  <input className="form-input" type="email" value={editForm.email} readOnly disabled />
</div>
```

(Remover os `name`/`onChange`/`required` desses dois campos.)

- [ ] **Step 2: Parar de enviar nome/e-mail no UPDATE**

No `payload` de `handleSalvarEdicao` (~linha 141), remover as linhas `nome:` e `email:` — o UPDATE passa a atualizar só os campos de RH:

```jsx
    const payload = {
      perfil: editForm.perfil,
      formato: editForm.formato || null,
      funcao: editForm.funcao,
      superior_id: editForm.superior || null,
      data_admissao: editForm.dataAdmissao || null,
      salario: editForm.salario === '' ? null : Number(editForm.salario),
      data_nascimento: editForm.dataNascimento || null,
      ultimo_aumento: editForm.ultimoAumento || null,
    };
```

- [ ] **Step 3: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos; `✓ built`.

- [ ] **Step 4: Verificação manual**

Abrir um colaborador na Listagem → Editar. Nome/e-mail travados; alterar função/salário e salvar funciona e reflete na linha.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Admin/AdminListagem.jsx
git commit -m "feat: nome/email somente-leitura no modal de edicao da listagem"
```

---

## Parte 2 — Fluxos de aprovação por tipo

### Task 3: `aprovacao.js` — `TIPOS_FLUXO` + `buscarFluxoPorTipo`

**Files:**
- Modify: `src/config/aprovacao.js`

**Interfaces:**
- Consumes: `supabase` (passado como arg), `FLUXO_GERAL`, `APROVADOR_MAPEAMENTO`, `buscarFluxoGeral` (já existentes no arquivo).
- Produces:
  - `export const TIPOS_FLUXO: string[]`
  - `export async function buscarFluxoPorTipo(supabase, solicitanteId, tipo) => { fluxo, erro }` onde `fluxo` é `{ aprovadores: string[] } | null` e `erro` é o erro do Supabase ou `null`.

- [ ] **Step 1: Adicionar `TIPOS_FLUXO`**

Logo após `TIPO_LABEL_CURTO` em `src/config/aprovacao.js`:

```js
// Tipos de requisição que têm fluxo de aprovação próprio (ordem de exibição).
export const TIPOS_FLUXO = [
  'aumento_salario', 'desligamento', 'formulario_contratacao',
  'ajuda_custo', 'nova_vaga', 'mapeamento',
];
```

- [ ] **Step 2: Adicionar `buscarFluxoPorTipo` com fallback**

Logo após `buscarFluxoGeral`:

```js
/**
 * Busca o fluxo de UM tipo do solicitante. Slot: (solicitante_id, tipo, iniciativa='').
 * Fallback (gestor ainda não seedado): 'mapeamento' → Lucas Ferraz; demais tipos →
 * slot geral (aumento_salario). Retorna { fluxo, erro } como buscarFluxoGeral.
 */
export async function buscarFluxoPorTipo(supabase, solicitanteId, tipo) {
  const { data, error } = await supabase
    .from('solicitacoes_rh_fluxos')
    .select('*')
    .eq('solicitante_id', solicitanteId)
    .eq('tipo', tipo)
    .eq('iniciativa', '')
    .maybeSingle();
  if (error) return { fluxo: null, erro: error };
  if (data) return { fluxo: data, erro: null };
  if (tipo === 'mapeamento') {
    return { fluxo: { aprovadores: [APROVADOR_MAPEAMENTO.id] }, erro: null };
  }
  if (tipo !== FLUXO_GERAL.tipo) {
    return buscarFluxoGeral(supabase, solicitanteId);
  }
  return { fluxo: null, erro: null };
}
```

- [ ] **Step 3: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos; `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/config/aprovacao.js
git commit -m "feat: buscarFluxoPorTipo + TIPOS_FLUXO (fluxo de aprovacao por tipo)"
```

---

### Task 4: `useRequisicaoForm` — `resolverCadeia(tipo)` por tipo

**Files:**
- Modify: `src/pages/Gestor/requisicoes/useRequisicaoForm.js`

**Interfaces:**
- Consumes: `buscarFluxoPorTipo` (Task 3); RPC `nomes_colaboradores` (já existe no banco).
- Produces: `resolverCadeia(tipo)` agora recebe `tipo`. `criarComFluxo`/`criarComDetalhe`/`criarFormularioContratacao` inalterados na assinatura externa (já recebem `tipo`).

- [ ] **Step 1: Trocar o import**

Linha 4:

```js
import { buscarFluxoGeral, buscarFluxoPorTipo, montarEtapasDeConfig } from '../../../config/aprovacao';
```

(`buscarFluxoGeral` continua importado — é usado no precheck `fluxoOk`.)

- [ ] **Step 2: `resolverCadeia` passa a receber `tipo`**

Substituir a definição de `resolverCadeia` (~linhas 49-63):

```js
  // Resolve a cadeia do tipo: ids ordenados + nomes (snapshot do papel).
  const resolverCadeia = useCallback(async (tipo) => {
    const { fluxo, erro } = await buscarFluxoPorTipo(supabase, user.id, tipo);
    if (erro) throw new Error('Erro ao consultar o fluxo de aprovação. Tente novamente.');
    if (!fluxo) throw new Error('SEM_FLUXO');
    const ids = (Array.isArray(fluxo.aprovadores) ? fluxo.aprovadores : [])
      .map((x) => (x || '').trim()).filter(Boolean);
    let nomePorId = {};
    if (ids.length) {
      const { data: cols, error: e } = await supabase
        .rpc('nomes_colaboradores', { p_ids: ids });
      if (e) throw e;
      nomePorId = Object.fromEntries((cols || []).map((c) => [c.id, c.nome]));
    }
    return { ids, nomePorId };
  }, [user]);
```

- [ ] **Step 3: Passar `tipo` nos dois chamadores de `resolverCadeia`**

Em `criarComFluxo` (~linha 67):

```js
    const { ids, nomePorId } = await resolverCadeia(tipo);
```

Em `criarComDetalhe` (~linha 89):

```js
    const { ids, nomePorId } = cadeia || await resolverCadeia(tipo);
```

- [ ] **Step 4: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos; `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Gestor/requisicoes/useRequisicaoForm.js
git commit -m "feat: resolverCadeia resolve o fluxo do tipo da requisicao"
```

---

### Task 5: `FormMapeamento` usa o fluxo configurado de `mapeamento`

**Files:**
- Modify: `src/pages/Gestor/requisicoes/FormMapeamento.jsx`

**Interfaces:**
- Consumes: `criarComDetalhe` (Task 4) — sem o override `cadeia`, ele resolve via `resolverCadeia('mapeamento')`.

- [ ] **Step 1: Remover o override `cadeia` hardcoded**

Na chamada de `criarComDetalhe` (~linha 88-101), remover a linha do `cadeia` (e o comentário acima dela):

```jsx
        await criarComDetalhe({
          tipo: 'mapeamento',
          justificativa,
          tabela: 'mapeamentos',
          detalhe: { ...payload, anexo_path: anexoPath, anexo_nome: anexo ? anexo.name : null },
        });
```

- [ ] **Step 2: Remover import não usado de `APROVADOR_MAPEAMENTO` (se ficar órfão)**

Conferir no topo do arquivo se `APROVADOR_MAPEAMENTO` ainda é usado. Se não, removê-lo do import de `../../../config/aprovacao` para o lint não acusar variável não usada.

- [ ] **Step 3: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos; `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Gestor/requisicoes/FormMapeamento.jsx
git commit -m "feat: Mapeamento usa o fluxo configurado do tipo (default Lucas Ferraz)"
```

---

### Task 6: `AdminFluxos` — chips por tipo

**Files:**
- Modify: `src/pages/Admin/AdminFluxos.jsx`

**Interfaces:**
- Consumes: `TIPOS_FLUXO`, `TIPO_LABEL_CURTO`, `APROVADOR_MAPEAMENTO`, `FLUXO_GERAL` de `../../config/aprovacao`.

- [ ] **Step 1: Importar tipos/rótulos e adicionar estado de tipo selecionado**

No import (~linha 7):

```js
import { FLUXO_GERAL, normIniciativa, TIPOS_FLUXO, TIPO_LABEL_CURTO, APROVADOR_MAPEAMENTO } from '../../config/aprovacao';
```

Adicionar estado (~junto aos demais `useState`):

```js
  const [tipoSel, setTipoSel] = useState('aumento_salario');
```

- [ ] **Step 2: Helper para achar a linha de um (gestor, tipo) e o default de pré-preenchimento**

Adicionar abaixo dos helpers existentes:

```js
  // Linha salva de (gestor, tipo). iniciativa sempre ''.
  const linhaDe = (gid, tipo) =>
    fluxos.find((x) => x.solicitante_id === gid && x.tipo === tipo && normIniciativa(x.iniciativa) === '');

  // Cadeia salva ou pré-preenchimento (mapeamento → Lucas; demais → fluxo geral).
  const cadeiaInicial = (gid, tipo) => {
    const linha = linhaDe(gid, tipo);
    if (linha) return Array.isArray(linha.aprovadores) ? [...linha.aprovadores] : [];
    if (tipo === 'mapeamento') return [APROVADOR_MAPEAMENTO.id];
    const geral = linhaDe(gid, FLUXO_GERAL.tipo);
    return Array.isArray(geral?.aprovadores) ? [...geral.aprovadores] : [];
  };

  const configuradoTipo = (gid, tipo) => !!linhaDe(gid, tipo);
```

- [ ] **Step 3: Carregar a cadeia quando gestor OU tipo mudam**

Substituir o `useEffect` que hoje carrega a cadeia (~linhas 47-51):

```js
  useEffect(() => {
    if (!solicitanteId) { setCadeia([]); return; }
    setCadeia(cadeiaInicial(solicitanteId, tipoSel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitanteId, tipoSel, fluxos]);
```

E remover a função `ehFluxoGeral` e o `configurado` antigo (substituídos por `linhaDe`/`configuradoTipo`); o indicador ✅/⚠️ do select de gestor passa a refletir "tem ao menos o fluxo geral": trocar `configurado(g.id)` por `configuradoTipo(g.id, FLUXO_GERAL.tipo)`.

- [ ] **Step 4: Renderizar a faixa de chips por tipo (entre o seletor de gestor e o card do fluxo)**

Logo após o bloco `{solicitanteId && (` e ANTES do `fluxo-card`, inserir:

```jsx
              <div className="filter-chips" style={{ marginBottom: 'var(--space-lg)' }}>
                {TIPOS_FLUXO.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`filter-chip ${tipoSel === t ? 'active' : ''}`}
                    onClick={() => setTipoSel(t)}
                  >
                    {configuradoTipo(solicitanteId, t) ? '✅' : '⚠️'} {TIPO_LABEL_CURTO[t]}
                  </button>
                ))}
              </div>
```

E no título do card (`fluxo-card-title`), refletir o tipo: `Fluxo de aprovação — {TIPO_LABEL_CURTO[tipoSel]}`.

- [ ] **Step 5: `salvar` grava a linha do tipo selecionado**

No `salvar` (~linha 70), trocar `tipo: FLUXO_GERAL.tipo` e a mensagem:

```js
        .upsert(
          {
            solicitante_id: solicitanteId,
            tipo: tipoSel,
            iniciativa: '',
            aprovadores,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'solicitante_id,tipo,iniciativa' }
        );
      if (error) throw error;
      setSucesso(`Fluxo salvo: ${TIPO_LABEL_CURTO[tipoSel]} — ${solicitante?.nome || ''}`);
```

- [ ] **Step 6: Atualizar o subtítulo da página**

```jsx
      <p className="page-subtitle">
        Monte a cadeia de aprovação de cada gestor por tipo de requisição. Cada fluxo parte do
        gestor, passa por cada aprovador na ordem e termina sempre na execução do Admin (DP).
      </p>
```

- [ ] **Step 7: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos; `✓ built`.

- [ ] **Step 8: Verificação manual**

`npm run dev` como admin → Fluxos. Selecionar um gestor; clicar entre os chips de tipo muda a cadeia exibida; todos vêm pré-preenchidos; editar e salvar um tipo não muda os outros chips; Mapeamento mostra Lucas Ferraz.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Admin/AdminFluxos.jsx
git commit -m "feat: AdminFluxos edita um fluxo de aprovacao por tipo de requisicao"
```

---

### Task 7: Seed dos fluxos por tipo (migration de dados)

**Files:**
- Create: `supabase_migration_seed_fluxos_por_tipo.sql`
- Apply: via `apply_migration` (MCP) no projeto `bogsuuhrgvopzgcceoqz`.

**Interfaces:**
- Consumes: linhas existentes `solicitacoes_rh_fluxos` com `tipo='aumento_salario', iniciativa=''` (hoje 21).

- [ ] **Step 1: Escrever o arquivo de migration (idempotente)**

`supabase_migration_seed_fluxos_por_tipo.sql`:

```sql
-- ============================================================================
-- Seed: um fluxo de aprovação por tipo, a partir do fluxo geral atual
-- (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Para cada gestor que já tem o fluxo geral (tipo='aumento_salario', iniciativa=''),
-- cria os fluxos dos outros 4 tipos copiando a mesma cadeia, e o de 'mapeamento'
-- com Lucas Ferraz (mantém o comportamento de hoje). Idempotente: DO NOTHING.
-- ('aumento_salario' já É o fluxo geral, não precisa de cópia.)
-- ============================================================================

insert into public.solicitacoes_rh_fluxos (solicitante_id, tipo, iniciativa, aprovadores)
select g.solicitante_id, t.tipo, '', g.aprovadores
from public.solicitacoes_rh_fluxos g
cross join (values ('desligamento'), ('formulario_contratacao'), ('ajuda_custo'), ('nova_vaga')) as t(tipo)
where g.tipo = 'aumento_salario' and g.iniciativa = ''
on conflict (solicitante_id, tipo, iniciativa) do nothing;

insert into public.solicitacoes_rh_fluxos (solicitante_id, tipo, iniciativa, aprovadores)
select g.solicitante_id, 'mapeamento', '', '["554ec9c1-c4fb-4b5a-b4a6-040c835acca5"]'::jsonb
from public.solicitacoes_rh_fluxos g
where g.tipo = 'aumento_salario' and g.iniciativa = ''
on conflict (solicitante_id, tipo, iniciativa) do nothing;
```

- [ ] **Step 2: Aplicar a migration**

Via MCP `apply_migration` (project `bogsuuhrgvopzgcceoqz`, name `seed_fluxos_por_tipo`) com o SQL acima.

- [ ] **Step 3: Verificar a contagem por tipo**

Via MCP `execute_sql`:

```sql
select tipo, count(*) from public.solicitacoes_rh_fluxos group by tipo order by tipo;
```

Expected: 6 tipos, cada um com 21 linhas (`aumento_salario` 21 pré-existente; `desligamento`, `formulario_contratacao`, `ajuda_custo`, `nova_vaga`, `mapeamento` com 21 cada). Conferir também que uma amostra de `mapeamento` tem `aprovadores = ["554ec9c1-..."]`.

- [ ] **Step 4: Commit do arquivo de migration**

```bash
git add supabase_migration_seed_fluxos_por_tipo.sql
git commit -m "chore: seed de fluxos de aprovacao por tipo (copia do geral + mapeamento=Lucas)"
```

---

## Verificação final (end-to-end)

- [ ] Como gestor, criar uma **Ajuda de Custo** e uma **Nova Vaga**: criam sem o erro "Aprovador sem nome resolvido", com etapas geradas (conferir `solicitacoes_rh_etapas` populada).
- [ ] Como gestor, criar um **Mapeamento**: vai para Lucas Ferraz.
- [ ] Como admin em Fluxos, alterar o fluxo de **Nova Vaga** de um gestor e salvar; reabrir os chips e confirmar que **só** Nova Vaga mudou.
- [ ] `npm run build` final ✓.

## Notas de self-review

- **Cobertura do spec:** Parte 1 → Tasks 1-2; Parte 2 (config) → Task 3; (consumo) → Tasks 4-5; (UI) → Task 6; (seed) → Task 7. Sem lacunas.
- **Sem placeholders:** todo passo de código mostra o código real.
- **Consistência de tipos:** `buscarFluxoPorTipo(supabase, solicitanteId, tipo) → { fluxo, erro }` consumido em `resolverCadeia(tipo)`; `linhaDe/cadeiaInicial/configuradoTipo` usados consistentemente no AdminFluxos.
- **Atenção (executor):** `resolverCadeia` mudou de `()` para `(tipo)` — garantir que TODOS os chamadores passam `tipo` (Task 4 cobre `criarComFluxo` e `criarComDetalhe`; nenhum outro chama `resolverCadeia`).
