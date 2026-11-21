import { isAbsolute, resolve, sep } from 'node:path';

/**
 * R179: a replay registry is an independent persistent operator volume.
 * It MUST NOT be inside, equal to, or an ancestor of the Git checkout or
 * the mutable evidence directory. Otherwise a successful signed report could
 * mutate an already-verified checkout/evidence after the final consistency
 * check. Actual directory ownership/symlinks are additionally fenced by
 * R177's POSIX O_NOFOLLOW/realpath/fsync guard.
 */
export function hasFaiscaSeparatedIndependentNonceDirectory({
  checkout, evidence, directory
} = {}) {
  const valid = value => typeof value === 'string' && value.length > 1 &&
    value.length <= 4096 && !value.includes('\0') &&
    isAbsolute(value) && resolve(value) === value;
  if (![checkout, evidence, directory].every(valid)) return false;
  const nested = (child, parent) =>
    child === parent || child.startsWith(parent === sep ? sep : parent + sep);
  return !nested(directory, checkout) && !nested(checkout, directory) &&
    !nested(directory, evidence) && !nested(evidence, directory);
}
