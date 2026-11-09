# F12 — Orçamentos de tamanho de arquivo na compilação

## Objetivo
Evitar regressões grosseiras de peso no site Astro, especialmente em smartphones, antes de rodar testes de desempenho em dispositivos reais.

## Implementado
- `node scripts/check-asset-budgets.mjs dist` inspeciona HTML, JavaScript, CSS e imagens estáticas.
- Limites iniciais: HTML individual 160 KiB, arquivo JS 125 KiB, JS total 250 KiB, arquivo CSS 120 KiB, imagens raster em conjunto 5 MiB.
- Bloqueia artefatos sem HTML, detecta arquivos excessivos, rejeita links simbólicos e impede configurações inválidas.
- Relatório JSON legível no CI, com status e métricas de tamanho.
- Testes sintéticos para casos permitidos, excesso por arquivo, excesso total e ausência de HTML.
- O workflow executa a verificação após o build Astro padrão ser restaurado do teste de publicação assinada.

## Restrições e métricas futuras
Tamanho de arquivo é apenas um indicador indireto; **não representa tempo de carregamento**. Nenhum resultado de LCP, INP, CLS, Lighthouse ou posicionamento Google é afirmado a partir dessa auditoria.

A homologação de produção exige testes móveis reais, auditoria dos recursos de terceiros, cache/CDN e acompanhamento CrUX/GSC/GA4 autorizados.

Sem merge na main, sem deploy, sem custos novos ou alteração do domínio.
