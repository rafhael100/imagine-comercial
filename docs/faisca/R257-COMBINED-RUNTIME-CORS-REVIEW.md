# Faísca R257 — revisão conjunta do runtime e do perímetro OPTIONS

**DRAFT / REVIEW ONLY / NO-GO público.**

## Problema corrigido

R255 verifica políticas reportadas de Docker, digest declarado e 19 GET/HEAD locais,
enquanto R256 verifica quatro OPTIONS/CORS independentes. Até R256 era possível
executar apenas R255 e apresentar um relatório de perímetro aparentemente
completo sem sequer executar os preflights OPTIONS. A R257 fecha essa lacuna:
o operador recebe **um relatório positivo único apenas após ambos os gates**
na mesma invocação, em sequência, ou recebe HOLD.

## Execução privada autorizada

O CLI `scripts/faisca-review-full-runtime-cors.mjs` recebe um JSON de
`docker inspect` fornecido explicitamente pelo operador, com **uma**
entrada `container` e **uma** entrada `image`, como R255. Exige os mesmos
quatro valores de ambiente independentes: habilitação de revisão, identidade
da imagem esperada, diretório de trabalho e caminhos de site e htpasswd,
mais a configuração já estabelecida. Não execute automaticamente em VPS.

A sequência fixa chama R255 (19 GET/HEAD em `127.0.0.1:4337`) e
só após sua aprovação chama R256 (4 OPTIONS em `127.0.0.1:4337`).
Nenhum caminho, URL, porta, usuário, token ou destino é fornecido pela entrada.
A conexão nunca envia Authorization/cookie nem chama a OpenAI. O CLI
recusa execução em CI/GitHub Actions, argumentos, JSON fora da forma exata
e payload maior que 512 KiB. Erros produzem código 2 e HOLD genérico,
sem ecoar `inspect`, respostas HTTP ou env.

O módulo exige o esquema **exato** de cada relatório, verifica somente
descritores de dados próprios e rejeita propriedades adicionais, símbolos,
getters ou campos de segurança divergentes. Não publica resultado parcial.
O relatório final contém somente contagens e flags `false` para
autorização, identidade independente de processo, conversa autenticada,
exposição externa e conciliação de gastos.

## Testes e limites

`node --test tests/faisca-r257-full-runtime-cors-review.test.mjs` usa
fixtures sintéticas, mutações de esquemas, simulações de erro, uma
instância HTTP loopback real para OPTIONS positivo e negativo e testes
de CLI. A CI completa do repositório também executa Node/HTTP,
Chromium/axe/WCAG, build/SEO, Portal/Onepage, PostgreSQL descartável
e PHP por workflows existentes.

**Um relatório R257 não certifica a instalação da R95 nem a identidade
do processo que serve o socket.** Docker inspect é evidência relatada pelo
operador, não atestação independente. Portas/HTTP locais podem ser trocados
entre verificações, o teste não autentica conversas, não verifica exposição
de firewall externa e não reconcilia uso pago Luna/Terra. Essas lacunas
exigem prova operacional por canal confiável e revisões AppSec, LGPD,
FinOps e editorial, sem reutilizar R92 como prova da R95.

Respeitar a homologação R92 e os testes pagos já relatados pelo operador.
Sem merge, deploy, alteração VPS/DNS, credenciais, dados reais,
ações de Portal/Sites/CRM, cobrança, lead, ticket ou GO público.
Preservar `main`, site e mascote aprovados e
`publicFaiscaEnabled=false`.
