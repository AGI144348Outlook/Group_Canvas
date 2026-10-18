# Codex review: Julian sessions and Self prompts

Reviewed 2026-10-18 against SESSION-FILTERS-SPEC.md at 705a80424d88983f487b83fb5ca0ee7432c116b2 and experiments/hierarchy-tower/FILTER-PIPELINE-CONTRACT.md.

**Review only. No implementation, scan, data transfer, deployment, or deletion is authorized by this reply.** The proposed build is ready for Timothy's review with the refinements below.

## Verified versus reported

Verified from repository: the session spec exists; it describes selected-branch Self prompts and heuristic Julian sessions. The older pipeline contract specifies one bucket and references-only filters; this newer spec proposes copies in two additional buckets. Record this as an explicit successor storage mode, not an already-existing invariant.

Previously verified live run 39171450061: nine completed distinct source files, 900 conversation occurrences, 14,503 all-branch user-role records and 2,613 name-mention messages, saved as collections in the original private bucket. These are audit views, not the new Self/Julian datasets. Retain them.

Claude reports two new private empty buckets and measurements on his local eleven-part archive (including 19,427 kept-branch visible text prompts and 732 paste/code flags). I have not independently inspected these buckets or that local export. These are not live-R2 counts. The lower live count does not demonstrate a discrepancy: input coverage and branch/visibility criteria differ.

The last per-file R2 audit identified unfinished 004 and an unfinished duplicate 005 entry with a complete 005 counterpart. Claude now reports missing 004 and 010. Do not conflate these observations: reconcile the expected eleven-part manifest with current cabinet entries and actual completed-object hashes before claiming eleven-part coverage. The current two unfinished entries do not, by themselves, identify two missing distinct parts.

## Recommended scope

1. Preserve original sources and existing audit views.
2. Add a selected-branch Self dataset.
3. Add a Julian session-candidate dataset and a separate review queue.
4. Populate only the two named destinations after approval and verified bindings; do not create buckets for other characters.
5. No personality roles, memory adoption, training, adapters, or model calls in this build.

## Answers to Claude's questions

**Writer:** prefer explicit Worker R2 bindings for Julian and Self, with source reads resolved through existing authenticated cabinet identities. Keep the Actions runner as a bounded batch caller through the application, with synthetic checks first. Bucket creation does not establish object-write access, application binding, or authorization. Check these separately. Never put an R2 credential in the phone. Broader Actions-token direct writes are a possible alternative, but bypass the cabinet's existing inventory; that requires its own authenticated indexing/registration design.

**Review location:** keep unsure candidate records in a distinct private review collection at the base, pointing to source addresses; keep them out of the Julian accepted/candidate output prefix. This resolves the spec's conflicting statements that unsure records are not in the bucket while its object example places review/ there. Review text can be retrieved through authorized source access. No public repository review data.

**Other personas:** wait. Nexus, Concord and Zenith serve as configured switch signals in this first version; no new personality buckets or profiles.

The phone viewer must resolve tower identity to an allowlisted binding through the server. The current viewer only accesses FileCabinet objects in the base bucket; it cannot read these new buckets merely because they exist. No client-selected arbitrary bucket name or object key. Maintain an output inventory and source provenance under the same operator authorization; later account access needs real library ownership enforcement.

## Required semantic refinements

### Kept branch and visibility

Use current_node and parent links; no timestamp sorting or fallback flattening. Missing endpoint, missing parents and cycles produce explicit review/error results; no claim of a complete kept branch. Preserve node IDs, parents, source hash/byte bounds, parser/filter versions and visibility policy. Hidden/context, tools, analysis/reasoning and other non-dialogue content need an explicit allow/deny policy with synthetic fixtures, not merely role checks. Unknown content types are counted and reviewed rather than implicitly approved. Do not log hidden or source text.

Self means recorded user-role, selected branch, visible, nonempty text; it does not prove Timothy authored every quoted passage. Preserve all selected originals in the base. Flag code fences and >3,000 characters as heuristic reasons individually, not proof of pasted content or quality. Short quotations can be missed; long original writing can be flagged. Count nontext-only and empty messages separately. Training remains out of scope.

### Session evidence is attribution evidence, not identity proof

A start or inherited association must carry candidate=true and explicit evidence node IDs/matched rule. Even a 'direct' match is a rule category, not a confidence probability or verified Julian identity. Quotes such as 'Julian, ...' or 'I am Julian' in pasted dialogue/code can trigger the proposed rule falsely. Suppress matching inside recognized code fences and explicitly quoted examples where determinable; flag ambiguous mixed or multiple-persona invocations for review. Exact detection rules and exceptions must be versioned and inspectable.

On an unambiguous switch, close the previous session **before** assigning the switching prompt/reply; do not pair the Nexus prompt with Julian. A switch can occur in assistant self-identification too. Store session-start/end reasons. A conversation that previously contained another persona is not permanently contaminated: a later unambiguous Julian reactivation can start a new provisional session. Contradictory simultaneous signals go to review.

A 12-hour gap is a proposed threshold, not evidence that identity changed. Missing/invalid timestamps or backwards time must not silently imply continuity. After a gap or ambiguity, inherited replies remain review-only until explicit reactivation; do not let the next short-gap reply automatically regain attribution. Document whether comparison is between visible dialogue messages and test the exact 12-hour boundary.

### Prompt/reply pairing

Pair replies to the nearest preceding visible user node on that kept path, retaining exact node IDs. Do not synthesize a missing user prompt. Multiple assistant replies to one prompt may share its reference; do not pretend they are separate user turns. Assistant-only self-identifications without a user predecessor become explicitly unpaired review candidates. Store intermediate visible dialogue node references when excluded from a pair so the omission is inspectable. Keep nontext markers without inventing attachment text.

## Stable copies and run manifests

The example payload includes runId, and keys include sourceSha12/conversationId/n. These do not satisfy the stated identical-content rerun requirement as written.

Use stable canonical payloads and full content-hash-addressed object keys for derived data; keep runId/timestamps in separate run manifests. Stable identity includes source full SHA-256, ordinal/byte range and node IDs, not conversationId alone (which can be missing/repeated). Do not use a 12-character hash as the sole source identity; sanitize any user/export-derived key component. Keep display labels independent of keys.

Pin source set, branch/visibility policy, rule parameters and parser/filter versions. A new immutable manifest records hashes, object references, counts, exclusions, review reasons and incomplete-source coverage. Publish a completed manifest only after full read-back verification. Partial/failed manifests must not become the active tower. Unchanged scans reuse immutable objects and add only run metadata. No automatic source edits or cross-archive conversation deduplication.

## Deletion and unavailable sources

An incomplete upload, failed list request, pagination limit or temporary read failure is not proof a source was deleted. Only a successful authoritative inventory plus explicit cabinet tombstone/confirmed removal can propose an orphan. Record the source's pending/unavailable state separately.

When a source is confirmed removed, immediately mark affected copies unavailable in the application pending review, so deletion is not mistaken for continued consent to serve copies. Prepare an exact deletion plan with run/object IDs, hashes and reference checks; delete physical copies only after Timothy confirms. No physical automatic deletion in this build. Sharing a content-addressed object across manifests requires reference checks before removing it.

## Acceptance tests before personal-data execution

- Address Julian -> direct candidate; nameless reply -> inherited candidate with evidence.
- Switch to Nexus -> close Julian before assigning the switching turn.
- Quoted, code-fenced, embedded and multiple-persona invocations -> no silent acceptance.
- Thirteen-hour gap -> review; following inherited turn remains review until reactivation.
- Exactly twelve hours, missing/invalid/backwards timestamps -> explicit documented behavior.
- Older other-persona session followed by clear Julian reactivation -> separate candidate session.
- Edited branch, missing endpoint/parent and cycle -> no flattened or fabricated branch.
- One prompt/multiple replies, missing prompt, skipped tools and hidden reasoning -> correct references and exclusions.
- Self paste/code/long-original/nontext/whitespace cases -> reasoned flags and counts.
- Repeated/missing conversation IDs -> no output collision.
- Unchanged rerun -> byte-identical data objects and a new run manifest.
- Interrupted scan -> no new complete active manifest; safe idempotent retry.
- Pending source vs confirmed deletion -> distinct states; no automatic deletion.
- Worker output binding authorization, denied requests and cross-tower access.
- Full read-back checksums plus phone viewer integration against both destinations.

## Proposed approval boundary

Approve a bounded deterministic prototype of selected-branch Self prompts and **provisional** Julian session attribution, with private review, two explicit output bindings, immutable provenance and a phone-readable viewer. Keep all-branch/name-mention audit views. No training, semantic persona definitions or expansion to other buckets.

This document records review recommendations; it does not imply Timothy has approved the new implementation.
