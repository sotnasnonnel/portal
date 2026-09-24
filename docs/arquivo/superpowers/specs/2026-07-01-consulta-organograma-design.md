# Consulta Organograma — Design

**Data:** 2026-07-01
**Status:** Aprovado (aguardando revisão do spec)

## Objetivo

Adicionar a tela **Consulta Organograma** (hoje `em_breve` em `src/config/requisicoes.js`)
como uma visualização read-only que mostra, por mês, em quais contratos cada colaborador
está alocado, com que percentual, e quem é o gerente responsável.

## Origem dos dados

Projeto Supabase **separado**: `backoffice_phd` (ref `dvvqgoxqawyhycakppps`), NÃO o banco do
Portal. Já configurado:

- Client read-only dedicado: `src/services/supabaseBackoffice.js` (`persistSession:false`),
  usando `VITE_BACKOFFICE_SUPABASE_URL` / `VITE_BACKOFFICE_SUPABASE_ANON_KEY`.
- RLS: policies de `SELECT` para role `anon` nas tabelas de consulta (migração
  `organograma_anon_read_only` aplicada no backoffice). Leitura confirmada.

### Modelo (alocação, não "chefe direto")

```
organograma_gerente (14)      gerente + produto
organograma_obra (78)         cod_phd, gerente, produto, cccod, status
organograma_colaborador (161) id, nome, gerente, obra, tipo_fopag, tipo_sede
organograma_alocacao (1275)   colaborador_id × obra_cod_phd × mes, percentual, data_inicio/fim
```

FKs relevantes: `alocacao.colaborador_id → colaborador.id`,
`alocacao.obra_cod_phd → obra.cod_phd`, `colaborador.gerente → gerente.gerente`.

### Realidade dos dados (verificada)

- `percentual` é **NULL em 1.246 de 1.275 linhas (98%)**.
- Faixa de meses: **2026-01 a 2027-03** (15 meses distintos).
- Um colaborador pode ter **várias linhas no mesmo mês** (múltiplos contratos).
- `organograma_obra` não tem nome descritivo do contrato — o identificador é o código
  `cod_phd` (ex.: `AURI-CT01-GERE`, `CORP>ADM`).

## Escopo funcional

### Roteamento / integração

- Em `src/config/requisicoes.js`: mudar o item `consulta-organograma` de
  `status: 'em_breve'` para `status: 'pronto'`. Remove o badge "Em breve" no hub.
- O dispatcher `src/pages/Gestor/requisicoes/NovaRequisicao.jsx` passa a renderizar o
  componente `ConsultaOrganograma` quando `slug === 'consulta-organograma'` (as demais
  requisições continuam abrindo seus formulários). Como é uma consulta e não um formulário,
  ela não grava nada nem usa `tipoDb`.
- Acesso: qualquer usuário logado na área do Gestor. Visão geral de **todos** os
  colaboradores (sem recorte por equipe do gestor logado).

### Componente

`src/pages/Gestor/requisicoes/ConsultaOrganograma.jsx` — página read-only.

**Carga de dados (via `supabaseBackoffice`):**

- Ao trocar o mês, consulta `organograma_alocacao` filtrando por `mes`, com embed das FKs:
  ```
  select=percentual,obra_cod_phd,
         colaborador:organograma_colaborador(nome,gerente)
  &mes=eq.<YYYY-MM-01>
  &order=colaborador(nome)
  ```
  (Gerente vem de `colaborador.gerente`; contrato é `obra_cod_phd`.)
- Mês padrão = mês atual se existir na base; senão o mês mais recente disponível.
- A lista de meses disponíveis é obtida uma vez (distinct `mes`) para popular o seletor.
- Dropdowns de **Gerente** e **Contrato** e a **busca por nome** filtram no cliente
  (~85 linhas/mês, volume leve). As opções dos dropdowns derivam do resultado do mês.

**Layout:**

- Barra de filtros: `Mês ▾ · Gerente ▾ · Contrato ▾ · 🔍 busca por nome`.
- Contador de resultados (ex.: "84 alocações · 63 colaboradores").
- Tabela — **1 linha por alocação**:

  | Colaborador | Contrato | % | Gerente |
  |---|---|---|---|
  | ADAILTON ANDRADE | AURI-CT01-GERE | — | Paulo Paiva |
  | ADAILTON ANDRADE | GOIA-CT01-GERE | — | Paulo Paiva |

  - Coluna `%`: mostra `percentual` quando existir; senão `—`.
  - Colaborador em N contratos no mês → N linhas.

**Estados:**

- Carregando: spinner.
- Vazio: "Sem alocações neste mês."
- Erro de rede: mensagem + botão "Tentar de novo".

### Estilo

Seguir os padrões visuais das telas existentes de requisições (`Gestor.css`,
`Requisicoes.css`), tema terracota do Portal.

## Fora de escopo (YAGNI)

- Exportar CSV.
- Edição de alocação (a tela é somente leitura).
- Coluna Produto (removida a pedido).
- Coluna de liderança da obra (`lider_phd` / `ger_exec` / `ger_phd`).
- Percentual inferido (100 ÷ nº de contratos). Fica só o % real do banco.
- Visão matriz Colaborador × Mês e visão por colaborador único.

## Dívida conhecida (fora deste trabalho)

`organograma_alocacao` tem uma policy antiga role `public` cmd `ALL USING(true)` que
permite anon INSERT/UPDATE/DELETE. Revisar em separado (relacionado à dívida de RLS do PHD).
