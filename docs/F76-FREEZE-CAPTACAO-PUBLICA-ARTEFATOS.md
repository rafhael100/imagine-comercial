# F76 — Bloqueio de captação pública não homologada no artefato Astro

## Escopo
Antes de homologar o fluxo de orçamento via Imagine Portal/CRM, o verificador `scripts/verify-dist.mjs` analisa **todos** os HTML e JavaScript compilados no diretório `dist`, não apenas os arquivos Astro de origem. Falha se encontrar formulários, campos de entrada, iframe, script remoto, endpoint de leads/orçamentos, APIs programáticas de rede, cookies ou armazenamento de navegador.

O bloqueio é deliberado: os únicos caminhos públicos de conversa até o lançamento são **links de WhatsApp e e-mail iniciados pelo usuário**, com indicação explícita de transferência a serviços externos. O código não simula que o site tenha recebido uma solicitação.

## Implementação
- `src/lib/public-intake-freeze.mjs`: verificação sem variáveis de ambiente de liberação; retorna erro com o caminho do artefato e a categoria de violação, sem dados pessoais.
- `scripts/verify-dist.mjs`: percorre todos os `.html` e `.js` produzidos pelo build, inclusive rotas novas e bundles.
- `tests/public-intake-freeze.test.mjs`: casos positivos e negativos para formulários/iframes/tracking, APIs de rede, endpoints, armazenamento e bypass acidental.
- `.github/workflows/validate.yml`: já executa o verificador duas vezes no pipeline, portanto nenhuma alteração adicional de permissões foi necessária.

## Limites operacionais
A análise por padrões de texto é uma barreira preventiva de CI, **não** substitui revisão do código, análise de dependências, testes de segurança ou pen test. Não se deve afirmar que ela prova que os canais de terceiros estão operacionalmente disponíveis.

O gate `legacy-contact-intake-parity` (F70) permanece pendente. Somente após integração real em staging, confirmação de consentimento, retenção, autenticação, isolamento por tenant e entrega ao CRM seria admissível substituir essa política por uma nova proteção aprovada. Isso exige PR separado e revisão humana independente, sem override oculto.

Nenhum dado real foi processado e não houve merge na `main`, alteração de DNS, deploy, VPS ou despesas adicionais.
