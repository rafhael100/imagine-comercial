import { createInterface } from 'node:readline/promises';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { preparePrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';

// R81: Several operator-entered fictional questions can be evaluated using
// the real API without restarting the process or repeating the secret setup.
// There are still hard finite session bounds; no unattended paid retries.
const MAX_QUESTIONS = 50;
const MAX_REQUESTS = 100;
const MAX_RESERVED_USD = 10;
if (process.env.GITHUB_ACTIONS || process.env.CI ||
    process.env.IMAGINE_FAISCA_OPENAI_LIVE_TEST !== 'YES_PAY_SYNTHETIC_ONLY' ||
    process.env.IMAGINE_FAISCA_OPERATOR_QUESTION_TEST !== 'YES_PRIVATE_FICTIONAL_ONLY' ||
    !process.env.OPENAI_API_KEY || !process.env.FAISCA_PRIVATE_LEDGER_DIR) {
  console.error('R81 fictional question trial is disabled. Configure private secrets and both explicit opt-ins.');
  process.exitCode = 2;
} else {
  const terminal = createInterface({
    input: process.stdin, output: process.stdout,
    terminal: Boolean(process.stdin.isTTY)
  });
  let completed = 0;
  let client;
  try {
    const reservationLedger = createFaiscaLocalReservationLedger({
      directory: process.env.FAISCA_PRIVATE_LEDGER_DIR,
      maxRequests: MAX_REQUESTS,
      maxBudgetUsd: MAX_RESERVED_USD
    });
    await reservationLedger.ready();
    client = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: process.env.OPENAI_API_KEY,
      enableOperatorSyntheticQuestion: true,
      extendedPrivateSession: true,
      maxRequests: MAX_REQUESTS,
      maxBudgetUsd: MAX_RESERVED_USD,
      reservationLedger
    });
    console.log('Laboratório privado Luna + Terra: até 50 perguntas FICTÍCIAS nesta sessão.');
    console.log('Não informe nomes, contatos, dados de clientes, credenciais ou pagamentos.');
    console.log('Digite sair para encerrar. Nenhuma pergunta será enviada automaticamente.');
    for (let index = 0; index < MAX_QUESTIONS; index++) {
      const question = await terminal.question('Pergunta fictícia (' + (index + 1) + '/' + MAX_QUESTIONS + '): ');
      if (question.trim().toLowerCase() === 'sair') break;
      const prepared = preparePrivateSyntheticQuestion({
        scope: 'local_operator_lab', attestedSynthetic: true, question
      });
      if (!prepared) {
        console.error('Pergunta recusada pelo filtro de laboratório. Nenhuma chamada à API foi feita.');
        continue;
      }
      try {
        const result = await client.answerPreparedSyntheticQuestion(prepared);
        completed++;
        console.log(JSON.stringify({
          laboratory: 'r81-private-operator-fictional-session',
          questionNumber: completed,
          status: result.status,
          draftAnswer: result.text,
          editorialSourceIds: result.sourceIds ?? [],
          models: result.modelIds ?? [],
          estimatedReservedUsd: Number(client.inspect().reservedUsd.toFixed(6)),
          publicReady: false,
          requiresEditorialReview: true,
          operationalEffects: false
        }, null, 2));
      } catch {
        console.error('Teste interrompido por falha ou limite do provedor; não houve repetição automática.');
        process.exitCode = 1;
        break;
      }
      if (client.inspect().calls >= MAX_REQUESTS) break;
    }
    const inspection = client.inspect();
    console.log(JSON.stringify({
      sessionCompleted: true,
      questionsWithResults: completed,
      apiRequestsAttempted: inspection.calls,
      estimatedReservedUsd: Number(inspection.reservedUsd.toFixed(6)),
      realBilledAmountNotVerified: true,
      localDurableReservationEnabled: true
    }, null, 2));
  } catch {
    console.error('Laboratório não disponível. Revise o ambiente privado sem compartilhar credenciais.');
    process.exitCode = 1;
  } finally { terminal.close(); }
}
