// Deliberately local. No credentials, SDK, fetch, billing, storage or tools.
export class SimulatedProviderError extends Error {
  constructor(code) {
    super('Simulated provider did not return an answer.');
    this.name = 'SimulatedProviderError';
    this.code = code;
  }
}

export function createSimulatedProvider({ scenario = 'success', delayMs = 40 } = {}) {
  if (!['success', 'unavailable', 'limit', 'timeout', 'malformed'].includes(scenario) ||
      !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 10000) throw new TypeError('Invalid simulated provider configuration.');
  let calls = 0;
  let disposed = false;
  const pending = new Map();
  function respond(_request, { candidate }) {
    if (disposed) return Promise.reject(new SimulatedProviderError('unavailable'));
    calls += 1;
    // timeout deliberately settles late when delayMs exceeds runtime timeoutMs.
    // A caller abort is not proof that a dispatched provider stopped working.
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(timer);
        if (scenario === 'unavailable') reject(new SimulatedProviderError('unavailable'));
        else if (scenario === 'limit') reject(new SimulatedProviderError('provider_limit'));
        else if (scenario === 'malformed') resolve({ ...candidate, text: '<script>invalid response</script>' });
        else resolve(candidate);
      }, delayMs);
      pending.set(timer, reject);
    });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const [timer, reject] of pending) {
      clearTimeout(timer);
      reject(new SimulatedProviderError('unavailable'));
    }
    pending.clear();
  }
  return Object.freeze({ kind: 'simulated', respond, dispose, getCallCount: () => calls });
}
