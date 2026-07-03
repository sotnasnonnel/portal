# Migração bi_* (dvvqgoxqawyhycakppps) → solic_* (bogsuuhrgvopzgcceoqz)

Executada em 2026-06-12 via MCP Supabase (migration `create_solic_tables` + inserts com `jsonb_to_recordset`).

## Contagens (origem → destino)

| Tabela | Origem | Destino | Obs |
|---|---|---|---|
| bi_profiles → solic_profiles | 41 | 42 | +1 placeholder "Usuário removido" (`dee5da63-c5ef-4bf1-865d-25685725f7a8`, criador da survey 108 deletado no app antigo) |
| bi_projects → solic_projects | 0 | 0 | vazia |
| bi_assets → solic_assets | 53 | 53 | `created_by` aponta p/ perfis deletados (`eb51b984…`, `d5233a83…`) — sem FK, mantido como histórico |
| bi_surveys → solic_surveys | 105 | 105 | 0 órfãs; sequence ajustada p/ 132 |

## Decisões tomadas na carga

- **IDs preservados**: `solic_profiles.id` mantém o uuid do auth ANTIGO (FKs históricas de `created_by`). Vínculo com o auth novo via coluna `auth_id` (preenchida por e-mail — 36/42 já pré-vinculadas com usuários existentes do Reembolso; o resto vincula no 1º login Microsoft).
- **E-mail duplicado**: `fabio.santos@phdengenharia.eng.br` existia em 2 profiles. O registro antigo (`a0eb31e3…`, "Fábio Santos", sem created_at, sem surveys) ficou com `email = null`; o ativo (`76476344…`, "Fábio Cardoso Santos") mantém o e-mail.
- **Dados estranhos preservados como estavam**: survey 44 com `needed_date = 20226-03-13` (ano 20226), survey 122 com `needed_date = 1990-02-06`.

## Cutover (2026-06-12, fim do dia)

- Login Microsoft validado pelo Lennon (conta @phdengenharia.eng.br, vínculo auth_id ok).
- Delta syncs aplicados: surveys 130/131 (criadas de manhã, já na carga) e survey 127 (status IN_PROGRESS → COMPLETED às 16:59 UTC).
- Tabelas `bi_*` e views (`surveys`, `assets`, `profiles`, `projects`, `bi_asset_dashboard`) **dropadas** do projeto antigo `dvvqgoxqawyhycakppps` (migration `drop_solic_legacy`), com autorização do Lennon. Nenhuma outra tabela do projeto foi tocada. Edge functions antigas (invite-user/manage-user/clear-must-change) ficaram lá, inertes.
- App antigo: Lennon vai despublicar o deploy (decisão: tirar do ar já).

## Pendências

- **3 usuários com e-mail pessoal** não vão logar com Microsoft (tenant-only) — Lennon decidir (trocar e-mail ou desativar):
  - `milena.carius28@gmail.com` (Milena — tem 9 surveys como criadora)
  - `mrenanrguimaraes@gmail.com` (Marcus Guimarães)
  - `getulio_pedrosa@hotmail.com` (Getúlio Alves Pedrosa — tem surveys; existe TAMBÉM `getulio.pedrosa@phdengenharia.eng.br` como profile separado `45f57b2f…`. Avaliar unificar os dois depois.)
- **App antigo segue em uso** (surveys 130/131 criadas em 12/06 de manhã): fazer **delta sync** das `bi_surveys`/`bi_assets` criadas/alteradas após esta carga ANTES do cutover final (Task 11), comparando `max(updated_at)`.
- **RLS desligado** (advisory crítico do Supabase) nas tabelas do DP: `colaboradores`, `ciclos_ausencia`, `solicitacoes_rh`, `controle_ausencias_excel`, `formularios_contratacao`. Endurecer com políticas após a migração do login (não ligar antes, quebraria o app).
- **Não dropar `bi_*`** no projeto antigo sem confirmar que nenhum Power BI externo lê essas tabelas (prefixo sugere que sim).
