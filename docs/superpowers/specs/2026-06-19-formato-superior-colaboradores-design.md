# Campo Formato + Sincronização de colaboradores (planilha colab.xlsx)

Data: 2026-06-19

## Contexto

A tabela `colaboradores` (banco compartilhado `bogsuuhrgvopzgcceoqz`) não distingue o vínculo
contratual da pessoa (CLT, PJ, sócio…) e muitos registros estão sem `superior_id`. Por isso, nas
requisições do gestor, colaboradores CLT não aparecem no dropdown (o filtro é `superior_id = user.id`),
e não há como marcar/visualizar o formato de cada pessoa.

A planilha `docs/colab.xlsx` (136 linhas, todas STATUS=Ativo) traz duas informações que faltam:
- **FORMATO**: CLT (54), CNPJ (46), SOCIO COTISTA (28), PJ (6), DIRETORIA (2).
- **COO PHD**: o gestor (superior) daquela pessoa, por nome curto (ex.: "Pedro Morais").

Cruzamento com o banco: **120 das 136 já existem** (match por e-mail, case-insensitive); **16 são novas**
(todas sócio/PJ/CNPJ — nenhuma CLT). Os CLT já estão cadastrados; falta neles `formato` e `superior_id`.

## Decisões (confirmadas com o usuário)

1. **Formato = 4 opções**: `CLT`, `PJ`, `Sócio Cotista`, `Diretoria`. Na carga, **CNPJ e PJ → `PJ`**.
2. **Alcance da carga**: tudo — atualizar os 120 existentes e inserir as 16 novas.
3. **COO que não é gestor** (Alex Silva, Gabriel Abud, Nilton Netto) → **promover a `perfil='gestor'`**.
4. Formato também aparece na **listagem** (coluna + tag) e fica editável no modal de edição.

## Frente A — Campo `formato` (schema + UI)

### A1. Migração de schema
- Adicionar coluna `formato text` em `colaboradores`.
- `CHECK (formato IN ('CLT','PJ','Sócio Cotista','Diretoria'))` permitindo `NULL`.
- Migração via `apply_migration`, nome `add_formato_to_colaboradores`.

### A2. AdminCadastro.jsx
- Novo `<select>` "Formato" com as 4 opções, **obrigatório** (padrão dos demais campos).
- Estado inicial `formato: ''`; incluir `formato: formData.formato` no `insert`.
- Resetar no "Limpar" e após sucesso.

### A3. AdminListagem.jsx
- `select('*')` já traz `formato` — sem mudança na query.
- Nova coluna "Formato" na tabela, exibida como `badge` (ou `—` quando nulo).
- Modal de edição: `<select>` Formato; incluir `formato` no `payload` do `update`.
- Exportação Excel: adicionar coluna "Formato".

## Frente B — Carga única a partir da planilha

Script gerador em Node (lê `docs/colab.xlsx`, usa o pacote `xlsx` já instalado) que **emite um arquivo
SQL** salvo em `docs/` para registro e auditoria. O SQL é então aplicado no banco.

### Mapa COO PHD → e-mail do gestor (resolução fixa)
Os 22 nomes curtos resolvem para um colaborador único. Mapa explícito (nome curto → e-mail):

```
Jarbas Junior→jarbas.junior   Mateus Corradi→mateus.corradi   Luciana Ferreira→luciana.ferreira (INATIVA)
Ana Regina→ana.caldeira       Daniel Almeida→daniel.almeida   Pedro Morais→pedro.morais
Julio Cesar→julio.cesar       Alex Silva→alex.silva           Ronaldo Machado→ronaldo.machado
Alessandro Moreira→alessandro.moreira (NOVA)  Gabriel Abud→gabriel.abud   Thales Padua→thales.padua
Tulio Morais→tulio.rafael     Eduardo Eler→eduardo.eler       Bruno Azevedo→bruno.azevedo
Diogo Soares→diogo.soares     Andre Guimaraes→andre.guimaraes Paulo Paiva→paulo.paiva
Pedro Nery→pedro.nery         Vinicius Costa→vinicius.costa   Diego Bernardes→diego.bernardes
Nilton Netto→nilton.netto
```
(domínio `@phdengenharia.eng.br` em todos)

### Passos do SQL (ordem importa)
1. **Inserir as 16 novas** (sócio/PJ/CNPJ). Campos: `nome` (NOME COMPLETO), `email`, `funcao` (CARGO),
   `data_admissao` e `data_nascimento` (convertendo o serial Excel → ISO), `formato`, `ativo=true`,
   `perfil='usuario'` — **exceto `alessandro.moreira`** que é COO → `perfil='gestor'`.
   `salario` fica nulo (não há na planilha).
2. **Preencher `formato`** em todos (UPDATE por e-mail): `CNPJ`/`PJ`→`PJ`, `SOCIO COTISTA`→`Sócio Cotista`,
   `DIRETORIA`→`Diretoria`, `CLT`→`CLT`.
3. **Promover a gestor**: `UPDATE ... SET perfil='gestor'` para `alex.silva`, `gabriel.abud`, `nilton.netto`.
4. **Setar `superior_id`** por e-mail, resolvendo o COO via subselect `(select id from colaboradores where email=…)`:
   - COO vazio → **não altera** o superior atual.
   - **Auto-referência** (pessoa cujo COO é ela mesma: `gabriel.abud`, `alessandro.moreira`, `vinicius.costa`)
     → `superior_id` permanece **nulo**.

### Conversão de datas
Serial Excel → ISO: `date = 1899-12-30 + serial dias`. Aplicar só nos inserts das 16 novas.

## Regras de qualidade / itens fora de escopo
- Não alterar `perfil` de quem está `null` (exceto os 3 COO promovidos), nem mexer em `salario`.
- **Luciana Ferreira está inativa**: 4 reports (anaclaudia.costa, maicon.morais, tamiris.machado,
  washington.maciel) apontarão para ela. É o dado real, mas ela não loga para ver a equipe — **pendência**
  registrada para o usuário decidir reativar ou reatribuir depois.
- Match planilha↔banco é por **e-mail** (case-insensitive); nomes não são usados para o match de pessoas
  (só para resolver o COO).

## Efeito esperado
- Coluna `formato` preenchida em todos → tag na listagem e seleção no cadastro.
- CLT com `superior_id` correto → passam a aparecer no dropdown de colaborador do gestor nas requisições
  (Alteração, Desligamento, Ajuda de Custo), sem mudar o filtro existente `superior_id = user.id`.

## Verificação
- Pós-carga: `select formato, count(*) ...` bate com a planilha (após merge CNPJ→PJ).
- Contagem de colaboradores com `superior_id` setado aumenta; nenhum aponta para si mesmo.
- Build do app sem erros; cadastro grava `formato`; listagem exibe a coluna.
