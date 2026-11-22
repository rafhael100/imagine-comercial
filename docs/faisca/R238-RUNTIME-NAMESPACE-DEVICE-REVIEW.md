# Faísca R238 — namespaces, devices e recursos do host no contêiner privado

## Lacuna e correção

A R236/R237 validava o contêiner pelo registro read-only de `docker inspect` quanto à porta, imagem, mounts somente leitura, tmpfs, capabilities e limites. Entretanto, o mesmo registro podia declarar `PidMode=host`, `IpcMode=host`, `CgroupnsMode=host`, `UsernsMode=host`, acesso explícito a dispositivos ou grupos adicionais e ainda passar. São overrides não previstos no Compose privado e capazes de enfraquecer a separação do ambiente.

`namespaceAndDevices` agora rejeita compartilhamento explícito de namespaces do host, join em namespaces de outro contêiner, device passthrough / requests / regras de dispositivos, grupos adicionais, hosts/links/DNS especiais, sysctls e desativação de OOM kill. Mantém somente as formas vazias/nulas e valores privados esperados pelo Docker Engine, sem exigir uma versão específica do daemon.

## Validação

`node --test tests/faisca-r236-running-inspect.test.mjs` inclui casos negativos independentes e um caso positivo com campos normalizados de Docker inspect. A pipeline geral continua com Node, HTTP, Chromium/axe, PostgreSQL, compatibilidade Portal, PHP, SEO/build. Tudo sintético; o script de auditoria não obtém dados do Docker por si mesmo.

Conforme a documentação da API Docker Engine, ausência de configuração explícita de `CgroupnsMode` pode aplicar o default do daemon; portanto, a resposta declara `effectiveUserAndCgroupNamespacesIndependentlyVerified=false`. **Ausência de override não certifica isolamento do host**; a configuração operacional real deve ser verificada por operador com autorização própria.

## Gates não concluídos

A CI não comprova instalação R95–R238 na VPS nem procedência da imagem/artefatos, isolamento efetivo da máquina, porta pública/HTTP/TLS, privacidade de dados reais, gastos reconciliados ou revisão AppSec/LGPD/FinOps/editorial. Sem novos testes pagos, chaves ou acesso VPS; preservar R92 e o teste Luna/Terra já relatados. Não alterar `main`, site público, mascote ou `publicFaiscaEnabled=false`. Sem merge/deploy/DNS/CRM/Portal/Sites operacionais. **NO-GO público**.
