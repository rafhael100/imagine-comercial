# F84 — Prévia privada de orçamento com Cargo e Celular separados

## Mudança
A prévia isolada `tests/fixtures/private-contact-form-preview.html` recebeu:
- **Cargo na empresa** (`lead-role`): presente no formulário antigo, mas **opcional** no protótipo. Finalidade e necessidade aguardam avaliação de minimização e privacidade.
- **Celular** (`lead-mobile`): separado de `lead-phone`, também **opcional**. Não altera o contrato público F30 nem o CRM F3-06 enquanto Produto/Privacidade não definirem a regra final.

Ambos usam labels explícitos e textos explicativos. Nenhum campo é ativado no site público, nenhuma informação é enviada, não há `action`, `fetch`, API, armazenamento, cookies ou rastreamento. O botão permanece desabilitado.

## Evidência e teste
O inventário F83 já documentou sete elementos visíveis no formulário antigo em 10/11/2026; a nova prévia tem agora **seis correspondências apenas visuais**, com uma lacuna operacional referente à verificação antirrobô. A tela ainda NÃO comprova equivalência do canal de orçamento.

Atualizados `legacy-budget-parity.mjs`, `tests/legacy-budget-parity.test.mjs`, `tests/private-contact-preview.test.mjs` e `scripts/browser-qa.mjs`. Os testes Chromium mobile/desktop devem preencher dados estritamente fictícios e verificar que campos novos não são obrigatórios e não geram requisições.

## Riscos que permanecem
- Não inventar obrigatoriedade, política de consentimento, finalidade ou retenção para Cargo e Celular.
- A pergunta aritmética do legado não deve ser copiada mecanicamente; a proteção antirrobô deve ser projetada e validada no backend.
- F70 segue pendente mesmo com todos os campos visíveis, pois não existe endpoint real de captação, persistência transacional, entrega ao CRM nem confirmação de atendimento homologada.
- Nenhum merge `main`, alteração de DNS, deploy ou nova despesa. Dados de cliente não foram usados.
