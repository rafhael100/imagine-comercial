# F157 — QA Chromium/axe da prévia privada do orçamento legado

Executa a interface F156 **em navegador real**, mobile 375px e desktop 1440px, usando apenas HTML local injetado na aba `about:blank`. Confere sete controles legados rotulados, campo adicional de solução, formulário acessível, verificação aritmética **apenas ilustrativa**, ausência de rolagem horizontal e resultados WCAG 2.1 A/AA com axe. Gera capturas das telas no artefato de CI antes de inserir quaisquer dados fictícios. Insere exclusivamente valores inventados em campos locais e confirma que o botão de envio permanece desativado e que **nenhuma requisição HTTP** foi feita.

**Não** testa recepção nem protege contra robôs. Sem staging remoto, credenciais, dados de usuários, submissão, cookies ou deploy. Os gates F70, Portal/CRM, LGPD e SEG/DBA continuam bloqueados. A CI pública recebe apenas a fixture sintética.
