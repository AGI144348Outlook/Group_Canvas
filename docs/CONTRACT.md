# Group Canvas — shared implementation contract `gc/1`

**Status: DRAFT for Codex review.** Nothing below is implemented yet. Authored by Claude
at Timothy's request, built from `CODEX-RESPONSE-v0.2.md` §4–7 (Echo_Green_Future
`handoffs/canvas-companion-v0.2/`). Once Codex and Claude agree and Timothy approves,
this file becomes the source of truth; changes after that go through a reviewed edit
with a contract version bump.

## 0. Decisions already made by Timothy

| Topic | Decision |
|---|---|
| Product | Independent subscription app, deployed on Timothy's Cloudflare account via Workers Builds from this repo |
| Authority | One Durable Object per room is the single authoritative processor. Canvas Companion v0.2 (Python) is the reference implementation and test oracle only |
| Work split | Claude: identity/auth, permissions enforcement at the connection, provider adapters, AI seat turns, budgets. Codex: command processor, receipts, versions, widgets, job lifecycle, retention |
| Sequence | 1 contract → 2 room auth fixes → 3 command port → 4 providers + inbound agents → 5 browser/touch/Pyodide checks → 6 accounts + billing before charging |
| AI providers v1 | **OpenAI, Anthropic, Google Gemini**, called directly. OpenRouter and local Ollama are out of v1 |
| Python | Runs **only in the author's own browser tab**, enforced server-side at claim |
| Sign-in provider | **Not chosen yet.** v1 uses the interim signed-token identity in §2, behind a seam the provider plugs into later |

## 1. Repository layout and ownership

Separate modules; nobody edits another owner's module without a reviewed change.

| Path | Owner | Purpose |
|---|---|---|
| `src/worker.js` | shared | Routing only: static assets, room creation, invite redemption, `/room/<id>/ws` |
| `src/room/Room.js` | shared | Durable Object shell: wires sockets → auth → processor → broadcast. Thin |
| `src/auth/` | Claude | Token signing/verification, invites, membership, `authenticate()` |
| `src/commands/` | Codex | `process(ctx, principal, command)`, receipts, fingerprints, versions, validation |
| `src/widgets/` | Codex | Widget kinds and schemas (port of `schemas.py` + cross-field rules) |
| `src/jobs/` | Codex | Python job lifecycle, leases, tombstones, retention |
| `src/events/` | Codex | Durable event log, cursors, per-principal filtering, snapshot builder |
| `src/agents/` | Claude | AI seat turns, reply validation, translation to commands, chain limits |
| `src/providers/` | Claude | `openai.js`, `anthropic.js`, `gemini.js`, capability matrix, error normalization |
| `src/budget/` | Claude | Reservations/settlement; room-level now, account-level later |
| `public/` | shared | Client. UI may hide actions, but never relies on hiding for security |
| `test/fixtures/` | shared | Behavioral scenarios (§10), run against both the DO and the Python reference where applicable |

## 2. Identity

### 2.1 Principal

```js
Principal = {
  id: string,                 // stable, opaque
  kind: "user" | "guest" | "agent" | "system",
  room: string,               // tokens are room-scoped in v1
  role: "owner" | "editor" | "member" | "viewer",
  epoch: number,              // membership epoch at issue time (revocation)
}
```

Identity comes **only** from a verified credential. A seat ID, a name, a caller-supplied
principal field, or anything a model outputs is never identity evidence.

The seam: `authenticate(request | firstSocketMessage, env, roomState) → Principal | null`.
When a sign-in provider is chosen, only `src/auth/` changes; everything else consumes
`Principal`.

### 2.2 Interim credential (until a sign-in provider is chosen)

- **Room token:** HMAC-SHA256 over `{sub, room, role, kind, epoch, iat, exp, jti}`,
  signed with Worker secret `ROOM_SIGNING_KEY`. `exp` ≤ 24 h. Delivered once, kept by the
  client in browser storage, sent as the first WebSocket message (not in the URL).
- **Room creation:** `POST /api/rooms` creates the room and returns an owner token.
- **Invites:** owner creates an invite (role, max uses, expiry). Only a SHA-256 hash of
  the invite code is stored. Redeeming it creates a membership and returns a token.
- **Refresh:** a valid token can be exchanged for a fresh one before `exp` while
  membership still exists.
- **Revocation:** each membership has an `epoch`. Revoking or changing a role increments
  it; tokens with an older epoch are rejected, and **open sockets for that principal are
  closed immediately**. Every socket message is checked against current membership, not
  just at connect.

This replaces the "seat resume secret" idea: resuming a seat means authenticating as the
principal that owns it.

### 2.3 Seats

- A human seat belongs to exactly one principal (`seat.principal`). Only that principal
  can act through it.
- An AI seat has `controller: "server"` and **can never be claimed by a socket**.
  It acts only through `src/agents/` under a system-issued `agent` principal.
- Inbound external agents (v1 step 4) get their own `agent` principal and token, bound
  to one seat, role at most `editor`.
- Seat IDs are public, non-secret labels.

## 3. Permissions

Minimum role per operation. Every check runs server-side in the processor.

| Operation | Minimum | Extra rule |
|---|---|---|
| Read snapshot / events | viewer | Filtered per principal (§5.3) |
| `chat.say` (main thread) | member | |
| `chat.say` (side thread) | member | Must be a thread member |
| `thread.open` | member | Only with seats the caller can see; reuses an identical member set |
| `seat.move` | member | Own seat only |
| `widget.create/update/delete` | editor | |
| `widget.clear_all` | owner | |
| `python.queue` | editor | |
| `python.claim` | editor | **Caller must be the job's requester** (author-only) |
| `python.complete` | — | Must hold the active lease (runner + lease + expiry) |
| `python.cancel` | editor | Requester or owner |
| `seat.ai.add/remove`, `seat.ai.configure` | owner | Billable |
| `member.invite/set_role/revoke` | owner | |

Agent principals (internal AI seats and inbound agents) are capped at `editor` and can
never perform owner operations or `python.claim`.

## 4. Commands

### 4.1 Envelope (client → room)

```js
Command = {
  contract: "gc/1",
  id: string,                 // 1–160 chars, unique per actor per room
  op: string,                 // from §4.3
  payload: object,
  expectedVersion?: number,   // required for widget.* only
}
```

The actor is attached by the room from the authenticated socket. The envelope has no
actor/principal field; one present is rejected as `invalid`.

### 4.2 Result (room → caller)

```js
{ type: "result", id, status: "accepted", version, outcome }
{ type: "result", id, status: "rejected", code, reason }
// code: "unauthenticated" | "forbidden" | "invalid" | "not_found" |
//       "conflict" | "collision" | "limit" | "unavailable"
```

### 4.3 Operations in `gc/1`

`chat.say`, `thread.open`, `seat.move`, `seat.ai.add`, `seat.ai.remove`,
`seat.ai.configure`, `member.invite`, `member.set_role`, `member.revoke`,
`widget.create`, `widget.update`, `widget.delete`, `widget.clear_all`,
`python.queue`, `python.claim`, `python.complete`, `python.cancel`.

Group Canvas's ad-hoc canvas shapes become widgets. **Codex to define a `shape` widget
kind** (rect / circle / line / text with geometry and color) or confirm reuse of
`drawing`. Payload schemas for every op live with their owning module and are exported
for MCP/tool projection.

### 4.4 Processing order (one `transactionSync`, no `await` inside)

1. Authorize: current membership, role, epoch, op-specific rule (§3).
2. Deduplicate: look up receipt `(room, actor, id)`. Same fingerprint → return stored
   result. Different fingerprint → `collision`.
3. Version check: `widget.*` checks room version and `expectedWidgetVersion`.
   `python.*`, `chat.*`, `thread.*`, `seat.*` do not use the room version.
4. Validate payload and state; apply.
5. Write receipt and durable event(s); bump room version for `widget.*` and membership ops.
6. Commit. **Then** broadcast. A broadcast failure never turns a commit into a rejection.

**Fingerprint** = SHA-256 of canonical JSON of `{contract, actor, room, op, payload}`.
`expectedVersion` is excluded.

## 5. Events and transport

### 5.1 WebSocket messages

Client → room: `{type:"auth", token}` (must be first, within 5 s), `{type:"command", command}`,
`{type:"resume", after: cursor}`, `{type:"ephemeral", kind:"typing"|"pointer", data}`.

Room → client: `{type:"hello", principal, seat, role, cursor}`,
`{type:"event", cursor, event}`, `{type:"snapshot", cursor, state}`, `{type:"result", …}`,
`{type:"ephemeral", from, kind, data}`, `{type:"error", code, reason}`.

### 5.2 Durable events

- `cursor`: monotonically increasing integer per room.
- Retained: last 1,000 events or 7 days, whichever is more (tunable).
- `resume` with a cursor still retained → replay; otherwise → authorized snapshot.
- Ephemeral messages (typing, pointers) have no cursor and are never stored.

### 5.3 Audience and filtering

Every event carries `audience`: `"room"`, `{thread: id}`, or `{principal: id}`.
Live sends, replays, and snapshots all apply the same filter for the receiving
principal. Non-members see that a side thread exists and who is in it, never its text.
Neither a cursor nor an ID grants access.

## 6. Durable Object concurrency

- All state changes go through `ctx.storage.transactionSync` with SQL. No network call,
  model call, or `await` inside a transaction.
- **AI turn** (owned by `src/agents/`):
  1. Transaction: check seat exists, chain depth, one in-flight turn per seat; reserve
     budget; record `turn.started`.
  2. Outside any transaction: call the provider with `AbortSignal.timeout(30_000)`.
  3. Validate the reply (§7.3).
  4. New transaction: re-check that the seat and its thread membership still exist and
     the reservation is live; submit each action through `process()` as the seat's agent
     principal; settle budget. Anything that fails re-authorization is discarded.
- **Hibernation:** each socket's attachment holds `{principalId, epoch, exp}` only.
  Every incoming message re-reads membership; nothing authoritative lives in memory.

## 7. Providers and AI seats

### 7.1 Adapter interface

```js
ProviderAdapter = {
  id: "openai" | "anthropic" | "gemini",
  capabilities: { nativeTools, jsonSchemaOutput, streaming, images, maxContextTokens },
  complete(request, { signal }) → Promise<NormalizedResponse>,
}
request = { model, system, messages: [{ role: "user"|"assistant", name?, text }],
            tools: [{ name, description, inputSchema }], maxOutputTokens, temperature? }
NormalizedResponse = {
  text, toolCalls: [{ name, args }],
  usage: { inputTokens, outputTokens },
  finish: "stop" | "length" | "tool" | "error",
}
ProviderError.code: "auth" | "rate_limited" | "overloaded" | "invalid_request" |
                    "timeout" | "content_filtered" | "unknown"
```

Each adapter declares its capabilities explicitly. "Same API family" is not assumed to
mean identical behavior; a capability matrix test runs against each real provider.

### 7.2 Keys

Platform keys are Worker secrets: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`.
Keys never appear in snapshots, events, logs, errors sent to clients, or model prompts.
Bring-your-own-key is deferred to the accounts step.

### 7.3 Seat actions

Models act only through these tools; native tool-calling where the adapter supports it,
validated JSON otherwise:

`say{text}`, `whisper{toSeat, text}`, `move{x, y}`, and widget proposals mapped 1:1 to
`widget.create/update/delete` payloads.

Validation: unknown tools dropped, at most 10 actions per turn, text ≤ 4,000 chars,
every action becomes a `Command` through `process()` — a model reply never writes state
directly. Chain limit: 3 consecutive AI-to-AI turns before a human must speak.

## 8. Budgets

- Interface: `reserve(scope, estimate) → reservationId`, `settle(id, usage)`, `release(id)`.
- v1 scope: the **room**, with durable daily limits (turns and tokens) from Worker vars.
- After accounts exist, authority moves to an account record (Cloudflare D1), and rooms
  reserve against the owning account. This is required before charging; per-room limits
  alone can be dodged by opening more rooms.

## 9. Python

- Code runs only in the requester's own tab. `python.claim` is rejected for anyone else.
- The client never runs another member's code automatically.
- Outputs are shared with the room as data, rendered with `textContent` only.
- A browser tab is not treated as an isolation boundary.

## 10. Shared acceptance scenarios

**From the Python reference (Codex):** duplicate retry after reconnect; changed-intent
collision; competing widget edits; lease forgery and expiry; unrelated edits during job
execution; retention with tombstones; rollback; revocation; snapshot/replay recovery;
notification failure after commit.

**New for the room (Claude):**
1. Joining with another human's public seat ID gives no access to it.
2. No socket can act as an AI seat.
3. Viewer cannot write; member cannot do editor or owner ops.
4. Revoked principal's open socket is closed and its old token rejected.
5. Private thread text never reaches non-members: live, replay, or snapshot.
6. AI reply arriving after its seat is removed changes nothing.
7. Budget exhaustion stops turns; nothing is charged twice on retry.
8. Provider timeout and malformed model output each leave state unchanged.
9. Non-requester `python.claim` is rejected.
10. A key never appears in any client-visible message.

## 11. Still open

- Sign-in provider and guest policy (Timothy).
- Plan pricing and allowance numbers (Timothy).
- `shape` widget kind vs reuse of `drawing` (Codex).
- Inbound MCP auth/OAuth scope (step 4).
- Retention numbers for events, receipts, and job bodies in production.

## Review requested from Codex

Agree, amend, or object section by section, with the same verified/unverified split.
Especially §2.2 (interim identity), §4.4 (version exemptions), §5.3 (audience), and
§6 (turn flow inside the Durable Object).
