import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startHttpLab } from '../server/http-lab.mjs';
import { prepareGroundedBridge } from './php-provider.mjs';
import { groundedRespond } from './guide.mjs';

// The host chooses this policy explicitly. HTTP messages cannot activate PHP,
// select a source directory, replace a corpus or choose a process scenario.
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
        process.env.IMAGINE_FAISCA_AGENTS_LAB !== '1' || process.env.IMAGINE_FAISCA_GROUNDED_LAB !== '1' ||
        !process.env.IMAGINE_FAISCA_AGENTS_ROOT) throw new Error('Explicit laboratory configuration required.');
    const port = process.env.IMAGINE_FAISCA_HTTP_PORT ?? '4332';
    if (!/^[0-9]+$/.test(port)) throw new Error('Invalid laboratory port.');
    const scenario = process.env.IMAGINE_FAISCA_AGENTS_SCENARIO ?? 'success';
    const pin = JSON.parse(await readFile(new URL('./pin.json', import.meta.url), 'utf8'));
    bridge = await prepareGroundedBridge({ enabled: '1', agentsRoot: process.env.IMAGINE_FAISCA_AGENTS_ROOT,
      phpBinary: process.env.IMAGINE_FAISCA_PHP_BINARY ?? 'php', pin, scenario,
      delayMs: scenario === 'delay' ? 800 : 0, processDeadlineMs: 3000 });
    lab = await startHttpLab({ enabled: '1', port: Number(port), createProvider: bridge.createProvider,
      prepareTurn: groundedRespond });
    console.log('Faísca R06 laboratory: ' + lab.origin + '/grounded/ (reviewed commercial passages, deterministic PHP).');
    const stop = () => { void shutdown().catch(() => { process.exitCode = 1; }); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch {
    await shutdown();
    console.error('Faísca R06 startup refused. Check laboratory flags, PHP, source hashes and the pinned Agents checkout.');
    process.exitCode = 1;
  }
}
