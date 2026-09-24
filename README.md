# Portal PHD

Portal interno da PHD Engenharia (portal.phdengenharia.tech). Um único front React
reúne os módulos de gestão. O login é feito com a conta Microsoft da empresa.

## Módulos

| Card na Home        | Onde está no código | Rota |
| ------------------- | ------------------- | ---- |
| Gestão de Pessoas   | `src/pages/**` (Admin, Gestor, Usuário), `src/modules/fechamentoPj` | `/admin`, `/gestor`, `/usuario` |
| Dados (antigo PMO)  | `src/modules/solic` | `/solic` |
| Gestão de Horas     | `src/modules/horas` | `/horas` |
| Administrativo      | `src/modules/administrativo`, `estoque`, `mobilizacao` | `/administrativo`, `/estoque`, `/mobilizacao` |
| Programas           | `src/modules/programas` (Campo de Ideias e Alavanca PHD) | `/programas` |
| Torre de Controle   | `src/modules/torre` | `/torre` |
| Financeiro          | `src/modules/financeiro`, `src/modules/reembolso` | `/financeiro`, `/reembolsos`, `/adiantamentos` |
| Gerenciar acessos   | `src/pages/PortalAdmin` | `/portal-admin` (só super admin) |

Telas avulsas: Ausência Programada (`/ausencia-programada`), Folga de Campo
(`/folga-de-campo`), Organograma (`/organograma`), Conhecimento, Fale Conosco e
Privacidade (`/privacidade`, aviso LGPD).

## Stack

- React 19 + Vite 8, react-router-dom 7 (`HashRouter`, rotas em `src/routes/AppRoutes.jsx`)
- Supabase: auth (Microsoft OAuth), Postgres com RLS e Edge Functions (`supabase/functions`)
- E-mails enviados pelas Edge Functions via Microsoft Graph
- PDFs gerados no navegador com jspdf; planilhas com xlsx; gráficos com recharts

## Rodando localmente

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # node --test (pega os *.test.js de src/ e docs/)
npm run lint
```

Crie um `.env` na raiz (não é versionado):

| Variável | Para quê |
| -------- | -------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Projeto principal do portal |
| `VITE_BACKOFFICE_SUPABASE_URL`, `VITE_BACKOFFICE_SUPABASE_ANON_KEY` | Backoffice PHD, leitura do organograma |
| `GEMINI_API_KEY` (opcional) | Só em dev: leitura de nota fiscal no Reembolso (`server/extractNf.mjs`) |

## Banco de dados

As alterações de banco ficam em `supabase/` como arquivos SQL soltos
(`supabase_migration_*.sql`, `supabase_seed_*.sql`, `supabase_import_*.sql`).
Não há CLI de migrations: cada arquivo é aplicado à mão no projeto Supabase, e o
cabeçalho dele diz em que ordem e com que cuidados.

## Deploy

Não há CI. Para publicar:

1. Confira se a branch não está atrás de `origin/main`: `git log --oneline HEAD..origin/main` deve vir vazio.
2. `npm run build`
3. Suba o conteúdo de `dist/` para o host. O `base: './'` do Vite permite servir de qualquer pasta.

O `dist/` não é versionado. Para saber o que está no ar, procure a string no
`dist/` publicado, e não no git.

## Documentação

- `CLAUDE.md`: mapa do código e convenções para quem (ou o assistente de IA que) for mexer no projeto
- `docs/padrao-visual-modulos.md`: tokens visuais, sidebar e cores da marca
- `docs/plano-alcadas.md`: motor de alçadas e aprovações
- `docs/plano-mobilizacao.md`: modelo de dados da Mobilização
- `docs/arquivo/`: planos e especificações antigos, já implementados (só histórico)
