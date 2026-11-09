/**
 * Exemplos confirmados por busca pública em 09/11/2026.
 * NÃO equivale ao inventário integral (faltam GSC, sitemap, backlinks e crawl completo).
 * NÃO habilitar redirecionamentos antes da auditoria e liberação de produção.
 */
export const legacyUrls = Object.freeze([
  {
    from: '/fale-conosco.html', to: '/contato/', status: 'candidate',
    reason: 'Página de contato legada; equivalência final exige revisão editorial.'
  },
  {
    from: '/agencia-imagine-comunicacao-digital.html', to: '/sobre/', status: 'candidate',
    reason: 'Página institucional legada; revisar eventuais dados históricos e alegações antes da migração.'
  },
  {
    from: '/clientes.html', to: null, status: 'hold',
    reason: 'Aguardando portfólio com autorizações de divulgação; não redirecionar para a homepage.'
  },
  {
    from: '/en-us/', to: null, status: 'hold',
    reason: 'Necessária decisão de conteúdo em inglês e hreflang.'
  },
  {
    from: '/en-us/customers.html', to: null, status: 'hold',
    reason: 'Necessária versão em inglês e política de portfólio.'
  },
  {
    from: '/en-us/termos-de-uso.html', to: null, status: 'hold',
    reason: 'Página legada de termos/privacidade em inglês. Preservação e política de dados exigem validação jurídica e versão equivalente.'
  },
  {
    from: '/en-us/contact-us.html', to: null, status: 'hold',
    reason: 'Necessária preservação adequada do conteúdo em inglês.'
  }
]);
