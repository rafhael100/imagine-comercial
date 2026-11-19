import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { routeWithLocalFixture } from './contract.mjs';
import { routeFieldWithLocalFixture } from './field-contract.mjs';

export const ROUTER_DEMO_INPUTS = Object.freeze([
  'Quero apresentar minha empresa.',
  'Quanto custa uma Landing Page?',
  'Como funciona o projeto?',
  'Qual a diferença entre Onepage e Landing Page?',
  'Quero anunciar no Instagram.',
  'Qual é a cor favorita do mascote?'
]);

export const FIELD_ROUTER_DEMO_INPUTS = Object.freeze([
  Object.freeze({ field: 'objective', userText: 'Quero captar leads interessados.' }),
  Object.freeze({ field: 'audience', userText: 'Quero alcançar outras empresas e consumidores online.' }),
  Object.freeze({ field: 'materials', userText: 'Já tenho textos e imagens.' }),
  Object.freeze({ field: 'timeline', userText: 'Quero iniciar nos próximos 30 dias.' }),
  Object.freeze({ field: 'contactConsent', userText: 'Não autorizo contato.' })
]);

export function runFieldRouterDemo() {
  return Object.freeze(FIELD_ROUTER_DEMO_INPUTS.map((item, index) => {
    const result = routeFieldWithLocalFixture({
      conversationId: 'r09_field_demo_conversation',
      messageId: 'r09_field_demo_' + String(index + 1).padStart(4, '0'),
      userText: item.userText, field: item.field
    });
    return Object.freeze({ ...item, accepted: result.accepted,
      status: result.status, value: result.value ?? null });
  }));
}

export function runModelRouterDemo() {
  return Object.freeze(ROUTER_DEMO_INPUTS.map((userText, index) => {
    const result = routeWithLocalFixture({
      conversationId: 'r09_demo_conversation',
      messageId: 'r09_demo_message_' + String(index + 1).padStart(4, '0'),
      userText
    });
    return Object.freeze({
      userText, candidates: result.candidateAnswerIds,
      accepted: result.accepted, routeStatus: result.routeStatus ?? 'refused',
      answerId: result.answerId ?? null, text: result.text,
      sourceIds: Object.freeze(result.sources.map(source => source.id)),
      provenance: result.provenance ?? 'local_refusal'
    });
  }));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write('FAÍSCA R09 — demonstração de roteamento local\n');
  process.stdout.write('Fixture sintética: nenhuma IA externa, rede, chave ou efeito operacional.\n');
  for (const step of runModelRouterDemo()) {
    process.stdout.write('\nVISITANTE: ' + step.userText + '\n');
    process.stdout.write('CANDIDATAS: ' + (step.candidates.join(', ') || '(nenhuma)') + '\n');
    process.stdout.write('ROTA: ' + step.routeStatus + (step.answerId ? ' · ' + step.answerId : '') + '\n');
    process.stdout.write('FAÍSCA: ' + step.text + '\n');
    if (step.sourceIds.length) process.stdout.write('FONTES: ' + step.sourceIds.join(', ') + '\n');
  }
  process.stdout.write('\nRESPOSTAS LIVRES DA QUALIFICAÇÃO (valores fechados):\n');
  for (const field of runFieldRouterDemo()) {
    process.stdout.write(field.field + ': ' + field.userText + ' → ' + field.status +
      (field.value ? ' · ' + field.value : '') + '\n');
  }
  process.stdout.write('\nModo exclusivamente local. Nenhum contato ou lead foi enviado.\n');
}
