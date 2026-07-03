---
trigger: always_on
---

Sempre utilizar os arquivos da pasta "Inspirações" como fonte de verdade do projeto.

Arquivos obrigatórios:
- "Inspirações/instrucoes.md": contém os requisitos funcionais e regras de negócio do aplicativo.
- "Inspirações/Paleta de cores.txt": contém a paleta visual obrigatória do app.

Regras permanentes:
- Toda decisão funcional deve seguir "instrucoes.md".
- Toda decisão visual deve seguir "Paleta de cores.txt".
- Em toda a aplicação, substituir “Férias”, “Ferias”, “férias” e “ferias” por “Ausência”.
- Priorizar interface moderna, limpa, profissional e consistente.
- Criar código organizado, componentizado e escalável.
- Em caso de dúvida, seguir o arquivo "instrucoes.md" como fonte principal.

Documentação obrigatória:
Sempre que criar, alterar ou expandir o aplicativo, gerar e manter atualizados dois arquivos Markdown:

1. "como-funciona-o-app.md"
Conteúdo obrigatório:
- visão geral do sistema
- objetivo do aplicativo
- perfis de acesso
- fluxo de uso de cada perfil
- descrição das telas
- regras de negócio
- status e comportamentos do sistema
- explicação dos filtros, cards, aprovações e solicitações
- escrita simples e clara

2. "documentacao-tecnica.md"
Conteúdo obrigatório:
- stack utilizada
- bibliotecas e frameworks
- estrutura de pastas
- arquitetura do projeto
- componentes principais
- gerenciamento de estado
- regras de navegação
- modelagem dos dados
- decisões técnicas adotadas
- pontos preparados para integração com backend
- instruções de manutenção e evolução

Regras da documentação:
- Sempre manter os dois arquivos sincronizados com o estado atual do aplicativo.
- Toda mudança relevante no app deve atualizar os dois arquivos.
- A documentação funcional deve ser voltada para negócio e operação.
- A documentação técnica deve ser voltada para desenvolvedores.
- Os arquivos devem ser escritos em Markdown com boa organização.