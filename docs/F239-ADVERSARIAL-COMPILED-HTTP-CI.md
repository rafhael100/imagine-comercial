# F239 — Cenários adversariais sobre o próprio build Astro em HTTP local

O ensaio F238 verifica que o auditor privado completo passa quando recebe o build compilado correto. A F239 confirma que o mesmo auditor **rejeita** falhas concretas injetadas no servidor Node descartável após um sucesso inicial:

1. **Acesso anônimo indevido**: responder `/robots.txt` como 200 sem Basic Auth deve falhar ainda na etapa de 401 obrigatória, antes de qualquer GET autenticado.
2. **MIME inválido**: entregar `/robots.txt` com conteúdo correto mas `Content-Type: text/html` deve falhar no verificador F236 dos assets binários.

Os dois testes rodam de verdade por HTTP em `127.0.0.1`, sobre arquivos compilados, depois do baseline aprovado. O processo falha se qualquer comportamento inseguro for aceito. Todas as credenciais são sintéticas, o servidor é encerrado e o arquivo bcrypt temporário apagado. O console só registra totais e ausência de autoridade, não devolve corpos de respostas ou paths do ambiente.

**Limite explícito:** o fixture ainda usa Node, não Nginx; as falhas são provocadas intencionalmente para QA. Passar no F239 não comprova implantação na VPS Leaseweb, certificação de imagem, autenticidade do SHA, HTTPS externo, LGPD, integração Portal/CRM, redirecionamentos públicos ou autorização para publicar.
