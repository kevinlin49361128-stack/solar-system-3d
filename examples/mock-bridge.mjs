#!/usr/bin/env node
/**
 * Mock INDI / ASCOM telescope bridge — stand-in for the real helper
 * app that's planned as a separate repo (see
 * docs/future-telescope-bridge.md). Lets you exercise the browser's
 * scope-bridge UI without actually owning a mount.
 *
 * Behaviour
 * ---------
 * - Listens on ws://localhost:7624/sim by default (port configurable
 *   via the BRIDGE_PORT env var).
 * - On any client `{type:'subscribe.pointing'}` message, starts
 *   pushing `{type:'pointing', ra, dec, at}` at 4 Hz.
 * - Default pointing slowly traces a circle around the celestial
 *   equator so you can see the reticle move on the sky dome. Override
 *   with the FIXED_RA / FIXED_DEC env vars (decimal hours / degrees)
 *   to lock onto a specific target.
 *
 * Run
 * ---
 *   node examples/mock-bridge.mjs
 *   # or:
 *   BRIDGE_PORT=8000 FIXED_RA=5.575 FIXED_DEC=-5.39 node examples/mock-bridge.mjs
 *
 * Requires the `ws` package — install once with `npm i -D ws`.
 *
 * This is intentionally a stub; the real helper will translate
 * actual INDI XML / ASCOM COM calls into the same message envelope.
 */

import { WebSocketServer } from 'ws';

const PORT = Number(process.env.BRIDGE_PORT ?? 7624);
const FIXED_RA = process.env.FIXED_RA ? Number(process.env.FIXED_RA) : null;
const FIXED_DEC = process.env.FIXED_DEC ? Number(process.env.FIXED_DEC) : null;
const PUSH_HZ = 4;

const wss = new WebSocketServer({ port: PORT, path: '/sim' });
console.log(`[mock-bridge] listening on ws://localhost:${PORT}/sim`);
if (FIXED_RA != null && FIXED_DEC != null) {
  console.log(`[mock-bridge] fixed pointing: RA=${FIXED_RA}h Dec=${FIXED_DEC}°`);
} else {
  console.log('[mock-bridge] sweeping pointing along the celestial equator');
}

const startMs = Date.now();

/**
 * Per-connection simulated mount state. Defaults to the sweep pattern;
 * a slew command transitions through 'slewing' (RA/Dec interpolate
 * linearly toward target at ~3°/s) and then back to either fixed or
 * sweep, depending on whether FIXED_* env vars are set.
 */
function makeMountState() {
  return {
    mode: 'sweep',          // 'sweep' | 'fixed' | 'slewing'
    fixedRa: FIXED_RA,
    fixedDec: FIXED_DEC,
    currentRa: 0,
    currentDec: 0,
    slewTargetRa: 0,
    slewTargetDec: 0,
    slewSpeedDegPerSec: 3,  // rough mid-range smart-scope value
  };
}

function sweepPointing() {
  const tSec = (Date.now() - startMs) / 1000;
  const ra = (tSec * (24 / 240)) % 24;
  const dec = Math.sin(tSec / 30) * 20;
  return { ra, dec };
}

/** Advance simulated mount one tick. Returns current (ra,dec) and
 *  emits slew lifecycle messages on `ws` when slewing. */
function tickMount(state, dtSec, ws) {
  if (state.mode === 'sweep') {
    const p = sweepPointing();
    state.currentRa = p.ra; state.currentDec = p.dec;
    return p;
  }
  if (state.mode === 'fixed') {
    return { ra: state.fixedRa, dec: state.fixedDec };
  }
  // slewing — interpolate toward target at slewSpeedDegPerSec.
  const dRa = angDeltaHours(state.currentRa, state.slewTargetRa);
  const dDec = state.slewTargetDec - state.currentDec;
  const remDeg = Math.hypot(dRa * 15, dDec);
  if (remDeg < 0.05) {
    // Arrived.
    state.currentRa = state.slewTargetRa;
    state.currentDec = state.slewTargetDec;
    state.mode = (state.fixedRa != null) ? 'fixed' : 'sweep';
    ws.send(JSON.stringify({ v: 1, type: 'slew.done',
      ra: state.currentRa, dec: state.currentDec }));
    return { ra: state.currentRa, dec: state.currentDec };
  }
  const stepDeg = state.slewSpeedDegPerSec * dtSec;
  const frac = Math.min(1, stepDeg / remDeg);
  state.currentRa  = wrapHours(state.currentRa  + dRa  * frac);
  state.currentDec = state.currentDec + dDec * frac;
  ws.send(JSON.stringify({ v: 1, type: 'slew.progress',
    remainingDeg: remDeg - stepDeg }));
  return { ra: state.currentRa, dec: state.currentDec };
}

function angDeltaHours(fromH, toH) {
  let d = toH - fromH;
  while (d >  12) d -= 24;
  while (d < -12) d += 24;
  return d;
}
function wrapHours(h) {
  let x = h % 24; if (x < 0) x += 24; return x;
}

wss.on('connection', (ws, req) => {
  console.log(`[mock-bridge] client connected from ${req.socket.remoteAddress}`);
  const state = makeMountState();
  let timer = null;
  let lastTickMs = Date.now();
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'subscribe.pointing':
        if (timer) return;
        lastTickMs = Date.now();
        timer = setInterval(() => {
          const now = Date.now();
          const dt = (now - lastTickMs) / 1000;
          lastTickMs = now;
          const { ra, dec } = tickMount(state, dt, ws);
          ws.send(JSON.stringify({ v: 1, type: 'pointing', ra, dec, at: now }));
        }, 1000 / PUSH_HZ);
        return;
      case 'slew':
        if (typeof msg.ra !== 'number' || typeof msg.dec !== 'number') return;
        state.mode = 'slewing';
        state.slewTargetRa = msg.ra;
        state.slewTargetDec = msg.dec;
        ws.send(JSON.stringify({ v: 1, type: 'slew.start', ra: msg.ra, dec: msg.dec }));
        console.log(`[mock-bridge] slew start → RA=${msg.ra.toFixed(3)}h Dec=${msg.dec.toFixed(2)}°`);
        return;
      case 'sync':
        if (typeof msg.ra !== 'number' || typeof msg.dec !== 'number') return;
        state.currentRa = msg.ra;
        state.currentDec = msg.dec;
        console.log(`[mock-bridge] sync to RA=${msg.ra.toFixed(3)}h Dec=${msg.dec.toFixed(2)}°`);
        return;
      case 'abort':
        if (state.mode === 'slewing') {
          state.mode = (state.fixedRa != null) ? 'fixed' : 'sweep';
          ws.send(JSON.stringify({ v: 1, type: 'slew.aborted' }));
          console.log('[mock-bridge] slew aborted');
        }
        return;
      case 'park':
      case 'unpark':
        // No-op in the mock — just acknowledge for logging.
        console.log(`[mock-bridge] ${msg.type} (no-op in mock)`);
        return;
    }
  });
  ws.on('close', () => {
    if (timer) clearInterval(timer);
    console.log('[mock-bridge] client disconnected');
  });
});
