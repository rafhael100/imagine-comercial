# Faísca R45 — navegador real contra Nginx real com staging privado de laboratório

**Base:** R44 [#508](https://github.com/rafhael100/imagine-comercial/pull/508), SHA `283fd1c6815e7ec1492b1f30d85726b26dbc3e51`. **Status:** teste somente em runner descartável do GitHub, sem acesso à VPS e sem deploy.

## Defeito preventivo e objetivo

A R41 provou o comportamento de `X-Frame-Options` e `frame-ancestors` no Nginx real; a R43/R44 ampliou a cobertura para os arquivos estáticos, hashes e MIME corretos. Essa prova, porém, não exercita o navegador depois de receber as páginas do **Nginx**, e uma combinação incorreta de CSP/iframe/JS poderia passar por testes HTTP e impedir o usuário de conversar.

A R45 cobre essa lacuna, exercitando a **mesma origem Nginx descartável** em Chromium. O teste não se limita à resposta HTTP 200: precisa concluir a jornada local e confirmar a transferência ao simulador.

## Implementação

- `ops/faisca/staging/nginx-browser-qa.mjs`: navegador Chromium somente na origem **`http://127.0.0.1:<porta>`**, com uma conta Basic Auth sintética criada no ensaio. Recusa request a outros hosts e métodos de escrita.
- `ops/faisca/staging/check-nginx-loopback.py`: aceita a opção `--chromium`. Depois de validar o manifesto, subir Nginx temporário, confirmar **11 decisões HTTP** e todos os arquivos/MIME, chama o navegador enquanto o mesmo processo segue ativo. Repassa credencial sintética somente em variável de ambiente ao processo filho; nunca em argumentos, artefatos, HTML ou relatório.
- `.github/workflows/faisca-guided-lab.yml`: a etapa final exige **Nginx + htpasswd + Playwright** disponíveis. Se estiverem ausentes, a CI fica vermelha; a prova não pode ser registrada como sucesso apenas porque o teste foi ignorado.

## Critérios concretos de navegador

1. Homepage anônima exige 401 Basic; todas as respostas continuam `noindex`, sem cookies.
2. Comercial compilado abre com simulador original e integração Faísca de laboratório; o iframe local abre e mostra o mascote original aprovado, sem bloquear a execução de scripts.
3. O revisor inicia conversa, confirma Onepage, responde às cinco perguntas e somente **após terminar** transfere o serviço ao simulador por clique explícito. Antes disso, a seleção Landing Page fica intacta.
4. Os JS/CSS compilados efetivamente solicitados pelo navegador retornam MIME de browser válido e HTTP 200.
5. API/checkout/roteiros PHP não são expostos, POST é recusado e não há cookies, storage, dados externos ou exceções JavaScript inesperadas.

## Comandos de reprodução

Em um checkout de revisão, depois de instalar dependências Node/Chromium de laboratório, compilar Astro Comercial, construir o pacote R38 e fornecer **somente ferramentas Nginx/htpasswd de laboratório**:

```bash
python3 ops/faisca/staging/check-nginx-loopback.py \
  --kit ops/faisca/output/private-staging-kit --chromium
```

O comando cria um diretório temporário e uma credencial **sintética e descartável**, vincula Nginx ao loopback e termina o servidor após os testes. Não cria serviço Docker nem conta de cliente.

## Limites e NO-GO

Nginx real em CI não é Nginx realmente servido na Leaseweb; não comprova firewall, HTTPS externo, MFA, DNS, backup, restauração, reversão ou IAM. O modo Faísca permanece **guiado**, sem modelo generativo externo, integração CRM, pedido/pagamento ou atendimento autenticado real. Esse teste não concede autoridade de merge, deploy ou compra.

**Revisão independente, CI na SHA exata e gate de staging operacional permanecem obrigatórios.** A main, mascote, VPS e arquivos públicos de produção não foram alterados.
