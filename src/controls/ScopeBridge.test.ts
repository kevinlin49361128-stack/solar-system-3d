import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScopeBridge, type PointingFix, type ScopeBridgeState } from './ScopeBridge';

/**
 * Minimal WebSocket stand-in. The bridge only ever calls .send(),
 * .close(), assigns .onopen/.onmessage/.onerror/.onclose, and reads
 * .readyState — so we mock exactly that surface.
 */
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  static CLOSING = 2;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string): void { this.sent.push(data); }
  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(null);
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(null);
  }
  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
  simulateError(): void { this.onerror?.(null); }
  simulateRemoteClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(null);
  }
}

describe('ScopeBridge', () => {
  let realWS: typeof globalThis.WebSocket;
  beforeEach(() => {
    MockWebSocket.instances = [];
    realWS = globalThis.WebSocket;
    // @ts-expect-error — test double satisfies the surface the bridge actually uses.
    globalThis.WebSocket = MockWebSocket;
  });
  afterEach(() => {
    globalThis.WebSocket = realWS;
  });

  it('starts idle and never emits before connect', () => {
    const b = new ScopeBridge();
    expect(b.getState()).toBe('idle');
    expect(b.isConnected()).toBe(false);
    expect(b.getLastFix()).toBeNull();
  });

  it('connects, subscribes, and parses pointing messages', () => {
    const b = new ScopeBridge('ws://localhost:7624/sim');
    const states: ScopeBridgeState[] = [];
    const fixes: PointingFix[] = [];
    b.onState((s) => states.push(s));
    b.onPointing((p) => fixes.push(p));

    void b.connect();
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe('ws://localhost:7624/sim');
    ws.simulateOpen();

    // Bridge should auto-subscribe to pointing on open.
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual({ v: 1, type: 'subscribe.pointing' });

    // Valid pointing message → fix surfaced + cached.
    ws.simulateMessage({ v: 1, type: 'pointing', ra: 5.55, dec: -5.39, at: 1737036000000 });
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toEqual({ raHours: 5.55, decDeg: -5.39, atMs: 1737036000000 });
    expect(b.getLastFix()).toEqual(fixes[0]);

    // State stream: connecting → connected, no spurious extra events.
    expect(states).toEqual(['connecting', 'connected']);
  });

  it('rejects malformed messages without crashing', () => {
    const b = new ScopeBridge();
    const fixes: PointingFix[] = [];
    b.onPointing((p) => fixes.push(p));
    void b.connect();
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    ws.simulateMessage('not json');
    ws.simulateMessage({ v: 1, type: 'unrelated' });
    ws.simulateMessage({ v: 1, type: 'pointing' });                    // no ra/dec
    ws.simulateMessage({ v: 1, type: 'pointing', ra: 'x', dec: 0 });   // wrong type
    ws.simulateMessage({ v: 1, type: 'pointing', ra: NaN, dec: 0 });   // NaN
    expect(fixes).toHaveLength(0);
    expect(b.isConnected()).toBe(true);
  });

  it('returns to idle on clean remote close', () => {
    const b = new ScopeBridge();
    const states: ScopeBridgeState[] = [];
    b.onState((s) => states.push(s));
    void b.connect();
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateRemoteClose();
    expect(states).toEqual(['connecting', 'connected', 'idle']);
    expect(b.isConnected()).toBe(false);
  });

  it('surfaces error state when the WS errors out', () => {
    const b = new ScopeBridge();
    const states: ScopeBridgeState[] = [];
    b.onState((s) => states.push(s));
    void b.connect();
    const ws = MockWebSocket.instances[0];
    ws.simulateError();
    ws.simulateRemoteClose();
    // 'error' must persist through close (not overwritten with 'idle')
    // — the UI relies on this to show "connection failed" until the
    // user retries.
    expect(states).toEqual(['connecting', 'error']);
  });

  it('disconnect() clears the cached fix', () => {
    const b = new ScopeBridge();
    void b.connect();
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ v: 1, type: 'pointing', ra: 1, dec: 2, at: 1 });
    expect(b.getLastFix()).not.toBeNull();
    b.disconnect();
    expect(b.getLastFix()).toBeNull();
    expect(b.getState()).toBe('idle');
  });
});
