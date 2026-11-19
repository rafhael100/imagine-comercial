# Evidência de HTML ativo nos contratos locais de SEO

## Problema reproduzido

Os contratos locais de canonical, metadados sociais, JSON-LD e inventário de
títulos/descrições ainda selecionavam tags por expressões regulares. Assim,
exemplos existentes somente em comentários, atributos, textarea ou templates
podiam ser contados como evidência real. Um `>` dentro de um atributo citado
também truncava uma tag válida; no título, o texto restante do atributo podia
até esconder a repetição do título real entre duas páginas.

Havia ainda um defeito herdado do leitor de anchors: a abertura do primeiro
SCRIPT dentro de um DOCTYPE citado, uma declaração `<!bogus ...>` ou uma
instrução `<?audit ...>` podia fornecer uma Organization fictícia. Essa
abertura pertence à declaração até o primeiro `>`; scripts posteriores a
esse delimitador podem ser ativos. Portanto, o payload inteiro não é tratado
como inerte.

Isso afeta os contratos usados por `verify-dist.mjs`, pela revisão de build
assinado e pelo ensaio Workerd. É um defeito dessas verificações locais. Os
repros **não demonstram passagem por toda a CI**, que também executa o Engine
SEO independente e outras verificações.

## Alteração

`active-html-reader.mjs` extrai a lógica já existente no leitor F286 de anchors.
O scanner identifica fronteiras de tags respeitando aspas, comentários,
conteúdo textual dos elementos já tratados pelo F286 e templates aninhados.
Também informa o início e o fim da tag, e o início do fechamento de elementos
textuais quando esse fechamento realmente existe.

O leitor de anchors delega ao scanner e mantém a mesma API. Os contratos
`seo-output-contract`, `jsonld-output-contract` e `site-head-inventory`
consomem os mesmos tokens, em vez de procurar novas tags dentro do texto de
outros elementos. Cada contrato tokeniza o documento uma vez por chamada ou
página do inventário.

Além da extração, o scanner agora consome declarações `<!` e instruções `<?`
até o primeiro `>` ou o fim do arquivo, depois de reconhecer os comentários
`<!-- ... -->`. Aspas em identificadores DOCTYPE não prolongam esse trecho.
Essa regra segue os estados HTML de
[identificador SYSTEM citado](https://html.spec.whatwg.org/multipage/parsing.html#doctype-system-identifier-(double-quoted)-state),
[declaração de markup](https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state),
[bogus comment](https://html.spec.whatwg.org/multipage/parsing.html#bogus-comment-state) e
[instrução de processamento](https://html.spec.whatwg.org/multipage/parsing.html#processing-instruction-data-state).
A correção também vale para o leitor de anchors que compartilha o scanner.

## Comportamentos preservados

- `readStrictHtmlAttribute` continua exigindo os atributos reais, citados e
  sem duplicidade; campos como `data-rel` e `data-type` não ganham autoridade.
- Canonical, robots, Open Graph e Twitter continuam com suas mesmas regras
  de igualdade e cardinalidade. Duplicados ativos continuam recusados,
  inclusive quando aparecem depois do fragmento principal.
- JSON-LD continua exigindo SCRIPT fechado, os tipos conhecidos, IDs, URLs,
  idioma, fornecedor e relações já verificados. Um JSON válido no EOF de um
  SCRIPT sem fechamento não passa a constituir uma entidade aprovada.
- O inventário F144 continua exigindo HEAD e TITLE fechados, tamanhos válidos
  e unicidade dos títulos e descrições normalizados.
- A política atual de raw text, templates e fallback `noscript` do leitor de
  anchors permanece. As assinaturas e os resultados públicos das funções não
  mudam. Não foi acrescentado um limite numérico de bytes ou tokens que não
  existia no leitor anterior.

O scanner é uma leitura estática do HTML compilado, com o escopo herdado do
F286 e a correção de declarações descrita acima. Não acrescenta resolução de
namespaces nem tokenização de CDATA estrangeiro. Não substitui o parser DOM
de um navegador, não executa JavaScript e não é um sanitizador de conteúdo.

## Validação

O arquivo `tests/seo-active-html-evidence.test.mjs` contém 30 casos
comportamentais. Dos 21 casos iniciais, 17 falharam no código anterior e
quatro controles passaram. Os nove casos acrescentados para declarações
incluem quatro regressões, que falharam tanto no contrato original quanto na
extração inicial, e cinco controles, que já passaram na extração inicial.
As regressões cobrem SYSTEM com aspas simples/duplas, `<!bogus` e `<?audit`;
os controles preservam scripts reais depois do primeiro delimitador e um
DOCTYPE HTML normal. Após a correção final, os 30 casos passaram.
Os controles anteriores também incluem duplicidades ativas, atributos
estritos e os fechamentos obrigatórios de SCRIPT, HEAD e TITLE.

A execução focada cobriu 67 testes dos contratos SEO/JSON-LD/títulos,
atributos e navegação ativa/inativa. A suíte `npm test` desta revisão terminou
com **1.113 testes aprovados**, zero falhas, skips ou cancelamentos.

As fixtures são sintéticas. Nenhuma coleta privada foi copiada para o código,
e a alteração não reprocessa retroativamente metadados de coletas anteriores.
Build, auditor independente e navegador devem ser confirmados pela CI do
commit publicado. Esses resultados não comprovam ranking, indexação,
homologação operacional ou autorização de produção.
