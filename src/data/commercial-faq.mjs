/**
 * F65 — public informational FAQs. No legal term, price, guarantee or
 * entitlement is created by this content. All values require proposal review.
 */
export const commercialFaqSections=Object.freeze([
  Object.freeze({
    code:'escopo',
    title:'Escopo e planejamento',
    questions:Object.freeze([
      Object.freeze({
        id:'escolha',
        question:'Preciso saber qual serviço contratar antes de entrar em contato?',
        answer:'Não. Você pode apresentar o objetivo da empresa e comparar formatos possíveis. Onepage, site com várias páginas, Landing Page e gestão de anúncios respondem a necessidades diferentes. A escolha e os entregáveis devem ser confirmados na proposta.'
      }),
      Object.freeze({
        id:'materiais',
        question:'Quais informações são úteis para iniciar uma conversa?',
        answer:'É útil saber o objetivo, o público, os serviços que precisam de apresentação e quais textos e imagens já existem. Não envie senhas, acessos ou dados pessoais sensíveis por canais não homologados.'
      })
    ])
  }),
  Object.freeze({
    code:'contratacao',
    title:'Proposta e condições',
    questions:Object.freeze([
      Object.freeze({
        id:'precos',
        question:'Existe um preço único para todos os projetos?',
        answer:'Não é possível definir um valor sem avaliar o escopo. Implantação, mensalidade, entregas, suporte, prazos e condições precisam constar na proposta oficial e nos documentos aplicáveis.'
      }),
      Object.freeze({
        id:'revisoes',
        question:'Como são definidos revisões, prazos e alterações de escopo?',
        answer:'Essas condições dependem do serviço contratado e devem ser registradas antes da execução. Solicitações fora do escopo acordado precisam de avaliação, não constituem entregas automáticas.'
      })
    ])
  }),
  Object.freeze({
    code:'midia',
    title:'Campanhas e resultados',
    questions:Object.freeze([
      Object.freeze({
        id:'midia',
        question:'O investimento nos anúncios é o mesmo que o valor da gestão?',
        answer:'Não. O orçamento destinado às plataformas de anúncios e a remuneração pelo serviço de gestão são itens distintos. A proposta deve explicar cada componente e as responsabilidades de pagamento.'
      }),
      Object.freeze({
        id:'resultados',
        question:'Uma campanha ou site garante vendas ou posições no Google?',
        answer:'Não. Resultados dependem de oferta, demanda, concorrência, público, investimento e outros fatores. Indicadores e objetivos podem orientar o acompanhamento, mas não constituem garantia de performance.'
      })
    ])
  }),
  Object.freeze({
    code:'operacao',
    title:'Aprovações e acesso',
    questions:Object.freeze([
      Object.freeze({
        id:'portal',
        question:'Como funciona o acompanhamento pelo Portal do Cliente?',
        answer:'O Portal está previsto para apoiar o acompanhamento e aprovações dos serviços elegíveis. As integrações operacionais ainda dependem de homologação; canais e rotinas efetivamente disponíveis precisam ser confirmados antes da contratação.'
      }),
      Object.freeze({
        id:'acessos',
        question:'Devo enviar senhas ou acessos pelos links públicos de contato?',
        answer:'Não. Os links públicos servem para iniciar uma conversa. O compartilhamento de credenciais e permissões deve ocorrer apenas por um processo seguro e previamente autorizado, conforme os requisitos do serviço.'
      })
    ])
  })
]);
const keys=commercialFaqSections.flatMap(section=>section.questions.map(x=>x.id));
if(new Set(keys).size!==keys.length||keys.length!==8)
  throw new Error('F65: duplicated or missing curated commercial FAQ');
