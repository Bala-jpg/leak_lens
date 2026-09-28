# Hardware telemetry readiness review and integration plan

Status update: Essential software preparation has since been implemented. See [hardware-ready.md](hardware-ready.md) for current behavior and remaining physical checks. The findings below describe the pre-change review.

Reviewed: 24 September 2026. This is an assessment and proposed implementation plan; application and firmware behavior were not changed during this review.

## Verdict

The software path supports a supervised LAN telemetry experiment. The current repository is not yet verified for dependable unattended leak protection or accurate incident analytics. Configure and compile the firmware before connecting it; fix the status and event issues below before accepting dashboard leak/cutoff reporting.

Scope: application source, firmware, SQL schema/migration/seed, API contracts, authentication, sockets, frontend pages/contexts, build configuration, Docker deployment, simulator and documentation. Generated bundles, dependency internals, images and design-export JSON are not evidence of hardware readiness.

## Evidence gathered

- Backend TypeScript build: passed.
- Frontend TypeScript/Vite build: passed; bundle-size warning remains.
- Frontend lint: no errors; four existing Fast Refresh warnings.
- Backend tests with DATABASE_TESTS=1: all three passed, including PostgreSQL history filtering and ownership checks.
- Running backend health: status ok, database connected.
- Temporary account/device smoke test: register -> provision device key -> HTTP ingest -> database row -> authenticated device-room Socket.IO event -> 5-minute history query passed. Invalid device key returned 401. Temporary account and cascading device/readings were removed.
- That smoke test used a software HTTP client, not an ESP32 or a rendered browser. It does not verify Wi-Fi reachability, pulse accuracy, physical valve closure or browser recovery.
- firmware/LeakLens/secrets.h does not currently exist. Arduino CLI and PlatformIO were not found on PATH. Firmware compilation, upload and bench performance remain unverified.

## Existing integration contract

ESP32 -> HTTP POST /api/v1/telemetry/ingest -> Express -> PostgreSQL -> telemetry_update in an authorized device room -> React contexts and chart.

Required headers:

```text
Content-Type: application/json
X-Device-Key: <one-time key returned by device registration>
```

Example payload matching the current firmware:

```json
{
  "inletFlowLpm": 6.0,
  "outletFlowLpm": 6.0,
  "inletTotalVolumeL": 1.0,
  "outletTotalVolumeL": 1.0,
  "valveState": "OPEN",
  "leakDetected": false
}
```

The key identifies the device; the payload does not need a device ID or user JWT. The firmware omits recordedAt, so the server assigns receipt time. The optional recordedAt field supports timestamps supplied by a client, but firmware clock synchronization and replay are not implemented.

Firmware samples every 1 second and attempts telemetry every 10 seconds. Pulse counts use interrupts and a critical section. Both calibration values are 360 pulses/litre. Local cutoff requires inlet >0.3 L/min and inlet minus outlet >=0.5 L/min sustained for the configured 3-second confirmation period. Sampling and network work can add delay; this is not a measured 3-second physical cutoff guarantee.

Compose publishes the backend at computer port 5000, PostgreSQL at computer port 5433, and the optional Nginx frontend at 8080. Internally the backend uses postgres:5432. The ESP32 must use the computer's reachable LAN address, never localhost or the Docker service name postgres.

## Findings to address

| Priority | Finding and evidence | Required result |
| --- | --- | --- |
| Before firmware test | secrets.h is missing; no pinned board/core/LCD library build setup. | Configure credentials and device key privately; record board and library versions; compile and upload successfully. |
| Before trusting cutoff UI | telemetry.controller.ts treats a single flow imbalance as a leak even when firmware leakDetected is false, then records CUTOFF while valveState is still OPEN. Firmware ignores the returned CLOSE_VALVE command. | Make hardware-confirmed detection authoritative for this integration. Record CUTOFF only after hardware reports its closed output state; distinguish suspected imbalance if retained. |
| Before trusting live status | TelemetryContext uses selectedDevice.valveState; DeviceContext does not update from telemetry events. Device status is set ONLINE at ingest but has no offline expiry. History retrieval resets lastSync to now. UNKNOWN is displayed as sealed/cutoff. | Update state from latest accepted device telemetry, use reading/receipt timestamps honestly, derive offline age, and display unknown/no-data explicitly. |
| Before relying on local protection | HTTPClient POST runs synchronously on the same loop as sampleFlow. setTimeout(700) is not proof of a bounded complete network operation; HTTP result is discarded. | Isolate network operations from sampling/cutoff, log status/errors without secrets, and test a connected Wi-Fi network with an unreachable backend. |
| Before accepting incident history | Firmware sends only latest values every 10 seconds. A leak can close the valve and reach zero flow before its first report. Detection rate and detection/cutoff timestamps can therefore be lost; backend may report zero latency. | Preserve a local event snapshot with detection/cutoff timing and pre-cutoff rates/volumes; send promptly and retry independently of local control. |
| Before using remaining controls | DevicesPage still has valve buttons and ActiveLeakBanner still exposes Manual Override. Backend changes database valve state and broadcasts to browser rooms; firmware has no command receiver. | Remove/disable unsupported controls and reject unsupported command requests. Keep hardware in charge, as requested. |
| Before resolving real incidents | Mark Leak as Fixed resolves the server event while firmware leakDetected remains latched. The next report can create another incident. Reset opens the valve and clears totals/latch. | Define repair, physical reset/rearm and server resolution order; prevent re-creating an incident from repeated reports of the same hardware event. |
| Reliability | Ingest writes are not transactional; there is no unique sample/event identifier or uniqueness constraint for active incidents. | Make ingest atomic, serialize per-device incident transitions, and deduplicate retries; handle delayed samples without reverting latest state. |
| Reliability | Offline firmware readings are dropped; volume totals and latch are RAM-only. Socket reconnect attempts stop after five; reconnect does not explicitly resync all contexts. Device switching can race history responses. | Define outage retention and reboot semantics, add recovery/resync and cancel stale requests. |
| Multiple devices | Every DevicesPage card shows flow from the selected device's shared telemetry context. | Display each device's own latest reading or explicitly omit its reading when unavailable. |
| Analytics | Water loss uses total inlet increase, including delivered water. Savings use a fixed two-hour assumption and 10 L minimum. Thirty-day cards sum all incidents; daily usage uses only 200 recent readings and averages flow rather than calculating volume. | Correct loss/volume math and period queries; label savings assumptions. Not a prerequisite for first flow display, but required before presenting these as measured results. |
| Misleading UI | Sidebar uptime/latency, several analytics figures and certification/performance claims are static. Notification preference switches only change local component state. | Remove unsupported claims or connect them to measured data; label unimplemented preferences. |
| Deployment | Both root .env and backend/.env are tracked by Git. HTTP is the configured telemetry transport; no TLS termination is configured in Compose. | Stop tracking real secrets, assess exposure and rotate exposed credentials deliberately. Use TLS and certificate validation before deployment beyond the controlled bench network. |
| Documentation/test tooling | README includes conflicting example paths, environment names and ports. seed.ts truncates all tables. Simulator obeys backend commands unlike real firmware and its dropout branch skips the one-second delay. | Update setup instructions; do not run seed against real data. Make simulation follow firmware timing, detection and reset behavior. |

The firmware valveState is the software's relay/output state. There is no valve-position feedback input, so it cannot prove physical closure. Use precise display wording and verify physical closure on the bench.

## Ordered implementation plan

### 1. Correct telemetry display and hardware authority

Reuse existing controllers, contexts, routes and Socket.IO rooms.

- Fix live valve/status/freshness propagation and unknown/offline states.
- Make firmware-confirmed events drive confirmed leak/cutoff state. Do not mark a valve physically closed because a command was generated.
- Remove unsupported remote valve controls and prevent their API from overwriting hardware-reported state.
- Clear or isolate old readings when switching device; reject stale responses and keep readings ordered/deduplicated.
- Resync history, incidents, device state and notifications on reconnect; recover after token expiry.

Acceptance: a synthetic OPEN -> confirmed leak/CLOSED report updates flow cards, chart and valve status without reload. No-data and disconnection are visible. One device's readings never appear under another device.

### 2. Make firmware testable and resilient

- Record the actual ESP32 board, core version and LiquidCrystal_I2C library version.
- Preserve existing working pin assignments and independently validate calibration/relay polarity against the assembled hardware.
- Move HTTP work into a separate task or equivalent design with safe telemetry snapshots; keep interrupts, sampling and cutoff independent.
- Add Serial diagnostics for Wi-Fi connection, sample values, valve output transitions and HTTP status, without printing passwords or keys.
- Preserve event identity and timing. Define sample ID, boot/session ID, event ID and elapsed cutoff time if accurate event reporting is needed without a synchronized clock; evolve Zod schema and migrations together.
- Add a bounded retry queue and explicit overflow behavior. Define which readings/events survive power loss and whether volume totals persist or start a new session.
- Decide and document safe rearm after repair. Current boot behavior opens the valve; do not accidentally retain that behavior if a persistent cutoff latch is required.

Acceptance: the sketch compiles for the actual board; local detection keeps running with Wi-Fi down and with backend connections timing out. Event metadata survives until acknowledged. Timing is measured on the bench.

### 3. Prepare the LAN and provision one real device

1. Start services from the project root: docker compose up -d postgres backend. If code changed, rebuild backend with docker compose up -d --build backend.
2. Confirm http://localhost:5000/api/v1/health reports the database connected.
3. Start the existing frontend with npm.cmd run dev from frontend, or build/start the Compose frontend on port 8080.
4. Sign in and use Devices -> Add Device. Record that device's ID and one-time key privately. Select this device in Overview; do not mix it with seeded demo devices.
5. Copy firmware/LeakLens/secrets.example.h to secrets.h. Supply Wi-Fi credentials, the new key, and http://<computer-LAN-IP>:5000/api/v1/telemetry/ingest.
6. Verify the ESP32 network can reach the computer: same reachable LAN, no client isolation, appropriate private-network firewall access to port 5000. Reserve a stable host IP where possible.
7. Compile and upload the reviewed sketch. Open Serial Monitor at 115200 baud. Confirm HTTP 200 and increasing readings in PostgreSQL.

Do not run npm run seed during integration: it deletes existing accounts, devices and telemetry. No database reset is required to add hardware.

### 4. Verify readings end to end

```sql
SELECT recorded_at, inlet_flow_lpm, outlet_flow_lpm,
       inlet_total_volume_l, outlet_total_volume_l, leak_detected, valve_state
FROM sensor_readings
WHERE device_id = '<registered-device-uuid>'
ORDER BY recorded_at DESC
LIMIT 20;
```

- Compare LCD/Serial and dashboard inlet/outlet values allowing for the telemetry interval and rounding.
- Confirm samples belong to the new hardware device and timestamps advance. Flow values are L/min; totals are litres.
- With the current 10-second interval, expect about six successful telemetry reports per minute during uninterrupted operation. Proposed bench target: the dashboard shows each report within two seconds of server receipt; measure it rather than claim it in advance.
- Reload the page to confirm values/history come back from PostgreSQL.
- Verify 5m, 1h and 24h history windows. Longer windows contain only collected history; no fabricated points are expected.
- Compare measured collected volume against both sensor totals and record calibration error at multiple flow rates.

### 5. Acceptance scenarios

| Scenario | Required observation |
| --- | --- |
| No flow | Near-zero flow; no false leak; distinct connected/no-data state. |
| Balanced flow | Sensor difference within measured calibration tolerance; totals increase; no cutoff. |
| Brief imbalance | No confirmed leak before the configured sustained confirmation completes. |
| Sustained imbalance | Local relay and buzzer activate; physically verify isolation; one incident appears with honest hardware-reported state and timing. |
| Wi-Fi unavailable | Local cutoff still works; dashboard becomes stale/offline; retained events arrive after reconnect. |
| Wi-Fi up, API unreachable | Local sampling/cutoff timing remains acceptable despite HTTP failures; diagnostics identify delivery failure. |
| Browser socket interrupted | Live readings and missed history recover without manual logout/reload. |
| Repair/reset | Board is rearmed only by the documented procedure; server resolution does not create duplicate incidents; reboot totals are interpreted correctly. |
| Power failure | Verify actual valve behavior and the agreed startup policy on the assembled hardware. |
| Invalid key / other user's device | Ingest rejected; unauthorized dashboard cannot access readings or subscribe to device events. |

Record firmware version, calibration, sample/report intervals, measured delivery delay, physical cutoff delay, outage duration and observed results. Software builds and HTTP tests cannot replace these physical checks.

### 6. Complete analytics and deployment after the bench passes

Correct volumetric loss and savings assumptions, history ranges and static labels. Add regression tests for the leak lifecycle, retries, reset sessions and reconnects. Update README and the wiring/acceptance record with the verified setup. Add TLS, backups, secret management and an explicit telemetry retention policy before broader deployment.

Completion criterion: the real ESP32's readings are visible for the correct device, persist across dashboard/backend restarts, recover from network interruptions, and report local cutoff honestly. Physical protection is accepted only after its independent bench tests pass.
