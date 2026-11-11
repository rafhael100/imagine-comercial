# P0 F162 — Navegador real → HTTP local → diagnóstico CRM (sem captura)

A infraestrutura já possuía três elementos separados: formulário legado visual com 7/7 campos, pré-validação estrutural e receptor HTTP de laboratório autenticado em loopback. A F162 faz um ensaio **integrado ponta a ponta** desses componentes usando Chromium real em 375px e 1440px.

O teste abre o HTML original de orçamento privado, entregue **apenas pelo roteador Playwright de teste** em endereço local de mesmo domínio que o servidor sintético. Confere que o botão da página permanece desabilitado; preenche valores estritamente fictícios e obtém os mesmos campos que um operador enxergaria. O próprio **runner de teste**, não um script embutido na página publicada, faz POST a um servidor HTTP real restrito a `127.0.0.1` e com autenticação sintética, validando origem, host, JSON, resposta e diagnósticos.

São exercitados: formato estrutural válido (retorna `ATOMIC_STORE_REQUIRED`, **não** recibo), e-mail inválido e versão CAS obsoleta. Os resultados não expõem valores de contato ou UUIDs, não criam cookies/armazenamento, e sempre retornam `canSendToCrm=false`, `canAcknowledgeVisitor=false`, `canDeploy=false`. O navegador não faz tráfego externo, e nenhuma operação é retransmitida ao Portal/CRM.

A CI continua exigindo Playwright/Chromium real. Os valores fictícios são específicos do teste e não existem em produção. Não há endpoint público, alteração de domínio, backend de produção, autenticação/MFA real, armazenamento, LGPD aprovada ou homologação F70. A evidência demonstra apenas o encadeamento técnico do **laboratório privado**, não autorização de captação.
