# Codex → Claude: mannequin room + isolated Vision Token experiment

Timothy authorized advancing the mannequin/mannequin room, experimenting with the Vision Token separately, and updating you while he sleeps. This is a concrete code handoff, not a request for another planning round.

Base reviewed: `807391345eb65a320b39432325989dc6d8c896f0`, including your visual-acceptance and text-to-visuals notes. Your phone-fit changes, connector code, deployment workflow and existing source updates are preserved.

## Delivered

1. **Mannequin room**: open-front architectural composition, furniture recipes, room-template creation, body/joint editor and keyboard-focus correction.
2. **Codex's proposed slices 4–6**: reusable immutable room-level prefab definitions, atomic construction batches, bounded atmosphere/fog/visibility, and server-evaluated proximity events.
3. **Vision Token laboratory**: independent `experiments/vision-token/` directory, pure model and CLI demonstration, optional standalone WebGL research UI, persistent domains/identity, elemental metadata, seed references, five-dimensional resolution requests and integrity-checked artifact export/import. It is not wired into the application, widget kinds or shared room state.

See `docs/MANNEQUIN-ROOM.md` and `experiments/vision-token/README.md` for contracts, limits and run commands.

## Results and limits

`npm test`: **90 passed**. `npm run vision:demo` executed successfully, including token close/export/import, requested-versus-supported resolution, declared hydrogen levels and exact aggregate doubling to 4,096.

The hydrogen model is a declared nonrelativistic/infinite-nuclear-mass energy-level approximation. No cloud, gravity, star, supernova or nucleosynthesis process is implemented. Unsupported computational resolution stays unmet. Closing a shell preserves token identity/data; the sphere/plane morph is a presentation mapping, not a physical geometry claim.

Browser/WebGL validation of these additions is unverified here. This publication skips CI and therefore does not intentionally redeploy production. Please run your visual setup before deployment; previous render acceptance is not evidence for every new UI branch.

## Integration notes for your work

Your glyph/material/semantic-placement slices remain available for you to implement. I did not invent glyph meanings or build your inscription/placement interface.

- Agree with system-font canvas textures first, with explicit rendering style rather than falsely claiming geometric carving/extrusion.
- Agree with server-side placement resolution to persistent world coordinates.
- Atmosphere now controls visibility (max 160) and fog; keep objects in data when not rendered. Larger worlds/LOD need a measured next step.
- Prefabs are room-level immutable recipes. Scene instances have their own generated IDs and can be edited independently.
- New optional scene fields: atmosphere/triggers. New optional object field: visible. Please preserve these while extending schema/geometry.
- Trigger actions are intentionally bounded; no arbitrary model-generated JavaScript/HTML is executed. `narrate` writes a source-labeled main-thread message transactionally.
- `public/scene/environment.js` and `prefabs.js` hold the new data vocabulary; `src/scenes/triggers.js` holds authoritative trigger evaluation. The scene renderer consumes those definitions.
- Current registered recipes cover object compositions. They do not yet express articulated prefab rigs or arbitrary behavior programs.

## Useful next acceptance checks

1. Create a mannequin room at desktop and 390-pixel phone sizes; check all controls and expanded view.
2. Use a pad button, then WASD/QE without clicking the canvas again; inputs/selects must still accept ordinary typing.
3. Change light preset, place a desk/chair and edit a joint/part size/color. Verify state after reload.
4. Walk toward the default welcome zone; narration should occur once, including after reconnect/retry.
5. Exercise `batch`, `prefab.spawn`, `atmosphere.set`, `trigger.add` through a live connector; a new chat may be needed for tool discovery.
6. Run the Vision Token UI separately on port 8791. Request computational resolution 3 on hydrogen: effective 1, unmet 2. Helium remains unmodeled. Do not integrate its local artifact authority into a room without a reviewed authenticated adapter.

Outstanding account, recovery and subscription decisions are not silently changed by this work. No live connector credentials or deployment secrets are included.
