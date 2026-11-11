# F13 — Inventário público de migração (09/11/2026)

## Verificação pública realizada
Consulta por busca web a páginas públicas existentes. **Amostra, não crawling completo, não base Search Console.**

| URL antiga existente | Tratamento recomendado no projeto novo | Estado |
|---|---|---|
| `https://www.imaginecomunicacao.com.br/` | Home principal | Candidata, confirmar host |
| `https://www.imaginecomunicacao.com.br/fale-conosco.html` | `/contato/` | Candidata, revisar conteúdo |
| `https://www.imaginecomunicacao.com.br/agencia-imagine-comunicacao-digital.html` | `/sobre/` | Candidata, revisar equivalência |
| `https://www.imaginecomunicacao.com.br/clientes.html` | Portfólio próprio se houver autorização de divulgação | **HOLD** |
| `https://www.imaginecomunicacao.com.br/en-us/` | Definir versão inglesa ou continuidade da URL | **HOLD** |
| `https://www.imaginecomunicacao.com.br/en-us/customers.html` | Política inglês + portfólio | **HOLD** |
| `https://www.imaginecomunicacao.com.br/en-us/contact-us.html` | Política inglês + atendimento | **HOLD** |
| `https://www.imaginecomunicacao.com.br/en-us/termos-de-uso.html` | Preservar aviso de privacidade/termos em versão jurídica aprovada | **HOLD** |

## Observações relevantes
1. O site legado contém uma página de termos/privacidade em `/en-us/termos-de-uso.html`. Não remover, copiar sem revisão jurídica ou redirecionar para a homepage; providenciar equivalente aprovado antes da migração.
2. A página institucional antiga tem afirmações históricas de certificação, sistemas proprietários e experiência; **não transportá-las para o site novo sem evidências e confirmação da validade atual**.
3. A homepage antiga menciona serviços e canais que não fazem parte necessariamente do catálogo aprovado atualmente. Evitar criação de páginas/ofertas fictícias apenas para replicar menus históricos.
4. As tentativas de abrir `/robots.txt` e `/sitemap.xml` do domínio antigo não produziram conteúdo acessível pela ferramenta usada; isso **não comprova ausência** desses arquivos. Requer verificação HTTP/crawl autorizado.
5. Permanece importante descobrir o estado de indexação, tráfego e backlinks antes de aplicar redirects 301/308.

## Fontes públicas consultadas
- https://www.imaginecomunicacao.com.br/
- https://www.imaginecomunicacao.com.br/fale-conosco.html
- https://www.imaginecomunicacao.com.br/agencia-imagine-comunicacao-digital.html
- https://www.imaginecomunicacao.com.br/clientes.html
- https://www.imaginecomunicacao.com.br/en-us/
- https://www.imaginecomunicacao.com.br/en-us/customers.html
- https://www.imaginecomunicacao.com.br/en-us/contact-us.html
- https://www.imaginecomunicacao.com.br/en-us/termos-de-uso.html

## Gates ainda abertos
- Obter Search Console e inventário de URL completa (somente com acesso autorizado).
- Auditar links, HTTP, canonicals, hreflang, sitemaps e Backoffice atual, com rastreio controlado.
- Validar proteção de dados, termos e direitos de uso de marca/portfólio.
- Aprovar mapeamento individual de redirecionamentos e a janela de lançamento.
- **Sem redirecionar, modificar DNS, alterar domínio nem publicar.**
