# Mannequin room and construction/behavior increment

## What changed

The toolbar's **Mannequin room** button creates a furnished, open-front workshop, preserving Claude's phone-width layout changes. Existing open scenes remain unchanged. AI clients can call `scene_create` with `template:"room"` or `template:"open"`; omission preserves the original open scene.

- Reusable room, desk, chair, marker-stone and doorway compositions.
- An in-view furnishing selector and studio/day/dusk/night lighting controls.
- A **Body & joint editor** for base joint rotation, primitive dimensions and color. Named poses add to base rotations. Server validation and controller restrictions still apply.
- Keyboard navigation handled within the scene shell, including after pad-button focus. Text inputs and selects do not capture movement keys.
- Bounded atmosphere settings, including fog and extended visibility. Distant objects are faded by fog before the culling boundary.
- Authoritative proximity programs that reveal objects, set active state or narrate on entry.
- Atomic batches of up to 12 construction operations.

The room uses architectural geometry, not collision physics. Walls/furniture can currently be traversed. Marker stones have no glyph inscription in this increment; Claude's glyph/material/relative-placement work can extend them.

## Scene definition extensions

Existing scene definitions remain valid. Optional fields:

```json
{
  "atmosphere": {"preset":"dusk"},
  "triggers": [{
    "id":"arrival",
    "center":[0,0,-3],
    "radius":1,
    "once":true,
    "actions":[{"type":"narrate","text":"A doorway becomes visible."}]
  }]
}
```

Objects may have optional `visible:false`. Hidden objects remain defined and inspectable; this is visual revelation, not private-data authorization.

Atmosphere accepts studio/day/dusk/night presets and bounded sky/fog/visibility/ambient/sun overrides. Maximum visibility is 160 units. Presets maintain fogFar ≤ visibility. This is rendering control, not atmospheric physics or the full resolution framework.

## New `scene_act` actions

- `prefab.define {prefabId, definition:{name,objects}}`: immutable custom definition stored at room level; up to 16 definitions, 1–12 objects each. Definitions are visible in `room_inspect.prefabs` and reusable across scenes. Built-in IDs cannot be overwritten.
- `prefab.spawn {prefabId,instanceId,position,yaw?}`: expands a definition into uniquely identified world objects. Built-ins: room, desk, chair, marker, arch.
- `atmosphere.set {atmosphere}`.
- `trigger.add {trigger}`, `trigger.remove {target}`.
- `batch {actions}`: 1–12 construction operations atomically, using one scene revision. No nested batch, movement, control acquisition or prefab registration inside a batch.

Use current `expectedSceneVersion` and the existing authenticated command route. A bad child or exceeded object limit rolls back the whole batch. The scene still has a 60-object cap. Registered definitions are stable recipes; spawned objects are independent editable instances.

## Proximity behavior

Up to eight triggers per scene, with 1–3 actions each: `reveal`, `setActive`, `narrate`. Radius .5–30 units; `once` is explicit; repeat triggers have a minimum cooldown of one second (default three seconds).

Evaluation occurs on accepted authoritative movement, not in the renderer. Swept-segment detection catches a zone crossed between movement endpoints. Entry/fired state persists in scene runtime; retries use the original receipt and cannot fire the same move twice. Narration is attributed as an environment event in the main thread, with its actual author and trigger source retained.

Removing a referenced object requires removing the trigger as part of the same valid final-state batch. Replacing an entire scene spec retains the existing full-replacement semantics and resets runtime, including trigger counters; individual construction edits preserve them.

## Verification

The suite passes **90 tests**: the prior 64, 13 environment/room scenarios and 13 independent Vision Token scenarios. Room coverage includes prefab placement/reuse, atomic rollback, visibility, one-time narration, retry behavior, swept paths, atmosphere bounds, dangling references and permission checks.

This increment has not been visually accepted in a browser or deployed by Codex. Claude's earlier browser validation applies to the prior 3D build. No permission request, deployment or paid provider call was initiated in this work. Publication uses `[skip ci]` to keep the existing production Worker unchanged pending visual review.
