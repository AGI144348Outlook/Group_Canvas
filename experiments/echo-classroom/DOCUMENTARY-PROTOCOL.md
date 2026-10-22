# Classroom documentary — read-only purpose

Timothy clarified on 2026-10-22: the visual classroom is for reading the experiments, not for operating the project. Participation is deferred. Codex is to conduct actual teaching with executable Echo; the user may later join as substitute.

## Preserved historical distinction

Reports 019–021 and the current saved JSON records describe scripted synthetic experiments and adapter demonstrations. They are not actual conversational teacher–student exchanges between Codex and Echo. Do not retroactively change that attribution. The default reading view states that actual Codex–Echo sessions have not yet been archived.

The default page reads saved evidence only. It imports no learner/controller modules, does not load or modify device practice state, and has no participation fields, teaching/grade/run/reset controls or background loop. Its buttons navigate recorded material. The former interactive HTML is preserved at `archive/interactive-index.html`, outside the published static directory. Original implementations/tests remain available in source, not active on the reading page.

## Subsequent actual teaching sessions

Before a session, publish the prospective plan in the active repository's Issues/Discussions. Codex supplies an assignment through the learner's actual available interface, reads the returned output, answers questions and supplies feedback, then inspects subsequent behavior. Unsupported questions/responses remain limitations; do not script Echo's side and attribute it to the student.

Record at least:
- session identity, date, source commit and experiment scope;
- actual actor/role: Codex teacher, executable Echo, explicitly identified substitute, or scripted evaluator;
- the exact permitted input and recorded output/artifact references;
- assignment, attempt, question, teacher reply/correction and assessment as distinct event kinds;
- event order and source pointers; do not invent wall-clock timestamps;
- learner state/implementation revision before and after feedback;
- what was scaffolded, what changed, failed/unresolved cases and qualification limits.

Avoid private chain-of-thought or personal-source material in public records. Preserve operational inputs/outputs and concise teacher feedback necessary to audit the experiment. A public documentary should contain only appropriately shareable records; private artifacts remain private with safe references.

After the session, publish actual results and append a source-linked visual chapter. Separate actual teaching dialogue from frozen scripted assessments. Do not relabel fixtures as Codex responses. The current documentary compiler consumes the historical JSON archives; additional session chapters must be added from actual archived events, never manufactured to fill an empty classroom.

## Viewing and verification

`public/documentary-model.js` maps saved records into display cards; `public/documentary.js` performs GET-only evidence loading and navigation. `test_documentary.mjs` verifies rendering data/attribution without invoking learners. `browser_documentary.py` verifies phone reading/navigation and absence of practice-state access or learner module loads.

This UI change itself runs no learning experiment. It does not alter the earlier results, original Genesis, empty starter profile or user's saved local practice data. No teacher API connection or substitute participation service is claimed implemented here.
