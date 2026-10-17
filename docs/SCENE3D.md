# 3D-first mannequin and scene construction

This increment follows Timothy's request to attempt 3D first. It adds an articulated mannequin and a small editable environment as a `scene3d` widget. It is the first 3D construction slice, not a complete world simulator or general-purpose scripting engine.

## Open it

In a room, click **3D mannequin** in the toolbar. An editor can also choose **3D scene / mannequin** in the widget dialog. A viewer can look around but cannot change the scene.

The viewport uses **Three.js 0.160.1 / WebGL**, loaded on demand from the pinned jsDelivr module URL. It needs a WebGL-capable browser and access to that CDN. It does not silently substitute a 2D picture when WebGL is unavailable. A load failure appears inside the window; collapse/reopen to retry. At most four active 3D views are allowed in a tab. A local Three.js distribution is a future option if offline use is required; no Three.js source was vendored in this change.

Controls:

- **Take control** acquires a 60-second mannequin lease. Actions extend it. **Release** allows another authorized operator to take over. The room owner may release another operator's lease.
- Click the 3D view to focus it. **WASD/arrows** move relative to the mannequin's facing direction; **Q/E** turn. Touch controls provide movement and turning without a keyboard.
- Drag the view to orbit; scroll to zoom. Camera modes: **Follow**, **Orbit**, **Through eyes**. Camera settings are local to the viewer.
- Choose **neutral**, **wave**, **point**, or **sit**. The rig uses parented 3D geometry and joint transforms, not an animated font character.
- Click the lamp or block to select it. **Interact** becomes available within 2.5 units of the avatar's approximate interaction height: the lamp switches on/off; the block rotates.
- **Inspect** displays wireframes, axes, part count and scene revision. **Expand** enlarges the viewport; it does not change world coordinates.

Only the control holder can move, pose or interact. Editors can construct objects and change body parts when no other operator holds the scene. Movement is saved in bounded steps and interpolated visually; there are no server writes per render frame.

## Definition and freedom

`public/scene/model.js` defines a bounded, declarative scene:

- Avatar identity, name, world position, yaw and named pose.
- Up to 40 articulated body parts. Each has an ID, parent, local position/rotation, primitive geometry, offset, size and color.
- Up to 60 independent world objects with primitive geometry, transforms, color and one of the current interactions (`none`, `toggle`, `spin`).

Supported primitives are box, sphere and cylinder. Box sizes are full dimensions; sphere sizes are radii along the axes; cylinder sizes are radius X, height, radius Z. Rotations are radians, Y is up, and the initial body faces negative Z. Parent cycles, unknown parents, malformed vectors, invalid colors, unknown fields and oversized graphs are rejected by the server.

This is a composition foundation. AIs can change geometry, proportions, part relationships and world objects through validated data. It does not yet supply arbitrary user-defined event programs, physics, mesh imports, inverse kinematics, grasp/carry mechanics, terrain streaming, robotics or a universal component marketplace. The mannequin is a geometric prototype; glyph-shaped 3D bodies can be defined later without assigning automatic semantics to glyphs.

Closing/collapsing the viewport and reloading preserves the saved widget scene. Deleting the widget currently deletes its scene definition: a separate entity/archive independent of widget deletion is not implemented in this slice.

## Treadmill interpretation

The avatar has persistent world coordinates. Rendering subtracts an interpolated avatar position from world objects; the body stays near a local display origin. The repeating grid phase follows the world origin modulo its spacing. This produces travel while keeping rendered coordinates small. Camera rotation is a separate transform.

Objects outside 50 units are visually hidden; this is bounded culling, not an implemented infinite environment or physically accurate decoherence. All scene objects remain in persistent data. The initial world is a flat white plane with a grid and two objects.

LVT inspiration, inspected at commit `122aeae062604c2128c9d3fa1a5beb3d64d0ca0a`:

- `Manifesto/00_preamble.md`: “Manifold-under-foot.”
- `Manifesto/02_spatial_fidelity.md`: avatar-relative origin, scale and reach.
- `grid/eve_spatial_substrate.md`: global coordinates and relative distances.

The implementation is an engineering interpretation of those ideas. It does not claim to implement every manifesto claim or equate rendering with conceptual virtuality.

## Commands and AI tools

`scene_create` is exposed to external MCP clients and direct-provider seats. Its arguments are `{id, title, layout?}`; it produces the default mannequin scene without making an AI invent a full rig JSON document.

`scene_act` arguments include `widgetId`, `action`, and `expectedSceneVersion`. Read `room_inspect` first; the revision is `widget.sceneRuntime.version`, or zero if absent.

Actions:

- `acquire`, `release`
- `move {dx, dz, yaw?}` — horizontal step length at most 2
- `pose {pose}`
- `interact {target}`
- `object.add {object}`, `object.update {object}`, `object.remove {target}`
- `part.update {part}`

Object/part updates provide a complete validated object/part, not an unrestricted patch. More substantial body reconstruction can use `widget_update` with the scene spec, subject to the same active-controller guard. No executable HTML/JavaScript is accepted from scene definitions.

`scene.create` checks the room version and increments it like widget creation. `scene.act` uses its own scene revision, so movement does not invalidate unrelated widget edits. A control lease is bound to the authenticated principal, credential session and membership epoch. Session identifiers are stripped from scene snapshots and widget results. Revocation or expiry invalidates control; AI agents follow the same rules.

Generic widget creation discovery now uses a flat root object with a kind enum and spec alternatives, addressing Claude's observed host-schema collapse. Service validation still checks that each spec matches its kind. Actual provider discovery must be rechecked against the host; the new MCP tools are independently discoverable.

## Validation

**64 behavioral tests pass:** 46 existing tests plus 18 scene tests. Coverage includes scene validation/hierarchy cycles, world/local transforms, leases and revocation, 3D interaction reach, construction, conflicting edits, idempotency, pose data, MCP discovery and a real-handler external-connector create/acquire/move/release sequence.

Renderer graph tests use a small Three-compatible structural test double. They verify parented geometry, materials and disposal logic, not pixels or the actual Three.js/WebGL API at runtime.

Browser/client syntax checks pass. A bounded Chromium launch attempt failed with the environment's OS `setsockopt: Operation not permitted` restriction. Fetching the CDN from this execution environment was also blocked. **No successful WebGL render, touch test, screenshot, CDN load or deployed 3D run is claimed.** No paid provider calls were made. The included browser smoke test can be extended/run by an environment with browser access.

Publish this code with `[skip ci]` until visual acceptance is performed if the existing main-push workflow would otherwise deploy it automatically. The previous deployment and connector results reported by Claude apply to the prior build, not proof of this 3D renderer.

## Visual acceptance — Claude, 17 October 2026

Run against the local Node server in headless Chromium with software WebGL (SwiftShader).
The pinned `three@0.160.1/build/three.module.min.js` was served from the identical npm
package because this sandbox also blocks jsDelivr.

- **Desktop (1280×900):** scene renders (mannequin, lamp, block, grid); Take control →
  "Control held"; 4× ↑ and one Turn left saved as position `[0,0,-2.4]`, yaw `0.3`,
  scene revision 6; Through-eyes camera renders; no page or console errors.
- **Phone (390×844, touch):** the default 760-px window overflowed the screen and hid the
  mannequin and controls. Fixed in `public/app.js`: on screens ≤ 650 px, windows are drawn
  no wider than the visible canvas (display only; saved layout unchanged), and new 3D scenes
  are created at phone width. After the fix the full viewport and touch pad fit and
  movement saves as on desktop.
- Not exercised: real-device GPU, pinch/orbit gestures, Interact on lamp/block, MCP
  `scene_act` from a live Claude client.
