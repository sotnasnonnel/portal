# Motor de Alçadas — Documento de Alçadas e Aprovações (Parte 3)

Mapeamento regra → implementação, o que já está pronto e o que falta.
Fonte: "DOCUMENTO DE ALÇADAS E APROVAÇÕES – PARTE 3 (CONSOLIDADO)".

---

## 1. Arquitetura em três camadas

A decisão central foi **separar regra de pessoa**. Sem isso, cada troca de
diretoria vira deploy e cada faixa nova vira `if` espalhado pelos formulários.

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| **Regra** (pura, testada) | `src/config/alcadas.js` | Tabelas, faixas, +1 nível, gatilhos. Não conhece Supabase nem React. Responde em **papéis simbólicos**. |
| **Pessoa** (banco) | `supabase_migration_alcadas.sql` → RPC `alcadas_resolver_papeis` | Traduz papel → colaborador, subindo a cadeia `superior_id`. |
| **Ponte** | `src/services/alcadas.js` | Chama a RPC, monta as etapas, grava a trilha de auditoria. |

Testes: `src/config/alcadas.test.js` — 35 casos cobrindo todas as faixas,
limites, acúmulo de modificadores e a Trava Headcount.

---

## 2. Papéis: como cada um resolve

Ordem de precedência: **atribuição manual** (`alcadas_papeis`) > **cadeia
hierárquica** > **função no cadastro** > **lacuna** (bloqueia).

| Papel | Resolução | Pessoa hoje |
|---|---|---|
| `GERENTE` | superior direto (`superior_id`) | varia por solicitante |
| `GERENTE_EXECUTIVO` | 1º "GERENTE EXECUTIVO" subindo a cadeia | Bruno Azevedo, Leonardo Drumond |
| `DIRETOR_AREA` | 1º diretor/CEO subindo a cadeia | Morais ou Henrique |
| `CEO` | atribuído / `funcao = 'CEO'` | Pedro Nery |
| `COO` | atribuído / `DIRETOR DE OPERAÇÕES` | Pedro Morais |
| `DIRETOR_COMERCIAL` | atribuído / `Diretor Comercial` | Henrique Santos |
| `GERENTE_FINANCEIRO` | atribuído / `GERENTE FINANCEIRO` | Daniela Sebrian |
| `FINANCEIRO` | `financeiro_role = 'admin'` | Daniela, Alessandra, Marcus |
| `RH` | `rh_dp = true` | time de G&C |
| `JURIDICO` | **só atribuição manual** | ⚠️ **ninguém** |
| `CONSELHO` | **só atribuição manual** | ⚠️ **ninguém** |

> **Papel sem ninguém não é silêncio.** A RPC devolve `origem='NAO_ATRIBUIDO'`
> e o front barra o envio com mensagem explícita. Omitir a linha deixaria a
> solicitação seguir sem o aprovador exigido — exatamente a falha que o
> documento existe para impedir (§6, pilar 3).

---

## 3. Tabelas implementadas

### §2.1 Compras e Despesas — `TABELA_COMPRAS`
| Nível | Faixa | Aprovador |
|---|---|---|
| 1 | até R$ 2.000 | Gerente (superior direto) |
| 2 | R$ 2.000,01 – 5.000 | Gerente Executivo |
| 3 | R$ 5.000,01 – 20.000 | **Dupla**: COO + Gerente Financeiro |
| 4 | R$ 20.000,01 – 50.000 | CEO |
| 5 | acima de R$ 50.000 / CAPEX | Conselho / Sócios |

### §3 Contratos
Mesmas faixas, valor enquadrado por `valorEnquadramentoContrato`:
pontual = total; recorrente = **mensal × 12**.

### §4.1 Pagamentos — `TABELA_PAGAMENTOS`
Orçado → Financeiro executa sem aprovação. Não orçado: ≤5k Gerente Executivo +
Financeiro · 5k–20k COO + Financeiro · >20k CEO.

### §1 Comercial — `TABELA_COMERCIAL_HUNTER` / `_FARMER`
Segregação Hunter/Farmer preservada: origens diferentes têm aprovadores
diferentes na mesma faixa.

### §5 Gente & Cultura — `CASOS_GENTE_CULTURA`
Por situação, não por valor. Liderança divide por área (Backoffice → CEO,
Operação → COO).

---

## 4. Modificadores e gatilhos

**Modificadores (+1 nível, acumulam):** `fora_orcamento` (§2.1),
`prazo_maior_12m` (§3.2), `multa_rescisoria_relevante` (§3.2).

**Gatilhos (não somam degraus):** `capex_relevante` (força nível 5),
`clausula_atipica` (parecer bloqueante do Jurídico, §3.3), `aplicacao_relevante`,
`distribuicao_lucros`, `mc_ll_abaixo_piso`, `desconto_fora_tabela`,
`lta_estrategico`.

---

## 5. Os 5 pilares do §6

| # | Pilar | Onde |
|---|---|---|
| 1 | Classificação obrigatória | `ClassificacaoAlcada.jsx` (categoria + dentro/fora) + CHECK em `supabase_migration_alcadas_obrigatoria.sql` |
| 2 | Workflow por faixa | `avaliarAlcada` → `resolverPapeis` → `montarEtapasAlcada`. Prévia ao vivo no formulário. |
| 3 | Bloqueio de avanço | `etapaAtualFin` + guarda `.eq('status','pendente')` + lacuna de papel barra a criação |
| 4 | Trilha de auditoria | `alcadas_auditoria` — imutável (sem policy de UPDATE/DELETE) |
| 5 | Alerta de exceção e SLA | `alcada_excecoes` + `alcadas_sla` + view `alcadas_sla_estourado` |

---

## 6. Decisões que tomei e por quê

1. **Modificadores acumulam.** O documento define cada um isoladamente como
   "+1 nível" e não diz o que fazer quando dois incidem. Acumular é a leitura
   conservadora e coerente com a premissa de governança. Teto = último nível.

2. **Faixa comercial 1M–2M** (⚠️ **assumida**). O documento salta de "até
   R$ 1.000.000" para "acima de R$ 2.000.000". Adotei: tudo acima de 1M já
   exige o nível 2. A alternativa deixaria uma proposta de R$ 1,5 mi aprovada
   por uma pessoa só — o oposto da premissa Hunter/Farmer. **Confirmar.**

3. **Backoffice × Operação** herda da cadeia: se o COO está entre os superiores
   → Operação; senão → Backoffice. Override manual em `colaboradores.area_alcada`.
   O cadastro não tem coluna de área e a inferência acerta os casos reais
   conferidos.

4. **`aprovadoresPorValor` removida.** As 3 faixas antigas divergem da tabela
   nova (que tem R$ 2.000 e R$ 50.000, e separa Gerente de Gerente Executivo).
   Manter as duas seria garantir divergência.

5. **Aumento de Limite enquadra pelo novo limite total**, não pelo incremento —
   mantém a convenção já existente do módulo e é o enquadramento mais conservador.

6. **CHECK de classificação em migração separada.** Aplicá-lo antes de o front
   subir quebraria a criação de solicitações em produção.

---

## 7. Papéis de GRUPO e o colapso no DP

`FINANCEIRO`, `RH`, `JURIDICO` e `CONSELHO` podem ter várias pessoas. Os dois
módulos tratam isso de forma diferente, por limitação de schema:

- **Financeiro** — vira uma etapa aberta (`aprovador_id` NULL + `papel_codigo`):
  qualquer um do grupo age, o primeiro resolve.
- **DP** — `solicitacoes_rh_etapas` não tem `papel_codigo`, e `acaoDisponivel`
  só casa por `aprovador_id`. Uma etapa aberta travaria o fluxo sem ninguém
  habilitado. Por isso o grupo **colapsa na primeira pessoa** da lista.

> **Como controlar quem é:** atribua o papel explicitamente em `alcadas_papeis`
> (a regra ATRIBUIDO tem precedência sobre ROLE). Sem atribuição, `FINANCEIRO`
> cai em todo mundo com `financeiro_role='admin'` e `RH` em todo mundo com
> `rh_dp=true` — ordenados por nome, o primeiro leva.

⚠️ **Hoje o grupo FINANCEIRO inclui contas de teste** (Marcus, Lennon, além de
Daniela e Alessandra). Enquanto for assim, uma Nova Vaga fora do quadro pode
cair numa conta de teste. Atribuir `FINANCEIRO` explicitamente resolve.

---

## 8. Estado

### Pronto
- Motor de regras + **49 testes** (faixas, modificadores, Hunter≠Farmer, liderança, Trava Headcount)
- Migração aplicada em produção (`alcadas` + `alcadas_hardening`), validada antes
  em transação com rollback e conferida contra os dados reais
- **Financeiro** (Cartão Virtual + Aumento de Limite): classificação obrigatória,
  prévia da alçada, aprovadores por faixa, etapa de parecer, etapas de grupo,
  trilha de auditoria em toda decisão
- **DP** (§5): liderança Backoffice→CEO / Operação→COO, vaga nova fora do quadro,
  e a Trava Headcount pondo o Nery ao final. Promoção *para* liderança também
  entra (vale o cargo mais sênior entre atual e proposto)

### Visibilidade — nada foi tirado de ninguém
Conferido empiricamente simulando a sessão de um colaborador comum (role
`authenticated` + JWT real, medindo as contagens sob RLS):

- Nenhuma policy de tabela pré-existente foi tocada. As mudanças em
  `solicitacoes_financeiro`, `_etapas` e `colaboradores` foram só **colunas
  novas**, e os GRANTs são de nível de tabela — colunas novas herdam a
  permissão, então nenhuma query existente quebrou.
- As tabelas novas usam **leitura mínima**: `alcadas_papeis` mostra a cada um
  só os próprios papéis (admin do Financeiro vê todos), `alcadas_sla` é
  admin-only, e `alcadas_auditoria` segue a participação na solicitação.
  A primeira versão tinha `using (true)` nas duas primeiras, o que dava a todo
  colaborador acesso a tabelas que ele não tinha antes — corrigido em
  `alcadas_papeis_leitura_minima`.

### Falta
1. **`alcadas_obrigatoria.sql`** — só depois do front subir em produção
2. **Substituir o acúmulo provisório**: Nery está como JURIDICO e CONSELHO
3. **Atribuir FINANCEIRO/RH explicitamente** para tirar contas de teste do caminho
4. **Tela de Alçadas** (admin): papéis, SLA, consulta da trilha
5. **Novos tipos**: Compra/Despesa, Contrato, Pagamento, Proposta Comercial
6. **Alerta automático de SLA e trava de caixa** (§4.2) — a trava de caixa precisa
   de uma fonte para o saldo, que o portal não tem hoje
