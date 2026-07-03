# Documentação Técnica - Gestão de Ausências

## Stack e Ferramentas Utilizadas
- **Core**: HTML, CSS, JavaScript Moderno (ES6+)
- **Framework de Interface**: React
- **Build Tool / Bundler**: Vite
- **Gerenciador de Pacotes**: npm
- **Roteamento**: React Router DOM (Múltiplas views SPA para Admin, Gestor e Usuário)
- **Ícones**: Lucide React
- **Exportação de Dados**: xlsx (SheetJS)
- **Estilização**: Vanilla CSS Componentizado (`Components.css`, `Admin.css`, `Gestor.css`)
- **Backend / Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth (Integrado via tabela `colaboradores` com IDs UUID)
- **Cliente Supabase**: `@supabase/supabase-js`

## Estrutura de Pastas e Arquitetura do Projeto
O repositório está subdividido focando na separação estrita local por perfis:
- `/src/components`: Elementos genéricos não atrelados à lógica de navegação central.
  - `/UI`: Design systems reusáveis (`Cards`, botões padronizados, etc).
- `/src/pages`: Segmenta lógicamente a aplicação entre interfaces independentes.
  - `/Admin`: CRUD de funcionários, visão holística da base e exportação Excel.
  - `/Gestor`: Lógica financeira das Ausências baseadas na árvore da equipe e aprovações ativas ('Minha Equipe', 'Gestão', 'Detalhes').
  - `/Usuario`: Onde são lançadas as requisições (`UsuarioAusencia.jsx`).
- `/src/contexts`: Provedores assíncronos (`AuthContext.jsx`) gerenciando a sessão do usuário com Supabase.
- `/src/services`: Configuração do cliente Supabase (`supabase.js`).
- `/src/utils`: Funções utilitárias de formatação e lógicas de cálculo de período (`formatters.js`).
- `/src/data`: (Depreciado) Continha as regras de serviço mockadas provisoriamente. ⚡ Agora a aplicação consome dados reais da nuvem.

## Detalhamento Lógico e Modelagem de Dados Atuais

### Estrutura de Banco de Dados (PostgreSQL - Supabase)
A aplicação utiliza um modelo relacional estruturado em duas tabelas principais no PostgreSQL:

#### Tabela `colaboradores`
Armazena os dados cadastrais e de acesso:
- `id`: UUID (Primary Key).
- `nome`, `email`, `funcao`: Informações profissionais.
- `data_nascimento`: DATE - Data de nascimento do colaborador.
- `salario`: NUMERIC - Valor do salário (Antecipação de Retirada).
- `ultimo_aumento`: DATE - Data da última alteração salarial.
- `perfil`: TEXT ('admin', 'gestor', 'usuario') - Define permissões de acesso.
- `superior_id`: UUID - Chave estrangeira (Self-reference) para definir a hierarquia de liderança.
- `senha`: TEXT - Senha de acesso (migrado do sistema legado).
- `ativo`: BOOLEAN - Define se o acesso está habilitado.

#### Tabela `ciclos_ausencia`
Armazena o histórico de períodos aquisitivos e status de gozo:
- `id`: UUID (Primary Key).
- `colaborador_id`: UUID (Foreign Key).
- `inicio_periodo_aquisitivo` / `fim_periodo_aquisitivo`: Janela do direito à ausência.
- `limite_ausencia_efetiva`: Prazo máximo legal para que o colaborador usufrua do benefício.
- `status_atual`: Texto mapeado conforme regras de negócio (`Ausência Marcada`, `Marcação Pendente`, `OK`, `Sem direito ainda`).
- `ausencia_agendada_inicio` / `fim`: Datas efetivas da ausência.
- `dias_solicitados`: Total de dias agendados.
- `created_at`: Registro temporal da criação.

#### Tabela `solicitacoes_rh`
Armazena requisições de aumento salarial e desligamento:
- `id`: UUID (Primary Key).
- `tipo`: TEXT ('aumento_salario', 'desligamento').
- `status`: TEXT ('pendente' (exibido como Em andamento), 'concluida').
- `gestor_id`: UUID (Foreign Key) - Identifica quem solicitou.
- `colaborador_id`: UUID (Foreign Key) - Alvo da solicitação.
- `salario_proposto`: NUMERIC - Novo salário (apenas para aumentos).
- `justificativa`: TEXT - Motivos da solicitação. Para desligamentos, inclui a "Data solicitada para desligamento" prefixada.
- `created_at` / `concluida_em`: Timestamps de criação e finalização.

### Hierarquia de Gestão e Visibilidade
Diferente do sistema original (mock), o acesso do gestor agora é determinado dinamicamente no banco de dados. Um Gestor visualiza todos os colaboradores cujo `superior_id` seja o seu próprio `ID`. Isso garante que a árvore de aprovação seja sempre íntegra e centralizada.

### Gerenciamento de Estado de Ausência
As janelas de exibição (Em Ausência, A Vencer, Vencidas) são calculadas comparando a `data_atual` com os campos `fim_periodo_aquisitivo` e `limite_ausencia_efetiva`. 
- **Agrupamento e Consolidação**: No Dashboard do Usuário, registros com o mesmo `inicio_periodo_aquisitivo` são agrupados em uma view consolidada.
- **Cálculo Dinâmico de Saldo**: O saldo é calculado no front-end subtraindo a soma de todos os `dias_solicitados` do total de 21 dias para cada grupo de P.A.
- **Sincronização Proativa**: Ao carregar o dashboard do usuário, o sistema garante que o ciclo atual e o próximo ciclo futuro estejam sempre presentes no banco, permitindo o planejamento antecipado.
- **Persistência de Parcelas**: Quando um usuário marca uma ausência em um P.A. que já possui outras marcações, o sistema realiza um `INSERT` em vez de um `UPDATE`, criando uma nova entrada no banco para representar a parcela e preservar o histórico.
- **Controle de Saldo (Wizard)**: O input de dias no Wizard é limitado dinamicamente pelo saldo restante do P.A. selecionado (`max={saldo}`).
- **Sincronização**: Realizada no `useEffect` inicial do Dashboard do usuário, comparando ciclos locais vs remotos.
- **Alerta Terracotta (#c35e1e)**: Ativado quando faltam 3 meses para o fim do período aquisitivo (Status: "Sem direito ainda").
- **Alerta Vermelho (#e74c3c)**: Ativado quando a data atual ultrapassa o limite de ausência efetiva (Status: "Atrasado para marcar").
- **Verde (#00a49a)**: Ciclo aprovado com datas definidas (Status: "Ausência Marcada").
- **Azul (#26405d)**: Ciclo finalizado (Status: "OK").

### Integração com Backend (Concluído ✅)
A arquitetura mockada foi totalmente substituída por chamadas assíncronas ao Supabase:
1. **Login Real**: O `AuthContext` agora executa consultas assíncronas na tabela `colaboradores`.
2. **Persistência de Sessão**: Mantida via `localStorage` e validada contra o banco de dados.
3. **Sincronização SQL**: Implementada via script de "Seed" (Python -> JSON -> Node -> Supabase) para garantir integridade dos dados originais de RH.

## Processo de Reconciliação de Dados (Planilha Modelo)
Para casos de divergência ou ausência de dados históricos, o sistema utiliza uma tabela auxiliar:
- **Tabela**: `controle_ausencias_excel` (Espelho da Planilha Modelo).
- **Fluxo de Restauração**:
  1. Os dados da Planilha Modelo são carregados para a tabela temporária.
  2. É executado um `JOIN` via `TRIM(LOWER(email))` entre a planilha e a tabela de `colaboradores`.
  3. Os registros faltantes são inseridos na tabela `ciclos_ausencia`, respeitando a integridade de períodos aquisitivos e datas de ausência já agendadas.
- **Tratamento de Períodos Divididos**: O sistema permite múltiplos registros em `ciclos_ausencia` para o mesmo colaborador e período aquisitivo, desde que as datas de ausência (`ausencia_agendada_inicio/fim`) sejam distintas, permitindo o controle de ausências parceladas.

## Instruções de Manutenção e Evolução
- **Regra de Nomenclatura Estrita**: Manutenções de Views precisam rigorosamente respeitar o termo "Ausência", não injetando termos correlatos antigos nos componentes.
- **Formatação de Dados**: Alterações de dados financeiros para o Admin sempre passam via `formatarMoeda()` enquanto as datas pelas `formatarData()`.
- **Evolução de UI**: A paleta e as animações (p.ex. `animate-fade-in-up`) situam-se globalmente em `Components.css` ou `App.css`. Para evoluir o UI adicione novas variáveis ao CSS padrão de raiz.

## Manuais e Documentação de Apoio
Foram criados manuais específicos para cada perfil de acesso para facilitar o treinamento e suporte:
- **Localização**: `/manuais/`
- **Arquivos**: `manual-usuario.md`, `manual-gestor.md`, `manual-admin.md`.
- **Manutenção**: Sempre que uma nova funcionalidade de interface for adicionada, o manual correspondente deve ser atualizado para refletir o novo fluxo.

---
*Atualizado em: 16/04/2026*
