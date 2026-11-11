#!/usr/bin/env node
/**
 * F154: operator-run local preview. Never binds externally or deploys.
 * Usage after npm run build:
 *   IMAGINE_PREVIEW_PASSWORD="<strong locally generated password>" node scripts/start-private-loopback-preview.mjs
 * Do not place password in repository, .env or shell history.
 */
import {createPrivateLoopbackPreview,listenPrivateLoopback} from '../src/lib/private-loopback-preview.mjs';

const raw=process.env.IMAGINE_PREVIEW_PORT||'4808';
if(!/^[1-9][0-9]{3,4}$/.test(raw)||Number(raw)>65535)
  throw new Error('F154: invalid local preview port');
const server=createPrivateLoopbackPreview({
  directory:'dist',
  password:process.env.IMAGINE_PREVIEW_PASSWORD
});
const localUrl=await listenPrivateLoopback(server,Number(raw));
console.log('F154 private local preview: '+localUrl+' (127.0.0.1 only; NOT a deployment)');
console.log('F154: requires HTTP Basic username reviewer and the operator password; no remote staging access');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
