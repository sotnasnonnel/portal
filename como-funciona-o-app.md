# Como Funciona o App - Gestão de Ausências

## Visão Geral do Sistema
O aplicativo foi desenvolvido para gerenciar e substituir os processos de requisição de ausência (anteriormente referida como férias). De acordo com as regras de negócio, a nomenclatura foi alterada unicamente para **Ausência**. O aplicativo é centralizado em uma gestão hierárquica baseada em liderança.

## Objetivo do Aplicativo
O foco do aplicativo é permitir que colaboradores solicitem períodos de ausência de forma fácil e rápida, fornecendo ferramentas para que gestores aprovem, acompanhem e gerenciem seus times através de dashboards descritivos sobre quem está ausente ou tem ausências a vencer.

## Perfis de Acesso
O sistema trabalha com três perfis principais:
- **Admin**: Responsável técnico pelo cadastro, atualização e remoção sistêmica dos acessos de gestores e usuários.
- **Gestor**: Responsável pelas aprovações de ausências e o acompanhamento de todos os colaboradores alocados sob sua gerência (mesmo nome no campo `superior`). Os acessos de gestor são concedidos quando o colaborador e seu próprio líder direto são a **mesma pessoa**.
- **Usuário**: Colaborador padrão que só possui a permissão de abrir requisições e consultar o andamento da própria ausência.

## Fluxos de Uso e Descrição das Telas

### Fluxo do Usuário
O usuário tem foco restrito a seu próprio painel.
1. **Solicitação**: O usuário propõe as datas de início da ausência, informa a quantidade de dias que pretende se ausentar.
2. **Resumo**: O aplicativo apresenta um resumo contendo a data prevista de término (exatamente 1 ano após o início) e o período aquisitivo de referência.
3. **Mural de Status**: O dashboard agrupa o histórico por **Período Aquisitivo (P.A.)**. Cada grupo exibe proeminentemente o **Saldo de Dias** restante para aquele ciclo (máximo 21 dias) e lista todas as parcelas já marcadas ou em processo de aprovação.

### Fluxo do Gestor
A visão do gestor é completa sobre seu time e requer tomada de decisão.
1. **Painel Inicial**: Resumo gerencial dos números de ausência confirmadas, painéis de pendências e contagem de integrantes do seu time próprio.
2. **Aprovações**: O gestor precisa processar as requisições em estado **Pendente** do fluxo anterior com base na tabela da própria equipe.
3. **Gestão de Equipe**: Acompanhamento estrutural com dados da admissão, salário e funções. Inclui recurso de **Exportação para Excel** da listagem de subordinados.
4. **Gestão de Ausências Globais**: Visão estratégica através de status que agrupa toda a equipe em grupos lógicos:
   - *Em Ausência*: Quem se encontra oficialmente ausente no dia de hoje.
   - *A Vencer*: Ausência programada que entrará em vencimento em até 30 dias.
   - *Vencidas*: Colaboradores onde a janela de limite legal se encerrou.
   - *Linha do Tempo*: Exibição visual da cronologia para fácil visualização de quando sua equipe vai entrar e sair.

**Relatórios para o Gestor**:
O gestor possui botões de **Exportar Excel** em todas as listagens (Equipe e Gestão de Ausência), permitindo extrair relatórios filtrados de quem está ausente, quem tem ausências a vencer ou vencidas.

### Fluxo do Administrador (Admin)
O Admin foca apenas no banco centralizado de cadastros.
1. **Listagem**: Visão tabulada com funções de inativação e painéis filtráveis por Perfil (Admin, Gestor, Usuário) e status do funcionário (Ativo/Inativo).
2. **Exportação**: Possui recurso de exportação para Excel (.xlsx) que respeita os filtros aplicados na tela para auditoria e relatórios.
  - A senha inicial é padronizada como **123456**.
  - O cadastro inclui obrigatoriamente **Data de Nascimento** e **Salário** (Antecipação de Retirada), conforme diretrizes de RH.

## Regras de Negócio e Comportamentos do Sistema (Status de Ausência)
O sistema gerencia o ciclo de ausência dos colaboradores através de quatro status principais, baseados nos períodos aquisitivos:

1. **Ausência Marcada**:
   - **Marcação Pendente (Laranja)**: O período aquisitivo já venceu e o colaborador tem dias para marcar.
   - **Atrasado para marcar (Vermelho)**: A data limite para gozo da ausência já passou. O sistema alerta o gestor e o usuário.
   - **Ausência Marcada (Verde)**: A solicitação já foi aprovada pelo gestor.
   - **OK (Azul)**: Período concluído (histórico).
   - **Sem direito ainda (Cinza)**: Período futuro em aquisição. Se estiver a **menos de 3 meses** do fim, o card ganha um alerta **Terracotta** permitindo o planejamento antecipado.

### Automação e Controle de Ciclos
- **Agrupamento por P.A.**: O sistema consolida todas as solicitações de um mesmo período em uma única visualização.
- **Cálculo de Saldo**: O sistema garante que a soma de todos os dias solicitados para um P.A. não ultrapasse o limite de **21 dias**.
- **Geração Automática de Ciclos**: Implementada via `gerarCiclosTeoricos` (formatters) e disparada no `UsuarioDashboard`. Ela garante a persistência de pelo menos **1 ciclo vigente** no Supabase.
- **Parcelamento Inteligente**: O usuário pode dividir seus 21 dias em múltiplas solicitações. O Wizard de agendamento detecta automaticamente o saldo disponível e impede a marcação de dias acima do limite restante.

## Responsabilidades por Perfil
1. **Admin**: Manipula o banco central de colaboradores (Cadastro/Edição/Inativação) e garante a integridade dos dados de acesso.
2. **Gestor**: Visualiza a "Linha do Tempo" da equipe, aprova/reprova solicitações e monitora os alertas de vencimento (A Vencer/Vencidas).
3. **Usuário**: Solicita suas ausências e acompanha o histórico completo de seus ciclos.

## Erradicação de Termos Legados
Em conformidade com as diretrizes da empresa, os termos "Férias" e "Setor" foram totalmente removidos da interface e das regras de dados, sendo substituídos por **Ausência** e pela estrutura de **Liderança Direta** (Superior).

## Integridade e Restauração de Dados
O sistema possui um mecanismo de reconciliação para garantir que os dados de ausência reflitam exatamente a **Planilha Modelo** oficial do RH:
- **Reconciliação Estrutural**: Caso um colaborador não possua ciclos de ausência visíveis para o gestor, é realizada uma sincronização baseada no e-mail corporativo.
- **Histórico de Lançamentos**: O sistema é capaz de processar períodos divididos (vários lançamentos para o mesmo período aquisitivo) conforme constam no registro oficial, garantindo que o saldo e as datas de gozo estejam sempre precisos no Dashboard.
- **Visibilidade para o Gestor**: A resolução de dados faltantes (como no caso de ausências não listadas para subordinados diretos) é tratada através da atualização da tabela central de ciclos a partir da carga de dados fonte.

## Documentação de Apoio
Para detalhes específicos de operação por perfil, consulte os manuais individuais na pasta `/manuais`:
- [Manual do Usuário](file:///c:/Users/LennonSantos/Downloads/App%20Dp/manuais/manual-usuario.md)
- [Manual do Gestor](file:///c:/Users/LennonSantos/Downloads/App%20Dp/manuais/manual-gestor.md)
- [Manual do Administrador](file:///c:/Users/LennonSantos/Downloads/App%20Dp/manuais/manual-admin.md)

---
*Atualizado em: 14/04/2026*

## �ltima Atualiza��o: Solicita��es DP
- O formul�rio de desligamento agora permite a sele��o direta da 'Data do Desligamento'.
- As solicita��es enviadas mas ainda n�o revisadas constam com o status 'Em andamento' e quando s�o aprovadas mudam para 'Conclu�do'.
