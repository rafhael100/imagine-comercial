# F331 — Funil e Calculadora de Visitas, Leads e Clientes
**Imagine Comercial / ecossistema Imagine — especificação funcional, copy, segurança e orientação de implementação para Codex**
**15/11/2026 · Implementado em branch de revisão · NO-MERGE / NO-DEPLOY / NO-LEAD-POST / NO-CHARGE.**

## 1. Objetivo de negócio

Explicar visualmente, sem aumentar desnecessariamente a densidade editorial da homepage, a metodologia **Visitas → Leads → Clientes**. Oferecer uma calculadora anônima e interativa para o visitante experimentar hipóteses de conversão e, se desejar, procurar a Imagine. A calculadora **não é previsão, média de mercado nem promessa** de leads ou vendas.

A sequência esperada é:
1. Home exibe o bloco existente F330 (pílulas e assinatura aprovadas).
2. Logo após F330, um único bloco F331 com **funil gráfico de três patamares**, controles de cenário e CTA para calcular.
3. Ao calcular, revelar volumes ilustrativos e uma faixa entre cenários, acompanhados da explicação matemática.
4. Se o visitante quiser continuar, pode copiar o resumo e entrar em contato **por ação explícita**, sem transmissão automática.
5. Nome/e-mail/WhatsApp ficam para uma etapa posterior, **somente após** a homologação do endpoint e autorização de privacidade. Nunca inserir uma caixa que finja armazenar ou enviar uma solicitação.

## 2. Design e experiência

- **Posição:** depois de `GrowthPillars`, antes da vitrine `QuickServiceRequest`. PT + EN/ES preservam as estruturas já aprovadas, inclusive hero e cards comerciais.
- **Formato:** seção `<section id="calculadora-visitas-leads-clientes">`, com título compacto, duas colunas no desktop (funil de três barras à esquerda, entradas à direita), resultado inicialmente oculto e exibido após a interação.
- **Funil:** larguras aproximadas 100% (Visitas), 87% (Leads), 73% (Clientes), com rótulos e descrições. **Larguras são puramente gráficas, não percentuais de conversão**; o texto/contraste/teclado deve funcionar sem depender da cor.
- **Cores:** fundo da seção off-white, barras laranja-areia / verdes discretos; ícones simples; identidade laranja Imagine preservada. Sem animações obrigatórias.
- **Mobile 320–390:** colunas empilham; barra mantém textos legíveis; controles e botões com alvo mínimo ~44 px; resultados em linhas, sem rolagem horizontal.
- **Estados:** inicial (controles e funil, sem resultado), validação de entrada, resultado, alteração de cenário, cópia opcional, fallback quando clipboard indisponível. `aria-live` informa resultado e `role=alert` informa erro.
- **Acessibilidade e redação:** nomes próximos dos inputs; conteúdo acessível sem CSS; percentuais consultáveis em `<details>`; não utilizar manipulação de HTML por string ou código remoto.

## 3. Campos exatos por fase

| Fase | Campo | Obrigatório | Validação | Destino |
|---|---|---|---|---|
| Antes do resultado | **Segmento do negócio** | Sim | Catálogo finito: serviços, comércio local, e-commerce, educação, saúde, alimentação, outro | Memória transitória da página |
| Antes do resultado | **Visitas esperadas por semana** | Sim | Inteiro entre 0 e 100.000 | Memória transitória da página |
| Antes do resultado | **Cenário** | Sim | Conservador, referência, otimista | Memória transitória da página |
| Após resultado, **futuro gate CRM** | Nome | Futuramente opcional | Tamanho/Unicode/sanitização no backend, evitar campos livres excessivos | CRM, após consentimento/aprovação |
| Após resultado, **futuro gate CRM** | E-mail | Futuramente opcional | Normalização conservadora e validação no backend | CRM, após consentimento/aprovação |
| Após resultado, **futuro gate CRM** | WhatsApp | Futuramente opcional | E.164/verificação de opt-in quando aplicável | CRM, após consentimento/aprovação |
| Após resultado, **futuro gate CRM** | Finalidade e consentimentos | Obrigatório para usos que o exijam | Versão e timestamp do texto, identificação da finalidade de contato vs marketing, política de privacidade | Armazenamento auditável aprovado |

**Atenção:** o segmento **não altera** as taxas da matemática; isso seria simular um “benchmark” sem dados. A escolha de segmento contextualiza apenas a conversa de atendimento. Não incluir cidade sem necessidade, não recolher leads na primeira etapa e não rastrear preenchimentos.

## 4. Fórmula implementada (versão 1, educação)

**Período de referência:** quatro semanas por mês para um cálculo simples. Um mês real tem duração variável; o usuário é informado da aproximação.

```text
visitas_mensais = visitas_semanais × 4
leads_brutos = visitas_mensais × taxa_de_leads
clientes_brutos = leads_brutos × taxa_de_fechamento
leads_exibidos = arredondar(leads_brutos)
clientes_exibidos = arredondar(clientes_brutos)
```

Os clientes são calculados a partir de **leads brutos antes do arredondamento**, para evitar acumular distorções.

| Cenário | Hipótese ilustrativa visitas → leads | Hipótese ilustrativa leads → clientes |
|---|---:|---:|
| Conservador | 2% | 10% |
| Referência | 4% | 20% |
| Otimista | 6% | 30% |

Estas taxas são **premissas arbitrárias para demonstrar contas**, não foram retiradas de estudos e não devem ser apresentadas como taxas comuns, recomendadas, setoriais ou esperadas. Não correlacionar linearmente aumento de investimento em mídia com aumento de vendas sem evidência.

**Exemplo didático:**
- 100 visitas/semana → aproximadamente **400 visitas** em quatro semanas;
- Conservador: **8 leads**, **1 cliente** (arredondado);
- Referência: **16 leads**, **3 clientes** (arredondado de 3,2);
- Otimista: **24 leads**, **7 clientes** (arredondado de 7,2).
- Faixa exibida: **8–24 leads** e **1–7 clientes**. Não significa intervalo estatístico de confiança, previsão, probabilidade ou meta de performance.

Modelo versionado: `src/lib/growth-potential-calculator.mjs`. No futuro, benchmarks só entram com fonte documentada, segmentação confirmada, janela/período, unidade e revisão editorial/consentimento.

## 5. Microcopy aprovado como demonstração (PT)

**Eyebrow:** SIMULE SUA JORNADA

**Título:** Das visitas às oportunidades.

**Descrição:** Veja como visitas podem se transformar em leads e clientes — em um exercício de planejamento.

**Funil:** Visitas — Pessoas chegam ao seu site; Leads — Parte delas entra em contato; Clientes — Parte dos leads pode comprar.

**Formulário:** Calcule seu potencial; Segmento do negócio; Visitas esperadas por semana; Cenário de simulação; Conservador / Referência / Otimista; Ver estimativa.

**Resultado:** Sua simulação; Visitas/mês; Leads possíveis/mês; Clientes potenciais/mês; Intervalo entre os três cenários.

**Nota de segurança:** Exercício matemático, não previsão: resultados reais dependem de público, oferta, site, atendimento, concorrência e medição. Visitas não significam pessoas únicas; leads não são vendas.

**CTA:** Quer transformar essa ideia em estratégia? Converse com a Imagine. Ação opcional: Copiar resumo. O contato fica em rota já existente e revisada.

**Nota de coleta:** Dados pessoais não são solicitados: o cadastro para receber o plano por e-mail depende da homologação do CRM.

As variantes equivalentes de EN/ES estão no componente, sob o mesmo contrato e sem mudanças de moeda ou faturas.

## 6. Comportamento, validações e privacidade

- Cálculo 100% no navegador, apenas com dados sintéticos/projeções fornecidas pelo visitante.
- `submit` interceptado por `preventDefault`; **nenhum POST, fetch, pixel, cookie, local/sessionStorage, CRM, Webhook, N8N, SQL, API ou servidor**.
- Resultado não é guardado, e não há identificação do visitante nem download automático. O botão copiar só escreve na área de transferência após clique, quando suportado.
- Links comerciais são **internos já aprovados** `/contato/` e `/servicos/`, ou equivalentes internacionais. Não criar WhatsApp dinâmico com valores arbitrários em URLs, nem publicar nomes/e-mails em parâmetros.
- Sem coleta pessoal operacional: não chamar o recurso de “cadastro integrado ao CRM” nem afirmar que a equipe recebe o cenário automaticamente.
- Não usar taxa de estimativa como precificação de serviço, cobrança por mídia, avaliação automática de leads ou recomendação financeira personalizada.
- QA deve rejeitar `-1`, decimais, strings inválidas, valores acima de 100.000, cenário/categoria não reconhecidos e strings especiais. Resultado legível e acessível.

## 7. Contrato FUTURO para integração CRM (não implementado)

**Ponto de entrada candidato:** `POST /api/v1/growth-simulation-interest` **somente após homologação**, hospedado no backend Imagine, nunca na página estática. Sugestão de schema de contrato (sem endpoint nesta PR):

```json
{
  "schema_version": "growth_interest_v1",
  "calculator_version": "f331-v1",
  "segment": "services",
  "weekly_visits": 100,
  "scenario": "reference",
  "contact": {"name": "PREENCHIDO_APOS_CONSENTIMENTO", "email": "usuario@exemplo.invalid"},
  "purpose": "request_personalized_plan",
  "privacy_notice_version": "PENDENTE",
  "contact_permission": "explicit_action",
  "marketing_opt_in": false,
  "idempotency_key": "PENDENTE"
}
```

**Obrigatório antes de ativar:** aprovar texto legal/finalidades/retention, autenticação do serviço, TLS, CORS de origem definida, CSRF/replay conforme arquitetura, rate limits, abuso e captcha acessível quando necessário, validação server-side de 3 enums/inteiro, isolamento do tenant, idempotência, logs sem PII, fila segura para CRM e reenvio, auditoria do consentimento e política de exclusão; testes com clientes sintéticos e revisão independente LGPD/SEG. Separar aceite para receber plano de consentimento opcional de nutrição por email/WhatsApp. Não marcar marketing como aceito por padrão. Não inferir identidade, negócio ou telefone pelo navegador.

**Critérios de aceite desse futuro gate:** captura somente com ação explícita, confirmação de finalidade, retorno auditável da API, consentimento válido, deduplicação por chave e escopo, exclusão/expiração, aviso transparente de sucesso/erro; tratamento de falhas e recuperação. UI só exibe envio confirmado após resposta real do servidor.

## 8. Checklist Codex e integração

1. Basear alterações na `feature/comercial-f331-funnel-calculator-2026-11-15` (empilhada sobre F330 #416 e F315/#415), preservar hero e cartões aprovados. Não mergir em `main` diretamente.
2. Conferir `GrowthFunnelCalculator.astro`, `growth-potential-calculator.mjs` e HTML da home PT/EN/ES.
3. Rodar `npm ci`, `npm test`, `npm run build`, `npm run check:dist`, `npm run test:browser` em ambiente controlado. Executar Lighthouse/axe/teclado em 320/375/768/1440 se disponíveis.
4. Validar sem chamadas externas, cookies, armazenamento ou PII. Screenshot real do layout após build. Conferir cliques, fórmulas, arredondamento e casos de erro.
5. Manter `data-growth-calculator`, as três categorias de saída e o CTA interno de contato para automação de teste. Não registrar dados inseridos em analytics.
6. Para lead capture real, abrir PR separada no CRM com contrato server-side, revisões LGPD/SEG/infra, homologação e ativação faseada. **Esta F331 não recolhe contatos**.
7. Propor conteúdo educacional correspondente na Universidade Imagine sem substituir o plano curricular de 6 cursos/24 aulas do seu PR #3.
8. Obter confirmação de UI no navegador e autorização de release; fazer backup, deploy controlado, smoke tests autenticados e rollback na VPS somente depois dos gates.

## 9. GO/NO-GO

- **GO para revisão de UX:** build + testes de aritmética/idiomas/acessibilidade aprovados na HEAD exata.
- **NO-GO para publicação:** enquanto houver conflitos de branches, falta de validação de conteúdo ou ausência de acesso à VPS.
- **NO-GO para captura de lead:** até endpoint CRM e fluxos de consentimento terem prova operacional completa.
- **NO-GO para previsão comercial:** hipóteses matemáticas não são comprovação de eficácia.
- **NO-GO para pagamentos/anúncios:** não modificar contratos, catálogo, PSP, C6/Asaas ou campanhas.

**F331 é uma implementação interativa segura e um plano para evoluir. Não declarar cadastro ou checkout reais como concluídos.**
