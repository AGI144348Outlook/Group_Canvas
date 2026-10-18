# Spec: Julian session filter and Self prompts filter → per-tower R2 buckets

Claude → Codex, 18 October 2026, written at Timothy's request. **Spec only. No code has been
written.** It extends your filter towers (`README.md` in this folder) and
`experiments/hierarchy-tower/FILTER-PIPELINE-CONTRACT.md`.

## Timothy's decisions

- Filter the main archive **for one character first**, and write a **copy** of the result into a
  separate R2 bucket for that tower. The main bucket `group-canvas-citadel-sources` stays the
  untouched base.
- Julian is often **the one responding**, so many of his replies never contain his name. The
  name-mention filter cannot find them; a session filter is needed.
- A second tower for **Timothy's clone: his prompts only.**

## Buckets (already created by Claude, private, ENAM)

| Bucket | Holds |
|---|---|
| `group-canvas-tower-julian` | Julian prompt→reply sessions copied from the base |
| `group-canvas-tower-self` | Timothy's own prompts copied from the base |

No objects have been written. The runner needs write access to both, either through the existing
Actions Cloudflare token (R2 object write on these two buckets) or new Worker bindings. Same
privacy rules as the base: no public access, no source text in logs or artifacts.

## What Claude measured (from Timothy's local export copy, not from R2)

Measured over all 11 export parts, 1,084 conversations. Your live R2 scan covers 9 of them, so
expect lower numbers until 004 and 010 are complete.

- No structural Julian marker exists: no custom-GPT `gizmo_id`, no `author.name`, nothing in
  custom-instruction context. `conversation_template_id` does not separate him either (241 of 257
  Julian conversations have none).
- 257 conversations contain "Julian". Mentions: 2,234 assistant, 523 user. Timothy addresses
  Julian directly in 312 messages; the assistant self-identifies as Julian in 61.
- Self: 19,999 user-role messages in all; **19,427** on the kept branch, visible, with text. 732 of
  those look like pastes or code (a code fence, or over 3,000 characters). 250 have no text.

## Filter A: `persona-session` (Julian)

Input: conversations, **kept branch only** (walk `current_node` back through `parent`).
Params: `persona: "Julian"`, `otherPersonas: ["Nexus", "Concord", "Zenith"]`, `gapHours: 12`.

1. **Session start.** Either Timothy addresses the persona (name at the start of the message, or
   followed by `, : ? !`) or the assistant self-identifies ("I am / I'm / this is / as Julian").
2. **Carry forward.** Every later assistant reply on the kept branch belongs to the session, even
   without the name.
3. **Session end.** Timothy addresses one of `otherPersonas`, the assistant self-identifies as
   another persona, or the conversation ends.
4. **Confidence tier per reply.**
   - `direct`: the reply that answers an addressing prompt, or a self-identifying reply.
   - `inherited`: a later reply in the same session.
   - `unsure`: more than `gapHours` since the previous turn, or the conversation contained a
     different persona earlier. Unsure replies are **not** written to the tower bucket; they go to
     a review list for the question filter (Timothy or a model decides later).
5. Mentions of Julian outside a session (talking *about* him) are not copied.

Hidden system/context, thoughts, reasoning and tool nodes are skipped. Their addresses can be kept
as markers but no text.

## Filter B: `self-prompts` (Timothy's clone)

Input: conversations, kept branch only. Keep user-role, visible, non-empty messages.

- Flag (do not drop) likely pastes: code fence, or over 3,000 characters. Flagged messages are
  written with `flags: ["paste"]` so training can exclude them without losing them.
- Attachment-only messages are skipped and counted.
- This replaces "every recorded user-role message across all branches" for the clone. Your
  existing all-branch prompts view can stay as a separate audit view.

## Object layout

```
group-canvas-tower-julian/
  sessions/<sourceSha12>/<conversationId>/<n>.json
  review/unsure-<runId>.json
  manifests/<runId>.json

group-canvas-tower-self/
  prompts/<sourceSha12>/<conversationId>.json
  manifests/<runId>.json
```

Session object (Julian):

```js
{ filter: 'persona-session', filterVersion, runId, persona: 'Julian',
  source: { fileId, sha256, conversationId, byteRange, conversationHash },
  turns: [
    { prompt: { nodeId, createTime, text },
      reply:  { nodeId, createTime, text, tier: 'direct' | 'inherited' } }
  ] }
```

Prompts object (Self): `{ filter: 'self-prompts', filterVersion, runId, source: {…},
messages: [{ nodeId, createTime, text, flags: [] }] }`.

Manifest: filter id/version/params, the source files scanned with SHA-256, counts per tier and
flag, every object key written with its SHA-256, and excluded/pending sources.

## Copies and deletion

The tower buckets hold **copies**, so deletions in the base do not propagate on their own. Each run
compares its source list against the previous manifest. Objects whose source is gone are listed
in the manifest as `orphaned`, and removed only after Timothy confirms. Rerunning on unchanged
sources must write identical objects (content-addressed keys, as you already do).

## Validation asked for

- Synthetic fixture covering: an addressing prompt starting a session; nameless inherited replies;
  a switch to Nexus ending it; a 13-hour gap producing `unsure`; an edited branch where only the
  kept version is copied; a code-paste flag.
- Live run: report counts per tier and flag from logs, and full SHA-256 read-back of written
  objects, as in your earlier runs. No text in logs.

## Questions for Codex

1. Is the Actions Cloudflare token the right writer for the two new buckets, or do you prefer
   Worker bindings?
2. Do you want `unsure` replies in the tower bucket under `review/`, or kept only in the base
   cabinet until decided?
3. Should Nexus, Concord and Zenith get their own buckets now with the same filter, or wait for
   Timothy?

Reply in this folder (e.g. `CODEX-REPLY-SESSION-FILTERS.md`). Timothy approves the build before
code is written.
