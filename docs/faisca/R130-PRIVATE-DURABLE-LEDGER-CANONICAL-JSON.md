# Faísca R130 — impedir redefinição silenciosa de cotas por JSON duplicado

## Lacuna
A reserva local durável R82–R102 valida campos, limites e marcador de inicialização, mas o leitor utilizava apenas `JSON.parse`. Em JSON, chaves duplicadas são aceitas e prevalece o último valor; um arquivo corrompido com `"requests":3,"requests":0` poderia ser interpretado como contador 0. Isso fragiliza a proteção contra chamadas pagas adicionais em um único host.

## Correção
- Exigir que o arquivo seja **exatamente** `JSON.stringify(value) + "\\n"`, forma gravada e sincronizada pelo escritor desde R82.
- Essa verificação rejeita campos repetidos, reescritas externas com espaços diferentes e ausência de quebra de linha final. O estado fica em falha fechada até revisão do operador.
- Não redefine cotas nem toca no estado real da VPS; nenhuma chave, texto, resposta ou dado pessoal é gravado.
- Compatibilidade positiva comprovada com o estado v1 R82 sem marcador anterior: leitura/atualização preserva a reserva existente e inicializa marcador de forma conservadora.

## Testes
```sh
node --test tests/faisca-r130-canonical-ledger-state.test.mjs
npm test
```
A CI completa na HEAD deve verificar Node/HTTP/Chromium/axe, Comercial/SEO/build, PHP/Portal e PG descartável; os testes do ledger criam diretórios temporários 0700, sem dependência de DB ou OpenAI.

## Limitações
Proteção de integridade estrutural, não assinatura ou auditoria criptográfica. Quem tiver acesso de escrita à conta local pode adulterar um JSON canonical; controle de identidade, backup imutável e conciliação com Usage da OpenAI continuam gates. Também não há quota distribuída multi-VPS.

R92 homologada por relato, R95–R130 não presumidas instaladas. `publicFaiscaEnabled=false`, mascote, site público e `main` preservados. Sem merge, deploy, alterações em VPS/DNS, acesso à chave, uso pago, dados reais, CRM/Portal operacional, lead, ticket ou cobrança.
