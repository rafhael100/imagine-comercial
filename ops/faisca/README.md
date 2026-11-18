# Faísca — conversa de laboratório R03

Continuação da [atividade #444](https://github.com/rafhael100/imagine-comercial/issues/444) e da [R02 #452](https://github.com/rafhael100/imagine-comercial/pull/452), com o mesmo PNG aprovado. As três jornadas permanecem: escolha de solução, dúvidas e orientação de pós-venda.

A R03 acrescenta envelope de conversa, provedor simulado, idempotência, estados de falha e integração assíncrona no laboratório Astro. A demonstração autocontida continua guiada e local. Consulte as evidências exatas em `docs/faisca/VALIDACAO-R03.md`.

## Experimentar o atendimento guiado

Na raiz do checkout, execute:

```sh
node ops/faisca/build-demo.mjs
```

Abra `ops/faisca/output/Faisca_Demonstracao.html` no Edge ou Chrome do Windows. O arquivo contém imagem, CSS, roteiro e JavaScript. A CSP bloqueia conexões. O histórico fica na memória da página.

## Experimentar o contrato R03

Instale as dependências fixadas com `npm ci --no-audit --no-fund`, execute `npm test` e inicie o laboratório:

```sh
IMAGINE_FAISCA_LAB=1 npx --no-install astro dev --config ops/faisca/lab/astro.config.mjs
```

No PowerShell do Windows:

```powershell
$env:IMAGINE_FAISCA_LAB = "1"
npx --no-install astro dev --config ops/faisca/lab/astro.config.mjs
```

O endereço local é `http://127.0.0.1:4329`. A flag habilita somente o laboratório; não concede autenticação ou autorização de publicação.

Na barra do laboratório, escolha **Atendimento normal**, **Provedor indisponível**, **Limite atingido**, **Resposta demorada** ou **Resposta inválida** e ative a conversa. Esses cinco cenários são simulados. A carga dos módulos ocorre somente após ativação; mensagens não são transmitidas.

As falhas apresentam avisos e orientação editorial local. Uma resposta incerta não dispara nova tentativa automática. Alterar o cenário encerra a instância anterior e oferece nova ativação.

## Ciclo de vida

```js
import { mountFaisca } from './ui.mjs';
const instance = mountFaisca(root, { replyDelayMs: 220 });
instance.open();
instance.close();
instance.reset();
instance.destroy();
```

`root` contém `data-faisca-root` e o markup completo. Montagens repetidas reaproveitam a instância; raízes aninhadas são recusadas. O host chama `destroy()` antes de descartar a raiz. O wrapper Astro desconecta e remonta com uma conversa nova.

O adaptador assíncrono é uma dependência confiável de `lab/conversation-ui.mjs`. Não é construído a partir da mensagem do visitante. Reset/desmontagem invalidam a geração, liberam recursos locais e descartam respostas atrasadas. Nenhum campo de preço, tenant, permissão, endpoint ou credencial pertence ao envelope.

## Organização

| Caminho | Responsabilidade |
|---|---|
| `assets/faisca-master.png`, `asset-manifest.json` | Mascote aprovado e integridade |
| `knowledge.mjs`, `core.mjs` | Base editorial, jornadas e catálogo de ações |
| `conversation-contract.mjs` | Schemas fechados, correlação, fingerprint e fontes |
| `conversation-runtime.mjs` | Estados, deduplicação, cancelamento e conciliação |
| `simulated-provider.mjs` | Cinco cenários determinísticos, sem rede |
| `ui.mjs` | Instâncias, DOM, foco, resumo e ciclo assíncrono |
| `lab/conversation-ui.mjs` | Adaptador local, IDs opacos e isolamento da conversa |
| `lab/lazy-host.mjs` | Ativação sob demanda e troca de cenário |
| `lab/src/components/FaiscaLab.astro` | Wrapper e controles de laboratório |
| `build-demo.mjs` | Demonstração guiada autocontida |
| `browser-qa.mjs`, `lab/browser-qa.mjs` | Regressões funcionais e acessibilidade |

## Verificação

```sh
node --test tests/faisca-*.test.mjs
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/browser-qa.mjs
node ops/faisca/lab/browser-qa.mjs
npm run build
node scripts/verify-dist.mjs
```

O laboratório compila em `ops/faisca/output/astro`. O QA usa apenas loopback e dados sintéticos. `FAISCA_CHROMIUM_EXECUTABLE` pode indicar um Chromium autorizado. Axe e testes de teclado, foco e tamanhos de tela exercitam o navegador real.

O site público mantém `publicFaiscaEnabled=false`. Suas páginas e `BaseLayout.astro` não importam este laboratório. A comparação R03 preservou os 85 arquivos públicos byte a byte.

## Limites desta entrega

O simulador devolve apenas candidatos editoriais exatos, validados antes da UI. Ele não é um modelo de IA e não conecta Portal, CRM, voz, leads ou pós-venda autenticado. Fontes operacionais, identidade e governança de uso pertencem ao servidor futuro.

A idempotência é volátil e local, sem reserva financeira ou proteção distribuída. Cancelar a UI não prova cancelamento de uma chamada real. A detecção de padrões sensíveis é auxiliar. O resumo usa escolhas curadas e não representa atendimento enviado.

O PNG preserva o hash aprovado; o movimento continua sendo CSS do quadro inteiro. O CSS global é próprio da página isolada e precisa de isolamento antes de incorporar o widget no layout público.

Consulte `docs/faisca/CONTRATO-CONVERSA-R03.md`, `VALIDACAO-R03.md` e `CODEX-PROXIMA-ENTREGA.md`. Os relatórios R01/R02 permanecem como histórico.
