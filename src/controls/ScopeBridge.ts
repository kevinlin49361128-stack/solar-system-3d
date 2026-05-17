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

/**
 * Slew lifecycle events surfaced from the helper.
 *  - 'start':   helper accepted the slew, mount is moving.
 *  - 'progress': periodic update, `remainingDeg` shrinking toward 0.
 *  - 'done':    mount is on target. `ra`/`dec` echo the final pointing.
 *  - 'error':   slew failed (over limit, parked, software error, etc.).
 *  - 'aborted': caller-requested stop (panic button or new slew issued).
 */
export type SlewEvent =
  | { type: 'start';    raHours: number; decDeg: number }
  | { type: 'progress'; remainingDeg: number }
  | { type: 'done';     raHours: number; decDeg: number }
  | { type: 'error';    code: string; message: string }
  | { type: 'aborted' };

/**
 * Caller-side guardrails enforced *before* we ever send a slew over the
 * wire. The bridge helper / mount driver enforce their own limits too,
 * but defence-in-depth is essential when a buggy line of code could
 * whip a 30 kg mount into the meridian-flip wall.
 */
export interface SlewSafety {
  /** Maximum allowed angular jump in a single slew, degrees. The user
   *  picks this in the Realism panel; default is conservative. */
  maxSlewDeg: number;
  /** Hard floor on declination — refuse slews below this altitude
   *  proxy (i.e. don't slew to anything in the southern hemisphere if
   *  the user is in the northern hemisphere with a tracking mount that
   *  hits the pier). Default: no floor. */
  minDecDeg: number | null;
  /** Hard ceiling on declination. Default: no ceiling. */
  maxDecDeg: number | null;
}

export const DEFAULT_SAFETY: SlewSafety = {
  maxSlewDeg: 90,
  minDecDeg: null,
  maxDecDeg: null,
};

export class ScopeBridge {
  private ws: WebSocket | null = null;
  private url: string;
  private stateListeners: Array<(s: ScopeBridgeState) => void> = [];
  private pointingListeners: Array<(p: PointingFix) => void> = [];
  private slewListeners: Array<(e: SlewEvent) => void> = [];
  private state: ScopeBridgeState = 'idle';
  /** Last successful fix; consumers can poll if they prefer pull-style. */
  private lastFix: PointingFix | null = null;
  /** Tier-2 safety: outbound slew commands gated on `controlEnabled === true`.
   *  Default OFF so the read-only path (Tier 1) is unaffected. */
  private controlEnabled = false;
  private safety: SlewSafety = { ...DEFAULT_SAFETY };
  /** True between sending a slew and receiving slew.done / slew.error /
   *  aborted. Used to gate concurrent slews + power the panic stop. */
  private slewActive = false;

  constructor(url: string = 'ws://localhost:7624/sim') {
    this.url = url;
  }

  /** Tier-2 master gate. Even when true, every slew is still range-checked
   *  against `safety` below. */
  setControlEnabled(on: boolean): void { this.controlEnabled = on; }
  isControlEnabled(): boolean { return this.controlEnabled; }
  setSafety(s: Partial<SlewSafety>): void {
    this.safety = { ...this.safety, ...s };
  }
  getSafety(): SlewSafety { return { ...this.safety }; }
  isSlewing(): boolean { return this.slewActive; }

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
        switch (m.type) {
          case 'pointing': {
            const ra = typeof m.ra === 'number' ? m.ra : NaN;
            const dec = typeof m.dec === 'number' ? m.dec : NaN;
            if (!Number.isFinite(ra) || !Number.isFinite(dec)) return;
            const at = typeof m.at === 'number' ? m.at : Date.now();
            const fix: PointingFix = { raHours: ra, decDeg: dec, atMs: at };
            this.lastFix = fix;
            for (const fn of this.pointingListeners) fn(fix);
            return;
          }
          case 'slew.start': {
            const ra = typeof m.ra === 'number' ? m.ra : NaN;
            const dec = typeof m.dec === 'number' ? m.dec : NaN;
            if (!Number.isFinite(ra) || !Number.isFinite(dec)) return;
            this.slewActive = true;
            this.emitSlew({ type: 'start', raHours: ra, decDeg: dec });
            return;
          }
          case 'slew.progress': {
            const rem = typeof m.remainingDeg === 'number' ? m.remainingDeg : NaN;
            if (!Number.isFinite(rem)) return;
            this.emitSlew({ type: 'progress', remainingDeg: rem });
            return;
          }
          case 'slew.done': {
            const ra = typeof m.ra === 'number' ? m.ra : NaN;
            const dec = typeof m.dec === 'number' ? m.dec : NaN;
            if (!Number.isFinite(ra) || !Number.isFinite(dec)) return;
            this.slewActive = false;
            this.emitSlew({ type: 'done', raHours: ra, decDeg: dec });
            return;
          }
          case 'slew.error':
          case 'error': {
            const code = typeof m.code === 'string' ? m.code : 'UNKNOWN';
            const message = typeof m.message === 'string' ? m.message : 'Unknown error';
            this.slewActive = false;
            this.emitSlew({ type: 'error', code, message });
            return;
          }
          case 'slew.aborted': {
            this.slewActive = false;
            this.emitSlew({ type: 'aborted' });
            return;
          }
          // status / other types ignored for now — Tier 2 doesn't need
          // them in the UI yet, but the helper may send them for
          // diagnostics.
        }
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

  onSlew(fn: (e: SlewEvent) => void): () => void {
    this.slewListeners.push(fn);
    return () => {
      const i = this.slewListeners.indexOf(fn);
      if (i >= 0) this.slewListeners.splice(i, 1);
    };
  }

  /**
   * Issue a GoTo slew to (raHours, decDeg). Returns a SlewGate enum
   * describing why the request was (or wasn't) sent — callers should
   * surface 'ok' as "sent" and any other code as a banner/toast.
   *
   * Layered checks, in order:
   *  1. Bridge connected? — pre-condition.
   *  2. Tier-2 control gate enabled? — user-acknowledged risk.
   *  3. Within safety envelope? — declination clamps + max angular jump.
   *  4. Already slewing? — refuse concurrent slews; user can hit Stop.
   */
  slew(raHours: number, decDeg: number): SlewGate {
    if (!this.isConnected() || !this.ws) return 'not-connected';
    if (!this.controlEnabled) return 'control-disabled';
    if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) return 'bad-coords';
    if (raHours < 0 || raHours >= 24) return 'bad-coords';
    if (decDeg < -90 || decDeg > 90) return 'bad-coords';
    if (this.safety.minDecDeg != null && decDeg < this.safety.minDecDeg) return 'dec-floor';
    if (this.safety.maxDecDeg != null && decDeg > this.safety.maxDecDeg) return 'dec-ceiling';
    // Estimate angular jump from last known pointing. If we have no fix
    // yet we skip the cap — first slew after connect is the calibration
    // slew. (Defensible: the user just typed "go here", and the helper
    // / mount driver still enforces hardware limits.)
    if (this.lastFix) {
      const jump = angularSeparationDeg(
        this.lastFix.raHours, this.lastFix.decDeg, raHours, decDeg,
      );
      if (jump > this.safety.maxSlewDeg) return 'slew-too-large';
    }
    if (this.slewActive) return 'already-slewing';
    try {
      this.ws.send(JSON.stringify({ v: 1, type: 'slew', ra: raHours, dec: decDeg }));
    } catch {
      return 'send-failed';
    }
    this.slewActive = true;
    return 'ok';
  }

  /**
   * Tell the mount its current pointing IS (raHours, decDeg) — alignment /
   * plate-solve sync, not a physical motion. Same gating as slew() but
   * skips the max-jump check (sync is by definition local).
   */
  sync(raHours: number, decDeg: number): SlewGate {
    if (!this.isConnected() || !this.ws) return 'not-connected';
    if (!this.controlEnabled) return 'control-disabled';
    if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) return 'bad-coords';
    try {
      this.ws.send(JSON.stringify({ v: 1, type: 'sync', ra: raHours, dec: decDeg }));
    } catch {
      return 'send-failed';
    }
    return 'ok';
  }

  /** Panic stop — abort any in-flight slew. Available even when control is
   *  disabled, because by the time you reach for it you want it to work. */
  abort(): SlewGate {
    if (!this.isConnected() || !this.ws) return 'not-connected';
    try {
      this.ws.send(JSON.stringify({ v: 1, type: 'abort' }));
    } catch {
      return 'send-failed';
    }
    // Don't clear slewActive locally — wait for the helper's 'aborted'
    // event to confirm. That way the UI button stays visible until the
    // mount actually stopped.
    return 'ok';
  }

  park(): SlewGate {
    if (!this.isConnected() || !this.ws) return 'not-connected';
    if (!this.controlEnabled) return 'control-disabled';
    try { this.ws.send(JSON.stringify({ v: 1, type: 'park' })); }
    catch { return 'send-failed'; }
    return 'ok';
  }

  unpark(): SlewGate {
    if (!this.isConnected() || !this.ws) return 'not-connected';
    if (!this.controlEnabled) return 'control-disabled';
    try { this.ws.send(JSON.stringify({ v: 1, type: 'unpark' })); }
    catch { return 'send-failed'; }
    return 'ok';
  }

  private setState(s: ScopeBridgeState): void {
    if (this.state === s) return;
    this.state = s;
    for (const fn of this.stateListeners) fn(s);
  }

  private emitSlew(e: SlewEvent): void {
    for (const fn of this.slewListeners) fn(e);
  }
}

export type SlewGate =
  | 'ok'
  | 'not-connected'
  | 'control-disabled'
  | 'bad-coords'
  | 'dec-floor'
  | 'dec-ceiling'
  | 'slew-too-large'
  | 'already-slewing'
  | 'send-failed';

/**
 * Great-circle angular separation between two equatorial points, degrees.
 * Standard spherical-law-of-cosines formula; clamped to [-1,1] so
 * floating drift can't NaN the acos.
 */
function angularSeparationDeg(
  ra1H: number, dec1D: number, ra2H: number, dec2D: number,
): number {
  const D2R = Math.PI / 180;
  const H2R = Math.PI / 12;
  const phi1 = dec1D * D2R, phi2 = dec2D * D2R;
  const dLam = (ra2H - ra1H) * H2R;
  const cosc = Math.sin(phi1) * Math.sin(phi2)
             + Math.cos(phi1) * Math.cos(phi2) * Math.cos(dLam);
  return Math.acos(Math.max(-1, Math.min(1, cosc))) / D2R;
}
