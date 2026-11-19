# P0: Portal do Cliente no menu + contratação Comercial (prévia de integração)

## Escopo desta entrega

A homepage Astro apresenta o menu **Portal do Cliente** em desktop e mobile **somente quando** `PUBLIC_PORTAL_LOGIN_URL` é configurada com a origem HTTPS oficialmente permitida. O projeto já possuía o componente visual; a nova CI verifica que os dois atalhos estão presentes, legíveis e sem tokens ou parâmetros na URL.

O mesmo workflow prepara os quatro botões de serviço (Onepage, Landing Page, Google Ads, Meta Ads) em **cópia descartável** do build. Os links apontam ao login/cadastro individual de **homologação** do Portal mantendo `product` e não ativam pagamentos ou qualquer recurso público.

### Passo a passo e evidências

1. Construir Astro com Node 22 e URL revisada `https://portal.imaginecomunicacao.com.br/login`; a existência do link **não demonstra que o destino está publicado**.
2. Verificar a presença da opção em `Navegação principal` e `Navegação móvel`.
3. Confirmar que links com HTTP, host estranho, credenciais embutidas, portas, query, fragmento ou path encoding perigoso são recusados pelo helper.
4. Compilar os quatro CTAs na cópia privada e verificar que o build original permanece intacto.
5. Não usar clientes reais nem chamar a VPS; nenhuma rota de login, contrato ou assinatura é considerada pronta.

### Bloqueadores para publicação comercial

- Homologar de verdade o **endereço do Portal** protegido por TLS e autenticação oficial, incluindo abertura e recuperação de sessão, aceite de termos, consentimento e CNPJ.
- Incluir preços, condições, emissão fiscal e provedor de pagamento homologados, com confirmação PSP assinada e idempotente.
- Ligar somente pedidos de Sites elegíveis ao processador Portal → Sites com identidade S2S verificável, revogação e trilha de auditoria; não transformar uma simulação fictícia de pagamento em autorização real.
- Habilitar operação comercial somente após migração e homologação isolada em Leaseweb, backup/restauração e reversão aprovada, revisão de segurança e critérios de LGPD.
- Preservar o domínio principal **sem `www`**; domínios de desenvolvimento e produção devem ter configurações revisadas separadamente.

**Status:** DRAFT / NO-GO. A homepage publicada, o servidor e os gateways não foram alterados; isto é um teste automatizado da futura navegação.
