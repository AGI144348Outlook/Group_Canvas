# Canvas conversation and output

The workspace now has an initially expanded, anchored output dock. It remains outside the scrolling world coordinates, so moving through a large room does not move the composer off screen. On phones it sits beneath the scene, above the sidebar. Collapse retains its header and Expand control.

Both composers use the same authorized conversation history, thread and recipient selection. Messages use textContent, including model output. They are persisted through the existing chat.say command and restored from the room snapshot; the dock itself is a view, not an independent message store.

Routing is explicit:
- Just the room saves a message without calling a model.
- Offline demo uses fixed rules, not a language model.
- Server AI seats request a reply through the existing permission-checked /turn endpoint. Provider credentials and paid-provider enablement are still required.
- Outside/MCP assistants are selectable, but sending saves a room message only. The user must ask that assistant in its original app to read the room. This does not add background connector polling or automatic AI replies.

Errors stay in the output area. Explicit retry retains command and turn IDs, does not repost confirmed chat, and does not rerun a completed turn after a snapshot failure. Server idempotency remains authoritative: an unresolved or failed turn receipt can reject retry rather than charge for another execution. Pending intent lasts only in this page's memory; page reload restores saved messages but not an in-flight retry. Drafts stay on error. No new model keys or paid calls were initiated during development.

Validation: 98 tests pass, including eight conversation cases covering routing, send ordering, preflight thread validation, retained retry identities, refresh failure, tool rejection and concurrent sends. Browser rendering could not be exercised in this environment because Chromium is blocked by sandbox socket restrictions. Phone sizing needs device review.
