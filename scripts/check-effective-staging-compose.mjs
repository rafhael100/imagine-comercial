#!/usr/bin/env node
/**
 * F254: PRIVATE operator-only review of Docker Compose's resolved JSON model.
 * Consumes a local stdin pipe, never launches Docker or reads remote hosts.
 * Does not record or echo paths, credentials, hashes, JSON or environment.
 */
import {TextDecoder} from 'node:util';
import {resolve} from 'node:path';
import {reviewEffectivePrivateStagingCompose}
  from '../src/lib/effective-staging-compose-review.mjs';

try{
  if(process.env.GITHUB_ACTIONS==='true'||
     process.env.IMAGINE_PRIVATE_STAGING_REVIEW!=='1'||
     process.argv.length!==2||
     !process.env.IMAGINE_STAGING_NGINX_IMAGE||
     !process.env.IMAGINE_STAGING_HTPASSWD_PATH)
    throw Error('F254: operator-only mode');
  const chunks=[];
  let total=0;
  for await(const part of process.stdin){
    total+=part.length;
    if(total>65536)throw Error('F254: oversized Compose output');
    chunks.push(part);
  }
  if(total<20)throw Error('F254: missing resolved Compose output');
  const input=new TextDecoder('utf-8',{fatal:true})
    .decode(Buffer.concat(chunks,total));
  const report=reviewEffectivePrivateStagingCompose(JSON.parse(input),{
    projectRoot:resolve('.'),
    expectedImage:process.env.IMAGINE_STAGING_NGINX_IMAGE,
    expectedAuthPath:process.env.IMAGINE_STAGING_HTPASSWD_PATH
  });
  console.log(JSON.stringify(report));
}catch{
  console.error('F254: effective private staging Compose not verified (HOLD)');
  process.exitCode=2;
}
