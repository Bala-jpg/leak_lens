# LeakLens

ESP32 flow monitoring with local valve shutoff, an Express API, PostgreSQL and a React dashboard.

## Run the software

From the project root, configure the existing root `.env` using `.env.example` as a reference. Keep existing credentials when using an existing database volume.

```powershell
docker compose up -d --build postgres backend
```

Health: `http://localhost:5000/api/v1/health` must report the database connected. Backend startup applies additive schema migrations automatically. PostgreSQL persists in the `postgres_data` volume.

For frontend development:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:5173`. `frontend/.env.local` should use `VITE_API_BASE_URL=/api/v1` and an empty `VITE_WS_URL`; Vite proxies both API and Socket.IO. Alternatively run `docker compose up -d --build frontend` and open `http://localhost:8080`.

When running the backend directly on Windows, use `backend/.env` with a DATABASE_URL pointing to `localhost:5433`, then `npm.cmd run migrate` and `npm.cmd run dev` from backend. Do not also run the Docker backend on port 5000.

Docker backend connects to `postgres:5432`; Windows database clients use `localhost:5433`. Do not run `npm run seed` on real data. The seed is destructive and now requires explicit `ALLOW_DESTRUCTIVE_SEED=yes`.

## Hardware preparation

Follow [the hardware integration guide](docs/hardware-ready.md) and [wiring notes](docs/hardware.md).

The firmware samples every second and sends routine telemetry every ten seconds plus local valve transitions. Networking runs in a separate task. Valve control is local; dashboard valve commands are disabled. Firmware starts with its output CLOSED and requires a local serial `REARM` after inspection. A retained leak must be delivered successfully before rearming.

The API authenticates `/api/v1/telemetry/ingest` using `X-Device-Key`. Register a real device through Devices -> Add Device and copy its one-time key into private `firmware/LeakLens/secrets.h`. Use the computer's LAN IP for TELEMETRY_URL. Blynk credentials are not used.

## Checks

```powershell
cd backend
npm.cmd run build
$env:DATABASE_TESTS='1'
npm.cmd test
```

Database tests require a migrated reachable database; fixtures are isolated and removed. Run frontend `npm.cmd run build` and `npm.cmd run lint` from frontend. Firmware compile instructions and tested versions are in the hardware guide.

The simulator accepts nominal, rupture, pinhole and dropout. Set DEVICE_KEY privately, then run `node scripts/simulate_device.mjs nominal`. It models local cutoff and emits at one-second intervals for a short test; firmware routine reports are ten seconds apart.

## Data semantics and limits

- Flow is L/min; cumulative volume is litres since the current firmware boot.
- Reported valve state describes the output command, not measured mechanical position.
- Device data becomes stale after 35 seconds. Historical HTTP retrieval does not reset reading freshness.
- Routine offline samples are replaced by the latest sample, so historical gaps are expected. Leak event details persist in ESP32 preferences until delivered and locally rearmed. Full offline history replay is not implemented.
- Incident timestamps are server observations. The separately reported confirmation interval comes from the device and is not a physical closure measurement.
- Savings assume two hours of continued flow at the reported leak rate. They are estimates. Recent daily average-flow analytics are not full daily consumption totals.
- `.env` files and firmware secrets are ignored; previously committed credentials may still exist in Git history. Rotate credentials if they were exposed. Changing the device-key pepper requires reprovisioning device keys; changing POSTGRES_PASSWORD in an env file does not change an existing database user's password.
- Current transport is HTTP on a controlled LAN. TLS, backups, long-term retention and physical acceptance remain deployment work.

## Direct telemetry identity and timing

Updated firmware sends `bootId`, `sampleId`, and `sampledUptimeMs`. Volume counters are litres since that boot; compare cumulative volumes only within the same known boot. Older reports without session fields remain accepted, but their counter continuity is unknown.

`recordedAt` is a device-reported measurement timestamp when supplied, otherwise the backend estimates it from receipt time minus `ageMs`. `receivedAt` is the server receipt time. `measurementTimeBasis` distinguishes these cases. Transport delay is not measured.

Incident `detectedAt` / `firstObservedAt` and `cutoffAt` retain server-observation semantics. New `detectionOccurredAt` and `cutoffOccurredAt` are uptime-based estimates only when the event originated in the reporting boot. An event first delivered after reboot has unknown occurrence timestamps. Event uptime metadata is retained separately; existing estimated times are not overwritten by repeated reports. The firmware does not assume an accurate calendar clock.

A retry must retain the same sample content and ID; only `ageMs` may increase. The backend returns matching `sampleId` / `acceptedEventId` in JSON and `X-Accepted-Sample` / `X-Accepted-Event` headers. Firmware acknowledges a retained incident only when those headers match. Conflicting retries return HTTP 409. Samples stored before request fingerprints existed cannot be verified as identical and also return 409; a newly generated sample can still report the same retained event.

Flow difference is signed (`inlet - outlet`); incident loss estimates remain nonnegative. Valve state always describes the commanded output, not physical position. Confirmation duration ends at the output command and is not mechanical closure time.

Deploy the backend migration/build before uploading the updated firmware, because the firmware requires the new acknowledgement headers. The additive migration preserves records. Existing retained firmware incidents are migrated from the old Preferences record without inventing event timing. Local REARM and offline latest-sample behavior are unchanged. Full daily consumption accounting remains separate analytics works.
