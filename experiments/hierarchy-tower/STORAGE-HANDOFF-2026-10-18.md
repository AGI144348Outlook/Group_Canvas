# Codex → Claude: citadel source storage contract

Requested by Timothy on 2026-10-18. Coordination issue: https://github.com/AGI144348Outlook/Group_Canvas/issues/1 . Work stays on `experiment/hierarchy-tower`; main is unchanged.

## User context and objective

Timothy has only an Android phone. Already-exported and unzipped OpenAI conversations may be too large for GitHub. Source datasets must not be committed to this public repository. The citadel foundation must reference persistent source files, with text-first ingestion before personality curation or appearance. Character citadels and a text-derived counterpart remain later work.

## Implemented path

Android file picker → File (phone or Drive provider) → private R2 multipart source → source/foundation reference → bounded authenticated reads → browser-local IndexedDB conversation index. The existing local-only importer is included in this patch; its previous publication was canceled and never reached the branch.

Google Drive here means choosing Drive in Android's file provider UI when available. It is not Google OAuth, direct Drive API browsing, account linking, background scanning or access to arbitrary Drive files. The provider can stage a whole file on the phone. Real Android behavior has not been exercised here.

### Storage API (same origin)

- `GET /api/storage/config`: public readiness, bounds and connection mode; no credentials.
- `POST /api/storage/uploads`: strong `x-source-create-key` operator code; source name, size, sampleHash and declared foundationId. Returns new upload id and random private capability once.
- `GET /api/storage/uploads/:id`: Bearer upload capability; manifest, status and verified part records.
- `PUT /api/storage/uploads/:id/parts/:n`: same capability and `x-part-sha256`; raw body exactly the expected part length. 8 MiB chunks, maximum 5 GiB source. Server recomputes checksum. Identical retry returns saved part; collision rejects.
- `POST /api/storage/uploads/:id/complete`: same capability. Requires every part; checks stored size and metadata. Recovers if R2 completion succeeded before DO metadata update.
- `GET /api/storage/uploads/:id/source?offset=&length=`: same capability, completed sources only, maximum 8 MiB range; no public object URLs.

`TowerUpload` DO serializes requests per source and stores metadata/part receipts. R2 stores bytes under a generated key; client filenames are metadata only. Raw source objects use application/octet-stream. Capability hashes, not capabilities, are stored in DO metadata. R2 bucket must remain private. No shared-room signing secret is reused. Workflow copies the existing operator CREATE_ROOM_KEY into the separate Worker secret SOURCE_CREATE_KEY solely to gate creation.

### Client and indexing

Capability is kept in IndexedDB `cloudUploads`, not query strings, repository files or exported dataset manifests. Resume reselects the source, checks its sampled fingerprint and rehashes previously confirmed chunks before skipping them. Interrupted chunk sends are retried explicitly through server receipts. The create operation itself is not idempotent: a lost creation response may leave an empty orphan upload.

Index stored source creates/opens the declared foundation's local dataset and supplies an authenticated range-backed File-like object to the archive worker (1 MiB reads). It preserves selected branches and all original mappings, exact per-conversation text, roles, byte bounds, record hashes and transactional checkpoints. Local indices remain browser-local; R2 source storage alone does not make normalized registries cloud-persistent or grant AI access.

Foundation association is a declared reference, not an authorization grant over any other dataset. Existing local indices are matched using size and sampled fingerprint; that is not full source identity verification. Resume sampling covers first and last 64 KiB. Need stronger verification before treating a relationship as authoritative.

## Deployment

`group-canvas-tower` is a separate preview Worker. The workflow checks/creates private bucket `group-canvas-citadel-sources`, then deploys `wrangler-storage.toml` and uploads SOURCE_CREATE_KEY if available. The Cloudflare token needs R2 permissions and the account must have R2 enabled. If preparation fails, it deploys local import with no R2 binding and visibly disables cloud upload. Actual readiness must be reported from deployment logs; do not equate a green workflow with cloud storage being enabled.

## Claude: requested review / next work

1. Review upload capability boundaries, DO serialization and crash recovery; independently exercise deployed R2 without using personal data.
2. Review API failure semantics and credential recovery: no account sign-in, revocation/rotation, user export of credentials or account-level budget exists yet. This is an operator-only prototype, not a public subscription service.
3. Implement or propose cleanup/abort/deletion and R2 incomplete-upload lifecycle. Lost browser state loses upload credentials. Owner can inspect objects through Cloudflare, but there is no app recovery path yet.
4. Review foundation attribution and require stronger source verification before semantic assignment. Do not silently infer character ownership from a mention.
5. If possible, Android-test phone and Drive selection, app switching, upload timeout/resume, private source indexing, IDB quota and keyboard layout.
6. Propose the bounded Lattice source-query contract and cloud index persistence after source storage works. No model calls, autonomous curation or avatars in this phase.

## Verification and limits

29 automated cases: 4 tower/static, 14 parser/recovery and 11 upload-handler cases. Upload tests use fake R2/DO storage, not a live bucket. Browser IndexedDB/Web Locks, remote file reads and real Android UI are not integration-tested here. No real user source or API key has been imported. Readiness and setup failures will be recorded separately in issue #1.
