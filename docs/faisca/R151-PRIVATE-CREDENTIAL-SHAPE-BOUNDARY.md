# Faísca R151 — recusa de valores com aparência de credencial em laboratório privado

Base exata: R150 #626, commit `ca547b45b5dbf4d620cea7413be00a1f12795b9c`. Esta entrega não altera a produção, o mascote ou a configuração pública.

## Risco e recorte

Os bloqueios anteriores reconheciam as palavras *senha*, *token* e *credencial*, mas não necessariamente valores copiados sem rótulo. Um operador poderia introduzir um identificador semelhante a chave de API na pergunta fictícia, ou um modelo poderia devolvê-lo em resposta. O ambiente é exclusivamente de perguntas fictícias, mas a falha deve continuar fechada antes da chamada paga e antes de mostrar o resultado.

## Implementação

- **Servidor/cliente de IA:** `hasPrivateIdentifierRisk` reconhece formas conservadoras de credenciais (chave `sk-`, GitHub, Slack, identificador AWS, bearer longo, cabeçalho PEM de chave privada) após normalização Unicode. O guard já é usado na entrada autenticada e na saída do adaptador Luna/Terra, sem registrar o texto sensível.
- **Navegador isolado:** barreira equivalente porém independente no preflight e na renderização de resposta HTTP 200, sem confiar apenas no servidor e sem armazenar o token do operador.
- **Testes:** `node --test tests/faisca-r151-private-credential-shapes.test.mjs` usa somente marcadores sintéticos construídos em memória, confirma rejeição pré-POST, ausência de dispatch HTTP, rejeição de retorno simulado pela API, limpeza de token e pergunta na UI, ausência de eco e controle positivo benigno. Os workflows existentes cobrem Chromium/axe, HTTP, Node, PHP/Portal, PostgreSQL efêmero e build/SEO na HEAD.
- **Sem ações externas:** nenhum código novo envia mensagens, armazena tokens, chama OpenAI, aciona CRM/Portal, emite tickets/leads ou implanta componentes.

## Limites e homologação

Detecção por formato **não substitui** DLP, gestão de segredos, consentimento, revisão independente de LGPD ou auditoria AppSec. A autorização de créditos do usuário não entrega ao agente acesso a credenciais; nenhuma chave real será buscada ou gravada. A R92 e os testes pagos anteriores são etapas relatadas como concluídas, sem presumir que a R95 ou esta revisão esteja instalada na VPS.

Antes de qualquer GO público: rever segurança e qualidade editorial, homologar a candidata empilhada no staging privado por operador autorizado, confirmar estado no servidor com evidência direta e obter aprovação operacional específica. Preservar `main`, o mascote, o site e `publicFaiscaEnabled=false`; sem merge/deploy/DNS/VPS.
