import {
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { AU_KM } from '../physics/constants';
import { toast } from '../ui/toast';
import { t } from '../i18n';

/**
 * Procedural fallback (built synchronously in constructor).
 */
const PROC_RADIUS_KM = 30;
const PROC_SEGMENTS = 96;

/**
 * Two-tier LOD parameters. The inner ring is high-detail close to the
 * observer; the outer ring extends much further at lower zoom so the
 * far horizon doesn't drop off into a visible mesh edge.
 *
 *   Inner: zoom 14, 5×5 = ~12 km square, 513 verts/side (~24 m segments)
 *   Outer: zoom 11, 7×7 = ~135 km square, 385 verts/side (~350 m segments)
 *
 * The two meshes share the same observer-centred origin and are drawn in
 * order outer → inner; both fade out via radial alpha so the user only ever
 * sees an opaque overlap (close detail wins) plus a smooth fade-to-sky at
 * the very far horizon (~70 km from the observer).
 */
const INNER_ZOOM = 14;
const INNER_HALF_RANGE = 2;          // 5×5 grid
const INNER_MESH_SEG = 512;          // 513×513 verts
const OUTER_ZOOM = 11;
const OUTER_HALF_RANGE = 3;          // 7×7 grid
const OUTER_MESH_SEG = 384;          // 385×385 verts
const DEM_TILE_PX = 256;

/**
 * Local terrain rendered around the observer in observer mode.
 *
 * Initial state: a procedural sine-noise plane (instant). When `loadForLocation`
 * is called, real-world DEM (AWS Terrarium) and satellite imagery (Esri World
 * Imagery) are fetched and the mesh is swapped in-place. If the network fetch
 * fails, the procedural mesh persists.
 *
 * Tile licensing: AWS Open Terrain (Terrarium) is open data; Esri World Imagery
 * is free for non-commercial use. Cite both if redistributing.
 */
export class LocalTerrain {
  readonly object: Object3D;
  private innerMesh: Mesh;
  private outerMesh: Mesh;
  private loadToken = 0;

  constructor() {
    this.outerMesh = buildProceduralMesh();
    this.innerMesh = buildProceduralMesh();
    // Outer below, inner on top so close-up detail occludes far-LOD wash.
    this.outerMesh.renderOrder = 1;
    this.innerMesh.renderOrder = 2;
    this.object = new Object3D();
    this.object.add(this.outerMesh);
    this.object.add(this.innerMesh);
    this.object.visible = false;
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible;
  }

  /**
   * Position the terrain so its centre sits `eyeHeightAU` *below* the camera
   * along the zenith axis. Setting eye height > 0 keeps the mesh's ground
   * plane below the camera so that looking down actually intersects the
   * mesh face-on (rather than edge-on, which gives an invisible plane).
   * East/north basis orient the X/Z plane (X=east, Z=-north).
   */
  positionAt(
    observerWorldPos: Vector3, zenith: Vector3, east: Vector3, north: Vector3,
    eyeHeightAU: number = 0,
  ): void {
    const groundPos = observerWorldPos.clone().addScaledVector(zenith, -eyeHeightAU);
    this.object.position.copy(groundPos);
    const m = this.object.matrix;
    m.makeBasis(east, zenith, north.clone().multiplyScalar(-1));
    m.setPosition(groundPos);
    this.object.matrixAutoUpdate = false;
    this.object.matrix.copy(m);
    this.object.matrixWorldNeedsUpdate = true;
  }

  /**
   * Async load of real DEM + satellite imagery for the given lat/lon.
   * Both LOD tiers fetch in parallel and swap in independently — the
   * outer ring usually arrives first (cheaper z11 tiles) and gives the
   * user a coarse horizon while the high-detail inner tier finishes.
   */
  async loadForLocation(latDeg: number, lonDeg: number): Promise<void> {
    const token = ++this.loadToken;

    // Web Mercator tile coords go to infinity at the poles (Math.tan blows up
    // around ±90°). Above ~85° we fall back to a single transparent mesh so
    // the user just sees Earth ball + sky rather than a stack of procedural
    // planes z-fighting into a visible band.
    if (Math.abs(latDeg) > 85) {
      this.swapInner(buildPolarPlaceholder(true));
      this.swapOuter(buildPolarPlaceholder(false));
      return;
    }

    const buildTier = async (
      zoom: number, halfRange: number, meshSeg: number, isInner: boolean,
    ): Promise<Mesh | null> => {
      try {
        const { x: cx, y: cy } = lonLatToTileXY(lonDeg, latDeg, zoom);
        const [demGrid, imageryCanvas] = await Promise.all([
          loadDEMGrid(zoom, cx, cy, halfRange),
          loadImageryGrid(zoom, cx, cy, halfRange),
        ]);
        if (token !== this.loadToken) return null;
        const nw = tileXYToLonLat(cx - halfRange, cy - halfRange, zoom);
        const se = tileXYToLonLat(cx + halfRange + 1, cy + halfRange + 1, zoom);
        // Reference elevation at observer's lat/lon → y = 0 in mesh local
        // frame. We re-sample per tier; tiny tier-to-tier offsets at the
        // handoff radius are absorbed by the soft alpha blend.
        const obsElevM = sampleDEM(demGrid, lonDeg, latDeg, nw.lon, se.lon, nw.lat, se.lat);
        return buildDEMMesh(
          demGrid, imageryCanvas,
          latDeg, lonDeg,
          nw.lon, se.lon, nw.lat, se.lat,
          obsElevM, meshSeg, isInner,
        );
      } catch (err) {
        console.warn('LocalTerrain: tier fetch failed', { zoom, err });
        return null;
      }
    };

    const innerP = buildTier(INNER_ZOOM, INNER_HALF_RANGE, INNER_MESH_SEG, true)
      .then(m => { if (m && token === this.loadToken) this.swapInner(m); else if (m) disposeMesh(m); });
    const outerP = buildTier(OUTER_ZOOM, OUTER_HALF_RANGE, OUTER_MESH_SEG, false)
      .then(m => { if (m && token === this.loadToken) this.swapOuter(m); else if (m) disposeMesh(m); });

    const [innerOk, outerOk] = await Promise.all([
      innerP.then(() => true).catch(() => false),
      outerP.then(() => true).catch(() => false),
    ]);
    if (!innerOk && !outerOk) {
      toast.warn(t('toast.terrainFailed'));
    }
  }

  private swapInner(newMesh: Mesh): void {
    this.object.remove(this.innerMesh);
    disposeMesh(this.innerMesh);
    this.innerMesh = newMesh;
    this.innerMesh.renderOrder = 2;
    this.object.add(this.innerMesh);
  }

  private swapOuter(newMesh: Mesh): void {
    this.object.remove(this.outerMesh);
    disposeMesh(this.outerMesh);
    this.outerMesh = newMesh;
    this.outerMesh.renderOrder = 1;
    this.object.add(this.outerMesh);
  }
}

// ---------------------------------------------------------------------------
// Procedural fallback
// ---------------------------------------------------------------------------

function buildProceduralMesh(): Mesh {
  const sizeAU = (PROC_RADIUS_KM * 2) / AU_KM;
  const geom = new PlaneGeometry(sizeAU, sizeAU, PROC_SEGMENTS, PROC_SEGMENTS);
  geom.rotateX(-Math.PI / 2);

  const positions = geom.attributes.position;
  const seed = 1337;
  const noise = (x: number, z: number): number => {
    const a = Math.sin(x * 0.4 + seed) * Math.cos(z * 0.4 + seed * 0.7);
    const b = Math.sin(x * 0.12 + 1.3) * Math.sin(z * 0.18 + 2.1);
    const c = Math.sin(x * 0.05) * Math.cos(z * 0.07);
    return a * 0.05 + b * 0.25 + c * 0.7;
  };
  const heightScaleKm = 1.5;
  for (let i = 0; i < positions.count; i++) {
    const xKm = positions.getX(i) * AU_KM;
    const zKm = positions.getZ(i) * AU_KM;
    const h = noise(xKm * 0.05, zKm * 0.05) * heightScaleKm;
    positions.setY(i, h / AU_KM);
  }
  geom.computeVertexNormals();

  const mat = new MeshStandardMaterial({
    color: new Color(0x2a2620),
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
  });
  return new Mesh(geom, mat);
}

/**
 * Polar fallback mesh used at locations Web Mercator can't represent
 * (|lat| > 85°). Renders a snow plane that:
 *
 *   1. Follows Earth's curvature — vertices drop by d²/(2R) so the outer
 *      tier (67 km radius) curves ~352 m below the observer at its edge.
 *      Without this dip the plane is near-edge-on at 100 m eye height and
 *      barely covers any pixels; the bowl gives it visible depth.
 *   2. Adds light snow undulation (~5 m sastrugi-style noise) so the
 *      surface reads as ground rather than a smooth white wash.
 *   3. Tints toward pale ice-blue radially with mild brightness scatter so
 *      the snow has visible structure at low light angles.
 *
 * Same alpha-fade convention as the DEM mesh — outer feathers into the
 * sky, inner stays mostly opaque to occlude the outer tier near the
 * observer.
 */
function buildPolarPlaceholder(isInner: boolean): Mesh {
  const radiusKm = isInner ? 6 : 67;
  const sizeAU = (radiusKm * 2) / AU_KM;
  const segs = isInner ? 96 : 128;
  const geom = new PlaneGeometry(sizeAU, sizeAU, segs, segs);
  geom.rotateX(-Math.PI / 2);

  // Earth-curvature bowl + snow micro-noise. The bowl is what makes the
  // mesh visible to a 100 m-tall observer; the noise adds reading texture.
  const R_KM = 6371;
  const NOISE_AMP_M = 6;
  const positions = geom.attributes.position;
  const seed = isInner ? 17 : 53;
  for (let i = 0; i < positions.count; i++) {
    const xAU = positions.getX(i);
    const zAU = positions.getZ(i);
    const dKm = Math.hypot(xAU, zAU) * AU_KM;
    const dropKm = (dKm * dKm) / (2 * R_KM);
    const nx = xAU * AU_KM * 0.18 + seed;
    const nz = zAU * AU_KM * 0.18 + seed * 0.7;
    const noiseM =
      Math.sin(nx) * Math.cos(nz) * 0.6 +
      Math.sin(nx * 2.3 + 1.1) * Math.cos(nz * 1.7) * 0.3 +
      Math.sin(nx * 4.7) * Math.sin(nz * 5.1) * 0.1;
    const yKm = -dropKm + (noiseM * NOISE_AMP_M) / 1000;
    positions.setY(i, yKm / AU_KM);
  }
  geom.computeVertexNormals();

  // Bake the radial tint + alpha-fade into a CanvasTexture so we don't need
  // any shader injection (which is fragile — MeshStandardMaterial's vUv
  // varying isn't declared unless a UV-sampled map is present).
  const fadeStart = isInner ? 0.92 : 0.78;
  const fadeEnd   = isInner ? 1.10 : 1.02;
  const tex = buildPolarSnowTexture(fadeStart, fadeEnd);

  // MeshBasicMaterial: the placeholder is meant to read as "ground here"
  // year-round, including polar night when sunlight is below horizon for
  // months. A lit material would go invisible during polar night; basic
  // material self-displays at constant brightness, which is fine for a
  // schematic floor.
  const mat = new MeshBasicMaterial({
    map: tex,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new Mesh(geom, mat);
  // Frustum culling at AU world scale + this tiny mesh radius lands on a
  // float-precision edge case where Three.js intermittently culls the
  // mesh entirely. The mesh is always camera-relative anyway (it follows
  // the observer), so disabling cull is correct and avoids the artifact.
  mesh.frustumCulled = false;
  return mesh;
}

function buildPolarSnowTexture(fadeStart: number, fadeEnd: number): CanvasTexture {
  const SIZE = 512;
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d')!;

  // Per-pixel: distance from centre normalised so 1.0 = mid-edge.
  const img = ctx.createImageData(SIZE, SIZE);
  const half = SIZE / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const r = Math.hypot(dx, dy); // 0 at centre, 1 at side, sqrt(2) at corner
      // Tint: warm-white near observer fading to cool ice-blue at horizon.
      const t = Math.max(0, Math.min(1, r));
      const cr = (1 - t) * 245 + t * 199;
      const cg = (1 - t) * 247 + t * 217;
      const cb = (1 - t) * 250 + t * 235;
      // Fade: opaque inside fadeStart, transparent past fadeEnd.
      let fade = 1;
      if (r >= fadeEnd) fade = 0;
      else if (r > fadeStart) {
        const k = (r - fadeStart) / (fadeEnd - fadeStart);
        fade = 1 - k * k * (3 - 2 * k);
      }
      const i = (y * SIZE + x) * 4;
      img.data[i + 0] = cr;
      img.data[i + 1] = cg;
      img.data[i + 2] = cb;
      img.data[i + 3] = Math.round(fade * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new CanvasTexture(c);
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Tile coordinate math (XYZ Web Mercator)
// ---------------------------------------------------------------------------

function lonLatToTileXY(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

function tileXYToLonLat(x: number, y: number, z: number): { lon: number; lat: number } {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lon, lat: (latRad * 180) / Math.PI };
}

// ---------------------------------------------------------------------------
// Tile fetching (DEM + imagery)
// ---------------------------------------------------------------------------

function fetchImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('tile fetch failed: ' + url));
    img.src = url;
  });
}

interface DEMGrid { elev: Float32Array; W: number; H: number; }

async function loadDEMGrid(z: number, cx: number, cy: number, halfRange: number): Promise<DEMGrid> {
  const N = 2 * halfRange + 1;
  const W = N * DEM_TILE_PX;
  const H = N * DEM_TILE_PX;
  const elev = new Float32Array(W * H);

  // Reusable scratch canvas — Image → ImageData.
  const c = document.createElement('canvas');
  c.width = DEM_TILE_PX;
  c.height = DEM_TILE_PX;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;

  const tasks: Promise<void>[] = [];
  for (let dy = -halfRange; dy <= halfRange; dy++) {
    for (let dx = -halfRange; dx <= halfRange; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;
      tasks.push((async () => {
        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`;
        const img = await fetchImage(url);
        // Decode in a fresh context to avoid races between parallel tasks.
        const lc = document.createElement('canvas');
        lc.width = DEM_TILE_PX;
        lc.height = DEM_TILE_PX;
        const lctx = lc.getContext('2d', { willReadFrequently: true })!;
        lctx.drawImage(img, 0, 0);
        const data = lctx.getImageData(0, 0, DEM_TILE_PX, DEM_TILE_PX).data;
        const xOff = (dx + halfRange) * DEM_TILE_PX;
        const yOff = (dy + halfRange) * DEM_TILE_PX;
        for (let py = 0; py < DEM_TILE_PX; py++) {
          for (let px = 0; px < DEM_TILE_PX; px++) {
            const i = (py * DEM_TILE_PX + px) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            // Terrarium PNG: elev_m = (R*256 + G + B/256) - 32768
            // Clamp bathymetry to sea level so ocean renders as a flat plane —
            // otherwise high-elevation observers (e.g., Mauna Kea at 4205 m) see
            // the surrounding seafloor dip 8000 m below them, producing visible
            // dark "trough" artifacts at the coastline and tile edges.
            const e = r * 256 + g + b / 256 - 32768;
            elev[(yOff + py) * W + (xOff + px)] = e < 0 ? 0 : e;
          }
        }
      })());
    }
  }
  await Promise.all(tasks);
  // Touch ctx so the linter doesn't strip it; the per-task lc/lctx are what
  // actually do the decoding.
  void c; void ctx;
  return { elev, W, H };
}

async function loadImageryGrid(z: number, cx: number, cy: number, halfRange: number): Promise<HTMLCanvasElement> {
  const N = 2 * halfRange + 1;
  const W = N * DEM_TILE_PX;
  const H = N * DEM_TILE_PX;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const tasks: Promise<void>[] = [];
  for (let dy = -halfRange; dy <= halfRange; dy++) {
    for (let dx = -halfRange; dx <= halfRange; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;
      tasks.push((async () => {
        // Esri ArcGIS REST tile URL: /tile/{level}/{row}/{col} = z/y/x
        const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`;
        const img = await fetchImage(url);
        ctx.drawImage(img, (dx + halfRange) * DEM_TILE_PX, (dy + halfRange) * DEM_TILE_PX);
      })());
    }
  }
  await Promise.all(tasks);
  return c;
}

// ---------------------------------------------------------------------------
// Sampling + mesh build
// ---------------------------------------------------------------------------

function sampleDEM(g: DEMGrid, lon: number, lat: number, lonW: number, lonE: number, latN: number, latS: number): number {
  // Linear in lon, inverse-Mercator-ish in lat — at small spans we treat both
  // as linear, which introduces sub-pixel error inside one tile (negligible).
  const u = (lon - lonW) / (lonE - lonW);
  const v = (latN - lat) / (latN - latS);
  return sampleBilinear(g.elev, g.W, g.H, u * (g.W - 1), v * (g.H - 1));
}

function sampleBilinear(arr: Float32Array, W: number, H: number, x: number, y: number): number {
  const x0 = Math.max(0, Math.min(W - 2, Math.floor(x)));
  const y0 = Math.max(0, Math.min(H - 2, Math.floor(y)));
  const tx = x - x0;
  const ty = y - y0;
  const a = arr[y0 * W + x0];
  const b = arr[y0 * W + x0 + 1];
  const c = arr[(y0 + 1) * W + x0];
  const d = arr[(y0 + 1) * W + x0 + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

function buildDEMMesh(
  g: DEMGrid,
  imageryCanvas: HTMLCanvasElement,
  obsLatDeg: number, obsLonDeg: number,
  lonW: number, lonE: number, latN: number, latS: number,
  obsElevM: number,
  meshSeg: number,
  isInner: boolean,
): Mesh {
  // Convert grid extent (degrees) to local metres at observer's latitude.
  // Equirectangular is fine over <100 km.
  const cosLat = Math.cos((obsLatDeg * Math.PI) / 180);
  const widthKm = (lonE - lonW) * 111.32 * cosLat;
  const heightKm = (latN - latS) * 110.54;
  const widthAU = widthKm / AU_KM;
  const heightAU = heightKm / AU_KM;

  const geom = new PlaneGeometry(widthAU, heightAU, meshSeg, meshSeg);
  geom.rotateX(-Math.PI / 2); // normal → +Y (zenith)

  // After rotation: vertex local +X = east, +Z = south (matches positionAt's
  // basis: east, zenith, -north).
  // Plane spans x ∈ [-W/2, +W/2], z ∈ [-H/2, +H/2]; observer should land at (0, 0, 0).
  const obsU = (obsLonDeg - lonW) / (lonE - lonW);  // 0..1, 0=west edge, 1=east
  const obsV = (latN - obsLatDeg) / (latN - latS);  // 0..1, 0=north edge, 1=south
  const shiftX = (0.5 - obsU) * widthAU;
  const shiftZ = (0.5 - obsV) * heightAU;

  const positions = geom.attributes.position;
  const uvs = geom.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    const xAU = positions.getX(i);
    const zAU = positions.getZ(i);
    // Map UNSHIFTED vertex pos to grid u/v.
    const u = (xAU + widthAU / 2) / widthAU;
    const v = (zAU + heightAU / 2) / heightAU;
    const elevM = sampleBilinear(g.elev, g.W, g.H, u * (g.W - 1), v * (g.H - 1));
    positions.setY(i, ((elevM - obsElevM) / 1000) / AU_KM);
    // Now apply observer shift so observer's lat/lon lands at world (0, 0).
    positions.setX(i, xAU + shiftX);
    positions.setZ(i, zAU + shiftZ);
    // Three.js textures default to flipY=true → image y=0 maps to UV v=1.
    // Our grid v=0 is north (top of canvas) → uv v should be 1 there.
    uvs.setXY(i, u, 1 - v);
  }
  geom.attributes.position.needsUpdate = true;
  geom.attributes.uv.needsUpdate = true;
  geom.computeVertexNormals();

  const tex = new CanvasTexture(imageryCanvas);
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;

  const mat = new MeshStandardMaterial({
    map: tex,
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  // Soft radial alpha fade. Inner tier is fully opaque almost edge-to-edge
  // (the outer tier is right behind it, so a wide opaque centre is fine);
  // outer tier feathers out at the perimeter so the far horizon dissolves
  // into the sky / Earth ball instead of presenting a visible mesh edge.
  const fadeStart = isInner ? 0.92 : 0.78;
  const fadeEnd   = isInner ? 1.10 : 1.02;
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       {
         vec2 _c = vMapUv - vec2(0.5);
         float _r = length(_c) * 2.0; // 0 at centre, 1 at edge mid-side
         float _fade = 1.0 - smoothstep(${fadeStart.toFixed(2)}, ${fadeEnd.toFixed(2)}, _r);
         diffuseColor.a *= _fade;
       }`
    );
  };
  return new Mesh(geom, mat);
}

function disposeMesh(m: Mesh): void {
  m.geometry.dispose();
  if (Array.isArray(m.material)) {
    m.material.forEach(mat => disposeMaterial(mat));
  } else {
    disposeMaterial(m.material);
  }
}

function disposeMaterial(mat: any): void {
  if (mat.map && mat.map.dispose) mat.map.dispose();
  if (mat.dispose) mat.dispose();
}
