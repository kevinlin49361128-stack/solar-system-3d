import { Vector3 } from 'three';
import { t } from '../i18n';
import type { SolarSystem } from '../scene/SolarSystem';
import { computeEclipsePath, type EclipsePath, type PathSample } from '../physics/eclipsePath';
import { sunPositionEcliptic } from '../physics/solarPosition';

/**
 * Floating modal that draws a solar-eclipse path on a world map.
 *
 * Rendering: 2D Canvas with equirectangular projection (lat/lon → x/y
 * linear). The world's coastlines are drawn as a simple lat/lon grid
 * + a few continent outlines (~50 KB embedded GeoJSON would be ideal
 * but we keep this minimal — just grid for now; users still see clearly
 * which countries the path crosses since cities can be referenced).
 *
 * The path itself is two polylines:
 *   - Penumbra envelope (lighter colour, wider band)
 *   - Umbra/antumbra centerline + width band (darker, narrower)
 * Plus markers at first/last contact and greatest eclipse.
 */
export class EclipseMap {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private titleEl: HTMLElement;
  private detailsEl: HTMLElement;
  private currentPath: EclipsePath | null = null;

  constructor(private solarSystem: SolarSystem) {
    this.el = document.getElementById('eclipse-map')!;
    this.canvas = document.getElementById('eclipse-map-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.titleEl = document.getElementById('eclipse-map-title')!;
    this.detailsEl = document.getElementById('eclipse-map-details')!;
    document.getElementById('eclipse-map-close')!
      .addEventListener('click', () => this.hide());
  }

  /** Open the map for the given solar-eclipse JD. */
  show(peakJd: number, label: string): void {
    const earth = this.solarSystem.getBody('earth');
    const moon = this.solarSystem.getBody('moon');
    if (!earth?.descriptor.propagator || !moon?.descriptor.propagator) {
      console.warn('EclipseMap: earth or moon propagator missing');
      return;
    }
    // Sun direction: use Meeus AA Ch.25 (~0.01° accuracy) instead of
    // -earthHelio from KeplerPropagator (which has ~0.5–1° drift). The
    // Sun direction's accuracy dominates eclipse-path geographic
    // location since the umbra axis is super-sensitive to it.
    // computeEclipsePath() expects earthHelio = -sun_geocentric, so we
    // negate here.
    const earthHelioAt = (jd: number): Vector3 =>
      sunPositionEcliptic(jd).clone().multiplyScalar(-1);
    const moonGeoAt = (jd: number): Vector3 =>
      moon.descriptor.propagator!.stateAt(jd).position.clone();
    void earth;

    this.currentPath = computeEclipsePath(peakJd, earthHelioAt, moonGeoAt, 3, 1);
    this.titleEl.textContent = label;
    this.el.style.display = '';
    requestAnimationFrame(() => this.draw());
    this.renderDetails();
  }

  hide(): void { this.el.style.display = 'none'; }

  private draw(): void {
    const path = this.currentPath;
    if (!path) return;
    // Resize canvas to its CSS box.
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width, H = rect.height;
    // Equirectangular: lon ∈ [-180,180] → [0,W], lat ∈ [-90,90] → [H,0].
    const project = (lat: number, lon: number) => ({
      x: ((lon + 180) / 360) * W,
      y: ((90 - lat) / 180) * H,
    });

    // Background.
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, W, H);

    // Grid: every 30° lat / 30° lon.
    ctx.strokeStyle = 'rgba(120, 160, 220, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * H;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    for (let lon = -150; lon <= 150; lon += 30) {
      const x = ((lon + 180) / 360) * W;
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    ctx.stroke();

    // Equator emphasised.
    ctx.strokeStyle = 'rgba(180, 200, 230, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
    ctx.stroke();
    // Prime meridian.
    ctx.beginPath();
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
    ctx.stroke();

    // Continent outlines: simple polygonal approximations of major
    // landmasses. Keeps file size minimal vs full GeoJSON.
    drawWorldOutline(ctx, project);

    // Penumbra envelope: shaded band around the centerline.
    const hits = path.samples.filter(s => s.latDeg != null) as Array<PathSample & { latDeg: number; lonDeg: number }>;
    if (hits.length > 0) {
      // Draw penumbra as wide pale band along centerline.
      ctx.strokeStyle = 'rgba(255, 220, 100, 0.18)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      drawPolyline(ctx, project, hits);

      // Umbra centerline + width band.
      ctx.strokeStyle = 'rgba(255, 80, 60, 0.6)';
      ctx.lineWidth = 4;
      drawPolyline(ctx, project, hits);

      // Path direction tick marks every 15 minutes.
      ctx.fillStyle = 'rgba(255, 220, 100, 0.85)';
      ctx.font = '10px sans-serif';
      const startMin = Math.ceil(((hits[0].jd - path.peakJd) * 1440) / 15) * 15;
      const peakMs = path.peakJd;
      hits.forEach(s => {
        const dt = Math.round((s.jd - peakMs) * 1440);
        if (dt % 15 === 0) {
          const p = project(s.latDeg, s.lonDeg);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(`${dt > 0 ? '+' : ''}${dt}m`, p.x + 6, p.y - 4);
        }
      });
      void startMin;
    }

    // Greatest eclipse marker.
    const peakSample = path.samples.find(s => Math.abs(s.jd - path.peakJd) < 1 / 1440 / 2);
    if (peakSample && peakSample.latDeg != null && peakSample.lonDeg != null) {
      const p = project(peakSample.latDeg, peakSample.lonDeg);
      ctx.strokeStyle = '#ffcc40';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffcc40';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(t('em.greatest'), p.x + 12, p.y + 4);
    }
  }

  private renderDetails(): void {
    const path = this.currentPath;
    if (!path) { this.detailsEl.innerHTML = ''; return; }
    const peak = path.samples.find(s => Math.abs(s.jd - path.peakJd) < 1 / 1440 / 2);
    const hits = path.samples.filter(s => s.latDeg != null);
    const firstHit = hits[0];
    const lastHit = hits[hits.length - 1];

    const fmt = (s?: PathSample): string => {
      if (!s) return '—';
      const d = s.date;
      return `${d.toISOString().slice(0, 10)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UT`;
    };
    const fmtLatLon = (s?: PathSample): string => {
      if (!s || s.latDeg == null) return '—';
      const lat = `${Math.abs(s.latDeg).toFixed(1)}°${s.latDeg >= 0 ? 'N' : 'S'}`;
      const lon = `${Math.abs(s.lonDeg!).toFixed(1)}°${s.lonDeg! >= 0 ? 'E' : 'W'}`;
      return `${lat} ${lon}`;
    };

    const typeLabel = path.type === 'total' ? t('em.kind.total')
                    : path.type === 'annular' ? t('em.kind.annular')
                    : t('em.kind.partial');

    this.detailsEl.innerHTML = `
      <div><b>${typeLabel}</b> · 食帶最寬 ${path.maxWidthKm.toFixed(0)} km</div>
      <div style="margin-top:4px;">食甚：${fmt(peak)}<br>位置：${fmtLatLon(peak)}</div>
      <div style="margin-top:4px;">影帶起點：${fmt(firstHit)} @ ${fmtLatLon(firstHit)}</div>
      <div>影帶終點：${fmt(lastHit)} @ ${fmtLatLon(lastHit)}</div>
      <div style="margin-top:6px;color:var(--text-dim);font-size:10px;">
        紅色中心線 = 全食/環食帶；金色 ★ = 食甚位置；標示為距食甚的時間（分鐘）。
      </div>
    `;
  }
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  project: (lat: number, lon: number) => { x: number; y: number },
  samples: Array<{ latDeg: number; lonDeg: number }>,
): void {
  if (samples.length < 2) return;
  ctx.beginPath();
  let first = true;
  let prevLon = samples[0].lonDeg;
  for (const s of samples) {
    // Detect lon wrap (e.g. +179 → −179) and break the polyline so the
    // line doesn't streak across the whole map at the antimeridian.
    if (Math.abs(s.lonDeg - prevLon) > 180) {
      ctx.stroke();
      ctx.beginPath();
      first = true;
    }
    const p = project(s.latDeg, s.lonDeg);
    if (first) { ctx.moveTo(p.x, p.y); first = false; }
    else ctx.lineTo(p.x, p.y);
    prevLon = s.lonDeg;
  }
  ctx.stroke();
}

/**
 * Coarse continental outlines. ~30 closed polygons giving a recognizable
 * world map at low detail (5–10 KB inline data). Just enough that the
 * user can identify which continents the eclipse path crosses.
 */
function drawWorldOutline(
  ctx: CanvasRenderingContext2D,
  project: (lat: number, lon: number) => { x: number; y: number },
): void {
  ctx.strokeStyle = 'rgba(180, 220, 255, 0.4)';
  ctx.fillStyle = 'rgba(180, 220, 255, 0.05)';
  ctx.lineWidth = 1;

  // Each entry is a closed polygon: array of [lat, lon] pairs.
  // Hand-simplified continental outlines, 10–30 vertices each.
  const POLYS: Array<Array<[number, number]>> = [
    // North America
    [[71,-156],[71,-95],[68,-78],[60,-66],[45,-60],[40,-74],[27,-80],[18,-90],
     [22,-105],[32,-115],[48,-125],[60,-140],[70,-160]],
    // South America
    [[12,-72],[5,-50],[-10,-37],[-25,-40],[-40,-58],[-55,-68],[-50,-75],[-23,-72],[-5,-82],[12,-72]],
    // Europe + part of Asia
    [[71,30],[68,55],[55,60],[42,48],[35,28],[36,5],[44,-9],[51,-5],[58,5],[71,30]],
    // Africa
    [[36,10],[32,32],[12,43],[-1,42],[-15,40],[-35,20],[-25,15],[-5,8],[15,-17],[36,-7],[36,10]],
    // Asia (large simplified polygon)
    [[71,80],[78,105],[72,140],[55,140],[45,135],[35,125],[20,110],[8,100],[15,80],[25,68],[40,75],[50,70],[71,80]],
    // Indian subcontinent
    [[35,72],[24,68],[8,77],[15,80],[28,90],[35,72]],
    // Southeast Asia / Indonesia
    [[8,95],[2,100],[-5,108],[-8,118],[-2,135],[5,125],[10,107],[8,95]],
    // Australia
    [[-12,130],[-12,145],[-25,153],[-37,150],[-38,140],[-32,116],[-22,114],[-12,130]],
    // Greenland
    [[83,-30],[78,-15],[68,-25],[60,-40],[68,-55],[78,-50],[83,-30]],
    // Antarctica (top edge only — runs around bottom of map)
    [[-65,-180],[-65,-90],[-70,0],[-65,90],[-65,180]],
    // Japan
    [[45,142],[35,140],[33,131],[40,140],[45,145]],
    // UK + Ireland
    [[58,-7],[55,-2],[51,1],[51,-5],[55,-10],[58,-7]],
    // New Zealand
    [[-35,173],[-41,174],[-46,170],[-42,168],[-37,173]],
    // Madagascar
    [[-12,49],[-25,46],[-25,44],[-15,46],[-12,49]],
  ];

  for (const poly of POLYS) {
    ctx.beginPath();
    let prev = poly[0];
    let first = true;
    for (const [lat, lon] of poly) {
      if (Math.abs(lon - prev[1]) > 180) {
        ctx.stroke(); ctx.fill();
        ctx.beginPath();
        first = true;
      }
      const p = project(lat, lon);
      if (first) { ctx.moveTo(p.x, p.y); first = false; }
      else ctx.lineTo(p.x, p.y);
      prev = [lat, lon];
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}
