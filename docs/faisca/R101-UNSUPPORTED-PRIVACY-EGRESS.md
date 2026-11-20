# Faísca R101 — fail-closed na saída privada `unsupported`

Base fixa: R100 #575 `edfef3151805861908a87fcbc0620ee61d69f221`, em PR draft; nenhuma alteração em `main`, mascote ou site público.

## Defeito reproduzível

O adaptador HTTP privado aplicava `hasPrivateIdentifierRisk()` apenas a `draft_answer`. Uma resposta `unsupported` de provedor injetado ou envelope mal configurado podia atravessar o HTTP com CPF/telefone/numerais internacionais: não havia rascunho gerado para justificar a exceção. A mesma modalidade podia anexar uma fonte editorial válida ou modelo Luna/Terra sem ter produzido rascunho, criando falsa proveniência quando o envelope não continha schema live.

## Correção

- A segunda barreira HTTP bloqueia identificadores também em `unsupported`, antes de serializar a resposta ao navegador.
- `unsupported` exige listas vazias de fontes e modelos, mesmo nos fixtures sem schema; fontes editoriais são reservadas a rascunhos devidamente vinculados.
- Preservados o fallback `unsupported` existente, a proteção HTTP 503 neutra e a validação R87/R88/R96-R99 para `draft_answer`.
- Não cria integração pública nem chamadas OpenAI.

## Provas e dependências

`node --test tests/faisca-r101-private-unsupported-output-boundary.test.mjs`

O teste usa servidor HTTP **loopback**, token e provedor simulados, caso `compare`, e verifica 200 para fallback seguro e 503 para telefone, documento, numeral Unicode, fonte editorial indevida e identidade de modelo indevida. Verifica que o erro não reflete conteúdo privado e que uma requisição sem autorização não chama o provedor. A suíte integrada de CI deve provar Node/HTTP, Chromium/axe, Onepage/Portal fixado, PHP, PostgreSQL efêmero e SEO na SHA exata.

## Gates e limites

- Revisão independente AppSec/editorial/LGPD; filtros heurísticos não são DLP completo nem prova de ausência de alucinações.
- Homologação da nova HEAD em staging **somente por operador autorizado**. A homologação R92 informada pelo usuário não inclui R95–R101.
- Ledger estimado single-host R100 não substitui limite oficial OpenAI nem autenticação/grants, contrato, aceite ou recibos do Portal.
- Nenhum GO público por CI verde; `publicFaiscaEnabled=false`, sem merge, deploy, DNS/VPS, credenciais, dados reais, chamadas pagas, CRM/Portal operacional, leads, tickets ou cobranças.
