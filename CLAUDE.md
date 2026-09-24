# Portal PHD: guia para assistentes

Visão geral, comandos, variáveis de ambiente e deploy: veja o `README.md`. Este
arquivo guarda o que não é óbvio ao ler o código.

## Nomes: tela × código

- O módulo **"Dados"** (antes "PMO", antes "Solicitações") é `solic` no código:
  pasta `src/modules/solic`, rotas `/solic/*`, tabelas `solic_*`. O alias `@` do
  Vite aponta para `src/modules/solic`. Em texto novo para o usuário, escreva "Dados".
- "Solicitações" também nomeia uma seção do Financeiro e as requisições do DP
  (`solicitacoes_rh`). Nenhuma delas é o módulo Dados.
- "Controle de Horas" virou **"Gestão de Horas"** (`src/modules/horas`).
- Parte de `solic` é TypeScript (`.ts`/`.tsx`). O ESLint só cobre `.js`/`.jsx`.

## Acesso e perfis

- Login só via Microsoft (`signInWithOAuth` em `src/contexts/AuthContext.jsx`).
  Não existe login por senha.
- Perfis do DP (`colaboradores.perfil`): `admin`, `gestor`, `coordenador`, `usuario`.
  A flag `colaboradores.rh_dp` dá visão de RH/DP. O super admin (`src/config/superAdmin.js`)
  é quem vê `/portal-admin`.
- Cada módulo tem o próprio gate em `src/config/<modulo>.js`. A proteção real é
  a RLS no banco; o gate só controla o que a tela mostra.
- A hierarquia vem de `colaboradores.superior_id`, e o motor de alçadas depende
  dela (`docs/plano-alcadas.md`).

## Fluxos legados

O fluxo antigo de férias por período aquisitivo (P.A./21 dias, tabela
`ciclos_ausencia`, telas `/usuario` e `/gestor/ausencia`) está **travado com
cadeado** no menu. O fluxo vivo é **Ausência Programada** (`/ausencia-programada`,
`ausencia_periodos`). **Folga de Campo** é um módulo à parte e não tem saldo.

## Dois bancos Supabase

- Portal (`bogsuuhrgvopzgcceoqz`): auth e todos os dados do portal.
- Backoffice PHD (`dvvqgoxqawyhycakppps`): o organograma, lido só para consulta
  (`src/services/supabaseBackoffice.js`). Não existe chave estrangeira entre os dois bancos:
  o vínculo é feito por nome.

Mudanças de banco são arquivos SQL soltos em `supabase/`, aplicados à mão.
Leia o cabeçalho antes de aplicar: alguns têm pré-requisito de deploy do front
(por exemplo, `supabase_migration_alcadas_obrigatoria.sql`).

## Visual

A fonte da verdade dos tokens é `src/styles/ui.css`; as cores da marca estão em
`src/styles/theme.css`. Todos os módulos com menu lateral usam
`src/components/Layout/ModuleSidebar.jsx`, e o acento de cada um vem de
`--mod-accent` na raiz do módulo. Detalhes em `docs/padrao-visual-modulos.md`.
Nada de `font-size` ou altura de controle com valor solto: use sempre um token.

## Deploy

Build local + upload de `dist/`, sem CI. Antes do build, garanta que a branch
não está atrás de `origin/main`: um build de branch atrasada já reintroduziu
bug corrigido em produção.

## Git

O diretório costuma ter trabalho em andamento do dono (planilhas em
`referencia/`, arquivos não rastreados). Adicione ao commit só os arquivos que
você alterou; nada de `git add -A`.

`docs/arquivo/` é só histórico: os planos de lá já foram implementados e podem
contradizer o código atual.
