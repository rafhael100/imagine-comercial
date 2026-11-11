# Imagine Comercial × Imagine SEO RC35 — Paridade sem atualização automática

O workflow `commercial-seo-rc35-parity-review.yml` valida o motor SEO RC35 candidato por SHA completo `743e24d7b14ba27aa8534911034da0c26a71afee`, comparando-o com a versão F81 **já aprovada e pinada em revisão no Comercial**, SHA `10a649f9c448fe8412da6e8c499eec0637d9259e`.

## Provas esperadas

1. Checkout isolado dos dois códigos SEO com credenciais não persistidas e checagem de SHAs reais por Git.
2. Suíte offline completa da candidata RC35 em Node 22.
3. Build do Imagine Comercial Astro e `verify-dist.mjs`, com o **mesmo diretório `dist`** auditado sucessivamente pelas duas versões do motor.
4. Igualdade de `summary`, rotas, erros e avisos, garantindo ausência de alteração inesperada da auditoria de páginas públicas.
5. Prova de F81 (1 aviso idêntico evoluindo para 3 resulta em duas novas ocorrências), F83 (linhas duplicadas de consulta CSV recusadas), F84 (CSV CR-only com ponto e vírgula em texto não altera o separador) e compatibilidade de CSV válido.

## Restrições

Esta PR contém **somente QA e documentação**. O `.github/workflows/validate.yml` do Comercial permanece pinado no SHA da F81. **Não há ativação da RC35** ou de Google Search Console real. Nenhuma rota, controlador, autenticação, migration, DNS, 301, pagamento, credencial, produção ou `main` é modificada.

Para promover a RC35, exigir CI aprovado, revisão independente AppSec/SEO/LGPD dos incrementos F82–F84, teste operacional do Comercial, atualização do pin em PR separada com rollback e aceite explícito da release. Permanece **DRAFT/NO-GO**.
