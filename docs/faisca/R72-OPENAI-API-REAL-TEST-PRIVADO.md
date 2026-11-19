# Faísca R72 — integração real com OpenAI, em teste privado

Base: R71 PR #543 (SHA 3e7ab482fed6c18eb59e4759bb93821c1c221e6b). DRAFT / REVIEW ONLY.

## O que está implementado

A R72 fornece um adaptador HTTPS real para a OpenAI Responses API, usando GPT-6 Luna para selecionar um ID do catálogo editorial e GPT-6.1 Terra para redigir a resposta exclusivamente a partir de conteúdo aprovado. Utiliza Structured Outputs (JSON Schema), store=false, reasoning.effort=none, nenhuma ferramenta e nenhuma ação operacional.

O teste aceita apenas três perguntas sintéticas predefinidas (compare, process, pricing). O texto livre de clientes reais não é enviado por esta implementação. Respostas de Terra são rascunhos e exigem revisão editorial.

Arquivos:
- ops/faisca/openai/live-lab.mjs: cliente real HTTPS, timeout, resposta limitada a 32 KiB, recusa de redirecionamentos, validação de candidatos/respostas.
- scripts/faisca-openai-live-smoke.mjs: execução explícita local, fora do GitHub Actions/CI, com credencial somente no ambiente privado.
- tests/faisca-r72-openai-live-lab.test.mjs: contratos e falhas testados sem cobrança por fetch simulado, incluindo privacidade, limite de custo e saída autorizada.

## Executar testes sem cobrança

    node --test tests/faisca-r72-openai-live-lab.test.mjs
    node --test tests/faisca-*.test.mjs

## Fazer uma chamada PAGA real com a conta da Imagine

1. Criar/usar projeto de desenvolvimento na OpenAI Platform com billing, alertas e limites administrativos. Verificar permissão para os modelos gpt-6-luna e gpt-6.1-terra.
2. Injetar OPENAI_API_KEY via gerenciador privado de segredos, sem revelar no chat, no PR ou no histórico de terminal.
3. Com Node >=22.12, no checkout revisado, executar deliberadamente um dos comandos abaixo.

Linux, com chave já injetada em ambiente privado:

    export IMAGINE_FAISCA_OPENAI_LIVE_TEST=YES_PAY_SYNTHETIC_ONLY
    node scripts/faisca-openai-live-smoke.mjs compare

PowerShell, com chave já injetada em ambiente privado:

    $env:IMAGINE_FAISCA_OPENAI_LIVE_TEST = "YES_PAY_SYNTHETIC_ONLY"
    node scripts/faisca-openai-live-smoke.mjs compare

Também é possível testar os casos sintéticos process ou pricing. Cada execução pode gerar despesa real. O CLI não imprime API key, headers ou corpo de erro bruto da API.

## Controle de custos e limites

Por processo, no máximo duas chamadas, com reserva conservadora de até US$ 0,01 por execução pelo CLI. Sem retry automático, fallback pago ou terceiro modelo. A reserva é consumida antes de cada envio, inclusive em erro/timeout. Isso NÃO é uma garantia de limite real de faturamento, nem controle durável entre vários workers/reinícios. O gasto real segue a precificação e usage da OpenAI. Antes da produção são obrigatórios orçamento durável na infraestrutura, alertas e limites da conta, cotas por empresa, reconciliação e política de custos.

## Requisitos ainda bloqueantes para clientes reais

- Provisão privada da chave, faturamento e permissão para os dois modelos; executar o CLI com evidência de uso real e revisão da saída.
- Avaliação de LGPD e texto livre, retenção, DPA, revisão adversarial e política de alucinações. Filtro regex não garante prevenção de vazamento.
- Adaptador backend autenticado com limites duráveis, auditoria, identidade e isolamento de empresas, sem expor chaves ao navegador.
- Homologação na VPS Leaseweb, revisão AppSec, backup/rollback e fluxos operacionais Portal/CRM/PSP sob autoridade própria.
- Autorização GO separada para publicar após revisão independente. O laboratório não altera a integração pública e permanece com publicFaiscaEnabled=false.

Referências oficiais:
https://developers.openai.com/api/docs/models/gpt-6-luna
https://developers.openai.com/api/docs/models/gpt-6.1-terra
https://developers.openai.com/api/docs/guides/structured-outputs
https://developers.openai.com/api/docs/pricing

Sem merge main, DNS, deploy, alteração de VPS ou dados reais. Mascote aprovado e site público preservados.

## Endpoint HTTP privado opcional para testar respostas reais

Além do CLI individual, a R72 agora contém um servidor de revisão em loopback, separado do site público:

- ops/faisca/openai/private-review-http.mjs — escuta somente 127.0.0.1, exige Bearer token dedicado de 32–128 caracteres, nega Origin/cookies/headers de proxy, valida método POST, path e corpo apenas com caseId sintético. HTTP sem CORS e cabeçalhos no-store/noindex/CSP.
- scripts/faisca-openai-private-review-server.mjs — opt-in explícito; usa OPENAI_API_KEY e FAISCA_REVIEW_BEARER_TOKEN somente do ambiente privado; porta local fixa 4336; não registra segredos.
- tests/faisca-r72-openai-private-http.test.mjs — testes HTTP reais apenas em 127.0.0.1 com provedor simulado, sem API paga, cobrindo autenticação, rotas, resposta do modelo e falhas 503.

Com as duas variáveis privadas já configuradas, iniciar no terminal privado:

    export IMAGINE_FAISCA_OPENAI_LIVE_TEST=YES_PAY_SYNTHETIC_ONLY
    node scripts/faisca-openai-private-review-server.mjs

Em outro terminal autorizado, com o token de revisão apenas na variável de ambiente:

    curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $FAISCA_REVIEW_BEARER_TOKEN" \
      -H "Content-Type: application/json" \
      --data '{"caseId":"compare"}' \
      http://127.0.0.1:4336/__faisca_openai_private/respond

O retorno JSON contém um rascunho redigido pelo modelo Terra, a classificação editorial escolhida por Luna e o aviso obrigatório de revisão. Não admite texto livre e não deve ser exposto à internet ou a visitantes reais. Somente um teste (até duas chamadas pagas) cabe na instância antes do limite de gasto/requisições do laboratório. Não usar esse endpoint para publicar o site, criar tickets ou iniciar vendas.

