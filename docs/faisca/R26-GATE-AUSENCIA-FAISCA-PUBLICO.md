# Faísca R26 — impedir vazamento do laboratório no build público do Comercial

**Base:** [Faísca R25 #488](https://github.com/rafhael100/imagine-comercial/pull/488). **Status:** gate automatizado em PR draft; nenhuma ativação de produção.

## O risco

R24/R25 aproximaram o Faísca do site comercial real em um servidor privado por senha, com a mesma origem e interface integrada. Essa proteção **não deve ser confundida com um widget público aprovado**. Uma integração incorreta no build Astro, cópia de artifact ou alteração não revisada poderia tornar acessível uma rota `/__faisca_preview/`, um script privado ou o próprio mascote aprovado antes de os contratos de IA/Portal/CRM estarem prontos.

## O gate R26

`ops/faisca/composition/public-release-gate.mjs` inspeciona **os bytes de todos os arquivos de `dist/`**, logo após `npm run build`, e exige:

1. `publicFaiscaEnabled === false`, preservando a regra oficial de não ativação.
2. Diretório de output real, sem symlinks; até 350 arquivos, 12 MiB por arquivo e 160 MiB no total.
3. Presença de `index.html`, `404.html`, `robots.txt` e `sitemap.xml`.
4. Nenhuma rota ou diretório privado `__faisca_preview`, manifesto R21, iniciador R22, HTML standalone ou código de laboratório publicado.
5. Nenhum identificador de interface privada `data-faisca-private-entry`, `data-faisca-private-inline`, `data-faisca-inline-frame`, nem URL de staging incorporada ao HTML, JavaScript, CSS ou outros arquivos textuais.
6. Nenhum arquivo binário no `dist` cujo SHA-256 seja igual ao **PNG original aprovado** do Faísca.

Qualquer divergência faz a CI falhar. O relatório final registra apenas contagens de arquivos e bytes, e flags de ausência de integração operacional; não reproduz HTML, transcrições, segredos ou URLs internas.

## Testes

`tests/faisca-r26-public-release-gate.test.mjs` comprova comportamento positivo sobre um site sintético e recusas de URL privada, marcadores, JS, nomes de arquivo, PNG aprovado, symlink e build incompleto.

O workflow Faísca executa o R26 **depois da compilação real do Comercial** e antes dos testes de composição R24/R25. A auditoria é adicional aos testes existentes do Comercial (SEO, sitemap, visual, mobile, WCAG e canais de contato). Não desabilita nenhuma verificação anterior.

```bash
npm ci --no-audit --no-fund
node --test tests/faisca-r26-public-release-gate.test.mjs
npm run build
node ops/faisca/composition/public-release-gate.mjs --audit-dist
```

## Limites

O R26 prova **ausência de artefatos privados no build auditado**. Ele não demonstra que um host público está protegido, não verifica que o DNS esteja correto, não é revisão independente, não homologa PSP, LLM, LGPD nem login/CRM. Depois de um deploy real, continuam exigidos teste de endpoint público, backup/rollback e verificação do estado operacional da mesma SHA.

O comando de auditoria **não publica arquivos nem altera `dist`**; somente lê. Nenhum custo, cliente, login, cobrança, DNS, VPS, modelo de IA, alteração do mascote ou merge em `main`.
