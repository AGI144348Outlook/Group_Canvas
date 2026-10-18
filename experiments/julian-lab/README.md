# Julian — first symbolic neuroplasticity test

Timothy selected Julian as the first test character on 2026-10-18. This isolated lab implements a narrow subset of the proposed mechanisms; it does not instantiate a conversational persona, invent Julian's traits or claim biological neuroplasticity.

## Implemented

- Blank stable character reference; profile proposals remain separate, source-linked inert records.
- Explicit trial outcomes (supported, contradicted, unresolved), retained as evidence records rather than converted into numerical semantic weights. These are software protocol labels, not definitions of Timothy's generalized evaluator symbols.
- Context-specific assignment and replacement by explicit user commands; prior cards and events remain preserved.
- Dormancy and restoration without payload deletion or automatic reactivation.
- Indexed return checkpoints and visit history; least-visited selection resists scheduler capture.
- Bounded card/event budgets; failed changes leave the prior state intact.
- Serializable state and replayable events, including idempotent command retries.

This corresponds to a small portion of D2/E1/C1/C2 from the candidate-algorithm discussion. No decimal strengthening, automatic truth assignment, model training, elasticity solver, automatic semantic propagation or fixed glyph semantics are introduced.

## Verified

`node experiments/julian-lab/engine.test.js` — 10 tests, all synthetic. Covers blank identity, source/text retention, no automatic activation after success, contextual replacement, suspend/restore, conflicting evidence, fair return, JSON/event replay, budget limits and retry collisions.

## Boundaries

The core is a pure offline state-transition module, not a public API. `actor: user` is an input label in tests, NOT authentication. Actual integration must derive user authority from the existing authenticated service. Archive source references are required fields, but their existence, ownership and character attribution are not verified by this lab. Trial outcomes are supplied by fixtures/reviewers, not independently discovered or measured. SHA/source verification and permission checks belong to the source/registry integration.

The runtime identity `julian-test` is a test reference, not an authoritative character registry ID. No Julian archive has been read, no real semantic profile has been assigned, no R2 data has been written and no avatar decision is made. State can be serialized by callers; no UI, browser persistence, cloud persistence or live companion connection is added here.

## Claude handoff / next integration

Julian is the chosen first neuroplasticity test. Please coordinate in issue #1. Before connecting this lab to actual character data:

1. Keep original sources immutable and make character assignment reviewable.
2. Supply the shared ChatGPT/Claude thread fixture and stable source/message identities.
3. Select reviewed passages supporting two alternative profile cards; do not invent traits to populate a demo.
4. Agree on a bounded trial question and evidence criteria, preserving counterexamples and unresolved outcomes.
5. Connect a phone-facing comparison/replacement view to authenticated commands and persistent history. Let the user explicitly assign/restore alternatives.
6. Verify a changed active profile can return to its prior card without losing either source or identity. Only then investigate governed relational propagation.

This selection authorizes Julian as the initial test case; it does not finalize the rest of the candidate-algorithm catalogue or make the lab's proposed rules architectural invariants.
