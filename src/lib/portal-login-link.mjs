/**
 * F29 — link de login do Portal vindo de configuração de build confiável.
 * Não autentica usuários, não recebe tokens e não solicita credenciais.
 * Uma configuração inválida simplesmente oculta o atalho comercial.
 */
const trustedPortalHosts=new Set([
  'portal.imaginecomunicacao.com.br',
  'imaginecomunicacao.com.br'
]);
const safePath=/^\/[a-z0-9_/-]*$/;

export function resolvePortalLoginLink(value) {
  if(value===undefined || value===null || value==='')return '';
  if(typeof value!=='string' || value.length>512 || value.trim()!==value ||
     /[\x00-\x20\\<>"'\x60]/.test(value) || !/^https:\/\//i.test(value))return '';
  // WHATWG URL normalizes dot segments before exposing pathname. Reject
  // the original source so /auth/../login cannot bypass path checks.
  const raw=value.match(/^https:\/\/[^/?#]+(\/[^?#]*)?/i);
  if(!raw)return '';
  const unnormalizedPath=raw[1] || '/';
  if(unnormalizedPath.includes('//') ||
     unnormalizedPath.split('/').some(x=>x==='.' || x==='..') ||
     unnormalizedPath.includes('%'))return '';
  try {
    const url=new URL(value);
    if(url.protocol!=='https:' || !trustedPortalHosts.has(url.hostname.toLowerCase()) ||
       url.username || url.password || url.port || url.search || url.hash ||
       !safePath.test(url.pathname) || url.pathname.includes('//') ||
       url.pathname.length>128)return '';
    return url.toString();
  }catch {
    return '';
  }
}
