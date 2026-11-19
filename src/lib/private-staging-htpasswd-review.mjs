/**
 * F166 — syntactic and local-permissions preflight for a PRIVATE staging
 * bcrypt htpasswd. The operator owns this file OUTSIDE the repository.
 * This module does not expose a password, pathname, hash or authenticate a user.
 */
import {lstatSync,readFileSync} from 'node:fs';

export function reviewPrivateStagingHtpasswd(path){
  if(typeof path!=='string'||path.length<8||path.length>512||
    !/^\/[a-zA-Z0-9/._-]+$/.test(path)||
    path.includes('//')||path.split('/').some(x=>x==='..'))
    throw Error('F166: invalid private auth file path');
  const stat=lstatSync(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<60||stat.size>1024||
    // Prevent world access or group/other mutation. Group read is optional
    // for an operator-reviewed UID/GID 101 bind mount.
    (stat.mode&0o027)!==0)
    throw Error('F166: staging auth file is not private and regular');
  const contents=readFileSync(path,'utf8');
  if(contents.length>1024||contents.includes('\r')||
     !/^reviewer:\$2[aby]\$(?:1[0-5])\$[./A-Za-z0-9]{53}\n?$/.test(contents)){
    throw Error('F166: staging bcrypt htpasswd syntax was not reviewed');
  }
  const hash=contents.slice('reviewer:'.length).trim();
  if(new Set(hash.slice(7)).size===1)
    throw Error('F166: staging placeholder bcrypt hash not allowed');
  return Object.freeze({
    schema:'imagine.comercial.private-htpasswd-review.v1',
    status:'PRIVATE_BCRYPT_SYNTAX_REVIEW_ONLY',
    fixedReviewerLogin:true,
    bcryptHashSyntaxPresent:true,
    filePermissionsPrivate:true,
    hashAuthenticityVerified:false,
    uid101ReadabilityVerified:false,
    mfaVerified:false,
    tlsOrSshTunnelVerified:false,
    deploymentAuthorized:false,
    deploymentPerformed:false
  });
}
