# Faísca R122 — mascote aprovado na interface privada da IA

A interface Luna/Terra de revisão privada agora apresenta o **PNG mestre aprovado**, sem gerar outra versão nem alterar pixels, cores, proporções ou arquivo original.

## Cadeia de confiança

- Arquivo original: `ops/faisca/assets/faisca-master.png`. A SHA-256 aprovada é `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`, dimensões 1254×1254, 1.887.660 bytes.
- Antes de abrir qualquer porta do servidor de revisão, valida tamanho, assinatura PNG, dimensões e digest; na divergência, falha fechado.
- O PNG só é entregue em `GET /__faisca_openai_private/mascot.png`, com host/cliente loopback exatos, `no-store`, `noindex`, bloqueio de framing e sem CORS/cookies. O CSP permite imagens **somente da própria origem**. JS e CSS permanecem no mesmo host.
- O HTML usa texto alternativo e proporções naturais (`object-fit:contain`); não redimensiona o arquivo fonte e não faz crop da personagem.
- `tests/faisca-r122-private-approved-mascot.test.mjs` prova SHA de resposta HTTP real, Content-Type/tamanho, origem adversária, URL com query recusada e zero chamadas à IA. O smoke HTTP independente continua validando bytes exatos de HTML/JS/CSS e o CSP revisado.

## Limites e próximo gate

Esta é **apenas uma identidade visual para a revisão privada**. Não conecta o mascote ao chatbot público, não habilita `publicFaiscaEnabled`, não instala nada na VPS e não libera atendimento. A apresentação da imagem no site público, controle editorial e autenticação/Portal permanecem sob decisões separadas.

A R92 foi homologada conforme relato anterior; R95–R122 exigem inspeção e homologação privada próprias por operador autorizado. Nenhum merge, deploy, DNS, segredos, dados reais, chamada paga, lead, ticket, CRM, Portal operacional ou cobrança.
