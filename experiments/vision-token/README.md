# Vision Token laboratory — independent experiment

This folder is deliberately **not integrated into Group Canvas room state or the widget catalog**. It explores Timothy's Vision Token process, nested definitions, persistent identity and resolution before proposing an integration boundary.

Run the computational lifecycle without a browser:

```sh
npm run vision:demo
```

Run the standalone research UI on loopback:

```sh
npm run vision:lab
```

Open `http://127.0.0.1:8791`. The optional Three.js sphere/workspace presentation needs WebGL and the pinned jsDelivr module; the domain and artifact controls still work if that renderer cannot load. No deployment routes, credentials or room permissions are shared with the application.

## Implemented process

1. Create a token with a stable identity and a defined root domain.
2. Open/close its shell presentation without deleting its contents.
3. Prepare 118 conventional element-symbol profile domains. These carry atomic numbers and symbols, not a claim that 118 physical models exist.
4. Attach one explicit hydrogen model: nonrelativistic, infinite-nuclear-mass Coulomb/Rydberg energy levels in eV. No fine structure, fields, interactions or many-body effects are modeled.
5. Request resolution independently across visual, spatial, structural, computational and semantic dimensions.
6. Run the supported energy-level calculation after requesting computational resolution.
7. Instance a reference to that model and double the exact aggregate count. These are references/counts, not simulated particles or a hydrogen-cloud calculation.
8. Add nested domains and recorded annotations. Preserve local coordinate segments and scale exponents without pretending to provide infinite floating-point precision.
9. Close, serialize, restore and checksum-export/import the token while retaining identities, addresses and model results.

There is **no stellar formation, supernova, nucleosynthesis or heavier-element generation** implemented. No physics is inferred from a glyph, an animation or a large aggregate count. Those later stages require selected, validated computational models.

## Resolution contract

`resolution(domain)` returns requested, available and effective levels, plus unmet requests. Higher requested resolution cannot invent missing data.

- **Visual 0–3:** sphere tessellation levels in the standalone renderer.
- **Spatial 0–3:** display-grid subdivisions; the domain address and scale definition remain distinct from display detail. This is not a precision guarantee.
- **Structural 0–3:** limited by the actual defined descendant depth (capped at three). Empty leaves do not advertise deeper structure.
- **Computational:** zero for unmodeled domains; one for the attached declared hydrogen solver. Requests for two/three remain unmet.
- **Semantic:** identity-only versus inspection of recorded definitions/annotations. Higher interpretation levels remain unavailable.

The token's conceptual definition is recorded separately from presentation and calculated evidence. Closing its displayed shell does not eliminate the defined environment. “Resolution of detail” does not automatically resolve an unfinished symbolic expression or research question.

## Presentation and persistence

The research view morphs between a sphere and a periodic-table layout. This is a presentation mapping, **not a metric-preserving unfolding of a sphere**. It is not a demonstration of all LVT spatial-fidelity claims.

The browser saves research artifacts in its own local-storage key. If storage is unavailable the UI reports memory-only operation; export to retain it. JSON envelopes include SHA-256 of normalized serialized state. This checks integrity, not authorship, permissions or scientific truth. Known computed level records and model constants are validated on import; supplied annotations remain specified statements, not independently verified facts.

Limits: 256 domains, nesting depth 12, 32 aggregate instances, 2,000 retained command receipts, bounded annotations/results, and a 1.5 MB token JSON limit. Commands use revisions and idempotent intent receipts. Failed commands leave the input token unchanged.

## Evidence

The CLI demonstration was executed and round-trips a closed token with 118 profile slots, the declared level calculation and an aggregate count of 4,096. Thirteen unit scenarios cover identity, hierarchy, independent resolution, exact counts beyond JavaScript's safe integer range, retries, invalid models/results and artifact integrity.

The optional WebGL UI and real-device interaction have not been visually tested in Codex's restricted environment. No paid model calls or external scientific computation were initiated.

## Potential future integration — not implemented

A candidate integration would let a room entity reference a versioned artifact ID and request explicit token operations through the room's authenticated command path. Neither browser-local artifacts nor a checksum should grant authority in a shared room. Entity identity, permissions, persistence, migration and resource budgets need a reviewed adapter before token operations enter the live application.
