# Private R2 file cabinet

Timothy shelved character/adapters work to focus on filing and storage. This phase adds a dedicated Android-first `files.html` interface, independent of archive parsing and AI calls. Main Group Canvas is unchanged.

## Implemented

- Operator-code unlock, kept in page memory only. The same configured SOURCE_CREATE_KEY gates listing, uploads, labels, discovery, and deletion. Lock/refresh requires re-entry. This is one private operator cabinet, not multi-account storage.
- All file types, 1 byte to 5 GiB, with 8 MiB chunks and server-computed SHA-256. Pending uploads are registered before bytes; an interrupted upload can be found and resumed from another browser after unlocking. Reselect the original file. Already-confirmed chunks are rehashed and checked, not blindly overwritten.
- Named flat collections (Inbox plus up to 100 custom collections), paged file inventory, display-name changes and virtual collection moves. IDs/object keys and original bytes are unchanged by filing labels. File names never determine R2 object paths.
- Private native-browser downloads stream from R2; the app does not build the whole file into a browser Blob. A 60-second bearer download URL is minted after operator authentication. Treat it as private; it can be reused during that short interval and is checked against file availability. Do not put it in repository handoffs. Interrupted downloads require a fresh link; resumable byte-range downloads are not claimed.
- Explicit confirmed file deletion deletes completed R2 bytes or aborts pending multipart uploads. Metadata tombstones make retries idempotent and block stale downloads. No recycle bin/undo. Original phone/Drive files are untouched.
- Discovery of earlier completed citadel source objects, then explicit adoption into the cabinet without copying or changing bytes. Old partial uploads that never produced R2 objects cannot be discovered this way.

## Android / Drive

Use the phone's file selector and choose Drive if its Android file provider is available. This is not direct Google OAuth/account browsing. Drive may stage the whole file locally before selection completes. App switching requests a pause, but Android can stop tabs without warning. The saved server inventory and receipts remain authoritative; select Resume and reselect the original source.

## Architecture

`filingAPI` authenticates operator requests before forwarding to a private FileCabinet Durable Object. Inventory records and collections persist in DO storage, outside GitHub/browser memory. Bytes remain in the existing private R2 bucket. A second SQLite-backed DO binding/migration adds CABINETS; existing UPLOADS/source state remains intact.

The upload actor now has binding-only internal status/part/completion/download/removal operations. Public /api/storage routes cannot name these internal paths, and forged headers do not bypass original per-upload capabilities. Cabinet operations resolve registered file IDs; metadata reference IDs alone grant no access. This assumes the Worker binding is trusted. There is no exposed public DO hostname.

Public downloads are the sole bounded bearer route: high-entropy short-lived path, no-store, no-referrer, octet-stream and attachment disposition. In-memory operator code is never sent in a URL. Source content is never rendered as HTML. Existing source capabilities are not returned by the cabinet or required for adoption. Removing a source can make old citadel/index references unavailable; it does not secretly rewrite those references.

## Limits

The prototype shares one cabinet among holders of the operator code. No account roles, recovery workflow, billing/storage quotas, user-specific permissions or automatic retention policy exists. Do not market it as a general public storage service. Collection filtering scans bounded inventory pages; there is no global file-content search. Collections cannot yet be renamed/deleted. Lost/expired native download links are reissued from the authenticated cabinet. Incomplete upload housekeeping still needs a retention/abort policy beyond explicit file deletion. Cabinet list pagination is by stable storage keys, not a newest-first index.

## Verification

12 filing tests exercise real handler-to-handler calls with fake DO/R2 storage: auth, idempotent registration, virtual filing, multipart retries/status, streamed download bytes, invalid tickets, complete/pending deletion, internal endpoint protection, collisions, readiness and earlier-source adoption. Existing 44 tower/import/storage/adapter tests are rerun (56 total). `filing-live-check.js` is added after deployment: it creates only a synthetic 8 MiB + 3 byte file, retries a chunk, resumes via status, completes, lists, downloads/verifies, renames and removes synthetic bytes. Its logs, not code presence, determine whether live storage works. Cleanup failures identify the synthetic source ID without printing credentials/tickets. No personal dataset is used. Real Android visual/file-provider behavior remains unverified here.

## Claude handoff

Please focus review on this file-storage scope; character, neuroplasticity and adapters are shelved. Inspect the binding-only internal operations and ticket lifetime/download headers. Independently Android-check unlock → phone/Drive selection → pause/reselect/resume → download → rename/move → explicit deletion, using synthetic files only. Do not assume that account auth, collection hierarchy, byte-range native download resume or global search has been added. Coordinate in repository issue #1.
