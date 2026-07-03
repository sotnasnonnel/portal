# Recolher requisições + comentário ao aprovar/reprovar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na visão do Gestor, recolher cada requisição numa linha-resumo expansível e permitir comentário opcional de quem aprova ou reprova, exibido na timeline do fluxo.

**Architecture:** Mudanças puramente de front-end React em 3 arquivos. O comentário reusa a coluna `justificativa` já existente em `solicitacoes_rh_etapas` (sem migração de banco). O estado de expandido/recolhido vive em `useState` local (não persiste).

**Tech Stack:** React 19, Vite, lucide-react, Supabase JS. Sem framework de testes no projeto — verificação por `npm run lint`, `npm run build` e checagem manual no navegador.

## Global Constraints

- Não fazer `git add -A` / `git add .` — o repositório aponta para a home e há muitas deleções de outras pastas no status. Adicionar **somente** os arquivos de cada task, por caminho explícito.
- Tema/visual: usar tokens CSS existentes (`var(--space-*)`, `var(--color-*)`, `var(--radius-*)`, `var(--transition-normal)`). Não introduzir cores fixas novas.
- Caminhos relativos ao repo: os arquivos do app ficam sob `Desktop/portal_phd/` a partir da raiz do git. Os comandos abaixo assumem que você está em `C:/Users/LennonSantos/Desktop/portal_phd`.
- Reprovação deixa de exigir motivo: o botão de confirmar reprovação não depende mais de texto preenchido.

---

### Task 1: Timeline exibe comentário de qualquer etapa decidida

**Files:**
- Modify: `src/components/Solicitacoes/FluxoTimeline.jsx:50-52`

**Interfaces:**
- Consumes: `etapas[].justificativa` (string | null), `etapas[].status`.
- Produces: nada para outras tasks (mudança isolada de render).

Hoje o comentário só aparece quando `status === 'reprovada'`. Passa a aparecer em qualquer etapa que tenha `justificativa` preenchida (aprovada, auto_aprovada, reprovada). Etapas pendentes nunca têm `justificativa`, então não há risco de exibir em branco.

- [ ] **Step 1: Trocar a condição de render do comentário**

Em `src/components/Solicitacoes/FluxoTimeline.jsx`, substituir:

```jsx
              {e.status === 'reprovada' && e.justificativa && (
                <div className="fluxo-step-justificativa">“{e.justificativa}”</div>
              )}
```

por:

```jsx
              {e.justificativa && (
                <div className="fluxo-step-justificativa">“{e.justificativa}”</div>
              )}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos; build conclui.

- [ ] **Step 3: Commit**

```bash
git add src/components/Solicitacoes/FluxoTimeline.jsx
git commit -m "feat(requisicoes): timeline mostra comentario de etapas aprovadas"
```

---

### Task 2: Modal de decisão unificado (aprovar/reprovar) com comentário opcional

**Files:**
- Modify: `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`

**Interfaces:**
- Consumes: `etapaAtual(etapas)` de `config/aprovacao`; `supabase`; `user.id`.
- Produces: grava `solicitacoes_rh_etapas.justificativa` (string | null) nas etapas aprovadas/reprovadas — consumido visualmente pela Task 1.

Hoje **Aprovar** é 1 clique direto (função `aprovar`) e **Reprovar** abre um modal com motivo obrigatório (`reprovarSol`/`reprovarTexto`/`confirmarReprovar`). Vamos unificar num único modal com comentário opcional para os dois modos.

- [ ] **Step 1: Substituir o estado de reprovação por estado de decisão**

Em `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`, no bloco de `useState`, remover estas duas linhas:

```jsx
  const [reprovarSol, setReprovarSol] = useState(null);
  const [reprovarTexto, setReprovarTexto] = useState('');
```

e colocar no lugar:

```jsx
  const [decisao, setDecisao] = useState(null); // { sol, modo: 'aprovar' | 'reprovar' }
  const [comentario, setComentario] = useState('');
```

- [ ] **Step 2: Substituir `aprovar` e `confirmarReprovar` por um único `confirmarDecisao`**

Remover a função `aprovar` inteira (linhas que começam em `const aprovar = async (sol) => {` até seu `};`) e a função `confirmarReprovar` inteira. Inserir no lugar:

```jsx
  const confirmarDecisao = async () => {
    if (!decisao) return;
    const { sol, modo } = decisao;
    const atual = etapaAtual(sol.etapas);
    if (!atual) return;
    const aprovando = modo === 'aprovar';
    const coment = comentario.trim() || null;
    const agora = new Date().toISOString();
    setAcaoId(sol.id);
    try {
      const { data, error } = await supabase
        .from('solicitacoes_rh_etapas')
        .update({
          status: aprovando ? 'aprovada' : 'reprovada',
          justificativa: coment,
          decidido_em: agora,
        })
        .eq('id', atual.id)
        .eq('aprovador_id', user.id)
        .eq('status', 'pendente')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Esta etapa já foi tratada por outra pessoa. A lista será atualizada.');
        setDecisao(null);
        setComentario('');
        await fetchParticipa();
        return;
      }
      if (!aprovando) {
        const { error: e2 } = await supabase
          .from('solicitacoes_rh')
          .update({ status: 'reprovada', updated_at: agora })
          .eq('id', sol.id);
        if (e2) throw e2;
      }
      setDecisao(null);
      setComentario('');
      await fetchParticipa();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert(`Erro ao ${aprovando ? 'aprovar' : 'reprovar'}. Tente novamente.`);
    } finally {
      setAcaoId(null);
    }
  };
```

- [ ] **Step 3: Botões do card abrem o modal de decisão**

No JSX dos botões de ação do card, substituir:

```jsx
                        <>
                          <button className="btn btn-success btn-sm" disabled={acaoId === s.id} onClick={() => aprovar(s)}>
                            {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                          </button>
                          <button className="btn btn-danger btn-sm" disabled={acaoId === s.id} onClick={() => { setReprovarSol(s); setReprovarTexto(''); }}>
                            <X size={14} /> Reprovar
                          </button>
                        </>
```

por:

```jsx
                        <>
                          <button className="btn btn-success btn-sm" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'aprovar' }); setComentario(''); }}>
                            {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                          </button>
                          <button className="btn btn-danger btn-sm" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'reprovar' }); setComentario(''); }}>
                            <X size={14} /> Reprovar
                          </button>
                        </>
```

- [ ] **Step 4: Substituir o modal de reprovação pelo modal de decisão unificado**

Substituir todo o bloco `{reprovarSol && ( ... )}` por:

```jsx
      {decisao && (() => {
        const aprovando = decisao.modo === 'aprovar';
        return (
          <div className="modal-overlay" onClick={() => setDecisao(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">{aprovando ? 'Aprovar requisição' : 'Reprovar requisição'}</span>
                <button className="modal-close" onClick={() => setDecisao(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                  {aprovando
                    ? 'A requisição seguirá para a próxima etapa do fluxo. Você pode deixar um comentário, se quiser.'
                    : <>A requisição será <strong>encerrada como Reprovada</strong> e todos da cadeia verão o comentário.</>}
                </p>
                <div className="form-group">
                  <label className="form-label">Comentário (opcional)</label>
                  <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder={aprovando ? 'Adicione um comentário, se quiser...' : 'Explique o motivo da reprovação (opcional)...'}
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setDecisao(null)}>Cancelar</button>
                <button className={`btn ${aprovando ? 'btn-success' : 'btn-danger'}`} disabled={acaoId === decisao.sol.id} onClick={confirmarDecisao}>
                  {acaoId === decisao.sol.id
                    ? (aprovando ? 'Aprovando...' : 'Reprovando...')
                    : (aprovando ? <><Check size={16} /> Confirmar aprovação</> : <><X size={16} /> Confirmar reprovação</>)}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros; sem referências órfãs a `aprovar`, `reprovarSol`, `reprovarTexto`, `confirmarReprovar`.

- [ ] **Step 6: Verificação manual**

`npm run dev`, logar como gestor com requisição aguardando sua aprovação:
- Clicar **Aprovar** → abre modal; confirmar sem texto → aprova e some.
- Reabrir outra, **Aprovar** com texto → na timeline aparece "Aprovou" + comentário entre aspas.
- **Reprovar** sem texto → encerra como Reprovada (não bloqueia o botão).
- **Reprovar** com texto → timeline mostra "Reprovou" + comentário.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx
git commit -m "feat(requisicoes): comentario opcional ao aprovar/reprovar via modal unico"
```

---

### Task 3: Recolher/expandir cards + botão "Expandir/Recolher todas"

**Files:**
- Modify: `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`
- Modify: `src/components/UI/Components.css` (após o bloco `.sol-card-actions`, ~linha 640)

**Interfaces:**
- Consumes: `acaoDisponivel(user.id, etapas)` de `config/aprovacao` (já importado? confirmar no Step 1); `participa` (array de solicitações).
- Produces: nada para outras tasks.

- [ ] **Step 1: Imports — `useRef`, `ChevronDown`, `acaoDisponivel`**

No topo de `AcompanharRequisicoes.jsx`:

- Garantir `useRef` no import do React:

```jsx
import { useState, useEffect, useCallback, useRef } from 'react';
```

- Adicionar `ChevronDown` ao import do lucide-react:

```jsx
import { Check, X, Loader2, ClipboardCheck, FileText, ChevronDown } from 'lucide-react';
```

- Adicionar `acaoDisponivel` ao import de `config/aprovacao` (já é usado no corpo via `acaoDisponivel(...)`; confirmar que está na lista de imports):

```jsx
import {
  etapaAtual, acaoDisponivel, resumoAndamento,
  INICIATIVA_LABEL, TIPO_LABEL,
} from '../../../config/aprovacao';
```

- [ ] **Step 2: Estado de expansão + seed único + helpers**

Logo após as linhas de `useState`, adicionar:

```jsx
  const [expandido, setExpandido] = useState(() => new Set());
  const seededRef = useRef(false);

  // Semeia UMA vez: abre expandidas as requisições que aguardam a ação deste usuário.
  useEffect(() => {
    if (seededRef.current || participa.length === 0) return;
    seededRef.current = true;
    setExpandido(new Set(
      participa
        .filter((s) => acaoDisponivel(user?.id, s.etapas) === 'aprovacao')
        .map((s) => s.id)
    ));
  }, [participa, user?.id]);

  const toggleCard = (id) => setExpandido((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const todasExpandidas = participa.length > 0 && participa.every((s) => expandido.has(s.id));
  const alternarTodas = () => setExpandido(todasExpandidas ? new Set() : new Set(participa.map((s) => s.id)));
```

- [ ] **Step 3: Botão "Expandir/Recolher todas" no cabeçalho da lista**

Substituir:

```jsx
        <div className="table-header">
          <div className="table-header-title"><ClipboardCheck size={16} /> Requisições que você participa</div>
        </div>
```

por:

```jsx
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="table-header-title"><ClipboardCheck size={16} /> Requisições que você participa</div>
          {participa.length > 1 && (
            <button className="btn btn-outline btn-sm" onClick={alternarTodas}>
              {todasExpandidas ? 'Recolher todas' : 'Expandir todas'}
            </button>
          )}
        </div>
```

- [ ] **Step 4: Cabeçalho clicável + corpo recolhível no card**

No `participa.map((s) => { ... })`, dentro do `return (`, substituir o bloco que vai de `<div key={s.id} className="sol-card">` (inclusive o `sol-card-top`) até o fechamento das ações, pela estrutura recolhível. Concretamente, trocar:

```jsx
                <div key={s.id} className="sol-card">
                  <div className="sol-card-top">
                    <div>
                      <div className="sol-card-colab">{nomeColab || `Solicitado por ${nomeSolic}`}</div>
                      <div className="sol-card-tipo">
                        {TIPO_LABEL[s.tipo]}
                        {s.iniciativa && <span className="sol-card-iniciativa"> · {INICIATIVA_LABEL[s.iniciativa]}</span>}
                        {nomeColab && <span className="sol-card-iniciativa"> · Solicitado por {nomeSolic}</span>}
                      </div>
                    </div>
                    <span className={`badge ${tomB.badge}`}>{tomB.label}</span>
                  </div>

```

por (abre o card, o header-botão e o início do corpo condicional):

```jsx
                <div key={s.id} className="sol-card">
                  <button
                    type="button"
                    className="sol-card-header"
                    aria-expanded={expandido.has(s.id)}
                    aria-controls={`sol-body-${s.id}`}
                    onClick={() => toggleCard(s.id)}
                  >
                    <ChevronDown size={16} aria-hidden className={`sol-card-chevron ${expandido.has(s.id) ? 'is-open' : ''}`} />
                    <span className="sol-card-headline sol-card-colab">
                      {TIPO_LABEL[s.tipo]} · {nomeColab || `Solicitado por ${nomeSolic}`}
                    </span>
                    <span className={`badge ${tomB.badge}`}>{tomB.label}</span>
                  </button>

                  {expandido.has(s.id) && (
                  <div id={`sol-body-${s.id}`} className="sol-card-body">
                  <div className="sol-card-top">
                    <div>
                      <div className="sol-card-colab">{nomeColab || `Solicitado por ${nomeSolic}`}</div>
                      <div className="sol-card-tipo">
                        {TIPO_LABEL[s.tipo]}
                        {s.iniciativa && <span className="sol-card-iniciativa"> · {INICIATIVA_LABEL[s.iniciativa]}</span>}
                        {nomeColab && <span className="sol-card-iniciativa"> · Solicitado por {nomeSolic}</span>}
                      </div>
                    </div>
                  </div>

```

Note: o `sol-card-top` foi mantido no corpo **sem** o `<span className="badge">` (o badge agora vive no header).

- [ ] **Step 5: Fechar o corpo condicional**

O conteúdo seguinte (`sol-card-info`, `sol-card-just`, `sol-card-resumo`, `<FluxoTimeline />`, e o bloco de `sol-card-actions`) permanece igual. Após o fechamento do bloco de ações `)}` e antes do `</div>` que fecha o antigo `sol-card`, fechar a `<div className="sol-card-body">` e o condicional. Concretamente, trocar o fechamento:

```jsx
                  )}
                </div>
              );
```

por:

```jsx
                  )}
                  </div>
                  )}
                </div>
              );
```

(Ou seja: `)}` fecha `sol-card-actions`; `</div>` fecha `.sol-card-body`; `)}` fecha o `expandido.has(s.id) && (`; `</div>` fecha `.sol-card`.)

- [ ] **Step 6: CSS do header/chevron/body**

Em `src/components/UI/Components.css`, após o bloco `.sol-card-actions { ... }` (~linha 640), acrescentar:

```css
.sol-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: 0;
  background: none;
  border: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.sol-card-headline {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sol-card-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform var(--transition-normal);
}

.sol-card-chevron.is-open {
  transform: rotate(180deg);
}

.sol-card-body {
  margin-top: var(--space-md);
}
```

- [ ] **Step 7: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros; sem `key` duplicada; JSX balanceado.

- [ ] **Step 8: Verificação manual**

`npm run dev`, como gestor com várias requisições:
- Lista começa recolhida (linhas-resumo "Tipo · Nome" + badge), exceto a que aguarda sua aprovação, que abre expandida.
- Clicar no cabeçalho expande/recolhe; chevron gira.
- "Expandir todas"/"Recolher todas" alterna corretamente o rótulo e o estado.
- Aprovar/reprovar (Task 2) seguem funcionando dentro do card expandido.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx src/components/UI/Components.css
git commit -m "feat(requisicoes): recolher cards em resumo expansivel + expandir/recolher todas"
```

---

## Self-Review

**Spec coverage:**
- Recolher/expandir só no Gestor → Task 3. ✓
- Resumo "Tipo · Nome" + badge + chevron → Task 3 Step 4. ✓
- Default recolhido exceto a que aguarda o usuário → Task 3 Step 2 (seed). ✓
- Botão "Expandir/Recolher todas" → Task 3 Step 3. ✓
- Comentário opcional ao aprovar e reprovar (reprovar deixa de exigir motivo) → Task 2. ✓
- Reuso da coluna `justificativa`, sem migração → Task 2 Step 2. ✓
- Comentário exibido na timeline para todos (inclusive RH/DP que reusa FluxoTimeline) → Task 1. ✓
- Estado de expansão não persiste → Task 3 (useState). ✓

**Placeholder scan:** nenhum TBD/TODO; todo passo de código tem o código completo.

**Type/consistency:** `decisao` = `{ sol, modo }` usado de forma consistente nos Steps 1/3/4 da Task 2; `confirmarDecisao` referenciado só onde definido; `expandido` (Set) e `toggleCard`/`alternarTodas`/`todasExpandidas` consistentes na Task 3; nomes de colunas (`status`, `justificativa`, `decidido_em`, `updated_at`) batem com o `SELECT_SOL` e com o código atual.
