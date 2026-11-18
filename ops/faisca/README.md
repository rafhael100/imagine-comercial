# Faísca — demonstração guiada e componente de laboratório R02

Continuação da [atividade #444](https://github.com/rafhael100/imagine-comercial/issues/444), com o mesmo PNG aprovado na R01. A R02 acrescenta ciclo de vida reutilizável, carga sob demanda, laboratório Astro isolado e testes de recuperação. As três jornadas continuam locais: escolha de solução, dúvidas e orientação de pós-venda.

**Código e builds locais prontos para revisão. A validação real em navegador/axe está bloqueada neste ambiente e permanece pendente.** Não há IA externa, Portal, CRM, voz, lead ou consulta autenticada implementados neste pacote.

## Experimentar sem instalar

Abra `Faisca_Demonstracao_R02.html` no Edge ou Chrome do Windows. É um arquivo autocontido com imagem, CSS, roteiro e JavaScript, sem servidor ou dependências. Use exemplos fictícios; a sessão termina ao recarregar. A CSP bloqueia conexões e mantém apenas o script/estilo com hashes exatos.

Na raiz do checkout completo do Comercial:

```sh
node ops/faisca/build-demo.mjs
node --test tests/faisca-*.test.mjs
```

O primeiro comando gera `ops/faisca/output/Faisca_Demonstracao.html`, fora da árvore pública.

## Laboratório Astro separado

Depois de instalar as dependências fixadas pelo projeto com `npm ci --no-audit --no-fund`:

```sh
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
IMAGINE_FAISCA_LAB=1 npx --no-install astro dev --config ops/faisca/lab/astro.config.mjs
```

Os comandos usam sintaxe de shell Linux. O servidor usa somente `127.0.0.1:4329`. A saída é `ops/faisca/output/astro`, e a fonte de páginas é `ops/faisca/lab/src`. A flag explícita é obrigatória; não é credencial nem autorização de publicação. `noindex` também não é autenticação.

A página mostra conteúdo estático e o botão de ativação. Só depois de ativar é carregado o módulo da conversa, como recurso estático do próprio laboratório. Texto da conversa não é transmitido. Uma falha no carregamento mantém disponível a tentativa seguinte e as orientações da página.

## API de ciclo de vida

```js
import { mountFaisca } from './ui.mjs';
const instance = mountFaisca(root, { replyDelayMs: 220 });
instance.open();
instance.close();
instance.reset();
instance.destroy();
```

`root` deve ter `data-faisca-root` e o markup completo do laboratório. Montagem repetida retorna a mesma instância. O host deve chamar `destroy()` antes de descartar a raiz. A API não aceita provedor, preço, tenant, permissão ou credencial. Após desmontagem, uma nova montagem começa com sessão vazia. Raízes aninhadas são recusadas.

O componente Astro usa um custom element: desconectar destrói a conversa e reconectar exige nova ativação. O CSS atual continua global dentro da página isolada; precisa de isolamento específico antes de eventual incorporação ao layout público.

## Organização

| Caminho | Responsabilidade |
|---|---|
| `assets/faisca-master.png` e `asset-manifest.json` | Render aprovado e integridade |
| `knowledge.mjs` e `core.mjs` | Roteiro editorial e regras preservados da R01 |
| `ui.mjs` | Instâncias, DOM, foco, resumo e limpeza |
| `demo.template.html` e `styles.css` | Apresentação |
| `build-demo.mjs` | Render sem escrita e build autocontido |
| `lab/astro.config.mjs` | Fontes, saída, host e flag exclusivos |
| `lab/render-fragment.mjs` | Reuso do template e imagem no Astro |
| `lab/lazy-host.mjs` | Ativação, retry e descarte de imports atrasados |
| `lab/src/components/FaiscaLab.astro` | Wrapper e custom element |
| `browser-qa.mjs` e `lab/browser-qa.mjs` | Cenários de navegador preparados |

## Verificar no navegador

```sh
node ops/faisca/browser-qa.mjs
node ops/faisca/lab/browser-qa.mjs
```

O segundo comando requer o build Astro separado. O QA usa servidor temporário em loopback e dados sintéticos. `FAISCA_CHROMIUM_EXECUTABLE` pode indicar um Chromium já autorizado e instalado; não remova proteções do ambiente. Axe é obrigatório. Os testes Node de host usam doubles de contrato e não substituem DOM, layout, foco ou acessibilidade reais.

O site público mantém `publicFaiscaEnabled=false`. Nenhuma página pública ou `BaseLayout.astro` importa o laboratório. Nesta rodada, os 85 arquivos do build público ficaram idênticos byte a byte à base examinada.

O PNG continua intacto; movimento é CSS da imagem inteira, sem malha, rig, lip-sync ou articulação 3D. Detecção de padrões sensíveis é auxiliar, não infalível. O resumo usa escolhas curadas; não representa lead ou atendimento enviado. A UI conta até 800 unidades UTF-16, limite conservador para emojis frente ao núcleo.

Consulte `docs/faisca/VALIDACAO-R02.md`, `REVISAO-INDEPENDENTE-R02.md` e `CODEX-PROXIMA-ENTREGA.md`. Material R01 permanece como histórico; a validação R02 prevalece para esta versão.

Referências técnicas: [configuração Astro](https://docs.astro.build/en/reference/configuration-reference/) e [scripts de componentes](https://docs.astro.build/en/guides/client-side-scripts/). A evidência de execução está nos relatórios da rodada.
