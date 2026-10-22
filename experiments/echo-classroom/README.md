# Current classroom purpose — read-only documentary

Timothy clarified that the visual classroom is an observation/documentary surface, not the experiment's operator. The default page now reads saved records only. It does not run the learner, grade, execute Recess, or open previous local practice state. Participation is deferred; the former HTML is archived outside public assets at `archive/interactive-index.html`. See [documentary protocol](DOCUMENTARY-PROTOCOL.md).

The historical interactive descriptions and results below are retained as history, not current viewer instructions. Existing archives remain explicitly scripted synthetic experiments. Actual Codex/Echo teaching exchanges have not yet been archived and are not fabricated here.

---

# Echo classroom — first bounded adaptation experiment

Canonical research branch: dual-order-os `experiment/echo-swadesh-fresh-start`. Synthetic teaching sessions are separate from the untouched empty starter profile. Browser artifact mirror: Group_Canvas `experiment/hierarchy-tower`, isolated `experiments/echo-classroom/` Worker.

Prospective plans: [Dual Order #6](https://github.com/AGI144348Outlook/dual-order-os/issues/6), [Group Canvas #6](https://github.com/AGI144348Outlook/Group_Canvas/issues/6).

## What is running

`learner.py` is a **new teaching bridge**, using the preserved Genesis `AlgorithmMatrix`, `ReshIdentity`, A-101 `bandit_select`, and A-113 `record_outcome/checkpoint_generation`. It leaves the pinned source unchanged. The Neuroplasticity candidate library explicitly says proposed/unimplemented; this experiment implements one small B1-c-inspired saturating-counter policy, not the entire library.

Four pre-supplied hypotheses resolve a contextual reference: first entity, last entity, speaker, addressee. Their existence and the provided participant-role fields are structural priors. The learner acquires a label-to-hypothesis association. It does not invent these hypotheses, parse free English, demonstrate human-like comprehension or discover pronoun grammar without scaffolding. Neither I nor you is mapped to a role inside `learner.py` or `public/learner.js`.

Teacher fixtures in `run_lesson.py` / `public/teacher.js` supply answer references. Predictor calls receive the label and participant context only; extra answer fields are rejected. Frozen held-out assessment reads only the acquired hypothesis state; it does not supply new feedback. The definition-in-working-vocabulary admission test has **not** been implemented or passed here.

## Results observed locally

48 practice turns per policy; eight held-out reference questions with new entity IDs and changed speaker positions:

| Policy | Before | After |
|---|---:|---:|
| Preserved A-101/A-113 with chosen-arm binary feedback | 1/8 | 2/8 |
| New B1-c correction bridge with teacher-labelled reference feedback | 1/8 | 8/8 |
| No-feedback counter control | 1/8 | 1/8 |

These feedback conditions differ. The B1-c bridge evaluates **all four** supplied hypotheses against the teacher's labelled reference; UCB receives success/failure for its chosen arm. The result is not a controlled claim of algorithm superiority. No broader knowledge/comprehension/sovereignty claim follows from this tiny synthetic task. State persistence was checked through the existing CatalogBox: 96 attempt/feedback cards plus one state card, reopened with identical learner state. The SQLite file stays a generated local artifact; JSON evidence is public and entirely synthetic.

Nine Python diagnostics cover transfer, arbitrary/reversed labels, frozen no-feedback control, pending teacher turn/single grade, restore, no answer injection, unknown/missing reference, corrupt counters and real A-101/A-113 calls. JavaScript parity tests compare every one of the 48 attempts and final evidence against each Python policy, plus control/state/validation cases. Phone QA results are recorded in the prospective issue after execution.

## Watch and participate

The static classroom shows an indexboard, two desks, a blank learner card, pending attempt, teacher feedback scale, yellow encounter entries and experience cards. **Interactive mode is an explicitly labeled JavaScript port running locally**, not a stream of Codex's private reasoning or a remote Python process. “Python test record” steps through the actual recorded original-Python run.

Present a card → learner points to a participant → you select the correct referent → give the correction → advance the scene. The learner output is frozen while awaiting your turn. Guided turns use the separate synthetic teacher fixture and stop after eight grades. A frozen check reports unfamiliar-context accuracy. It does not automatically grant green working vocabulary. Copy/Seen receipts are mechanical scaffolding; a verified word copy does not establish visual perception or comprehension.

Session state is stored on the device and can be exported/reset. No transcript, private source exports, API keys or model calls are involved. The teacher actor field and separate code paths are **trusted local API discipline, not cryptographic authentication**: the browser owner can alter local state/code. This is not a secure exam against an adversarial operator. No arbitrary Python or user code executes.

## Reproduce

Within the canonical repository, place these files at `experiments/echo-classroom/`, materialize the pinned Genesis snapshot using the existing repository tool if necessary, then:

```sh
cd experiments/echo-classroom
python -m unittest test_learning -v
python run_lesson.py
node --test test.mjs
```

Use a clean generated `evidence/` directory for `run_lesson.py`; it refuses to overwrite an existing `lesson.sqlite`. The checked-in JSON supplies the browser parity fixture. `browser_test.py` targets the isolated deployed artifact at a 390×844 touch viewport, using the existing GitHub Actions Chromium setup. It is mobile emulation, not a physical-device trial. The existing tower/room/storage deployment is unchanged.

The local Sites publishing helper was not available; publication uses the existing Cloudflare artifact workflow instead. No Sites project was created.


## Lesson 2 and first/last-priority prototypes

[Lesson 1 progress review](LESSON-1-REVIEW.md) records what the first lesson did and did not establish. `run_lesson2.py` freezes the saved state and tests 17 new layouts (including 2/4 participants and three 3-person role-position patterns absent from training), then six missing-context checks: 40 questions, zero new training turns. Recorded scores are counter 40/40, UCB 11/40 and cold control 13/40. These remain reference-selection results, not general language or green admission.

`priority_cards.py` and `public/priorities.js` are new adapters. First-priority note templates accept observation/hypothesis/question/trial records; two consecutive captures yield to a waiting assignment. Note requests remain possible during a pending teacher turn, but ordinary work and Recess wait. Automatic encounter notes are made by the classroom adapter, not spontaneously authored by Echo.

Last-priority Recess is opt-in and **step-driven** in this prototype. It runs only behind notes/assignments and outside pending teacher turns, with a three-activity budget per activation, previously visited candidate tracking and a mandatory handover after a candidate is recorded. Disabling stops future steps. Closing the page does not run a background agent. This is not a complete idle-detection/autonomous Rest loop.

The personal dictionary is three teacher-supplied red candidate entries. Lowercased lookup aliases identify known spellings; raw definitions are preserved. Coverage counts green and yellow separately, with green requiring a nonambiguous active sense plus a definition-reading qualification/evidence reference. The classroom supplies **no green qualification** from Lesson 1 reference performance. Recess uses available yellow encounters to select a question target, not to infer/approve a new definition. Accepted note review means retain the record, not certify its contents; rejected records remain in audit state. No self-grading, vocabulary promotion, arbitrary program execution, public authentication or new Algorithm-000 authority is introduced.

The visible controls provide first-priority note requests, an ordinary dictionary-inspection assignment, one controller step, enable/pause, teacher review/handover, Lesson 2 local assessment and device persistence/export. Local notes and scheduler state are included in session export/reset. Teacher role checks are trusted local API checks, not a security boundary against the browser owner. These additions have their own prospective plans in Dual Order #7 and Group Canvas #7.

Run `python -m unittest test_priorities -v`, `python run_lesson2.py`, and `node --test test_priorities.mjs` from this folder. The added Python and JS checks cover ordering, state, scope/provenance, handover, parity and no-feedback transfer. The original lesson evidence remains unchanged.


## צ portfolio lesson and פצ questions

The teacher's revision-1 צ card has three separate functions: questioning, blank-line expansion and paperclip attachment. Its back contains the supplied questioning procedure and Who/What/When/Where/Why/How slots. **Only Who is green by Timothy's explicit instruction, for this tool-use scope.** What remains locked, with no automatic activation on exposure or reference-test success. This is not a new claim of learned interrogative grammar or general Who comprehension.

`tsadi_tool.py` and `public/tsadi.js` provide a new bounded adapter and browser port. The learner copies the board profile to a stable own tool card; equality is checked before the ע receipt is recorded. This is mechanical copying scaffolding. Expansion adds blank lines without replacing the card/profile or previous lines. Paperclips link distinct existing local practice cards and deduplicate reversed endpoints. These are actual state transitions with event records, not new protected-Genesis authority.

The turn-based פצ exercise receives only an unknown requested role and participant context: both role references are initially null. The controller uses a supplied Who template through the presentation's פ egress, then waits. The teacher points to an entity; the reply is attributed as a teacher statement, not independently verified world truth. No hidden correct entity is supplied to the questioning function. Choosing to ask about a speaker/addressee is currently a teacher-selected objective, not an independently invented question goal.

Pending question turns exclude a simultaneous new lesson attempt and block optional Recess, while note capture remains possible. Tool state persists on the device, is included in session export and clears with confirmed classroom reset. Actor labels and read-only UI slots are local API discipline, not a security boundary against the browser owner. No original Algorithm-000 changes, arbitrary code, external model calls, new ץ semantics or automatic vocabulary admission are introduced.

The profile card declares operations; the live implementations are explicitly bound module methods. Extra possible צ portfolios—selection/pointing, bookmarks, grouping/deck assembly, detachable attachments—remain proposals. None transfers identification authority from ר or validation authority from the teacher.

Prospective plans: Dual Order #8 and Group Canvas #8. `python test_tsadi.py` runs nine focused Python checks and writes the synthetic parity fixture. `node --test test_tsadi.mjs` validates browser parity/guards. The isolated publishing workflow retains original/priorities tests and adds phone front/back/copy/slot-lock/question/teacher-answer/persistence checks.
