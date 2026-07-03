# Plano — Fluxos de Aprovação configuráveis pelo Admin

> App: **App Dp — Gestão de Pessoas** (React + Vite + Supabase, banco compartilhado `bogsuuhrgvopzgcceoqz`, tabelas sem prefixo, login custom na tabela `colaboradores`).
> Objetivo: tirar a cadeia de aprovação do código (`montarFluxo` hardcoded) e deixar o **admin** (`admin@phdengenharia.eng.br`) montar a cadeia **por solicitante, por tipo e (no desligamento) por iniciativa**.

---

## 1. Como funciona HOJE (baseline)

- Fluxo **fixo no código** em `src/config/aprovacao.js` → `montarFluxo(tipo, iniciativa)`:
  - `desligamento` + `empresa`: Admin → Lucas → Pedro → **Admin (execução)**
  - `desligamento` + `empregado`: Lucas → **Admin (execução)** [Pedro só ciência]
  - `aumento_salario` (retirada/prestação): Lucas → Pedro → **Admin (execução)**
- Aprovadores são **3 IDs fixos** em `APROVADORES` (admin, lucas, pedro) e nomes em `NOME_APROVADOR`.
- Ao criar a solicitação, `montarEtapasParaInsercao(solicitacaoId, tipo, iniciativa, criadorId)` grava **1 linha por etapa** em `solicitacoes_rh_etapas`. Todas nascem `status='pendente'` (exceto auto-aprovação do criador → `auto_aprovada`). Observadores nascem como `tipo_etapa='ciencia'`.
- **Avanço do fluxo**: `etapaAtual(etapas)` = etapa de menor `ordem` com `status='pendente'` (entre `aprovacao`/`execucao`). Ao aprovar a atual (→ `aprovada`), a próxima pendente vira automaticamente a "atual". Não há trigger.
- `acaoDisponivel(userId, etapas)` retorna `'aprovacao' | 'execucao' | null` se o user é o dono da etapa atual.
- **Execução** (última etapa, `tipo_etapa='execucao'`): hoje só em `AdminSolicitacoes` (`executar()` seta etapa `executada` + solicitação `concluida`). A tela do **gestor** (`GestorSolicitacoes`, modo acompanhar) só trata `aprovacao`, **não** execução.
- `FluxoTimeline` exibe `etapa.papel` (texto). `resumoAndamento` usa `nomeAprovador(aprovador_id)` — **só conhece os 3 IDs fixos** (qualquer outro vira "Aprovador").
- Etapas são **fotografadas na criação** — mudar o fluxo depois não afeta solicitações em andamento.
- Tabela existente (`supabase_migration_remarcacao.sql`):
  ```sql
  solicitacoes_rh_etapas(
    id uuid pk, solicitacao_id uuid fk, ordem int, aprovador_id uuid fk colaboradores,
    papel text, tipo_etapa text default 'aprovacao', status text default 'pendente',
    justificativa text, decidido_em timestamptz, created_at timestamptz)
  -- RLS habilitado, policy anon_all_etapas (using true / with check true)
  ```

---

## 2. Decisões fechadas (grill com o usuário)

> **MODELO FINAL = SIMPLIFICADO.** O usuário escolheu o modelo simplificado, que **sobrepõe Q3 e Q4**: aprovadores **só entre gestores/admin**; execução final **sempre o admin**, acrescentada automaticamente (não configurável); **usuário comum nunca entra na cadeia → sem tela nova pra ele**.

| # | Decisão | Escolha (FINAL) |
|---|---------|---------|
| 1 | Granularidade | Por **(solicitante, tipo)** e, no desligamento, **por iniciativa** (empresa/empregado) → até 3 cadeias por pessoa |
| 2 | Fallback sem config | **Bloqueia a criação** (mensagem clara pedindo config ao admin) |
| 3 | Quem pode ser etapa de aprovação | ~~Qualquer colaborador~~ → **só gestores/admin** (sobreposto pela Q8) |
| 4 | Etapa de execução final | ~~Executor escolhível~~ → **sempre o admin**, acrescentada pelo código (sobreposto pela Q8) |
| 5 | Solicitante na própria cadeia | **Auto-aprovar** a etapa dele (mantém comportamento atual) |
| 6 | Observadores (ciência) | **Não** na v1 (só aprovações + execução) |
| 7 | Tela do admin | **Nova página "Fluxos de Aprovação"**: escolhe solicitante → 3 blocos editáveis (só lista ordenável de aprovadores; **sem** select de executor). Marcador de quem já tem cadeia |
| 8 | Onde cada um age | Gestor aprovador usa a tela que **já tem**; admin executa na tela que **já tem**. **Sem tela nova p/ usuário; sem execução na tela do gestor.** |
| 9 | Escape hatch (fluxo travado) | **v1** — admin pode reatribuir a etapa atual / forçar avanço em `AdminSolicitacoes` |

---

## 3. Modelo de dados

### 3.1 Nova tabela `solicitacoes_rh_fluxos` (config das cadeias)
> **Revisado (achado C1/C2 dos revisores):** `iniciativa` é **`NOT NULL DEFAULT ''`** (sentinela `''` para aumento) com **constraint composta normal** — assim o `upsert onConflict` funciona (PostgREST não consegue `ON CONFLICT` em índice de expressão `coalesce(...)`, e `.eq('iniciativa', null)` não casa com `NULL` no PostgREST). Isso elimina os 3 problemas de uma vez.
```sql
create table if not exists public.solicitacoes_rh_fluxos (
  id              uuid primary key default gen_random_uuid(),
  solicitante_id  uuid not null references public.colaboradores(id) on delete cascade,
  tipo            text not null check (tipo in ('aumento_salario','desligamento')),
  iniciativa      text not null default '' check (iniciativa in ('', 'empresa','empregado')),
  aprovadores     jsonb not null default '[]'::jsonb check (jsonb_typeof(aprovadores) = 'array'),
  updated_at      timestamptz default now(),
  created_at      timestamptz default now(),
  constraint uniq_fluxo unique (solicitante_id, tipo, iniciativa)
);
-- NB: sem executor_id — execução final é SEMPRE o admin (APROVADORES.admin),
-- acrescentada pelo código em montarEtapasDeConfig.

grant all on public.solicitacoes_rh_fluxos to anon, authenticated;
alter table public.solicitacoes_rh_fluxos enable row level security;
drop policy if exists "anon_all_fluxos" on public.solicitacoes_rh_fluxos;
create policy "anon_all_fluxos" on public.solicitacoes_rh_fluxos
  for all to anon, authenticated using (true) with check (true);
```
- **Convenção `iniciativa`**: `''` para `aumento_salario`; `'empresa'`/`'empregado'` para `desligamento`. Nunca `NULL`. `buscarFluxo` usa `.eq('iniciativa', iniciativa ?? '')` e o upsert usa `onConflict: 'solicitante_id,tipo,iniciativa'`.
- **`updated_at`** é setado **explicitamente** no payload do upsert (não há trigger).
- **`aprovadores`** = array ordenado de uuid **em texto, lowercase** (normalizar nos dois lados ao comparar com `criadorId`/`user.id`).
- **`executor_id` `on delete restrict`** impede apagar um colaborador ainda usado como executor.

**Por que jsonb ordenado e não tabela normalizada de etapas-config?** As etapas reais já são "fotografadas" em `solicitacoes_rh_etapas` na criação. A config é só um molde; um array ordenado é suficiente, mais simples de ler/gravar e evita uma 2ª tabela. Trade-off: perde-se FK por aprovador → compensar validando os ids (ativos) no `AdminFluxos` **e** dentro de `montarEtapasDeConfig`.

### 3.2 `solicitacoes_rh_etapas` — sem mudança de schema
- `papel` passa a guardar **o nome do colaborador** no momento da criação (snapshot), p/ a timeline mostrar qualquer pessoa corretamente.

---

## 4. Mudanças no código (arquivo a arquivo)

### 4.1 `src/config/aprovacao.js`
- **Manter** `APROVADORES`, `NOME_APROVADOR`, `nomeAprovador`, `etapaAtual`, `acaoDisponivel`, `resumoAndamento`. (A execução final usa `APROVADORES.admin`, então **não** removemos isso.)
- **Corrigir** `resumoAndamento`: usar `atual.papel` (nome snapshot) e cair em `nomeAprovador(aprovador_id)` só como fallback. Idem para a frase de reprovação (`rep.papel`).
- **Novo** `montarEtapasDeConfig(solicitacaoId, aprovadores, criadorId, nomePorId)`:
  - Sanitiza `aprovadores`: descarta ids vazios/inválidos (não confiar só na UI).
  - Para cada `aprovadores[i]` (ordem `i+1`): `tipo_etapa='aprovacao'`, `papel = nomePorId[id]`, `status = (id===criadorId ? 'auto_aprovada' : 'pendente')`, `decidido_em` correspondente. Se `papel` não resolver → **abortar** (não gravar etapa sem nome).
  - **Etapa final automática**: `aprovador_id = APROVADORES.admin`, `ordem = aprovadores.length+1`, `tipo_etapa='execucao'`, `status='pendente'`, `papel = 'Admin (execução)'`. Sempre o admin.
- **Novo** `async buscarFluxo(supabase, solicitanteId, tipo, iniciativa)`: `.eq('solicitante_id', id).eq('tipo', tipo).eq('iniciativa', iniciativa || '').maybeSingle()`. Retorna `{ fluxo, erro }` — **distinguir erro Supabase de não-encontrado** (erro ≠ bloqueio).
- `montarFluxo`/`montarEtapasParaInsercao` hardcoded: **removidos** — fallback agora é bloqueio. Conferir imports (`GestorSolicitacoes` importa `montarEtapasParaInsercao`).

### 4.2 Criação da solicitação — `src/pages/Gestor/GestorSolicitacoes.jsx`
- **Pré-checagem (UX)**: no **mount**, checar fluxo p/ os 3 casos do user; ao trocar iniciativa (desligamento), re-checar. Sem fluxo p/ o caso ativo → **desabilitar enviar** + chip "Fluxo não configurado" no cabeçalho da aba, antes de preencher.
- **No submit**:
  1. `buscarFluxo(...)`. `erro` → mensagem genérica; `fluxo` nulo → mensagem de bloqueio ("admin não configurou / fluxo alterado, recarregue").
  2. Resolver nomes dos ids de `aprovadores` em `colaboradores` → `nomePorId`.
  3. **Criação atômica**: inserir solicitação + etapas via **RPC** `criar_solicitacao_com_etapas` (ou, mínimo, delete compensatório da solicitação se o insert das etapas falhar). Etapas vêm de `montarEtapasDeConfig`.
- Remover import de `montarEtapasParaInsercao`.

### 4.3 Nova página admin — `src/pages/Admin/AdminFluxos.jsx` (+ CSS)
- Solicitantes = colaboradores `perfil='gestor'`, ordenados por nome. Marcador ✅/⚠️ de quem tem 0..3 cadeias.
- **Pool de aprovadores** = colaboradores ativos com `perfil in ('gestor','admin')` (modelo simplificado).
- Select de solicitante → carrega os até 3 registros de `solicitacoes_rh_fluxos`. **3 blocos**:
  1. Retirada / prestação (`tipo='aumento_salario'`, `iniciativa=''`)
  2. Desligamento (empresa) (`tipo='desligamento'`, `iniciativa='empresa'`)
  3. Desligamento (empregado) (`tipo='desligamento'`, `iniciativa='empregado'`)
- Cada bloco: lista **ordenável** de aprovadores (select do pool), **+ etapa / remover / subir / descer**; **sem** select de executor (texto fixo: "Execução: Admin (automático)"). Botão **Salvar** → `upsert` `onConflict: 'solicitante_id,tipo,iniciativa'`, com `updated_at` explícito e `iniciativa` coagido a `''|'empresa'|'empregado'`.
- **Validação ao salvar**: ids não-vazios, **todos ativos**; marcar visualmente cadeia com gente inativa. Cadeia vazia = vai direto à execução do admin (avisar que é permitido).

### 4.4 Rotas — `src/routes/AppRoutes.jsx`
- `+ /admin/fluxos` (`ProtectedRoute allowedRoles={['admin']}`) → `AdminFluxos`.
- (Sem rota nova p/ usuário; gestor já tem `/gestor/solicitacoes/acompanhar`.)

### 4.5 Sidebar — `src/components/Layout/Sidebar.jsx`
- `admin`: + item **"Fluxos de Aprovação"** (ícone `Workflow`/`GitBranch`) → `/admin/fluxos`.
- `gestor` e `usuario`: **sem mudança**.

### 4.6 Escape hatch (fluxo travado) — `src/pages/Admin/AdminSolicitacoes.jsx`
- Para a **etapa atual** (`etapaAtual`) de uma solicitação pendente, o admin ganha 2 ações:
  - **Reatribuir**: trocar `aprovador_id` (e `papel`) da etapa atual p/ outro colaborador ativo.
  - **Forçar avanço**: marcar a etapa atual como `aprovada` (ou `executada` se for a de execução) com nota de que foi ação do admin.
- Útil quando o responsável foi inativado/saiu. Registrar em `justificativa` algo como "Avanço forçado pelo admin".

### 4.7 Guardas server-side (todas as ações de etapa) — `aprovar`/`reprovar`/`executar`
- Em **`GestorSolicitacoes`** (modo acompanhar) e **`AdminSolicitacoes`**: toda atualização de etapa passa a filtrar `.eq('aprovador_id', user.id).eq('status','pendente')` (exceto o escape hatch do admin, que é intencionalmente sobreposto) e checar linhas afetadas; 0 linhas → "etapa já tratada, atualize a página".
- Execução: idealmente RPC atômica; mínimo guarda `.eq('status','pendente')` + tratar falha do 2º update.
- `AdminSolicitacoes`: manter checagens por `APROVADORES.admin` (execução é sempre admin) — **não** precisa trocar p/ `user.id` no modelo simplificado.

### 4.8 Limpeza compartilhada (baixo custo, antes de tocar nas telas)
- Extrair `parseDesligamento` → `utils/formatters.js` e `TIPO_LABEL` → `config/aprovacao.js` (hoje duplicados em Gestor/Admin). Evita 3ª cópia.

---

## 5. Edge cases & riscos

1. **Solicitante sem cadeia** → bloqueio na criação (pré-checagem + checagem no submit). Mensagem clara.
2. **Config alterada depois** → não afeta solicitações em andamento (snapshot em `etapas`). Documentar no app.
3. **Aprovadores vazios (só executor)** → vai direto à execução. (Assumir válido.)
4. **Solicitante aparece como aprovador** → auto-aprovação (decisão 5). Se aparecer várias vezes, todas auto-aprovam.
5. **Mesma pessoa 2x na cadeia** (A→B→A) → funciona por `ordem`; ela age duas vezes em momentos distintos.
6. **Executor == solicitante** → execução **não** auto-aprovada; ele executa manualmente.
7. **Colaborador inativado depois de entrar numa cadeia em andamento** → etapa guarda `aprovador_id` + `papel` (nome snapshot); a ação depende dele conseguir logar. Risco operacional, não de dados.
8. **Nomes na timeline/resumo** → resolver via `papel` (snapshot). Corrigir `resumoAndamento`.
9. **RLS** → nova tabela com policy anon (mesmo padrão das demais). ⚠️ Observação de segurança: o app inteiro usa anon + filtro no cliente; este recurso amplia *quem pode ver/agir* — confirmar que isso é aceitável no modelo atual (não piora além do que já existe).
10. **Reprovação no meio** → encerra a solicitação (mantém comportamento).
11. **Concorrência** → dois aprovadores agindo "ao mesmo tempo" em etapas diferentes: como avança por menor ordem pendente, sem corrida real. Execução dupla evitada porque só há 1 etapa de execução.
12. **Migração de solicitações já existentes** (criadas no modelo antigo) → continuam funcionando (etapas já gravadas). Só novas criações exigem config.

---

## 6. Entregáveis / ordem de implementação (1 passo por vez, mostrando ao usuário)

1. ✅ **SQL** `supabase_migration_fluxos.sql` (tabela config, sem executor_id). + RPC `criar_solicitacao_com_etapas` (atômica) — pode vir junto ou no passo 4.
2. **Limpeza**: extrair `parseDesligamento`/`TIPO_LABEL` (4.8).
3. **`aprovacao.js`**: `buscarFluxo`, `montarEtapasDeConfig` (execução = admin automático), fix `resumoAndamento`. **Ainda não** remover o hardcoded.
4. **`AdminFluxos.jsx`** + rota `/admin/fluxos` + item sidebar admin (4.3/4.4/4.5).
5. **Criação** (`GestorSolicitacoes.jsx`): pré-checagem + bloqueio + submit via config/RPC (4.2). **Gate:** configurar as cadeias no AdminFluxos antes de remover o hardcoded.
6. **Guardas** server-side nas ações (4.7).
7. **Escape hatch** no `AdminSolicitacoes` (4.6).
8. **Remover** `montarFluxo`/`montarEtapasParaInsercao` hardcoded.
9. **Build** (`npx vite build`) + lint + testes manuais a cada passo.

---

## 7. Roteiro de testes manuais

- [ ] Admin cria cadeia p/ Julio (retirada): Maria→João (ambos gestores). Salva e recarrega → persiste.
- [ ] Julio sem cadeia de desligamento(empresa) → ao abrir a aba já mostra "Fluxo não configurado" e enviar desabilitado.
- [ ] Julio cria retirada → etapas Maria→João→**Admin(execução)**; timeline mostra nomes certos.
- [ ] Maria (gestora aprovadora) vê na tela dela, aprova → passa pro João. (Guarda: 2ª aprovação concorrente → "etapa já tratada".)
- [ ] João aprova → vai pro Admin executar (na tela do Admin).
- [ ] Admin executa → solicitação "Concluída".
- [ ] Cadeia com o próprio Julio como aprovador → etapa dele nasce auto-aprovada.
- [ ] Reprovação no meio → solicitação "Reprovada", todos veem o motivo.
- [ ] Alterar cadeia do Julio não muda solicitação já em andamento.
- [ ] Escape hatch: aprovador inativado → admin reatribui/força avanço e o fluxo segue.
- [ ] Falha no insert das etapas → solicitação não fica órfã (RPC atômica / delete compensatório).

---

## 7.1 Ajustes incorporados da revisão (3 IAs) — OBRIGATÓRIOS

**Banco / criação (atomicidade e integridade):**
- [C2-data] `iniciativa NOT NULL DEFAULT ''` + unique composta (já aplicado na §3.1). `buscarFluxo` usa `.eq('iniciativa', iniciativa || '')` e **`.maybeSingle()`**; distinguir **erro Supabase** de **não-encontrado** (erro ≠ bloqueio).
- [C4-data] Criação **atômica**: inserir solicitação + etapas numa **RPC Postgres** (`criar_solicitacao_com_etapas`) OU, mínimo, **delete compensatório** da solicitação se o insert das etapas falhar (evita solicitação órfã sem etapas, que trava em "Em andamento" pra sempre).
- [C3-data] `montarEtapasDeConfig` valida/descarta ids vazios/ inválidos (não confiar só na UI); se um nome não resolver, **abortar** criação (não gravar etapa sem `papel`).
- [I2/I3-data] CHECKs de `tipo`/`iniciativa`/`jsonb array` (já na §3.1).

**Concorrência / ação (guardas server-side):**
- [C2-sec] **Toda** atualização de etapa (`aprovar`/`reprovar`/`executar`, em todas as telas) passa a filtrar `.eq('aprovador_id', user.id).eq('status','pendente')` e checar linhas afetadas; se 0, avisar "etapa já tratada, atualize a página". Vale p/ `AdminSolicitacoes`, gestor e a nova tela do usuário.
- [C3-sec] Execução (`etapa→executada` + `solicitacao→concluida`) idealmente via **RPC** atômica; mínimo: guarda `.eq('status','pendente')` e tratar falha do 2º update.

**Nomes (snapshot):**
- [C4-sec] Corrigir `resumoAndamento` **e a linha de reprovação** (`rep.papel`) p/ usar `papel`; `nomeAprovador` só fallback. Validar `papel` não-vazio na criação.

**Arquitetura React (menor risco de regressão):**
- [N1/N2-sec] Extrair `parseDesligamento` p/ `utils/formatters.js` e `TIPO_LABEL` p/ `config/aprovacao.js` (hoje duplicados). Sem componente compartilhado novo no modelo simplificado.

**UX / rollout:**
- [C1-ux] Pré-checagem de fluxo **no mount p/ os 3 tipos** (não só ao trocar iniciativa); chip "Fluxo não configurado" no cabeçalho da aba **antes** de preencher; desabilitar enviar.
- [C2-ux] **Ordem de rollout (gate):** criar AdminFluxos + **configurar todas as cadeias** ANTES de remover o hardcoded. Área admin mostra "X gestores sem fluxo".
- [I1-ux] Solicitantes no AdminFluxos = **gestores**; mensagem distingue "não configurado" de "perfil não pode criar".
- [I2-ux] Após enviar, banner de sucesso com link **"Ver andamento"** (vai pro acompanhar).
- [E2/E3-ux] No salvar do AdminFluxos, **validar que os aprovadores estão ativos**; marcar cadeia com gente inativa. Na submissão, distinguir "fluxo alterado, recarregue" de erro de DB.

**Segurança (registrar + endurecer barato):**
- [C1-sec] App é anon + filtro no cliente; v1 mantém o padrão, **mas** as guardas `.eq('aprovador_id',...).eq('status','pendente')` já barram a maioria dos acidentes. Opcional: policy de UPDATE em `solicitacoes_rh_etapas` por identidade — decidir depois.

## 7.2 Lacuna conhecida → **v1.1 (decidido)**
- **Escape hatch p/ fluxo travado**: se um aprovador for inativado no meio, a etapa trava. Ação admin "reatribuir / forçar avanço" fica pra **v1.1**. Workaround v1: reativar a pessoa ou recriar a solicitação.

## 8. Pontos em aberto p/ revisão das outras IAs

1. jsonb ordenado vs tabela normalizada de passos de config — concordam com jsonb?
2. Bloquear criação (decisão do usuário) cria risco de travar todos até o admin configurar — vale um "modo permissivo" temporário? (usuário escolheu bloquear; só sinalizar.)
3. Extrair `AcompanharSolicitacoes` compartilhado vs duplicar — melhor abordagem p/ minimizar regressão?
4. Generalizar `AdminSolicitacoes` p/ `user.id` pode mudar contagens — algum efeito colateral?
5. Segurança RLS anon (padrão do app) com aprovadores arbitrários — algo a endurecer agora?
6. Falta algum ponto de avanço de fluxo / status não tratado (ex.: `auto_aprovada` na contagem da etapa atual)?
