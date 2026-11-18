# Validação R07 — Projeto FAÍSCA

**Candidata de código validada:** `4668cb2f7cf6b4a7d8c638b5954ab5cc70e209ea`  
**Base:** Comercial R06 `db0d9a68c3053ef65edd427e5be9b17f53686480`  
**PR:** [#465 — Faísca R07](https://github.com/rafhael100/imagine-comercial/pull/465)  
**Status:** validação técnica de laboratório concluída; PR continua draft aguardando revisão independente.

## Escopo entregue

- Estado de conversa R07 separado do R06, com objetivo proposto e confirmação explícita antes de atualizar o resumo.
- Correção de objetivo só é aplicada após nova confirmação; comparações, perguntas sem fonte e pedidos privados não alteram escolhas.
- Contrato local de modelo fechado. Nesta versão, só passa texto editorial exato da R06; não há geração livre nem LLM conectado.
- Demonstração local `/journey/` e demonstração HTTP/PHP `/journey-http/`, ambas isoladas do site comercial.
- Sessão HTTP R07 criada pelo servidor e estado por sessão; o browser não escolhe a política nem o provedor.
- Timeout e resposta incerta são reconciliados pelo mesmo identificador de mensagem; reset encerra a sessão anterior; sessões paralelas não compartilham contexto.

## Evidências de CI

| Workflow | Resultado | Cobertura |
|---|---|---|
| [Faísca guiado 44378972527](https://github.com/rafhael100/imagine-comercial/actions/runs/44378972527) | **SUCCESS** | 167 testes Faísca, zero falhas; 10/10 cenários de navegador R07; acessibilidade 320/390/1440 |
| [R05 PHP Agents 44378972484](https://github.com/rafhael100/imagine-comercial/actions/runs/44378972484) | **SUCCESS** | regressão da ponte R05 com PHP real |
| [R06 + R07 PHP 44378972555](https://github.com/rafhael100/imagine-comercial/actions/runs/44378972555) | **SUCCESS** | R06: 7/7 interop PHP e 8/8 browser; R07: 6/6 browser/HTTP/PHP |
| [PostgreSQL descartável 44378972464](https://github.com/rafhael100/imagine-comercial/actions/runs/44378972464) | **SUCCESS** | laboratório PostgreSQL existente |
| [Comercial/SEO/build 44378972491](https://github.com/rafhael100/imagine-comercial/actions/runs/44378972491) | **Em execução na última conferência** | auditoria geral do repositório; não é gate exclusivo do Faísca |

### Relatório browser → HTTP → PHP real

Artefato: [14462093314 — faisca-grounding-R06-SYNTHETIC-REVIEW-ONLY](https://github.com/rafhael100/imagine-comercial/actions/runs/44378972555/artifacts/14462093314).

O JSON `Faisca_R07_HTTP_BROWSER_QA.json` registra:
- `status=passed`, `executedPHP=true`;
- Agents fixado em `36caf2ee3585c3f64a6f1d78552550ae5aaebeb0`;
- versão editorial `faisca-editorial-2`, digest `fe7daf5ab310acc5a0a600803254344ed02eff7bbd860b731cdf033dcbe4ead7`;
- 6/6 cenários R07 aprovados;
- 5 processos PHP iniciados, 4 concluídos, 1 encerrado intencionalmente pelo cenário de reset;
- 0 falhas PHP inesperadas, 0 processos pendentes, 0 sessões, 0 sockets e 0 requisições em voo ao final;
- 0 tráfego externo e 0 erros de runtime no navegador.

Os cenários cobrem ativação explícita, proposta sem chamada PHP, confirmação com resposta PHP fundamentada, timeout e consulta posterior sem reenvio, reset durante resposta pendente, nova sessão independente, duas sessões com o mesmo ID de mensagem e acessibilidade/responsividade.

## Integridade e limites

- Mascote aprovado: hash de referência SHA-256 `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`; arquivo não alterado.
- Nenhum arquivo nos diretórios raiz `src/` ou `public/` do site comercial foi alterado.
- `publicFaiscaEnabled=false`; nenhuma página foi publicada no site público.
- Sem merge, deploy, DNS, VPS, cobrança, LLM externo, CRM, pagamento, envio de lead ou pós-venda autenticado.
- O adaptador de modelo aceita apenas resposta editorial exata. A avaliação semântica de texto livre e a escolha de provedor LLM são etapas futuras.

## Próximo gate

Falta uma **revisão independente** do código da PR #465, incluindo o diff contra a base R06 e os relatórios de CI. Até a revisão, a PR permanece draft. A integração com LLM real exige decisão explícita sobre provedor, privacidade, retenção e custos.
