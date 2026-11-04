# StructVision Lab

A bench for teaching Strength of Materials and Structural Analysis with the projector on.
You build the problem in front of the class, the diagrams follow your fingers, and every number
comes from a solver running in that browser tab. No server, no accounts, no internet needed once
the page has loaded.

---

## Why this exists

A student watches an SFD/BMD being drawn on a blackboard and memorises the shape, but never sees the beam bend, the section cut, or the fibre that actually carries the stress. StructVision keeps **the physical picture, the equations and the numbers on the same screen, always in sync**:

- drag a support → reactions, SFD, BMD, deflection and the free-body diagram all update in the same frame;
- drag the **virtual section knife** → you see the isolated left piece and the `SFY = 0`, `SM = 0` working;
- switch on **Hide answers** → values disappear from the diagrams, result strips and tables so the class must read them off the graph;
- press **Share** → the whole model (beam + frame + section + theme) is packed into the URL, so students reopen the exact same problem.

---

## The Lecture Studio

The app opens on the **Lecture Studio**, a single console built to run a full class without hunting through menus:

- six concept stages: Beam, Frame, Truck, Fibres, Mohr and Column;
- each stage puts the live drawing in the centre, the controls on the left and the teaching notes on the right;
- guided lecture mode walks the six ideas in order and clears everything below the console for a clean projector screen;
- stage presets load a complete problem in one click, with no typing in front of the class;
- hide answers blanks every printed value so students read the diagram first;
- a student doubt typed in plain words goes straight to the matching concept in the atlas;
- the eight full labs remain one click away when a class needs the detailed editor.

## The eight labs

| # | Lab | What you can do |
|---|--------|-----------------|
| 1 | **Beam: SFD / BMD / Deflection** | Any number of supports (`pin`, `roller`, `fixed`, `guided`, `spring`), internal hinges, support settlement, point / UDL / UVL / moment loads, spans up to 40 m. Drag anything on the drawing to reposition it. 20-element-per-support mesh, exact jumps, zero-shear and contraflexure detection, SOM (+M up) vs RCC (tension side) BMD convention, elastic-curve exaggeration. |
| 2 | **Frame & Truss: 2D analysis** | Draw your own structure: tap the grid to drop joints, tap joint → joint to connect members, drag joints, Ctrl+Z to undo. The canvas is always fitted to the drawing (no wasted letterbox), and the result figure zooms itself so labels and reactions stay readable. Or **generate** a portal frame, multi-storey frame, Warren truss, pitched roof truss or hoarding from *bays / height / load* numbers. Direct stiffness solver with tension / compression / zero-force colouring, frame BMD overlay, load-path animation, per-member inspector. |
| 3 | **Moving loads: influence lines** | Influence line for reaction, shear, moment or deflection at any section of the beam you built in module 1. Drive a single wheel, a two-axle truck (reversible), an IRC-style 4-axle train or a moving UDL; watch each axle's `P·eta` superposition live; snap to the worst position automatically; see the instantaneous BMD under the vehicle. Müller-Breslau explanation built in, and the overlay actually bends the deck into the released shape so the class sees *why* the influence line looks like that. |
| 4 | **Section fibres: stress and shear** | 6 shapes + named catalogue (ISMB 200/300, RCC, T-beam, box, pipe, solid round). Real-time `σ = N/A − My/I`, `τ = VQ/Ib`, von Mises utilisation and shifted neutral axis. Feed forces in from modules 1, 2 or 3. Numeric strip engine is verified against textbook formulas on screen (error shown per property). |
| 5 | **Mohr's circle: stress on any plane** | Stress element and circle locked together: rotate the element by `θ`, the diameter turns by `2θ`. Principal stresses, maximum shear, pole/OP, and the full substitution of your numbers into every equation. Receives fibre stress directly from module 4. |
| 6 | **Columns & shafts: buckling and torsion** | Four end conditions side by side with the effective half-sine `Leff = K·L`, Euler vs Johnson vs crushing, `σcr`-slenderness curve with the operating point. Multi-segment solid/hollow shafts with `T(x)` and `phi(x)`. A, I and material are pulled from the section lab. |
| 7 | **Concept Atlas: explain any doubt** | The explain-anything layer. 22 topics from determinacy to failure theories, each quoting **your** span, moment, section and stress. Type the doubt the student actually asked ("mohr", "truss", "settlement", "energy") and it narrows to the ideas that contain it. Maxwell-Betti reciprocity is not asserted, it is proved live by two separate unit-load solves on your beam (they agree to five decimals). |
| 8 | **Lecture Kit: script and guide** | Six-idea problem pipeline, a click-by-click 30-minute lecture script built off your current model, the misconceptions students actually arrive with, and the deploy notes. |

---

## Why you can trust the numbers

`npm test` runs **66 automated checks**, including `src/engine/handcalc.test.ts`, which compares the solvers against closed-form textbook results:

- simply supported + UDL: `wL/2`, `wL²/8`, `5wL⁴/384EI`, `wL³/24EI`
- simply supported + central point load: `PL/4`, `PL³/48EI`, exact SFD jump of `P`
- cantilever: `PL`, `PL³/3EI`, `wL²/2`, `wL⁴/8EI`
- propped cantilever + UDL: `3wL/8`, `5wL/8`, `wL²/8`, `wL⁴/185EI` and the contraflexure at `L/4`
- fixed-fixed + UDL: `wL²/12`, `wL²/24`, `wL⁴/384EI`
- triangular UVL: `wL/6`, `wL/3`, `wL²/9√3`
- Gerber beam: `M = 0` at the hinge **and** a real slope kink
- spring support: settlement must equal `R/k`
- ILD of a simply supported beam: peak ordinate `ab/L` at the load position `a`
- closed triangle truss: `−7.071 kN` diagonals, `+5 kN` bottom chord, and a two-bar linkage correctly reported as a mechanism
- rectangle section: `A`, `Ixx`, `σ` at the extreme fibre, `1.5 V/A` at the neutral axis
- Mohr circle: centre, radius, principal stresses and zero shear on the principal plane
- Euler column `π²EI/L²`, and `K = 0.5` giving exactly `4×` the pinned load
- shaft: `τ = Tc/J`, `φ = TL/GJ`, `P = 2πNT/60`
- 30 generated structures (5 families × 3 panel counts × braced/unbraced) all stable with `Ds ≥ 0`

Every screen also shows a **live equilibrium audit** (ΣFy, ΣM, ΣFx) recomputed from your model, with residuals in the 1e-14 range.

---

## Teaching controls

Press **`?`** anywhere (outside a text box) for the shortcut sheet:

| Key | Action |
|-----|--------|
| `0` … `8` | Jump to Lecture Studio, Beam, Frame, ILD, Section, Mohr, Column, Atlas, Guide |
| `B` | Beam lab |
| `H` | Hide / show every printed answer |
| `D` | Toggle projector light / dark theme |
| `F` | Full-screen presentation mode |
| `S` | Copy a share link that restores the whole workspace |
| `?` | Shortcut sheet · `Esc` closes dialogs |

The header **settings** menu also holds the accent palette, print-this-lab, full-screen and a one-click **workspace reset**. The active accent, theme and module are remembered between visits; a share link overrides them.

---

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 66 maths checks
npm run build    # static bundle in dist/
npm run preview  # serve the production build
```

## Deploy (no backend at all)

**Vercel** : import the repo; framework *Vite*, build `npm run build`, output `dist`. `vercel.json` is already included.

**GitHub Pages** : push to `main`, then *Settings → Pages → Source: GitHub Actions*. The included workflow builds and publishes; `base: './'` makes the sub-path work.

**Offline classroom** : copy `dist/` to a pen drive, serve the folder with any static file server, project from any laptop.

---

## Sign convention (used everywhere, never re-labelled for display)

- `V` positive when the left segment is pushed up / the right segment pushed down (kN)
- `M` positive when sagging, i.e. the top fibre is in compression (kN·m)
- `N` positive in tension (kN), `sigma` positive in tension (MPa)
- `theta` counter-clockwise positive, `EI` in kN·m², `I` entered in cm⁴ (`EI = E · I · 0.01`)

## Project layout

```
src/
  engine/        pure TypeScript solvers (beam FEM, ILD, 2D stiffness,
                 section/Mohr/buckling/torsion, parametric generator)
                 + handcalc.test.ts  (textbook verification)
  ui/            design system, diagram plot, beam editor, canvas editor
  modules/       the Lecture Studio, eight teaching screens + global inspector
  types/         shared state types and URL-hash sharing
```
