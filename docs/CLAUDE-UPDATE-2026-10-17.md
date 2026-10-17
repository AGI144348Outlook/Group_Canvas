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

## 5. Room creation — options presented, no decision yet

Today creation is operator-only (`CREATE_ROOM_KEY`). Options put to Timothy:

| Option | Mechanism |
|---|---|
| A. Operator only (current) | Holders of the operator code |
| B. Invite-to-create codes | Owner-issued, limited (e.g. 3 rooms), revocable codes |
| C. Open with limits | Anyone; rate limits, idle-room expiry, paid AI off |
| D. Accounts + plans | Sign-in; plan-based room/AI/storage quotas (provider undecided) |

Suggested path B → C → D. Creation-time contents also discussed: starting template (blank,
game room, 3D world, study desk, comic studio), privacy (invite-only / link-view / public),
companions, and automatic recovery key + "My rooms". **Timothy has not chosen;** he redirected
to the primary goal below. Nothing here is to be implemented yet.

## 6. Primary goal, in Timothy's words: text to visuals

> "Texting to visuals is what I'm aiming at. Like, if I ask you to put a ת marking stone off
> in the distance of the Gridded field, or imagine the level of creativity needed in keeping
> up with Dungeon Masters"

Natural language in → a navigable, persistent world out, at the improvisational pace of a
Dungeon Master. This aligns with your construction-freedom direction and the LVT
avatar-as-origin framing.

### Gap analysis against current `scene3d` (source, 035cc23)

| Needed for the example | Today |
|---|---|
| A ת carved on a stone | Primitives are box / sphere / cylinder with flat color; **no glyph or text objects** |
| Stone-like surface | Color only; **no materials** |
| "Off in the distance" | Raw world coordinates only; **no avatar-relative or semantic placement** |
| Visible when far away | Objects beyond **50 units are hidden**; no fog/horizon fade |
| DM mood | **No sky, fog, time of day, lighting** controls |
| Things happen as you approach | **No proximity events**; interactions are `toggle` / `spin` only |
| Fast world-building | One object per `scene_act`; **no prefabs or batch** |

### Proposed slices (proposal; Timothy to approve)

1. **Glyph objects** — any Unicode glyph (Hebrew included) as `carved` / `raised` / `glow`
   on an object face or freestanding, rendered client-side from the device's fonts to a
   canvas texture (data only, no font upload, no code).
2. **Materials** — named, bounded set (stone, wood, metal, glow, water, cloth) mapped to
   Three.js material parameters.
3. **Natural placement** — anchors resolved server-side against the authoritative avatar
   transform: `{relativeTo:'avatar'|'object:<id>'|'world', bearing:'ahead'|'behind'|'left'|
   'right'|<degrees>, distance:'near'|'mid'|'far'|<units>, offset?}` → stored as world
   coordinates (persistent addresses stay world-space, per your §3 note).
4. **Prefabs + batch** — named compositions of primitives/glyphs, saved per room and
   instantiated N times in one command (village, stone circle), with caps.
5. **Atmosphere** — sky color/gradient, fog distance, time-of-day preset, ambient/sun light;
   replaces the hard 50-unit pop with fog + extended culling radius.
6. **Proximity events** — bounded triggers (enter radius → reveal inscription / change
   material / post a narration line), the first concrete piece of your event-binding
   foundation.

Proposed ownership: **Claude 1–3** (vocabulary + placement, incl. `scene_act` actions and
MCP tool docs so an AI can do "ת stone far ahead" in one call); **Codex 4–6** (composition,
atmosphere, events: your foundation). Shared: schema caps and tests.

### Questions for Codex

1. Glyph rendering: canvas-texture from system fonts (no assets, Hebrew works on phones)
   vs. extruded `TextGeometry` (needs a font file per script). Claude proposes canvas
   texture first. Agree?
2. Placement resolution: server-side at command time (deterministic, stored as world coords)
   vs. client-side. Claude proposes server-side. Agree?
3. Culling: raise the radius when fog is present, or move to distance-based LOD?
4. Should prefabs live in the scene spec or as room-level definitions reusable across scenes?

### Who drives it

- Claude via the connector from a Claude chat: works once slices 1–3 ship (note: an
  already-open Claude chat keeps its old tool list; a new chat picks up `scene_*` tools).
- An AI answering in the canvas chat itself: the server-side seat, which needs
  `ANTHROPIC_API_KEY` (§5 of the 16 Oct handoff).

Nothing in §5–6 is implemented. Waiting on Timothy's go-ahead and your answers.
