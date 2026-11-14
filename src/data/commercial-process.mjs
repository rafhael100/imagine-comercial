/**
 * F64 — editorial description of possible service process stages.
 * Not a contract, quote, approval, SLA or assertion that Portal is live.
 */
export const processStages=Object.freeze([
  Object.freeze({
    key:'objetivo',title:'Entender o objetivo',
    summary:'A conversa começa pela necessidade da empresa, pelo público e pelo resultado que se deseja acompanhar.',
    confirmation:'Que problema o projeto deve ajudar a resolver?'
  }),
  Object.freeze({
    key:'formato',title:'Escolher o formato',
    summary:'Onepage, site, Landing Page e gestão de mídia têm finalidades diferentes. Algumas necessidades podem combinar soluções.',
    confirmation:'Qual formato atende ao objetivo sem acrescentar complexidade desnecessária?'
  }),
  Object.freeze({
    key:'proposta',title:'Conferir a proposta',
    summary:'Escopo, entregas, valores, prazos, responsabilidades e condições de continuidade devem ser descritos na proposta vigente antes de qualquer aceite.',
    confirmation:'O que está incluído, o que não está e quais condições precisam de confirmação?'
  }),
  Object.freeze({
    key:'aprovacao',title:'Alinhar materiais e aprovações',
    summary:'Textos, imagens, identidade visual, acessos e permissões necessários são definidos conforme o serviço contratado e os canais autorizados.',
    confirmation:'Quem poderá fornecer materiais e aprovar as etapas?'
  }),
  Object.freeze({
    key:'execucao',title:'Executar e revisar',
    summary:'As entregas e revisões seguem o escopo e os marcos acordados. Mudanças de escopo precisam de avaliação antes de serem assumidas.',
    confirmation:'Como serão registradas revisões e decisões durante o projeto?'
  }),
  Object.freeze({
    key:'continuidade',title:'Publicar ou acompanhar quando aplicável',
    summary:'A publicação, o suporte e o acompanhamento só acontecem quando previstos no contrato e quando os requisitos técnicos e autorizações estiverem atendidos.',
    confirmation:'Quais atividades continuam após a entrega e quais exigem contratação separada?'
  })
]);
export const preparationQuestions=Object.freeze([
 'Qual é o objetivo principal deste projeto?',
 'Quem precisa encontrar e compreender essa solução?',
 'Quais serviços ou ofertas precisam ser apresentados?',
 'Quais textos, imagens e informações já estão disponíveis?',
 'Quem será responsável por decisões e aprovações?',
 'Existem integrações, campanhas ou prazos que precisam ser avaliados na proposta?'
]);
if(new Set(processStages.map(stage=>stage.key)).size!==processStages.length||
  processStages.length!==6||preparationQuestions.length!==6)
  throw new Error('F64: invalid editorial process catalog');
