/**
 * R172: on the authorized POSIX operator host, Git metadata checks must not
 * inherit OPENAI_API_KEY, review tokens, evidence pins or arbitrary GIT_*
 * variables. No shell, network, hooks, fsmonitor or mutable Git config.
 * Missing /usr/bin/git fails closed rather than searching operator PATH.
 */
export function createFaiscaIsolatedGitInvocation() {
  return Object.freeze({
    executable: '/usr/bin/git',
    prefix: Object.freeze([
      '-c', 'core.fsmonitor=false',
      '-c', 'core.hooksPath=/dev/null',
      '-c', 'core.untrackedCache=false'
    ]),
    env: Object.freeze({
      LANG: 'C',
      LC_ALL: 'C',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_TERMINAL_PROMPT: '0'
    })
  });
}
