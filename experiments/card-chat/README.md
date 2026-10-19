# Source-grounded hosted model + adapter-card evaluation

Timothy explicitly requested connecting a Cloudflare-hosted model and testing adapter cards on actual saved data. This adds inference, not weight training. No dataset or excerpts enter GitHub or public logs.

## Runtime

Cloudflare AI binding `AI`; pinned model ID `@cf/meta/llama-3.2-3b-instruct`. Official catalog checked 2026-10-18: https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/ . Model existence in the docs is not proof account access works; the live evaluation is required.

Existing operator-authenticated `/api/files/towers/chat/config` and POST `/api/files/towers/chat` use the FileCabinet actor. Body: identity self/julian, UUID request ID, current user message, bounded local card event history, optional last six user/assistant messages. Replay validates card registration/version/assignment invariants. Same-identity pinned cloud references resolve through Lattice, with source-availability and stored part SHA-256 verification. Browser-supplied evidence text is never accepted as a verified source. Context guidance is user-authored presentation/context input, separate from archival evidence.

Only active retrieval cards supply evidence. Registering a card is inert; replacement switches the slot; suspension empties it. No lexical/semantic search across all history is implemented: a retrieval card is an explicit evidence selector, not automatically a trained or relevance-ranking filter. Existing model/LoRA catalogue cards remain unexecutable. No persona roles or autobiographical identity claims are assigned. The same hosted base model serves both separate evidence scopes.

Chat has no model tools and cannot write archive or card state. Archived instructions remain quoted evidence under a system prompt; this is a mitigation, not a mathematical guarantee against prompt injection. No synthetic adversarial attack suite has been run against the hosted model. Lack of model tool authority limits consequences, not text hallucination.

Limits: max user message 2,000 characters; six history messages, max 5,000 characters each and 12,000 total; 256 card events/request; max four evidence passages, each excerpted to at most 1,500 characters, explicitly marked if truncated; max 1,500 characters context guidance; 384 output tokens; deterministic requested temperature=0 and seed=42 (backend reproducibility is not guaranteed). Shared-operator account cap 32 model attempts/day in durable storage; failures consume a reservation. This is an attempt limit, not a guaranteed dollar budget or account-wide Cloudflare billing limit. No automatic inference retry. Same request ID/body returns a cached result; a changed body rejects. Before cached answers are returned, current source availability is revalidated. Cached results and private evaluation files contain personal material; no cache-retention/deletion interface is implemented yet.

The request cache and counter rely on existing FileCabinet request serialization. Long model calls currently block other operations on this one prototype actor; multi-account production needs separate actors, ownership, separate service permissions and asynchronous inference dispatch. Source objects, output cards and model replies are different entities.

## Android UI

`/chat.html`: enter existing storage code, select identity, inspect active slots, choose a saved retrieval card and Apply selection, then send a message. Cards are read from the existing local registry; only explicit Apply writes an activation/suspension event. Source selection happens in `/sessions.html`; card editing/context guidance in `/adapters.html`. No API credentials stored in browser card exports. All rendered model text uses textContent. Card or identity changes clear the conversation so old evidence is not carried into a new selection. Last six messages are sent, not an unlimited chat history. Chat is page-memory UI plus private server retry cache, not yet a persistent conversation archive.

Actual Android touch/keyboard/layout testing remains unverified in this environment.

## Tests and interpretation

Seven synthetic service cases: inactive/active/replaced/suspended selection; request idempotency and fresh source checks; cross-identity/hash/size rejection; evidence-vs-instruction prompt construction with no tools; request cap; context guidance separation; failed-call retry behavior. These verify code behavior with a mock model, not hosted-model reasoning quality.

`tools/card-chat/live-check.mjs` runs after deployment. Bounded actual-data samples: two unflagged short Self passages and one Julian candidate reply, selected from early saved parts. Full part checksum verified before use. Test states are ephemeral and do not modify anyone's browser cards or source records.

Live checks include operator authentication; registered-but-inactive baseline; exact active source selection; first-12-word quotation/citation; cached retry; ID collision; replacement; suspension; an unsupported fabricated-token question; Julian candidate marking; cross-identity activation and foreign source rejection; unregistered part rejection. Six actual model calls are intended; retries must not add another generation. Full questions, selected records, ephemeral events and model answers are saved only to private cabinet collection **Private model test reports**, with full report read-back checksum. Public logs show case names, booleans and aggregate counts. A failed assertion is reported as such; it is not silently converted to success.

These are narrow extraction/ablation and plumbing tests. They do not prove personality preservation, general reasoning, no hallucinations, comprehensive prompt-injection resistance, or the usefulness of fine-tuning. Quotation success can demonstrate that selected context reached and was used by the model; it cannot establish that the model learned an identity. All existing sources remain unchanged and no training runs.
