import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createJourney, respondJourney, getJourneySummary } from './state.mjs';

export const SAMPLE_STEPS = Object.freeze([
  Object.freeze({ type: 'text', text: 'Quero apresentar minha empresa.' }),
  Object.freeze({ type: 'action', id: 'confirm_goal' }),
  Object.freeze({ type: 'text', text: 'O site inclui e-mail?' }),
  Object.freeze({ type: 'text', text: 'Na verdade prefiro Landing Page.' }),
  Object.freeze({ type: 'action', id: 'confirm_goal' }),
  Object.freeze({ type: 'text', text: 'Como funciona o projeto?' }),
  Object.freeze({ type: 'action', id: 'summary' })
]);

/** Offline sample, no model API, server, CRM, persistence or real visitor. */
export function runSampleJourney() {
  let session = createJourney();
  const steps = [];
  for (const input of SAMPLE_STEPS) {
    const result = respondJourney(session, input);
    session = result.session;
    steps.push(Object.freeze({
      request: input.type === 'text' ? input.text : input.id,
      intent: result.reply.intent,
      reply: result.reply.text,
      sources: Object.freeze(result.reply.sources.map(source => source.id)),
      pendingGoal: session.pendingGoal,
      confirmed: Object.freeze([...session.coreSession.selection])
    }));
  }
  return Object.freeze({
    steps: Object.freeze(steps),
    summary: getJourneySummary(session),
    deliveredToImagine: false,
    externalModelInvocations: 0
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const output = runSampleJourney();
  for (const step of output.steps) {
    process.stdout.write('\nVISITANTE: ' + step.request + '\n');
    process.stdout.write('FAÍSCA (' + step.intent + '): ' + step.reply + '\n');
    if (step.sources.length) process.stdout.write('Fontes editoriais: ' + step.sources.join(', ') + '\n');
  }
  process.stdout.write('\nRESUMO FINAL:\n' + output.summary + '\n');
  process.stdout.write('Laboratório local. Nenhum contato foi enviado.\n');
}
