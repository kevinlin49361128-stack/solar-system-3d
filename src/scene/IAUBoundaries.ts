import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
} from 'three';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';
import { toast } from '../ui/toast';
import { t } from '../i18n';

const DOME_RADIUS = 4000;

interface GeoJSONFeature {
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJSONFC {
  features: GeoJSONFeature[];
}

/**
 * Renders the IAU 1928 official 88 constellation boundary lines from a
 * GeoJSON FeatureCollection (d3-celestial format). RA in degrees, Dec in degrees.
 */
export class IAUBoundaries {
  readonly object: LineSegments;
  private mat: LineBasicMaterial;
  private loaded = false;

  constructor() {
    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(new Float32Array(0), 3));
    this.mat = new LineBasicMaterial({
      color: 0x4a4a6a,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    this.object = new LineSegments(geom, this.mat);
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  async load(url: string): Promise<void> {
    if (this.loaded) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('iau bounds fetch failed: ' + resp.status);
      const data = await resp.json() as GeoJSONFC;
      this.populate(data);
      this.loaded = true;
    } catch (err) {
      console.warn('IAUBoundaries: load failed', url, err);
      toast.warn(t('toast.iauFailed'));
    }
  }

  private populate(data: GeoJSONFC): void {
    const positions: number[] = [];
    for (const feat of data.features) {
      const polygons = feat.geometry.type === 'Polygon'
        ? [feat.geometry.coordinates as number[][][]]
        : (feat.geometry.coordinates as number[][][][]);
      for (const polygon of polygons) {
        for (const ring of polygon) {
          for (let i = 0; i < ring.length - 1; i++) {
            const [raDegA, decDegA] = ring[i];
            const [raDegB, decDegB] = ring[i + 1];
            // d3-celestial RA is in degrees (-180..180); convert to hours (0..24)
            const raHA = ((raDegA + 360) % 360) / 15;
            const raHB = ((raDegB + 360) % 360) / 15;
            // Skip segments that wrap RA boundary (would draw ugly across-sky line)
            if (Math.abs(raDegA - raDegB) > 180) continue;
            const a = eclipticToScene(raDecToEcliptic(raHA, decDegA)).multiplyScalar(DOME_RADIUS);
            const b = eclipticToScene(raDecToEcliptic(raHB, decDegB)).multiplyScalar(DOME_RADIUS);
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        }
      }
    }
    this.object.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.object.geometry.computeBoundingSphere();
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible;
  }

  setOpacity(opacity: number): void {
    this.mat.opacity = opacity * 0.4;
    this.object.visible = opacity > 0.01;
  }
}
