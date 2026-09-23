/**
 * AVISO DE PRIVACIDADE do Portal PHD — texto exibido em /privacidade
 * (src/pages/Privacidade/Privacidade.jsx), em atendimento à LGPD
 * (Lei nº 13.709/2018).
 *
 * POR QUE O TEXTO MORA AQUI: quem revisa este conteúdo é o jurídico/RH, não
 * quem programa. Separado do componente, a revisão é um arquivo de texto e não
 * mexe em tela.
 *
 * O QUE ESTÁ PENDENTE aparece como PENDENTE e é DESTACADO na tela (faixa
 * amarela). Nada aqui pode ser preenchido por chute: o encarregado e o CNPJ são
 * informação que a empresa declara publicamente. Para publicar de verdade,
 * troque os PENDENTE pelos dados reais e suba a `versao`.
 *
 * ESCOPO desta primeira entrega (decidido em 22/09/2026): o aviso e o
 * responsável. Ficaram para depois, e por isso NÃO estão prometidos no texto:
 *   * ciência obrigatória no login, com log de quem leu e quando;
 *   * canal no portal para o titular pedir acesso/correção/eliminação;
 *   * inventário de tratamento (ROPA) e varredura de permissões do banco.
 * Enquanto o canal não existe, o pedido do titular chega pelo e-mail do
 * encarregado — é o que a seção "Seus direitos" diz.
 *
 * O levantamento do que o portal guarda foi feito no próprio código (tabelas e
 * telas de cada módulo). Ao criar módulo novo que trate dado pessoal, a seção
 * "Quais dados tratamos" precisa ser atualizada junto.
 */

export const PENDENTE = '[DEFINIR]';
export const ehPendente = (valor) => typeof valor === 'string' && valor.includes('[DEFINIR');

export const AVISO_PRIVACIDADE = {
  versao: '1.1',
  atualizadoEm: '2026-09-23',

  controlador: {
    nomeCurto: 'PHD Engenharia',
    razaoSocial: 'PHD Soluções em Engenharia S.A.',
    cnpj: '30.860.911/0001-50',
    endereco: 'Av. Raja Gabaglia, 4343, sala 400, 5º andar — Belo Horizonte/MG',
  },

  // Art. 41, §1º: a identidade e as informações de contato do encarregado
  // devem ser divulgadas publicamente, de forma clara e objetiva.
  //
  // SEM TELEFONE por decisão de 23/09/2026: a lei pede identidade e contato, e
  // o e-mail cumpre isso. Esta página fica FORA do login, então um celular aqui
  // seria número pessoal publicado para qualquer um com o link. A tela omite a
  // linha quando o telefone é nulo — não mostra rótulo vazio.
  encarregado: {
    nome: 'Lennon Santos',
    email: 'lennon.santos@phdengenharia.eng.br',
    telefone: null,
  },

  secoes: [
    {
      id: 'quem-somos',
      titulo: '1. Quem trata os seus dados e a quem este aviso se aplica',
      paragrafos: [
        'Este aviso explica como a PHD Engenharia coleta, usa, compartilha e guarda dados pessoais dentro do Portal PHD — o sistema interno usado por colaboradores, sócios e prestadores de serviço da empresa.',
        'A PHD Engenharia é a controladora desses dados: é ela quem decide para que eles são usados. O acesso ao portal é feito com a conta corporativa Microsoft, e cada pessoa enxerga apenas o que o seu cargo e a sua posição no organograma permitem.',
        'O portal é um ambiente interno de trabalho. Ele não é aberto ao público e não trata dados de clientes finais como titulares deste aviso.',
      ],
    },
    {
      id: 'dados',
      titulo: '2. Quais dados o portal trata',
      paragrafos: [
        'O portal trata os dados abaixo, conforme o que cada pessoa usa. Nem todos se aplicam a todo mundo: quem é prestador PJ, por exemplo, não tem dado de folha CLT.',
      ],
      itens: [
        ['Identificação e contato', 'nome, e-mail corporativo e data de nascimento. Em rotinas específicas, também CPF, RG, CNH, sexo, telefone, e-mail pessoal e endereço: é o caso do cadastro de prestadores de serviço e dos pedidos de viagem, hospedagem e uso de veículo, que exigem o documento de quem viaja ou dirige.'],
        ['Vínculo com a empresa', 'cargo, função, setor, modalidade de contratação, matrícula, centro de custo, data de admissão, gestor direto e posição no organograma, projeto ou obra em que atua.'],
        ['Jornada e ausências', 'apontamento de horas por projeto, pedidos de hora extra com motivo e justificativa, períodos de ausência programada e de folga de campo, com datas, saldos e aprovações.'],
        ['Dados financeiros do vínculo', 'valores de remuneração e ajustes, reembolsos e adiantamentos com a respectiva prestação de contas, solicitações de cartão virtual e de limite, dados bancários informados para pagamento (banco, agência, conta e chave PIX) e notas fiscais de prestadores.'],
        ['Benefícios e dependentes', 'no cadastro de prestadores de serviço, a contratação de plano médico e odontológico e os dados dos dependentes incluídos (nome, CPF, data de nascimento e grau de parentesco).'],
        ['Dados de outras pessoas que você informa', 'quando o pedido exige, o portal guarda dados de quem não é da empresa: candidatos indicados em processo de contratação (nome, telefone e e-mail), contatos comerciais indicados na Alavanca PHD (nome, cargo, telefone e e-mail) e dependentes de prestadores. Essas pessoas também são titulares protegidos pela LGPD, e os dados delas seguem as mesmas regras deste aviso.'],
        ['Pedidos e atendimentos', 'requisições ao DP, chamados administrativos e de suporte, pedidos de mobilização, retirada de EPI e uniforme, mensagens do Fale Conosco e registros no Campo de Ideias e na Alavanca PHD.'],
        ['Arquivos que você anexa', 'documentos e comprovantes enviados nos pedidos — por exemplo, nota fiscal, comprovante de despesa e documentos de requisições ao DP. Ficam guardados na área de armazenamento do Portal PHD e são abertos a partir do próprio pedido.'],
        ['Registros de uso', 'data e hora das ações feitas no portal (envio, aprovação, reprovação, cancelamento e correções), com identificação de quem fez, e as notificações geradas.'],
      ],
      fecho: [
        'A informação de plano de saúde é considerada dado sensível pela LGPD. Ela fica restrita às pessoas responsáveis pelo fechamento dos prestadores e é usada apenas para conferir e pagar o benefício.',
        'O portal não pede nem guarda dado de raça, religião, opinião política, filiação sindical, orientação sexual ou diagnóstico médico. Não há reconhecimento facial nem coleta de biometria, e nenhuma decisão sobre você é tomada automaticamente: aprovações e reprovações são sempre de uma pessoa.',
      ],
    },
    {
      id: 'finalidades',
      titulo: '3. Para que usamos e com que base legal',
      paragrafos: [
        'A LGPD exige que todo uso de dado pessoal tenha uma finalidade definida e uma base legal. No portal, as principais são:',
      ],
      tabela: {
        cabecalho: ['Para quê', 'Base legal (LGPD)'],
        linhas: [
          ['Administrar o contrato de trabalho ou de prestação de serviço: cadastro, jornada, ausências, pagamentos e benefícios.', 'Execução de contrato e cumprimento de obrigação legal (art. 7º, V e II).'],
          ['Cumprir obrigações trabalhistas, previdenciárias, fiscais e de segurança do trabalho, incluindo controle de entrega de EPI.', 'Cumprimento de obrigação legal ou regulatória (art. 7º, II).'],
          ['Organizar o trabalho: aprovações pela cadeia de gestores, alocação em projetos e obras, mobilização de equipes e atendimento de chamados internos.', 'Execução de contrato e legítimo interesse da empresa (art. 7º, V e IX).'],
          ['Controlar acessos e manter a segurança do sistema, com registro das ações realizadas.', 'Legítimo interesse e cumprimento de obrigação legal (art. 7º, IX e II).'],
          ['Programas internos de participação voluntária, como o Campo de Ideias e a Alavanca PHD.', 'Consentimento, manifestado ao se inscrever no programa (art. 7º, I).'],
        ],
      },
      fecho: [
        'Quando o uso depende de consentimento, ele é sempre opcional e pode ser retirado — o que não desfaz o que já foi feito antes da retirada.',
      ],
    },
    {
      id: 'compartilhamento',
      titulo: '4. Com quem os dados são compartilhados',
      paragrafos: [
        'Dentro da empresa, cada dado é visto por quem precisa dele para trabalhar: o seu gestor direto e a cadeia acima dele, as áreas de Departamento Pessoal, Financeiro, Administrativo e Tecnologia da Informação, conforme o assunto, e os administradores do sistema.',
      ],
      itens: [
        ['Fornecedores de tecnologia', 'o portal usa serviços de nuvem para autenticação e envio de e-mails (Microsoft) e para banco de dados e armazenamento de arquivos (Supabase), que tratam os dados em nome da PHD, seguindo as instruções da empresa.'],
        ['Leitura automática de nota fiscal', 'ao anexar uma nota ou comprovante no reembolso, a imagem é enviada a um serviço de inteligência artificial do Google apenas para ler os dados do documento e preencher o formulário. A leitura não é usada para nenhuma outra finalidade.'],
        ['Avisos por e-mail', 'o portal envia e-mails pela conta corporativa da PHD para avisar aprovadores e interessados sobre pedidos. No fechamento de prestadores, cada prestador recebe por e-mail o termo com os próprios valores.'],
        ['Sistemas internos', 'informações necessárias ao pagamento e à gestão de pessoal são levadas aos sistemas corporativos da PHD, incluindo o sistema de gestão usado pelo Financeiro.'],
        ['Órgãos públicos', 'quando a lei, um contrato ou uma decisão judicial exigir.'],
      ],
      fecho: [
        'A PHD não vende dados pessoais e não os compartilha com terceiros para publicidade.',
      ],
    },
    {
      id: 'retencao',
      titulo: '5. Por quanto tempo guardamos',
      paragrafos: [
        'Os dados são guardados enquanto durar o vínculo com a empresa e, depois disso, pelo prazo necessário para cumprir obrigações legais e para a defesa de direitos em eventual processo — em regra, os prazos previstos na legislação trabalhista, previdenciária e fiscal.',
        'Encerrados esses prazos, os dados são eliminados ou anonimizados. Registros de aprovação e histórico de pedidos são mantidos porque comprovam decisões tomadas pela empresa.',
      ],
    },
    {
      id: 'direitos',
      titulo: '6. Seus direitos e como exercer',
      paragrafos: [
        'A LGPD garante a você, como titular, o direito de:',
      ],
      itens: [
        ['Confirmar e acessar', 'saber se tratamos dados seus e obter uma cópia deles.'],
        ['Corrigir', 'pedir a correção de dado incompleto, inexato ou desatualizado.'],
        ['Anonimizar, bloquear ou eliminar', 'quando o dado for desnecessário, excessivo ou tratado fora da lei.'],
        ['Portar', 'pedir a portabilidade a outro fornecedor, observados os limites da lei.'],
        ['Informação sobre compartilhamento', 'saber com quais entidades públicas e privadas compartilhamos seus dados.'],
        ['Revogar consentimento', 'nos casos em que o tratamento se baseia no seu consentimento.'],
        ['Opor-se', 'contestar um tratamento feito com base no legítimo interesse.'],
      ],
      fecho: [
        'Para exercer qualquer desses direitos, escreva para o encarregado, no e-mail indicado no topo desta página. A resposta é dada nos prazos da LGPD. Parte dos dados não pode ser eliminada enquanto houver obrigação legal de guardá-los — nesse caso, explicamos o motivo na resposta.',
      ],
    },
    {
      id: 'seguranca',
      titulo: '7. Segurança',
      paragrafos: [
        'O acesso ao portal exige conta corporativa e é limitado por perfil: cada tela mostra apenas o que aquela pessoa pode ver, e essa checagem é feita também no banco de dados, não só na tela.',
        'As ações relevantes ficam registradas com autor, data e hora — quem enviou, quem aprovou, quem corrigiu —, e parte desses registros é gravada de forma que não possa ser alterada depois.',
        'Se ocorrer um incidente de segurança que possa trazer risco relevante a você, a PHD comunicará você e a Autoridade Nacional de Proteção de Dados (ANPD), como determina a lei.',
      ],
    },
    {
      id: 'cookies',
      titulo: '8. Cookies e dados guardados no seu navegador',
      paragrafos: [
        'O portal usa apenas o necessário para funcionar: manter você conectado depois do login e lembrar preferências de exibição, como o menu lateral recolhido. Não há cookies de publicidade nem rastreamento de navegação fora do portal.',
        'Sua foto de perfil não fica guardada no portal: ela é buscada na sua conta Microsoft 365 e mantida apenas no seu próprio navegador.',
      ],
    },
    {
      id: 'mudancas',
      titulo: '9. Mudanças neste aviso',
      paragrafos: [
        'Quando o portal passar a tratar dados de um jeito diferente, este aviso é atualizado, com nova versão e nova data no topo da página. Mudança relevante é comunicada pelos canais internos da empresa.',
      ],
    },
    {
      id: 'contato',
      titulo: '10. Dúvidas',
      paragrafos: [
        'Fale com o encarregado pelo tratamento de dados pessoais, no contato publicado no topo desta página. Se preferir, procure o Departamento Pessoal, que encaminha o seu pedido.',
      ],
    },
  ],
};
