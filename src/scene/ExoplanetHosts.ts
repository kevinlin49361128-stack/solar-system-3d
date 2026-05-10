import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { EXOPLANET_SYSTEMS, type ExoplanetSystemMeta } from '../data/exoplanetSystems';
import { DEG2RAD } from '../physics/constants';
import { langPick, onLanguageChange } from '../i18n';

/**
 * Halo + label sprites for the 12 curated exoplanet host stars,
 * positioned in HYG-cloud frame coordinates (1 ly = 1 scene unit,
 * Sun at origin) so they coexist with the local stellar
 * neighbourhood point cloud.
 *
 * Each host gets:
 *   - a coloured ring sprite (the "halo") that draws the user's eye and
 *     serves as the click target
 *   - a faint text label with the system name
 *
 * Picking: every halo mesh has `userData.exoplanetSystemId` set so the
 * existing main.ts raycast pipeline can resolve a hit back to a system.
 *
 * Visibility: gated by the ScaleTierController. Hidden at the system
 * tier (would clutter the solar-system view), visible at the
 * neighbourhood tier, fades out at the galactic tier (where the
 * 4-arm disk dominates).
 */

interface HostEntry {
  meta: ExoplanetSystemMeta;
  position: Vector3;       // scene units (= ly), in HYG equatorial frame
  haloMesh: Mesh;
  /** Invisible filled-disc with the same userData; provides a generous
   *  click target so the empty centre of the visible ring still picks. */
  hitMesh: Mesh;
  labelSprite: Sprite;
}

export class ExoplanetHosts {
  readonly group = new Group();
  readonly pickables: Mesh[] = [];
  private entries: HostEntry[] = [];

  constructor() {
    for (const sys of EXOPLANET_SYSTEMS) {
      const pos = equatorialToCartesianLy(sys.raHours, sys.decDeg, sys.distanceLy);

      // Ring halo — tinted by host distance bracket so the user can
      // tell at a glance which are nearby (Proxima, α Cen) vs far
      // (Kepler-90 at 2840 ly).
      const haloColor = haloColourForDistance(sys.distanceLy);
      const haloGeom = new RingGeometry(0.6, 1.1, 32);
      const haloMat = new MeshBasicMaterial({
        color: haloColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: 2, // DoubleSide
        blending: AdditiveBlending,
      });
      const halo = new Mesh(haloGeom, haloMat);
      halo.position.copy(pos);
      halo.userData.exoplanetSystemId = sys.id;
      // Scale halos by visual distance so they stay legible at any tier
      // without being parsed as physical sizes.
      const halooScale = 0.5 + Math.log10(sys.distanceLy + 1) * 0.6;
      halo.scale.setScalar(halooScale);
      this.group.add(halo);

      // Invisible filled-disc hit area, slightly larger than the visible
      // ring. The ring itself has an empty centre — clicking the middle
      // of the halo would otherwise raycast straight through. With this
      // disc the entire halo (interior included) is clickable.
      const hitGeom = new CircleGeometry(1.2, 32);
      const hitMat = new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,    // invisible; only used for hit-testing
        depthWrite: false,
        side: 2,       // DoubleSide
      });
      const hit = new Mesh(hitGeom, hitMat);
      hit.position.copy(pos);
      hit.userData.exoplanetSystemId = sys.id;
      hit.scale.setScalar(halooScale);
      this.group.add(hit);
      this.pickables.push(hit);

      // Text label
      const labelTex = makeLabelTexture(localiseShort(sys), haloColor);
      const labelMat = new SpriteMaterial({
        map: labelTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const label = new Sprite(labelMat);
      label.position.copy(pos).add(new Vector3(0, halooScale * 1.4, 0));
      label.scale.set(halooScale * 4, halooScale * 1.0, 1);
      this.group.add(label);

      this.entries.push({ meta: sys, position: pos.clone(), haloMesh: halo, hitMesh: hit, labelSprite: label });
    }
    this.group.visible = false;

    // Rebuild every host's label texture when the UI language changes.
    // The cache is keyed on (text, colour); since the text changes, we
    // also clear it so old per-language entries don't leak across
    // switches.
    onLanguageChange(() => {
      labelCache.clear();
      for (const e of this.entries) {
        const haloColor = haloColourForDistance(e.meta.distanceLy);
        const oldMat = e.labelSprite.material as SpriteMaterial;
        const oldOpacity = oldMat.opacity;
        oldMat.map?.dispose();
        oldMat.dispose();
        const newTex = makeLabelTexture(localiseShort(e.meta), haloColor);
        e.labelSprite.material = new SpriteMaterial({
          map: newTex,
          transparent: true,
          opacity: oldOpacity,
          depthWrite: false,
        });
      }
    });
  }

  /** Per-frame opacity. opacity < 0.02 hides the group entirely. */
  setOpacity(opacity: number): void {
    const o = Math.max(0, Math.min(1, opacity));
    this.group.visible = o > 0.02;
    for (const e of this.entries) {
      (e.haloMesh.material as MeshBasicMaterial).opacity = o * 0.85;
      (e.labelSprite.material as SpriteMaterial).opacity = o;
    }
  }

  /**
   * Per-frame: rotate halos to face the camera (billboard behaviour) and
   * keep a stable apparent angular size as the camera retreats.
   */
  update(cameraPos: Vector3): void {
    if (!this.group.visible) return;
    for (const e of this.entries) {
      // Halo + invisible hit-disc face the camera together (so the
      // disc covers the visible ring no matter the viewing angle).
      e.haloMesh.lookAt(cameraPos);
      e.hitMesh.lookAt(cameraPos);
      // Distance from camera in scene units. Scale up linearly with
      // distance so the halo's screen size stays roughly constant.
      const dist = e.haloMesh.position.distanceTo(cameraPos);
      const baseScale = 0.5 + Math.log10(e.meta.distanceLy + 1) * 0.6;
      const distFactor = Math.max(1, dist / 30);
      e.haloMesh.scale.setScalar(baseScale * distFactor);
      e.hitMesh.scale.setScalar(baseScale * distFactor);
      e.labelSprite.scale.set(baseScale * distFactor * 4, baseScale * distFactor * 1.0, 1);
      // Keep label above the halo even after rescale.
      e.labelSprite.position.copy(e.position).add(new Vector3(0, baseScale * distFactor * 1.4, 0));
    }
  }

  resolvePick(userData: { exoplanetSystemId?: string }): ExoplanetSystemMeta | null {
    if (!userData?.exoplanetSystemId) return null;
    return EXOPLANET_SYSTEMS.find(s => s.id === userData.exoplanetSystemId) ?? null;
  }
}

/**
 * Convert (ra hours, dec degrees, distance light-years) into a Cartesian
 * scene position (still in equatorial frame; the HYG cloud uses the same
 * convention so the host halos overlay the cloud's stars correctly).
 */
function equatorialToCartesianLy(raHours: number, decDeg: number, distanceLy: number): Vector3 {
  const raRad = raHours * 15 * DEG2RAD;     // hours → degrees → radians
  const decRad = decDeg * DEG2RAD;
  const cosDec = Math.cos(decRad);
  return new Vector3(
    distanceLy * cosDec * Math.cos(raRad),
    distanceLy * cosDec * Math.sin(raRad),
    distanceLy * Math.sin(decRad),
  );
}

/**
 * Very-near (< 10 ly) hosts get a warm gold; ≤ 100 ly cyan; further out
 * a dim purple. This matches sky-survey colour conventions for distance
 * tiers and gives the user a quick read on which systems are local.
 */
function haloColourForDistance(distanceLy: number): number {
  if (distanceLy < 10)   return 0xffd25c;
  if (distanceLy < 100)  return 0x7ddff5;
  if (distanceLy < 1000) return 0xa088ff;
  return 0x6a72b0;
}

/**
 * Build a small canvas texture for the host's name label. Cached per
 * (text, color) pair so repeat construction doesn't allocate.
 */
const labelCache = new Map<string, CanvasTexture>();
function makeLabelTexture(text: string, colour: number): CanvasTexture {
  const key = `${text}:${colour.toString(16)}`;
  const cached = labelCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `#${colour.toString(16).padStart(6, '0')}`;
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, 128, 32);
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  labelCache.set(key, tex);
  return tex;
}

/**
 * Pick a short string for the host label — uses zh-Hant by default but
 * falls back to nameEn since label space is tight.
 */
function localiseShort(s: ExoplanetSystemMeta): string {
  // Strip "(...)" annotations for compactness.
  return langPick(s.name).replace(/\s*\(.+?\)\s*/g, '').trim();
}
// Re-export for callers wanting to instantiate manually.
void Color;
