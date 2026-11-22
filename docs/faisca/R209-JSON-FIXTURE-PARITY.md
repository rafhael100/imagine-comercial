# Faísca R209 — compatibilidade dos fixtures VM com a validação HTTP estrita da R207

**Base revisada:** R207 #685, HEAD original `8818915a2c929a81de102ff5031b548e71da0ec3` (4/6 workflows aprovados). Os workflows de Node/Chromium e Comercial/SEO falharam, pois os objetos `Response` fictícios que simulam uma resposta JSON bem-formada eram construídos sem `Content-Type`. O construtor nativo adotava `text/plain;charset=UTF-8`, corretamente rejeitado pelo novo verificador de mídia R207.

## Alteração de teste, sem redução de segurança

- Atualizados exclusivamente **11 arquivos de testes** de navegador VM (R129, R137, R138, R142, R147, R148, R149, R150, R151, R152, R153) para que sua resposta sintética pretensamente válida tenha `Content-Type: application/json; charset=utf-8`.
- Os testes negativos, o contrato estrito do código de produção, os controles de origem/redirect e o recebimento HTTP real permanecem intocados. Nenhum arquivo do mascarote, site público ou endpoint privado de aplicação é alterado.
- Os testes que verificam falhas de esquema, metadados, idioma, fonte, operação, identidade e conteúdo perigoso devem continuar falhando fechado independentemente da mídia correta; um `200` não implica aprovação editorial.
- CI exigida: Node/HTTP/Chromium/axe/WCAG, Comercial/SEO/build, Portal/Onepage, PHP e PostgreSQL descartável, sempre na HEAD exata.

## Integração concorrente e limite operacional

Esta branch parte **somente** da R207 #685 para corrigir seus fixtures e não deve sobrescrever sua HEAD. A R208 #686 é uma entrega paralela na base R206 para bloquear identificadores na saída do navegador; uma composição posterior das R207–R209 requer revisão seletiva e CI própria. Nada autoriza merge ou deploy automático.

**NO-GO público:** manter `publicFaiscaEnabled=false`, `main`, mascote aprovado, site público e dados de clientes intocados. Somente fixtures locais, sem acesso à VPS ou credenciais, sem chamadas pagas, leads, tickets, cobranças, Portal/Sites/CRM operacional ou liberação de atendimento público. A homologação relatada da R92 foi respeitada; R95–R209 não foi comprovada instalada.
