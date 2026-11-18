import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startHttpLab } from '../server/http-lab.mjs';
import { prepareAgentsBridge } from './php-provider.mjs';

// Separate explicit entrypoint. The existing R04 server remains a standalone
// browser/Node simulator; no request can turn that server into a PHP launcher.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  let bridge, lab, stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await lab?.close();
    await bridge?.close();
  };
  try {
    if (process.argv.length !== 2 || process.env.IMAGINE_FAISCA_HTTP_LAB !== '1' ||
        process.env.IMAGINE_FAISCA_AGENTS_LAB !== '1' || !process.env.IMAGINE_FAISCA_AGENTS_ROOT) {
      throw new Error('Explicit HTTP and Agents laboratory configuration required.');
    }
    const port = process.env.IMAGINE_FAISCA_HTTP_PORT ?? '4331';
    if (!/^[0-9]+$/.test(port)) throw new Error('Invalid laboratory port.');
    const scenario = process.env.IMAGINE_FAISCA_AGENTS_SCENARIO ?? 'success';
    const pin = JSON.parse(await readFile(new URL('./pin.json', import.meta.url), 'utf8'));
    bridge = await prepareAgentsBridge({ enabled: '1', agentsRoot: process.env.IMAGINE_FAISCA_AGENTS_ROOT,
      phpBinary: process.env.IMAGINE_FAISCA_PHP_BINARY ?? 'php', pin, scenario,
      delayMs: scenario === 'delay' ? 800 : 0, processDeadlineMs: 3000 });
    lab = await startHttpLab({ enabled: '1', port: Number(port), createProvider: bridge.createProvider });
    console.log('Faísca R05 laboratory: ' + lab.origin + '/http/ (pinned PHP Agents, synthetic suggestions).');
    const stop = () => { void shutdown().catch(() => { process.exitCode = 1; }); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch {
    await shutdown();
    console.error('Faísca R05 startup refused. Check explicit laboratory flags, PHP and the pinned Agents checkout.');
    process.exitCode = 1;
  }
}
