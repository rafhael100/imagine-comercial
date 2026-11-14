import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,lstatSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
if(process.env.IMAGINE_PRIVATE_PURCHASE_PREVIEW!=='1'||process.argv.length!==4)throw Error('Explicit private simulation opt-in and two paths required');
const input=realpathSync(process.argv[2]);const output=resolve(process.argv[3]);
assert.ok(!existsSync(output),'Output must be new');
assert.ok(!output.startsWith(input+sep)&&output!==input,'Output must be separate');
let count=0,total=0;
function review(path){const info=lstatSync(path);assert.ok(!info.isSymbolicLink(),'No symlinks');if(info.isDirectory()){for(const name of readdirSync(path)){assert.ok(!name.startsWith('.'),'No hidden files');review(resolve(path,name));}}else{assert.ok(info.isFile());count++;total+=info.size;assert.ok(count<500&&total<50*1024*1024&&info.size<5*1024*1024,'Bounded static tree required');}}
review(input);
const original=readFileSync(resolve(input,'index.html'),'utf8');
let html=original;
const bindings={'onepage':'onepage','landing-pages':'landing-pages','gestao-google-ads':'performance','gestao-meta-ads':'performance'};
for(const [slug,offer]of Object.entries(bindings)){
 const pattern=new RegExp('<article\\b[^>]*data-quick-hire="'+slug+'"[^>]*>[\\s\\S]*?</article>','g');
 let cards=0,links=0;
 html=html.replace(pattern,card=>{cards++;return card.replace(/<a\b([^>]*data-quick-hire-action[^>]*)>[\s\S]*?<\/a>/g,(_,attrs)=>{links++;attrs=attrs.replace(/href="[^"]*"/,'href="/simulacao/#'+offer+'"').replace(/\s+target="[^"]*"/,'').replace(/\s+rel="[^"]*"/,'').replace(/aria-label="[^"]*"/,'aria-label="Simular contratação de '+({'onepage':'Onepage','landing-pages':'Landing Page','performance':'Performance'}[offer])+'"');return '<a'+attrs+'>Simular contratação <span aria-hidden="true">→</span></a>';});});
 assert.equal(cards,1,'One matching card required: '+slug);assert.equal(links,1,'One action required: '+slug);
}
assert.notEqual(html,original);
// Preserve the approved hero exactly. Only the four private offer actions and
// an explicit staging notice may differ from the original compiled home.
const hero=/<section\b[^>]*class="[^"]*hero-main[^"]*"[^>]*>[\s\S]*?<\/section>/;
assert.equal(html.match(hero)?.[0],original.match(hero)?.[0]);assert.ok(original.match(hero));
html=html.replace(/<body\b[^>]*>/,body=>body+'<aside aria-label="Ambiente de simulação" style="padding:10px 18px;background:#fff1dd;color:#5b3200;text-align:center;font:600 13px/1.5 system-ui">Ambiente de teste · Onepage, Landing Page e Performance têm contratação simulada. Sem conta, contrato ou pagamento real.</aside>');
const simulation=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'index.html'),'utf8');
assert.ok(simulation.includes("connect-src 'none'")&&simulation.includes('SIMULAÇÃO · SEM COBRANÇA'));
mkdirSync(output,{recursive:false});cpSync(input,output,{recursive:true,errorOnExist:true});
mkdirSync(resolve(output,'simulacao'));writeFileSync(resolve(output,'simulacao/index.html'),simulation);
writeFileSync(resolve(output,'index.html'),html);
assert.equal(readFileSync(resolve(input,'index.html'),'utf8'),original,'Source build unchanged');
console.log(JSON.stringify({privateSimulationPrepared:true,modifiedOfferActions:4,realCheckoutEnabled:false,realDataConnections:false,publicReleaseApproved:false}));
