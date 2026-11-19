# F159 — Revisão dos links externos sem exceções por prefixo

O auditor dinâmico `reviewPublicLinks` era mais permissivo do que o auditor do HTML gerado: aceitava qualquer mensagem `Olá,` contendo a palavra `Imagine` ou assunto começando com `Contato Imagine`. A F159 passa a reutilizar a allowlist exata `isApprovedPublicExternalHref` já mantida pelo auditor SEO F155/F142.

Todos os **560 cenários revisados** (serviço×objetivo×momento×prioridade) permanecem permitidos para WhatsApp e mailto, mas variações livres, parâmetros extras, percent-encoding alternativo e assuntos arbitrários são rejeitados. Um login HTTPS do Portal **não** passa só por ser de host permitido: também precisa corresponder exatamente ao URL autorizado de build. Erros nunca retornam URLs privadas ou query tokens.

Testes Node exercitam 1120 links curados e casos adversariais. Nenhuma solicitação externa ou envio de dados é feito. O site público continua sem POST, campos de lead e cookies; não equivale a autenticação Portal, validação de privacidade, aprovação F70, redirecionamento ou deploy.
