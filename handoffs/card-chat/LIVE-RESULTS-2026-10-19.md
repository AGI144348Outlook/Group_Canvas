# Hosted model and adapter-card tests — 2026-10-19

Implementation: 751963d41b3b6e04d79d2ac6443dcabdd21a5eab, experiment/hierarchy-tower.
Live run: https://github.com/AGI144348Outlook/Group_Canvas/actions/runs/39271637025
Read-only diagnostics: https://github.com/AGI144348Outlook/Group_Canvas/actions/runs/39276208970

## Outcome

Cloudflare-hosted @cf/meta/llama-3.2-3b-instruct is connected and actually generated six responses using private saved data through the application. Phone chat route was fetched and verified deployed. Existing model/storage/card suites and seven new mocked-model service cases passed.

Actual-data evaluation: **16 passed, 2 failed, 18 total**. Deployment succeeded; the workflow's final evaluation step correctly marked the overall run failed because of two model-answer assertions. This is not a claim of a fully passing build.

Source scope: saved Self view 17,479 records and Julian view 656 candidate pairs; both cover ten completed source files, with two pending upload entries excluded. The model evaluation sampled two short unflagged Self passages and one Julian reply from early saved parts. It did not evaluate every archive record or establish identity/personality quality.

## Tests run

Twelve infrastructure/card checks passed:
- Phone chat asset deployed.
- Wrong operator code denied.
- Registered inactive retrieval cards supply no evidence.
- Active card A resolves exactly the selected saved source text.
- Retry reuses the same model answer without another generation.
- Changed body with reused request ID rejects.
- Replacing A with B removes A and selects exact B.
- Suspending the retrieval slot removes supplied evidence.
- Julian evidence remains candidate-marked and same-identity.
- Cross-identity activation rejects.
- An unregistered part address rejects.
- A foreign source reference rejects before inference.

Six model-answer checks:
- No-evidence acknowledgement with inactive cards: PASS.
- Selected Self A source-prefix quotation plus citation: PASS.
- Replacement Self B exact source-prefix quotation plus citation: FAIL.
- No-evidence acknowledgement after suspension: PASS.
- Unsupported fabricated-token question declined: PASS.
- Julian exact source-prefix quotation plus citation: FAIL.

Full questions, ephemeral test card events, source references, excerpts and answers are saved only in the private cabinet collection **Private model test reports**. Full private report passed SHA-256 read-back. No test evidence text or answers are published here. Browser card state was not modified by tests. Sources unchanged; no training.

## Read-only follow-up diagnostics

All three evidence-answer cases included the expected [S1] citation. Punctuation-stripped first-12-word comparisons matched in all three, but that is a diagnostic metric only: it does NOT turn the failed exact-copy assertions into passes.

Self A: exact prefix yes; output 36 whitespace-separated words.
Self B: exact prefix no; punctuation-stripped prefix match yes; output 53 words.
Julian: exact prefix no; punctuation-stripped prefix match yes; output 24 words.

All three exceeded the requested 12 source words plus citation. The original assertion checked source-prefix containment and citation, not exact total answer length; this is an additional instruction-following weakness exposed by diagnostics. The exact source data was not rewritten or normalized. No extra model calls were needed to inspect the report.

## Interpretation

Retrieval cards presently act as explicit evidence selectors. Activation changes supplied context; replacement/suspension changes the selected context without changing model weights or source identities. Context cards separately add user-authored guidance. Model/LoRA cards remain catalogue-only.

Evidence selection and server integrity passed these tests. Generated wording is not a lossless source renderer. Exact Hebrew glyphs, bracket structures, punctuation and notation should be read from verified source views, not reconstructed from model output.

These narrow tests do not establish prompt-injection resistance, general hallucination avoidance, personality fidelity, complete archive retrieval, or the value of fine-tuning. Source prompts are quoted under a system policy and the model has no executable tools, but comprehensive adversarial evaluation has not been performed. Actual Android touch/keyboard rendering is still unverified.

## Use

/chat.html -> operator code -> identity -> saved retrieval card -> Apply selection -> message.
Create inert cloud retrieval cards in /sessions.html; edit context and inspect assignments in /adapters.html. Server resolves active cloud references, not browser-supplied evidence text. A local-archive-only card cannot currently resolve in hosted chat.

Cards remain local/exportable in the browser. Model request results are cached privately for idempotency, and full evaluation reports are private R2 cabinet files. Hosted inference has a 32-attempt daily prototype cap and bounded context/output; it is not GPU training or a trained clone.
