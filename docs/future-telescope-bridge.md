# INDI / ASCOM telescope bridge

**Status**:
- **Tier 1 (read-only)** — *shipped in v0.7*. Browser-side `ScopeBridge`
  + dome reticle in `src/controls/ScopeBridge.ts` /
  `src/scene/ScopeReticle.ts`.
- **Tier 2 (slew / sync / park control)** — *shipped in v0.7*. The
  `ScopeBridge` class now sends `slew` / `sync` / `abort` / `park` /
  `unpark` messages through a layered safety gate. The InfoPanel
  exposes a 🔭→ button on any catalogue entry; the Realism panel adds
  a panic-stop button + slew-rate cap + dec floor/ceiling.
- **Real INDI/ASCOM helper app** — still in a separate repo
  (`solar-system-3d-bridge`); only the JSON envelope between browser
  and helper is in this repo. A mock helper for local end-to-end
  testing lives at `examples/mock-bridge.mjs` and now simulates slew
  motion (linear interpolation at ~3°/s with progress + done events).

**Quick test (Tier 1 + Tier 2)**:
```
npm i -D ws
node examples/mock-bridge.mjs   # listens on ws://localhost:7624/sim

# In the simulator:
# 1) Realism panel → 🔭 INDI / ASCOM bridge → Connect
#    → green reticle appears, sweeping along the equator
# 2) Click ⚠️ Tier 2 → tick "I understand the risks"
# 3) Click any DSO / star / planet → InfoPanel's 🔭→ button appears
# 4) Press 🔭→ → reticle starts moving toward target; status bar
#    shows "Slewing… N° remaining" → "On target".
# 5) Press 🛑 PANIC STOP mid-slew to abort.
```

**Safety model** (defence in depth):
1. **Browser layer** — `ScopeBridge.slew()` returns `SlewGate` enum
   before any wire send. Checks: connected → control-enabled → coord
   ranges → dec floor/ceiling → max angular jump → not-already-slewing.
2. **User opt-in** — control gate is off by default. The acknowledgement
   checkbox is the only path to flip `controlEnabled = true`.
3. **Panic stop** — `abort()` bypasses the control gate so it works
   even after a buggy bridge keeps `slewActive` stuck.
4. **Helper layer** (future real helper) — should also enforce mount
   driver limits + meridian-flip handling + slew-rate clamps.
5. **Mount hardware** — physical limit switches are the final
   backstop; users are explicitly reminded to set them.

---

## Why this isn't browser-resident

The Stellarium WebSocket integration we already ship (Realism panel
"Stellarium telescope") shows the right scope of what a *pure
browser* can do: connect to an already-running local app over WS,
push slew commands, receive sync confirmations. That's fine for
Stellarium because Stellarium itself is the bridge to the hardware.

INDI and ASCOM are not the same shape:

- **INDI** is a binary protocol over a TCP socket from an `indiserver`
  process. The browser can't open arbitrary TCP sockets; it would
  need a WebSocket-to-INDI translator running locally.
- **ASCOM** is a Windows-only COM/IPC layer. Browsers can't speak COM
  at all. The translator must be a native Windows helper.

For both, the realistic architecture is a small *local helper app*
(could be Electron, Tauri, or a CLI server) that exposes a
WebSocket on `ws://localhost:PORT` and translates browser messages
to/from the protocol.

---

## Two-tier strategy

### Tier 1 — observe-only bridge (v0.7, 8 hours)

Read-only: surface the connected scope's current pointing in the
simulator. Useful for "is my Vespera aimed where I expect", visual
sanity check before a long stack starts.

- Browser opens WebSocket to `ws://localhost:7624/sim` (configurable).
- Helper app (separate repo, MIT-licensed) does:
  - INDI: connects to `indiserver` at `:7624` (default), polls the
    `EQUATORIAL_COORD` property of the active mount driver every
    250 ms, pushes `{ra, dec}` to the WS client.
  - ASCOM: COM-instantiates `ASCOM.DriverAccess.Telescope`, calls
    `RightAscension` / `Declination` on the same cadence.
- Browser draws a green reticle at that RA/Dec on the celestial
  dome, alongside the existing observer-mode crosshair.

This tier is the natural extension of the existing Stellarium
toggle. We add a "🔭 Scope: connect" button next to it in the
Realism panel. Failure modes (helper not running, mount not
connected, network glitch) are all "scope reticle disappears";
nothing breaks the simulator.

### Tier 2 — full control (v0.8+, 12 hours)

Two-way: user can pick a target in the simulator and have the scope
slew there. Stops being "is my scope aimed right" and starts being
"plan in the browser → click → scope obeys".

- Adds `slew` and `sync` outbound commands; the helper translates
  to the mount driver's `EquatorialCoordSet` (INDI) or `SlewToCoordinates`
  (ASCOM).
- "Slew to target" button in the InfoPanel for any DSO / planet entry.
- Observation queue "▶ Run session" button — slew → wait for
  arrival → trigger autoguider → camera shutter → next target.
- This tier is genuinely scary (a software bug could whip a scope
  into the meridian flip wall). Ship behind an explicit
  "I understand the risks" checkbox; default OFF.

---

## Helper app shape

Suggested layout (separate `solar-system-3d-bridge` repo):

```
bridge/
├── package.json
├── src/
│   ├── server.ts          # WebSocket server, auth, message routing
│   ├── indi/
│   │   ├── client.ts      # XML-over-TCP INDI client
│   │   └── translator.ts  # INDI properties ⇄ our JSON message shape
│   ├── ascom/
│   │   ├── driver.ts      # Node-COM bridge (windows-only)
│   │   └── translator.ts
│   └── messages.ts        # Shared { type, payload } schema
├── manifest.json          # for Tauri packaging
└── README.md
```

Distribute as:
- macOS / Linux: `npm install -g solar-system-3d-bridge` then run
  `sss-bridge` in a terminal. INDI-only on these platforms.
- Windows: download a tray-app .exe from GitHub Releases. ASCOM-only.

The browser side never assumes the helper is present — feature
detection on first toggle-on, status indicator in the Realism panel.

---

## Message protocol (browser ⇄ helper)

JSON over WebSocket, request/response with optional server-pushed
events. Versioned `{v: 1, type, ...}` envelope so future schema
changes don't break old clients.

### Browser → helper

```json
{ "v": 1, "type": "subscribe.pointing" }
{ "v": 1, "type": "slew", "ra": 5.5577, "dec": 22.0145 }
{ "v": 1, "type": "sync", "ra": 5.5577, "dec": 22.0145 }
{ "v": 1, "type": "park" }
{ "v": 1, "type": "unpark" }
```

### Helper → browser

```json
{ "v": 1, "type": "pointing", "ra": 5.5577, "dec": 22.0145, "at": 1737036000000 }
{ "v": 1, "type": "status", "connected": true, "tracking": true, "parked": false }
{ "v": 1, "type": "error", "code": "MOUNT_NOT_CONNECTED", "message": "..." }
{ "v": 1, "type": "slew.progress", "remainingDeg": 12.4 }
{ "v": 1, "type": "slew.done", "ra": 5.5577, "dec": 22.0145 }
```

---

## Risks / decisions to revisit

1. **Hardware liability.** A simulator that drives a 30 kg mount can
   crash it into the pier. We'll require user-acknowledgment + add
   slew-rate caps + a panic stop. Tier 1 (read-only) entirely sidesteps
   this — start there.
2. **Driver fragmentation.** ASCOM drivers vary in quality; some
   leak file handles, some refuse repeat slews under 10 s. Test
   against the 3 most-popular mounts (iOptron, Sky-Watcher, Celestron)
   before declaring v0.8 stable.
3. **Multi-user sessions.** Two browser tabs both connected to the
   same helper → two voices commanding one mount. Helper enforces
   single-writer with last-claim-wins + a banner in non-writer tabs.
4. **PWA + offline.** The simulator's PWA install path stays — the
   bridge is local, so even offline PWA users with a running mount
   can use it.
5. **Smart-scope native APIs.** Seestar has an undocumented HTTP
   API on its Wi-Fi network; Vespera has a documented Bluetooth
   service. If the smart-scope crowd asks loudest, Tier 1 could
   add direct adaptors for these without needing INDI/ASCOM at all.

---

## Out of scope

- In-browser image capture display. The browser doesn't have access
  to USB cameras in a useful way; if we ever want this, it's a
  separate "stacked preview" channel through the helper, displaying
  the latest live-stack frame.
- Plate-solving. Existing solutions (ASTAP, Astrometry.net) are
  desktop apps; the bridge could shell out to them but it's out of
  scope for v0.7.
- Filter wheel + focuser. Stretch goals; INDI/ASCOM support is
  identical in shape to mount control.
