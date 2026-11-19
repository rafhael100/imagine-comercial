/**
 * R10 — Anonymous post-sale triage, exclusively in the isolated laboratory.
 * No credentials, identity, order number, contact details, ticket or CRM effect.
 */
export const SUPPORT_SESSION_SCHEMA = 'faisca.support-session.v1';
export const SUPPORT_BRIEF_SCHEMA = 'faisca.support-brief.v1';
const VERSION = 'faisca-support-r10-1';
const trusted = new WeakSet();

const topics = Object.freeze({
  delivery: 'Acompanhamento de entrega',
  technical: 'Dificuldade técnica',
  billing: 'Cobrança ou contrato',
  cancellation: 'Alteração ou cancelamento',
  general: 'Orientação geral'
});
const services = Object.freeze({
  onepage: 'Site Onepage',
  'landing-page': 'Landing Page',
  'google-ads': 'Gestão Google Ads',
  'meta-ads': 'Gestão Meta Ads',
  crm: 'Imagine CRM',
  unspecified: 'Prefiro não informar'
});
const details = Object.freeze({
  delivery: Object.freeze({
    progress: 'Acompanhar andamento',
    approval: 'Esclarecer aprovação pendente',
    publication: 'Entender condições de publicação',
    unspecified: 'Ainda não sei'
  }),
  technical: Object.freeze({
    site_unavailable: 'Página não abre',
    contact_form: 'Dificuldade com formulário',
    visual: 'Problema visual ou de navegação',
    unspecified: 'Ainda não sei'
  }),
  billing: Object.freeze({
    invoice: 'Nota fiscal',
    payment: 'Verificação de pagamento',
    contract: 'Condições contratuais',
    unspecified: 'Ainda não sei'
  }),
  cancellation: Object.freeze({
    cancel_request: 'Solicitar cancelamento',
    renewal: 'Dúvida sobre renovação',
    terms: 'Esclarecer condições',
    unspecified: 'Ainda não sei'
  }),
  general: Object.freeze({
    channels: 'Encontrar o canal oficial',
    service: 'Conhecer orientações do serviço',
    other: 'Outro assunto',
    unspecified: 'Ainda não sei'
  })
});
const topicGuidance = Object.freeze({
  delivery: 'O andamento de uma entrega precisa ser consultado em ambiente autenticado. Use o Portal ou o canal oficial confirmado pela Imagine. Esta prévia não consulta pedidos nem informa prazos.',
  technical: 'Descreva o comportamento ao suporte pelo canal oficial após confirmar sua identidade. Não envie senhas, tokens, acessos, dados de clientes ou registros sensíveis nesta prévia.',
  billing: 'Condições, cobranças, notas fiscais e pagamentos devem ser conferidos no Portal autenticado ou pelo canal oficial. Esta prévia não verifica quitação nem gera cobranças.',
  cancellation: 'Solicitações de alteração e cancelamento seguem o contrato vigente e canais autorizados. Esta prévia não altera nem cancela serviços.',
  general: 'Consulte os canais oficiais da Imagine. A disponibilidade de cada serviço e seus recursos precisam ser confirmados antes de assumir compromissos.'
});
const fieldOrder = Object.freeze(['topic', 'service', 'detail']);

function state(topic, service, detail) {
  const result = Object.freeze({
    schema: SUPPORT_SESSION_SCHEMA, version: VERSION, topic, service, detail
  });
  trusted.add(result);
  return result;
}
function isChoiceAllowed(table, value) {
  return typeof value === 'string' && Object.hasOwn(table, value);
}

export function createSupportSession() {
  return state(null, null, null);
}

export function inspectSupportSession(session) {
  if (!trusted.has(session)) return null;
  return Object.freeze({
    schema: session.schema, topic: session.topic, service: session.service,
    detail: session.detail, complete: session.topic !== null &&
      session.service !== null && session.detail !== null
  });
}

export function getNextSupportQuestion(session) {
  if (!trusted.has(session)) return null;
  const field = fieldOrder.find(name => session[name] === null);
  if (!field) return null;
  const table = field === 'topic' ? topics : field === 'service'
    ? services : details[session.topic];
  const prompt = field === 'topic'
    ? 'Qual é o assunto que você deseja organizar?'
    : field === 'service'
      ? 'A qual serviço esta dúvida está relacionada? Não é necessário informar dados do contrato.'
      : 'Qual destas opções descreve melhor o assunto?';
  return Object.freeze({
    field, prompt,
    options: Object.freeze(Object.entries(table).map(([value, label]) => Object.freeze({ value, label })))
  });
}

/** Only the current, closed choice is accepted. No arbitrary text is stored. */
export function chooseSupportOption(session, field, value) {
  if (!trusted.has(session)) return null;
  const question = getNextSupportQuestion(session);
  if (!question || question.field !== field || !question.options.some(option => option.value === value)) return null;
  return state(
    field === 'topic' ? value : session.topic,
    field === 'service' ? value : session.service,
    field === 'detail' ? value : session.detail
  );
}

/** Deliberate correction clears the selected field and all dependent answers. */
export function reviseSupportOption(session, field) {
  if (!trusted.has(session)) return null;
  const index = fieldOrder.indexOf(field);
  // Reject correction of an answer that has not been selected yet. This keeps
  // unexpected/stale action IDs from creating misleading "corrected" states.
  if (index < 0 || session[field] === null) return null;
  const values = [session.topic, session.service, session.detail];
  for (let i = index; i < values.length; i++) values[i] = null;
  return state(...values);
}

export function buildSupportBrief(session) {
  if (!trusted.has(session)) return null;
  const topic = session.topic, service = session.service, detail = session.detail;
  const summary = [
    'RESUMO DE SUPORTE — RASCUNHO NÃO ENVIADO',
    'Assunto declarado: ' + (topic ? topics[topic] : 'Não informado'),
    'Serviço informado (não verificado): ' + (service ? services[service] : 'Não informado'),
    'Detalhe selecionado: ' + (detail && topic ? details[topic][detail] : 'Não informado'),
    '',
    topic ? topicGuidance[topic] : 'Para organizar sua solicitação, escolha um assunto. Nenhum pedido será consultado nesta prévia.',
    '',
    'Nenhum ticket foi aberto, nenhuma solicitação foi enviada e nenhum dado de cliente foi consultado.',
    'Para consultar ou alterar um serviço real, utilize o Portal autenticado ou canal oficial confirmado.'
  ].join('\n');
  return Object.freeze({
    schema: SUPPORT_BRIEF_SCHEMA,
    summary,
    mode: 'copy_only',
    sent: false,
    ticketCreated: false,
    verifiedCustomer: false,
    requiresAuthentication: true,
    operationalEffects: false
  });
}

export function getSupportOptions() {
  return Object.freeze({
    topics: Object.freeze(Object.keys(topics)),
    services: Object.freeze(Object.keys(services)),
    detailsByTopic: Object.freeze(Object.fromEntries(Object.entries(details).map(([topic, values]) =>
      [topic, Object.freeze(Object.keys(values))])))
  });
}
