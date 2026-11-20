# Faísca R98 — Unicode decimal e contatos internacionais (REVIEW ONLY)

Base imutável de desenvolvimento: R97 PR #572, HEAD `690408e1517cdaa6206588fd624835378fc2c338`. Branch isolada, PR draft empilhada, sem merge.

## Falha reproduzível (regressão de privacidade R96/R97)

A normalização NFKC/NFKD **não** converte os algarismos decimais de todos os sistemas de escrita para `[0-9]`. Um número como `١٢٣٬٤٥٦٬٧٨٩` (árabe) ou `१२३-४५६-७८९` (devanágari) podia escapar da regra de 8+ dígitos. E-mails com domínio internacionalizado podiam escapar dos detectores ASCII. O formulário de pergunta fictícia e a saída privada HTTP/Luna-Terra herdavam a mesma lacuna.

## Correção restrita ao laboratório

- Reconhecer numerais Unicode `\p{Nd}` (inclusive scripts mistos) e seus separadores usuais sem presumir conversão para ASCII.
- Rejeitar qualquer ocorrência de `@` em mensagem fictícia e resposta privada, inclusive domínios internacionais e identificadores sociais.
- Manter os limites existentes, a proteção de dupla validação HTTP/API e a ausência de eco do texto rejeitado.
- Não criar armazenamento de mensagens, PII, integrações operacionais ou chamadas OpenAI.

## Evidências executáveis

`node --test tests/faisca-r98-unicode-decimal-egress.test.mjs` deve demonstrar:
1. Rejeição de vários conjuntos de dígitos e `@` internacionalizado; manutenção de perguntas/respostas fictícias seguras.
2. HTTP 400 em `/converse` **antes** de chamar o provedor sintético, seguido de 200 para pergunta segura.
3. HTTP 503 neutro na saída de conversa que contém números/contato inventados.
4. HTTP 503 neutro em `/respond` mesmo quando a fonte editorial e o modelo declarados são válidos.

GitHub Actions em PR: workflow Faísca (Node, Chromium e axe), compatibilidade Portal Onepage, PHP, PostgreSQL efêmero e Comercial/SEO. Registrar resultados **por SHA exata**, não por branch mutável.

## Revisão independente e limites

O filtro é uma barreira conservadora, **não um DLP completo**: não comprova ausência de identificação, redação fiel, conformidade LGPD, segurança editorial nem resposta apta ao público. Requer revisão AppSec/privacidade e casos adversariais adicionais antes da homologação privada R95–R98. A homologação R92 já relatada pelo operador não é homologação desta HEAD.

`publicFaiscaEnabled=false`; site público/mascote/`main` intocados. Proibidos deploy, VPS/DNS, credenciais, dados reais, API paga sem ambiente seguro, CRM/Portal operacional, lead, ticket ou cobrança. GO público separado e humano.
