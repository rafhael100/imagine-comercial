# Faísca — conversa HTTP de laboratório R04

Continuação da [atividade #444](https://github.com/rafhael100/imagine-comercial/issues/444), [R02 #452](https://github.com/rafhael100/imagine-comercial/pull/452) e [R03 #453](https://github.com/rafhael100/imagine-comercial/pull/453). O PNG aprovado e as três jornadas — escolha de solução, dúvidas e orientação de pós-venda — foram preservados.

A R04 coloca o runtime R03 atrás de **HTTP real em loopback**. O servidor emite a sessão, fixa o contexto público, valida origem e propriedade da conversa e mantém os registros de deduplicação. O provedor permanece simulado. A página HTTP fica exclusivamente no laboratório, fora do site público.

## Experimentar a R04

Na raiz do checkout, com Node >=22.12:

```sh
npm ci --no-audit --no-fund
npm test
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
IMAGINE_FAISCA_HTTP_LAB=1 node ops/faisca/server/serve.mjs
```

Abra **http://127.0.0.1:4330/http/** no Edge ou Chrome. Ative a conversa e use apenas mensagens fictícias. A primeira mensagem permitida cria a sessão; a ativação sozinha não chama a API.

No PowerShell:

```powershell
npm ci --no-audit --no-fund
npm test
$env:IMAGINE_FAISCA_LAB = "1"
npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
$env:IMAGINE_FAISCA_HTTP_LAB = "1"
node ops/faisca/server/serve.mjs
```

`IMAGINE_FAISCA_HTTP_PORT` altera a porta local. `IMAGINE_FAISCA_HTTP_SCENARIO` aceita `success`, `unavailable`, `limit`, `timeout` ou `malformed`. São configurações confiáveis do processo; mensagens e controles do navegador não escolhem provedor, endpoint ou contexto. Para testar atraso:

```sh
IMAGINE_FAISCA_HTTP_LAB=1 IMAGINE_FAISCA_HTTP_SCENARIO=timeout node ops/faisca/server/serve.mjs
```

Em `timeout`, o turno continua pendente e aparece **Consultar resposta pendente**. A consulta usa a mesma identificação e não reenvia a mensagem ao provedor. Quando chega uma resposta final validada, a conversa e o resumo avançam uma vez. Reiniciar descarta a exibição antiga e tenta excluir a sessão no servidor; isso não prova cancelamento de uma mensagem já recebida.

Encerre com Ctrl+C. Não exponha a porta por proxy, túnel ou interface externa. O servidor fixa o bind em `127.0.0.1`, exige Host/Origin exatos e não habilita CORS. Esse perfil serve apenas ao ensaio local.

## Modos anteriores preservados

| Modo | Como abrir | Transporte da conversa |
|---|---|---|
| Standalone guiado | `node ops/faisca/build-demo.mjs`; abrir `ops/faisca/output/Faisca_Demonstracao.html` | Nenhuma conexão; CSP `connect-src 'none'` |
| Contrato R03 no browser | `http://127.0.0.1:4330/` no servidor acima, ou Astro dev na porta 4329 | Simulador na memória da página |
| HTTP R04 | `http://127.0.0.1:4330/http/` | Browser → servidor loopback → simulador |

O desenvolvimento estático R03 continua com `IMAGINE_FAISCA_LAB=1 npx --no-install astro dev --config ops/faisca/lab/astro.config.mjs`. O Astro dev sozinho não implementa a API R04.

## Responsabilidades

| Caminho | Responsabilidade |
|---|---|
| `assets/faisca-master.png`, `asset-manifest.json` | Mascote aprovado e integridade |
| `knowledge.mjs`, `core.mjs` | Base editorial, jornadas, pré-verificação e ações curadas |
| `conversation-contract.mjs`, `conversation-runtime.mjs` | Contrato, correlação, deduplicação e conciliação R03 reutilizados |
| `http-contract.mjs` | Sessão, contexto e resultado HTTP com schemas fechados |
| `server/http-lab.mjs`, `server/serve.mjs` | Servidor loopback, sessões, limites e CLI explícita |
| `lab/http-client.mjs` | Token em memória, pré-verificação antes da rede, transporte e resultado incerto |
| `lab/http-ui.mjs`, `lab/http-host.mjs` | Ativação sob demanda, consulta manual e ciclo de vida |
| `lab/src/components/FaiscaHttpLab.astro` | Página isolada com os controles HTTP |
| `ui.mjs` | UI compartilhada preservada; resumo avança após resultado aceito |
| `browser-qa.mjs`, `lab/browser-qa.mjs`, `server/browser-qa.mjs` | Regressões e acessibilidade nos três modos |

## Verificação

```sh
node --test tests/faisca-*.test.mjs
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/browser-qa.mjs
node ops/faisca/lab/browser-qa.mjs
node ops/faisca/server/browser-qa.mjs
npm run build
node scripts/verify-dist.mjs
```

Os dois HTML são `/index.html` e `/http/index.html`, em `ops/faisca/output/astro`. Os QA usam conteúdo sintético e portas efêmeras; não é necessário deixar a CLI aberta. `FAISCA_CHROMIUM_EXECUTABLE` pode indicar um Chromium autorizado. O workflow Faísca coleta os relatórios sintéticos de `ops/faisca/reports/`.

O site público mantém `publicFaiscaEnabled=false` e não importa o laboratório. Consulte [`VALIDACAO-R04.md`](../../docs/faisca/VALIDACAO-R04.md), [`CONTRATO-HTTP-R04.md`](../../docs/faisca/CONTRATO-HTTP-R04.md) e [`CODEX-PROXIMA-ENTREGA.md`](../../docs/faisca/CODEX-PROXIMA-ENTREGA.md).

## Limites desta entrega

A sessão é pública e sintética: não autentica clientes, empresas, contratos ou acesso de pós-venda. Não há integração com PHP Agents, Portal, Central, CRM, voz ou LLM.

Os registros ficam na memória do processo, por até cinco minutos na configuração padrão, e desaparecem no encerramento. Não há persistência distribuída, reserva de crédito ou garantia financeira de execução única. Recarregar a página perde o token; uma resposta de criação perdida pode deixar uma sessão órfã até expirar.

A verificação local de padrões sensíveis é auxiliar e não identifica todo dado pessoal. Use apenas conteúdo fictício. Tokens não vão para URLs, cookies, DOM, logs ou storage; a API recebe o texto permitido no corpo HTTP local. O resumo copiado não é envio à equipe.

O PNG, recorte, cores e estilos permanecem preservados. A animação continua sendo movimento CSS do quadro inteiro; não há modelo 3D articulado. Publicar código em PR draft não ativa o site nem autoriza merge, deploy, despesas ou mudanças na VPS/DNS.
