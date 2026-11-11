# F9 — Consumo do catálogo CMS assinado durante o build (primeira integração real de código)

## Escopo executado
Até F8, a assinatura do catálogo e o validador existiam de maneira isolada. A fase F9 liga os componentes às páginas Astro **no momento da compilação**, sem rede nem conexão ao Portal real.

- O conteúdo editorial de base continua em `src/data/services.mjs`.
- `src/lib/build-catalog.mjs` lê opcionalmente um arquivo de envelope e a chave pública do publicador, fornecidos pelo **ambiente confiável de build**, e verifica assinatura Ed25519, estrutura e versão de catálogo.
- Apenas serviços cujos slugs já estão previamente aprovados no site podem ser modificados. Os campos publicáveis `title` e `description` atualizam metadados e o resumo do serviço exibido nas páginas.
- Sem arquivos presentes, o site funciona como antes. Com envelope incompleto, assinatura inválida, slug não homologado ou dados privados: **falha fechada**, interrompendo o build.
- Nenhum `price`, `customerEmail`, token, checkout, serviço novo, remoção de página ou publicação automática pode entrar por esta interface.
- O teste de integração compila o site com um catálogo fictício assinado por chave efêmera, confirma a saída HTML e rejeita assinatura adulterada. Restaura a compilação de referência ao terminar.

### Variáveis de build (não configurar ainda na produção)
```
IMAGINE_CATALOG_ENVELOPE_FILE=/caminho/privado/catalogo.json
IMAGINE_CATALOG_PUBLIC_KEY_FILE=/caminho/seguro/publica.pem
IMAGINE_CATALOG_TRUSTED_KEY_ID=portal_key_01
```

**NUNCA** disponibilizar chaves privadas ou snapshots de clientes no repositório, na pasta `public/` ou em artefatos públicos. Apenas o arquivo de conteúdo publicável aprovado poderá entrar no publicador.

## Garantias que ainda NÃO temos
- O Portal não está conectado, portanto não existe aprovação editorial real, autenticação S2S, isolamento de organizações, rotação de chaves, autorização de ofertas ou rollback transacional.
- O módulo não adiciona/remova rotas; atualiza metadados e resumo apenas dos seis serviços homologados.
- O `Portal Imagine` continua responsável por ofertas, preços, contratos e checkout. Não ativar pagamento, emissão fiscal, tráfego ou DNS.
- Segurança e adequação jurídica dependem de auditoria end-to-end com Portal real.

## Execução de teste
`npm ci && npm test && npm run build && node scripts/test-build-catalog.mjs && node scripts/verify-dist.mjs`, seguido pelo QA Chromium e auditor SEO do bundle restaurado.

**PR draft, sem merge em main, sem deploy.**
