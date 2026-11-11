# Comercial SEO-F149 — Links externos limitados aos canais oficiais

O auditor de build restringe links externos (`<a href>`) às seguintes categorias já autorizadas no catálogo público: WhatsApp da Imagine (`wa.me` e número cadastrado, com texto previamente curado), e-mail público (`mailto:` e assunto permitido), telefone público (`tel:`) e login opcional em host HTTPS aprovado pelo contrato de segurança do Portal. Um endereço externo arbitrário, domínio semelhante, credencial na URL ou parâmetros desconhecidos provoca falha de build.

Quando o link é aberto com `target="_blank"`, o HTML precisa conter `rel="noopener noreferrer"`. Os testes cobrem spoofing de host, parâmetros sigilosos, números falsos, esquemas executáveis e isolamento de nova aba. O auditor não faz requisições, não busca servidores e não imprime o destino proibido nas mensagens de erro.

Antes de qualquer lançamento, os canais de contato públicos observados no site legado devem ser **reconfirmados pelo responsável**, pois validação de formato não comprova que número/e-mail estão ativos. Nenhuma publicação, alteração de DNS, redirecionamento ou merge na `main` foi autorizada ou realizada.
