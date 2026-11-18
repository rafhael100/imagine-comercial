import { getConfirmedService } from '../journey/state.mjs';

const VERSION = 'faisca-lead-profile-r08-1';
export const LEAD_PROFILE_SCHEMA = 'faisca.lead-profile.v1';
export const LEAD_HANDOFF_SCHEMA = 'faisca.lead-handoff.v1';

const serviceValues = new Set(['onepage', 'landing-page']);
const fields = Object.freeze(['objective', 'audience', 'materials', 'timeline', 'contactConsent']);
const values = Object.freeze({
  objective: new Set(['present_company', 'capture_leads', 'sell_online', 'organize_service', 'not_specified']),
  audience: new Set(['local_customers', 'businesses', 'online_consumers', 'existing_clients', 'not_specified']),
  materials: new Set(['ready', 'need_support', 'not_specified']),
  timeline: new Set(['within_30_days', 'within_90_days', 'flexible', 'not_specified']),
  contactConsent: new Set(['not_asked', 'granted', 'declined', 'later'])
});
const labels = Object.freeze({
  service: Object.freeze({ onepage: 'Site Onepage', 'landing-page': 'Landing Page' }),
  objective: Object.freeze({
    present_company: 'Apresentar a empresa', capture_leads: 'Captar contatos',
    sell_online: 'Vender online', organize_service: 'Organizar o atendimento',
    not_specified: 'Não informado'
  }),
  audience: Object.freeze({
    local_customers: 'Clientes da região', businesses: 'Outras empresas',
    online_consumers: 'Consumidores online', existing_clients: 'Clientes atuais',
    not_specified: 'Não informado'
  }),
  materials: Object.freeze({
    ready: 'Textos e imagens disponíveis', need_support: 'Precisa de apoio com o conteúdo',
    not_specified: 'Não informado'
  }),
  timeline: Object.freeze({
    within_30_days: 'Até 30 dias', within_90_days: 'Até 90 dias',
    flexible: 'Sem prazo definido', not_specified: 'Não informado'
  }),
  contactConsent: Object.freeze({
    not_asked: 'Ainda não perguntada', granted: 'Autorização declarada, ainda não enviada',
    declined: 'Não concedida', later: 'Prefere decidir depois'
  })
});

const questionData = Object.freeze({
  objective: Object.freeze({
    prompt: 'Qual é o principal resultado que você espera alcançar?',
    options: Object.freeze([
      ['present_company', 'Apresentar minha empresa'],
      ['capture_leads', 'Captar contatos interessados'],
      ['sell_online', 'Vender produtos ou serviços online'],
      ['organize_service', 'Organizar o atendimento'],
      ['not_specified', 'Ainda não defini']
    ])
  }),
  audience: Object.freeze({
    prompt: 'Quem você deseja alcançar principalmente?',
    options: Object.freeze([
      ['local_customers', 'Clientes da minha região'],
      ['businesses', 'Outras empresas'],
      ['online_consumers', 'Consumidores online'],
      ['existing_clients', 'Clientes atuais'],
      ['not_specified', 'Ainda não defini']
    ])
  }),
  materials: Object.freeze({
    prompt: 'Como estão os textos e as imagens do projeto?',
    options: Object.freeze([
      ['ready', 'Já tenho os materiais'],
      ['need_support', 'Preciso de ajuda com o conteúdo'],
      ['not_specified', 'Ainda não sei']
    ])
  }),
  timeline: Object.freeze({
    prompt: 'Qual é a sua previsão para iniciar o projeto?',
    options: Object.freeze([
      ['within_30_days', 'Nos próximos 30 dias'],
      ['within_90_days', 'Nos próximos 90 dias'],
      ['flexible', 'Sem prazo definido'],
      ['not_specified', 'Prefiro não informar']
    ])
  }),
  contactConsent: Object.freeze({
    prompt: 'Você autoriza que a equipe Imagine entre em contato futuramente sobre esta necessidade?',
    options: Object.freeze([
      ['granted', 'Sim, autorizo'],
      ['declined', 'Não autorizo'],
      ['later', 'Prefiro decidir depois']
    ])
  })
});

function plainData(value, expected) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expected.length || keys.some(key => typeof key !== 'string' || !expected.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result = Object.create(null);
    for (const key of expected) {
      if (!Object.hasOwn(descriptors[key], 'value')) return null;
      result[key] = descriptors[key].value;
    }
    return result;
  } catch { return null; }
}

export function validateLeadProfile(value) {
  const data = plainData(value, ['schema', 'version', 'service', ...fields]);
  if (!data || data.schema !== LEAD_PROFILE_SCHEMA || data.version !== VERSION ||
      !serviceValues.has(data.service)) return null;
  for (const field of fields) {
    if (field === 'contactConsent') {
      if (!values[field].has(data[field])) return null;
    } else if (data[field] !== null && !values[field].has(data[field])) return null;
  }
  return Object.freeze({ ...data });
}

/** Internal constructor; callers must derive the service from a trusted R07 session. */
function createLeadProfile(confirmedService) {
  if (!serviceValues.has(confirmedService)) return null;
  return Object.freeze({
    schema: LEAD_PROFILE_SCHEMA, version: VERSION, service: confirmedService,
    objective: null, audience: null, materials: null, timeline: null,
    contactConsent: 'not_asked'
  });
}

/** Only a trusted, explicitly confirmed R07 selection can start qualification. */
export function createLeadProfileFromJourney(journeySession) {
  const confirmedService = getConfirmedService(journeySession);
  return confirmedService ? createLeadProfile(confirmedService) : null;
}

/** Accept only a closed option for the named field; arbitrary visitor text is not stored. */
export function updateLeadProfile(profile, field, value) {
  const safe = validateLeadProfile(profile);
  const next = safe ? getNextQualificationQuestion(safe) : null;
  if (!safe || !next || next.field !== field || !values[field].has(value)) return null;
  return Object.freeze({ ...safe, [field]: value });
}

export function getNextQualificationQuestion(profile) {
  const safe = validateLeadProfile(profile);
  if (!safe) return null;
  const field = fields.find(name => name === 'contactConsent'
    ? safe[name] === 'not_asked' : safe[name] === null);
  if (!field) return null;
  const question = questionData[field];
  return Object.freeze({
    field, prompt: question.prompt,
    options: Object.freeze(question.options.map(([value, label]) => Object.freeze({ value, label })))
  });
}

export function isQualificationComplete(profile) {
  const safe = validateLeadProfile(profile);
  return Boolean(safe && fields.every(field => safe[field] !== null) &&
    safe.contactConsent !== 'not_asked');
}

export function buildHandoffPackage(profile) {
  const safe = validateLeadProfile(profile);
  if (!safe) return null;
  const summary = [
    'RESUMO DE ATENDIMENTO — RASCUNHO NÃO ENVIADO',
    'Solução confirmada: ' + labels.service[safe.service],
    'Objetivo: ' + (safe.objective ? labels.objective[safe.objective] : 'Não informado'),
    'Público: ' + (safe.audience ? labels.audience[safe.audience] : 'Não informado'),
    'Materiais: ' + (safe.materials ? labels.materials[safe.materials] : 'Não informado'),
    'Previsão declarada: ' + (safe.timeline ? labels.timeline[safe.timeline] : 'Não informado'),
    'Autorização para contato futuro: ' + labels.contactConsent[safe.contactConsent],
    'Nenhum contato foi coletado, enviado ou armazenado. Este resumo deve ser revisado antes de qualquer encaminhamento.'
  ].join('\n');
  return Object.freeze({
    schema: LEAD_HANDOFF_SCHEMA, profile: safe, summary,
    delivery: 'copy_only', sent: false, operationalEffects: false
  });
}
