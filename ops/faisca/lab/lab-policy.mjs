// A separate laboratory entrypoint. This value never enables the public site.
export const publicFaiscaEnabled = false;
export const labProfile = Object.freeze({
  name: 'faisca-r02-local-review',
  mode: 'guided_demo',
  publicEnabled: false,
  externalCalls: false,
  businessEffects: false,
  authenticatedPostSale: false,
  locale: 'pt-BR'
});

export function requireLabMode(value) {
  if (value !== '1') throw new Error('Faísca laboratory only: set IMAGINE_FAISCA_LAB=1 explicitly.');
  return labProfile;
}
