# Requisições DP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar "Solicitações DP" em "Requisições DP", trocando a UI de abas por um hub em grade de cards (estilo `imagedp.png`), onde cada card abre uma requisição em rota própria.

**Architecture:** Um registro único (`src/config/requisicoes.js`) descreve as 6 requisições. Um hub renderiza os cards; uma rota `/nova/:tipo` resolve o slug e renderiza o formulário pronto ou um placeholder "Em construção". O componente monolítico `GestorSolicitacoes.jsx` (573 linhas) é dividido em hub, container, formulários, hook compartilhado e a lista de acompanhamento.

**Tech Stack:** React 19, react-router-dom 7 (HashRouter), Vite 8, Supabase JS, lucide-react, Vanilla CSS (sem Tailwind).

**Notas de ambiente:**
- **Sem framework de testes** no projeto (só ESLint + Vite build). Verificação de cada task = `npm run lint` e `npm run build` (pegam imports quebrados, vars não definidas, erros de hook/JSX), mais checagem visual no `npm run dev` quando indicado.
- **O repositório git abrange a pasta home inteira.** NUNCA use `git add -A` / `git add .`. Sempre `git add -- <caminho exato dos arquivos>`.
- Todos os caminhos de commit abaixo já são relativos à raiz do repo (`Downloads/Phd/App Dp/...`). Execute os comandos `npm`/`git` a partir de `C:\Users\LennonSantos\Downloads\Phd\App Dp`.
- Mensagens de commit devem terminar com a linha `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

**Criar:**
- `src/config/requisicoes.js` — registro das 6 requisições (slug, label, icon, status, tipoDb).
- `src/pages/Gestor/requisicoes/useRequisicaoForm.js` — hook: equipe, pré-checagem de fluxo, `criarComFluxo`.
- `src/pages/Gestor/requisicoes/RequisicoesHub.jsx` — grade de cards.
- `src/pages/Gestor/requisicoes/Requisicoes.css` — estilos do hub/cards.
- `src/pages/Gestor/requisicoes/NovaRequisicao.jsx` — container da rota `:tipo`.
- `src/pages/Gestor/requisicoes/FormAlteracao.jsx` — form de alteração (ex-`aumento_salario`).
- `src/pages/Gestor/requisicoes/FormDesligamento.jsx` — form de desligamento.
- `src/pages/Gestor/requisicoes/EmConstrucao.jsx` — placeholder.
- `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx` — lista/aprovação (extraída).

**Modificar:**
- `src/components/Layout/Sidebar.jsx` — renomear labels.
- `src/config/aprovacao.js` — renomear `TIPO_LABEL.aumento_salario`.
- `src/pages/Admin/AdminSolicitacoes.jsx` — renomear título.
- `src/routes/AppRoutes.jsx` — novas rotas + imports.

**Excluir:**
- `src/pages/Gestor/GestorSolicitacoes.jsx` — substituído pela nova estrutura.

---

## Task 1: Renomeações de label (display)

**Files:**
- Modify: `src/components/Layout/Sidebar.jsx:25,45,48`
- Modify: `src/config/aprovacao.js:21`
- Modify: `src/pages/Admin/AdminSolicitacoes.jsx:252`

- [ ] **Step 1: Sidebar — link admin (linha 25)**

Trocar:
```jsx
    { label: 'Solicitações DP', icon: FileText, path: '/admin/solicitacoes', solicitacaoBadge: true },
```
por:
```jsx
    { label: 'Requisições DP', icon: FileText, path: '/admin/solicitacoes', solicitacaoBadge: true },
```

- [ ] **Step 2: Sidebar — grupo gestor (linha 45) e filho (linha 48)**

Trocar:
```jsx
      label: 'Solicitações DP',
```
por:
```jsx
      label: 'Requisições DP',
```
e trocar:
```jsx
        { label: 'Nova solicitação', icon: PlusCircle, path: '/gestor/solicitacoes/nova' },
```
por:
```jsx
        { label: 'Nova requisição', icon: PlusCircle, path: '/gestor/solicitacoes/nova' },
```

- [ ] **Step 3: aprovacao.js — label do tipo (linha 21)**

Trocar:
```js
  aumento_salario: 'Alteração de Retirada de dividendos / prestação de serviço',
```
por:
```js
  aumento_salario: 'Alteração de Retirada de dividendo, cargo e função',
```
(A chave `aumento_salario` e o `CASOS_FLUXO` que referencia `TIPO_LABEL.aumento_salario` são atualizados automaticamente. Não mexer no valor de banco.)

- [ ] **Step 4: AdminSolicitacoes — título (linha 252)**

Trocar:
```jsx
      <h1 className="page-title"><FileText size={28} /> Solicitações DP</h1>
```
por:
```jsx
      <h1 className="page-title"><FileText size={28} /> Requisições DP</h1>
```

- [ ] **Step 5: Verificar lint**

Run: `npm run lint`
Expected: sem novos erros.

- [ ] **Step 6: Commit**

```bash
git add -- "src/components/Layout/Sidebar.jsx" "src/config/aprovacao.js" "src/pages/Admin/AdminSolicitacoes.jsx"
git commit -m "feat: renomeia Solicitacoes DP para Requisicoes DP (labels)"
```

---

## Task 2: Registro de requisições

**Files:**
- Create: `src/config/requisicoes.js`

- [ ] **Step 1: Criar o registro**

```jsx
import { FileText, UserMinus, UserCheck, TrendingUp, UserPlus, ArrowRight } from 'lucide-react';

/**
 * Fonte única das requisições do gestor.
 * - slug: usado na URL /gestor/solicitacoes/nova/:slug
 * - status: 'pronto' (tem formulário) | 'em_breve' (abre placeholder)
 * - tipoDb: valor da coluna `tipo` em solicitacoes_rh (só p/ requisições prontas)
 */
export const REQUISICOES = [
  { slug: 'requisicao-geral', label: 'Requisição geral', icon: FileText, status: 'em_breve' },
  { slug: 'desligamento', label: 'Desligamento', icon: UserMinus, status: 'pronto', tipoDb: 'desligamento' },
  { slug: 'substituicao', label: 'Substituição', icon: UserCheck, status: 'em_breve' },
  { slug: 'alteracao', label: 'Alteração de Retirada de dividendo, cargo e função', icon: TrendingUp, status: 'pronto', tipoDb: 'aumento_salario' },
  { slug: 'aumento-quadro', label: 'Aumento de quadro', icon: UserPlus, status: 'em_breve' },
  { slug: 'transferencia', label: 'Transferência', icon: ArrowRight, status: 'em_breve' },
];

export const getRequisicao = (slug) => REQUISICOES.find((r) => r.slug === slug);
```
(Ícones escolhidos entre os já usados no projeto para evitar import inexistente. Podem ser trocados depois sem impacto estrutural.)

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sem erros (sem imports não usados).

- [ ] **Step 3: Commit**

```bash
git add -- "src/config/requisicoes.js"
git commit -m "feat: adiciona registro de requisicoes DP"
```

---

## Task 3: Hook compartilhado `useRequisicaoForm`

**Files:**
- Create: `src/pages/Gestor/requisicoes/useRequisicaoForm.js`

- [ ] **Step 1: Criar o hook (extrai a lógica de criação do componente antigo)**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { buscarFluxo, montarEtapasDeConfig } from '../../../config/aprovacao';

// Casos (tipo+iniciativa) cuja existência de fluxo precisamos pré-checar.
const CASOS = [
  ['aumento_salario', ''],
  ['desligamento', 'empresa'],
  ['desligamento', 'empregado'],
];

/**
 * Lógica compartilhada entre os formulários de requisição:
 * carrega a equipe do gestor, pré-checa se o admin configurou o fluxo de cada
 * caso, e cria a solicitação + etapas de forma atômica (delete compensatório).
 */
export function useRequisicaoForm() {
  const { user } = useAuth();
  const [equipe, setEquipe] = useState([]);
  const [loadingEquipe, setLoadingEquipe] = useState(true);
  const [fluxoOk, setFluxoOk] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    (async () => {
      setLoadingEquipe(true);
      const { data } = await supabase
        .from('colaboradores')
        .select('id, nome, funcao, salario')
        .eq('superior_id', user.id)
        .eq('ativo', true)
        .order('nome');
      if (vivo) { setEquipe(data || []); setLoadingEquipe(false); }
    })();
    return () => { vivo = false; };
  }, [user]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    (async () => {
      const res = {};
      for (const [tipo, ini] of CASOS) {
        const { fluxo, erro } = await buscarFluxo(supabase, user.id, tipo, ini);
        // Em erro de rede, não bloqueia (assume desconhecido = true).
        res[`${tipo}::${ini}`] = erro ? true : !!fluxo;
      }
      if (vivo) setFluxoOk(res);
    })();
    return () => { vivo = false; };
  }, [user, bump]);

  const refetchFluxo = useCallback(() => setBump((b) => b + 1), []);

  const criarComFluxo = useCallback(async (tipo, iniciativa, dadosSolicitacao) => {
    const { fluxo, erro } = await buscarFluxo(supabase, user.id, tipo, iniciativa);
    if (erro) throw new Error('Erro ao consultar o fluxo de aprovação. Tente novamente.');
    if (!fluxo) throw new Error('SEM_FLUXO');

    const ids = (Array.isArray(fluxo.aprovadores) ? fluxo.aprovadores : [])
      .map((x) => (x || '').trim()).filter(Boolean);

    let nomePorId = {};
    if (ids.length) {
      const { data: cols, error: e } = await supabase
        .from('colaboradores').select('id, nome').in('id', ids);
      if (e) throw e;
      nomePorId = Object.fromEntries((cols || []).map((c) => [c.id, c.nome]));
    }

    const { data: sol, error: eSol } = await supabase
      .from('solicitacoes_rh').insert([dadosSolicitacao]).select('id').single();
    if (eSol) throw eSol;

    try {
      const linhas = montarEtapasDeConfig(sol.id, ids, user.id, nomePorId);
      const { error: eEt } = await supabase.from('solicitacoes_rh_etapas').insert(linhas);
      if (eEt) throw eEt;
    } catch (err) {
      await supabase.from('solicitacoes_rh').delete().eq('id', sol.id);
      throw err;
    }
    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    return sol.id;
  }, [user]);

  return { user, equipe, loadingEquipe, fluxoOk, submitting, setSubmitting, criarComFluxo, refetchFluxo };
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sem erros (sem violações de react-hooks/exhaustive-deps novas).

- [ ] **Step 3: Commit**

```bash
git add -- "src/pages/Gestor/requisicoes/useRequisicaoForm.js"
git commit -m "feat: hook useRequisicaoForm com logica de criacao compartilhada"
```

---

## Task 4: Formulário de Alteração

**Files:**
- Create: `src/pages/Gestor/requisicoes/FormAlteracao.jsx`

- [ ] **Step 1: Criar o componente (form ex-`aumento_salario`)**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Loader2, User, Check, ArrowRight, AlertTriangle } from 'lucide-react';
import { formatarMoeda } from '../../../utils/formatters';
import { useRequisicaoForm } from './useRequisicaoForm';
import '../../../components/UI/Components.css';
import '../Gestor.css';

export default function FormAlteracao() {
  const navigate = useNavigate();
  const { user, equipe, loadingEquipe, fluxoOk, submitting, setSubmitting, criarComFluxo, refetchFluxo } = useRequisicaoForm();
  const [form, setForm] = useState({ colaborador_id: '', salario_proposto: '', justificativa: '' });
  const [colSel, setColSel] = useState(null);
  const [sucesso, setSucesso] = useState(null);

  const semFluxo = fluxoOk['aumento_salario::'] === false;

  const onColab = (e) => {
    const id = e.target.value;
    setColSel(equipe.find((c) => c.id === id) || null);
    setForm((p) => ({ ...p, colaborador_id: id, salario_proposto: '' }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.colaborador_id || !form.salario_proposto || !form.justificativa) return;
    setSubmitting(true);
    try {
      const novoId = await criarComFluxo('aumento_salario', '', {
        tipo: 'aumento_salario',
        gestor_id: user.id,
        colaborador_id: form.colaborador_id,
        salario_proposto: Number(form.salario_proposto),
        justificativa: form.justificativa,
        status: 'pendente',
      });
      setForm({ colaborador_id: '', salario_proposto: '', justificativa: '' });
      setColSel(null);
      setSucesso({ texto: 'Requisição enviada com sucesso!', id: novoId });
      refetchFluxo();
    } catch (err) {
      console.error(err);
      if (err.message === 'SEM_FLUXO') {
        alert('O administrador ainda não configurou o fluxo de aprovação para você neste tipo de requisição. Solicite a configuração ao DP.');
      } else {
        alert(err.message || 'Erro ao enviar requisição. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {sucesso && (
        <div className="success-msg" style={{ marginBottom: 'var(--space-lg)' }}>
          <Check size={16} /> {sucesso.texto}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'inherit' }}
            onClick={() => navigate('/gestor/solicitacoes/acompanhar')}>
            Ver andamento <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title"><TrendingUp size={18} /> Alteração de Retirada de dividendo, cargo e função</div>
          {semFluxo && (
            <span className="badge inativo" title="Fluxo de aprovação não configurado">
              <AlertTriangle size={13} /> Fluxo não configurado
            </span>
          )}
        </div>

        <form onSubmit={onSubmit} style={{ padding: 'var(--space-xl)' }}>
          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Colaborador <span className="required">*</span></label>
            {loadingEquipe ? <div>Carregando...</div> : (
              <select className="form-select" value={form.colaborador_id} onChange={onColab} required>
                <option value="">Selecione o colaborador...</option>
                {equipe.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — {c.funcao || 'Sem função'}</option>
                ))}
              </select>
            )}
          </div>

          {colSel && (
            <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={16} color="var(--color-text-muted)" />
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Valor atual: <strong>{formatarMoeda(colSel.salario)}</strong>
              </span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Novo valor (R$) <span className="required">*</span></label>
            <input className="form-input" type="number" min="0" step="0.01" placeholder="Ex: 9500.00"
              value={form.salario_proposto}
              onChange={(e) => setForm((p) => ({ ...p, salario_proposto: e.target.value }))}
              required />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Justificativa <span className="required">*</span></label>
            <textarea className="form-input" rows={4} style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Descreva os motivos da requisição..."
              value={form.justificativa}
              onChange={(e) => setForm((p) => ({ ...p, justificativa: e.target.value }))}
              required />
          </div>

          {semFluxo && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-md)' }}>
              O administrador ainda não configurou o fluxo de aprovação deste tipo para você. Solicite a configuração ao DP.
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={submitting || semFluxo} style={{ width: '100%' }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
            {submitting ? 'Enviando...' : 'Enviar Requisição'}
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add -- "src/pages/Gestor/requisicoes/FormAlteracao.jsx"
git commit -m "feat: FormAlteracao (requisicao de alteracao)"
```

---

## Task 5: Formulário de Desligamento

**Files:**
- Create: `src/pages/Gestor/requisicoes/FormDesligamento.jsx`

- [ ] **Step 1: Criar o componente (form de desligamento)**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserMinus, Loader2, Check, ArrowRight, Building2, UserCheck } from 'lucide-react';
import { useRequisicaoForm } from './useRequisicaoForm';
import { INICIATIVA_LABEL } from '../../../config/aprovacao';
import '../../../components/UI/Components.css';
import '../Gestor.css';

export default function FormDesligamento() {
  const navigate = useNavigate();
  const { user, equipe, loadingEquipe, fluxoOk, submitting, setSubmitting, criarComFluxo, refetchFluxo } = useRequisicaoForm();
  const [form, setForm] = useState({ colaborador_id: '', justificativa: '', data_desligamento: '', iniciativa: '' });
  const [sucesso, setSucesso] = useState(null);

  const semFluxo = form.iniciativa && fluxoOk[`desligamento::${form.iniciativa}`] === false;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.colaborador_id || !form.justificativa || !form.data_desligamento || !form.iniciativa) return;
    setSubmitting(true);

    let dataFormatada = form.data_desligamento;
    if (dataFormatada.includes('-')) {
      const [ano, mes, dia] = dataFormatada.split('-');
      dataFormatada = `${dia}/${mes}/${ano}`;
    }
    const justificativaComData = `Data solicitada para desligamento: ${dataFormatada}\n\nJustificativa: ${form.justificativa}`;

    try {
      const novoId = await criarComFluxo('desligamento', form.iniciativa, {
        tipo: 'desligamento',
        iniciativa: form.iniciativa,
        gestor_id: user.id,
        colaborador_id: form.colaborador_id,
        justificativa: justificativaComData,
        status: 'pendente',
      });
      setForm({ colaborador_id: '', justificativa: '', data_desligamento: '', iniciativa: '' });
      setSucesso({ texto: 'Requisição de desligamento enviada com sucesso!', id: novoId });
      refetchFluxo();
    } catch (err) {
      console.error(err);
      if (err.message === 'SEM_FLUXO') {
        alert('O administrador ainda não configurou o fluxo de aprovação deste tipo de desligamento para você. Solicite a configuração ao DP.');
      } else {
        alert(err.message || 'Erro ao enviar requisição. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {sucesso && (
        <div className="success-msg" style={{ marginBottom: 'var(--space-lg)' }}>
          <Check size={16} /> {sucesso.texto}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'inherit' }}
            onClick={() => navigate('/gestor/solicitacoes/acompanhar')}>
            Ver andamento <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title"><UserMinus size={18} /> Nova requisição de desligamento</div>
        </div>

        <form onSubmit={onSubmit} style={{ padding: 'var(--space-xl)' }}>
          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Colaborador a ser desligado <span className="required">*</span></label>
            {loadingEquipe ? <div>Carregando...</div> : (
              <select className="form-select" value={form.colaborador_id}
                onChange={(e) => setForm((p) => ({ ...p, colaborador_id: e.target.value }))} required>
                <option value="">Selecione o colaborador...</option>
                {equipe.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — {c.funcao || 'Sem função'}</option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Iniciativa <span className="required">*</span></label>
            <div className="iniciativa-options">
              <button type="button"
                className={`iniciativa-option ${form.iniciativa === 'empresa' ? 'active' : ''}`}
                onClick={() => setForm((p) => ({ ...p, iniciativa: 'empresa' }))}>
                <Building2 size={18} />
                <span>{INICIATIVA_LABEL.empresa}</span>
              </button>
              <button type="button"
                className={`iniciativa-option ${form.iniciativa === 'empregado' ? 'active' : ''}`}
                onClick={() => setForm((p) => ({ ...p, iniciativa: 'empregado' }))}>
                <UserCheck size={18} />
                <span>{INICIATIVA_LABEL.empregado}</span>
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Data do Desligamento <span className="required">*</span></label>
            <input className="form-input" type="date"
              value={form.data_desligamento}
              onChange={(e) => setForm((p) => ({ ...p, data_desligamento: e.target.value }))}
              required />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Justificativa <span className="required">*</span></label>
            <textarea className="form-input" rows={4} style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Descreva os motivos do desligamento..."
              value={form.justificativa}
              onChange={(e) => setForm((p) => ({ ...p, justificativa: e.target.value }))}
              required />
          </div>

          {semFluxo && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-md)' }}>
              O administrador ainda não configurou o fluxo de aprovação deste tipo de desligamento para você. Solicite a configuração ao DP.
            </div>
          )}
          <button className="btn btn-danger" type="submit" disabled={submitting || semFluxo} style={{ width: '100%' }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />}
            {submitting ? 'Enviando...' : 'Enviar Requisição de Desligamento'}
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add -- "src/pages/Gestor/requisicoes/FormDesligamento.jsx"
git commit -m "feat: FormDesligamento (requisicao de desligamento)"
```

---

## Task 6: Placeholder "Em construção"

**Files:**
- Create: `src/pages/Gestor/requisicoes/EmConstrucao.jsx`

- [ ] **Step 1: Criar o placeholder**

```jsx
import { AlertTriangle } from 'lucide-react';
import '../Gestor.css';

export default function EmConstrucao({ label }) {
  return (
    <div className="table-container">
      <div className="table-empty" style={{ padding: 'var(--space-3xl)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
        <AlertTriangle size={40} color="var(--color-text-muted)" />
        <div>
          <strong>{label}</strong> está em construção.
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Esta requisição ainda não está disponível. Em breve.
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add -- "src/pages/Gestor/requisicoes/EmConstrucao.jsx"
git commit -m "feat: placeholder EmConstrucao para requisicoes futuras"
```

---

## Task 7: Container `NovaRequisicao`

**Files:**
- Create: `src/pages/Gestor/requisicoes/NovaRequisicao.jsx`

- [ ] **Step 1: Criar o container que resolve o slug**

```jsx
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getRequisicao } from '../../../config/requisicoes';
import FormDesligamento from './FormDesligamento';
import FormAlteracao from './FormAlteracao';
import EmConstrucao from './EmConstrucao';
import '../Gestor.css';

// Mapeia slug -> componente de formulário (apenas requisições 'pronto').
const FORMS = {
  desligamento: FormDesligamento,
  alteracao: FormAlteracao,
};

export default function NovaRequisicao() {
  const { tipo } = useParams();
  const navigate = useNavigate();
  const req = getRequisicao(tipo);

  // Slug inexistente: volta ao hub.
  if (!req) return <Navigate to="/gestor/solicitacoes/nova" replace />;

  const Form = req.status === 'pronto' ? FORMS[req.slug] : null;
  const Icon = req.icon;

  return (
    <div className="gestor-page animate-fade-in-up">
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-md)' }}
        onClick={() => navigate('/gestor/solicitacoes/nova')}>
        <ArrowLeft size={16} /> Voltar para requisições
      </button>
      <h1 className="page-title"><Icon size={28} /> {req.label}</h1>
      {Form ? <Form /> : <EmConstrucao label={req.label} />}
    </div>
  );
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add -- "src/pages/Gestor/requisicoes/NovaRequisicao.jsx"
git commit -m "feat: container NovaRequisicao resolve slug -> form/placeholder"
```

---

## Task 8: Hub em grade de cards + CSS

**Files:**
- Create: `src/pages/Gestor/requisicoes/RequisicoesHub.jsx`
- Create: `src/pages/Gestor/requisicoes/Requisicoes.css`

- [ ] **Step 1: Criar o CSS dos cards**

(Usa fallbacks em `var(--token, fallback)` para tokens menos garantidos: `--color-primary`, `--color-text-primary`, `--shadow-card-hover`.)

```css
.requisicoes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
  margin-top: var(--space-lg);
}

.requisicao-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-lg);
  min-height: 130px;
  padding: var(--space-lg);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-normal);
}

.requisicao-card:hover {
  border-color: var(--color-primary, #1d4ed8);
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover, var(--shadow-card));
}

.requisicao-card-icon {
  color: var(--color-primary, #1d4ed8);
}

.requisicao-card-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text-primary, var(--color-text-secondary));
}

.requisicao-card-badge {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  background: var(--color-bg-subtle);
  padding: 2px 8px;
  border-radius: 999px;
}

@media (max-width: 600px) {
  .requisicoes-grid {
    grid-template-columns: 1fr 1fr;
  }
}
```

- [ ] **Step 2: Criar o hub**

```jsx
import { useNavigate } from 'react-router-dom';
import { REQUISICOES } from '../../../config/requisicoes';
import '../Gestor.css';
import './Requisicoes.css';

export default function RequisicoesHub() {
  const navigate = useNavigate();

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title">Requisições disponíveis</h1>
      <p className="page-subtitle">Selecione o tipo de requisição que deseja abrir.</p>

      <div className="requisicoes-grid">
        {REQUISICOES.map((r) => {
          const Icon = r.icon;
          return (
            <button key={r.slug} type="button" className="requisicao-card"
              onClick={() => navigate(`/gestor/solicitacoes/nova/${r.slug}`)}>
              <Icon size={26} className="requisicao-card-icon" />
              <span className="requisicao-card-label">{r.label}</span>
              {r.status === 'em_breve' && <span className="requisicao-card-badge">Em breve</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add -- "src/pages/Gestor/requisicoes/RequisicoesHub.jsx" "src/pages/Gestor/requisicoes/Requisicoes.css"
git commit -m "feat: hub de requisicoes em grade de cards"
```

---

## Task 9: Lista de acompanhamento/aprovação (extração)

**Files:**
- Create: `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`

- [ ] **Step 1: Criar o componente (extrai o modo `acompanhar` do antigo `GestorSolicitacoes`)**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { formatarMoeda, parseDesligamento } from '../../../utils/formatters';
import { Check, X, Loader2, ClipboardCheck } from 'lucide-react';
import FluxoTimeline from '../../../components/Solicitacoes/FluxoTimeline';
import {
  etapaAtual, acaoDisponivel, resumoAndamento,
  INICIATIVA_LABEL, TIPO_LABEL,
} from '../../../config/aprovacao';
import '../../../components/UI/Components.css';
import '../Gestor.css';

const TOM_BADGE = {
  pendente: { label: 'Em andamento', badge: 'pendente' },
  concluida: { label: 'Concluída', badge: 'aprovada' },
  reprovada: { label: 'Reprovada', badge: 'inativo' },
};

const SELECT_SOL = `
  id, tipo, status, iniciativa, gestor_id, colaborador_id, justificativa, salario_proposto, created_at,
  colaborador:colaborador_id ( nome, funcao, salario ),
  gestor:gestor_id ( nome ),
  etapas:solicitacoes_rh_etapas ( id, ordem, aprovador_id, papel, tipo_etapa, status, justificativa, decidido_em )
`;

export default function AcompanharRequisicoes() {
  const { user } = useAuth();
  const [participa, setParticipa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acaoId, setAcaoId] = useState(null);
  const [reprovarSol, setReprovarSol] = useState(null);
  const [reprovarTexto, setReprovarTexto] = useState('');

  const fetchParticipa = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('solicitacoes_rh')
      .select(SELECT_SOL)
      .order('created_at', { ascending: false });
    const minhas = (data || []).filter(
      (s) => s.gestor_id === user.id || (s.etapas || []).some((e) => e.aprovador_id === user.id)
    );
    setParticipa(minhas);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchParticipa(); }, [fetchParticipa]);

  const aprovar = async (sol) => {
    const atual = etapaAtual(sol.etapas);
    if (!atual) return;
    setAcaoId(sol.id);
    try {
      const { data, error } = await supabase
        .from('solicitacoes_rh_etapas')
        .update({ status: 'aprovada', decidido_em: new Date().toISOString() })
        .eq('id', atual.id)
        .eq('aprovador_id', user.id)
        .eq('status', 'pendente')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Esta etapa já foi tratada por outra pessoa. A lista será atualizada.');
      }
      await fetchParticipa();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert('Erro ao aprovar. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  const confirmarReprovar = async () => {
    if (!reprovarSol || !reprovarTexto.trim()) return;
    const atual = etapaAtual(reprovarSol.etapas);
    if (!atual) return;
    setAcaoId(reprovarSol.id);
    try {
      const agora = new Date().toISOString();
      const { data, error: e1 } = await supabase
        .from('solicitacoes_rh_etapas')
        .update({ status: 'reprovada', justificativa: reprovarTexto.trim(), decidido_em: agora })
        .eq('id', atual.id)
        .eq('aprovador_id', user.id)
        .eq('status', 'pendente')
        .select('id');
      if (e1) throw e1;
      if (!data || data.length === 0) {
        alert('Esta etapa já foi tratada por outra pessoa. A lista será atualizada.');
        setReprovarSol(null);
        setReprovarTexto('');
        await fetchParticipa();
        return;
      }
      const { error: e2 } = await supabase
        .from('solicitacoes_rh')
        .update({ status: 'reprovada', updated_at: agora })
        .eq('id', reprovarSol.id);
      if (e2) throw e2;
      setReprovarSol(null);
      setReprovarTexto('');
      await fetchParticipa();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert('Erro ao reprovar. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title"><ClipboardCheck size={28} /> Aprovar / Acompanhar</h1>
      <p className="page-subtitle">Requisições que você criou ou nas quais participa da cadeia de aprovação.</p>

      <div className="table-container" style={{ marginTop: 'var(--space-md)' }}>
        <div className="table-header">
          <div className="table-header-title"><ClipboardCheck size={16} /> Requisições que você participa</div>
        </div>
        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>Carregando...</div>
        ) : participa.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhuma requisição para acompanhar.</div>
        ) : (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {participa.map((s) => {
              const resumo = resumoAndamento(s, s.etapas);
              const tomB = TOM_BADGE[resumo.tom] || TOM_BADGE.pendente;
              const podeAprovar = acaoDisponivel(user?.id, s.etapas) === 'aprovacao';
              const det = s.tipo === 'desligamento' ? parseDesligamento(s.justificativa) : { data: null, texto: s.justificativa };
              return (
                <div key={s.id} className="sol-card">
                  <div className="sol-card-top">
                    <div>
                      <div className="sol-card-colab">{s.colaborador?.nome || '—'}</div>
                      <div className="sol-card-tipo">
                        {TIPO_LABEL[s.tipo]}
                        {s.iniciativa && <span className="sol-card-iniciativa"> · {INICIATIVA_LABEL[s.iniciativa]}</span>}
                      </div>
                    </div>
                    <span className={`badge ${tomB.badge}`}>{tomB.label}</span>
                  </div>

                  <div className="sol-card-info">
                    {s.tipo === 'aumento_salario' && s.salario_proposto && (
                      <span>{formatarMoeda(s.colaborador?.salario)} → <strong style={{ color: 'var(--color-success)' }}>{formatarMoeda(s.salario_proposto)}</strong></span>
                    )}
                    {s.tipo === 'desligamento' && det.data && (
                      <span>Desligamento sugerido: <strong style={{ color: 'var(--color-danger)' }}>{det.data}</strong></span>
                    )}
                  </div>
                  {det.texto && <div className="sol-card-just">{det.texto}</div>}

                  <div className={`sol-card-resumo tom-${resumo.tom}`}>{resumo.texto}</div>

                  <FluxoTimeline etapas={s.etapas} />

                  {podeAprovar && (
                    <div className="sol-card-actions">
                      <button className="btn btn-success btn-sm" disabled={acaoId === s.id} onClick={() => aprovar(s)}>
                        {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                      </button>
                      <button className="btn btn-danger btn-sm" disabled={acaoId === s.id} onClick={() => { setReprovarSol(s); setReprovarTexto(''); }}>
                        <X size={14} /> Reprovar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reprovarSol && (
        <div className="modal-overlay" onClick={() => setReprovarSol(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Reprovar requisição</span>
              <button className="modal-close" onClick={() => setReprovarSol(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                A requisição será <strong>encerrada como Reprovada</strong> e todos da cadeia verão o motivo.
              </p>
              <div className="form-group">
                <label className="form-label">Justificativa da reprovação <span className="required">*</span></label>
                <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Explique o motivo da reprovação..."
                  value={reprovarTexto}
                  onChange={(e) => setReprovarTexto(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setReprovarSol(null)}>Cancelar</button>
              <button className="btn btn-danger" disabled={!reprovarTexto.trim() || acaoId === reprovarSol.id} onClick={confirmarReprovar}>
                {acaoId === reprovarSol.id ? 'Reprovando...' : <><X size={16} /> Confirmar reprovação</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add -- "src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx"
git commit -m "feat: AcompanharRequisicoes (lista/aprovacao extraida)"
```

---

## Task 10: Rotas + remoção do componente antigo

**Files:**
- Modify: `src/routes/AppRoutes.jsx`
- Delete: `src/pages/Gestor/GestorSolicitacoes.jsx`

- [ ] **Step 1: Trocar o import lazy**

Em `src/routes/AppRoutes.jsx`, remover a linha:
```jsx
const GestorSolicitacoes = lazy(() => import('../pages/Gestor/GestorSolicitacoes'));
```
e adicionar no mesmo bloco de imports:
```jsx
const RequisicoesHub = lazy(() => import('../pages/Gestor/requisicoes/RequisicoesHub'));
const NovaRequisicao = lazy(() => import('../pages/Gestor/requisicoes/NovaRequisicao'));
const AcompanharRequisicoes = lazy(() => import('../pages/Gestor/requisicoes/AcompanharRequisicoes'));
```

- [ ] **Step 2: Substituir as rotas de solicitações do gestor**

Trocar o bloco:
```jsx
          <Route
            path="/gestor/solicitacoes"
            element={<Navigate to="/gestor/solicitacoes/nova" replace />}
          />
          <Route
            path="/gestor/solicitacoes/:modo"
            element={
              <ProtectedRoute allowedRoles={['gestor']}>
                <LazyPage>
                  <GestorSolicitacoes />
                </LazyPage>
              </ProtectedRoute>
            }
          />
```
por:
```jsx
          <Route
            path="/gestor/solicitacoes"
            element={<Navigate to="/gestor/solicitacoes/nova" replace />}
          />
          <Route
            path="/gestor/solicitacoes/nova"
            element={
              <ProtectedRoute allowedRoles={['gestor']}>
                <LazyPage>
                  <RequisicoesHub />
                </LazyPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestor/solicitacoes/nova/:tipo"
            element={
              <ProtectedRoute allowedRoles={['gestor']}>
                <LazyPage>
                  <NovaRequisicao />
                </LazyPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestor/solicitacoes/acompanhar"
            element={
              <ProtectedRoute allowedRoles={['gestor']}>
                <LazyPage>
                  <AcompanharRequisicoes />
                </LazyPage>
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: Excluir o componente antigo**

```bash
git rm -- "src/pages/Gestor/GestorSolicitacoes.jsx"
```

- [ ] **Step 4: Verificar lint e build**

Run: `npm run lint`
Expected: sem erros (nenhuma referência a `GestorSolicitacoes`).

Run: `npm run build`
Expected: build conclui sem erro de resolução de import.

- [ ] **Step 5: Commit**

```bash
git add -- "src/routes/AppRoutes.jsx"
git commit -m "feat: novas rotas de Requisicoes DP e remocao do componente monolitico"
```

---

## Task 11: Verificação visual (manual)

**Files:** nenhum (validação de comportamento).

- [ ] **Step 1: Subir o dev server**

Run: `npm run dev`
Abrir o app e logar como **gestor**.

- [ ] **Step 2: Checar o hub**

Navegar em "Requisições DP > Nova requisição" (`/#/gestor/solicitacoes/nova`).
Esperado: header "Requisições disponíveis" + 6 cards (Requisição geral, Desligamento, Substituição, Alteração de Retirada de dividendo/cargo/função, Aumento de quadro, Transferência). Os 4 não-prontos com selo "Em breve".

- [ ] **Step 3: Checar requisições prontas**

Clicar em "Desligamento" → abre o form de desligamento com botão "← Voltar para requisições".
Voltar e clicar em "Alteração de Retirada de dividendo, cargo e função" → abre o form de alteração.
Esperado: enviar uma requisição de teste funciona e mostra "Ver andamento".

- [ ] **Step 4: Checar placeholder e acompanhar**

Clicar num card "Em breve" (ex: Transferência) → tela "Em construção" + voltar.
Navegar em "Aprovar / Acompanhar" (`/#/gestor/solicitacoes/acompanhar`) → lista de requisições carrega; aprovar/reprovar funciona.

- [ ] **Step 5: Checar renomeações**

Sidebar (gestor e admin) mostra "Requisições DP"; título da página admin mostra "Requisições DP".

(Sem commit — task de validação.)
