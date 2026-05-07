/**
 * Module-level texture defaults. main.ts populates `maxAnisotropy` from the
 * renderer at startup so BodyMesh and friends can apply it without holding
 * a renderer reference.
 *
 * Anisotropic filtering is the single biggest visual upgrade for grazing
 * surface views (e.g. observer-mode looking down at Earth's surface): with
 * the default of 1 the texture is over-blurred at acute angles; setting it
 * to the GPU's max (typically 16) yields sharp ground-level views.
 */
export const TextureConfig = {
  maxAnisotropy: 1,
};
