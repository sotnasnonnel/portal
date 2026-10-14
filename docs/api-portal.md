# API do portal (leitura)

API somente de leitura para sistemas de fora do portal (BI, integrações). Entrega
os dados de Ausência Programada e Adicional de Ausências (Gestão de Pessoas) e de
Apontamento e Horas Extras (Gestão de Horas).

- Edge Function: `supabase/functions/api-portal/index.ts`
- Consultas no banco: `supabase/supabase_migration_api_portal.sql`

## Endereço e chave

```
https://bogsuuhrgvopzgcceoqz.supabase.co/functions/v1/api-portal/<recurso>
```

Toda chamada é `GET` e leva a chave no cabeçalho `x-api-key` (ou
`Authorization: Bearer <chave>`). A chave dá acesso aos dados da empresa toda:
trate como senha, use só em servidor e nunca em página web.

```bash
curl -H "x-api-key: $API_PORTAL_KEY" \
  "https://bogsuuhrgvopzgcceoqz.supabase.co/functions/v1/api-portal/apontamentos?de=2026-09-01&ate=2026-09-30"
```

## Recursos

| Rota | O que traz | `de` / `ate` filtram por | `status` |
| ---- | ---------- | ------------------------ | -------- |
| `/ausencia-programada` | Pedidos de ausência (sem rascunhos) | ausências que tocam o intervalo | `pendente`, `aprovada`, `reprovada`, `cancelada` |
| `/ausencia-programada/periodos` | Períodos de referência e saldo | (não tem) | (não tem) |
| `/adicional-ausencias` | Dias adicionais por projeto | dia do registro | `pendente`, `aprovada`, `reprovada`, `cancelada` |
| `/apontamentos` | Apontamentos de horas | dia do início do apontamento | (não tem) |
| `/horas-extras` | Solicitações de hora extra | data da hora extra | `pendente`, `aprovada`, `reprovada`, `cancelada`, `compensada` |

Chamar `/api-portal` sem recurso devolve esta lista.

## Filtros

| Parâmetro | Formato | Observação |
| --------- | ------- | ---------- |
| `de`, `ate` | `AAAA-MM-DD` | Inclusivos. Dias no horário de Brasília. |
| `status` | texto | Um dos valores da tabela acima. |
| `email` | e-mail | Só os registros desse colaborador. |
| `limite` | 1 a 2000 | Padrão 500. |
| `offset` | inteiro ≥ 0 | Padrão 0. |

Parâmetro que o recurso não aceita devolve erro 400 (não é ignorado).

## Resposta

```json
{
  "recurso": "apontamentos",
  "total": 125,
  "limite": 500,
  "offset": 0,
  "proximo_offset": null,
  "dados": [ { "...": "..." } ]
}
```

`total` é a contagem do filtro inteiro. Para paginar, repita a chamada com
`offset = proximo_offset` até ele vir `null`.

Erros vêm como `{ "erro": "<codigo>", "mensagem": "<texto>" }`:

| HTTP | `erro` | Quando |
| ---- | ------ | ------ |
| 400 | `parametro_invalido` | Filtro desconhecido ou com valor inválido |
| 401 | `nao_autorizado` | Chave ausente ou errada |
| 404 | `recurso_nao_encontrado` | Rota que não existe |
| 405 | `metodo_nao_permitido` | Método diferente de GET |
| 503 | `nao_configurada` | Secret `API_PORTAL_KEYS` não foi definido |

## Campos que pedem explicação

- **Ausência Programada**: `concluida` é a aprovada cujo fim já passou (o banco
  não grava esse status). `dias` são corridos, contando início e fim.
  `dias_antes_correcao` só vem preenchido quando o RH corrigiu os dias.
- **Períodos**: `saldo = dias_direito + dias_ajuste + dias_adicionais − tirados −
  agendados − pendentes`. `fora_do_controle` marca quem o RH tirou do controle;
  esses períodos continuam saindo, e quem consome decide se filtra.
- **Adicional de Ausências**: `periodo_id` só existe depois da aprovação (é o
  período onde o crédito entrou).
- **Apontamentos**: `data` é o dia do início em Brasília; `inicio` e `fim` vêm em
  UTC. `horas` é a duração em horas com duas casas. `campos` traz os campos
  configurados por equipe; `sigla`, `tarefa`, `tarefa2`, `etiqueta` e `ativ` são
  o formato anterior.
- **Horas Extras**: `minutos` é a duração pedida. Não há percentual: ele é
  aplicado pelo DP conforme a CCT. `destino` é `medicao` ou `banco`.

## Publicar

1. Aplicar `supabase/supabase_migration_api_portal.sql` no SQL Editor.
2. Definir o secret com uma ou mais chaves (mínimo de 24 caracteres cada, separadas
   por vírgula, uma por consumidor):
   ```bash
   supabase secrets set API_PORTAL_KEYS="<chave>" --project-ref bogsuuhrgvopzgcceoqz
   ```
   Para gerar uma chave: `openssl rand -hex 32`.
3. Publicar a função sem verificação de JWT (quem autentica é a chave):
   ```bash
   supabase functions deploy api-portal --no-verify-jwt --project-ref bogsuuhrgvopzgcceoqz
   ```

Para revogar um consumidor, tire a chave dele do secret; não precisa de deploy.
