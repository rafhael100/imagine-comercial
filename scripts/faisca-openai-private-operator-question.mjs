import { createInterface } from 'node:readline/promises';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { preparePrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';

// R80 requires TWO deliberate opt-ins, a private API credential and an
// operator-typed fictional question. Never accept a question via CLI arguments
// or a public HTTP request: arguments can be stored in shell history.
if (process.env.GITHUB_ACTIONS || process.env.CI ||
    process.env.IMAGINE_FAISCA_OPENAI_LIVE_TEST !== 'YES_PAY_SYNTHETIC_ONLY' ||
    process.env.IMAGINE_FAISCA_OPERATOR_QUESTION_TEST !== 'YES_PRIVATE_FICTIONAL_ONLY' ||
    !process.env.OPENAI_API_KEY) {
  console.error('R80 fictional question trial is disabled. Configure private secrets and both explicit opt-ins.');
  process.exitCode = 2;
} else {
  const terminal = createInterface({
    input: process.stdin, output: process.stdout,
    terminal: Boolean(process.stdin.isTTY)
  });
  try {
    console.log('Somente pergunta comercial FICTÍCIA, sem nome, contato, dados de cliente, pagamento ou credenciais.');
    const question = await terminal.question('Pergunta fictícia para o Faísca: ');
    const prepared = preparePrivateSyntheticQuestion({
      scope: 'local_operator_lab', attestedSynthetic: true, question
    });
    if (!prepared) {
      console.error('Pergunta não aprovada para o teste sintético. Nenhuma solicitação à API foi feita.');
      process.exitCode = 2;
    } else {
      const client = createFaiscaOpenAILiveLab({
        enabled: true, apiKey: process.env.OPENAI_API_KEY,
        enableOperatorSyntheticQuestion: true,
        maxBudgetUsd: 0.01
      });
      const result = await client.answerPreparedSyntheticQuestion(prepared);
      console.log(JSON.stringify({
        laboratory: 'r80-private-operator-fictional-question',
        status: result.status,
        draftAnswer: result.text,
        editorialSourceIds: result.sourceIds ?? [],
        models: result.modelIds ?? [],
        estimatedReservedUsd: Number(client.inspect().reservedUsd.toFixed(6)),
        publicReady: false,
        requiresEditorialReview: true,
        operationalEffects: false
      }, null, 2));
    }
  } catch {
    console.error('Teste privado não concluído. Confira permissões do projeto API e o ambiente sem revelar chaves.');
    process.exitCode = 1;
  } finally { terminal.close(); }
}
