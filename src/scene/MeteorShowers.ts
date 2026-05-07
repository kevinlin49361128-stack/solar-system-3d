import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  LineSegments,
  ShaderMaterial,
  Vector3,
} from 'three';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';

const DOME_RADIUS = 4000;

/**
 * Major annual meteor showers. Each entry has its peak day-of-year (DOY),
 * radiant RA/Dec (J2000), and ZHR (zenithal hourly rate at peak under
 * pristine skies). We render meteors as fading line segments shooting
 * outward from the radiant during a ±2-day window around the peak.
 */
export interface ShowerSpec {
  id: string;
  name: string;
  peakDoy: number;     // approximate day of year of peak
  raHours: number;
  decDeg: number;
  zhr: number;         // peak rate
  /**
   * Typical visual colour from spectroscopic observations (chemistry of the
   * parent body's debris). Common emission lines: Na (orange-yellow ~589 nm),
   * Mg (white-blue ~516 nm), Fe (green ~526 nm), Ca (deep blue/violet),
   * organic-rich (warm yellow-red).
   */
  color: [number, number, number];
}

export const SHOWERS: ShowerSpec[] = [
  // Quadrantids: parent (196256) 2003 EH1 — asteroidal, fast, blue-white
  { id: 'qua',  name: 'Quadrantids',  peakDoy:   3, raHours: 15.33, decDeg:  49.5, zhr: 110, color: [0.85, 0.92, 1.00] },
  // Lyrids: parent C/1861 G1 Thatcher — cometary, mixed yellow-white
  { id: 'lyr',  name: 'Lyrids',       peakDoy: 112, raHours: 18.13, decDeg:  33.0, zhr:  18, color: [1.00, 0.95, 0.80] },
  // η Aquariids: Halley debris — fast, blue-white from Mg
  { id: 'eta',  name: 'η Aquariids',  peakDoy: 126, raHours: 22.50, decDeg:  -1.0, zhr:  60, color: [0.80, 0.92, 1.00] },
  // Perseids: 109P/Swift-Tuttle — fast, classic yellow with green Fe trails
  { id: 'per',  name: 'Perseids',     peakDoy: 224, raHours:  3.13, decDeg:  58.0, zhr: 100, color: [1.00, 0.98, 0.70] },
  // Orionids: Halley debris (other ejection) — bright blue-white
  { id: 'ori',  name: 'Orionids',     peakDoy: 294, raHours:  6.30, decDeg:  16.0, zhr:  20, color: [0.85, 0.90, 1.00] },
  // Leonids: 55P/Tempel-Tuttle — exceptionally fast (71 km/s), white-cyan
  { id: 'leo',  name: 'Leonids',      peakDoy: 321, raHours: 10.20, decDeg:  22.0, zhr:  15, color: [0.85, 1.00, 0.95] },
  // Geminids: 3200 Phaethon (asteroidal) — slower, often green from Fe and Mg
  { id: 'gem',  name: 'Geminids',     peakDoy: 348, raHours:  7.50, decDeg:  32.5, zhr: 120, color: [0.65, 1.00, 0.70] },
  // Ursids: 8P/Tuttle — modest, warm yellow
  { id: 'urs',  name: 'Ursids',       peakDoy: 357, raHours: 14.50, decDeg:  76.0, zhr:  10, color: [1.00, 0.90, 0.70] },
];

const MAX_LIVE = 64;             // simultaneous meteor segments
const TRAIL_LIFE_MS = 1200;      // how long one meteor stays on screen
const MAX_TRAINS = 12;           // simultaneous persistent trains
const TRAIN_LIFE_MS = 8000;      // persistent train lifetime (faint glowing wisp)
const TRAIN_PROBABILITY = 0.12;  // ~12 % of meteors leave a train (bright bolides)

interface LiveMeteor {
  origin: Vector3;            // radiant-anchored start point on dome
  end: Vector3;               // streak end direction
  bornAtMs: number;
  color: [number, number, number];
}

interface PersistentTrain {
  origin: Vector3;
  end: Vector3;
  bornAtMs: number;
  color: [number, number, number];
}

/**
 * Animated meteor layer. Tracks current Julian Date → checks active
 * showers → spawns meteors at a rate proportional to combined ZHR. Each
 * meteor is a single LineSegment whose alpha fades over its lifetime.
 */
export class MeteorShowers {
  readonly object: Group;
  private streaks: LineSegments;
  private trains: LineSegments;
  private mat: ShaderMaterial;
  private trainMat: ShaderMaterial;
  private positions: Float32Array;
  private alphas: Float32Array;
  private colors: Float32Array;
  private trainPositions: Float32Array;
  private trainAlphas: Float32Array;
  private trainColors: Float32Array;
  private live: LiveMeteor[] = [];
  private liveTrains: PersistentTrain[] = [];
  private spawnAccumulator = 0;
  private rng = mulberry32(7);

  constructor() {
    this.positions = new Float32Array(MAX_LIVE * 6); // 2 endpoints × 3 components
    this.alphas    = new Float32Array(MAX_LIVE * 2);
    this.colors    = new Float32Array(MAX_LIVE * 6);
    const geom = new BufferGeometry();
    geom.setAttribute('position', new BufferAttribute(this.positions, 3));
    geom.setAttribute('aAlpha',   new BufferAttribute(this.alphas, 1));
    geom.setAttribute('aColor',   new BufferAttribute(this.colors, 3));
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `
        attribute float aAlpha;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = aAlpha;
          vColor = aColor;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          gl_FragColor = vec4(vColor, vAlpha);
        }
      `,
    });
    this.streaks = new LineSegments(geom, this.mat);
    this.streaks.frustumCulled = false;

    // Persistent train layer: faint, longer-lived wisps from bolides.
    this.trainPositions = new Float32Array(MAX_TRAINS * 6);
    this.trainAlphas    = new Float32Array(MAX_TRAINS * 2);
    this.trainColors    = new Float32Array(MAX_TRAINS * 6);
    const trainGeom = new BufferGeometry();
    trainGeom.setAttribute('position', new BufferAttribute(this.trainPositions, 3));
    trainGeom.setAttribute('aAlpha',   new BufferAttribute(this.trainAlphas, 1));
    trainGeom.setAttribute('aColor',   new BufferAttribute(this.trainColors, 3));
    this.trainMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `
        attribute float aAlpha;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = aAlpha;
          vColor = aColor;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          // Trains glow uniformly along the streak path (no head/tail bias)
          // and ramp down toward zero opacity. Slight desaturation toward
          // green-blue mimics the persistent ionized [OI] trail seen on bolides.
          gl_FragColor = vec4(vColor * vec3(0.55, 0.85, 0.70), vAlpha * 0.35);
        }
      `,
    });
    this.trains = new LineSegments(trainGeom, this.trainMat);
    this.trains.frustumCulled = false;

    this.object = new Group();
    this.object.add(this.trains);  // trains underneath streaks
    this.object.add(this.streaks);
    this.object.visible = false;
  }

  setVisible(v: boolean): void {
    this.object.visible = v;
    if (!v) {
      this.live.length = 0;
      this.liveTrains.length = 0;
    }
  }

  /**
   * Advance simulation. Call from the render loop.
   * @param jd current simulated Julian Date
   * @param realMs wall-clock ms since last call (for animation pace)
   */
  update(jd: number, realMs: number): void {
    if (!this.object.visible) return;

    // Day-of-year from JD (approximate, Gregorian).
    const date = new Date((jd - 2440587.5) * 86400000);
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const doy = (date.getTime() - start) / 86400000;

    // Combine active showers' contribution. Each shower contributes a
    // Gaussian-windowed factor of its ZHR (peak ± 3 days).
    let zhrSum = 0;
    let bestSpec: ShowerSpec | null = null;
    let bestWeight = 0;
    for (const s of SHOWERS) {
      const ddoy = Math.min(Math.abs(doy - s.peakDoy), 365 - Math.abs(doy - s.peakDoy));
      const w = Math.exp(-Math.pow(ddoy / 2.5, 2.0));
      zhrSum += s.zhr * w;
      if (w > bestWeight) { bestWeight = w; bestSpec = s; }
    }

    // Spawn rate: 1 meteor / (3600 / zhr) seconds = zhr/3600 per second.
    // Multiply by 30× for visual presence (real ZHRs are sparse over the sky).
    const spawnPerSec = (zhrSum / 3600) * 30;
    this.spawnAccumulator += spawnPerSec * realMs / 1000;
    while (this.spawnAccumulator >= 1 && bestSpec) {
      this.spawnAccumulator -= 1;
      this.spawn(bestSpec);
    }

    // Update live list — drop expired, write attributes.
    const nowMs = performance.now();
    this.live = this.live.filter(m => nowMs - m.bornAtMs < TRAIL_LIFE_MS);
    for (let i = 0; i < MAX_LIVE; i++) {
      const m = this.live[i];
      if (!m) {
        // unused slot — collapse to origin with 0 alpha
        for (let k = 0; k < 6; k++) this.positions[i * 6 + k] = 0;
        this.alphas[i * 2] = 0;
        this.alphas[i * 2 + 1] = 0;
        continue;
      }
      this.positions[i * 6]     = m.origin.x;
      this.positions[i * 6 + 1] = m.origin.y;
      this.positions[i * 6 + 2] = m.origin.z;
      this.positions[i * 6 + 3] = m.end.x;
      this.positions[i * 6 + 4] = m.end.y;
      this.positions[i * 6 + 5] = m.end.z;
      const t = (nowMs - m.bornAtMs) / TRAIL_LIFE_MS;
      const a = Math.max(0, 1 - t);
      this.alphas[i * 2]     = a * 0.0;  // tail starts dim
      this.alphas[i * 2 + 1] = a * 1.0;  // head bright
      // Endpoints share the same colour (from the shower's spectroscopic class).
      const [cr, cg, cb] = m.color;
      this.colors[i * 6]     = cr;
      this.colors[i * 6 + 1] = cg;
      this.colors[i * 6 + 2] = cb;
      this.colors[i * 6 + 3] = cr;
      this.colors[i * 6 + 4] = cg;
      this.colors[i * 6 + 5] = cb;
    }
    (this.streaks.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    (this.streaks.geometry.attributes.aAlpha   as BufferAttribute).needsUpdate = true;
    (this.streaks.geometry.attributes.aColor   as BufferAttribute).needsUpdate = true;

    // Persistent trains — fade over a much longer window than the streaks.
    this.liveTrains = this.liveTrains.filter(t => nowMs - t.bornAtMs < TRAIN_LIFE_MS);
    for (let i = 0; i < MAX_TRAINS; i++) {
      const t = this.liveTrains[i];
      if (!t) {
        for (let k = 0; k < 6; k++) this.trainPositions[i * 6 + k] = 0;
        this.trainAlphas[i * 2] = 0;
        this.trainAlphas[i * 2 + 1] = 0;
        for (let k = 0; k < 6; k++) this.trainColors[i * 6 + k] = 0;
        continue;
      }
      this.trainPositions[i * 6]     = t.origin.x;
      this.trainPositions[i * 6 + 1] = t.origin.y;
      this.trainPositions[i * 6 + 2] = t.origin.z;
      this.trainPositions[i * 6 + 3] = t.end.x;
      this.trainPositions[i * 6 + 4] = t.end.y;
      this.trainPositions[i * 6 + 5] = t.end.z;
      const age = (nowMs - t.bornAtMs) / TRAIN_LIFE_MS;
      const a = Math.max(0, Math.pow(1 - age, 1.5));
      this.trainAlphas[i * 2]     = a;
      this.trainAlphas[i * 2 + 1] = a;
      const [cr, cg, cb] = t.color;
      this.trainColors[i * 6]     = cr;
      this.trainColors[i * 6 + 1] = cg;
      this.trainColors[i * 6 + 2] = cb;
      this.trainColors[i * 6 + 3] = cr;
      this.trainColors[i * 6 + 4] = cg;
      this.trainColors[i * 6 + 5] = cb;
    }
    (this.trains.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    (this.trains.geometry.attributes.aAlpha   as BufferAttribute).needsUpdate = true;
    (this.trains.geometry.attributes.aColor   as BufferAttribute).needsUpdate = true;
  }

  private spawn(spec: ShowerSpec): void {
    if (this.live.length >= MAX_LIVE) this.live.shift();
    // Radiant direction in scene frame.
    const rad = eclipticToScene(raDecToEcliptic(spec.raHours, spec.decDeg)).normalize();
    // Pick a random direction on the dome biased away from radiant by 10–60°
    const offsetDeg = 10 + this.rng() * 50;
    const azAround = this.rng() * Math.PI * 2;
    const start = sampleAround(rad, offsetDeg * Math.PI / 180, azAround);
    // The streak shoots radially away from the radiant, length ~3°.
    const lengthRad = (1 + this.rng() * 3) * Math.PI / 180;
    const endDir = sampleAround(rad, (offsetDeg * Math.PI / 180) + lengthRad, azAround);
    const startScene = start.clone().multiplyScalar(DOME_RADIUS);
    const endScene = endDir.clone().multiplyScalar(DOME_RADIUS);
    this.live.push({
      origin: startScene.clone(),
      end: endScene.clone(),
      bornAtMs: performance.now(),
      color: spec.color,
    });
    // Some bolides leave a persistent ionized train. Capped at MAX_TRAINS;
    // FIFO eviction so newer fireballs always show.
    if (this.rng() < TRAIN_PROBABILITY) {
      if (this.liveTrains.length >= MAX_TRAINS) this.liveTrains.shift();
      this.liveTrains.push({
        origin: startScene.clone(),
        end: endScene.clone(),
        bornAtMs: performance.now(),
        color: spec.color,
      });
    }
  }
}

// Pick a unit vector at angle `theta` from the given axis, with azimuthal angle `phi`.
function sampleAround(axis: Vector3, theta: number, phi: number): Vector3 {
  // Construct an orthonormal basis around `axis`.
  const a = axis.clone().normalize();
  const tmp = Math.abs(a.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const u = new Vector3().crossVectors(a, tmp).normalize();
  const v = new Vector3().crossVectors(a, u).normalize();
  const sinT = Math.sin(theta), cosT = Math.cos(theta);
  return a.clone().multiplyScalar(cosT)
    .addScaledVector(u, sinT * Math.cos(phi))
    .addScaledVector(v, sinT * Math.sin(phi));
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
