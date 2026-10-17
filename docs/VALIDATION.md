# Validation — 17 October 2026

## Executed

`npm test`: **41 tests passed**, Node.js 24.19.0, using Node's built-in SQLite and test runner.

- 21 command/identity/job/AI tests: versions, retries, permission hierarchy, rollback, revoked identity, private audiences, job ownership/session and leases, retention/tombstones, late AI responses, offline quiz execution and room allowance.
- 12 request/provider tests: authorized handlers, one-use invite redemption, MCP discovery and calls, null params and HTTP status behavior, cross-origin rejection, job-detail filtering, three mocked direct-provider responses, error redaction, missing-key rejection, operator creation gate and idempotent AI turn retry.
- 8 persistence/room tests: real SQLite reopening, injected SQL failure, Durable Object shell authentication and event dispatch under a test shim, seat takeover rejection, revoked socket closure, private live/replay filtering, turn deduplication and reservation release.

Syntax checks passed for the browser client, Pyodide worker and Worker entry point. Provider tests use an injected fetch function and synthetic responses. No paid/model requests occurred.

The Durable Object tests replace only the Cloudflare base class with a shim and supply SQLite/socket mocks. They test shell logic and the actual shared engine, not Cloudflare platform behavior or Wrangler compatibility. They are not a claim that all original 37 Python tests have been ported one-for-one.

## Blocked / not verified

- A local listening socket failed with `listen EPERM` at 127.0.0.1:8787. The follow-up network permission request stalled and was cancelled. No subsequent permission request was made.
- A port-free Playwright browser test was attempted. Chromium itself failed at launch with an OS `setsockopt: Operation not permitted` restriction. No browser screenshot or successful UI/Pyodide run is claimed.
- Real providers, actual MCP clients, OAuth, account-level subscriptions, Cloudflare deployment, Wrangler execution, touch gestures and multi-user browser load have not been verified.

`tools/browser-smoke.py` is included for a normal development environment. It routes browser requests to the real Node handlers over a JSON-lines subprocess, allowing UI testing without opening an HTTP port. Python Playwright and Chromium are optional development prerequisites. The bridge supplies a synthetic short SSE stream, so even a successful run would not replace testing real long-lived network reconnection.

The Node server, UI and Cloudflare configuration are supplied as a runnable prototype. Current evidence supports the command, handler, persistence and adapter logic; deployment and visual integration remain explicit acceptance steps.



## 3D increment — 17 October 2026

The expanded suite passes **64 tests**: the 46-test connector baseline plus 18 new scene scenarios. See `docs/SCENE3D.md` for the split between pure geometry/model tests, request-handler/connector verification and unverified WebGL rendering. New browser modules and the application pass syntax checks. Chromium launch and CDN download remain blocked in this sandbox. No deployment or paid model call was performed for this increment.



## Mannequin room and separate Vision Token experiment — 17 October 2026

`npm test`: **90 tests passed** (64 baseline, 13 room/environment, 13 Vision Token). `npm run vision:demo` also completed its close/export/import demonstration. Browser source syntax checks passed. No new browser, CDN, GPU, live connector or Cloudflare validation is claimed for this increment. See `docs/MANNEQUIN-ROOM.md` and the experiment README. The lab is not integrated into room authority.
