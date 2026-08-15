# Process overview

## What I built

An interactive exploded-view of a desktop computer, now rebuilt as a
cinematic-grade prototype: a fullscreen auto-rotating 3D hero, an explicit
assembly state machine (assembled / exploding / exploded / focused), 12 named
sub-mesh parts (case, glass panel, motherboard, CPU, RAM, GPU, PSU, SSD,
case fan, and a tower cooler built from a base, three heat pipes, nine fins and
a 7-blade fan), staggered assembly-direction-correct explode timing, and camera
choreography that pushes in on a part when it's selected. Selecting a part
slides in a detail panel (bottom drawer on narrow viewports) with its Chinese
name, definition, explanation and facts. The code is split into
`src/{config,parts-data,model,scene,state,camera-rig,interaction,ui}.ts` plus
`main.ts` for orchestration, rather than one file.

The original seven-part scope stands: a computer looks like one sealed box,
but it's really only a handful of physical objects, each doing a job none of
the others can do. The rebuild adds more named sub-parts (splitting the cooler
into its real components, adding the case fan and glass panel) without losing
that division-of-labour framing --- each part's description still names a job
the others structurally can't do.

## The moments that mattered

1. **Scoping "explode a computer" down to exactly seven parts.** A real
   computer has dozens of components, and the brief rewards one strong idea,
   not an inventory. Rather than defaulting to a more literal, more detailed
   model (closer to the course's own [Mechanical
   Watch](https://ciechanow.ski/mechanical-watch/) exemplar), I fixed the
   boundary at seven and wrote the constraint into the copy itself --- each
   part's description had to name a job the other six structurally can't do.
   I checked this held by reading all seven descriptions against each other
   and cutting anything where two jobs blurred together, before writing any
   3D code.
   ([`edc6cfc`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Cichlider/commit/edc6cfc))

2. **A transparent mesh still wins a raycast.** Early testing only ever
   surfaced 4 of the 7 parts as clickable. Manually clicking screenshots
   suggested it was just imprecise aim, but that was the wrong diagnosis: the
   see-through case shell (`opacity: 0.16`) was intercepting clicks meant for
   solid parts behind it, because `intersectObjects()` returns geometric
   distance, not visual opacity. Instead of quietly patching `main.ts` and
   moving on, I wrote the rule into `CLAUDE.md` --- skip transparent-marked
   hits when a solid one exists in the same ray --- so it's a standing check
   for any future week that reuses this pattern, not a one-off fix.
   ([`eb852a6`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Cichlider/commit/eb852a6))

3. **Verifying by computed projection instead of eyeballed pixels.** The
   obvious way to test "is this part clickable" is to look at a screenshot and
   guess a coordinate --- which is exactly what produced the false "imprecise
   aim" read in moment 2, and separately mis-clicked RAM as CPU. I replaced
   that with a script that reconstructs the scene's actual camera (eye
   position, fov, aspect) and projects each part's fully-exploded world
   position to a screen coordinate, then clicks precisely there. Re-running it
   after the raycaster fix confirmed all seven parts respond with the correct
   name and zero console errors, at both marking viewports (1920×1080 and
   390×844). That distinction --- computed, not guessed --- is now a
   standing rule in `CLAUDE.md` rather than something I'd have to relearn next
   time a canvas-based interaction needs testing.
   ([`eb852a6`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Cichlider/commit/eb852a6))

A note on the commit trail: the first two commits above cover more ground each
than they should --- the case/raycaster bug was found and fixed before
anything was committed, so there's no red-to-green range to point at for it,
only the after-state. That's a process gap, not a hidden one: smaller, more
frequent commits are the fix, starting this week.

## The cinematic rebuild

4. **THREE.js composes rotate-then-translate, not the other way round.** While
   arranging the cooler's fan blades radially around its hub, a first draft
   wrapped the blades in a group and rotated the group, on the assumption that
   would spread them around the hub. Before running anything, I worked through
   how THREE.js actually composes an object's world matrix
   (`position + R(rotation) * local`) and realised rotation alone never moves
   a fixed `.position` anywhere --- it only spins the mesh in place. I rewrote
   it to compute each blade's `.position` directly with trigonometry and use
   `.rotation` only for the blade's own facing, then wrote the rule into
   `CLAUDE.md` so it doesn't have to be rediscovered next time something needs
   arranging around a pivot.
   ([`99b094b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Cichlider/commit/99b094b))

5. **A cooler that accidentally looked like a face.** The original cooler was
   a flat fan disc with two symmetric heat pipes poking toward the camera
   above a rectangular block --- which, from the focus camera's frontal angle,
   read as two eyes and a torso rather than a heatsink. A first fix (three
   asymmetric pipes) didn't hold up against a real screenshot comparison and
   arguably read *more* face-like. The fix that actually worked was rerouting
   the pipes to run vertically behind the fin stack (as on a real tower
   cooler) and replacing the flat disc with a ring-hub-and-7-blade fan. I
   confirmed this by comparing rendered screenshots before and after, not by
   reasoning about the geometry in the abstract.
   ([`99b094b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Cichlider/commit/99b094b))

6. **`aria-hidden` doesn't stop Tab from reaching what's underneath it.**
   Debugging a Playwright click timeout on the keyboard-only part-selector
   buttons led me to `document.elementFromPoint()`, which showed the
   sr-only-collapsed buttons genuinely aren't hit-testable by a mouse (nothing
   is painted there) --- that part was working as designed. But the same
   investigation surfaced a real bug: the detail panel's close/prev/next
   buttons stayed in the Tab order even while the panel was closed and marked
   `aria-hidden="true"`, an invalid ARIA state. I fixed it by toggling the
   `inert` property/attribute in lockstep with `aria-hidden`, then re-verified
   with a keyboard-only Playwright pass (`.focus()` + `Enter`, the same path a
   real keyboard user takes) confirming focus can no longer land inside the
   closed panel.
   ([`bac5337`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Cichlider/commit/bac5337))

This time round the rebuild landed as four scoped commits (deps/config, core
3D+state modules, UI+accessibility, orchestration) instead of one bundled dump
--- closer to the commit-as-you-go standard than the first three moments
above, though the cooler and transform-order fixes still landed folded into
the "core 3D+state modules" commit rather than as their own red-to-green
range, since they were caught and fixed before that commit went in.
