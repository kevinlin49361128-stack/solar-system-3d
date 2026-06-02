/**
 * Screen-space pickers for catalogue overlays (NGC, Sharpless 2, Abell
 * clusters, named stars). Extracted from main.ts so the bootstrap file
 * doesn't carry per-catalogue projection math.
 *
 * Each picker projects the catalogue's RA/Dec onto the camera and
 * returns the entry closest to the cursor within `tolerancePx`, or
 * null. For named stars we prefer the StarMap's cached PM + aberration
 * corrected positions so hit detection matches where the sprite is
 * actually drawn; we fall back to a J2000 projection only on the very
 * first frame before StarMap is ready.
 */
import { Vector3 } from 'three';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';
import { NAMED_STARS, type NamedStar } from '../data/stars';
import type { CameraController } from '../controls/CameraController';
import type { SolarSystem } from '../scene/SolarSystem';

export interface PickerDeps {
  solarSystem: SolarSystem;
  cameraCtl: CameraController;
}

export interface ScreenPickers {
  pickNGCAtScreen(
    clientX: number, clientY: number, rect: DOMRect, tolerancePx: number,
  ): [number, number, number, number, number, number, number] | null;
  pickSharplessAtScreen(
    clientX: number, clientY: number, rect: DOMRect, tolerancePx: number,
  ): [number, number, number, number, number, number] | null;
  pickAbellAtScreen(
    clientX: number, clientY: number, rect: DOMRect, tolerancePx: number,
  ): [number, number, number, number, number, number] | null;
  pickNamedStarAtScreen(
    clientX: number, clientY: number, rect: DOMRect, tolerancePx: number,
  ): NamedStar | null;
}

export function createScreenPickers(deps: PickerDeps): ScreenPickers {
  const { solarSystem, cameraCtl } = deps;

  function pickNGCAtScreen(
    clientX: number, clientY: number, rect: DOMRect, tolerancePx: number,
  ): [number, number, number, number, number, number, number] | null {
    const layer = solarSystem.getNGCFullLayer();
    if (!layer || !layer.isLoaded()) return null;
    const data = layer.getRawData();
    if (data.length === 0) return null;
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const W = rect.width, H = rect.height;
    const v = new Vector3();
    let best: { row: typeof data[number]; dist: number } | null = null;
    for (const row of data) {
      const [, raH, decD] = row;
      const dirEcl = raDecToEcliptic(raH, decD);
      v.copy(eclipticToScene(dirEcl)).multiplyScalar(4000).project(cameraCtl.camera);
      if (v.z > 1 || v.z < -1) continue;
      const sx = (v.x * 0.5 + 0.5) * W;
      const sy = (-v.y * 0.5 + 0.5) * H;
      const d = Math.hypot(sx - cssX, sy - cssY);
      if (d < tolerancePx && (!best || d < best.dist)) {
        best = { row, dist: d };
      }
    }
    return best?.row ?? null;
  }

  function pickSharplessAtScreen(
    clientX: number, clientY: number, rect: DOMRect, tolerancePx: number,
  ): [number, number, number, number, number, number] | null {
    const layer = solarSystem.getSharplessLayer();
    if (!layer || !layer.isLoaded()) return null;
    const data = layer.getRawData();
    if (data.length === 0) return null;
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const W = rect.width, H = rect.height;
    const v = new Vector3();
    let best: { row: typeof data[number]; dist: number } | null = null;
    for (const row of data) {
      const [, raH, decD] = row;
      const dirEcl = raDecToEcliptic(raH, decD);
      v.copy(eclipticToScene(dirEcl)).multiplyScalar(4000).project(cameraCtl.camera);
      if (v.z > 1 || v.z < -1) continue;
      const sx = (v.x * 0.5 + 0.5) * W;
      const sy = (-v.y * 0.5 + 0.5) * H;
      const d = Math.hypot(sx - cssX, sy - cssY);
      if (d < tolerancePx && (!best || d < best.dist)) {
        best = { row, dist: d };
      }
    }
    return best?.row ?? null;
  }

  function pickAbellAtScreen(
    clientX: number, clientY: number, rect: DOMRect, tolerancePx: number,
  ): [number, number, number, number, number, number] | null {
    const layer = solarSystem.getAbellLayer();
    if (!layer || !layer.isLoaded()) return null;
    const data = layer.getRawData();
    if (data.length === 0) return null;
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const W = rect.width, H = rect.height;
    const v = new Vector3();
    let best: { row: typeof data[number]; dist: number } | null = null;
    for (const row of data) {
      const [, raH, decD] = row;
      const dirEcl = raDecToEcliptic(raH, decD);
      v.copy(eclipticToScene(dirEcl)).multiplyScalar(4000).project(cameraCtl.camera);
      if (v.z > 1 || v.z < -1) continue;
      const sx = (v.x * 0.5 + 0.5) * W;
      const sy = (-v.y * 0.5 + 0.5) * H;
      const d = Math.hypot(sx - cssX, sy - cssY);
      if (d < tolerancePx && (!best || d < best.dist)) {
        best = { row, dist: d };
      }
    }
    return best?.row ?? null;
  }

  function pickNamedStarAtScreen(
    clientX: number, clientY: number, rect: DOMRect, tolerancePx: number,
  ): NamedStar | null {
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const W = rect.width, H = rect.height;
    const v = new Vector3();
    let best: { star: NamedStar; dist: number } | null = null;
    const starMap = solarSystem.getStarMap();
    if (starMap) {
      starMap.forEachStarScenePosition((s, pos) => {
        v.copy(pos).project(cameraCtl.camera);
        if (v.z > 1 || v.z < -1) return;
        const sx = (v.x * 0.5 + 0.5) * W;
        const sy = (-v.y * 0.5 + 0.5) * H;
        const d = Math.hypot(sx - cssX, sy - cssY);
        if (d < tolerancePx && (!best || d < best.dist)) {
          best = { star: s, dist: d };
        }
      });
    } else {
      for (const s of NAMED_STARS) {
        const dirEcl = raDecToEcliptic(s.raHours, s.decDeg);
        const dirScene = eclipticToScene(dirEcl).multiplyScalar(4000);
        v.copy(dirScene).project(cameraCtl.camera);
        if (v.z > 1 || v.z < -1) continue;
        const sx = (v.x * 0.5 + 0.5) * W;
        const sy = (-v.y * 0.5 + 0.5) * H;
        const d = Math.hypot(sx - cssX, sy - cssY);
        if (d < tolerancePx && (!best || d < best.dist)) {
          best = { star: s, dist: d };
        }
      }
    }
    return best?.star ?? null;
  }

  return { pickNGCAtScreen, pickSharplessAtScreen, pickAbellAtScreen, pickNamedStarAtScreen };
}
