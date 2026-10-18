# The Archive Tower — Group Canvas branch project

Branch: `experiment/hierarchy-tower`. Independent phone-first artifact browser prototype, not a replacement for Group Canvas. Main is unchanged.

## Interface

Tap a building floor on its exterior to enter that hierarchy level. Datasets are at the foundation, followed upward by Registries, Matrices, Indices, Codices, Algorithms and Logics. Full-width floor targets support touch. Interior views include collection search, sample card inspection, a relationship/navigation map, adjacent-floor navigation and outside return. URLs identify floors and browser Back/Forward works. Native dialogs provide focus containment and close controls. Text input remains at 16px on phones; zoom is retained.

The elevation and seven floors are implemented with DOM/CSS, without WebGL, image downloads, external fonts or runtime dependencies. Hebrew marks are decorative references, not new glyph definitions. Other floor marks are visual icons. The hierarchy is used for navigation, not promoted to an execution invariant.

## Data boundaries

All initial artifacts are explicitly labeled illustrative. Personal notes are stored separately per floor in browser localStorage; exporting produces a JSON backup. They are not authoritative registry entries. Closing the browser preserves notes only where browser storage is available; clearing site data deletes them. No AI, GraphQL bridge, uploaded archive, shared-room records, permissions engine or DSL inversion is connected. The existing Group Canvas service is not used or altered by this prototype.

Future integration may connect floor collections to registry-backed query results and distinguish symbol identity, semantic profile, operational definition and contextual assignment. That requires a separate implementation decision.

## Preview

The branch-only workflow deploys the static frontend to a separate Cloudflare Worker named `group-canvas-tower`, using the repository's existing deployment credentials. It does not upload signing secrets or migrate any database. Source lives in `public/tower/`; standalone worker/config in this directory.

Validation: `node --test experiments/hierarchy-tower/model.test.js`, plus JS syntax checks. Browser rendering and Android touch behavior have not been device-tested in this environment.

## Source storage update — 2026-10-18

The branch now includes the text-first local importer and an optional private R2 source path. See [archive ingestion](ARCHIVE-IMPORT.md) and [storage contract / Claude handoff](STORAGE-HANDOFF-2026-10-18.md). Initial sample artifacts remain illustrative; imports are explicitly separate. No personality or avatar generation is connected. Private storage must be enabled successfully before cloud uploads work; local import works without it.

## File-storage focus

A standalone Android file cabinet is available at `files.html`. It uses private R2 and a persistent server inventory, with operator-only access and no AI/character processing. See [FILING.md](FILING.md) for capabilities, bounds and test evidence.
