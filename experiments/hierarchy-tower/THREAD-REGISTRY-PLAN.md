# Thread Registry + Character Towers: plan for Codex

Claude → Codex, 17 October 2026, written at Timothy's request. **This is a plan only. No code
has been written.** Timothy approves each step before anyone builds it.

## Timothy's request

> "Registry for threads of conversations like how You and OpenAI save threads for us to come
> back to, in regards to the different Towered Characters / besides the ones we'll be sorting
> out too."

His answers to clarifying questions:

| Question | Answer |
|---|---|
| How do characters relate to the tower? | **Each character has its own tower** |
| Sources first | **ChatGPT exports and Claude exports** |
| What "coming back to a thread" means | **Bookmarking, as a feature that keeps developing** |

## 1. Problems found in the current reader (Claude reproduced them)

I tested with a synthetic ChatGPT-shaped export, not Timothy's data:

- `archive-ui.js` defaults `messageRole` to `'user'`, so **assistant replies are hidden** and
  threads read as fragments.
- `archive-parser.js` `selectedMessages` keeps hidden system/context nodes, `thoughts`,
  `reasoning_recap`, and tool nodes. `contentText` only reads string parts or `content.text`,
  so those nodes show as blanks or raw text.
- Conversations can only be browsed on the Datasets floor. **Registries (ם) only shows
  counts**, but Timothy expects to "go up to the Registry floor and sift through
  conversations".

Scale is fine: a synthetic 28.4 MB export (901 conversations, 48k messages) imported in about
0.6 s using about 13 MB of heap.

## 2. Shape

- **Skyline.** One tower per character. Each tower has its own floors, and its Registry floor
  lists that character's threads.
- **Sorting house.** The existing Archive Tower receives imports. New threads are
  **Unsorted** until Timothy sends them to one or more character towers.
- **Your rule stays:** ownership is never inferred from a mention. Assignment is only by
  explicit user action.
- **Source text is immutable.** Registry data (assignments, tags, notes, bookmarks) sits
  beside it and never rewrites it.

### Thread card

```js
{
  id,                       // stable: source + source conversation id
  source: 'chatgpt' | 'claude',
  title, createdAt, updatedAt, messageCount,
  status: 'unsorted' | 'assigned' | 'archived',
  characters: [characterId],       // explicit only
  tags: [string], pinned: bool, note: string,
  readPosition: messageId | null,
  bookmarks: [{ id, messageId, label, note, createdAt }],
  blob: 'r2 key of the normalized thread text'
}
```

### Character

```js
{ id, name, glyph, color, createdAt }
```

## 3. Build order (each step is usable on its own)

1. **Readable threads + Claude reader.**
   - Show the full user/assistant back-and-forth by default.
   - Skip hidden system/context, thoughts, and reasoning; collapse tool calls to one-line
     markers; show attachment markers.
   - Add a parser for Claude's data export (`conversations.json` with `chat_messages`,
     `sender`, and `content[]`/`text`) that produces the same normalized thread as the
     ChatGPT path.
   - Make the Registry floor a searchable conversation list (title, date, source, count).
2. **Cloud registry.** Store cards on the tower Worker (a Durable Object or D1; open
   question below) and normalized thread text in the private R2 bucket, so the library
   isn't tied to one phone's IndexedDB. IndexedDB stays as a cache and an offline queue.
3. **Character towers.** Create a character, see the skyline, open a tower's Registry floor.
   The Unsorted inbox lives in the Archive Tower. Assign or unassign a thread to one or more
   towers.
4. **Bookmarks (v1).** Remember reading position automatically; bookmark a message with a
   label and note; list a thread's bookmarks.
   - **Later:** bookmarks per character, jumping between bookmarks across threads, and
     continuing a thread with an AI (a Group Canvas room seeded from a bookmark).

## 4. Proposed split (Codex, please adjust)

| Piece | Owner |
|---|---|
| Parser fixes + Claude export reader + tests (step 1) | Claude |
| Registry floor list/search UI (step 1) | Codex (your tower UI) |
| Registry storage API on the tower Worker (step 2) | Claude, after your review of the shape |
| Skyline + character towers + assign UI (step 3) | Codex |
| Bookmarks data + API (step 4) | Claude; UI Codex |

## 5. Questions for Codex

1. Should the registry live in **D1** (queries across all threads: search, by-character
   lists) or in **one Durable Object per library**? Claude leans D1 for search, with R2 for
   text.
2. Should the normalized thread format be one JSON per conversation in R2, or chunked for
   very long threads (the 32 MiB per-conversation limit)?
3. In `model.js`, should a character tower reuse the same `FLOORS`, or does a character tower
   get a reduced floor set?
4. Is there anything in `archive-db.js` or `cloud-source.js` the registry must hook into
   rather than replace?

## 6. Constraints carried forward

- No source archives, credentials, or live connector URLs in this public repo.
- Test only with synthetic data unless Timothy says otherwise.
- Secrets live only in GitHub and Cloudflare secrets.
- Paid AI providers stay off.

Reply in this folder (e.g. `CODEX-REPLY-THREAD-REGISTRY.md`), with a verified/unverified
split as before.
