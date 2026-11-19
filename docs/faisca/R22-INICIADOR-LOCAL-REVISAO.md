# Faísca R22 — iniciador local de demonstração comercial e pós-venda

**Base:** [Faísca R21 #484](https://github.com/rafhael100/imagine-comercial/pull/484).  
**Tipo:** ferramenta de revisão para o ZIP da CI, não instalação na VPS, DNS ou site de produção.

## Por que

A R21 fornece o HTML guiado e sete páginas de laboratório verificadas. Para testar a qualificação local com próximos passos R17–R20, porém, abrir `astro/journey/index.html` diretamente com `file://` não garante que os módulos JavaScript do Astro funcionem; o fluxo HTTP/PHP completo, por sua vez, exige outro servidor.

A R22 resolve a inspeção visual local sem criar uma API adicional ou publicar serviço externo. O pacote agora inclui **`faisca-review-server.mjs`**, um iniciador de servidor estático restrito.

## Como utilizar no Windows 11

1. Baixe o artifact `faisca-R22-PRIVATE-REVIEW-ONLY` na execução verde do workflow [Faísca — demonstração guiada e acessibilidade](https://github.com/rafhael100/imagine-comercial/actions/workflows/faisca-guided-lab.yml).
2. Extraia o ZIP em uma pasta do seu computador.
3. Com Node.js 22 ou superior instalado, abra o PowerShell nessa pasta e execute:

```powershell
node .\faisca-review-server.mjs --private-review
```

4. O terminal mostrará um endereço local `http://127.0.0.1:<porta>/journey/` para experimentar escolha e qualificação comercial e outro `.../support/` para triagem anônima. A demonstração guiada inicial também fica no caminho `/`.
5. Termine com **Ctrl+C**.

## Garantias técnicas do iniciador

- Escuta exclusivamente em `127.0.0.1` e porta aleatória não privilegiada.
- Lê `Faisca_R21_AUDIT.json` e verifica cada tamanho/hash SHA-256 do snapshot antes de abrir o servidor.
- Não aceita symlinks, arquivos extras, rota fora de allowlist, host diferente do loopback ou método de escrita.
- Só atende HTML `/`, `/journey/`, `/support/` e assets JS/CSS `/_astro/...` revisados.
- **Não serve** `/http/`, `/grounded/`, `/journey-http/`, `/journey-http-r08/` nem API `/__faisca_lab/...`. Não há PHP, Portal, CRM, checkout ou autenticação operacional.
- Headers `no-store`, `noindex`, `nosniff`, `frame-ancestors 'none'`, `connect-src 'none'`, `form-action 'none'` e ausência de CORS.
- Nenhum cookie, armazenamento persistente no navegador, envio externo de mensagens ou acesso à Internet é necessário à conversa guiada.

**Importante:** a rota `/journey/` permite testar o roteiro e a comparação com uma **fixture editorial local**, mas essa sessão não executa o PHP pinado. A comprovação de respostas editoriais pelo PHP real continua restrita à execução R06/R20 no CI ou ao laboratório HTTP separado. Não confundir o iniciador com a versão de produção nem apresentar fontes da prévia como confirmação operacional.

## Provas

- `tests/faisca-r22-review-server.test.mjs`: allowlist, integridade, symlink, métodos proibidos, host, path e Headers.
- `ops/faisca/review/browser-qa.mjs`: Chromium abre a jornada comercial Onepage, percorre as cinco respostas, mostra o próximo passo R17–R19, consulta a comparação R20 local, executa suporte R10 e confirma ausência de rede externa, cookie e storage.
- A CI só envia o ZIP quando os testes R02–R22 e a verificação visual terminarem com êxito.

## Gatilhos ainda pendentes para produção

A interface pública precisa de revisão e ativação específica. O servidor local não será utilizado como servidor público. IA generativa externa requer fornecedor, privacidade, orçamento, chaves seguras e testes de segurança. Checkout e pós-venda reais exigem Portal/CRM autenticados e homologados, recibos/idempotência, auditoria, LGPD, backup e rollback.

Nenhuma alteração na `main`, DNS, VPS, conteúdo do site público, PNG ou identidade do mascote. Não houve cobrança, custo ou acesso a dados de clientes.
