/**
 * F37 — seletor de intenção do BUILD, não autorização de publicação.
 *
 * O pipeline de homologação/produção deve informar IMAGINE_RELEASE_TARGET
 * explicitamente. Se esse alvo for informado, o catálogo assinado é obrigatório,
 * mesmo que alguém tenha omitido IMAGINE_CATALOG_REQUIRE_SIGNED.
 *
 * IMPORTANTE: sem alvo explícito este módulo só permite o build de revisão
 * existente, e NÃO certifica que um pacote é publicável. A autorização real
 * depende de CI protegida, grants, aprovação, assinatura e recibo no destino.
 */
const RELEASE_TARGETS=new Set(['review','staging','production']);

export function assertBuildReleaseIntent(env=process.env) {
  if(!env || typeof env!=='object' || Array.isArray(env))
    throw new Error('build catalog: invalid release environment');
  const rawTarget=env.IMAGINE_RELEASE_TARGET;
  const target=(rawTarget===undefined || rawTarget==='')?'review':rawTarget;
  if(typeof target!=='string' || !RELEASE_TARGETS.has(target))
    throw new Error('build catalog: invalid release target');
  const requireSigned=env.IMAGINE_CATALOG_REQUIRE_SIGNED;
  if(requireSigned!==undefined && requireSigned!=='' &&
     requireSigned!=='0' && requireSigned!=='1')
    throw new Error('build catalog: invalid signed-required mode');
  const protectedTarget=target==='staging'||target==='production';
  if(protectedTarget && requireSigned!=='1')
    throw new Error('build catalog: protected release target requires signed catalog mode');
  return Object.freeze({
    target,
    signedRequired:protectedTarget || requireSigned==='1',
    mode:'BUILD_INTENT_ONLY_NOT_DEPLOY_AUTHORIZATION'
  });
}
