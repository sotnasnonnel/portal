# Manual do Administrador (Admin) - Sistema de Gestão de Ausência

Este manual descreve as responsabilidades e ferramentas do perfil de **Admin** no sistema de Gestão de Ausência da PHD Engenharia.

---

## 1. Escopo de Atuação
O perfil Admin tem foco técnico e cadastral. Sua missão é garantir que todos os colaboradores tenham acesso ao sistema, com os dados corretos e perfis adequados (Usuário ou Gestor). O Admin **não** aprova ausências (essa é uma tarefa do Gestor), mas gerencia a base de dados que permite o fluxo funcionar.

## 2. Gestão de Colaboradores (Listagem)
Na tela de visualização de usuários, você pode:
- **Filtrar por Perfil**: Alternar entre ver apenas Admins, Gestores ou Usuários.
- **Filtrar por Status**: Ver apenas colaboradores Ativos ou Inativos.
- **Pesquisar**: Localizar colaboradores específicos por nome ou e-mail.
- **Exportar**: Gerar arquivos Excel (.xlsx) da base de colaboradores filtrada para auditorias de RH.

## 3. Cadastro de Novos Usuários
Ao cadastrar um colaborador, os seguintes campos são essenciais:
- **Dados Pessoais**: Nome Completo e Data de Nascimento.
- **Estrutura**: Função, Setor e **Superior** (Líder Direto).
- **Contrato**: Data de Admissão e Salário.
- **Acesso**: E-mail Corporativo e Perfil de Acesso.
- **Senha Padrão**: Novos cadastros são criados com a senha inicial **123456**.

## 4. Edição e Manutenção
- **Edição**: Você pode alterar qualquer dado cadastral a qualquer momento (ex: mudança de cargo, aumento salarial ou troca de gestor imediato).
- **Ativação/Inativação**: Em caso de desligamento ou interrupção de acesso, utilize o interruptor de status para inativar o usuário. Colaboradores inativos não podem realizar login.
- **Vínculo de Superior**: A hierarquia do sistema depende do campo "Superior". Certifique-se de que o nome do gestor esteja escrito exatamente como consta no cadastro dele para que as aprovações apareçam no painel correto.

## 5. Regra de Gestor Automático
Um colaborador é identificado como **Gestor** pelo sistema quando:
1. Seu perfil de acesso é definido como "Gestor".
2. Ele é apontado como "Superior" de outros colaboradores.

## 6. Integridade de Dados
O sistema realiza reconciliações periódicas com a base oficial de ausências. Caso encontre inconsistências ou dados faltando em algum dashboard de gestor, você pode auxiliar verificando se o e-mail corporativo e o vínculo de hierarquia estão corretos.

## 7. Solicitações DP (Recursos Humanos)
O Admin gerencia as solicitações enviadas pelos gestores através de um painel exclusivo ("Solicitações DP").
- **Tipos de Solicitação**: Podem incluir processos como Desligamentos e Aumentos Salariais.
- **Fluxo de Análise**: Todas as novas requisições chegam com o status de "Em andamento". O Admin revisa os dados enviados (como a Data de Desligamento) e pode decidir pela sua aprovação ou rejeição. 
- **Atualização de Status**: Ao serem aprovadas pelo Admin, as solicitações mudam o status para "Concluído" e as ações correspondentes no sistema podem ser processadas.

---
**Segurança:** O Admin possui acesso a dados sensíveis (salários). Utilize as ferramentas de exportação e edição com responsabilidade.
