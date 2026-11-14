/**
 * F28 — cabeçalhos defensivos sugeridos, testados exclusivamente em Workerd local.
 * NÃO publicar _headers em public/ ou dist/; não faz deploy ou mudanças em DNS.
 */
export const localHeaderProfile=Object.freeze([
  Object.freeze(['X-Content-Type-Options','nosniff']),
  Object.freeze(['Referrer-Policy','strict-origin-when-cross-origin']),
  Object.freeze(['X-Frame-Options','DENY']),
  Object.freeze(['Permissions-Policy','camera=(), microphone=(), geolocation=()'])
]);

const allowed=new Map(localHeaderProfile);
export function createSecurityHeadersPreview(profile=localHeaderProfile) {
  if(!Array.isArray(profile) || profile.length!==allowed.size)
    throw new Error('security headers: all reviewed headers required');
  const unique=new Set();
  const entries=[];
  for(const part of profile){
    if(!Array.isArray(part)||part.length!==2)throw new Error('security headers: invalid entry');
    const [key,value]=part;
    if(typeof key!=='string' || typeof value!=='string' ||
       !allowed.has(key) || allowed.get(key)!==value ||
       unique.has(key) || /[\r\n\0]/.test(key+value)) {
      throw new Error('security headers: unreviewed or duplicate setting');
    }
    unique.add(key);
    entries.push('  '+key+': '+value);
  }
  // Only the loopback Workerd smoke harness may write this output as _headers
  // in its disposable temporary directory. No production output code calls it.
  return '# LOCAL SIMULATION / REVIEW ONLY — NEVER DEPLOY THIS FILE AS-IS\n'+
    '/*\n'+entries.join('\n')+'\n';
}
