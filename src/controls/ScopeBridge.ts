/**
 * INDI / ASCOM telescope bridge — Tier 1 (read-only).
 *
 * The browser can't speak INDI's binary-XML-over-TCP protocol or
 * ASCOM's Windows COM directly. Instead, a tiny local helper
 * (separate repo, future work) translates between the mount and a
 * WebSocket. This class is the browser-side client of that bridge.
 *
 * Wire format is the versioned JSON envelope from
 * docs/future-telescope-bridge.md:
 *
 *   browser → helper:
 *     { v: 1, type: 'subscribe.pointing' }
 *
 *   helper → browser:
 *     { v: 1, type: 'pointing',  ra, dec, at }    // streamed at ~4 Hz
 *     { v: 1, type: 'status',    connected, tracking, parked }
 *     { v: 1, type: 'error',     code, message }
 *
 * Failure modes (helper not running, mount not connected, network
 * glitch) all surface as 'disconnected' and the consumer's pointing
 * callback simply stops being called — nothing in the simulator
 * breaks. That's the whole point of Tier 1 staying read-only.
 *
 * Tier 2 (slew/sync/park) will extend this class with outbound
 * commands; the state-event channel and pointing stream stay shaped
 * the same so we never need to migrate consumers.
 */

export interface PointingFix {
  /** Right ascension, hours (0..24). */
  raHours: number;
  /** Declination, degrees (-90..+90). */
  decDeg: number;
  /** Server timestamp (ms since epoch) when the mount reported it. */
  atMs: number;
}

export type ScopeBridgeState = 'idle' | 'connecting' | 'connected' | 'error';

export class ScopeBridge {
  private ws: WebSocket | null = null;
  private url: string;
  private stateListeners: Array<(s: ScopeBridgeState) => void> = [];
  private pointingListeners: Array<(p: PointingFix) => void> = [];
  private state: ScopeBridgeState = 'idle';
  /** Last successful fix; consumers can poll if they prefer pull-style. */
  private lastFix: PointingFix | null = null;

  constructor(url: string = 'ws://localhost:7624/sim') {
    this.url = url;
  }

  setUrl(url: string): void {
    if (this.url === url) return;
    this.url = url;
    if (this.ws) this.disconnect();
  }

  getState(): ScopeBridgeState { return this.state; }
  getLastFix(): PointingFix | null { return this.lastFix; }
  isConnected(): boolean { return this.state === 'connected'; }

  connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return Promise.resolve();
    this.setState('connecting');
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(this.url);
      } catch (e) {
        this.setState('error');
        reject(e);
        return;
      }
      ws.onopen = () => {
        this.ws = ws;
        this.setState('connected');
        // Ask for pointing stream. Helper is expected to respond with
        // { type: 'pointing', ... } at ~4 Hz.
        try { ws.send(JSON.stringify({ v: 1, type: 'subscribe.pointing' })); } catch { /* swallow */ }
        resolve();
      };
      ws.onmessage = (ev) => {
        // Helper may close the connection if no mount is connected;
        // treat any malformed payload as a no-op so a buggy bridge can't
        // crash the simulator.
        if (typeof ev.data !== 'string') return;
        let msg: unknown;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg || typeof msg !== 'object') return;
        const m = msg as Record<string, unknown>;
        if (m.type !== 'pointing') return;
        const ra = typeof m.ra === 'number' ? m.ra : NaN;
        const dec = typeof m.dec === 'number' ? m.dec : NaN;
        if (!Number.isFinite(ra) || !Number.isFinite(dec)) return;
        const at = typeof m.at === 'number' ? m.at : Date.now();
        const fix: PointingFix = { raHours: ra, decDeg: dec, atMs: at };
        this.lastFix = fix;
        for (const fn of this.pointingListeners) fn(fix);
      };
      ws.onerror = () => {
        // Don't reject here — onclose will fire next and that's where
        // we transition state. If the connection never opened, the
        // outer code's catch sees the 'error' state via onStateChange.
        this.setState('error');
      };
      ws.onclose = () => {
        this.ws = null;
        // Preserve 'error' if onerror set it; otherwise back to idle.
        if (this.state !== 'error') this.setState('idle');
      };
    });
  }

  disconnect(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState <= WebSocket.OPEN) {
      try { ws.close(); } catch { /* ignore */ }
    }
    this.setState('idle');
    this.lastFix = null;
  }

  onState(fn: (s: ScopeBridgeState) => void): () => void {
    this.stateListeners.push(fn);
    return () => {
      const i = this.stateListeners.indexOf(fn);
      if (i >= 0) this.stateListeners.splice(i, 1);
    };
  }

  onPointing(fn: (p: PointingFix) => void): () => void {
    this.pointingListeners.push(fn);
    return () => {
      const i = this.pointingListeners.indexOf(fn);
      if (i >= 0) this.pointingListeners.splice(i, 1);
    };
  }

  private setState(s: ScopeBridgeState): void {
    if (this.state === s) return;
    this.state = s;
    for (const fn of this.stateListeners) fn(s);
  }
}
