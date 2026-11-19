# Faísca R58 — preparação explícita da contratação Onepage

**Base:** R57 #526 sobre R56 #525; laboratório. Contrato Portal Onepage fixado em `0e0ccc06755b6ddd938635e5c4c3625ff6497e2c` e verificado por R36. `publicFaiscaEnabled=false`.

## Motivação

A qualificação R08 já permitia preparar um `offerHint` Onepage sem gerar pedido (R34), mas não oferecia ao visitante uma sequência explícita de preparação que explicasse os requisitos reais do Portal. A R58 adiciona **Ver etapas de contratação Onepage** no menu `Como avançar?` somente quando a qualificação está concluída, o serviço Onepage foi confirmado e o contrato de prévia R34 continua fechado.

## Código

- `ops/faisca/qualification/journey.mjs`: nova ação local `r08:prepare_onepage`, disponível após `r08:next_steps`. Validadores exigem fase `complete`, intento nativo Onepage vigente, `offerHint.site='onepage'` e todos os gates de checkout/redirect/efeitos falsos. Situação de troca de serviço pendente continua bloqueando a ação.
- A orientação mostra revisão do resumo, **autenticação e empresa próprias do Portal**, escolha do plano, cotação no servidor, revisão de termos e aceite explícito. Não inclui URLs, valores, identidade, formulário, armazenamento, pagamento, pedido ou autorização de publicação.
- `tests/faisca-r58-onepage-portal-preparation.test.mjs`: quatro cenários para perfil concluído com consentimento concedido/negado/adiado, Landing Page e etapa incompleta, troca de serviço, reset, ausência de efeitos e consistência.
- `tests/faisca-r17-next-step.test.mjs`: acompanha o quinto botão contextual sem alterar o menu de seis correções do resumo.

## Para executar

```sh
node --test tests/faisca-r17-next-step.test.mjs tests/faisca-r34-portal-native-intent.test.mjs tests/faisca-r58-onepage-portal-preparation.test.mjs
node --test tests/faisca-*.test.mjs
```

## Dependências reais de contratação (continuam pendentes)

1. Confirmar sessão autenticada, MFA, autoridade de empresa e catálogo aprovado exclusivamente no Portal.
2. O Portal deve gerar cotação/revisão final com valores de servidor e contrato publicado, solicitar aceite, persistir pedido e emitir recibo; Faísca **nunca** faz essas operações.
3. Homologar transferência ao Sites, PSP/entrada comprovada, produção, suporte, LGPD, rollback e observabilidade com a cadeia operacional real.
4. Revisar independente QA no navegador e CI da **HEAD exata** antes de ampliar a integração; release depende de GO separado.

Esta PR não instala o Portal, não habilita login, não faz HTTP nem simula quitação. Sem merge main, deploy, DNS, VPS, dados reais, taxas ou mudança no mascote ou site público.
