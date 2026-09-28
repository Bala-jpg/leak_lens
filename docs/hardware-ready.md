# Ready for supervised hardware integration

## Software changes completed

- Telemetry schema accepts explicit hardware leak/valve reports; flow imbalance alone cannot mark a confirmed leak.
- PostgreSQL ingestion is transactional and serialized per device. Sample IDs deduplicate retries; hardware event IDs preserve incident identity across retries and reboots.
- Delayed samples are stored without reverting the latest device state. Cutoff is recorded only from CLOSED reports; physical valve position is not inferred.
- Retained event snapshots preserve pre-cutoff rates, estimated differential loss and the local confirmation interval even when the current flow has reached zero.
- Unsupported remote valve controls are removed and the API rejects valve commands.
- Dashboard flow/valve state follows latest telemetry; stale/no-reading states are visible. Polling supplements socket delivery and reconnect triggers resync. Each device card no longer borrows another device's values.
- Incident resolution requires fresh, non-leaking OPEN telemetry after local repair/rearm. Replayed identified events cannot recreate a resolved incident.
- Firmware uses a FreeRTOS network task and a bounded latest-sample mailbox. Local sampling does not call HTTP or Wi-Fi. HTTP diagnostics print status codes without credentials.
- Firmware boots CLOSED and persists a leak event in Preferences. Reset never automatically opens the valve. Rearm is an explicit local serial operation.
- Seed now requires explicit destructive opt-in. Root/backend env files are kept locally but removed from Git tracking. Unsupported static safety/uptime claims are removed.

## Configure and flash

1. Verify wiring against hardware.md, actual relay polarity and voltage levels. Pins remain inlet 25, outlet 26, relay 5 and buzzer 12; LCD address remains 0x27.
2. Start PostgreSQL/backend and the dashboard as described in README. Do not seed or delete the database volume.
3. Add a device in the dashboard; retain the displayed one-time key privately.
4. Copy `firmware/LeakLens/secrets.example.h` to `firmware/LeakLens/secrets.h`. Fill WIFI_SSID, WIFI_PASSWORD, DEVICE_KEY and TELEMETRY_URL. The URL must be `http://<computer-LAN-IP>:5000/api/v1/telemetry/ingest`.
5. Confirm port 5000 is reachable from the hardware network; check the private-network firewall and Wi-Fi client isolation.
6. Open LeakLens.ino in Arduino IDE. Build target used for verification: ESP32 Dev Module (`esp32:esp32:esp32`), Espressif core 3.0.2, LiquidCrystal I2C 1.1.2. Select the actual board and port before upload. The LCD library metadata declares AVR; its actual operation on your ESP32 must be bench-checked even if compilation succeeds.
7. Upload with real secrets. Open Serial Monitor at 115200 baud with newline enabled. Firmware initially reports CLOSED. After inspecting the plumbing, send exactly `REARM` followed by newline to open the output.
8. Observe HTTP 200 and select the registered device in Overview. Routine updates arrive about every 10 seconds; local valve transitions enqueue an immediate update.

The verification build uses `LEAKLENS_COMPILE_CHECK` to include placeholder secrets.example.h. Do not upload that build for integration. Normal builds require secrets.h.

## Repeatable compile check on this Windows setup

The Arduino CLI bundled with Arduino IDE is under `%LOCALAPPDATA%/Programs/Arduino IDE/resources/app/lib/backend/resources/arduino-cli.exe`. The local compile configuration in `.tools/arduino-cli.json` points at installed core packages and the project-local LCD library. These tools/build outputs are ignored by Git.

```powershell
& "$env:LOCALAPPDATA\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe" --config-file .tools/arduino-cli.json compile --fqbn esp32:esp32:esp32 --build-path firmware/build --build-property "compiler.cpp.extra_flags=-MMD -c -DLEAKLENS_COMPILE_CHECK" firmware/LeakLens
```

On another computer, install the listed core and library through Arduino IDE. Use a normal Verify build with your private secrets.h.

## Repair and rearm sequence

1. A confirmed local leak closes the output, sounds the buzzer and persists its event snapshot.
2. Inspect and repair the plumbing. Check physical closure yourself; there is no position sensor.
3. Wait for the event to reach the backend (HTTP 200). If Wi-Fi/backend is unavailable, the event remains retained and local REARM is blocked for that leak.
4. Send REARM locally. This clears the stored event and reports non-leaking OPEN state. A continued imbalance will trigger another local incident.
5. Wait for a fresh normal dashboard reading, then click Mark Leak as Fixed. This records operator resolution; it does not move the valve.

## Acceptance before unattended operation

Record actual results for zero flow, balanced flow, brief imbalance, sustained leakage, Wi-Fi disconnected, Wi-Fi connected with API unreachable, browser reconnect, board restart and power failure. Compare collected 1 L/5 L volumes with each sensor independently and adjust the 360 pulses/litre defaults. Measure physical closure and report latency; do not treat the 3-second confirmation setting as a physical guarantee.

No physical upload, calibration, relay polarity, valve response or power-loss behavior is verified by software tests. Full routine offline history, HTTPS, backups and long-term consumption reporting remain separate work before broader deployment.

## Verification record (24 September 2026)

- Frontend and backend builds passed; frontend lint has only the four existing Fast Refresh warnings.
- Four backend tests passed with database integration enabled, including concurrent retry deduplication, delayed samples, explicit hardware detection, cutoff and guarded resolution.
- ESP32 Dev Module compile with core 3.0.2 and LiquidCrystal I2C 1.1.2 passed using placeholder secrets: 1,047,693 bytes flash (79%) and 47,872 bytes global RAM (14%). LCD architecture metadata warning remains; bench verification is required.
- The running Docker backend was rebuilt; health reports database connected.
- Deployed HTTP ingest -> PostgreSQL incident -> authenticated Socket.IO CLOSED reading passed using a temporary test device; its records were removed.
- Browser automation was unavailable, so rendered UI behavior still needs the bench visual check. No firmware was uploaded or hardware actuated during software preparation.
