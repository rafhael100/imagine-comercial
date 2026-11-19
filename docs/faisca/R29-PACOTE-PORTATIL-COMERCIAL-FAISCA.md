# Faísca R29 — Imagine Comercial + assistente em pacote portátil privado

**Base:** Faísca R28, [PR #492](https://github.com/rafhael100/imagine-comercial/pull/492).  
**Escopo:** review de produto no computador do revisor, sem VPS, DNS, checkout real, CRM, LLM externo, dados de clientes ou pagamentos.

## Por que esta entrega importa

A R24–R28 já comprova que o Faísca pode coexistir com o **HTML Astro real** do Comercial, sob Basic Auth na mesma origem local. Mas a reprodução até agora exige o repositório inteiro, `npm ci`, a compilação do Comercial, a compilação do laboratório Faísca e um servidor Node iniciado pelo projeto. Essa dependência dificulta a aprovação visual, da experiência de compra e do pós-venda.

A R29 entrega um único **artifact de GitHub Actions**, com o Comercial compilado, o Faísca original, o servidor privado revisado e todos os arquivos necessários. O revisor só precisa de **Node.js 22+**. Não há instalação de dependências do projeto nem necessidade de PHP para a revisão local.

## Arquivos do pacote

A CI cria `ops/faisca/output/portable/`, contendo:

- `dist/`: o **site Comercial real** compilado em Astro; todos os arquivos passam antes pelo gate de não-vazamento R26.
- `faisca/astro/` e `faisca/Faisca_R21_AUDIT.json`: páginas e scripts do Faísca revisados pela R21/R22, com hash SHA-256 do mascote original.
- `iniciar-faisca-comercial.mjs`: lançador com senha forte e bind restrito a `127.0.0.1`.
- `commercial-preview.mjs`, `private-loopback-preview.mjs`, `static-server.mjs`, `portable-verify.mjs`: cópias restritas das fontes já validadas, com imports locais. O catálogo de rotas públicas é capturado no build em `site-pages.mjs`, sem copiar bibliotecas, token, banco, senha ou segredo.
- `Faisca_R29_DIST_SHA256.json`: manifesto com tamanho e SHA-256 de cada arquivo do Comercial.
- `LEIA-ME-FAISCA-COMERCIAL.txt`: instruções locais e limites.

O artifact da CI é **`faisca-R29-COMERCIAL-INTEGRADO-PRIVADO`**, retido por sete dias no GitHub. Não é uma URL pública nem uma distribuição de produção.

## Como abrir no Windows 11

1. Acesse a execução verde de **Faísca — demonstração guiada e acessibilidade** na SHA exata da PR R29.
2. Baixe o artifact `faisca-R29-COMERCIAL-INTEGRADO-PRIVADO` e extraia o ZIP.
3. Instale Node.js 22 ou superior, caso ainda não esteja disponível.
4. Abra o PowerShell **dentro da pasta extraída** e execute:

```powershell
$env:IMAGINE_FAISCA_PRIVATE_PASSWORD = Read-Host 'Defina senha local forte (mínimo 24 caracteres)'
node .\iniciar-faisca-comercial.mjs --private-review
```

5. O terminal mostrará um endereço `http://127.0.0.1:<porta>/`. No navegador, o usuário de autenticação é **`reviewer`** e a senha é a definida acima. A página real da Imagine exibirá o Faísca embutido, o link para conversa de qualificação e os CTAs de contratação ilustrativa.
6. Finalize com **Ctrl+C**. No PowerShell:

```powershell
Remove-Item Env:\IMAGINE_FAISCA_PRIVATE_PASSWORD
```

A senha **não é escrita no ZIP, GitHub, HTML ou logs**. Não use uma senha pessoal reutilizada em outros serviços.

## Segurança e provas

- O lançador **verifica os hashes de todos os arquivos Comerciais** antes de abrir qualquer porta. O servidor também verifica o manifesto R21 do Faísca e recusa arquivos/adicionais/symlinks.
- O destino é sempre `127.0.0.1` com **Basic Auth** e senha local de pelo menos 24 caracteres; não existe configuração de host externo.
- Nenhum `POST` é aceito pelo servidor. As rotas PHP/HTTP, checkout, registro de cliente e dados reais permanecem indisponíveis. O botão de compra existente conserva as próprias regras F357 e continua ilustrativo.
- A comunicação do site e do Faísca é testada com Chromium, incluindo a presença do simulador e da conversa embutida. Nenhuma chamada de modelo externo é feita.
- A suíte R29 recusa arquivo extra, adulteração do mesmo tamanho, manifesto inválido, symlink e ausência de rota essencial.
- Os arquivos de manifesto contêm hashes, **não assinaturas**: a autenticidade deve ser verificada também pela execução GitHub Actions e SHA aprovada, especialmente se o ZIP vier de outra pessoa.

## Ainda não é liberação operacional

O pacote executa o atendimento **guiado/sintético**, sem o PHP real da R06/R20 no destino do usuário. A prova de PHP pinado permanece no CI separado. Não há login de cliente, pedido persistido, Asaas, CRM, envio de leads, n8n, IA generativa conectada, DNS, VPS ou publicação.

Para lançamento público, ainda são necessários: revisão independente da árvore de integração, composição com a linha comercial mais recente, escolha/homologação do provedor IA e limites de privacidade/custo, Portal/CRM reais, staging HTTPS protegido na Leaseweb com backup/restauração/rollback e autorização específica de GO.

**Esta entrega apenas facilita uma revisão integrada e fiel ao Comercial real; não ativa serviços.**
