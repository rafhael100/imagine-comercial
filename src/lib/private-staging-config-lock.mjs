/**
 * F253 — exact reviewed staging configuration lock.
 *
 * This policy protects the SOURCE configurations from drift, not the runtime
 * Docker daemon, mounted files, actual image digest, TLS or network routes.
 * A legitimate change must be independently reviewed and deliberately update
 * this versioned golden policy, with negative regression tests.
 *
 * Do not replace this comparison with positive-regex-only checks: a YAML
 * override or a second Nginx location could bypass apparently valid lines.
 */
const EXPECTED=Object.freeze({
  compose:"services:\n  static-review:\n    image: ${IMAGINE_STAGING_NGINX_IMAGE:?Set a reviewed, digest-pinned Nginx unprivileged image}\n    restart: \"no\"\n    ports:\n      - \"127.0.0.1:4321:8080\"\n    user: \"101:101\"\n    read_only: true\n    cap_drop:\n      - ALL\n    security_opt:\n      - no-new-privileges:true\n    pids_limit: 64\n    mem_limit: 256m\n    cpus: 0.5\n    volumes:\n      - ../../dist:/usr/share/nginx/html:ro\n      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro\n      - ${IMAGINE_STAGING_HTPASSWD_PATH:?Set operator-owned, private bcrypt htpasswd file}:/etc/nginx/auth/.htpasswd:ro\n    tmpfs:\n      - /tmp:rw,noexec,nosuid,size=32m\n      - /var/run:rw,noexec,nosuid,size=4m\n    environment:\n      - TZ=UTC",
  nginx:"server {\n    listen 8080 default_server;\n    server_name _;\n    root /usr/share/nginx/html;\n    index index.html;\n    server_tokens off;\n    autoindex off;\n    charset utf-8;\n    access_log off;\n    auth_basic \"Imagine private review\";\n    auth_basic_user_file /etc/nginx/auth/.htpasswd;\n    add_header X-Content-Type-Options \"nosniff\" always;\n    add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;\n    add_header X-Frame-Options \"DENY\" always;\n    add_header Permissions-Policy \"camera=(), microphone=(), geolocation=()\" always;\n    add_header Cache-Control \"no-store\" always;\n    add_header X-Robots-Tag \"noindex, nofollow, noarchive\" always;\n    error_page 404 /404.html;\n    location = /404.html {\n        internal;\n    }\n    location ~ (^|/)\\.|^/(?:_redirects|_headers)(?:/|$) {\n        return 404;\n    }\n    location / {\n        limit_except GET HEAD { deny all; }\n        try_files $uri $uri/ $uri/index.html =404;\n    }\n}"
});
function canonicalize(source){
  if(typeof source!=='string'||source.length<20||source.length>16384||
     /[\r\t\0]/.test(source))
    throw Error('F253: staging configuration not reviewed (HOLD)');
  // Comments may contain Portuguese UTF-8; Nginx/YAML executable
  // directives must still be strict ASCII and match the exact baseline.
  const active=source.split('\n')
    .map(line=>line.trimEnd())
    .filter(line=>line.trim().length>0&&!line.trimStart().startsWith('#'));
  if(active.some(line=>/[^\x20-\x7e]/.test(line)))
    throw Error('F253: staging configuration not reviewed (HOLD)');
  return active.join('\n');
}
export function reviewPrivateStagingConfiguration({compose,nginx}={}){
  if(canonicalize(compose)!==EXPECTED.compose||
     canonicalize(nginx)!==EXPECTED.nginx)
    throw Error('F253: staging configuration differs from reviewed policy (HOLD)');
  return Object.freeze({
    schema:'imagine.comercial.staging-source-configuration-lock.v1',
    status:'REVIEWED_SOURCE_CONFIG_MATCH_ONLY',
    localhostPortBindingPresent:true,
    readonlyUnprivilegedContainerPresent:true,
    authenticatedNoindexNginxSourcePresent:true,
    extraComposeOrNginxDirectivesAccepted:false,
    runtimeComposeConfigVerified:false,
    actualNetworkExposureVerified:false,
    imageProvenanceVerified:false,
    actualNginxRuntimeVerified:false,
    independentOperatorApprovalPresent:false,
    canPublish:false,
    deploymentAuthorized:false,
    deploymentPerformed:false
  });
}
