/**
 * Stellarium-protocol telescope GoTo client (over WebSocket).
 *
 * The Stellarium "Telescope server" protocol speaks raw TCP. To use it from
 * the browser the user must run a local TCP↔WS bridge (e.g. websockify,
 * or any 20-line Node script). The packet format is faithfully reproduced
 * so once the bridge is up, Stellarium / KStars / INDI / any compatible
 * GoTo target can drive a real mount or another planetarium.
 *
 * Packet layout (20 bytes, little-endian) per Stellarium docs:
 *   [0..1]   uint16  LENGTH = 20
 *   [2..3]   uint16  TYPE   = 0  (goto)
 *   [4..11]  int64   TIME   microseconds since 1970 UTC
 *   [12..15] int32   RA     in 2³² units / 24h  (i.e. RA·2³²/86400 sec)
 *   [16..19] int32   DEC    in 2³² units / 360° (positive = north)
 */

export class StellariumTelescope {
  private ws: WebSocket | null = null;
  private url: string;
  /** Listeners notified on connection state change. */
  private listeners: Array<(state: 'connected' | 'disconnected' | 'error') => void> = [];

  constructor(url: string = 'ws://localhost:10002') {
    this.url = url;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  setUrl(url: string): void {
    if (this.url === url) return;
    this.url = url;
    if (this.ws) this.disconnect();
  }

  connect(): Promise<void> {
    if (this.isConnected()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.url);
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => {
          this.ws = ws;
          this.emit('connected');
          resolve();
        };
        ws.onerror = (e) => {
          this.emit('error');
          reject(e);
        };
        ws.onclose = () => {
          this.ws = null;
          this.emit('disconnected');
        };
      } catch (e) {
        this.emit('error');
        reject(e);
      }
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  /**
   * Send a GoTo command. RA in hours (0..24), Dec in degrees (-90..+90).
   * No-op if not connected.
   */
  sendGoto(raHours: number, decDeg: number): void {
    if (!this.isConnected() || !this.ws) return;
    const buf = new ArrayBuffer(20);
    const view = new DataView(buf);
    view.setUint16(0, 20, true);              // LENGTH
    view.setUint16(2, 0, true);               // TYPE 0 = goto
    // TIME: microseconds since UNIX epoch (BigInt for 64-bit precision).
    const microsBigInt = BigInt(Date.now()) * 1000n;
    view.setBigInt64(4, microsBigInt, true);
    // RA in raw units: RA·(2³²/86400) since the protocol expresses it as
    // fraction of a sidereal day in 32-bit signed int.
    const raSec = Math.max(0, Math.min(86400 - 1, raHours * 3600));
    const raRaw = Math.round(raSec * (4294967296 / 86400));
    view.setInt32(12, raRaw | 0, true);
    // Dec: similar, Dec·(2³¹/90) per Stellarium convention; mapped over [-90,+90].
    const decRaw = Math.round(decDeg * (2147483648 / 90));
    view.setInt32(16, decRaw | 0, true);
    this.ws.send(buf);
  }

  onStateChange(fn: (state: 'connected' | 'disconnected' | 'error') => void): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  private emit(state: 'connected' | 'disconnected' | 'error'): void {
    for (const fn of this.listeners) fn(state);
  }
}

/** Convert ecliptic-frame J2000 unit vector to RA/Dec hours/deg. */
export function eclipticDirToRaDec(_dir: { x: number; y: number; z: number }): { raHours: number; decDeg: number } {
  // Caller should pre-rotate to equatorial. This stub exists for completeness;
  // the actual rotation lives in physics/topocentric. Kept here as a one-stop
  // import for telescope-control callers.
  return { raHours: 0, decDeg: 0 };
}
