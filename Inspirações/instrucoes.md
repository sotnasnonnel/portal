# Especificação Funcional — Sistema de Gestão de Ausência

## Objetivo do sistema
Desenvolver um aplicativo para gerenciar ausências de colaboradores, com três perfis de acesso: **Admin**, **Gestor** e **Usuário**.  
Em toda a aplicação, a palavra **“Férias”** deve ser substituída por **“Ausência”**, incluindo títulos, menus, botões, cards, formulários, mensagens e telas.

---

## Regra global de nomenclatura
Substituir automaticamente todas as ocorrências abaixo por **Ausência**:
- Férias
- Ferias
- férias
- ferias

Essa substituição deve valer para toda a interface e para toda a lógica textual do sistema.

---

## Perfis de acesso

### 1. Admin
O perfil Admin será responsável apenas pela administração de cadastros e acessos.

#### Logins de Admin iniciais
Criar os seguintes acessos de administrador:

- **Login:** `lennon.santos@phdengenharia.eng.br`  
  **Senha:** `968412`

- **Login:** `washington.maciel@phdengenharia.eng.br`  
  **Senha:** `123456`

#### Permissões do Admin
O Admin poderá:
- Criar logins para **Gestor** e **Usuário**
- Editar os dados cadastrais de gestores e usuários
- Ativar e desativar gestores e usuários
- Visualizar uma página de cadastro
- Visualizar uma página com a listagem de gestores e usuários

#### Campos do cadastro de colaborador
Ao criar um Gestor ou Usuário, o Admin deverá preencher os seguintes campos:

- Nome Completo
- Data de Nascimento
- Função
- Setor
- Superior
- Data de Admissão
- Salário
- Último Aumento

#### Regras dos campos
- Todos os campos acima poderão ser editados posteriormente pelo Admin
- O campo **Último Aumento** será o único **não obrigatório** no momento do cadastro
- O campo **Data de Admissão** deve aceitar data em formato válido
- O cadastro deverá permitir edição futura sem restrições para Admin

#### Telas do Admin
O sistema deve ter, no mínimo, as seguintes telas para o Admin:
1. **Página de Cadastro** de gestores e usuários
2. **Página de Visualização** com listagem de gestores e usuários

Essa listagem deve exibir claramente o status do cadastro, permitindo:
- ativar
- desativar
- editar informações

---

### 2. Gestor
O perfil Gestor será responsável pelo acompanhamento da equipe e pela aprovação das solicitações de ausência.

## Estrutura da tela inicial do Gestor
Ao entrar no sistema, o Gestor deverá visualizar uma tela inicial com:

- Saudação personalizada, por exemplo: **“Olá, [Nome da pessoa]”**
- Resumo da área **Meu Time**
- Resumo da área **Pendências de Aprovação**
- Nessas áreas, considerar apenas dados relacionados a **Ausência**

## Sidebar do Gestor
A barra lateral do Gestor deve conter:

- Logo da **PHD Engenharia**
- Início
- Aprovações
- Minha Equipe
- Gestão de Ausência

> Observação: a logo da PHD Engenharia será utilizada a partir da pasta de inspirações mencionada no material original.

---

## Tela: Aprovações
Na aba **Aprovações**, o Gestor deverá visualizar as solicitações de ausência enviadas pelos usuários.

### Campos exibidos na listagem de aprovações
Cada solicitação deve mostrar:
- Nome
- Período aquisitivo
- Início da Ausência
- Término da Ausência
- Dias de Ausência

### Regra do período aquisitivo
O campo **Período aquisitivo** deve ser calculado a partir da **Data de Admissão** cadastrada para o colaborador.

Regra:
- O período aquisitivo corresponde a **1 ano contado desde a data de admissão**
- O sistema deve usar essa referência para exibir o ciclo correspondente da ausência

### Ações disponíveis por solicitação
Cada solicitação enviada ao Gestor deve possuir menu de ações com:
- Aprovar
- Reprovar
- Ver Detalhes

---

## Tela: Ver Detalhes da solicitação
Ao clicar em **Ver Detalhes**, o Gestor deve visualizar uma tela mais completa com as informações da solicitação.

### Informações recomendadas em Ver Detalhes
Exibir de forma organizada:
- Nome do colaborador
- Setor
- Função
- Superior
- Data de admissão
- Período aquisitivo
- Data de início da ausência
- Data de término da ausência
- Quantidade de dias solicitados
- Status da solicitação
- Data da solicitação
- Observações, caso existam

### Objetivo dessa tela
Essa visualização deve facilitar a tomada de decisão do Gestor, apresentando o contexto completo da solicitação antes de aprovar ou reprovar.

---

## Tela: Minha Equipe
Na aba **Minha Equipe**, o Gestor deverá visualizar os colaboradores do seu time.

### Campos exibidos
A listagem da equipe deve conter:
- Nome
- Setor
- Função
- Admissão
- Salário
- Último Aumento

### Objetivo da tela
Essa área deve funcionar como uma visão gerencial simples da equipe, permitindo ao Gestor consultar rapidamente os principais dados dos colaboradores sob sua responsabilidade.

---

## Tela: Gestão de Ausência
A aba **Gestão de Ausência** deve apresentar cards e filtros voltados ao acompanhamento do status das ausências da equipe.

### Cards principais
Os cards devem aparecer nessa ordem:
1. **Em Ausência**
2. **A Vencer**
3. **Vencidas**

### Ajustes solicitados
- Remover os indicadores **Risco de dobro** e **Em dobro**
- Manter apenas os três grupos principais acima

### Regras dos cards

#### Em Ausência
Listar os colaboradores que estão atualmente em período de ausência.

#### A Vencer
Listar os colaboradores cuja ausência esteja **faltando 30 dias para vencer** em relação ao período aquisitivo.

Regra:
- O período aquisitivo é de **1 ano a partir da data de admissão**
- Quando faltar **30 dias** para o encerramento desse ciclo, o colaborador deve aparecer em **A Vencer**

#### Vencidas
Listar os colaboradores cuja ausência já ultrapassou o prazo esperado dentro do ciclo aplicável.

### Comportamento ao clicar nos cards
Ao clicar em cada card, a tela deve filtrar a visualização para mostrar somente os colaboradores daquele grupo:
- Em Ausência
- A Vencer
- Vencidas

### Linha do tempo
Abaixo da seção de quem está **Em Ausência**, deve existir uma **linha do tempo**.

#### Objetivo da linha do tempo
A linha do tempo deve facilitar a visualização cronológica de quem está ausente e em qual período.

#### Informações recomendadas na linha do tempo
Cada item pode apresentar:
- Nome do colaborador
- Data de início
- Data de término
- Quantidade de dias
- Status atual

---

### 3. Usuário
O perfil Usuário terá acesso apenas às funcionalidades relacionadas à sua própria ausência.

## Visão do Usuário
O Usuário verá apenas a área de **Ausência**, sem acesso às áreas administrativas e gerenciais.

---

## Solicitação de Ausência pelo Usuário
O fluxo da solicitação deve ser simples e guiado por etapas.

### Etapa 1: iniciar solicitação
Quando o usuário clicar em **Solicitar Ausência**, deve abrir uma janela/modal perguntando os dados necessários, incluindo um campo para seleção de data.

### Etapa 2: informar período
O usuário deverá selecionar a data desejada para o início da ausência.

### Etapa 3: selecionar quantidade de dias
Depois disso, o usuário deverá informar quantos dias deseja tirar.

### Etapa 4: visualizar resumo
Antes de finalizar, o sistema deve mostrar um resumo com:
- Data inicial da ausência
- Quantidade de dias
- Data prevista de término
- Período aquisitivo relacionado
- Status inicial da solicitação

### Etapa 5: finalizar solicitação
Ao clicar em **Finalizar**, a solicitação deve ser enviada automaticamente ao Gestor responsável.

---

## Comportamento após a solicitação
Depois que o usuário definir o período de gozo da ausência:
- a solicitação deve ficar registrada no sistema
- ela deve aparecer para o Gestor na área de Aprovações
- o usuário deve visualizar o status da solicitação na própria área

### Status esperados
Sugestão de status:
- Pendente
- Aprovada
- Reprovada

---

## Regras de relacionamento entre perfis
- O **Admin** cria e mantém os acessos
- O **Gestor** aprova ou reprova solicitações do seu time
- O **Usuário** faz apenas a solicitação da própria ausência
- O sistema deve considerar a hierarquia cadastrada no campo **Superior** para vincular usuário e gestor quando necessário

---

## Regras de experiência e interface
O sistema deve seguir uma interface clara, objetiva e voltada à operação diária.

### Diretrizes gerais
- Priorizar navegação simples
- Exibir informações de forma organizada
- Separar claramente as permissões por perfil
- Destacar pendências de aprovação para o Gestor
- Exibir dados resumidos e de fácil leitura

### Consistência textual
Toda a experiência da aplicação deve usar o termo **Ausência** no lugar de qualquer variação de “férias”.

---

## Requisitos funcionais resumidos

### Admin
- Criar login de Gestor
- Criar login de Usuário
- Editar cadastros
- Ativar cadastro
- Desativar cadastro
- Visualizar lista de gestores e usuários

### Gestor
- Visualizar tela inicial com saudação
- Visualizar pendências de aprovação
- Aprovar solicitação
- Reprovar solicitação
- Ver detalhes da solicitação
- Visualizar equipe
- Acompanhar ausências por status
- Filtrar por Em Ausência, A Vencer e Vencidas
- Visualizar linha do tempo dos afastamentos em andamento

### Usuário
- Visualizar própria área de ausência
- Solicitar ausência
- Informar data
- Informar quantidade de dias
- Visualizar resumo
- Finalizar solicitação
- Acompanhar status do pedido

---

## Observação importante sobre o material original
O documento de origem traz referências visuais do tipo “como na imagem abaixo”.  
Nesta versão em Markdown, essas referências foram convertidas em **descrições funcionais detalhadas**, para facilitar a leitura por ferramentas de IA e motores de regras, como o Antigravity.

---

## Resultado esperado
O sistema final deve ser um aplicativo de gestão de ausência com:
- controle por perfil
- fluxo claro de solicitação e aprovação
- acompanhamento gerencial da equipe
- padronização completa da nomenclatura usando **Ausência**
