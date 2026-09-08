# LeakLens

**Smart Water Leakage Detection & Analytics System**

LeakLens combines an ESP32-based leak detection and automatic cutoff system with a custom web dashboard. Two flow sensors measure water entering and leaving a monitored pipe section. The ESP32 compares those readings, identifies sustained abnormal water loss, activates a buzzer, and closes a solenoid valve. A full-stack monitoring platform receives telemetry, stores historical readings and leak events, and visualizes water usage, estimated leakage volume, and estimated water saved through automatic cutoff.

> **Documentation status:** This README is based on the established project design. Application source code, package manifests, migrations, firmware, and deployment files were not available for verification. Features below describe the intended project scope, not a verified implementation inventory. Paths, environment variable names, API routes, payloads, and Socket.IO event names marked **example** or **proposed** must be matched to the actual implementation. This document does not create the application or its configuration files.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Hardware components](#hardware-components)
- [Software stack](#software-stack)
- [Prerequisites](#prerequisites)
- [Repository structure](#repository-structure)
- [Get the project](#get-the-project)
- [Environment variables](#environment-variables)
- [Docker and PostgreSQL setup](#docker-and-postgresql-setup)
- [Database schema and migrations](#database-schema-and-migrations)
- [Backend setup](#backend-setup)
- [Frontend setup](#frontend-setup)
- [ESP32 firmware setup and integration](#esp32-firmware-setup-and-integration)
- [API overview](#api-overview)
- [Socket.IO events](#socketio-events)
- [Run locally](#run-locally)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Future scope](#future-scope)
- [Contributing](#contributing)
- [License](#license)

## Features

- Dual-sensor monitoring of inlet and outlet flow rates.
- Sustained flow-difference detection with calibrated thresholds and a confirmation duration.
- Local automatic solenoid-valve cutoff and audible alerts through the ESP32.
- REST-based device telemetry ingestion.
- PostgreSQL storage for timestamped readings and leak-event history.
- Socket.IO updates for live dashboard readings and alerts.
- Charts for inlet/outlet flow, water usage, leakage volume, and estimated savings.
- JWT-based user authentication, bcrypt password hashing, and Zod input validation.
- Device registration, unique device credentials, location/name management, last-seen status, and deactivation as part of the planned device-management scope.
- Dashboard areas for Overview, Analytics, Notifications, Devices, and Profile / Settings.

Device inventory belongs on Devices; live readings and valve/leak state belong on Overview; historical trends belong on Analytics. Settings should expose only implemented preferences. Detection settings should remain read-only until changes can be delivered to and acknowledged by firmware.

No sampling rate, cutoff latency, detection accuracy, or percentage of water saved is claimed as a measured result here. Populate performance figures only after repeatable hardware testing.

## Architecture

```text
Water supply -> Shutoff valve -> Inlet sensor -> Monitored section -> Outlet sensor
                                                    |
                                              Possible leakage

Inlet pulse signal ----+
                       +--> ESP32 Arduino firmware --> Valve driver --> Solenoid valve
Outlet pulse signal ---+             |
                                     +--> Buzzer / buzzer driver
                                     |
                              HTTP(S) telemetry over Wi-Fi
                                     |
                                     v
                      Node.js + Express + TypeScript
                      Device authentication / Zod validation
                          |                       |
                          v                       v
                      PostgreSQL             Socket.IO
                                                  |
                                                  v
                         React + Vite + TypeScript dashboard
                         Axios REST requests / Recharts charts
```

The plumbing layout above is illustrative; adapt valve placement and fittings to the actual installation. Both sensors must bound the same monitored section. Legitimate branches between them must be accounted for, because the system otherwise interprets their consumption as a flow imbalance.

### Detection and cutoff

1. Count pulses independently for each flow sensor over the same measurement window.
2. Convert pulses to L/min using each sensor's calibration.
3. Compute `flow_difference = inlet_flow - outlet_flow`.
4. Confirm leakage only when the configured difference threshold is exceeded for the configured duration.
5. Trigger the local buzzer and command the solenoid valve to close.
6. Report readings, leak state, and valve command/state to the backend.
7. Persist accepted telemetry and publish updates to authorized dashboard clients.

Local detection and cutoff should continue during Wi-Fi or server outages. Network requests must not block sensor sampling or valve control. A valve-close command is not proof of physical closure; report it as commanded unless feedback or a validated flow check confirms closure.

### Units and analytics

Use **L/min** for flow, **L** for volume, and **UTC timestamps** for storage and transport.

For a sampling interval of `dt_seconds`:

```text
inlet_volume_L  ≈ inlet_flow_L_min × dt_seconds / 60
outlet_volume_L ≈ outlet_flow_L_min × dt_seconds / 60
leaked_volume_L ≈ max(inlet_flow_L_min - outlet_flow_L_min, 0) × dt_seconds / 60
```

Integrate across valid samples; do not silently count long telemetry gaps as constant flow. Display inlet supply volume and outlet delivered volume with distinct labels. Sensor-derived “water wasted” is a measurement estimate affected by calibration and installation conditions.

“Water saved” is a counterfactual estimate, not a directly measured sensor value. If implemented, document the assumed manual-intervention duration and estimated leak rate used to calculate avoided loss after cutoff. Exclude loss already counted before cutoff and label the estimate explicitly.

## Hardware components

| Component                                        | Quantity    | Purpose / selection notes                                                     |
| ------------------------------------------------ | ----------- | ----------------------------------------------------------------------------- |
| ESP32 development board                          | 1           | Pulse counting, local detection/control, Wi-Fi telemetry                      |
| Water flow sensors                               | 2           | Inlet and outlet measurement; match pipe size, pressure, and flow range       |
| Solenoid water valve                             | 1           | Automatic cutoff; verify voltage, current, pressure rating, and default state |
| Compatible relay module or MOSFET driver         | 1           | Switch the valve load without powering it from a GPIO                         |
| Buzzer and driver if required                    | 1           | Local audible alert                                                           |
| Suitable power supply / regulator                | As required | Supply the ESP32, valve, and sensors at their specified ratings               |
| Tubing, fittings, connectors, enclosure          | As required | Build the monitored pipe section and protect electronics                      |
| USB data cable                                   | 1           | Firmware upload and serial debugging                                          |
| Level shifting / pull-ups / inductive protection | As required | Match signal levels and protect the control circuit                           |

Exact sensor models, GPIO assignments, pulse calibration constants, valve polarity, and wiring are **project-specific placeholders**. Verify component datasheets. ESP32 inputs require compatible logic levels; do not connect a higher-voltage sensor output directly. Use appropriate protection for an inductive valve load. Document whether the valve is normally open or normally closed and what happens on power loss.

## Software stack

| Layer                       | Technologies                            |
| --------------------------- | --------------------------------------- |
| Frontend                    | React, Vite, TypeScript, Tailwind CSS   |
| Frontend networking         | Axios, Socket.IO Client                 |
| Charts                      | Recharts                                |
| Backend                     | Node.js, Express, TypeScript, Socket.IO |
| Authentication / validation | JWT, bcrypt, Zod                        |
| Database                    | PostgreSQL                              |
| Local database runtime      | Docker with Docker Compose              |
| Firmware                    | ESP32, Arduino framework, C++           |

Use dependency versions from the repository manifests and lockfiles. The database driver, migration tool, test runner, and optional firmware JSON library have not been confirmed.

## Prerequisites

- Git.
- Node.js and npm compatible with the repository's `engines`, version file, and installed Vite version.
- Docker Engine or Docker Desktop, with Docker Compose support, for the database option below.
- Alternatively, a local PostgreSQL installation and `psql`.
- Arduino IDE with the ESP32 board package, USB driver if needed, and a USB data cable.
- A Wi-Fi network supported by the selected ESP32 board and reachable from the backend host.

Check installed tools:

```sh
git --version
node --version
npm --version
docker --version
docker compose version
```

No specific Node.js version is asserted without a package manifest. On Windows, complete any Docker Desktop virtualization/WSL setup required by your installation.

## Repository structure

**Proposed layout — not a verified directory listing:**

```text
LeakLens/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/       # Axios and Socket.IO integration
│   │   ├── hooks/
│   │   └── types/
│   ├── .env.example
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── validators/
│   │   └── db/
│   ├── migrations/
│   ├── .env.example
│   └── package.json
├── firmware/
│   └── LeakLens/
│       ├── LeakLens.ino
│       └── secrets.example.h
├── docs/
├── compose.yaml
├── .env.example            # Compose database configuration
├── .gitignore
├── LICENSE                # Add after choosing a license
└── README.md
```

Substitute actual paths throughout this guide. If the repository uses npm workspaces or a different package manager, follow its root configuration and lockfile instead of installing each folder independently.

## Get the project

Replace the URL and folder below before running:

```sh
git clone <YOUR_REPOSITORY_URL>
cd <CLONED_REPOSITORY_FOLDER>
```

Inspect the repository's `package.json` files, `.env.example` files, migration directory, and firmware before continuing. Do not scaffold a new Vite or Express application over an existing checkout.

## Environment variables

The names below form an **example configuration contract**. They take effect only if the application reads those exact names. Prefer existing `.env.example` files and align the values with backend configuration code, frontend `import.meta.env` usage, and firmware configuration.

### Root `.env` for the Compose example

```dotenv
POSTGRES_DB=leaklens
POSTGRES_USER=leaklens
POSTGRES_PASSWORD=replace_with_a_unique_local_password
POSTGRES_PORT=5432
```

### Backend `.env` example

```dotenv
NODE_ENV=development
PORT=5000
HOST=0.0.0.0
DATABASE_URL=postgresql://leaklens:replace_with_a_unique_local_password@localhost:5432/leaklens
JWT_SECRET=replace_with_a_random_secret
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:5173
```

| Variable         | Purpose                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `PORT`           | Example backend HTTP and Socket.IO port                                        |
| `HOST`           | Example listen address; firmware needs a server reachable on the LAN           |
| `DATABASE_URL`   | PostgreSQL connection string; URL-encode special characters in credentials     |
| `JWT_SECRET`     | Secret used for signing/verifying tokens in an HMAC-based JWT implementation   |
| `JWT_EXPIRES_IN` | Example token lifetime, if supported by the selected JWT library/configuration |
| `CORS_ORIGIN`    | Allowed dashboard origin; configure HTTP and Socket.IO consistently            |

Generate a random secret using Node.js:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Ensure the backend loads its environment before constructing the database connection and authentication services. An `.env` file alone does not guarantee that the runtime loads it.

### Frontend `.env.local` example

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

All `VITE_` values used by client code are public. Never put JWT signing secrets, database passwords, or device keys in frontend environment files. Restart Vite after changes. Avoid duplicating `/api` if the Axios service already includes that prefix.

### ESP32 configuration

Configure Wi-Fi SSID/password, backend telemetry URL, device ID/key, sensor pins, valve/buzzer pins, individual sensor calibration, sample interval, telemetry interval, leak threshold, and confirmation duration. These are firmware constants or provisioning values, not automatically loaded from Node.js `.env` files.

Keep real `.env` and firmware secret files out of version control. Commit sanitized examples only. Rotate credentials if accidentally committed.

## Docker and PostgreSQL setup

This section supplies a **standalone example for the database only**. It does not assume backend/frontend Dockerfiles exist. If the project already contains Compose configuration, inspect and use that instead.

Create `compose.yaml` at the repository root with:

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-leaklens}
      POSTGRES_USER: ${POSTGRES_USER:-leaklens}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in the root .env}
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-5432}:5432"
    volumes:
      - leaklens_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  leaklens_pgdata:
```

PostgreSQL 16 is an explicit example version, not a verified project requirement. Use the version supported by the repository's migrations/deployment. The database port is bound to the local host; the ESP32 connects to Express, never directly to PostgreSQL.

After creating the root `.env`:

```sh
docker compose config --quiet
docker compose up -d db
docker compose ps
docker compose logs --tail=100 db
```

For the example database/user defaults:

```sh
docker compose exec db pg_isready -U leaklens -d leaklens
docker compose exec db psql -U leaklens -d leaklens
```

Inside `psql`, run `SELECT current_database();`, use `\dt` to list tables, and `\q` to exit. Substitute your actual database/user if changed.

When the backend runs on your host, use `localhost` and the published database port. If a backend container is added to the same Compose network, use `db:5432` in its connection string.

Stop services while retaining database data:

```sh
docker compose down
```

The named volume persists data. Removing that volume deletes the database. Changing `POSTGRES_PASSWORD` in `.env` does not update a role in an already initialized volume; update the database role and application connection string together.

### Alternative: locally installed PostgreSQL

If you are using a local installation instead of Docker, connect using your installation's administrative role:

```sh
psql -U <ADMIN_ROLE> -d postgres
```

For a new development database, run:

```sql
CREATE ROLE leaklens LOGIN;
\password leaklens
CREATE DATABASE leaklens OWNER leaklens;
\q
```

`\password` prompts for the new password. Set the backend connection string accordingly. Do not create duplicate roles/databases if they already exist. Avoid running both database options on the same host port.

## Database schema and migrations

Creating the database does **not** create application tables. Use the repository's actual migrations before starting the application.

**Proposed logical entities:**

| Entity        | Intended data                                                                          |
| ------------- | -------------------------------------------------------------------------------------- |
| Users         | ID, name, unique email, password hash, timestamps                                      |
| Devices       | Owner, name/location, device credential hash, active state, last seen                  |
| Telemetry     | Device, observation/receipt timestamps, flow readings, reported leak and valve states  |
| Leak events   | Device, incident start, cutoff/resolution times, leakage estimate, savings assumptions |
| Notifications | User/device/event association, notification type, read state                           |
| Preferences   | Only implemented account and notification preferences                                  |

Actual names, columns, constraints, and relationships must come from migrations. Use ownership checks, foreign keys, and an index appropriate for device/time-range queries. Ordinary PostgreSQL timestamped tables can store time-series readings; a time-series extension is not assumed.

Discover backend scripts:

```sh
cd backend
npm run
```

**Run the following only if `package.json` defines the corresponding script:**

```sh
npm run migrate
npm run seed
```

`migrate` and `seed` are illustrative script names. Do not assume Prisma, Drizzle, TypeORM, or any other migration framework. Seed only a development database and inspect the seed first. If there is no migration command, use the documented SQL/migration procedure supplied by the repository; table creation remains a setup blocker until one is provided.

## Backend setup

From the example `backend` directory:

```sh
cd backend
npm ci
npm run
```

Use `npm ci` when a matching `package-lock.json` exists. If this is an npm project without a lockfile, use `npm install` instead. Run commands from the appropriate root if it is a workspace project.

Create the backend environment file, verify configuration loading, start PostgreSQL, and apply migrations. JWT, bcrypt, Zod, Express, Socket.IO, TypeScript, and the PostgreSQL client should already be declared by the application; do not replace its dependency versions with an arbitrary install list.

**If defined in the backend's `package.json`:**

```sh
npm run dev
```

For a compiled build, **only if these scripts exist and `start` launches the built output**:

```sh
npm run build
npm start
```

The backend should attach Socket.IO to the same HTTP server or document a separate endpoint. Configure API and Socket.IO authentication and CORS. To accept ESP32 traffic, the server must listen on a LAN-accessible interface; `HOST` above works only if server code reads it.

## Frontend setup

Open a separate terminal in the example `frontend` directory:

```sh
cd frontend
npm ci
npm run
```

Use `npm install` if there is no npm lockfile. Create `.env.local`, verify Axios uses the configured API URL, and verify Socket.IO Client uses the server's origin/path.

**If the frontend defines a `dev` script:**

```sh
npm run dev
```

Open the URL printed by Vite. `http://localhost:5173` is the example used here; an occupied port or project configuration can change it. Update CORS to match the actual origin.

**If these scripts are defined:**

```sh
npm run build
npm run preview
```

Preview is for checking the built frontend locally. Tailwind setup varies with its installed version; preserve the repository's Vite/CSS configuration instead of assuming a particular Tailwind initialization command.

## ESP32 firmware setup and integration

### Flash the board

1. Install Arduino IDE and Espressif's ESP32 board package through Boards Manager, following the board's documentation.
2. Open the repository's actual `.ino` sketch. `firmware/LeakLens/LeakLens.ino` is an example path only.
3. Install libraries referenced by the sketch. Wi-Fi/HTTP support is normally provided by the ESP32 Arduino core; install a JSON library only if the sketch requires one.
4. Select the correct board and serial port.
5. Configure the verified GPIO assignments, driver polarity, calibration, and detection values.
6. Register a device using the implemented dashboard/API and provision its ID and unique credential into firmware.
7. Set the backend URL using the computer's LAN address, for example `http://192.168.1.100:5000/api/telemetry`. Replace both the address and route with actual values.
8. Upload the sketch and open Serial Monitor at the baud rate declared by the sketch.
9. Confirm sensor pulses, Wi-Fi connection, accepted telemetry, and dashboard updates.

`localhost` on the ESP32 means the ESP32 itself. Use a reachable backend hostname or LAN IP. Allow the backend port on the development computer's private-network firewall and check that Wi-Fi client isolation is disabled for the test network. Use HTTPS with certificate validation for deployment beyond a controlled local test.

### Detection implementation guidance

- Use separate interrupt-capable inputs and pulse counters; keep interrupt handlers short.
- Snapshot/reset shared counters safely and use the actual elapsed sample time.
- Calibrate both sensors independently against a measured volume.
- Align measurement windows and account for startup transients, sensor noise, and low-flow limitations.
- Require sustained threshold exceedance instead of reacting to one sample.
- Define boot, power-loss, disconnect, fault, and manual-reset behavior explicitly.
- Latch a confirmed incident until an intentional recovery procedure; zero flow after cutoff alone does not prove the leak is repaired.
- Use bounded network timeouts/retries so local control keeps running.
- Prevent retries from double-counting telemetry or creating duplicate leak events, using the implementation's sample/incident identifiers.

Do not copy a generic pulse factor or threshold without testing. Sampling cadence, telemetry cadence, confirmation duration, and physical valve response are different quantities and should be documented separately.

### Example telemetry contract

**Proposed JSON only — match the backend's actual Zod schema before sending:**

```json
{
  "deviceId": "YOUR_REGISTERED_DEVICE_ID",
  "sampleId": "boot-identifier:42",
  "observedAt": "2026-09-08T10:30:00Z",
  "inletFlowLMin": 8.4,
  "outletFlowLMin": 6.9,
  "leakDetected": true,
  "valveCommand": "closed"
}
```

Values are illustrative, not measurements or threshold defaults. Store server receipt time separately from device observation time. If device time is unavailable or invalid, handle that explicitly rather than claiming a reliable timestamp. Report physical valve state separately if feedback exists.

## API overview

**All routes below are proposed documentation placeholders, not verified endpoints.** Replace them with the actual router paths, request schemas, and response formats. The example base URL is `http://localhost:5000/api`.

| Method      | Example route                    | Purpose                                               | Expected authentication                            |
| ----------- | -------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| GET         | `/health`                        | Service health; document whether DB health is checked | As implemented                                     |
| POST        | `/auth/register`                 | Create account, if self-registration is enabled       | Public with validation/rate limits                 |
| POST        | `/auth/login`                    | Authenticate and issue session/token                  | Public with validation/rate limits                 |
| GET         | `/users/me`                      | Current profile                                       | User JWT/session                                   |
| PATCH       | `/users/me`                      | Update profile                                        | User JWT/session                                   |
| POST        | `/users/me/password`             | Change password                                       | User JWT/session and current-password verification |
| GET / POST  | `/devices`                       | List owned devices / register device                  | User JWT/session                                   |
| GET / PATCH | `/devices/:deviceId`             | Read/update owned device metadata                     | User JWT/session                                   |
| POST        | `/telemetry`                     | Receive validated sensor telemetry                    | Device credential                                  |
| GET         | `/devices/:deviceId/telemetry`   | Time-filtered reading history                         | User JWT/session + ownership                       |
| GET         | `/devices/:deviceId/leaks`       | Leak-event history                                    | User JWT/session + ownership                       |
| GET         | `/devices/:deviceId/analytics`   | Usage, loss, estimated savings                        | User JWT/session + ownership                       |
| GET         | `/notifications`                 | User notification history                             | User JWT/session                                   |
| PATCH       | `/notifications/:notificationId` | Mark owned notification read                          | User JWT/session                                   |

For a bearer-token design, user requests carry `Authorization: Bearer <USER_JWT>`. An example device mechanism is `X-Device-Key: <DEVICE_KEY>`; use it only if implemented by the backend. Device keys must be bound to the registered device and cannot be replaced by a client-supplied `deviceId` alone. Never send a user's password with telemetry.

Define pagination, UTC time filters, range limits, and error schemas in the actual API. Typical errors include `400` for invalid input, `401` for invalid credentials, `403` for unauthorized access, `404` for missing resources, and `500` for server errors, but verify the implemented contract.

No remote valve-control route is assumed. Remote control requires a separate authenticated command/acknowledgment protocol and must not compromise local cutoff behavior.

## Socket.IO events

**Proposed event names and payload contents — replace with actual server/client contracts:**

| Direction       | Example event        | Intended contents                                            |
| --------------- | -------------------- | ------------------------------------------------------------ |
| Client → server | `device:subscribe`   | Device ID; server verifies ownership before joining a room   |
| Client → server | `device:unsubscribe` | Device ID to leave                                           |
| Server → client | `telemetry:update`   | Device ID, timestamp, inlet/outlet readings, reported states |
| Server → client | `leak:detected`      | Stable incident ID, device ID, detection time                |
| Server → client | `valve:updated`      | Device ID, command/state, timestamp, confirmation source     |
| Server → client | `leak:resolved`      | Incident ID, resolution timestamp/status                     |
| Server → client | `device:status`      | Device ID, online/offline state, last seen                   |
| Server → client | `notification:new`   | Notification ID, type, message, timestamp                    |

Authenticate the handshake and authorize each device subscription. Never broadcast one user's device data to all clients. The Socket.IO transport path and application event names must match at both ends. Socket.IO Client expects a Socket.IO server, not an arbitrary raw WebSocket endpoint.

On reconnect, refresh the latest state/history through REST and resubscribe as required; do not assume missed events are automatically replayed. Remove component listeners during cleanup to prevent duplicate updates. Store durable events before announcing them.

## Run locally

After replacing example paths/configuration and verifying the scripts:

1. **Database, terminal 1:** run `docker compose up -d db` from the root containing the supplied Compose file.
2. **Schema:** apply the project's verified migration procedure.
3. **Backend, terminal 2:** run the backend's verified development script, such as `npm run dev` if defined.
4. **Frontend, terminal 3:** run the frontend's verified Vite development script.
5. Open the frontend's printed URL and register/sign in through the implemented flow.
6. Register a device and configure its firmware with the returned identity/credential.
7. Flash the ESP32, inspect Serial Monitor, and verify readings appear on Overview.
8. Test a controlled flow imbalance and confirm local alert/cutoff and persisted event history.

| Service                 | Example address                    |
| ----------------------- | ---------------------------------- |
| Dashboard               | `http://localhost:5173`            |
| Backend API             | `http://localhost:5000/api`        |
| Socket.IO server origin | `http://localhost:5000`            |
| PostgreSQL from host    | `localhost:5432`                   |
| Backend from ESP32      | `http://<BACKEND_LAN_IP>:5000/api` |

To stop development, use `Ctrl+C` in the frontend/backend terminals and `docker compose down` for the database. Firmware continues running while powered; follow the documented hardware shutdown procedure.

## Testing

### Application checks

Run `npm run` in each package to discover its real scripts. **Each command below is conditional on that script being defined:**

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

No test framework, coverage target, or passing test result is asserted. If a script is absent, use the repository's documented alternative; do not treat these example names as installed functionality.

Useful automated coverage includes pulse-to-volume conversion, sustained-threshold logic, input validation, authentication and ownership checks, duplicate sample handling, leak-event transitions, analytics interval integration, and Socket.IO subscription authorization. Use a separate test database for tests that write data.

### Manual API smoke test

Only if the example health route is implemented:

```sh
curl http://localhost:5000/api/health
```

On Windows PowerShell, use `curl.exe` if `curl` resolves to a PowerShell alias. For telemetry, save a payload matching the actual schema to a local `telemetry.json`, then use the actual credential header and route:

```sh
curl -X POST http://localhost:5000/api/telemetry -H "Content-Type: application/json" -H "X-Device-Key: REPLACE_WITH_TEST_DEVICE_KEY" --data-binary @telemetry.json
```

This command is an example and may put the test credential in shell history. Use a disposable local-test device credential and revoke it afterward. Verify the database record and dashboard update; an HTTP success alone does not prove the whole flow works.

### Hardware acceptance checks

| Test                      | Expected behavior to verify                                  |
| ------------------------- | ------------------------------------------------------------ |
| No flow                   | Stable readings within sensor limitations; no false incident |
| Balanced flow             | Inlet/outlet agree within calibrated tolerance               |
| Brief imbalance           | Confirmation logic suppresses transient alerts               |
| Sustained controlled leak | Buzzer activates, valve closes, incident is recorded         |
| Wi-Fi/backend outage      | Local sampling and cutoff still work                         |
| Reconnection/retry        | No duplicated samples, volumes, or incidents                 |
| Restart / power loss      | Valve and alert behavior match documented defaults           |
| Second account            | Cannot read or subscribe to another user's device            |

Use a controlled test loop with collected water and protected electronics. Record the sampling interval, confirmation duration, time from leak onset to physical cutoff, trial count, and measured volume. Report measured results with their test conditions; do not reuse illustrative résumé figures as test evidence.

## Troubleshooting

| Symptom                                | Checks / resolution                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` fails                         | Verify working directory, Node compatibility, and matching lockfile; use `npm install` only when appropriate for a missing lockfile |
| Missing npm script                     | Run `npm run`; replace the example with the actual script from `package.json`                                                       |
| Docker cannot start                    | Check Docker is running and the required virtualization/runtime is configured                                                       |
| Port 5432 already in use               | Stop the conflicting local service or change `POSTGRES_PORT` and the host backend URL                                               |
| Database connection refused            | Check container health, hostname, port, credentials, and backend environment loading                                                |
| Database password change has no effect | Existing volumes keep prior role credentials; update the role and connection string together                                        |
| Tables do not exist                    | Apply actual migrations to the database referenced by `DATABASE_URL`                                                                |
| Frontend cannot call API               | Verify Axios base URL, backend port, duplicate `/api` prefix, and browser network errors                                            |
| CORS errors                            | Match the exact browser origin, including port, in HTTP and Socket.IO configuration                                                 |
| Socket updates missing                 | Check handshake authentication, path, event names, device subscription, ownership, and listener cleanup                             |
| ESP32 cannot reach backend             | Use the host LAN address, reachable bind address, correct firewall rule, and Wi-Fi without client isolation                         |
| Telemetry rejected                     | Compare payload with Zod schema and verify device credential, registration, and active state                                        |
| Incorrect flow readings                | Verify pulse wiring, signal voltage, individual calibration, timing, orientation, and flow range                                    |
| False leak alerts                      | Check sensor alignment, startup transients, legitimate branches, threshold, and confirmation duration                               |
| Valve fails to close                   | Check supply, driver logic, polarity/default state, wiring, and mechanical operation                                                |
| ESP32 resets when valve switches       | Inspect power capacity, grounding, inductive protection, and electrical noise                                                       |
| Savings look unrealistic               | Review units, integration intervals, missing-data handling, duplicates, and counterfactual assumptions                              |
| Configuration changes ignored          | Restart affected dev services; reflash firmware when its constants change                                                           |

## Future scope

Potential additions, subject to implementation and validation:

- Validated remote configuration with firmware acknowledgments and an audit trail.
- Valve-position feedback and hardware fault diagnostics.
- Offline telemetry buffering and robust replay handling.
- Improved calibration, adaptive thresholds, and anomaly detection.
- Notification delivery through email or mobile channels.
- Multi-device comparisons, reports, and data export.
- Database retention/aggregation policies and deployment observability.
- Full application containers, CI checks, and reproducible deployment instructions.
- Firmware updates with a documented recovery process.

## Contributing

**Maintainer placeholder:** Add the preferred issue tracker, contribution policy, and contact information.

1. Open an issue describing the bug or proposed change.
2. Fork/clone the repository and create a focused branch.
3. Follow the actual setup and coding conventions.
4. Run the available checks relevant to your change.
5. Submit a pull request describing behavior, validation, and any hardware impact.
