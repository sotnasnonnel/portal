# Fluxo de Aprovação Geral por Gestor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os 3 fluxos de aprovação por gestor por um único fluxo geral, reaproveitando a linha existente `aumento_salario::''` de `solicitacoes_rh_fluxos`, sem migração de banco.

**Architecture:** A linha `(solicitante_id, 'aumento_salario', '')` passa a ser o "fluxo geral" do gestor. Um novo `buscarFluxoGeral` substitui o `buscarFluxo` por-caso; o hook do gestor colapsa a pré-checagem para um booleano; o AdminFluxos vira editor de um único fluxo por gestor. `buscarFluxo` e `CASOS_FLUXO` são removidos.

**Tech Stack:** React 19, Vite 8, Supabase JS, lucide-react, Vanilla CSS.

**Notas de ambiente:**
- **Sem framework de testes** (só ESLint + Vite). Verificação = `npm run lint` + `npm run build` + checagem visual no `npm run dev`.
- **NÃO commitar.** O usuário pediu para deixar as mudanças apenas no working tree. Ignore qualquer passo de commit; não rode `git add`/`git commit`.
- Rodar comandos a partir de `C:\Users\LennonSantos\Downloads\Phd\App Dp`.
- Sem alterações de banco. Nenhuma migração.

---

## File Structure

**Modificar:**
- `src/config/aprovacao.js` — adicionar `FLUXO_GERAL` + `buscarFluxoGeral`; remover `buscarFluxo` e `CASOS_FLUXO`.
- `src/pages/Gestor/requisicoes/useRequisicaoForm.js` — pré-checagem vira booleano via `buscarFluxoGeral`; `criarComFluxo` usa `buscarFluxoGeral`.
- `src/pages/Gestor/requisicoes/FormAlteracao.jsx` — `semFluxo` usa booleano.
- `src/pages/Gestor/requisicoes/FormDesligamento.jsx` — `semFluxo` usa booleano.
- `src/pages/Admin/AdminFluxos.jsx` — reescrita para um único fluxo por gestor.

---

## Task 1: `aprovacao.js` — fluxo geral

**Files:**
- Modify: `src/config/aprovacao.js`

- [ ] **Step 1: Remover o bloco `CASOS_FLUXO`**

Remover estas linhas (atualmente após `TIPO_LABEL`):
```js
// Os 3 casos de fluxo que o admin configura por solicitante.
// `iniciativa` segue a convenção do banco: '' para aumento, 'empresa'/'empregado' p/ desligamento.
export const CASOS_FLUXO = [
  { tipo: 'aumento_salario', iniciativa: '', label: TIPO_LABEL.aumento_salario },
  { tipo: 'desligamento', iniciativa: 'empresa', label: 'Desligamento — Iniciativa da Empresa' },
  { tipo: 'desligamento', iniciativa: 'empregado', label: 'Desligamento — Iniciativa do Empregado' },
];
```
e no lugar colocar:
```js
// Fluxo geral por gestor: reaproveita a linha legada (tipo='aumento_salario', iniciativa='')
// de solicitacoes_rh_fluxos como a ÚNICA cadeia de aprovação, válida para todas as requisições.
export const FLUXO_GERAL = { tipo: 'aumento_salario', iniciativa: '' };
```

- [ ] **Step 2: Substituir `buscarFluxo` por `buscarFluxoGeral`**

Remover a função atual:
```js
export async function buscarFluxo(supabase, solicitanteId, tipo, iniciativa) {
  const { data, error } = await supabase
    .from('solicitacoes_rh_fluxos')
    .select('*')
    .eq('solicitante_id', solicitanteId)
    .eq('tipo', tipo)
    .eq('iniciativa', normIniciativa(iniciativa))
    .maybeSingle();
  if (error) return { fluxo: null, erro: error };
  return { fluxo: data || null, erro: null };
}
```
e colocar no lugar (mantendo o bloco de comentário acima dela, ajustado):
```js
/**
 * Busca o fluxo GERAL do solicitante (única cadeia, vale p/ todas as requisições).
 * Retorna { fluxo, erro }:
 *  - fluxo: a linha de solicitacoes_rh_fluxos (slot FLUXO_GERAL), ou null se não configurada.
 *  - erro:  objeto de erro do Supabase (≠ "não configurado") ou null.
 * Distinguir erro de "não encontrado" é essencial: erro de rede NÃO deve
 * virar mensagem de "admin não configurou".
 */
export async function buscarFluxoGeral(supabase, solicitanteId) {
  const { data, error } = await supabase
    .from('solicitacoes_rh_fluxos')
    .select('*')
    .eq('solicitante_id', solicitanteId)
    .eq('tipo', FLUXO_GERAL.tipo)
    .eq('iniciativa', FLUXO_GERAL.iniciativa)
    .maybeSingle();
  if (error) return { fluxo: null, erro: error };
  return { fluxo: data || null, erro: null };
}
```

(O comentário antigo acima de `buscarFluxo` — "Busca a cadeia configurada para (solicitante, tipo, iniciativa)..." — deve ser substituído pelo novo bloco acima.)

- [ ] **Step 3: Manter `normIniciativa`**

`normIniciativa` continua exportada e usada pelo AdminFluxos (Task 4). Não remover.

- [ ] **Step 4: Verificar lint**

Run: `npm run lint`
Expected: pode acusar erros TEMPORÁRIOS de import quebrado em `useRequisicaoForm.js` e `AdminFluxos.jsx` (ainda importam `buscarFluxo`/`CASOS_FLUXO`) — serão corrigidos nas próximas tasks. Nenhum erro DENTRO de `aprovacao.js`.

---

## Task 2: Hook `useRequisicaoForm` — fluxo geral

**Files:**
- Modify: `src/pages/Gestor/requisicoes/useRequisicaoForm.js`

- [ ] **Step 1: Trocar o import**

Trocar:
```js
import { buscarFluxo, montarEtapasDeConfig } from '../../../config/aprovacao';
```
por:
```js
import { buscarFluxoGeral, montarEtapasDeConfig } from '../../../config/aprovacao';
```

- [ ] **Step 2: Remover a constante `CASOS`**

Remover:
```js
// Casos (tipo+iniciativa) cuja existência de fluxo precisamos pré-checar.
const CASOS = [
  ['aumento_salario', ''],
  ['desligamento', 'empresa'],
  ['desligamento', 'empregado'],
];
```

- [ ] **Step 3: `fluxoOk` vira booleano (estado inicial `null` = desconhecido)**

Trocar:
```js
  const [fluxoOk, setFluxoOk] = useState({});
```
por:
```js
  const [fluxoOk, setFluxoOk] = useState(null); // null = ainda não checado; true/false após checagem
```

- [ ] **Step 4: Pré-checagem usa `buscarFluxoGeral`**

Trocar o `useEffect` de pré-checagem:
```js
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
```
por:
```js
  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    (async () => {
      const { fluxo, erro } = await buscarFluxoGeral(supabase, user.id);
      // Em erro de rede, não bloqueia (assume desconhecido = true).
      if (vivo) setFluxoOk(erro ? true : !!fluxo);
    })();
    return () => { vivo = false; };
  }, [user, bump]);
```

- [ ] **Step 5: `criarComFluxo` usa `buscarFluxoGeral`**

Trocar a primeira linha do corpo de `criarComFluxo`:
```js
    const { fluxo, erro } = await buscarFluxo(supabase, user.id, tipo, iniciativa);
```
por:
```js
    // O fluxo é o geral do gestor; tipo/iniciativa seguem só no registro da solicitação.
    const { fluxo, erro } = await buscarFluxoGeral(supabase, user.id);
```
(A assinatura `criarComFluxo(tipo, iniciativa, dadosSolicitacao)` permanece — `dadosSolicitacao` já carrega `tipo`/`iniciativa`; os parâmetros antes de `dadosSolicitacao` não são flagados pelo lint por estarem antes de um arg usado.)

- [ ] **Step 6: Verificar lint**

Run: `npm run lint`
Expected: sem erros em `useRequisicaoForm.js` (import resolvido). Forms ainda podem acusar uso de `fluxoOk` como objeto — corrigido na Task 3.

---

## Task 3: Formulários — `semFluxo` booleano

**Files:**
- Modify: `src/pages/Gestor/requisicoes/FormAlteracao.jsx:16`
- Modify: `src/pages/Gestor/requisicoes/FormDesligamento.jsx:15`

- [ ] **Step 1: FormAlteracao**

Trocar (linha 16):
```js
  const semFluxo = fluxoOk['aumento_salario::'] === false;
```
por:
```js
  const semFluxo = fluxoOk === false;
```

- [ ] **Step 2: FormDesligamento**

Trocar (linha 15):
```js
  const semFluxo = form.iniciativa && fluxoOk[`desligamento::${form.iniciativa}`] === false;
```
por:
```js
  const semFluxo = fluxoOk === false;
```

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sem erros novos nos dois forms.

---

## Task 4: `AdminFluxos` — editor de um único fluxo

**Files:**
- Modify: `src/pages/Admin/AdminFluxos.jsx` (reescrita)

- [ ] **Step 1: Substituir o arquivo inteiro pelo conteúdo abaixo**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import {
  Workflow, Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2, Check,
  AlertTriangle, ShieldCheck, User, UserCircle2, ChevronRight,
} from 'lucide-react';
import { FLUXO_GERAL, normIniciativa } from '../../config/aprovacao';
import '../../components/UI/Components.css';
import './Admin.css';

const iniciais = (nome) => (nome || '?')
  .split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();

// Casa uma linha de fluxo com o slot geral (tipo='aumento_salario', iniciativa='').
const ehFluxoGeral = (x) =>
  x.tipo === FLUXO_GERAL.tipo && normIniciativa(x.iniciativa) === FLUXO_GERAL.iniciativa;

export default function AdminFluxos() {
  const [gestores, setGestores] = useState([]);
  const [pool, setPool] = useState([]);
  const [fluxos, setFluxos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [solicitanteId, setSolicitanteId] = useState('');
  const [cadeia, setCadeia] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState('');

  const nomePorId = Object.fromEntries(pool.map((c) => [c.id, c.nome]));
  const idsAtivos = new Set(pool.map((c) => c.id));
  const solicitante = gestores.find((g) => g.id === solicitanteId);

  const carregarBase = useCallback(async () => {
    setLoading(true);
    const [{ data: ges }, { data: aprov }, { data: fls }] = await Promise.all([
      supabase.from('colaboradores').select('id, nome').eq('perfil', 'gestor').eq('ativo', true).order('nome'),
      supabase.from('colaboradores').select('id, nome, perfil').in('perfil', ['gestor', 'admin']).eq('ativo', true).order('nome'),
      supabase.from('solicitacoes_rh_fluxos').select('solicitante_id, tipo, iniciativa, aprovadores'),
    ]);
    setGestores(ges || []);
    setPool(aprov || []);
    setFluxos(fls || []);
    setLoading(false);
  }, []);

  useEffect(() => { carregarBase(); }, [carregarBase]);

  useEffect(() => {
    if (!solicitanteId) { setCadeia([]); return; }
    const f = fluxos.find((x) => x.solicitante_id === solicitanteId && ehFluxoGeral(x));
    setCadeia(Array.isArray(f?.aprovadores) ? [...f.aprovadores] : []);
  }, [solicitanteId, fluxos]);

  const configurado = (gid) => fluxos.some((x) => x.solicitante_id === gid && ehFluxoGeral(x));

  const setEtapa = (idx, valor) => setCadeia((prev) => {
    const arr = [...prev];
    arr[idx] = valor;
    return arr;
  });
  const addEtapa = () => setCadeia((prev) => [...prev, '']);
  const removeEtapa = (idx) => setCadeia((prev) => prev.filter((_, i) => i !== idx));
  const moverEtapa = (idx, dir) => setCadeia((prev) => {
    const arr = [...prev];
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= arr.length) return prev;
    [arr[idx], arr[alvo]] = [arr[alvo], arr[idx]];
    return arr;
  });

  const salvar = async () => {
    const aprovadores = cadeia.map((x) => (x || '').trim()).filter(Boolean);
    if (aprovadores.some((id) => !idsAtivos.has(id))) {
      alert('Há um aprovador inválido ou inativo na cadeia. Revise antes de salvar.');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('solicitacoes_rh_fluxos')
        .upsert(
          {
            solicitante_id: solicitanteId,
            tipo: FLUXO_GERAL.tipo,
            iniciativa: FLUXO_GERAL.iniciativa,
            aprovadores,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'solicitante_id,tipo,iniciativa' }
        );
      if (error) throw error;
      setSucesso(`Fluxo geral salvo: ${solicitante?.nome || ''}`);
      setTimeout(() => setSucesso(''), 4000);
      await carregarBase();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar o fluxo. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const temInativo = cadeia.some((id) => id && !idsAtivos.has(id));

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><Workflow size={28} /> Fluxos de Aprovação</h1>
      <p className="page-subtitle">
        Monte a cadeia de aprovação geral de cada gestor. Vale para todas as requisições:
        parte do gestor, passa por cada aprovador na ordem e termina sempre na execução do Admin (DP).
      </p>

      {sucesso && (
        <div className="success-msg" style={{ marginBottom: 'var(--space-lg)' }}>
          <Check size={16} /> {sucesso}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="table-container" style={{ marginBottom: 'var(--space-xl)' }}>
            <div className="table-header"><div className="table-header-title">Solicitante</div></div>
            <div style={{ padding: 'var(--space-lg)' }}>
              <div className="form-group" style={{ marginBottom: 0, maxWidth: 480 }}>
                <label className="form-label">Selecione o gestor solicitante <span className="required">*</span></label>
                <select className="form-select" value={solicitanteId} onChange={(e) => setSolicitanteId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {gestores.map((g) => (
                    <option key={g.id} value={g.id}>{configurado(g.id) ? '✅' : '⚠️'} {g.nome}</option>
                  ))}
                </select>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
                  ✅ fluxo configurado · ⚠️ sem fluxo
                </p>
              </div>
            </div>
          </div>

          {solicitanteId && (
            <div className="fluxo-card">
              <div className="fluxo-card-head">
                <div className="fluxo-card-title"><Workflow size={18} /> Fluxo de aprovação geral</div>
                {temInativo && (
                  <span className="badge inativo"><AlertTriangle size={13} /> Aprovador inativo</span>
                )}
              </div>

              <div className="fluxo-canvas">
                <div className="fluxo-node fluxo-node-start" title="Quem abre a requisição">
                  <div className="fluxo-node-avatar"><User size={16} /></div>
                  <div className="fluxo-node-body">
                    <span className="fluxo-node-role">Solicitante</span>
                    <span className="fluxo-node-name">{solicitante?.nome || '—'}</span>
                  </div>
                </div>

                {cadeia.map((id, idx) => {
                  const inativo = id && !idsAtivos.has(id);
                  return (
                    <div key={idx} className="fluxo-seg">
                      <ChevronRight className="fluxo-arrow" size={20} />
                      <div className={`fluxo-node fluxo-node-step ${inativo ? 'is-inativo' : ''}`}>
                        <div className="fluxo-node-num">{idx + 1}</div>
                        <div className="fluxo-node-avatar">{id ? iniciais(nomePorId[id]) : <UserCircle2 size={16} />}</div>
                        <div className="fluxo-node-body">
                          <span className="fluxo-node-role">Aprovação {idx + 1}</span>
                          <select
                            className="fluxo-node-select"
                            value={id || ''}
                            onChange={(e) => setEtapa(idx, e.target.value)}
                          >
                            <option value="">Selecionar...</option>
                            {inativo && <option value={id}>{nomePorId[id] || 'Inativo'} (inativo)</option>}
                            {pool.map((c) => (
                              <option key={c.id} value={c.id}>{c.nome}{c.perfil === 'admin' ? ' (Admin)' : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div className="fluxo-node-tools">
                          <button type="button" title="Subir" disabled={idx === 0} onClick={() => moverEtapa(idx, -1)}><ArrowUp size={13} /></button>
                          <button type="button" title="Descer" disabled={idx === cadeia.length - 1} onClick={() => moverEtapa(idx, 1)}><ArrowDown size={13} /></button>
                          <button type="button" title="Remover" className="del" onClick={() => removeEtapa(idx)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="fluxo-seg">
                  <ChevronRight className="fluxo-arrow" size={20} />
                  <button type="button" className="fluxo-add" onClick={addEtapa} title="Adicionar aprovador">
                    <Plus size={16} /> <span>Aprovador</span>
                  </button>
                </div>

                <div className="fluxo-seg">
                  <ChevronRight className="fluxo-arrow" size={20} />
                  <div className="fluxo-node fluxo-node-end" title="Execução final (automática)">
                    <div className="fluxo-node-avatar"><ShieldCheck size={16} /></div>
                    <div className="fluxo-node-body">
                      <span className="fluxo-node-role">Execução</span>
                      <span className="fluxo-node-name">Admin (DP)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="fluxo-card-foot">
                <span className="fluxo-hint">
                  {cadeia.filter(Boolean).length === 0
                    ? 'Sem aprovadores — vai direto para a execução do Admin.'
                    : `${cadeia.filter(Boolean).length} etapa(s) de aprovação antes da execução.`}
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={salvando}
                  onClick={salvar}
                >
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar fluxo
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sem erros novos. Imports removidos (`CASOS_FLUXO`, `ICONE_CASO`, `TrendingUp`, `UserMinus`, `CheckCircle2`) não devem mais aparecer; nenhum import não usado.

---

## Task 5: Verificação final

**Files:** nenhum.

- [ ] **Step 1: Lint e build limpos**

Run: `npm run lint`
Expected: nenhum erro NOVO (os pré-existentes em Layout.jsx/Sidebar.jsx/OnboardingModal.jsx/AuthContext.jsx/GestorAprovacoes.jsx/UsuarioDashboard.jsx permanecem; nada novo relacionado a fluxo).

Run: `npm run build`
Expected: build conclui sem erro de resolução de import (sem referências a `buscarFluxo`/`CASOS_FLUXO`).

- [ ] **Step 2: Conferir que `buscarFluxo`/`CASOS_FLUXO` sumiram**

Run (Grep): procurar `buscarFluxo\b` e `CASOS_FLUXO` em `src/`.
Expected: zero ocorrências de `buscarFluxo` (só `buscarFluxoGeral`) e zero de `CASOS_FLUXO`.

- [ ] **Step 3: Validação visual (manual, `npm run dev`)**

- Admin → "Fluxos de Aprovação": selecionar um gestor mostra UM card "Fluxo de aprovação geral" já preenchido com os aprovadores salvos (vindos da linha `aumento_salario`). Editar e "Salvar fluxo" persiste; marca ✅ no dropdown.
- Gestor → abrir "Alteração de Retirada de dividendo, cargo e função": form não bloqueia (fluxo geral configurado); enviar gera as etapas corretas.
- Gestor → abrir "Desligamento": escolher iniciativa empresa OU empregado usa a MESMA cadeia geral; enviar funciona.
- Gestor sem fluxo geral (se houver): forms mostram o aviso "fluxo não configurado" e bloqueiam o envio.

(Sem commit.)
