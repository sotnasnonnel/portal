# Módulo Gestão de Mobilização

Digitaliza a planilha `referencia/planilha_modulo_mobilizacao.xlsx`, que controla três
processos em três abas: `MOB.PESSOAS` (11 etapas), `MOB.EMPRESAS` (8) e
`DESMOB. PESSOAS` (5). Cada linha da planilha é um **processo**; cada bloco
"DATA PREV / DATA REAL / DIAS ATRASO" é uma **etapa**.

Rota `/mobilizacao`. Molde: o Administrativo.

---

## O que as fórmulas da planilha determinaram

Isto não foi suposto — saiu das fórmulas das colunas `DATA PREV`, e é o que define
o modelo de dados:

- **Cada etapa tem UM predecessor**, e a data prevista dela é
  `dias_úteis( data_real_do_predecessor ?? data_prevista_dele , SLA )`.
  Ou seja: toda etapa já nasce com prazo **projetado**, e ele se reajusta sozinho
  quando a anterior conclui de fato. Não existe etapa "sem relógio" — diferente do
  chamado do Adm, que fica sem vencimento enquanto espera aprovação.

- **Não é uma fila linear.** Em `MOB.PESSOAS`, "Treinamentos agendados" pende de
  "Abertura de chamado" enquanto "Emissão do ASO" pende de "Exames". É uma árvore,
  por isso `depende_de` é coluna da etapa e não "a ordem menos um".

- **Etapa raiz** (sem predecessor) tem a data informada na abertura. O número acima
  dela na planilha não é offset: é o `+1` das contas de tempo inclusivo. A exceção é
  "Alteração contratual" (25), que é duração-alvo — por isso a raiz também aceita SLA,
  contado da data-base do processo.

### Cadeia de `MOB.PESSOAS`

| # | Etapa | Predecessor | SLA |
|---|---|---|---|
| 0 | Assinatura de contrato | — | 0 |
| 1 | Abertura de chamado (Forms) | — | 0 |
| 2 | Exames | 1 | 7 |
| 3 | Emissão do ASO | 2 | 2 |
| 4 | Treinamentos agendados | **1** | 1 |
| 5 | Conclusão dos treinamentos | 4 | 7 |
| 6 | Alteração contratual / CLT | — | 25 |
| 7 | Envio do dossiê | 5 | 2 |
| 8 | Postagem pelo cliente | 7 | 3 |
| 9 | Aprovação do cliente final | 8 | 6 |
| 10 | Liberação do crachá | 9 | 1 |

`MOB.EMPRESAS`: contrato → e-mail → contato/doc (raízes) → Anexo 06 (5) → solicitação
de programas legais (1) → envio dos programas (10) → postagem (5) → aprovação (1).

`DESMOB. PESSOAS`: abertura e recebimento do crachá (raízes) → entrega ao cliente (2)
→ envio do protocolo (1) → desmobilização finalizada (4).

---

## Decisões

- **Catálogo de etapas é DADO**, não código (`mobilizacao_catalogo_etapas` + tela
  `/mobilizacao/catalogo`). A planilha continua viva e vai mudar; nome de etapa em
  `.js` exigiria deploy.
- **Sem papel novo.** Reusa `administrativo_role` e os helpers `is_adm_time()` /
  `is_adm_admin()`. Quem controla a mobilização é o mesmo time que atende o chamado
  que a dispara; duas listas de "quem é do time" divergiriam. **Ser responsável de uma
  etapa não exige papel nenhum** — a RLS libera pela coluna, que é o que permite TI, DP
  ou o gerente da obra fecharem o próprio passo.
- **Prazo é calculado por gatilho no banco** (`app_private.mob_recalcular`), não pelo
  cliente: o quadro grava só o status ao soltar o cartão, e o encadeamento tem que valer
  por qualquer caminho — carga da planilha, correção manual, uma tela nova amanhã.
- **Quadro de ETAPAS, com arrastar.** É a primeira exceção consciente à decisão de
  `plano-kanban-e-acompanhamento.md` (o quadro do Adm é só leitura): lá o status muda por
  responder mensagem, aqui não há mensagem e o passo é a unidade de trabalho.
- **Tudo em dias úteis** — não é escolha, é o enunciado: *"Cada passo tem um SLA. Precisa
  ter um configurações de dias úteis previstos (como no ADM)"*. A planilha era
  inconsistente (`MOB.PESSOAS` somava dias corridos, as outras duas usavam `WORKDAY`).
  **Efeito visível: os prazos de mobilização de pessoas ficam ~2 dias mais folgados do que
  na planilha atual** — precisa ser AVISADO ao time, não descoberto por eles.
- **Lançado travado**: `MOBILIZACAO_EM_BREVE = true`, com um e-mail em
  `MOBILIZACAO_LIBERADOS` (`src/config/mobilizacao.js`).

---

## Ordem de aplicação no Supabase

Os arquivos são idempotentes e vão aplicados **nesta ordem**:

1. `supabase/supabase_migration_chamados_adm_time.sql`
   Versiona a `chamados_adm_time()`, que já existia em produção mas nunca entrou no
   repositório. Agora dois módulos dependem dela.
2. `supabase/supabase_migration_mobilizacao.sql`
   Tabelas, sequence, recálculo, gatilhos, RLS, RPCs.
3. `supabase/supabase_seed_mobilizacao_catalogo.sql`
   As 24 etapas dos 3 fluxos. **Sem isto os processos nascem vazios.**
4. `supabase/supabase_migration_mobilizacao_torre.sql`
   A view da torre. **Confira o `security_invoker`** — sem ele a view vaza a base inteira.
5. `supabase/supabase_migration_mobilizacao_notificacoes.sql`
6. `supabase/supabase_migration_mobilizacao_gatilho_adm.sql`
   **A mais arriscada:** cria gatilhos em `chamados_adm`. Aplique fora do horário e
   valide com um chamado real logo em seguida. Ela já inclui a retroalimentação dos
   chamados de mobilização abertos antes do gatilho.
   Para derrubar só ela:
   ```sql
   drop trigger if exists mobilizacao_do_chamado_ins on public.chamados_adm;
   drop trigger if exists mobilizacao_do_chamado_upd on public.chamados_adm;
   drop trigger if exists mobilizacao_encerra_chamado on public.chamados_adm;
   ```
7. `supabase/supabase_import_mobilizacao_2026.sql`
   Histórico de 2026: **103** processos de `MOB.PESSOAS` e **22** de `MOB.EMPRESAS`.
   `DESMOB. PESSOAS` traz **zero**, e isso está certo: a aba não tem nenhum registro de
   2026 (a data mais recente em qualquer coluna dela é 22/10/2025), e o enunciado é
   explícito — *"Trazer como histórico apenas as informações de 2026. Demais anos não
   precisam ser considerados."*
   Regerar: `node docs/gerar_carga_mobilizacao.cjs`.

Depois da carga, mapeie o responsável que a planilha cita como texto solto
("Edijane") para o `colaboradores.id` — o SQL gerado traz o `update` de exemplo no
rodapé, comentado. A carga **não chuta ninguém**.

---

## Convivência com o Excel

`mobilizacao_etapas.tocada_no_portal` vira `true` quando a mudança tem sessão de
usuário. `app_private.mob_carga_etapa` só grava onde ela é `false`, então **a recarga
nunca sobrescreve o que os responsáveis fizeram no portal**.

O contrário não vale: quem atualizar só no portal deixa a planilha desatualizada. Isso
não é resolvível por código — é combinado operacional, e está escrito no guia do módulo.

A carga também **não importa as datas previstas** da planilha: elas foram calculadas com
a régua antiga, e trazê-las deixaria o histórico com duas réguas conflitantes. Entra o
que aconteceu (data real e situação); a previsão é recalculada pela regra nova.

---

## Verificação ponta a ponta

1. **Recálculo** — abra um processo pela tela (`/mobilizacao/nova`, fluxo Empresa) e
   confira que as datas previstas encadeiam. Conclua a primeira etapa e veja as seguintes
   se reajustarem a partir da data real.
2. **Quadro** — arraste um cartão, recarregue a página e confirme que persistiu. Arraste
   uma etapa cujo predecessor está aberto: a coluna "Concluída" apaga durante o arrasto e
   o motivo aparece em tela. Entre com alguém que não é responsável: o cartão não arrasta.
3. **Gatilho** — abra um chamado de Mobilização no Adm com cada um dos 3 movimentos e
   veja o processo nascer. Com alçada, o processo só nasce **depois** da aprovação.
   Reprove e veja o processo cancelar. Confirme que os chamados-filhos (TI/EPI) **não**
   geram processo.
4. **Torre** — logue como usuário comum e confirme que não vaza chamado alheio.
5. **Carga** — rode o import duas vezes e confirme zero duplicata; altere uma etapa pelo
   portal, recarregue e confirme que a alteração sobreviveu.
6. `npm test` (552 testes) e `npm run build`.

---

## Fechado pelo enunciado — não reabrir

Dois pontos que pareciam decisão em aberto e não são:

- **Dias úteis** foi pedido literalmente ("configurações de dias úteis previstos, como no
  ADM"). A inconsistência estava na planilha, não no pedido.
- **Desmobilização sem histórico de 2026** é o resultado correto do recorte pedido, não
  uma lacuna a investigar.

O enunciado também nomeia **três** situações e cita como gatilho só "chamados de
mobilização **e desmobilização** de pessoas" — "Movimentação de profissional" não aparece
nele: é um valor do formulário do Adm, e por isso cai em `mobilizacao_pessoa` em vez de
virar um quarto fluxo.

## Pendências

- **`condicao` está vazia em todas as etapas**: "Nova mobilização" e "Movimentação de
  profissional" geram a MESMA lista de 11 passos. O enunciado não desce a esse nível — só
  quem faz o processo sabe. Se a movimentação dispensar exames, ASO e alteração
  contratual, marque essas três com `{"movimento": ["Nova mobilização"]}` pela tela de
  Catálogo — sem deploy.
- **"Alteração contratual" (SLA 25) não encadeia com nada** na planilha: data manual.
  Confirmar com o time se deveria depender de um passo anterior.
- **Mapear os responsáveis da carga**: a planilha cita "Edijane" como texto solto nas
  linhas de 2026. O SQL gerado traz o `update` de exemplo comentado no rodapé; a carga
  não chuta ninguém.
- **Feriados não entram no cálculo** — mesma limitação assumida do Adm, e aqui dói mais:
  mobilização acontece muito em janeiro. O ponto de extensão está marcado nos dois
  lugares (`src/utils/diasUteis.js` e `app_private.mob_dias_uteis_apos`).
- **Duas implementações de dias úteis** (JS para prever na tela, plpgsql para a verdade).
  A tela de Catálogo mostra a projeção ao lado do prazo real da primeira etapa
  instanciada, então uma divergência aparece na hora.
- **Volume do quadro**: 40 processos × 11 etapas = 440 cartões. Já mitigado (janela de 15
  dias para concluídas, "minhas etapas" ligado por padrão para quem não é do time,
  "Não se aplica" fora do quadro). Se pesar, a próxima alavanca é filtrar por fluxo antes
  de carregar.
- **Confirmar o e-mail em `MOBILIZACAO_LIBERADOS`** antes de testar em produção.

---

## Ajustes da revisão preliminar (04/09/2026)

Sete comentários do time depois de ver o módulo. O que mudou:

1. **Quadro** — filtros "Em atraso" e "Vence hoje". São excludentes: uma etapa
   que já venceu não vence hoje, então ligar os dois devolveria lista vazia.
2. **Processos** — busca (pessoa, cliente, obra ou código de projeto) e filtro
   "Só os atrasados". Busca e atraso filtram o que já veio; fluxo e situação
   continuam na consulta, porque mudam o recorte.
3. **Abrir processo virou "Mobilizar empresa"** e só aceita esse fluxo. Os de
   pessoa nascem do chamado do Adm; um segundo caminho para a mesma coisa
   criaria dois processos para a mesma pessoa, sem nada que os ligasse. A tela
   diz isso em destaque, com atalho para o Quadro e para a Torre.
4. **Campos novos no formulário do Adm** (era a nota "checar se precisa"):
   `cliente` (obrigatório), `cliente_final`, `empresa_phd` e, na
   desmobilização, `data_desmobilizacao` (obrigatória). O processo nascido do
   chamado vinha sem cliente nenhum, enquanto as 125 linhas da planilha tinham
   todos preenchidos — e a **desmobilização nascia sem prazo em passo algum**,
   porque o formulário não tem "data de início no cliente" e não havia outra
   data para servir de base.
5. **Indicadores** — "Processos travados" e "Etapas vencidas" viraram botões que
   abrem o detalhe. Um teste garante que o detalhe bate com o número do card.
6. **Torre de Controle virou módulo próprio** (`/torre`), só leitura, com Quadro
   e Etapas. Gate por perfil: `coordenador`, `gestor` e `admin`. **Não existe
   perfil "gerente" nem "diretor"** — como diz `config/perfis.js`, a liderança
   toda é `gestor`; diretoria se distingue por `formato = 'Diretoria'`, que é
   dado de contrato, não de acesso. O módulo reusa a folha de estilo e as libs
   da Mobilização (só troca o acento por token); os cartões não são links,
   porque quem abre a torre normalmente não tem acesso ao módulo de Mobilização
   e um link que devolve para a Home é pior que nenhum.

### Ainda pendente, por decisão

**Centro de custo na Torre**: alguns processos trazem o CC por nome de equipe e
outros pelo código do projeto, então o filtro por centro de custo mistura as
duas convenções. Resolver isso pede uma base de-para (projeto → responsável) que
ainda não existe — está com o Lennon. Até lá o filtro funciona, mas quem escolhe
"CT08" não vê o que estiver gravado como nome de equipe.
