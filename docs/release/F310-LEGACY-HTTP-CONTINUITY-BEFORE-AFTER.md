# Comercial — F310: continuidade HTTP das páginas antigas antes de qualquer troca de domínio

**Situação:** ferramenta de observação **somente leitura**, não um instalador ou
autorização de lançamento. As versões internacionais usam `/en/` e `/es/`,
mas o site histórico também tem `/en-us/` e páginas de termos, portfólio
e ofertas não contempladas pelo Astro. Nunca substituir silenciosamente o
conteúdo antigo por 404 ou pela página inicial.

## O que esta etapa entrega

- Um inventário fechado com **27 URLs históricas**: 22 em HOLD e 5 candidatas.
- Hash SHA-256 e tamanho do HTML obtido via GET de cada rota, sem armazenar
  resposta HTML, cookies, nomes, e-mails, mensagens ou dados de visitantes.
- **Origem pública fixada**, apenas `https://www.imaginecomunicacao.com.br`,
  sem redirecionamentos automáticos ou URLs introduzidas pelo operador.
- **Candidata de homologação fixada**, apenas `http://127.0.0.1:4321`,
  com HTTP Basic `reviewer` existente e senha fornecida somente pelo
  ambiente efêmero fora do GitHub.
- Dois arquivos privados de evidência legível por máquina, criados em local
  **fora do repositório**, com permissão `0600` e sem sobrescrever arquivos.
- Comparação independente: toda rota HOLD que respondeu 200 no original
  deve responder 200 no candidato com **HTML e comprimento idênticos**.
  Se o conteúdo incluir tokens dinâmicos, a divergência também gera HOLD
  para revisão humana, não uma falsa aprovação.
- Candidatas 301 são apenas observações: **zero redirects autorizados**,
  independentemente do resultado. Cobertura de Search Console e backlinks,
  consentimentos, serviços legados e revisão jurídica continuam necessárias.

## Ordem operacional (somente operador autorizado)

**Não executar nenhum comando abaixo em produção nem em CI.** Execute na
área administrativa autorizada, com Node 22+ e rede explicitamente
permitida, depois de revisar o repositório e os scripts. Não coloque
credenciais em código, prompt de chat, commit ou terminal compartilhado.

1. No ambiente de administração, definir `IMAGINE_LEGACY_HTTP_REVIEW=1`
   apenas para a sessão de revisão. Usar um diretório privado existente fora
   da árvore Git, por exemplo `/home/<operador>/private-release-evidence/`
   (substituir por caminho real restrito).
2. Antes de qualquer migração, capturar o site original publicamente
   acessível:

   ```bash
   node scripts/capture-legacy-http-operator.mjs --original /CAMINHO_PRIVADO/legacy-before.json
   ```

3. Com a **homologação privada já iniciada** por um operador autorizado,
   protegida por senha forte e vinculada somente a `127.0.0.1:4321`,
   fornecer `IMAGINE_STAGING_REVIEW_PASSWORD` apenas por sessão efêmera
   segura e capturar o candidato:

   ```bash
   node scripts/capture-legacy-http-operator.mjs --candidate-local /CAMINHO_PRIVADO/legacy-after.json
   ```

   O código não inicia o Docker, não abre portas e não faz deploy.
   Não inclua a senha no comando nem no histórico.

4. Comparar os dois arquivos:

   ```bash
   node scripts/review-legacy-http-operator.mjs --before /CAMINHO_PRIVADO/legacy-before.json --after /CAMINHO_PRIVADO/legacy-after.json
   ```

   Apenas contagens e sinalizadores de bloqueio são impressos. Os
   fingerprints e caminhos históricos permanecem nos arquivos privados.

5. Se `heldMissingOrChanged > 0`, `heldOriginalStatusUnproven > 0`
   ou `allHeldBytePreserved=false`, **não trocar domínio nem publicar**.
   O build Astro isolado atual responde **404 para URLs legadas em HOLD**;
   portanto, ele deve falhar nesta verificação de continuidade se
   tentar substituir o site antigo. Isso é o comportamento esperado,
   não autorização para remover as páginas.
6. Mesmo se os 22 HOLD estiverem iguais, o resultado continua
   `NO_GO_OPERATOR_HTTP_EVIDENCE_REVIEW_ONLY` porque o hash não autentica
   a origem nem substitui aprovação editorial/LGPD, GSC real, backups,
   roteamento, TLS, teste de rollback e liberação do responsável.

## Timeout opcional por GET (17/11/2026)

Sem `IMAGINE_LEGACY_HTTP_TIMEOUT_MS`, cada GET mantém o prazo padrão de
**7000 ms**. O operador pode definir um inteiro decimal canônico entre
**1000 e 10000 ms**, inclusive, tanto em `--original` quanto em
`--candidate-local`. Valores vazios, com espaços, sinal, zeros iniciais,
casas decimais, notação exponencial ou fora desse intervalo são recusados
antes de qualquer requisição ou gravação de snapshot, com o erro genérico
HOLD existente.

Exemplo para observar o original com o teto de 10 segundos por GET,
respeitando o ambiente e o diretório privado descritos acima:

```bash
IMAGINE_LEGACY_HTTP_REVIEW=1 IMAGINE_LEGACY_HTTP_TIMEOUT_MS=10000 \
  node scripts/capture-legacy-http-operator.mjs --original /CAMINHO_PRIVADO/legacy-before.json
```

O prazo se aplica a cada uma das 27 requisições sequenciais. A captura
continua sem novas tentativas automáticas; uma falha interrompe a coleta
sem gravar snapshot parcial. Ajustar o prazo não comprova conectividade
nem cobertura completa das rotas. Origens fixas, opt-in, bloqueio de CI,
GET sem cookies ou redirects automáticos e criação exclusiva `0600`
permanecem obrigatórios.

## Segurança obrigatória da leitura dos snapshots (18/11/2026)

O comparador F310 agora usa um leitor **exclusivo para evidências privadas**, sem alterar o leitor genérico de builds públicos. Em sistemas POSIX, cada snapshot deve pertencer ao operador, ser arquivo regular com permissão **0600**, estar em diretório físico controlado pelo mesmo operador sem acesso de grupo/outros (**0700** é recomendado) e possuir apenas um vínculo físico (hardlinks não são aceitos). O comparador abre um único descritor com `O_NOFOLLOW`, valida permissões, proprietário e vínculos **após abrir**, impõe teto de 100 KiB e exige UTF-8 íntegro. Em plataformas sem semântica POSIX verificável, termina em HOLD; faça a comparação no operador Linux autorizado.

Arquivos existentes com outra permissão não são ajustados automaticamente: o responsável deve verificar procedência e armazenamento antes de corrigir as permissões fora do repositório. Nenhum caminho, hash, conteúdo ou motivo detalhado da rejeição é impresso. Isso não autentica a origem da resposta HTTP nem autoriza publicação. A captura continua com criação exclusiva `0600`; não há POST, deploy ou alteração de DNS.

## Rejeição antecipada de autenticação de staging (18/11/2026)

Se qualquer rota da candidata local devolver **401, 403 ou 407**, o coletor encerra na primeira resposta negada e **não cria** arquivo `AFTER_CANDIDATE`. Essa recusa indica que o acesso não foi comprovado, não que as 27 páginas foram observadas. Uma URL local 404 continua registrada para a comparação de continuidade, pois pode representar perda real de rota. A coleta pública do original mantém seus códigos HTTP como observação, sem credenciais. Nenhum status negado permite homologação ou contorno da autenticação.

## Limites

### Caminhos privados independentes do diretório de execução

Os dois CLIs identificam a raiz física deste checkout a partir do próprio
script, sem presumir que o diretório de trabalho do operador seja a raiz Git.
O diretório-pai existente de cada entrada/saída é resolvido antes do uso;
arquivos que terminariam dentro do checkout são recusados, inclusive por
aliases de diretório. O caminho físico externo resolvido é o usado na leitura
ou gravação, evitando que a troca posterior de um alias redirecione a saída.

Assim, executar o script por caminho absoluto a partir do próprio diretório
privado é permitido. Esse diretório deve continuar sob controle do operador,
com acesso restrito. A verificação não autentica snapshots nem substitui
isolamento do sistema de arquivos contra quem possa renomear diretórios
físicos. A criação exclusiva `0600`, `O_NOFOLLOW`, a leitura limitada por um
descritor e os bloqueios de CI/opt-in permanecem ativos.

A observação da origem pública é um retrato do momento, não um backup dos
arquivos nem prova de que todos os links, scripts ou formulários funcionam.
Não armazena HTML por segurança; a recuperação do site antigo depende de
backup operacional separado. Não gera `_redirects`, `_headers`, tokens,
HTTP POST, mudanças de DNS, merges ou chamadas ao Asaas.

Antes de promover a nova versão, exigir ainda prova de que o
**formulário histórico de contato/orçamento**, eventualmente ativo
na página legada, terá uma jornada de entrada validada no Portal/CRM ou
permanecerá em operação sem perda de leads. A prévia estática do Astro
não substitui automaticamente esse atendimento.

**DRAFT / NO-MERGE / NO-DEPLOY.**
