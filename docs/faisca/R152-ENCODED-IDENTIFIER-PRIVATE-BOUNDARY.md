# Faísca R152 — envelopes de identificadores codificados no laboratório privado

## Risco concreto e recorte

Os filtros R148–R151 reconhecem emails, domínios, IPs e formatos conhecidos de credenciais quando escritos literalmente. A mesma informação pode ser fornecida como texto codificado, por exemplo `pessoa%40exemplo%2einvalid` ou `nome&#64;exemplo`, sem conter o caractere `@` literal. Esses valores não são dados reais; são fixtures inventadas.

Esta alteração **não decodifica nem registra o conteúdo**. Ela recusa conservadoramente sequências de percent-encoding (`%40`, `%u0040`), referências HTML numéricas e nomes de entidades relevantes (`&commat;`), e escapes de código (`\\u0040`, `\\x40`, `\\u{40}`). A porcentagem ordinária (`20% de crescimento`) não é classificada como escape.

## Garantias testadas

- A barreira autoritativa `hasPrivateIdentifierRisk` e o preflight `readPrivateSyntheticQuestion` rejeitam o texto **antes** de qualquer chamada ao modelo, mesmo com confirmação de pergunta fictícia.
- O servidor HTTP local, autenticado em loopback, responde 400 sem ecoar o valor rejeitado nem chamar o adaptador da IA.
- A saída do adaptador Luna/Terra recusa texto codificado mesmo sob um retorno simulado aparentemente válido, sem reintentos ou liberação da reserva.
- O navegador revalida antes do POST e antes de renderizar uma resposta HTTP 200 manipulada; os testes Node/VM e Chromium verificam limpeza de token, pergunta e conteúdo.
- `main`, ativos públicos, mascote aprovado e `publicFaiscaEnabled=false` não são alterados.

## Limites e próximos gates

Esta é uma defesa lexical deliberadamente conservadora para perguntas e respostas **estritamente fictícias**. Não é detector universal de dados pessoais, não analisa recursivamente todas as codificações e não substitui revisão AppSec/LGPD e editorial humana. Pode recusar texto técnico legítimo que contenha escapes. Não concede autorização para tráfego de clientes.

A CI executa exclusivamente fixtures e loopback: não comprova instalação de R95–R152 na VPS nem substitui a homologação R92 já informada. Revisão independente e homologação acumulada de staging por operador continuam HOLD. Não realizar merge, deploy, alteração de DNS/VPS ou integração operacional com CRM/Portal/Sites.
