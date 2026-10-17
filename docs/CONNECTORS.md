# Connector links (inbound MCP for outside AIs)

Added by Claude, 2026-10-16, at Timothy's request. Prototype step toward contract §2.3
"inbound external agents"; OAuth remains future work.

## What it does

The room owner taps **⚡ Connect an outside AI**, names the seat, and gets one URL:

```
https://<host>/api/rooms/<room-id>/mcp/<64-hex key>
```

Pasting it into Claude (Customize → Connectors → Add custom connector, **No sign-in**) or
any MCP client gives that AI its own seat (✦, "Connected from outside · MCP") with the
tools `room_inspect`, `say`, `widget_create`, `widget_update`, `widget_delete`.

## Design

- `POST /api/rooms/<id>/connector` (bearer-authenticated) generates the key server-side,
  submits `connector.create` with only its **SHA-256 hash**, and returns the URL once.
  The raw key is never stored, logged, or included in snapshots/events.
- `connector.create` (owner only, role 3): creates an AI seat with `controller:'external'`
  and an `agent` member with role `editor`, plus `state.connectors[hash] = {seat, created}`.
  Limits: 5 links per room; shares the 8-AI-seat cap.
- `/mcp/<key>` resolves hash → seat → current membership and builds the principal from
  room state, so every call goes through the normal `engine.submit` authorization path.
  Agents keep the existing restrictions (no owner ops, no `python.claim`).
- **Revocation:** removing the seat (`seat.ai.remove`, the × in the people list) deletes
  the member, the seat and its connector entry; the link then returns 401.
- External seats are excluded from `/turn` (they answer through their own app) and from
  the client's AI target list.
- The MCP handler is now shared (`mcp()` in `src/api.js`) by both the bearer route and
  the keyed route. Additions: `ping`, protocol-version echo for 2025-06-18 / 2025-03-26 /
  2024-11-05, server `instructions`, and tool errors returned as `isError` results
  instead of plain HTTP errors.

## Verified (Claude, 2026-10-16)

- `npm test`: 46/46 pass (41 existing + 5 new in `test/connector.test.js`).
- Live, local server + real Chromium: owner created a link in the UI; the **official MCP
  TypeScript SDK client (1.32.1, Streamable HTTP, no auth, URL only)** initialized,
  listed tools, read the room, created a quiz widget and spoke; the owner's phone-sized
  page showed both live with no page errors.

## Not yet verified

- Claude.ai's and ChatGPT's own connector clients against the deployed Worker.
- Behavior under the Cloudflare Durable Object (first deploy of this code).

## For Codex

Please review `connector.create` in `src/commands/index.js` and the keyed route in
`src/api.js` against contract §2–3. Open question: a link has no expiry by design
(connectors break otherwise); revocation is by seat removal. Should links also get an
optional expiry or rotation?
