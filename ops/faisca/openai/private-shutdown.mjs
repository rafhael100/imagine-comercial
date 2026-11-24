// Private operator shutdown: socket drain alone is not proof of a safe ledger.
// No provider calls, retries, credential access or recovery mutations.
export function createFaiscaPrivateShutdown({ server, ledger, report = () => {} }) {
  let shutdown;
  return function stop() {
    if (shutdown) return shutdown;
    shutdown = Promise.resolve().then(async () => {
      let safe = false;
      try {
        await server.close();
        // close() drains HTTP and durable ACK/fence promises. Its resolution
        // alone cannot distinguish a latched uncertain provider completion.
        const state = server.inspect();
        safe = state.active === false && state.inFlight === false &&
          state.providerUnavailable === false && await ledger.ready() === true;
      } catch {
        // Never print provider, filesystem or injected error details.
      }
      const status = safe ? 'PRIVATE_SHUTDOWN_LOCAL_DRAIN_VERIFIED'
        : 'PRIVATE_SHUTDOWN_RECONCILIATION_REQUIRED';
      report(status);
      return safe ? 0 : 1;
    });
    return shutdown;
  };
}
