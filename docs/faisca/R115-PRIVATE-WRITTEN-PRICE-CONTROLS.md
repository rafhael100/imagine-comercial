# Faísca R115 — valores por extenso e ofertas grátis inventadas

**Base:** R114 #589, HEAD `e2def4d4afa808b1f42a1c6d97ecb74375aacc42`, 6/6 workflows GitHub Actions aprovados. Branch independente empilhada. A homologação R92 informada pelo operador não representa instalação de R95–R115.

## Risco e incremento

A resposta Luna/Terra pode mencionar, sem qualquer algarismo, “o site custa cento e vinte reais” ou prometer “plano sem mensalidade”. A checagem anterior já bloqueava R$ e quantias numéricas, mas uma lista **verdadeira** de IDs editoriais não prova que a redação gerada não inventou preços ou gratuidade.

A R115 acrescenta uma verificação léxica conservadora (`private-price-claim-risk.mjs`) para:
- dinheiro por extenso, inclusive “vinte e cinco reais”, moedas e caracteres compatíveis Unicode;
- promessa de gratuidade ou ausência de mensalidade vinculada a serviço/plano;
- confirmação redundante no cliente de API e na borda HTTP, antes de exibir qualquer saída.

O filtro não é parser semântico completo, nem prova que valores verdadeiros foram aprovados. Textos legítimos podem precisar da confirmação humana. O catálogo editorial continua o único fundamento autorizado e qualquer contrato, desconto ou valor comercial real depende do Portal e de revisão.

## Testes reproduzíveis

```bash
node --test tests/faisca-r115-written-price-hallucination.test.mjs
node --test tests/faisca-r114-private-smoke-header-policy.test.mjs
npm test
```

Os testes usam respostas sintéticas no adaptador Luna/Terra, HTTP real em loopback, proveniência de modelos e fontes reais do catálogo R06, sem chave, créditos, dados pessoais ou qualquer efeito operacional.

## Pendências

- CI completa na SHA exata R115 e revisão independente de AppSec, privacidade e editorial.
- Homologação da conversa privada **na versão acumulada** em staging só por operador autorizado, sem repetir a R92.
- Portal/contratação/recibos, autenticação e autoridade empresarial, políticas LGPD, limites distribuídos e decisão humana explícita antes do atendimento público.

**NO-GO:** `main`, mascote, site público, `publicFaiscaEnabled=false` intactos; sem merge, deploy, DNS, VPS, credenciais reais, API paga, cliente real, CRM/Portal operacional, leads, tickets ou cobranças.
