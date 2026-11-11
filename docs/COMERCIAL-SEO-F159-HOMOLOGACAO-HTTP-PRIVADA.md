# Comercial SEO-F159 — Verificador HTTP da homologação privada

O diagnóstico F159 permite inspecionar um servidor de staging **já iniciado por um operador autorizado**, por meio de um túnel seguro que expõe somente `http://127.0.0.1:PORTA` na máquina de revisão. Ele não inicia serviços, não autentica SSH, não modifica Cloudflare, não faz deploy e não aceita domínio/URL informados pelo usuário — evitando requisições acidentais a produção ou endereços externos.

Comando, somente após preparar o servidor de homologação e o túnel:

```bash
IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/review-private-staging-http.mjs --port=4321
```

O diagnóstico faz oito GETs com redirects proibidos e timeout de 5 segundos: quatro rotas públicas previstas no catálogo e quatro URLs antigas com status HOLD. Em cada resposta exige cabeçalhos de segurança revisados F28, mídia HTML e corpo limitado a 1 MiB. Nas rotas públicas exige 200, H1, `index,follow` e canonical correto; nas URLs legadas exige 404 real, H1, `noindex,nofollow`, nenhum canonical e nenhum JSON-LD publicável. Erros retornam diagnósticos genéricos sem imprimir resposta, token, headers ou caminho privado.

O relatório é apenas de **observação da homologação**, com `deploymentAuthorized:false`. Não é aprovação de OAuth/Portal/CRM, conformidade LGPD, migração SEO, DNS, 301 ou publicação. O servidor deve ser previamente isolado por administrador; a ferramenta não abre portas externas nem instala fornecedores.

**HOLD:** sem staging disponibilizado e revisão independente, o diagnóstico não certifica release. Nenhum deploy, merge main, DNS ou custo foi criado por esta entrega.
