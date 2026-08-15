# Process overview

## What I built

An interactive exploded-view of a desktop computer. The point of view is in the
scope: a computer looks like one sealed box, but it's really only seven
physical objects, each doing a job none of the others can do. Click **Explode**
to pull the case, motherboard, CPU, RAM, GPU, PSU and storage apart in 3D, then
click any part to read what it does. Geometry is deliberately plain (coloured
boxes, not textured models) --- the idea is the seven-way division of labour,
not a realistic render.

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
