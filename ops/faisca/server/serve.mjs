import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startHttpLab } from './http-lab.mjs';

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 2) throw new Error('The HTTP laboratory does not accept request-derived or command-line configuration.');
    const value = process.env.IMAGINE_FAISCA_HTTP_PORT ?? '4330';
    if (!/^[0-9]+$/.test(value)) throw new Error('Invalid laboratory port.');
    const scenario = process.env.IMAGINE_FAISCA_HTTP_SCENARIO ?? 'success';
    const lab = await startHttpLab({ enabled: process.env.IMAGINE_FAISCA_HTTP_LAB, port: Number(value), scenario,
      delayMs: scenario === 'timeout' ? 800 : 40 });
    console.log('Faísca HTTP laboratory: ' + lab.origin + '/http/ (loopback, simulated provider, no operational effects).');
    const shutdown = async () => { await lab.close(); };
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  } catch (error) {
    console.error('Faísca HTTP laboratory refused startup: ' + error.message);
    process.exitCode = 1;
  }
}
