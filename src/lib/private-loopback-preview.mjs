/**
 * F154 — authenticated LOOPBACK-ONLY preview for local review.
 * This is NOT private Leaseweb staging, a deploy pipeline, a production
 * authentication mechanism, or a way to accept visitors' lead data.
 *
 * Only reviewed compiled site pages and hashed Astro assets are readable.
 * Refuse external bind addresses, DNS rebinding, URL variants and writes.
 */
import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {lstat,readFile,realpath} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {sitePages} from '../data/services.mjs';

const routeFiles=new Map(sitePages.map(({path})=>[
  path,path==='/'?'index.html':path.slice(1)+'index.html'
]));
const ASSET=/^\/_astro\/[A-Za-z0-9._-]+\.(?:js|css|png|jpg|jpeg|webp|svg|woff2?)$/;
const CHALLENGE='Basic realm="Imagine local preview", charset="UTF-8"';
const HEADERS=Object.freeze({
  'Cache-Control':'private, no-store, max-age=0',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'Cross-Origin-Resource-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'self'; base-uri 'none'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'"
});

const types=new Map([
  ['.html','text/html; charset=utf-8'],['.css','text/css; charset=utf-8'],
  ['.js','text/javascript; charset=utf-8'],['.svg','image/svg+xml'],
  ['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],
  ['.webp','image/webp'],['.woff','font/woff'],['.woff2','font/woff2']
]);
const digest=value=>createHash('sha256').update(value,'utf8').digest();

function validBasic(header,reference){
  if(typeof header!=='string'||header.length>512||
      !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(header))return false;
  const encoded=header.slice(6);
  const decoded=Buffer.from(encoded,'base64');
  if(decoded.toString('base64')!==encoded)return false;
  return timingSafeEqual(digest(decoded.toString('utf8')),reference);
}
function send(res,status,body='',head=false){
  res.statusCode=status;
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  res.end(head?'':body);
}
function safeRoute(raw){
  if(typeof raw!=='string'||raw.length>512||!raw.startsWith('/')||
    raw.startsWith('//')||raw.includes('?')||raw.includes('#')||
    raw.includes('%')||raw.includes('\\')||raw.includes('//')||
    /[\u0000-\u0020\u007f]/.test(raw)||raw.split('/').some(part=>part==='.'||part==='..'))return null;
  if(raw==='/robots.txt')return {kind:'robots'};
  if(routeFiles.has(raw))return {kind:'html',file:routeFiles.get(raw)};
  if(ASSET.test(raw))return {kind:'asset',file:raw.slice(1)};
  return null;
}
async function readAllowed(root,relative){
  const full=resolve(root,relative);
  if(!full.startsWith(root+sep))return null;
  const [stat,actual]=await Promise.all([lstat(full),realpath(full)]);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4*1024*1024||
    !actual.startsWith(root+sep))return null;
  return readFile(full);
}

export function createPrivateLoopbackPreview({directory,password}={}){
  if(typeof directory!=='string'||directory.length<1||directory.length>1024||
     typeof password!=='string'||password.length<24||password.length>128||
     !/^[\x21-\x7e]+$/.test(password))
    throw new Error('F154: local preview root and strong ASCII password required');
  const root=resolve(directory);
  const expected=digest('reviewer:'+password);
  // Bind is fixed in this factory — no caller-provided host override exists.
  const server=createServer(async(req,res)=>{
    for(const [key,value] of Object.entries(HEADERS))res.setHeader(key,value);
    const listening=server.address();
    if(!listening||typeof listening!=='object'||
       req.headers.host!=='127.0.0.1:'+listening.port){
      send(res,421,'Invalid local preview host');
      return;
    }
    if(!validBasic(req.headers.authorization,expected)){
      res.setHeader('WWW-Authenticate',CHALLENGE);
      send(res,401,'Authentication required');
      return;
    }
    const isHead=req.method==='HEAD';
    if(req.method!=='GET'&&!isHead){
      res.setHeader('Allow','GET, HEAD');
      send(res,405,'Read-only preview',isHead);
      return;
    }
    const route=safeRoute(req.url);
    if(!route){
      send(res,404,'Not found',isHead);
      return;
    }
    if(route.kind==='robots'){
      const bytes=Buffer.from('User-agent: *\nDisallow: /\n','utf8');
      res.setHeader('Content-Type','text/plain; charset=utf-8');
      res.setHeader('Content-Length',String(bytes.byteLength));
      res.statusCode=200;
      res.end(isHead?'':bytes);
      return;
    }
    try{
      const data=await readAllowed(root,route.file);
      if(!data){send(res,404,'Not found',isHead);return;}
      const extension=route.file.slice(route.file.lastIndexOf('.'));
      res.setHeader('Content-Type',types.get(extension)||'application/octet-stream');
      res.setHeader('Content-Length',String(data.byteLength));
      res.statusCode=200;
      res.end(isHead?'':data);
    }catch{
      // File names/paths and any secrets never appear in responses or logs.
      send(res,404,'Not found',isHead);
    }
  });
  return server;
}

export function listenPrivateLoopback(server,port=0){
  if(!server||typeof server.listen!=='function'||
     !Number.isSafeInteger(port)||port<0||port>65535)
    throw new Error('F154: invalid loopback listener');
  // No option to listen on 0.0.0.0, ::, or a public interface.
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'127.0.0.1',()=>{
      server.removeListener('error',reject);
      resolve('http://127.0.0.1:'+server.address().port);
    });
  });
}
