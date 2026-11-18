/**
 * FAI-01: curated editorial snapshot for an OFFLINE guided demonstration.
 * Read from src/data/{services,commercial-faq,commercial-process}.mjs at
 * 209bd893e741e7fd8d824d8e184471a86ee267ab. No operational authority.
 * This file deliberately has no imports so the preview can be bundled locally.
 */
export const KNOWLEDGE = Object.freeze({
  version: 'faisca-editorial-1',
  sourceRevision: '209bd893e741e7fd8d824d8e184471a86ee267ab',
  reviewStatus: 'pending_operational_editorial_review',
  sources: {
    services: {
      id: 'comercial.services@209bd893:faisca-1',
      title: 'Soluções Imagine · base editorial; revisão operacional pendente',
      path: 'src/data/services.mjs'
    },
    faq: {
      id: 'comercial.faq@209bd893:faisca-1',
      title: 'Perguntas frequentes · base editorial; revisão operacional pendente',
      path: 'src/data/commercial-faq.mjs'
    },
    process: {
      id: 'comercial.process@209bd893:faisca-1',
      title: 'Como funciona · base editorial; revisão operacional pendente',
      path: 'src/data/commercial-process.mjs'
    },
    proposal: {
      id: 'faisca.journeys@1',
      title: 'Jornada proposta do Faísca · revisão operacional pendente',
      path: 'ops/faisca/knowledge.mjs'
    }
  },
  services: {
    onepage: {
      label: 'Site Onepage',
      description: 'Reúne a apresentação da empresa, seus diferenciais, serviços e canais de contato em uma única página organizada.',
      source: 'services'
    },
    'landing-page': {
      label: 'Landing Page',
      description: 'Concentra a atenção em uma oferta e uma ação, como iniciar uma conversa sobre uma campanha específica.',
      source: 'services'
    },
    'gestao-google-ads': {
      label: 'Gestão Google Ads',
      description: 'Considera objetivos, intenção de busca, anúncios, páginas de destino e acompanhamento de resultados.',
      source: 'services'
    },
    'gestao-meta-ads': {
      label: 'Gestão Meta Ads',
      description: 'Considera público, mensagem, criativos e página de destino para campanhas no Instagram e Facebook.',
      source: 'services'
    },
    crm: {
      label: 'Imagine CRM · avaliação de necessidade',
      description: 'Podemos organizar uma conversa sobre acompanhamento de contatos, oportunidades e próximos passos da equipe. Disponibilidade, recursos e contratação precisam de confirmação.',
      source: 'proposal'
    }
  },
  faq: {
    pricing: 'Implantação, mensalidade, entregas, suporte, prazos e condições precisam constar na proposta oficial. Valores e contratação pertencem ao Portal. Nesta demonstração não existe consulta ao Portal; por isso não informo preço, desconto ou cotação contratável.',
    results: 'Uma página ou campanha não garante vendas nem posições no Google. Oferta, público, concorrência, investimento e o atendimento comercial influenciam o resultado. Podemos definir o objetivo e os indicadores a acompanhar.',
    scope: 'Entregas, revisões, prazos e condições de continuidade devem ser definidos na proposta antes do aceite. Uma solicitação fora do escopo precisa ser avaliada, sem promessa automática de inclusão.',
    media: 'Investimento nas plataformas de anúncios e remuneração da gestão são itens distintos. A escolha dos canais e as responsabilidades de pagamento devem estar claras na proposta.',
    privacy: 'Não envie senhas, códigos de acesso, documentos ou informações de pagamento aqui. Esta prévia mantém a conversa apenas na memória da página e não envia dados ao CRM, ao Portal ou a um serviço de IA.'
  },
  processStages: [
    'Entender seu objetivo e público.',
    'Escolher o formato adequado.',
    'Conferir escopo, valores, prazos e responsabilidades na proposta oficial.',
    'Alinhar materiais e responsáveis pelas aprovações.',
    'Executar e revisar conforme o que foi contratado.',
    'Publicar ou acompanhar quando previsto no contrato e autorizado.'
  ]
});
