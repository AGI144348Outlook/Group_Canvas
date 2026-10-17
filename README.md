# Group Canvas — runnable prototype

A shared white, gridded workspace where people and AI companions make things together. Persistent objects appear as movable, resizable, collapsible windows. A companion can have a personality, create its own avatar, make a quiz or demonstration, and manipulate the same widgets as a person.

This is an independent application. Echo's symbolic architecture is not embedded in it.

## Try it locally

Install **Node.js 22.13 or newer** (Node 24 recommended), open this repository in a terminal, and run:

```sh
npm start
```

Open **http://127.0.0.1:8787**. No dependency installation, API key or account is needed for the local prototype.

1. Click **Create a canvas**. An avatar and welcome note appear.
2. Click **Make a game**. The offline companion creates a playable quiz.
3. Drag a window's header, resize its lower-right corner, or collapse it.
4. Add notes, tables, charts, drawings, shapes, Python widgets or avatars.
5. Use **Share room** to generate a one-use invitation. Another browser can join the same server using the room ID and code.
6. Reload the page: your objects are restored from SQLite.

Offline demo mode follows fixed rules; it is labeled in the interface and is not a language model. Choose a real provider to let an AI interpret requests and propose widgets freely within the supported widget types.

The local server binds to loopback. Sharing across devices requires an appropriately hosted instance, such as the Cloudflare adapter below. A room invitation on a different local server will not work.

## Included

- Eight safe widget kinds: note, avatar, quiz, table, chart, drawing, shape, Python.
- Persistent shared rooms, chat, AI seats and personality configuration.
- Signed, room-scoped temporary credentials; roles; one-use invitations; membership revocation.
- One command processor for HTTP, MCP tools, AI actions and Cloudflare sockets.
- Version checks, idempotent command receipts, event cursors, filtered private threads and job leases.
- SQLite-backed local runtime with server-sent updates; Cloudflare Durable Object adapter with WebSocket updates.
- Optional direct OpenAI, Anthropic and Gemini adapters. Provider availability/model IDs depend on your account.
- Room-scoped MCP endpoint: `POST /api/rooms/<room-id>/mcp`, using a room Bearer token.

## Optional real providers

Keep keys on the server. The browser neither asks for nor receives provider keys.

For a local operator, configure environment variables before `npm start`:

- `ROOM_SIGNING_KEY`: optional locally; if omitted a private persistent key is generated in `.data/signing.key`.
- `CREATE_ROOM_KEY`: a private random operator code of at least 24 characters.
- `ALLOW_PAID_PROVIDERS=true`: explicitly enables real-provider turns.
- One or more of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`.

With paid providers enabled, a strong room-creation code is required. Enter that code in the welcome screen. This temporary operator gate prevents anonymous visitors from simply creating new billable rooms. Room members authorized to request turns still consume the operator's allowance/key; account-level billing and budgets are not implemented.

Use **Add an AI companion**, select a provider, choose an available model ID, and describe its personality. Send a message with that companion selected. It can create/update/delete widgets and speak through validated commands. Real calls incur provider charges; none were made while building this prototype.

BYOK enrollment, account authentication, subscriptions and payment processing are deferred. Never put real secrets in GitHub files or command history.

## Cloudflare adapter

`src/worker.js` and `src/room/Room.js` use a SQLite-backed Durable Object as the single room authority. Node and Cloudflare share the same engine; they are alternative runtimes, not two synchronized writable databases.

For a developer:

```sh
npm install
npx wrangler secret put ROOM_SIGNING_KEY
npm run deploy
```

Use a random signing key of at least 32 characters. Deployment creates Cloudflare resources and should be performed on the intended account. **This prototype has not been deployed or executed in Wrangler here.**

From a phone, connect `AGI144348Outlook/Group_Canvas` to Cloudflare Workers Builds, use `npm install` as the build command and `npx wrangler deploy` as the deploy command, then configure `ROOM_SIGNING_KEY` as an encrypted Worker secret. Start with offline demo mode. Provider secrets and the operator gate can be configured afterward. Builds cannot be validated from this workspace because no Cloudflare credentials are available.

## Python execution

A Python widget runs only after its user presses **Run in my tab**. That click creates a job owned by that credential session; server-side claim/complete checks enforce the requester, session, runner, lease and expiry. Other people, other credential sessions and agents cannot claim it. Pyodide downloads from jsDelivr on first use, in a dedicated worker. The main page terminates that worker on a 15-second execution timeout. Output is stored as data and rendered as text.

This is an author-session boundary, not proof against copied bearer credentials or browser compromise. Browser Python is not an adversarial sandbox. Browser/Pyodide execution remains unverified in this environment.

## Tests and status

```sh
npm test
```

**41 behavioral tests pass.** See [VALIDATION.md](docs/VALIDATION.md) and [implementation notes](docs/IMPLEMENTATION.md). Tests cover the real request handlers, transactions and SQLite, with mocked provider responses and a shimmed Durable Object shell.

A Chromium smoke script is included at `tools/browser-smoke.py` for environments with Python Playwright and Chromium. Browser launch and listening sockets are blocked in the current execution sandbox; the script has **not passed here**. Do not confuse the passing handler tests with a visual or deployed-runtime test.

Prototype limits include no accounts/billing, no BYOK UI, no complete hosted MCP/OAuth connector flow, no automatic AI-to-AI loops, and no in-app private-thread creation UI. AI turns currently act only in the main conversation. State is stored as a transactionally updated JSON document in SQLite; it is adequate for a small prototype, not a demonstrated large-room design. Production storage/retention and abuse controls remain work.

## Storage and recovery

Local data lives in `.data/` (gitignored). Back up the database files and signing key together. Browser credentials live in session storage: keep the tab/session to retain access. Invitations create distinct identities; they do not recover a lost owner's identity. Credentials expire after 24 hours; the refresh endpoint exists but automatic renewal/account recovery UI is not implemented.

Terminal job bodies retain the latest 50 and expire opportunistically after seven days. Tombstones and receipts remain; prototype commands/turn records have a 20,000-record room limit. Event retention keeps at least 1,000 events and at least seven days, so a busy week's history can exceed 1,000. Snapshot export is a readable view, not a full credential-bearing backup.
