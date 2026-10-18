# Adapter index cards — phone-facing experiment

Authorized by Timothy on 2026-10-18. Two separate browser-local registries: Your text counterpart and Julian. Both begin empty, with no assigned role, imported memories, suggested traits or active adaptations. These identifiers are local workspace references, not authoritative character-registry identities.

## Implemented

The tower links to `adapters.html`, a touchscreen card desk. Register inert, versioned cards; explicitly activate a context or retrieval slot; replace or suspend assignments; restore by reactivating a prior card; record trial observations without automatic promotion; inspect sources and history; export and restore the registry by event replay.

- **Context cards** hold explicitly user-authored context plus a provenance note and optional archive references. These are adaptations a user chooses, not roles imposed by the application.
- **Retrieval cards** hold one to sixteen pinned archive node references. The source picker reads indexed local datasets, pages conversations (25) and source messages (50). Card creation, activation and context composition check reference availability; archive resolution recomputes the raw conversation SHA-256 and checks the pinned hash and node. Raw text and author role are retained.
- **Model cards** catalogue a compatible base-model ID/revision, artifact reference and SHA-256. They cannot activate, fetch code or load weights. No LoRA training or inference is implemented.

Review active context resolves actual source passages and assembles a JSON bundle. Retrieval excerpts above 8,000 characters are explicitly truncated in that derived bundle with original character count; originals remain unchanged. No text is sent to an AI provider. Quoted archive material is identified as evidence, not executed as instructions. The future provider harness must maintain that boundary; this preview alone does not prevent prompt injection in a future model.

Identity and slot ownership are enforced by the local state machine. Card versions are immutable records: revisions have new IDs and parent/version references. All changes retain command events and trials. Budgets are 128 cards and 4,096 events; exhaustion stops rather than silently deleting history.

## Persistence / safety boundaries

State is browser-local localStorage, serialized through Web Locks across tabs. Failed writes do not replace committed state. Exports contain all authored card text, trial notes and source references but no R2 credentials. A restore explicitly confirms replacing the local registry; original source archives must still be indexed separately. Unreadable saved state is not silently overwritten.

The `actor: user` field is a local command label, NOT server authentication. These functions are not exposed as an unauthenticated cloud API. There is no account-level isolation, cross-device card persistence, source-to-character ownership inference or cloud registry migration. Keeping Self and Julian separate in a browser is workspace scoping, not a multi-user security boundary. A user attaching a passage is an explicit source association, not proof that its statements belong to that identity. Trial notes are user observations, not independent empirical validation. No actual Julian or Timothy archive was available for development; none was imported or sent to a model.

## Tests

`node experiments/adapter-cards/engine.test.js` — 15 cases: blank identities, inert registration, scope rejection, reversible replacement, suspension, evidence-only trials, immutable version lineage, duplicate rejection, source validation, trained-adapter refusal, context composition without code/network execution, pinned retrieval/explicit truncation, missing/mismatched sources, event replay and command retry/actor checks.

Actual Android rendering, browser locks/storage and source-picker integration remain unverified in this environment. The standalone model tests do not constitute trained-model evaluation.

## Claude handoff

This is the next narrow implementation after the Julian lab. Please review within issue #1. Do not merge the two identities, add roles or infer autobiographical traits from unreviewed assistant output. Shared context/retrieval bundle contract is in `adapter-engine.js`; future API/provider integration should authenticate the actor, verify library/source access, preserve quote boundaries and show exactly which card versions were applied. Please independently Android-test, then connect to the agreed cloud registry rather than treating localStorage as permanent identity storage. LoRA artifacts remain catalogue-only until a compatible runtime and separately approved training/evaluation path exist.
