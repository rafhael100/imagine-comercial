# F29 — Atalho seguro de acesso ao Portal Imagine

09/11/2026. Trabalho de desenvolvimento, não autoriza deploy nem disponibiliza autenticação real.

## Risco abordado
O site comercial pode mostrar um atalho "Portal do Cliente" caso a variável pública de build PUBLIC_PORTAL_LOGIN_URL seja configurada. Antes da F29, qualquer subdomínio de imaginecomunicacao.com.br podia ser aceito; URLs com usuário/senha, parâmetros e fragmentos também podiam circular no atributo href.

## Contrato novo
A função `resolvePortalLoginLink` no site Astro só aceita HTTPS com os hosts **exatos** `portal.imaginecomunicacao.com.br` e `imaginecomunicacao.com.br`, caminhos ASCII limitados, sem parâmetros, fragmentos, usuário/senha, porta não padrão, encoding de caminho nem segmentos relativos. Entradas suspeitas ou ausentes **ocultam** o link.

- A URL é configuração de build sob controle de operação, não é obtida de visitantes.
- O site não usa tokens de autenticação nem troca informações de login com serviços externos.
- Mesmo com URL válida, o link não comprova a existência, segurança ou homologação do login do Portal.
- Atualizar os hosts permitidos exige revisão explícita do código antes de apontar para outra propriedade.
- Para o login real continuam necessários sessão, MFA, autorização/segregação por empresa, antifraude, revogação e HTTPS adequado no destino.

## Validação
Testes Node verificam omissão por padrão, hosts exatos, URLs maliciosas parecidas, protocolos não HTTPS, userinfo, tokens em query/fragmento, dot-segments, codificação e strings malformadas. O QA no navegador também deve garantir que o link não aparece quando a variável de build não está definida.

Nenhuma credencial, conta de cliente, cobrança, alteração DNS, publicação ou merge em main nesta branch.
