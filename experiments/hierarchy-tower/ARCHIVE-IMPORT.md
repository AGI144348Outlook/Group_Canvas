# Text-first conversation archive ingestion

## User path on Android

1. Open the tower preview and enter Datasets (ground floor).
2. If necessary, extract OpenAI's export ZIP in Android's Files app. Select the existing conversations.json; ZIP extraction is not part of this importer.
3. Name the dataset foundation and tap Import conversation archive.
4. Keep the tab visible. Pause is available. Switching apps requests pause, but Android can terminate a tab without a final event.
5. Return using the same browser and origin. Tap Resume on a partial dataset, reselect the original source, and resume at its last committed conversation boundary.
6. Browse imported conversations in pages of 25. View selected-branch user messages, assistant messages, all roles, or all source nodes. Messages are paged in groups of 40. Export individual original conversation objects or an import manifest.

## Preserved evidence

Each dataset has a generated id and a matching foundation reference, source filename/size/last-modified metadata, sampled fingerprint, status and committed checkpoint. Every conversation retains its exact original JSON object substring, original conversation ID if present, source byte bounds, ordinal, SHA-256 hash, roles/counts and warnings. The full mapping retains parent/child references, system/tool messages, non-text structures and metadata. Duplicate source IDs remain separate ordinal records. Whitespace within original conversation objects and glyph notation are unchanged. Array separators/outer whitespace are not stored; keep the original file for complete archive preservation.

The selected reading follows current_node backward through parent references. No fallback branch is silently guessed when the marker is absent. All-node mode explicitly indicates source mapping order rather than asserting chronology. User-role filtering is an authorship view, not a curated/approved personality dataset. Assistant interpretations remain distinguishable. Attachment pointers remain in raw JSON; files, images and audio are not ingested.

## Storage and recovery

A dedicated worker frames an array incrementally in 64 KiB chunks and parses one conversation at a time. A 32 MiB limit on one conversation bounds individual processing; it does not limit the whole file. Browser memory still includes the parsed conversation and storage serialization, so memory is not claimed to equal one chunk. Very large individual conversations require a later importer.

IndexedDB stores raw conversation records, lightweight browse summaries and dataset manifests. A single transaction commits each conversation, its summary and checkpoint. Failed writes do not advance progress. Native Web Locks prevent concurrent tabs writing the same dataset. Browsers without Web Locks receive an explicit compatibility error. Schema, truncated-file and quota failures stop visibly and retain previously committed records; records are not silently discarded.

Resume matches size and SHA-256 over the first and last 64 KiB. This is a practical reselection check, NOT a full-file content guarantee: a same-size file modified only in the unsampled middle may pass. Each imported conversation has a separate full record hash. A future stronger resume option could verify the complete source at additional I/O cost.

No source content leaves the browser and no model calls occur. Static assets load from the host; importer dependencies are same-origin. Browser storage is subject to quota, eviction and user clearing. A persistent-storage request is provided, but permission is not guaranteed. The local importer itself provides no cloud backup, cross-device sync, account isolation or application-layer encryption. The separate private source-storage option is described in STORAGE-HANDOFF-2026-10-18.md; it preserves source bytes, not cloud copies of this local index. Source datasets are logically separated by generated IDs within the browser origin; this is not a multi-user security boundary. Exported manifest is metadata only, not a substitute for the source archive. This phase does not implement deletion of imported archives; native browser site-data clearing removes local imports and notes.

## What this adds to the hierarchy

Datasets contains real imported records alongside clearly marked interface samples. Registries displays counts and explains source identities. There is no automatic personality/profile creation, character attribution, adaptive learning, avatar selection, or higher-floor population. Lattice remains a provisional name; this patch does not claim to implement a GraphQL interface or global full-text search. Conversation browsing uses an IndexedDB compound-key index.

## Validation

18 tests: 4 tower/static worker tests plus 14 parser/import tests. Cases cover Unicode/escape boundaries with tiny chunks, malformed JSON, explicit size limits, branch selection, missing markers/cycles, role/non-text preservation, source fingerprints, duplicate IDs, pause/resume, transactional-write failure simulation, malformed later records and wrong-file rejection. Storage is injected for checkpoint tests; actual IndexedDB transactions, Web Locks, worker lifecycle and visual behavior require real-browser/device validation. No real user export was available or imported during development.
