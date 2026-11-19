/**
 * CLI: validar assinatura de snapshot fornecido pelo responsável.
 * Ex.: node scripts/verify-published-snapshot.mjs snapshot.json portal-public-key.pem
 */
import {readFile,stat} from 'node:fs/promises';
import {verifySignedCatalog} from '../src/lib/verify-signed-catalog.mjs';
const [envelopeFile,publicKeyFile,keyId='portal_key_01']=process.argv.slice(2);
if(!envelopeFile||!publicKeyFile){
  console.error('Usage: node scripts/verify-published-snapshot.mjs snapshot.json portal-public-key.pem [keyId]');
  process.exitCode=2;
}else try{
  const file=await stat(envelopeFile);
  if(!file.isFile()||file.size>2*1024*1024)throw new Error('Input must be a local JSON file <=2MiB');
  const envelope=JSON.parse(await readFile(envelopeFile,'utf8'));
  const pem=await readFile(publicKeyFile,'utf8');
  const snapshot=verifySignedCatalog(envelope,new Map([[keyId,pem]]));
  console.log(JSON.stringify({status:'verified',releaseId:snapshot.releaseId,
    publishedAt:snapshot.publishedAt,publicServices:snapshot.items.length},null,2));
}catch(error){console.error('Catalog signature rejected:',error.message);process.exitCode=1;}
