# Faísca R237 — auditoria do tmpfs efetivamente configurado no contêiner privado

## Lacuna técnica comprovada

O kit aprovado em R234 e o Compose já resolvido em R235 exigem dois tmpfs com cotas: `/tmp` com 32 MiB e `/var/run` com 4 MiB, ambos com `rw,noexec,nosuid`. O inspetor R236 verificava três bind mounts somente leitura e a raiz readonly, **mas não verificava `HostConfig.Tmpfs` do Docker em execução**. Um registro sintético sem tmpfs, com diretório temporário executável ou sem cota era aceito. Para Nginx em raiz readonly, a ausência desses mounts pode inviabilizar o serviço; alterações de flags/cotas enfraquecem o isolamento.

## Incremento executável

O verificador puro `ops/faisca/staging/review-running-container.mjs` agora confere os dois destinos exatos informados por `docker inspect`, a presença sem duplicação de `rw,noexec,nosuid` e a cota correspondente. Permite somente a representação literal do Compose (`32m`/`4m`) ou seus valores exatos em bytes, em qualquer ordem dos quatro termos. Rejeita ausência, destino extra, flags adicionais, falta de cota, volume ilimitado ou opção desconhecida, retornando HOLD sem revelar paths, IDs ou conteúdos.

`tests/faisca-r236-running-inspect.test.mjs` cobre a regressão, variantes adversariais e o formato normalizado em bytes. O modo operador da CLI não foi ampliado: nenhum Docker/SSH, nenhuma consulta externa, nenhum segredo, alteração de VPS ou deploy.

## Validação e gates

```bash
node --test tests/faisca-r236-running-inspect.test.mjs
npm test
npm run test:browser
```

O teste usa exclusivamente JSON sintético. O registro real do Docker precisa ser obtido e revisado por operador **já autorizado**, com imagem/hash/site/credenciais conferidos independentemente, e deve ser mantido fora de repositórios, logs e artifacts.

Esta alteração **não comprova** que R95–R237 foram instaladas na VPS, nem porta pública ausente, `nginx -T`, HTTP 401/403, procedência da imagem, reconciliação externa de gastos, revisões AppSec/LGPD/FinOps/editorial ou qualidade de respostas Luna/Terra. R92 e o teste pago já relatados não foram repetidos. Manter `main`, o site, o mascote e `publicFaiscaEnabled=false` intactos. PR draft; **NO-GO público**.
