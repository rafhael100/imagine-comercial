# Faísca R229 — cabeçalhos exatos na composição privada de staging

## Falha reproduzível
A validação R38 da configuração Nginx aceitava uma lista de cabeçalhos com o mesmo comprimento da lista revisada e cada elemento pertencente à allowlist. Essa combinação **não comprova unicidade nem presença de todos os cabeçalhos exigidos**. Um pacote adulterado podia substituir a diretiva CSP por uma segunda diretiva Cache-Control, conservar o texto antigo de CSP num comentário, recalcular o manifesto SHA-256 e ainda satisfazer o verificador anterior. A verificação também não recusava uma segunda diretiva de arquivo de autenticação Basic.

## Correção e testes
O verificador de kit exige agora **uma ocorrência ativa exata** de cada cabeçalho da política Nginx e exatamente uma referência ao arquivo privado de autenticação revisado. A contagem total continua obrigatória; diretivas adicionais, duplicadas ou apenas citadas em comentários não autorizam o kit.

As fixtures `tests/faisca-r38-private-staging-kit.test.mjs` montam diretório temporário, reescrevem Nginx, **recalculam intencionalmente o manifesto** e verificam fail-closed nos cenários CSP ausente/Cache-Control duplicado e htpasswd alternativo. O caso legítimo R38 segue obrigatório.

```bash
node --test tests/faisca-r38-private-staging-kit.test.mjs tests/faisca-r41-nginx-frame-policy.test.mjs tests/faisca-r44-mime-contract.test.mjs
npm test
npm run test:browser
```

Além disso, CI SEO/build, HTTP/Chromium/axe, Portal/Onepage e PostgreSQL descartável continuam gates independentes. O manifesto não representa assinatura nem comprova `nginx -T` na VPS.

## Limites
Mudança restrita ao **kit estático privado**: não altera o servidor Luna/Terra nem instala a conversa R95 em VPS. Homologação operacional acumulada R95–R229, revisão AppSec/LGPD/FinOps/editorial e reconciliação externa de custos continuam exigidas. Sem chaves, chamadas pagas, dados reais, deploy, merge ou DNS. `main`, mascote, site público e `publicFaiscaEnabled=false` preservados; **NO-GO público**.
