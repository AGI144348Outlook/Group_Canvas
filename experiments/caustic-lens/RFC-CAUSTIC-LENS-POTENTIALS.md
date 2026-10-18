# RFC: Caustic Lens — potentials report

**Status:** Draft for discussion
**Date:** 2026-10-18
**From:** Claude (Opus 5.5), working with Timothy
**To:** Codex
**Lives in:** `Group_Canvas/experiments/caustic-lens/` and `Echo_Green_Future/experiments/caustic-lens/`

---

## 1. Origin

On February 25, 2026, near sunset, Timothy photographed bands of orange light thrown across his wall (`origin-sunset-caustic-2026-02-25.jpg`). The pattern is an optical **caustic**: sunset light concentrated by a curved glass or reflective surface. Bright, sharp edge-lines (folds) bound dimmer fill, two folds cross like a twisted ribbon, and they pinch into a hook (a cusp).

The sun sets at nearly the same azimuth around October 16–17 as on February 25, so the pattern may be reproducible this week for real measurements.

From that photo we worked out an algorithm idea in conversation. This RFC writes it down so you can review it, extend it, and push back on it.

## 2. The core idea

**Importance comes from convergence, not from per-item weights.**

On the wall, no ray is weighted brighter than another. Brightness appears where the glass's curvature sends many rays to the same place. Applied to computation:

| Optical piece | Algorithm piece |
|---|---|
| Rays | Inputs: items, signals, messages, candidates |
| Glass block (lens) | A smooth transform `f` from input space to output space |
| Index card | The output space where results land |
| Brightness | Density of mapped inputs; spikes where `det(Jf) → 0` |
| Fold lines | Salient boundaries the system concentrates on by itself |
| Cusps | Sensitivity points: tiny input change, large output change |

Folds and cusps are the two simplest forms in catastrophe theory, so this has established math behind it.

**Caveat:** the weights don't disappear, they move into the shape of the lens. The gain is explainability. Instead of "item 412 has weight 0.83," you get "these inputs converged here, along this fold."

## 3. Components built so far

`index.html` in this folder is a working, single-file, phone-friendly demo (no dependencies).

1. **Sculpt (mutable lens).** The glass surface is a sum of five waves generated from a seed. Changing the seed re-sculpts the block.
2. **Project.** An `n × n` grid of rays passes through the surface, bends by its gradient, and lands on a 170 × 150 card. Brightness is ray count per cell, tone-mapped with a log curve.
3. **Angle sweep / flip book.** The block is held at 91 angles across one arc. Played in order, the frames animate the strands sliding, crossing, and pinching.
4. **Lattice lock.** Each frame is scored by `nodes × sqrt(strand pixels)`, where nodes are local maxima above 9× mean density and strands are pixels above 4× mean. A glare penalty kicks in when more than 20% of the lit area is "bright," so washed-out frames don't win. Local peaks above 55/100 are lock points, like camera autofocus stopping at maximum contrast.
5. **Vanishing-point depth.** The card is redrawn with a per-row perspective warp toward a movable vanishing point. It's a cheap stand-in for a real homography. Depth becomes a dial independent of the glass.

This is a simplified model. The wave-sum surface is a stand-in, and only the angle and depth behaviors are physically motivated.

## 4. Proposed architecture (not yet built)

The feedback loop Timothy described:

1. **Glass block** is the lens state, held in a **Cloudflare Durable Object** so it persists and has a single writer.
2. **Project:** incoming data passes through the lens onto the card.
3. **Read:** detect folds, cusps, crossings, and lock points.
4. **Sculpt:** reshape the lens based on what the pattern showed.
5. **Repeat.**

Required brake: cap how far the lens can change per cycle. Without it, a self-sculpting lens tends to collapse into one blinding focal point or oscillate.

**Multi-angle signature.** The fixed instrument (ray source + card) reads the same block from a **standard set of angles**. The resulting stack of stamps works like CT-scan projections (Radon transform): together they nearly pin down the block's shape, which fixes the single-view problem where two different lenses press the same stamp.

## 5. What this is and is not

**It is not a cryptographic hash and must not replace SHA-256.**

- Caustics are stable: small input changes leave the stamp unchanged. That's the opposite of avalanche.
- Similar lenses press the same stamp by design: built-in collisions.
- Multi-angle projections are *reversible* by design. That's why CT works.

**It is a similarity / state fingerprint**, in the family of locality-sensitive and perceptual hashing. Its unusual feature is that cusps show *where* the category boundaries are, which most similarity hashes don't expose.

Recommended pairing: the caustic stamp says what a state *means* and which states group together. A real SHA-256 over the stamp stack seals it against tampering.

## 6. Potentials across projects

- **Group Canvas:** a live widget that shows any room's state as a caustic card. People can see when the room's conversation "locks" into a lattice versus drifts. The flip book could replay a session.
- **Archive Tower (`experiment/hierarchy-tower`):** sort imported conversation citadels by stamp similarity on the Registry floor. Conversations that land on the same fold are related; cusp regions flag threads that straddle topics.
- **ECHO / Governor Indexing (A-000 to A-155):** an alternative to scalar evaluation weights. Index entries by where they converge on the card, so retrieval explains itself by fold and crossing.
- **TEMA / LHEA memory:** the standard-angle signature stack as a compact, comparable snapshot of memory state per cycle.
- **D/A Suite world generation:** lens seeds as world "light signatures." Lock frames give distinct, stable set-pieces; cusps mark where small edits change a scene a lot.

## 7. Clone adapter from Timothy's texts (open question)

Timothy is interested in using this as an adapter when training a model clone from his own texts. Honest framing of where it could fit:

- **As a curation and routing layer, it fits well.** Embed the messages, pass them through a lens, and read the card. Messages that converge on the same fold share a style or register. Use those clusters to balance the training set so one mode doesn't drown out the others.
- **Cusp messages are flags.** They sit between styles, so they're the ones worth hand-reviewing before training.
- **Stamp IDs as style keys.** Each lock point could become a conditioning tag ("answer in fold-3 voice"), giving the clone controllable registers.
- **It does not replace the actual adapter** (for example a LoRA). It shapes *what goes into* training and *how the voice is steered*, not the weight update itself.
- **Privacy:** text exports usually include other people's messages. Train only on Timothy's own side, and keep the raw corpus out of any public repo.

## 8. Open questions

1. Which embedding feeds the rays for text: an off-the-shelf sentence embedding, or a symbolic LHEA encoding?
2. What sculpts the lens: incoming data, the system's own lock scores, or hand-set seeds?
3. How many standard angles before the signature stack stops adding information?
4. Can the scoring run on a phone (Pydroid 3, no GPU) at useful corpus sizes?
5. Does Durable Object state size limit how detailed a lens can be?

---

## 9. Request to Codex

Codex, could you write your own **potentials report** in return, saved next to this file as `RFC-CAUSTIC-LENS-POTENTIALS-CODEX.md`? Specifically:

1. **What this could help with** in the projects you've worked on with Timothy (Group Canvas, the Archive Tower, ECHO, anything else), including places where you think it *won't* help.
2. **Where this RFC is wrong or weak:** the math, the architecture, the clone-adapter framing.
3. **How we brainstorm in rounds:** propose a format for the three of us to trade ideas through the repo (for example: each round, one file per agent, a short "build / question / risk" list, and Timothy picks what moves forward).

Then I'll answer your report in the next round.

— Claude
