/**
 * F257 — compare Nginx's loaded (nginx -T) configuration to the reviewed
 * static staging source. The parsed dump is strictly local operator input.
 *
 * Does not prove the listener is reachable, authenticated or running the
 * expected bytes: F167 HTTP and independent server review remain necessary.
 */
const HOLD='F257: active Nginx configuration not verified (HOLD)';
const VALID_PATH='/etc/nginx/conf.d/default.conf';
const OTHER_ALLOWED=new Set(['/etc/nginx/nginx.conf','/etc/nginx/mime.types']);
function insist(value){if(!value)throw Error(HOLD);}
function normalize(content){
  insist(typeof content==='string'&&content.length>30&&content.length<16384&&
    !content.includes('\0')&&!content.includes('\r'));
  // Preserve all executable lines and indent/order, discard comments only.
  const rows=content.split('\n').map(s=>s.trimEnd())
    .filter(s=>s.trim()&&!s.trimStart().startsWith('#'));
  insist(rows.every(s=>/^[\x20-\x7e]+$/.test(s)));
  return rows.join('\n');
}
export function reviewActivePrivateStagingNginx({
  dump,reviewedNginxSource
}={}){
  insist(typeof dump==='string'&&dump.length>90&&dump.length<=524288&&
    !dump.includes('\0')&&!dump.includes('\r'));
  const headers=[...dump.matchAll(/^# configuration file ([^\n]+):$/gm)];
  insist(headers.length>=3&&headers.length<=12&&
    headers[0].index===0);
  const chunks=new Map();
  for(let i=0;i<headers.length;i++){
    const marker=headers[i],path=marker[1];
    insist(path===VALID_PATH||OTHER_ALLOWED.has(path));
    insist(!chunks.has(path));
    const start=marker.index+marker[0].length+1;
    const end=i+1<headers.length?headers[i+1].index:dump.length;
    const body=dump.slice(start,end);
    insist(body.length>1);
    chunks.set(path,body);
  }
  insist(chunks.size===3&&
    chunks.has(VALID_PATH)&&
    chunks.has('/etc/nginx/nginx.conf')&&chunks.has('/etc/nginx/mime.types'));
  const loaded=normalize(chunks.get(VALID_PATH));
  const expected=normalize(reviewedNginxSource);
  insist(loaded===expected);
  // Scan ALL loaded files, not just the reviewed default.conf, for a second
  // server/upstream/proxy location hidden in a different included file.
  let serverBlocks=0;
  for(const body of chunks.values()){
    const active=normalize(body);
    serverBlocks+=(active.match(/\bserver\s*\{/g)||[]).length;
    // A global 'proxy_pass' or a second include needs explicit review.
    insist(!/\bproxy_pass\s+/.test(active));
    if(body!==chunks.get(VALID_PATH)){
      insist(!/\b(?:auth_basic|location|listen|server_name)\s+/.test(active));
    }
  }
  insist(serverBlocks===1);
  return Object.freeze({
    schema:'imagine.comercial.active-nginx-config-review.v1',
    status:'LOADED_NGINX_CONFIG_EQUALS_REVIEWED_SOURCE_ONLY',
    expectedStaticConfigLoaded:true,
    unapprovedAdditionalConfigFileAbsent:true,
    duplicateServerBlockAbsent:true,
    browserOrHttpStatusVerified:false,
    actualPublicNetworkIsolationVerified:false,
    sslAndSshVerified:false,
    independentOperatorApprovalPresent:false,
    deployAuthorized:false,
    deployedByThisCheck:false
  });
}
