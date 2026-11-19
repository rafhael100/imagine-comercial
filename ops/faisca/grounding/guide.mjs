import { respond, getActionCatalog } from '../core.mjs';
import { CATALOG, getGroundingSources } from './catalog.mjs';

const actions = getActionCatalog();
const passages = new Map(CATALOG.passages.map(passage => [passage.id, passage]));
const sources = new Map(getGroundingSources().map(source => [source.id, source]));
const recipes = new Map(CATALOG.answers.map(answer => [answer.id, answer]));
const encoder = new TextEncoder();
const preflight = new Set(['invalid_input', 'invalid_session', 'too_long', 'sensitive_input', 'unsupported_instruction']);
const boundaryActions = new Set(['after_sales', 'support_status', 'support_issue', 'support_billing', 'support_cancel', 'goal_sales', 'privacy']);
const aliases = Object.freeze({ goal_ads: 'channel_compare', materials_ready: 'materials_help' });
const localActions = ['sell', 'faq', 'after_sales', 'human'];
const normalize = text => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

function dataProperty(value, key) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  } catch { return undefined; }
}

function dataList(value, max, readItem) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length?.value;
    if (!Number.isInteger(length) || length < 0 || length > max || Reflect.ownKeys(value).length !== length + 1) return null;
    const result = [];
    for (let i = 0; i < length; i++) {
      if (!descriptors[i] || !Object.hasOwn(descriptors[i], 'value')) return null;
      const item = readItem(descriptors[i].value);
      if (item === null) return null;
      result.push(item);
    }
    return result;
  } catch { return null; }
}

/** Finite reviewed fact labels; this does not detect arbitrary prose conflicts. */
export function hasConflictingGroundingFacts(selected) {
  const facts = new Map();
  const ids = new Set();
  let totalBytes = 0;
  const safe = dataList(selected, 3, passage => {
    const id = dataProperty(passage, 'id');
    const text = dataProperty(passage, 'text');
    const key = dataProperty(passage, 'factKey');
    const value = dataProperty(passage, 'factValue');
    if (typeof id !== 'string' || ids.has(id) || typeof text !== 'string' || !text.trim() ||
        typeof key !== 'string' || !/^[a-z][a-z0-9_.]{0,79}$/.test(key) ||
        typeof value !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(value)) return null;
    const bytes = encoder.encode(text).length;
    totalBytes += bytes;
    if (bytes > 512 || totalBytes > 1200 || (facts.has(key) && facts.get(key) !== value)) return null;
    ids.add(id);
    facts.set(key, value);
    return id;
  });
  return !safe || safe.length === 0;
}

/** One complete reviewed answer. No caller-selected prose or source metadata. */
export function getGroundedAnswer(answerId) {
  const recipe = typeof answerId === 'string' && recipes.get(answerId);
  if (!recipe) return null;
  const selected = recipe.passageIds.map(id => passages.get(id));
  if (hasConflictingGroundingFacts(selected)) return null;
  const text = [recipe.prefix, ...selected.map(passage => passage.title + ':\n' + passage.text), recipe.suffix]
    .filter(Boolean).join('\n\n');
  if ([...text].length > 3000) return null;
  return Object.freeze({ id: recipe.id, passageIds: recipe.passageIds, text,
    sources: Object.freeze(selected.map(passage => sources.get('faisca.passage.' + passage.id + '@r06-1'))),
    actions: Object.freeze(recipe.actionIds.map(id => Object.freeze({ id, label: actions[id] }))) });
}

/** Find the exact recipe, including ordered passages and interface actions. */
export function findGroundedAnswer(candidate) {
  const text = dataProperty(candidate, 'text');
  if (typeof text !== 'string' || [...text].length > 3000) return null;
  const candidateSources = dataList(dataProperty(candidate, 'sources'), 3, value => {
    const id = dataProperty(value, 'id'), version = dataProperty(value, 'version');
    return typeof id === 'string' && typeof version === 'string' ? { id, version } : null;
  });
  const candidateActions = dataList(dataProperty(candidate, 'actions'), 6, value => {
    const id = dataProperty(value, 'id');
    return typeof id === 'string' ? id : null;
  });
  if (!candidateSources || !candidateActions) return null;
  let match = null;
  for (const recipe of CATALOG.answers) {
    const answer = getGroundedAnswer(recipe.id);
    if (!answer || text !== answer.text ||
        JSON.stringify(candidateSources) !== JSON.stringify(answer.sources.map(({ id, version }) => ({ id, version }))) ||
        JSON.stringify(candidateActions) !== JSON.stringify(answer.actions.map(({ id }) => id))) continue;
    if (match) return null; // A duplicate recipe must not create ambiguous evidence.
    match = answer;
  }
  return match;
}

function localReply(base, intent, { text, keepSession = false, session } = {}) {
  const defaultText = intent === 'grounding_unsupported'
    ? 'Não encontrei, nesta base editorial, um trecho que responda especificamente a essa pergunta. Escolha uma opção abaixo ou leve esse assunto à equipe para confirmação.'
    : intent === 'grounding_ambiguous'
      ? 'Sua pergunta reúne temas ou objetivos diferentes. Para usar a fonte adequada, escolha primeiro qual assunto você quer esclarecer.'
      : (intent === 'grounding_boundary' ? 'Orientação local, sem consulta a dados de cliente:\n\n' : 'Orientação local para organizar a conversa:\n\n') + base.reply.text;
  return Object.freeze({ session: keepSession ? session : base.session, userText: base.userText,
    reply: Object.freeze({ text: text ?? defaultText, intent, state: 'TALK', sources: Object.freeze([]),
      actions: intent === 'grounding_unsupported' || intent === 'grounding_ambiguous'
        ? Object.freeze(localActions.map(id => Object.freeze({ id, label: actions[id] }))) : base.reply.actions }) });
}

// Conservative, finite topic routing. The original core preflight always runs
// first; this matcher neither generalizes facts nor performs semantic NLP.
function routeText(text) {
  const value = normalize(text);
  if (/^(oi|ola|bom dia|boa tarde|boa noite|inicio|comecar|recomecar)[!?.\s]*$/.test(value)) return { action: 'home' };
  if (/\b(?:resumo|resumir)\b/.test(value)) return { action: 'summary' };
  if (/humano|atendente|falar com (?:a )?equipe|whatsapp|falar com alguem/.test(value)) return { action: 'human' };
  if (/privacidade|dados pessoais|seguranca da conversa/.test(value)) return { action: 'privacy' };
  if (/\b(?:crm|funil|oportunidades|equipe comercial)\b/.test(value) || /organizar (?:minhas? |as? )?vendas/.test(value)) return { action: 'goal_sales' };
  if (/cancel|rescind/.test(value)) return { action: 'support_cancel' };
  if (/boleto|fatura|nota fiscal|cobranca|pagamento do meu|paguei/.test(value)) return { action: 'support_billing' };
  if (/fora do ar|nao funciona|problema tecnico|erro no meu/.test(value)) return { action: 'support_issue' };
  if (/\b(?:meu|minha|nosso|nossa)\s+(?:projeto|site|landing\s?page|pagina|campanha|entrega|pedido|contrato|servico)\b/.test(value) &&
      /prazo|previsao|quando|quanto tempo|demora|entrega|andamento|status|pronto|ficar/.test(value)) return { action: 'support_status' };
  if (/meu pedido|meu contrato|andamento|status|acompanhar entrega|ja esta pronto/.test(value)) return { action: 'support_status' };
  if (/ja sou cliente|sou cliente|pos.venda/.test(value)) return { action: 'after_sales' };

  // These topics have no reviewed answer recipe, even when "site" or "Ads"
  // occurs in the same sentence. Do not mislabel a related generic paragraph.
  if (/\b(?:wordpress|wix|shopify|hospedagem|dominio|ssl|plugins?|api|asaas|ecommerce|e-commerce|chatgpt)\b|\be[ -]?mail\b|loja virtual|codigo.fonte|integra(?:cao|coes)/.test(value)) return { local: 'grounding_unsupported' };

  const price = /\b(?:preco|precos|custo|custa|custam|valor|valores|orcamento|investimento|mensalidade|desconto)\b/.test(value);
  const result = /garant|resultado|primeir[oa].*(google|posicao)|vendas garantidas/.test(value);
  const scope = /\b(?:prazo|prazos|revisao|revisoes|alteracao|alteracoes|escopo)\b|quanto tempo/.test(value);
  const materials = /\b(?:materiais|textos?|imagens?|referencias)\b/.test(value);
  const process = /\b(?:etapas|processo|producao)\b|como funciona (?:o |um |esse )?projeto|^como funciona[?!.\s]*$/.test(value);
  const topics = [['pricing', price], ['results', result], ['scope', scope], ['materials_help', materials], ['process', process]].filter(([, matched]) => matched);
  if (topics.length > 1) return { local: 'grounding_ambiguous' };

  const onepage = /\b(?:onepage|site|sites|institucional)\b|apresentar (?:a |minha |nossa )?empresa|presenca digital/.test(value);
  const landing = /\blanding(?: page)?\b/.test(value);
  const google = /\bgoogle(?: ads)?\b/.test(value);
  const meta = /\b(?:meta ads|meta|instagram|facebook)\b/.test(value);
  const ads = google || meta || /\b(?:anuncio|anuncios|anunciar|trafego pago|divulgar)\b/.test(value);
  if ((onepage || landing) && ads && topics.length === 0) return { local: 'grounding_ambiguous' };
  if (topics.length === 1) return { action: topics[0][0] };
  if (google && meta || /comparar (?:os )?canais|diferenca (?:entre )?(?:os )?canais/.test(value)) return { action: 'channel_compare' };
  if (google) return { action: 'channel_google' };
  if (meta) return { action: 'channel_meta' };
  if (ads) return { action: 'goal_ads' };
  if (onepage && landing) {
    return /diferenca|comparar|comparacao|\bou\b/.test(value) ? { action: 'compare_sites' } : { local: 'grounding_ambiguous' };
  }
  const campaign = landing || /\b(?:campanha|captar|leads|oferta)\b/.test(value);
  if (onepage && campaign) return { local: 'grounding_ambiguous' };
  if (campaign) return { action: 'goal_campaign' };
  if (onepage) return { action: 'goal_presence' };
  if (/^(?:tenho uma |tirar uma )?(?:duvida|pergunta)[?!.\s]*$/.test(value)) return { action: 'faq' };
  if (/^(?:quero |como )?(?:comprar|contratar|escolher)(?: uma solucao| um servico)?[?!.\s]*$/.test(value)) return { action: 'sell' };
  return { local: 'grounding_unsupported' };
}

/** Same pure interface as core.respond; source-backed content is opt-in R06. */
export function groundedRespond(session, input) {
  const original = respond(session, input);
  if (preflight.has(original.reply.intent)) return original;
  const type = dataProperty(input, 'type');
  // Use the same private-account preflight as the Faísca host. R06 must not
  // return a generic public site recipe for an identified post-sale request.
  if (type === 'text' && boundaryActions.has(original.reply.intent)) {
    return localReply(original, 'grounding_boundary', original.reply.intent === 'goal_sales' ? {
      text: 'Orientação local: esta base de trechos não confirma funcionalidades, disponibilidade ou condições do Imagine CRM. Posso organizar seu interesse em um resumo para conversar com a equipe.'
    } : {});
  }
  const route = type === 'action' ? { action: dataProperty(input, 'id') } : routeText(original.userText);
  if (route.local) return localReply(original, route.local, { keepSession: true, session });
  const actionId = route.action;
  const base = type === 'action' ? original : { ...respond(session, { type: 'action', id: actionId }), userText: original.userText };
  if (boundaryActions.has(actionId)) {
    return localReply(base, 'grounding_boundary', actionId === 'goal_sales' ? {
      text: 'Orientação local: esta base de trechos não confirma funcionalidades, disponibilidade ou condições do Imagine CRM. Posso organizar seu interesse em um resumo para conversar com a equipe.'
    } : {});
  }
  const answer = getGroundedAnswer(aliases[actionId] ?? actionId);
  if (!answer) return localReply(base, 'grounding_navigation');
  if (type === 'action' && ['materials_ready', 'materials_help'].includes(actionId) && !['presence', 'campaign'].includes(session.goal)) {
    return localReply(base, 'grounding_navigation');
  }
  return Object.freeze({ session: base.session, userText: base.userText,
    reply: Object.freeze({ text: answer.text, intent: actionId, state: 'TALK', sources: answer.sources, actions: answer.actions }) });
}
