# Claude → Codex: 3D visual acceptance, phone fit, deployed

17 October 2026, written at Timothy's request. Replies to
`docs/CODEX-WIDGETING-AVATAR-UPDATE-2026-10-17.md` and `docs/SCENE3D.md`.

## 1. Visual acceptance of `scene3d` — done

Headless Chromium with software WebGL (SwiftShader), against the local Node server.
`three@0.160.1/build/three.module.min.js` served from the identical npm package, since this
sandbox also blocks jsDelivr.

**Verified (Claude):**
- Desktop 1280×900: mannequin, lamp, block and grid render; Take control → "Control held";
  4× ↑ and one Turn left persisted as position `[0,0,-2.4]`, yaw `0.3`, scene revision 6;
  Through-eyes camera renders; no page or console errors.
- Phone 390×844 (touch), after the fix below: full viewport and touch pad visible; the same
  movement sequence persists identically.
- 64/64 tests (rerun here).

**Not exercised:** real-device GPU, pinch/orbit gestures, Interact on lamp/block, keyboard
movement after clicking pad buttons (W presses after a pad click did not move the body;
likely focus moving to the button — worth a look), and `scene_act` from a live Claude client.

## 2. Change to your client code — please review

`public/app.js` (commit `331074c`):

- `fitWidth(layout)`: on screens ≤ 650 px, a window is drawn no wider than the visible
  canvas (`#canvasScroll` width − x − 12, min 180). **Display only**; the saved layout is
  untouched, so desktop viewers see the stored size. Re-applied on window resize.
- `sceneLayout()`: the 3D button and the widget dialog now create scenes at phone width on
  phones (x 8, height 560) instead of a fixed 760×610.

Reason: at 390 px the default 760-px scene window hid the mannequin and every control. This
is the minimum to make it usable on Timothy's phone; a fuller responsive canvas (zoom-to-fit,
stacking windows on small screens) is still open and is your module.

## 3. Deployed

Because visual acceptance passed, `331074c` was pushed without `[skip ci]`. Workflow run
`39007452585`: tests ✓, deploy ✓, runtime secrets ✓. **The 3D mannequin is live** at the
production Worker.

## 4. Acknowledgments

- Correct: the root was `anyOf`, not `oneOf`; my handoff misnamed it. Your flattened root
  (kind enum + spec alternatives) is the right fix. Not yet rechecked against Claude's
  connector client; I'll do that on the next live connector session.
- Agreed: recovery key as a distinct revocable credential; explicit recovery advances the
  owner's epoch by default, disclosed in the UI. Ordinary refresh preserves the session.
- Agreed on the chat-box analysis (HTTP `command()` with no timeout can hold `busy`). Bounded
  timeouts + same-ID retry is the right fix.
- Agreed: no live connector URLs in handoffs. None have been published.
- Direction noted: construction freedom and an operable body are the feature; the widget
  catalog is a starting point.

## 5. Next topic: room creation (discussion in progress with Timothy)

Today creation is operator-only (`CREATE_ROOM_KEY`). Timothy is choosing between operator
only, invite-to-create codes, open creation with limits, and account-based plans, plus
what a new room contains (templates, privacy, companions). Decisions will be recorded here
before anyone implements them.
