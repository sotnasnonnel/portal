# Perfil Coordenador no módulo Gestão de Pessoas (DP)

**Data:** 2026-07-07
**Status:** Aprovado

## Objetivo

Criar o papel **Coordenador** no módulo DP: um nível intermediário entre Gestor e
usuários. O Coordenador tem os mesmos poderes do Gestor, limitados à equipe dele.
O Gestor acima de um Coordenador enxerga (e aprova) também as pessoas da equipe
do Coordenador.

## Decisões (confirmadas com o usuário)

1. **Poderes:** iguais aos do Gestor — Dashboard, Minha Equipe, Aprovações de
   ausência, Gestão de Ausência, Minha Ausência, Requisições DP (criar e
   acompanhar) e a aba Organograma. Sempre limitado à equipe dele.
2. **Aprovações:** as pendências de ausência da equipe do Coordenador aparecem
   para o Coordenador **e** para o Gestor acima; qualquer um dos dois pode
   aprovar. A ausência do próprio Coordenador é aprovada pelo Gestor.
3. **Hierarquia:** um nível de coordenação só. Superior do Coordenador é sempre
   um Gestor; superior de um usuário pode ser Gestor ou Coordenador; Gestor não
   tem superior. A implementação de travessia é recursiva, então liberar cadeias
   mais fundas no futuro é mudança só de regra de cadastro.

## Contexto atual

- Hierarquia em `colaboradores.superior_id` (FK auto-referente), um nível.
- Perfis em `colaboradores.perfil`: `'admin' | 'gestor' | 'usuario' | null`;
  flag `rh_dp` gera o perfil efetivo `'rh'` (`AuthContext.jsx:121`).
- 6 consultas filtram equipe por `.eq('superior_id', user.id)`:
  `GestorEquipe.jsx:22`, `GestorDashboard.jsx:35`, `GestorAprovacoes.jsx:27`,
  `GestorAusencia.jsx:64`, `Layout.jsx:41` (badge), `useRequisicaoForm.js:27`.
- RLS (`supabase_migration_rls_dp.sql`): helper `app_private.manages(target)`
  = "sou superior DIRETO de target" (linha 39); policies de `colaboradores` e
  `ciclos_ausencia` dependem dele.
- Cadastro (AdminCadastro/AdminListagem): selects de perfil hardcoded
  `usuario|gestor`; "Superior" lista só gestores; gestor grava `superior_id=null`.
- Requisições DP usam cadeia explícita de `aprovador_id`
  (`solicitacoes_rh_fluxos`), independente de `superior_id`.

## Design

### Banco (nova migração `supabase_migration_coordenador.sql`, aplicada via MCP)

- `app_private.descendentes(raiz uuid) returns setof uuid` — CTE recursiva sobre
  `superior_id`, `SECURITY DEFINER`, `search_path` fixo. Devolve todos os
  descendentes (não inclui a própria raiz).
- RPC pública `get_minha_equipe() returns setof uuid` — descendentes do
  colaborador logado (`app_private.my_colaborador_id()`). `SECURITY DEFINER`,
  grant para `authenticated`.
- `app_private.manages(target uuid)` passa a "sou **ancestral** de target"
  (usa `descendentes`). Policies existentes de `colaboradores_select` e
  `ciclos_ausencia` (select/update) passam a valer para toda a subárvore sem
  reescrita — o gestor lê e aprova a equipe dos coordenadores.
- A policy `colaboradores_select` troca a condição direta
  (`superior_id = my_colaborador_id()`) por `manages(id)`.
- `perfil` continua text livre; `'coordenador'` é regra de aplicação.

### AuthContext (`src/contexts/AuthContext.jsx`)

- `perfilEfetivo`: `rh_dp` só sobrepõe quando o perfil não é
  `gestor`/`admin`/`coordenador`.
- `modules.dp` liberado também para `'coordenador'`.

### Rotas (`src/routes/AppRoutes.jsx`)

- `'coordenador'` entra nos `allowedRoles` de: `/gestor`, `/gestor/aprovacoes`,
  `/gestor/aprovacoes/:id`, `/gestor/equipe`, `/gestor/ausencia`,
  `/gestor/minha-ausencia`, `/gestor/solicitacoes/nova`,
  `/gestor/solicitacoes/nova/:tipo`, `/gestor/solicitacoes/acompanhar`,
  `/organograma`.

### Menu (`src/components/Layout/Sidebar.jsx`)

- `menuConfig.coordenador` = mesma estrutura do menu do gestor (Dashboard,
  Minha Equipe, grupo Ausências, grupo Requisições DP, Organograma).
- `perfilLabel.coordenador = 'Coordenador'`.
- Badges do `Layout.jsx` valem para coordenador como valem para gestor.

### Hook compartilhado `useEquipeIds()` (`src/hooks/useEquipeIds.js`)

- Chama a RPC `get_minha_equipe()` uma vez e devolve
  `{ ids, loading, error }`. Para coordenador retorna a equipe direta; para
  gestor inclui as equipes dos coordenadores abaixo.
- As 6 consultas por `superior_id` passam a buscar colaboradores com
  `.in('id', ids)` (ou `.in('colaborador_id', ids)` nas tabelas de ausência).
- Fallback: se a RPC falhar, comportamento atual (`.eq('superior_id', user.id)`)
  NÃO é mantido — o erro é exibido como já se exibem erros de carga nas telas.

### Cadastro (AdminCadastro.jsx e AdminListagem.jsx)

- Select de Perfil: opções `Usuário`, `Coordenador`, `Gestor`.
- Regra de superior:
  - `gestor` → sem superior (grava `null`), como hoje;
  - `coordenador` → superior obrigatório, lista **só gestores**;
  - `usuario` → superior obrigatório, lista **gestores e coordenadores**.
- `AdminListagem` mostra o perfil "Coordenador" na listagem/edição com as mesmas
  regras.

### Requisições DP

- Sem mudança estrutural: coordenador cria requisições (as telas passam a
  aceitá-lo via rotas/menu) e o molde de aprovação dele é configurado pelo admin
  em Fluxos de Aprovação, como para qualquer solicitante.

## Fora de escopo

- Cadeias de coordenação com mais de um nível (regra de cadastro impede; a
  travessia recursiva já suportaria).
- Mudanças nos fluxos de requisições DP (`config/aprovacao.js`, AdminFluxos).
- Módulos `reembolso` e `solic`.
- Organograma (backoffice) — inalterado; coordenador só ganha acesso à aba.

## Testes / verificação

- Testes `node --test` para helpers puros novos (ex.: regras de superior por
  perfil extraídas para função pura, se aplicável).
- SQL verificado com queries de sanidade via MCP (descendentes de um gestor de
  teste incluem a equipe do coordenador; `get_minha_equipe()` para um
  coordenador devolve só os diretos).
- Verificação manual: coordenador loga e vê o menu completo limitado à equipe
  dele; gestor vê equipe direta + equipe do coordenador nas 6 telas; ambos veem
  e aprovam pendências da equipe do coordenador; cadastro oferece os selects
  novos com as regras de superior.
