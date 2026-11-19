import { KNOWLEDGE } from './knowledge.mjs';

/** FAI-01: deterministic, in-memory preview. No model, transport or persistence. */
const MAX_TEXT_CHARACTERS = 800;
const VERSION = 'faisca-guided-1';
const CAPABILITIES = Object.freeze({
  mode: 'guided_demo', network: false, llm: false, crm: false, portal: false,
  storage: false, telemetry: false, voice: false, rig3d: false
});
const ACTIONS = Object.freeze({
  sell: 'Encontrar minha solução', faq: 'Tirar uma dúvida',
  after_sales: 'Já sou cliente', human: 'Falar com a equipe', home: 'Voltar ao início',
  goal_presence: 'Apresentar minha empresa', goal_campaign: 'Captar contatos para uma oferta',
  goal_sales: 'Organizar minhas vendas', goal_ads: 'Divulgar com anúncios',
  compare_sites: 'Onepage ou Landing Page?', pricing: 'Como funciona o investimento?',
  process: 'Como funciona o projeto?', support_status: 'Acompanhar uma entrega',
  support_issue: 'Preciso de ajuda técnica', support_billing: 'Pagamento ou contrato',
  support_cancel: 'Alteração ou cancelamento', summary: 'Ver meu resumo',
  materials_ready: 'Já tenho textos e imagens', materials_help: 'Preciso organizar os materiais',
  channel_google: 'Conhecer Google Ads', channel_meta: 'Conhecer Meta Ads',
  channel_compare: 'Comparar os canais', results: 'O que posso esperar de resultados?',
  privacy: 'Privacidade da conversa', scope: 'Entregas, revisões e prazos'
});
const GOALS = Object.freeze({
  presence: 'Apresentar a empresa e seus serviços',
  campaign: 'Captar contatos para uma oferta específica',
  sales: 'Organizar contatos e oportunidades de venda',
  ads: 'Avaliar divulgação por anúncios'
});
const SUPPORT_TOPICS = Object.freeze({
  status: 'Acompanhamento de entrega', issue: 'Ajuda técnica',
  billing: 'Pagamento ou contrato', cancel: 'Alteração ou cancelamento'
});
const SESSION_FIELDS = Object.freeze([
  'version', 'journey', 'goal', 'selection', 'summary', 'turnCount',
  'lastIntent', 'supportTopic', 'materials'
]);
const JOURNEYS = new Set(['start', 'sell', 'faq', 'after_sales', 'human']);
const INTENTS = new Set(['welcome', 'invalid_input', 'invalid_session', 'too_long',
  'sensitive_input', 'unsupported_instruction', 'unknown', ...Object.keys(ACTIONS)]);

// Read only own data properties. Accessors, symbols and extra fields are rejected.
function readRecord(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string' || !allowed.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (required.some(key => !Object.hasOwn(descriptors, key))) return null;
    const copy = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, 'value')) return null;
      copy[key] = descriptor.value;
    }
    return copy;
  } catch { return null; }
}

function readSelection(value) {
  if (!Array.isArray(value)) return null;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length?.value;
    if (!Number.isInteger(length) || length < 0 || length > 5) return null;
    if (Reflect.ownKeys(value).some(key => typeof key !== 'string' ||
      (key !== 'length' && !/^(0|[1-4])$/.test(key)))) return null;
    const selection = [];
    for (let i = 0; i < length; i++) {
      const descriptor = descriptors[String(i)];
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      if (typeof descriptor.value !== 'string' || !Object.hasOwn(KNOWLEDGE.services, descriptor.value)) return null;
      selection.push(descriptor.value);
    }
    return new Set(selection).size === selection.length ? selection : null;
  } catch { return null; }
}

function summaryFor(session) {
  const lines = ['Resumo de interesse · demonstração Faísca'];
  if (session.goal) lines.push('Objetivo: ' + GOALS[session.goal] + '.');
  if (session.selection.length) lines.push('Soluções para avaliar: ' + session.selection.map(id => KNOWLEDGE.services[id].label).join('; ') + '.');
  if (session.materials === 'ready') lines.push('Materiais: textos e imagens já disponíveis para avaliação.');
  if (session.materials === 'help') lines.push('Materiais: precisa de orientação para organizar textos e imagens.');
  if (session.supportTopic) lines.push('Assunto de atendimento: ' + SUPPORT_TOPICS[session.supportTopic] + '.');
  if (!session.goal && !session.supportTopic) lines.push('Objetivo ainda não selecionado.');
  lines.push('Escopo, disponibilidade, valores e prazos: a confirmar pela equipe e no Portal.');
  lines.push('Este resumo não é uma proposta, pedido ou chamado e não foi enviado à equipe.');
  return lines.join('\n');
}

function finalizeSession(value) {
  const selection = Object.freeze([...value.selection]);
  const session = { ...value, selection };
  session.summary = summaryFor(session);
  return Object.freeze(session);
}

export function createSession() {
  return finalizeSession({ version: VERSION, journey: 'start', goal: null,
    selection: [], summary: '', turnCount: 0, lastIntent: 'welcome',
    supportTopic: null, materials: null });
}

function readSession(value) {
  const data = readRecord(value, SESSION_FIELDS);
  if (!data || data.version !== VERSION || !JOURNEYS.has(data.journey) ||
    (data.goal !== null && (typeof data.goal !== 'string' || !Object.hasOwn(GOALS, data.goal))) ||
    !Number.isInteger(data.turnCount) || data.turnCount < 0 || data.turnCount > 10000 ||
    !INTENTS.has(data.lastIntent) ||
    (data.supportTopic !== null && (typeof data.supportTopic !== 'string' || !Object.hasOwn(SUPPORT_TOPICS, data.supportTopic))) ||
    ![null, 'ready', 'help'].includes(data.materials)) return null;
  const selection = readSelection(data.selection);
  if (!selection || typeof data.summary !== 'string') return null;
  const safe = { ...data, selection };
  if (data.summary !== summaryFor(safe)) return null;
  return finalizeSession(safe);
}

function reply(text, intent, actionIds, sourceIds = [], state = 'TALK') {
  return Object.freeze({ text, intent, state,
    actions: Object.freeze(actionIds.map(id => Object.freeze({ id, label: ACTIONS[id] }))),
    sources: Object.freeze(sourceIds.map(id => Object.freeze({
      id: KNOWLEDGE.sources[id].id, title: KNOWLEDGE.sources[id].title
    })))
  });
}

export function getWelcome() {
  return reply('Oi! Eu sou o Faísca, assistente virtual da Imagine. Vamos encontrar o melhor caminho para o seu negócio? Escolha uma opção ou escreva sua dúvida. Esta é uma demonstração guiada, sem conexão a uma IA externa.',
    'welcome', ['sell', 'faq', 'after_sales', 'human'], ['proposal']);
}

export function getCapabilities() { return CAPABILITIES; }

// Read-only interface actions for the isolated conversation contract. No tools.
export function getActionCatalog() { return ACTIONS; }

export function getSummary(session) {
  const safe = readSession(session);
  return safe ? safe.summary : createSession().summary;
}

function finish(session, response, userText, patch = {}) {
  const next = finalizeSession({ ...session, ...patch,
    turnCount: Math.min(session.turnCount + 1, 10000), lastIntent: response.intent });
  return Object.freeze({ session: next, reply: response, userText });
}

function invalid(session, intent, message, userText = '[Mensagem não utilizada]') {
  return finish(session, reply(message, intent, ['sell', 'faq', 'after_sales', 'home'], [], 'ERROR'), userText);
}

function normalize(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

function hasSensitiveData(text) {
  // Conservative local heuristic, not a complete DLP control. Access-related
  // markers hide the whole message before any model/grounding dispatch.
  const normalized = normalize(text);
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text) ||
    /(?:\d[\s().+\-/]*){10,}/.test(text) ||
    /\b(?:senhas?|passwords?|passcode|tokens?|otp|mfa|2fa|bearer|access[_ -]?token|api[_ -]?key|chave (?:secreta|privada|(?:da |de )?api)|codigo (?:de (?:acesso|verificacao|autenticacao|seguranca)|mfa|otp))\b/i.test(normalized) ||
    // Short personal documents and random Pix identifiers can avoid a
    // ten-digit detector; refuse the subject without echoing its value.
    /\b(?:chave (?:aleatoria )?pix|pix copia(?: e |-| )cola|(?:meu|minha|nosso|nossa) (?:cpf|cnpj|rg|cep|endereco residencial))\b/.test(normalized) ||
    /\brg\b[\s:=-]{0,6}(?:\d[.\s-]*){7,9}\b/i.test(text) ||
    /\bcep\b[\s:=-]{0,6}\d{5}-?\d{3}\b/i.test(text) ||
    /https?:\/\/[^\s]+[?&](?:access_token|api_key|token|session|auth)=/i.test(text) ||
    /\b(?:sk-|ghp_|gho_|github_pat_)[A-Za-z0-9_-]{8,}\b/.test(text) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text);
}

/**
 * R13: finite, high-confidence Brazilian Portuguese patterns for private
 * account/support requests. Never infer a customer identity from this text.
 * Return guidance intent only, never an operational action.
 */
function inferExtendedOperationalHelp(value) {
  if (/\b(?:alterar|mudar|trocar|suspender|pausar)\b.{0,50}\b(?:meu|minha|nosso|nossa)\b.{0,30}\b(?:plano|servico|contrato|assinatura|site|campanha)\b/.test(value)) {
    return 'support_cancel';
  }
  if (/\b(?:segunda|2a|2)\s+via\b.{0,40}\b(?:recibo|comprovante|nota|documento|fatura|boleto)\b/.test(value) ||
      /\b(?:reembolso|estorno)\b/.test(value) ||
      /\b(?:valor|custo|preco)\b.{0,40}\b(?:do|da)?\s*(?:meu|minha|nosso|nossa)\s+(?:plano|assinatura|contrato|servico)\b/.test(value) ||
      /\b(?:quando|data)\b.{0,30}\b(?:vence|vencimento)\b.{0,20}\b(?:minha|meu)\s+(?:assinatura|plano)\b/.test(value)) {
    return 'support_billing';
  }
  if (/\b(?:problema|erro|falha|bug|defeito)\b.{0,35}\b(?:no|na|com o|com a)\s+(?:meu|minha|nosso|nossa)?\s*(?:site|pagina|landing|campanha|portal)\b/.test(value) ||
      /\b(?:site|pagina|landing|campanha)\b.{0,60}\b(?:contratei|contratamos)\b.{0,60}\b(?:erro|problema|falha|lento|fora do ar)\b/.test(value)) {
    return 'support_issue';
  }
  if (/\b(?:acessar|entrar|logar|login|log in)\b.{0,40}\b(?:portal|painel|area (?:do|de) cliente|minha conta)\b/.test(value) ||
      /\b(?:portal|painel|area (?:do|de) cliente|minha conta)\b.{0,30}\b(?:acesso|login|entrar)\b/.test(value)) {
    return 'after_sales';
  }
  return null;
}

function inferAction(text) {
  const value = normalize(text);
  if (/^(oi|ola|bom dia|boa tarde|boa noite|inicio|comecar|recomecar)[!?.\s]*$/.test(value)) return 'home';
  if (/resumo|resumir/.test(value)) return 'summary';
  if (/senha|privacidade|dados pessoais|seguranca/.test(value)) return 'privacy';
  const extendedOperationalHelp = inferExtendedOperationalHelp(value);
  if (extendedOperationalHelp) return extendedOperationalHelp;
  if (/cancel|rescind/.test(value)) return 'support_cancel';
  if (/boleto|fatura|nota fiscal|cobranca|pagamento do meu|paguei/.test(value)) return 'support_billing';
  const personalService = /\b(?:meu|minha|nosso|nossa)\s+(?:projeto|site|landing\s?page|pagina|campanha|entrega|pedido|contrato|servico)\b/.test(value);
  if (personalService && /prazo|previsao|quando|quanto tempo|demora|entrega|andamento|status|pronto|ficar/.test(value)) return 'support_status';
  if (/meu pedido|meu contrato|andamento|status|acompanhar|prazo da entrega|ja esta pronto/.test(value)) return 'support_status';
  if (/suporte|fora do ar|nao funciona|problema tecnico|erro no meu/.test(value)) return 'support_issue';
  if (/ja sou cliente|sou cliente|pos.venda/.test(value)) return 'after_sales';
  if (/humano|atendente|falar com (?:a )?equipe|whatsapp|falar com alguem/.test(value)) return 'human';
  if (/garant|resultado|primeir[oa].*(google|posicao)|vendas garantidas/.test(value)) return 'results';
  if (/preco|quanto|custa|valor|desconto|orcamento|investimento|barato|caro|mensalidade/.test(value)) return 'pricing';
  if (/como funciona|etapas|processo|projeto|producao|entrega/.test(value)) return 'process';
  if (/prazo|revisao|alteracao|incluido|escopo/.test(value)) return 'scope';
  if ((/google/.test(value) && /\bmeta\b|instagram|facebook/.test(value)) ||
    /(?:comparar|comparacao|diferenca).{0,45}(?:canais|anuncios|midia)/.test(value)) return 'channel_compare';
  if (/diferenca|comparar|onepage ou|landing page ou/.test(value)) return 'compare_sites';
  if (/google ads|anunciar no google/.test(value)) return 'channel_google';
  if (/meta ads|instagram|facebook/.test(value)) return 'channel_meta';
  if (/anuncio|anunciar|trafego pago|divulgar/.test(value)) return 'goal_ads';
  if (/crm|organizar|funil|oportunidade|equipe comercial/.test(value)) return 'goal_sales';
  if (/landing|campanha|captar|leads|oferta/.test(value)) return 'goal_campaign';
  if (/onepage|site|empresa|presenca/.test(value)) return 'goal_presence';
  if (/duvida|pergunta/.test(value)) return 'faq';
  if (/comprar|contratar|vender/.test(value)) return 'sell';
  return null;
}

function handleAction(session, id, userText) {
  const salesActions = ['pricing', 'process', 'summary', 'human'];
  let patch = {};
  let response;
  if (id === 'home') {
    return finish(createSession(), getWelcome(), userText);
  }
  if (id === 'sell') {
    patch = { journey: 'sell', goal: null, selection: [], supportTopic: null, materials: null };
    response = reply('Vamos começar pelo que você quer melhorar. Qual é a prioridade do seu negócio agora?', id,
      ['goal_presence', 'goal_campaign', 'goal_sales', 'goal_ads'], ['faq']);
  } else if (id === 'faq') {
    patch.journey = 'faq';
    response = reply('Posso explicar as opções e ajudar você a decidir com mais clareza. Qual destes assuntos quer entender primeiro?', id,
      ['compare_sites', 'pricing', 'process', 'results', 'privacy'], ['faq']);
  } else if (id === 'goal_presence' || id === 'goal_campaign') {
    const presence = id === 'goal_presence';
    const serviceId = presence ? 'onepage' : 'landing-page';
    const service = KNOWLEDGE.services[serviceId];
    patch = { journey: 'sell', goal: presence ? 'presence' : 'campaign', selection: [serviceId], supportTopic: null, materials: null };
    response = reply(`${presence ? 'Para apresentar sua empresa de forma objetiva, vale avaliar um Site Onepage.' : 'Para uma oferta específica, vale avaliar uma Landing Page.'} ${service.description}\n\nVocê já tem os textos e as imagens ou precisa de ajuda para organizar esse material?`, id,
      ['materials_ready', 'materials_help', 'compare_sites', 'pricing'], ['services', 'faq']);
  } else if (id === 'materials_ready' || id === 'materials_help') {
    if (!['presence', 'campaign'].includes(session.goal)) {
      return finish(session, reply('Primeiro vamos escolher o objetivo, para organizar os materiais certos.', id,
        ['goal_presence', 'goal_campaign'], ['process']), userText);
    }
    patch.materials = id === 'materials_ready' ? 'ready' : 'help';
    response = reply(id === 'materials_ready'
      ? 'Ótimo ponto de partida. A equipe poderá avaliar se os materiais atendem ao objetivo e ao escopo do projeto. Posso explicar as etapas ou preparar um resumo do seu interesse.'
      : 'Podemos começar organizando objetivo, público, serviços e referências. A produção ou adaptação de textos e imagens precisa ser definida no escopo. Posso preparar esse ponto no resumo para a equipe.', id,
    salesActions, ['faq', 'process']);
  } else if (id === 'goal_sales') {
    patch = { journey: 'sell', goal: 'sales', selection: ['crm'], supportTopic: null, materials: null };
    response = reply('Se a dificuldade é acompanhar contatos e oportunidades, vale avaliar o Imagine CRM. ' + KNOWLEDGE.services.crm.description + '\n\nPosso organizar essa necessidade em um resumo para conversar com a equipe.', id,
      ['summary', 'process', 'human', 'sell'], ['proposal']);
  } else if (id === 'goal_ads' || id === 'channel_google' || id === 'channel_meta' || id === 'channel_compare') {
    patch = { journey: 'sell', goal: 'ads', supportTopic: null, materials: null,
      selection: id === 'channel_google' ? ['gestao-google-ads'] : id === 'channel_meta' ? ['gestao-meta-ads'] : [] };
    const detail = id === 'channel_google' ? KNOWLEDGE.services['gestao-google-ads'].description
      : id === 'channel_meta' ? KNOWLEDGE.services['gestao-meta-ads'].description
      : 'Google Ads considera a intenção de busca; Meta Ads considera públicos, mensagens e criativos no Instagram e Facebook. O canal adequado depende do objetivo, público e oferta.';
    response = reply(detail + '\n\n' + KNOWLEDGE.faq.media + '\n\nPodemos comparar os canais ou organizar o próximo passo.', id,
      ['channel_google', 'channel_meta', ...(id === 'channel_compare' ? [] : ['channel_compare']), 'results', 'summary'], ['services', 'faq']);
  } else if (id === 'compare_sites') {
    response = reply('O Site Onepage apresenta a empresa e seus serviços em uma página organizada. A Landing Page concentra a atenção em uma oferta e uma ação. Se houver muitos assuntos diferentes, o escopo pode exigir outra organização.\n\nHoje seu objetivo é apresentar a empresa ou divulgar uma oferta específica?', id,
      ['goal_presence', 'goal_campaign', 'pricing'], ['services', 'faq']);
  } else if (['pricing', 'results', 'scope', 'privacy'].includes(id)) {
    response = reply(KNOWLEDGE.faq[id], id,
      id === 'privacy' ? ['home', 'faq'] : ['summary', 'process', 'human', 'sell'], ['faq']);
  } else if (id === 'process') {
    response = reply('O caminho editorial previsto é:\n' + KNOWLEDGE.processStages.map((stage, index) => `${index + 1}. ${stage}`).join('\n') + '\n\nEssas etapas não representam um prazo ou uma entrega contratada nesta prévia.', id,
      ['scope', 'summary', 'human', 'sell'], ['process']);
  } else if (id === 'after_sales') {
    patch = { journey: 'after_sales', goal: null, selection: [], materials: null, supportTopic: null };
    response = reply('Vamos organizar seu atendimento. Nesta prévia consigo orientar o próximo passo, mas não consulto contratos, pagamentos ou entregas. Esses dados exigem autenticação e autorização no Portal.\n\nQual é o assunto?', id,
      ['support_status', 'support_issue', 'support_billing', 'support_cancel'], ['faq', 'proposal']);
  } else if (['support_status', 'support_issue', 'support_billing', 'support_cancel'].includes(id)) {
    const topic = id.slice('support_'.length);
    patch = { journey: 'after_sales', supportTopic: topic, goal: null, selection: [], materials: null };
    const messages = {
      status: 'Para acompanhar uma entrega, é necessário acessar o Portal pelo canal oficial e autenticar sua conta. Esta prévia não consegue verificar seu pedido, mesmo com um número ou e-mail informado. Posso organizar um resumo sem dados pessoais para você levar à equipe.',
      issue: 'Para a equipe investigar, vale anotar o que você esperava fazer, o que aconteceu e quando começou. Use o canal de suporte confirmado pela Imagine para compartilhar evidências; não envie senhas ou dados de clientes aqui. Posso resumir o assunto do atendimento.',
      billing: 'Pagamento, cobrança e contrato precisam ser conferidos em ambiente autenticado. Não consigo confirmar quitação, gerar boleto nem alterar condições nesta prévia. Posso organizar o assunto para encaminhar pelo canal oficial.',
      cancel: 'Alterações e cancelamentos dependem do contrato vigente e da solicitação pelo canal autorizado. Esta conversa não cancela nem modifica um serviço. Posso organizar o assunto para você solicitar atendimento.'
    };
    response = reply(messages[topic], id, ['summary', 'human', 'after_sales', 'home'], ['faq', 'proposal']);
  } else if (id === 'human') {
    patch.journey = 'human';
    response = reply('Posso ajudar você a levar uma conversa mais objetiva à equipe. Gere e copie o resumo abaixo e use o canal oficial já confirmado pela Imagine. Nesta demonstração não há atendente conectado, envio de mensagem à equipe, agendamento ou cadastro de lead.', id,
      ['summary', 'sell', 'after_sales', 'home'], ['proposal']);
  } else if (id === 'summary') {
    response = reply(getSummary(session), id, ['human', 'sell', 'after_sales', 'home'], ['proposal']);
  }
  return finish(session, response, userText, patch);
}

export function respond(session, input) {
  const safeSession = readSession(session);
  if (!safeSession) return invalid(createSession(), 'invalid_session', 'Vamos recomeçar a conversa para manter um contexto válido. Escolha uma opção abaixo.');
  const data = readRecord(input, ['type', 'text', 'id'], ['type']);
  if (!data || !['text', 'action'].includes(data.type)) return invalid(safeSession, 'invalid_input', 'Escolha uma opção ou envie uma mensagem em texto.');
  if (data.type === 'action') {
    if (Object.keys(data).length !== 2 || typeof data.id !== 'string' || !Object.hasOwn(ACTIONS, data.id)) {
      return invalid(safeSession, 'invalid_input', 'Esta opção não está disponível. Escolha uma das ações apresentadas.');
    }
    return handleAction(safeSession, data.id, ACTIONS[data.id]);
  }
  if (Object.keys(data).length !== 2 || typeof data.text !== 'string' ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(data.text)) {
    return invalid(safeSession, 'invalid_input', 'Envie uma mensagem em texto simples, sem campos extras ou caracteres de controle.');
  }
  const text = data.text.trim();
  if (!text) return invalid(safeSession, 'invalid_input', 'Escreva sua dúvida ou escolha uma opção para começarmos.');
  if ([...text].length > MAX_TEXT_CHARACTERS) return invalid(safeSession, 'too_long', 'Sua mensagem ficou longa. Resuma sua dúvida em até 800 caracteres.');
  if (hasSensitiveData(text)) return invalid(safeSession, 'sensitive_input',
    'Identifiquei um possível dado pessoal ou de acesso e ocultei sua mensagem nesta prévia. Envie apenas o assunto da dúvida, sem e-mail, telefone, documentos, senhas ou códigos. A mensagem não foi encaminhada ao provedor nem à equipe.',
    '[Mensagem com possível dado pessoal ou credencial ocultada]');
  const normalized = normalize(text);
  if (/ignore.{0,35}(instruc|regra)|system prompt|modo administrador|sou (?:o )?administrador|execute.{0,30}(sql|script|comando)|revele.{0,30}(prompt|senha|chave)/.test(normalized)) {
    return invalid(safeSession, 'unsupported_instruction', 'Esta demonstração apenas orienta sobre soluções e atendimento. Mensagens não concedem permissões, acesso a dados ou execução de operações. Como posso ajudar com os serviços da Imagine?');
  }
  const action = inferAction(text);
  if (action) return handleAction(safeSession, action, text);
  return finish(safeSession, reply('Ainda não tenho uma resposta guiada para esse assunto. Posso ajudar a escolher uma solução, explicar as etapas ou organizar seu atendimento. Qual desses caminhos faz mais sentido?',
    'unknown', ['sell', 'faq', 'after_sales', 'human'], ['proposal']), text);
}
