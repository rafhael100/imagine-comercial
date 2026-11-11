# F33 — Link do Portal apenas com configuração explícita e validada

09/11/2026. Não cria login, nem autoriza publicação.

## Problema
A F29 restringe o link de acesso ao Portal a hosts HTTPS oficiais. A F32 audita cada link renderizado pelo site, mas seu padrão de bloqueio de origens externas precisaria de uma exceção segura quando a página receber o login Portal oficialmente configurado em homologação.

## Contrato
- O link continua **oculto por padrão**. Nenhuma URL de login é inventada pelo site Comercial.
- A configuração de build `PUBLIC_PORTAL_LOGIN_URL` passa pelo `resolvePortalLoginLink` da F29: somente HTTPS com host oficial exato, sem credenciais, query, fragmentos, portas inesperadas ou caminhos ambíguos.
- A auditoria F32 recebe `approvedPortalLoginUrl` de uma fonte de build explícita e a valida novamente. Um link para o Portal só é aceito se seu `href` for **idêntico** ao valor validado. Domínios parecidos, redirecionamento por query, rotas diferentes e protocolos não HTTPS são recusados.
- O Chromium exige a ausência de `a.nav-cta` quando não houver configuração; se uma URL oficial for configurada, exige exatamente um link com o endereço esperado.
- A regra geral de `noopener noreferrer` para links que abrem nova aba permanece obrigatória.

## Limites
O exemplo de endereço `portal.imaginecomunicacao.com.br` é um host **permitido pelo contrato**, não prova de que exista um login implementado ou seguro nesse host. O Portal precisa autenticação real, MFA, isolamento de empresas, controles de sessão/grants, DNS e certificado TLS apropriados e homologação independente antes do link ser ativado em produção.

Sem build de staging real, conta do Portal, redirecionamento externo, acesso a usuário/cliente, deploy ou custos nesta etapa.
