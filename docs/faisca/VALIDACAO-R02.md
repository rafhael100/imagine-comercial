# Faísca R02 — implementação e evidências

> Atualização posterior: o titular autorizou publicar o mascote e os documentos R02 no GitHub público. Os relatos abaixo descrevem a rodada local anterior; autorização, preparação e validações de publicação estão em `AUTORIZACAO-PUBLICACAO-R02.md`. Essa atualização não altera resultados de testes nem concede merge/deploy.


17/11/2026 (America/Sao_Paulo). Entrega local para revisão. **Não integrada ao site público nem homologada em navegador.**

## Resultado desta rodada

Implementado o ciclo de vida reutilizável do Faísca, mantendo domínio, conhecimento e PNG da R01. Acrescentados wrapper Astro em árvore separada, carregamento sob demanda, recuperação de falhas e contrato de desmontagem. A revisão independente identificou e corrigiu uma falha de retry quando a abertura da conversa não concluía.

| Verificação realmente executada | Resultado |
|---|---|
| Dependências do Comercial | `npm ci --offline --no-audit --no-fund`: 205 pacotes do cache local, sucesso |
| Testes completos Comercial + Faísca | 1.096 aprovados, 0 falhas, 0 skips |
| Testes específicos Faísca | 29 aprovados; já incluídos nos 1.096 |
| Composição dos 29 | 19 domínio/build preservados + 2 laboratório/render + 8 contratos assíncronos de carregamento |
| Build Astro público | 64 arquivos HTML, sendo 63 páginas públicas + 404 |
| Verificador de dist | 63 páginas SEO e sitemap/robots; bloqueio de coleta conferido em 75 HTML/JS |
| Comparação pública antes/depois | 85 arquivos, mesmos nomes e SHA-256, zero diferença |
| Build Astro separado | 1 página de laboratório e módulos estáticos, fora do dist público |
| Configuração sem flag explícita | Recusada, conforme esperado |
| Workflow Actions | 2 verificações de pin imutável/checkout aprovadas após atualizar o workflow |
| Testes do auditor SEO fixado | 1.057 aprovados, 0 falhas, 0 skips; conjunto separado do Comercial |
| Auditor SEO no dist público | 63 páginas, 0 erros, 0 avisos; modo multilíngue e hreflang |
| Integridade do mascote | PNG preservado byte a byte e imagem incorporada conferida pelo teste de build |
| Revisão de código independente | Sem bloqueador estático remanescente; limites detalhados em REVISAO-INDEPENDENTE-R02.md |

Os 8 testes do host usam EventTarget e doubles pequenos de contrato no Node. **Não comprovam DOM, foco, layout, acessibilidade ou ciclo de vida do navegador real.** Não somar testes de novo apenas porque foram executados em mais de um comando.

## Base e reprodução

Comercial: [PR #450](https://github.com/rafhael100/imagine-comercial/pull/450), SHA `d38a4fc353bdfa277c47df4a46872fcd1c96f2d1`. Usado clone local isolado, branch local `feat/faisca-r02-lifecycle-local-2026-11-17`. Esse nome não existe por esta rodada no GitHub. O patch contém alterações sobre a base; nenhum commit remoto foi criado.

SEO: SHA imutável `e0030209f032a1b95231d6bd208fbe84b06b2341`, lida do workflow atual da candidata. O auditor foi executado em clone local isolado dessa SHA, sem usar uma branch móvel.

Runtime observado: Node v24.22.1, Astro 7.4.7, Playwright 1.56.1, @axe-core/playwright 4.11.0 e axe-core 4.11.4. Node é superior ao mínimo 22.12 do projeto; o workflow continua usando sua versão de Node já fixada.

PNG aprovado: SHA-256 `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`, 1.887.660 bytes, 1.254 × 1.254 px. Não houve redesenho, recoloração, corte, rig ou arquivo 3D novo.

Os logs, o resumo estruturado e a comparação pública estão em `evidence/` no ZIP R02 entregue ao titular; os logs brutos não acompanham esta publicação de fontes. O manifesto contém hashes dos arquivos entregues e da demonstração final.

## Bloqueio real de navegador

O Chromium do sistema terminou antes de abrir qualquer página: `process_singleton_posix.cc: socket() failed: Operation not permitted (1)`. O binário provisionado esperado pelo Playwright não está presente. Não foram removidas proteções nem instalados browsers para contornar a restrição.

O Cloud Desktop não conseguiu acessar o servidor local; a tentativa de observar a aba de erro foi recusada pela política de URL do navegador. A tentativa foi encerrada. **Browser, axe, screenshots e confirmação visual continuam NOT_RUN/BLOCKED.**

Foram preparados 22 cenários no runner standalone e 6 no runner do wrapper Astro. Os scripts foram conferidos sintaticamente; não declarar esses cenários aprovados até executá-los em ambiente permitido. O workflow está preparado, mas não foi enviado nem executado no GitHub.

## O que a R02 ainda não entrega

- Conversa livre com modelo de IA real: os textos continuam roteiros determinísticos locais.
- Consulta a preços oficiais, disponibilidade ou condições do Portal.
- Lead no CRM, chamado humano enviado, pagamento ou pedido criado.
- Pós-venda autenticado e leitura de dados pessoais de cliente.
- Voz, microfone, rig 3D ou lip-sync.
- Widget público integrado, isolamento final de CSS, homologação operacional ou publicação.

A flag e o noindex são mecanismos de laboratório, não autenticação. O HTML autônomo tem CSP com hashes; o bundle Astro usa recursos separados e exige revisão de política do hospedeiro antes de eventual implantação. As respostas finais de domínio e a tabela de conhecimento permanecem em português nesta rodada; inglês/espanhol do Faísca exigem etapa editorial própria.

## Continuidade

A tarefa R03 está detalhada em `CODEX-PROXIMA-ENTREGA.md`: fechar QA de navegador e preparar contrato de conversa/provedor simulado, reaproveitando as fronteiras já existentes no Agents. As implementações R03 permanecem propostas; não fazem parte do código entregue.

O bloqueio anterior de envio público do mascote/documentos continua registrado. Nenhum novo pedido de envio foi tentado nesta rodada. Não houve PR, merge, deploy, VPS, DNS, custo, credencial real ou mensagem a terceiros.
