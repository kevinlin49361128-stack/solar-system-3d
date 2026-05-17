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
function currentPointing() {
  if (FIXED_RA != null && FIXED_DEC != null) {
    return { ra: FIXED_RA, dec: FIXED_DEC };
  }
  // Sweep RA 0→24h over 240s; dec wobbles ±20° on a slower cycle.
  const tSec = (Date.now() - startMs) / 1000;
  const ra = (tSec * (24 / 240)) % 24;
  const dec = Math.sin(tSec / 30) * 20;
  return { ra, dec };
}

wss.on('connection', (ws, req) => {
  console.log(`[mock-bridge] client connected from ${req.socket.remoteAddress}`);
  let timer = null;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg?.type !== 'subscribe.pointing') return;
    if (timer) return;  // already streaming
    timer = setInterval(() => {
      const { ra, dec } = currentPointing();
      ws.send(JSON.stringify({ v: 1, type: 'pointing', ra, dec, at: Date.now() }));
    }, 1000 / PUSH_HZ);
  });
  ws.on('close', () => {
    if (timer) clearInterval(timer);
    console.log('[mock-bridge] client disconnected');
  });
});
