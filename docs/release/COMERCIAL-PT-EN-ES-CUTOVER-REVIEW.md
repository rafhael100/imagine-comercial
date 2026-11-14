# Imagine Comercial — passagem para homologação da versão PT/EN/ES

**Estado:** revisão técnica verificável, **NÃO publicado / NÃO autorizado a substituir o site**.
Não há credenciais, chaves privadas, dados pessoais ou comandos de deploy neste roteiro.

## O que a entrega já prepara

- **60 páginas públicas indexáveis** (20 PT, 20 EN, 20 ES, incluindo a calculadora de mídia paga em cada idioma), além de **404** personalizada, nas rotas estáticas explícitas do Astro. A página 404 **não** é contabilizada como página pública do sitemap.
- As bandeiras Brasil, EUA e Espanha são links HTML sem JavaScript e mantêm a página equivalente, inclusive cinco guias completos por idioma.
- `html lang`, canonical, `hreflang` recíproco, `x-default`, JSON-LD, OpenGraph, sitemap, acessibilidade e navegação por teclado/telemóvel são verificados pela CI.
- O auditor SEO F102 está fixado à SHA exata `88af29b660f911c67e59b9d93f4730fa4cc9473d`; nenhuma dependência flutuante.
- A calculadora de anúncios em PT, EN e ES gera estimativas localmente e impressão/PDF pelo próprio navegador, sem cadastrar visitantes ou disparar anúncios. A integração de interesse com o CRM é somente sintética e não representa captação real de leads.
- Os fluxos de orçamento e checkout privado têm testes separados; o pacote **não** deve ativar PSP, CRM público, formulário de captação ou permitir provisionamento.
- A CI gera o artefato `imagine-comercial-trilingual-static-PREVIEW-ONLY` com **apenas o diretório `dist/`** e `imagine-comercial-release-REVIEW-ONLY` com o inventário SHA-256. Os artefatos não são uma assinatura aprovada, uma autorização de deploy ou evidência de execução em VPS.

## Protocolo para homologação privada

1. Revisar código e traduções por um responsável que não tenha produzido a PR. Conferir nomes comerciais, condições contratuais, alegações, contatos e diferenças regionais de EN/ES.
2. Selecionar **uma única SHA** da PR e recuperar seus artefatos no mesmo workflow. Conferir o manifesto de digest independentemente antes de instalar qualquer byte em ambiente privado.
3. Preservar a versão do site antigo e os arquivos de configuração e DNS **antes** de preparar o staging. Não substituir a pasta pública, não emitir _redirects, não apontar o domínio e não habilitar checkout.
4. Utilizar somente um ambiente de homologação isolado, com HTTPS e autenticação, `noindex` e proteção contra exposição acidental. Rodar as ferramentas de inspeção privada previstas no repositório com credenciais do operador fora do GitHub/ChatGPT.
5. Executar HTTP 200 nas 60 rotas, 404 nas não existentes; comparar HTML, metas, cabeçalhos de segurança, responsividade e acessibilidade com o mesmo manifesto. Confirmar bandeiras e links nos dois tamanhos de tela.
6. Revisar **12 URLs legadas `/en-us/`**. Cinco têm possíveis equivalentes editoriais; sete não têm e exigem preservação. **Todas as 12 permanecem HOLD.** O arquivo `artifacts/migration-preview/international-legacy-HOLD.json` é apenas diagnóstico; **não instalar regras 301**.
   Conferir também a **F310** em `docs/release/F310-LEGACY-HTTP-CONTINUITY-BEFORE-AFTER.md`:
   dois snapshots privados (original antes da troca e candidato localhost) com as
   27 rotas históricas e hashes de HTML. A prévia Astro responde 404 nas rotas
   HOLD e **não pode substituir diretamente** o legado sem uma solução de
   continuidade verificada. Manter também o atendimento dos formulários
   históricos de contato/orçamento; sem prova de entrega de leads, NO-GO.
7. Cruzar GSC real, backlinks e logs HTTP com essa cobertura, incluindo páginas de termos, portfólio e serviços descontinuados. Nenhum conteúdo jurídico deve desaparecer ou ser trocado por homepage sem revisão legal.
8. Validar o procedimento de reversão: manter o deploy anterior íntegro, comparar a versão ativa e documentar a restauração sem perda de URLs antigas. Um exercício local de CI não prova reversão na VPS.
9. Exigir responsáveis por release, segurança/AppSec, SEO, LGPD/contratos e infraestrutura com evidências verificáveis. A decisão tem de ser explícita **e posterior** às verificações, não inferida de testes verdes.

## O que impede publicar agora

O inventário de lançamento `node scripts/report-launch-blockers.mjs --target=production` permanece em `NOT_AUTHORIZED`. A branch `main` do Comercial ainda não foi promovida com a pilha de PRs, o site legado e suas rotas não estão homologados para substituição, e não há comprovação de inspeção HTTP da instalação privada, da assinatura independentemente aceita dos bytes e da reversão real na infraestrutura. Essa lacuna não é resolvida por afirmar que a CI passou.

**Regra de segurança:** PRs em DRAFT, sem merge/deploy, enquanto as condições externas acima estiverem faltando. Um artefato de preview pronto não constitui autorização para publicação automática.