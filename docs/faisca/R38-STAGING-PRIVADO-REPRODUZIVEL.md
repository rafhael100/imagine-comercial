# Faísca R38 — pacote para staging privado autenticado, sem deploy

**Base:** [Faísca R37 #501](https://github.com/rafhael100/imagine-comercial/pull/501).  
**Status:** geração e auditoria somente de artefatos em CI. **Nenhum serviço foi instalado, iniciado ou configurado na VPS.**

## Entrega

A R29 permite executar no próprio computador um review do Comercial real e Faísca usando Node.js. A R37 leva a seleção concluída do Faísca para o simulador Onepage/Landing Page por clique explícito, sem enviar dados.

A R38 prepara **o mesmo site integrado como build estático para um staging Nginx privado**. Isso encurta a próxima etapa na Leaseweb, mas não autoriza executá-la. O novo artifact de CI é:

`faisca-R38-STAGING-PRIVADO-NAO-IMPLANTADO`

Seu conteúdo:
- `site/`: uma **cópia separada** do Astro Comercial compilado; a homepage da cópia recebe o bloco de revisão R25/R37, sem alterar `dist/` ou `src/pages/` do site público;
- `site/__faisca_preview/journey/` e `support/`: HTML de laboratório validado pelos hashes R21; apenas atendimento guiado e triagem anônima;
- `site/__faisca_preview/quote-bridge.js` e `site/_astro/`: script explícito de seleção + JS/CSS do Faísca; colisões de chunks com o Comercial são recusadas;
- `ops/staging/nginx.conf`: novo Nginx **isolado** do staging F253 já aprovado, com Basic Auth obrigatório, CSP sem rede, sem formulário/objeto, NOINDEX, cache desligado, acesso somente GET/HEAD e iframe SAMEORIGIN apenas para as duas jornadas do Faísca;
- `ops/staging/compose.yaml`: serviço isolado read-only, UID 101, sem privilégios extras, limites de recursos e porta única **`127.0.0.1:4337`**. Exige imagem Nginx unprivileged **revisada e fixada por digest** e um arquivo bcrypt privado fornecido por operador;
- `Faisca_R38_MANIFEST.json`: hashes SHA-256 de cada arquivo, limites de tamanho, hash do PNG aprovado e flags `REVIEW_ONLY_NO_DEPLOY`;
- `verify-kit.mjs`: auditor de integridade que funciona com Node.js 22+ sem instalar as dependências do projeto; e `LEIA-ME-FAISCA-R38.txt`.

## Provas automáticas

O workflow `Faísca - demonstração guiada e acessibilidade` agora:

1. Verifica as jornadas R07–R37, o mascote original, privacidade, PHP pinado nas suítes dedicadas e a compilação do Comercial.
2. Executa o gate R26 de **não publicação do Faísca no `dist` público**.
3. Exercita a composição R24/R25/R37 e o pacote portátil R29 no Chromium, sem tráfego externo.
4. **Somente depois** gera o kit R38 e verifica seu conteúdo diretamente no diretório extraído pelo verificador independente.
5. Publica o artifact R38 apenas quando tudo estiver verde.

`tests/faisca-r38-private-staging-kit.test.mjs` cobre arquivo adulterado sem alterar tamanho, arquivo extra, rota Faísca ausente, symlink, manifesto com status de produção indevido e alteração da proteção Basic Auth.

## Roteiro de homologação futura na Leaseweb

O operador autorizado deverá primeiro validar o SHA da CI por canal confiável, o `verify-kit.mjs`, a imagem por digest, o arquivo bcrypt fora do ZIP e suas permissões, o Docker Compose **interpolado** e o Nginx efetivamente carregado. A autorização de iniciar staging deve ser separada. A porta publicada precisa continuar ligada exclusivamente ao loopback; um acesso remoto, se necessário, deve usar túnel SSH seguro já autorizado, sem DNS público. A autenticação Basic é apenas uma camada de staging, **não MFA nem identidade de cliente**.

O kit não contém senhas, tokens, imagem Docker, certificados TLS, arquivos de sessão, dados reais, provedores pagos ou scripts de deploy. O verificador dos hashes **não é assinatura criptográfica nem prova da versão realmente servida**, e os testes de CI não comprovam que Docker ou Nginx estão instalados/configurados na VPS.

## Gate de produção continua separado

Mesmo um staging aprovado não libera o Faísca para visitantes. Faltam revisão independente AppSec, controle de IAM e MFA/rede, backup/restauração e rollback, avaliação LGPD/DPA, provedor LLM e orçamento de custo real, contrato integrado de pedidos no Portal e recibo persistente, endpoints de pós-venda autenticado, desempenho/acessibilidade e GO específico para release.

**Nenhum merge em main, deploy, DNS, VPS, custo, CRM/Portal operacional, cobrança, dados de clientes ou alteração do PNG aprovado.**
