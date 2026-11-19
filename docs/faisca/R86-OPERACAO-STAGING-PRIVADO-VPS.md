# Faísca R86 — pré-homologação privada na VPS Leaseweb

**Base:** R85 #558, SHA `e48df3da89666bb27467e57fe367009809aab963` (6/6 workflows aprovados). Esta entrega é DRAFT/REVIEW ONLY, sobre código de laboratório. Ainda não instalou nada na VPS.

## Objetivo

Permitir ao operador iniciar e conferir o **servidor de revisão IA privado**, existente na R79–R85, sem expor a API Key nem permitir que uma revisão com arquivos divergentes/porta errada/diretório inseguro seja interpretada como pronta.

O Faísca público permanece desligado. Este é o laboratório da IA na porta 4336, NÃO o pacote estático R38 na porta 4337 nem um checkout público autenticado. A experiência integral mascote → diálogo livre → contrato Portal ainda não está homologada.

## Entregas

- `ops/faisca/openai/private-staging-preflight.mjs`: verifica de forma **somente leitura** Node >= 22.12, SHA completa copiada de canal independente, checkout sem alterações rastreadas, opt-in de teste pago, presença/formato da chave sem imprimi-la, token de revisão diferente da chave, diretório local de reserva 0700 e ausência de lock (sem apagar lock), disponibilidade de `127.0.0.1:4336`. Recusa CI/GitHub Actions. Não cria serviço, rede externa, arquivo ou custo.
- `scripts/faisca-private-staging-preflight.mjs`: CLI que recebe a SHA **esperada da PR revisada** por argumento; relata apenas códigos de verificação e status, sem caminhos ou credenciais.
- `ops/faisca/openai/private-staging-readonly-smoke.mjs`: três verificações de conteúdo **somente GET** dos assets do navegador privado, exigindo MIME, cache no-store, noindex, CSP, sem cookie/CORS. Destino estritamente `http://127.0.0.1:PORT`; prazo e corpo com limites.
- `scripts/faisca-private-staging-readonly-smoke.mjs`: CLI de smoke sem token, sem API key e sem POST. Não consome créditos.
- `tests/faisca-r86-*.test.mjs`: testes de impedimento de origem externa, segredo ausente, divergência SHA, diretório inseguro, lock após crash, porta ocupada, falha de servidor e controle de conteúdo.

## Gate de revisão

Somente iniciar teste pago na VPS depois de **6/6 workflows verdes na SHA exata da R86**, revisão independente do PR e aprovação da configuração pelo operador. Esse checklist é procedimento, não deploy automático.

## Procedimento manual proposto — VPS de desenvolvimento, sem produção

Executar a partir de um **checkout separado** e mantendo o Comercial, Portal, CRM e n8n existentes inalterados:

```bash
git clone --branch feat/faisca-r86-private-vps-staging-preflight-2026-11-19 \
  --single-branch https://github.com/rafhael100/imagine-comercial.git "$HOME/faisca-r86-lab"
cd "$HOME/faisca-r86-lab"
node --version
npm ci --no-audit --no-fund

# Crie o livro de reservas privado UMA vez; NÃO o apague entre execuções.
install -d -m 0700 "$HOME/.local/share/faisca-private-reservations"
export FAISCA_PRIVATE_LEDGER_DIR="$HOME/.local/share/faisca-private-reservations"

# Usar a chave previamente criada na organização OpenAI Imagine.
# Não colocar credencial no histórico de comandos ou arquivos versionados.
set +x
read -rsp "Chave OpenAI privada: " OPENAI_API_KEY
echo
export OPENAI_API_KEY
export FAISCA_REVIEW_BEARER_TOKEN="$(openssl rand -hex 24)"
export IMAGINE_FAISCA_OPENAI_LIVE_TEST=YES_PAY_SYNTHETIC_ONLY

# COPIAR a SHA COMPLETA da HEAD R86 aprovada no GitHub, não derivar do clone.
export FAISCA_STAGING_REVIEW_SHA="INSIRA_A_SHA_COMPLETA_REVISADA_DA_PR"
node scripts/faisca-private-staging-preflight.mjs "$FAISCA_STAGING_REVIEW_SHA"
```

A CLI deve responder `READY_FOR_PRIVATE_OPERATOR_START`, com todas as verificações aprovadas. Caso retorne `BLOCKED_NO_START`, não tentar substituir o commit esperado pelo valor local nem remover locks automaticamente: conferir a divergência.

Se aprovado, no **mesmo terminal privado**, copiar o token de revisão por canal privado e iniciar o servidor:

```bash
# Mostrar somente o token de revisão em um terminal privado, NÃO a chave API.
# Evitar prints e capturas de tela; não compartilhar no chat/GitHub.
printf "Token temporário de revisão: %s\n" "$FAISCA_REVIEW_BEARER_TOKEN"
node scripts/faisca-openai-private-review-server.mjs
```

A execução fica em primeiro plano e escuta somente em `127.0.0.1:4336`. Não criar regra de firewall, proxy reverso, Cloudflare ou DNS para essa porta.

Em **outro terminal SSH** na VPS, sem chave/token:

```bash
cd "$HOME/faisca-r86-lab"
node scripts/faisca-private-staging-readonly-smoke.mjs
```

O retorno esperado é `PRIVATE_UI_READONLY_VERIFIED` e três caminhos aprovados, sem custo da OpenAI.

No Windows, abrir outro PowerShell e criar túnel SSH para a VPS:

```powershell
ssh -N -o IdentitiesOnly=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 `
  -i "$HOME\.ssh\imagine_vps" `
  -L 127.0.0.1:4336:127.0.0.1:4336 rafhael@85.17.188.240
```

Abrir no navegador local:

`http://127.0.0.1:4336/__faisca_openai_private/review`

Digitar **apenas o token de revisão** e selecionar uma pergunta fictícia. Não digitar a `OPENAI_API_KEY` na interface, nem dados de clientes. A página comunica apenas com a própria origem de loopback através do túnel. O servidor privado pode usar créditos aprovados para Luna e Terra; acompanhar o custo real em Usage da API, não somente `estimatedReservedUsd`.

Após o teste, encerrar servidor (Ctrl+C), túnel SSH e a sessão do shell. Se o shell permanecer aberto:

```bash
unset OPENAI_API_KEY FAISCA_REVIEW_BEARER_TOKEN IMAGINE_FAISCA_OPENAI_LIVE_TEST
```

## Separação de componentes e limites

- **4336:** experiência de revisão da IA, token separado e perguntas sintéticas escolhidas de lista; não é o chatbot público.
- **4337:** kit estático R38, com Nginx Basic Auth e mascote, exige revisão do kit, imagem Nginx por digest e credenciais próprias; não está integrado operacionalmente ao servidor 4336.
- **Site público:** não alterado; `publicFaiscaEnabled=false`.
- **Portal/CRM/Sites:** fluxos reais de identidade, pedidos, pagamentos, CRM e tickets NÃO passam por essa demonstração.

O preflight não confere Usage OpenAI, integridade do host/VPS, DNS real, firewall fora da porta nem processo instalado anteriormente em outra máquina. A checagem 0700 não substitui hard stop financeiro da API ou backup do ledger; a verificação de SHA não substitui revisão humana do código. **Nenhum serviço foi instalado ou implantado automaticamente por esta PR.**
