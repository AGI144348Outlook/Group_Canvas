# Session towers + Lattice queries + inert retrieval cards

Timothy approved the reviewed session-filter build on 2026-10-18 and asked whether the existing adapter cards and GraphQL-like interface help. This prototype connects deterministic filtering, bounded authenticated queries and optional local card registration. No AI provider, persona role, model training or automatic card activation.

## Implementation

- Original source: existing private `group-canvas-citadel-sources`, unchanged.
- Self outputs: explicit `SELF_OUTPUT` binding to `group-canvas-tower-self`.
- Julian outputs: explicit `JULIAN_OUTPUT` binding to `group-canvas-tower-julian`.
- Review: `derived-session-review/` in the source bucket, separate from source objects and Julian output.
- Server: existing FileCabinet durable object forwards `/api/files/towers/*` under the existing operator-code boundary; no client-selected bucket names.
- Data: immutable full-hash-addressed JSON parts, max 2 MiB, at most 500 records. Each output record carries full source/hash/byte-range/node provenance. Separate immutable manifests plus DO run records/active pointers. No record timestamps/run IDs in data that would change between identical scans.
- Runner: GitHub Actions invokes the authenticated application API; does not hold direct R2 keys. Source bytes temporarily downloaded into private runner files and deleted afterward. Source content is not logged or uploaded as artifacts. Full source hashing, exact-file deduplication, bounded incremental conversation parsing (32 MiB/conversation), one source (max 512 MiB) at a time. Per-source chunks are written and read back before manifests activate. Every derived write is also independently fetched and SHA-256 verified by the runner. Incomplete upload entries are excluded and recorded.

The existing all-branch/name-mention views remain intact. Earlier one-bucket/references-only contracts describe those audit views; this approved successor copies selected derived text into the two already-created buckets. No other buckets are created here. These are copies linked by evidence, not a new authoritative source.

## Filter policy 1.0.0

Only `current_node` → parent paths. Missing endpoints, missing parent nodes and cycles produce review records; no invented chronology or merged branches. Allowed roles user/assistant; only null/final channels and text/multimodal_text content. Hidden metadata, tools, reasoning channels and unknown content types excluded with counts. Nontext-only/empty user messages counted separately. Attachments remain in original source.

Self: visible, selected-branch, nonempty user-role text, including alternate wording only where on that selected branch. Code fences and >3,000 characters flag possible pasted material without dropping it or proving authorship.

Julian: conservative, rule-based **candidate attribution**, never verified identity. User addressing or assistant self-identification opens a session; unambiguous other-persona invocation closes it before pairing. Clear Julian reactivation can open a new session. Named personas are Julian, Nexus, Concord and Zenith. Code fences, visibly quoted lines and double-quoted passages are masked for start/switch matching; mixed or quoted signals are reviewed. These heuristics can miss quotations, narrative examples or aliases. No name rule proves the speaker is Julian.

Gaps >12 hours, missing/invalid/backwards timestamps, or ambiguous signals taint inherited continuity until explicit reactivation. Exactly 12 hours is allowed. Times compared between retained visible dialogue messages. Replies pair with nearest preceding visible user node; multiple replies may share a prompt. No missing prompt is fabricated. Unpaired replies go to review. Direct/inherited categories are rules, not confidence probabilities. Ambiguous invocation records and unsure reply records may overlap; review counts are records, not unique messages.

## Lattice query interface (JSON, not a GraphQL parser)

All routes require existing `x-filing-key` operator authentication; private no-store responses. This prototype is shared-operator access, not multi-account authorization or an installed MCP connector.

- GET `/api/files/towers/config`: binding readiness.
- GET `/api/files/towers`: active run summaries.
- POST `/api/files/towers/query`: `{tower:'self'|'julian'|'review', first:20, after:{part,offset}, manifestHash?}`; returns records, pinned source references and next cursor. Bound to one saved part/request; pages may have fewer than 20 records.
- Same query with `operation:'manifest'` gives coverage/counts; `operation:'inventory'` provides manifest metadata for reconciliation even when sources are unavailable.
- Pinned evidence query: `{tower,manifestHash,hash:partHash,after:{offset:index},first:1}`.
- PUT `/api/files/towers/:tower/objects/:sha256`: bounded, source-validated, immutable derived part/manifest write. Cannot address arbitrary object keys. No arbitrary code or GraphQL resolver execution.
- POST `/api/files/towers/commit`: validates verified parts/counts/sources, stores immutable run summary and advances that tower's active pointer. Tower commits are independent, not a cross-bucket atomic transaction.
- POST `/api/files/towers/verify-bindings`: writes/reads/removes only unique synthetic probe objects in the three bound destinations.

Any missing/incomplete/tombstoned source or missing physical source object makes content query and cloud evidence resolution fail closed. Current prototype checks all sources of the selected manifest; one unavailable source therefore blocks that manifest's whole content view. Metadata inventory remains available. Confirmed removal and missing/pending/read failures are not conflated. Runner lists removal candidates for review; **no automatic or user-triggered output deletion API is implemented**. Old data objects remain physically stored until a separately reviewed deletion plan is built and approved.

## Phone flow

`/sessions.html` → enter operator code → choose Self, Julian or Review → Open tower records → inspect source details → optional **Save an inert retrieval card**. The query behind the view is visible. Source cards save only references in browser-local event history; no evidence text/credentials saved in the card. Local card creation requires Web Locks. Registry limit remains 128 cards. Export backups from the card desk.

`/adapters.html` → Cloud evidence access → re-enter operator code in that page → inspect/explicitly activate or suspend a retrieval card → Review context. A card pins a manifest, part hash and record index, not a mutable active-run alias. Cloud resolver verifies source availability and record address; part checksums are verified server-side before response. Julian evidence remains labeled candidate in composed context. Cloud card edits preserve cloud references. Cards and activation history are still browser-local, not R2/D1 persistent account registries. Model adapter/LoRA entries remain catalogue-only.

## Limits and validation

No real Android visual/keyboard session has been tested here. Screen is touch-oriented, pages render 20 records; pressing Next replaces the visible page (Open tower records returns to the beginning). New upload completion requires rerunning deployment/batch workflow. Manifest source limit 100, part limit 1,000; one derived record >1.8 MiB stops the new scan explicitly. The batch is not a durable Worker background scheduler. API writer role is the prototype operator, not a separate least-privilege service account. A later subscription product needs account/library ownership, quotas, separate writer permissions, durable checkpointed jobs and cloud card storage.

Tests: seven session cases; five service/auth/storage/query cases; two cloud-card cases; real-service mocked batch integration (source duplicate, incomplete entry, verified output, manifests, original preservation), plus prior filing and adapter suites. Deployment must separately verify actual binding access and real scan outcomes before claiming success.
