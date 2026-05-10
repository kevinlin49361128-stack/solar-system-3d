import { t } from '../i18n';

declare const L: any;

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;

/**
 * Inject the Leaflet CSS + JS on first call. Resolves once `window.L` is
 * available. Subsequent calls are no-ops (cached promise).
 *
 * Why dynamic vs the previous `<script>` tag in index.html: Leaflet is
 * ~42 KB gz, and the tag was synchronous in <head>, blocking first paint
 * for every visitor — even though only users who click "select on map"
 * ever need it. Loading on demand cuts ~42 KB off initial download.
 */
let leafletPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise<void>((resolve, reject) => {
    // CSS first — link tag in <head>, fire-and-forget (Leaflet works without
    // styles loaded yet, they apply when ready).
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
    // If L is already global (e.g. from a previous call), skip JS load.
    if (typeof (window as { L?: unknown }).L !== 'undefined') {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.crossOrigin = '';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Leaflet CDN load failed'));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

/**
 * Leaflet-based 2D map for picking observation lat/lon. The map and tiles are
 * loaded lazily on first open so the OSM tile service isn't hit on idle.
 */
export class MapPicker {
  private overlay: HTMLElement;
  private container: HTMLElement;
  private coordsEl: HTMLElement;
  private map: any = null;
  private marker: any = null;
  private currentLat: number = 22.6273;
  private currentLon: number = 120.3014;
  private onConfirm: (lat: number, lon: number) => void = () => {};

  constructor() {
    this.overlay = document.getElementById('map-overlay')!;
    this.container = document.getElementById('map-container')!;
    this.coordsEl = document.getElementById('map-coords')!;

    document.getElementById('map-close')!.addEventListener('click', () => this.close());
    document.getElementById('map-confirm')!.addEventListener('click', () => {
      this.onConfirm(this.currentLat, this.currentLon);
      this.close();
    });
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  async open(initialLat: number, initialLon: number, onConfirm: (lat: number, lon: number) => void): Promise<void> {
    this.onConfirm = onConfirm;
    this.currentLat = initialLat;
    this.currentLon = initialLon;
    this.overlay.style.display = 'flex';

    // Show overlay immediately, then load Leaflet (~42 KB gz). On a fresh
    // visit the user sees the modal background appear, then the map fills
    // in after ~200–500 ms. Acceptable for a feature only used once.
    try {
      await loadLeaflet();
    } catch {
      this.coordsEl.textContent = t('mp.loadFail');
      return;
    }

    if (!this.map) {
      this.map = L.map(this.container).setView([initialLat, initialLon], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(this.map);
      this.marker = L.marker([initialLat, initialLon], { draggable: true }).addTo(this.map);

      this.map.on('click', (e: any) => {
        this.setMarker(e.latlng.lat, e.latlng.lng);
      });
      this.marker.on('dragend', () => {
        const ll = this.marker.getLatLng();
        this.setMarker(ll.lat, ll.lng);
      });
    } else {
      this.map.setView([initialLat, initialLon], this.map.getZoom());
      this.marker.setLatLng([initialLat, initialLon]);
    }
    this.updateCoords();
    setTimeout(() => this.map.invalidateSize(), 100);
  }

  close(): void {
    this.overlay.style.display = 'none';
  }

  private setMarker(lat: number, lon: number): void {
    this.currentLat = lat;
    this.currentLon = lon;
    this.marker.setLatLng([lat, lon]);
    this.updateCoords();
  }

  private updateCoords(): void {
    const latStr = `${Math.abs(this.currentLat).toFixed(4)}°${this.currentLat >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(this.currentLon).toFixed(4)}°${this.currentLon >= 0 ? 'E' : 'W'}`;
    this.coordsEl.textContent = `${latStr}, ${lonStr}`;
  }
}
