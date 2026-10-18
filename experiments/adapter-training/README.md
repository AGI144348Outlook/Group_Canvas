# Adapter training preparation — compute not configured

Timothy asked to automate adapter training. The application currently provides retrieval cards, selected-branch source datasets and provisional Julian session candidates. No trainer, base-model revision, GPU machine, training-service credentials or spending ceiling has been configured or verified.

`prepare.js` is a pure Node module, not a training runner. It accepts records retrieved through the authenticated Lattice interface and explicit record-hash approvals/exclusions. Nothing automatically reads personal data, calls a model, downloads weights or launches compute. No automatic workflow is added.

- Self output is user-text continuation data. Existing isolated user prompts are not manufactured into chatbot question/answer pairs. Style adaptation and interactive counterpart training are different objectives; interactive Self training needs reviewed context and user-authored target turns.
- Julian output is prompt/reply supervision only after explicit per-record approval. Direct/inherited rule labels are not approval. Unsure pairs stay out; review must resolve their attribution into a revised approved dataset first.
- Flagged Self records require review. Exact duplicated example content is removed before splitting. Conversation-level groups stay wholly in training or validation. This prevents same-conversation leakage; near-duplicates/paraphrases and related conversations still need additional evaluation review.
- Every example retains provenance, full source hash, record identity and split group. Dataset files should be private R2 artifacts, never committed to the public repository.
- The returned plan is always `readyForTraining:false` until the later execution path is explicitly configured. Four synthetic tests verify current behavior.

## Proposed automation once configured

1. Pin selected source manifests and reviewed approvals; recheck source availability through Lattice.
2. Produce private versioned training/evaluation files and a content manifest; inspect actual base-model token counts, formatting and any truncation. No silent truncation.
3. Create a queued job with identity, base model AND exact revision, training code/package revisions, dataset hashes, seed, adapter parameters, approved provider, time/budget ceilings and cancellation policy.
4. Submit one bounded job using service credentials held server-side. Dataset contents are transmitted to the chosen trainer only after that service is selected and authorized. A fee estimate is not a hard budget cap: require provider-enforced limits where possible and document any overrun risk of periodic cancellation.
5. Train a separate LoRA/QLoRA artifact per identity. Use model-specific chat templates and assistant-only loss masking for supervised Julian replies. Configure and test the chosen framework, rather than treating a generic config as executable proof.
6. Evaluate against the frozen held-out conversations: answer behavior, quote handling, persona-attribution errors, memorization checks and regressions. Lower loss alone does not establish preserved identity or factual memory.
7. Save adapter weights, checksums, compatible base revision and evaluation results privately; register an inert model card. Activate only after review in a compatible model runtime. Current model cards cannot load weights; a compatible inference backend is another required component.
8. Retraining is triggered by a new approved dataset version, not every upload or card edit. No endless or unattended spending loop.

Android is the control surface. Training should run remotely or on a separately available GPU, not in the phone's Pyodide runtime, R2, or a normal Cloudflare Worker. R2 stores files; Lattice retrieves data; cards identify versioned context/model artifacts; an external trainer updates weights. Existing API-provider chat access does not automatically permit downloading that provider's model or attaching arbitrary LoRA weights.

## Decisions outstanding

- Preparation only at $0, an existing GPU/service, or selection of a hosted trainer and hard spending limit?
- Self first, reviewed Julian first, or separately prepare both?
- For Self: writing-style continuation, or a conversational counterpart with contextual examples?
- Which base model/license/revision and compatible inference service should use the trained artifact?

No training or paid compute has started. This document and synthetic module are preparatory implementation, not evidence of a trained adapter.

## Follow-up decision and Cloudflare findings

Timothy chose **prepare separate datasets for both**, and asked about Cloudflare as the trainer. The private preparation workflow therefore reads the pinned Self and Julian manifests through the authenticated application, verifies each source part, and writes two preparation files into the private file cabinet collection **Adapter training preparation**. No new bucket or public dataset is created. Files include provenance and split membership. Julian records lacking explicit approvals remain a review list of record hashes; this is intentionally not a launchable Julian training set. Self flagged records likewise remain excluded from candidate training rows until reviewed. These exports use JSON preparation envelopes, not a finished tokenizer-specific trainer format. Partial failures do not erase earlier outputs; full read-back checksums validate each completed file. Existing R2/Worker/Actions usage still applies; no GPU training spend is initiated.

Cloudflare documentation checked 2026-10-18:

- https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/ documents uploading pre-trained adapter weights for supported-model inference. Compatibility includes model family, rank and file-format constraints; verify the chosen exact base before training. The endpoint called Create Finetune should not by itself be treated as evidence that a GPU training job is being performed.
- https://developers.cloudflare.com/workers-ai/guides/tutorials/fine-tune-models-with-autotrain/ places the training step in a Hugging Face AutoTrain/Colab GPU notebook, then uploads resulting weights to Workers AI. The example's cost statement is not an estimate for Timothy's corpus.
- https://blog.cloudflare.com/replicate-joins-cloudflare/ announces Replicate integration/fine-tuning direction. This does not establish a configured or supported training job for this account/base model.

Recommendation: Cloudflare hosts storage, orchestration and compatible adapter inference; select and price the actual GPU trainer separately unless Cloudflare confirms an available integrated training path for the chosen model. Do not provision a service, transmit data to another provider, or start paid training based only on the word 'Cloudflare?'. No trainer/budget has yet been approved.
