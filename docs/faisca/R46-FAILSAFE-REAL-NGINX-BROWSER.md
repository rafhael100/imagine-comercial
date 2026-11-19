# Faísca R46 — continuidade comercial com falhas no Nginx real

**Base:** [R45 #509](https://github.com/rafhael100/imagine-comercial/pull/509), SHA `88f8d68946dc8bd027644cc80b0adf6cc3bf57bf`, validada em 5/5 workflows.

## Por que esta entrega é necessária

A R45 comprovou que Nginx serve o Commercial/Faísca de verdade no Chromium: autenticação privada, iframe, 5 perguntas de qualificação, 111 arquivos revisados e MIME correto. O ensaio R27 já verificava o comportamento do site quando JavaScript faltava ou quando o módulo do Faísca falhava, mas ainda contra o servidor Node anterior.

O R46 executa **os cenários negativos no mesmo Nginx real temporário**, evitando que um caso de falha no módulo impeça o visitante de navegar ou usar o simulador. O Faísca continua opcional; não pode ser ponto único de falha do Comercial.

## Três provas adicionais no Chromium

1. **Sem JavaScript em 320 px:** o CTA de intenção de compra continua sendo um link para `#simular-compra`; o controle nativo `details/summary` abre o bloco Faísca, que apresenta o aviso `noscript` em vez de simular uma conversa. A navegação à página de serviços continua funcional.
2. **Chunk Faísca indisponível em 1440 px:** o navegador bloqueia seletivamente `FaiscaJourneyLab.*.js`, comprova que a falha foi realmente provocada e valida que o seletor comercial Onepage/Landing continua interativo. Não é permitido que o problema do assistente torne o orçamento indisponível.
3. **Teclado e preferência de movimento reduzido em 390 px:** Enter abre/fecha o bloco de revisão, sem criar formulário, cookie, pagamento ou requisição externa.

Cada cenário usa uma sessão separada de Chromium, autenticada no Nginx descartável. O teste não reutiliza tokens do Portal, não se conecta a fornecedores e não publica dados. Ele é executado automaticamente pelo mesmo comando `--chromium` da R45, **após** a paridade HTTP e SHA-256 dos arquivos do kit R38.

## Reproduzir

```bash
python3 ops/faisca/staging/check-nginx-loopback.py \
  --kit ops/faisca/output/private-staging-kit --chromium
```

O processo gera usuário/senha sintéticos, inicia e encerra o Nginx temporário vinculado a `127.0.0.1`. A senha não é exibida nem persistida nos artifacts.

## Limites do aceite

Exigir CI verde na SHA exata, incluindo todos os outros workflows Comercial, Portal e PHP. O teste comprova apenas o comportamento no container descartável de CI; **não** comprova acesso externo, TLS, IAM, backup/restauração ou deploy na Leaseweb. Não habilita LLM externa, checkout, CRM, geração de leads ou atendimento autenticado.

Nenhuma alteração em `src/pages/`, `public/`, `main`, DNS, VPS, cobranças, dados reais ou mascote aprovado.
