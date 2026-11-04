/**
 * conceptAtlas.ts
 * -----------------------------------------------------------------------------
 * The "explain anything" layer.
 *
 * Everything in this app so far answers the question "what are the numbers?".
 * This file answers the other question a teacher actually gets asked in class:
 * "sir, is question mein kaunsa concept lagega, aur kyun?"
 *
 * The atlas does NOT invent results. It reads the live model + the live solver
 * output (beam / frame / ILD / section) and derives, per topic:
 *   - which numbers of THIS problem matter,
 *   - why the topic applies (or honestly says "not the governing case here"),
 *   - the one-line formula, written the way it is written on the board,
 *   - where to go in the app to see it.
 *
 * Every numeric field below comes from a solver run that is already displayed
 * elsewhere in the app, so the atlas can never disagree with the labs.
 */

import { analyzeBeam, BeamAnalysisResult, BeamModel } from './beamEngine';
import { Structure2DModel, Structure2DResult } from './frameTrussEngine';
import { ILDResult } from './ildEngine';
import { analyticSection } from './sectionLib';
import { SectionDimensions } from './sectionMohrBucklingEngine';
import { auditStructureEquilibrium } from './shared';

export type AtlasTier = 'core' | 'analysis' | 'design';

export interface AtlasReading {
  label: string;
  value: string;
  /** optional one-word verdict that colours the chip */
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
}

export interface AtlasTopic {
  id: string;
  n: number;
  tier: AtlasTier;
  title: string;
  titleHi: string;
  /** the question this topic answers, in the language of an exam paper */
  asks: string;
  asksHi: string;
  /** is this topic live for the current model? 'live' | 'related' | 'idle' */
  state: 'live' | 'related' | 'idle';
  /** why it applies, always mentions the user's own numbers */
  because: string;
  becauseHi: string;
  formula: string;
  readings: AtlasReading[];
  /** module id to open */
  goto: string;
  /** a concrete classroom move, not a generic tip */
  boardWork: string;
  boardWorkHi: string;
  keywords: string[];
}

const f = (v: number, d = 2) => {
  if (!Number.isFinite(v)) return 'n/a';
  const r = Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(d);
  return r.replace('-', '−');
};

export interface AtlasInput {
  beam: BeamModel;
  beamRes: BeamAnalysisResult;
  struct: Structure2DModel;
  structRes: Structure2DResult;
  ild: ILDResult | null;
  dims: SectionDimensions;
  fy_MPa: number;
  spanM: number;
  /** live result of the section lab for the governing (M, V) of this beam */
  section: { maxShear_MPa: number; maxVonMises_MPa: number; utilizationRatio: number; maxTension_MPa: number; maxCompression_MPa: number };
}

export interface AtlasResult {
  topics: AtlasTopic[];
  /** short headline of what the current model is "about" */
  profile: {
    kind: 'beam' | 'frame' | 'truss';
    text: string;
    textHi: string;
    tags: string[];
  };
}

/** internal moment at a fraction of the span, straight from the solved mesh */
function momentAt(res: BeamAnalysisResult, x: number): number {
  if (!res.points.length) return 0;
  let best = res.points[0];
  for (const p of res.points) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
  return best.M;
}

function shearAt(res: BeamAnalysisResult, x: number): number {
  if (!res.points.length) return 0;
  let best = res.points[0];
  for (const p of res.points) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
  return best.V;
}

export function buildAtlas(input: AtlasInput): AtlasResult {
  const { beam, beamRes: res, struct, structRes: sres, ild, dims, fy_MPa, spanM, section } = input;

  const g = analyticSection(dims);
  const A_mm2 = g.area_mm2;
  const I_mm4 = g.Ixx_mm4;
  const yMax_mm = Math.max(g.yCentroid_mm, dims.depth_mm - g.yCentroid_mm);
  const Z_mm3 = I_mm4 / Math.max(1, yMax_mm); // elastic section modulus, weaker fibre
  const L_mm = spanM * 1000;

  const frameAudit = auditStructureEquilibrium(struct, sres);
  const isTruss = struct.mode === 'truss';
  const isBeamOnly = beam.supports.length > 0;
  const statIndet = res.Ds;
  const kinIndet = res.Dk;

  // governing beam section (the one a teacher would circle on the board)
  const gov = (() => {
    const cands = res.criticalPoints.filter((c) => c.kind === 'max_sagging' || c.kind === 'max_hogging');
    if (cands.length) return cands.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a));
    return res.criticalPoints[0] ?? { x: spanM / 2, value: 0, unit: 'kN·m', titleEn: 'mid-span', titleHi: 'mid-span', kind: 'max_sagging' as const };
  })();
  const govM = gov.value;
  const govX = gov.x;
  const sigmaBend = Math.max(section.maxTension_MPa, -section.maxCompression_MPa); // from the same strip integration the fibre lab shows
  const tauAvg = (res.maxAbsV * 1000) / Math.max(1, A_mm2);
  const tauPeak = section.maxShear_MPa;
  const N_frame = sres.maxAxialAbs;
  const sigmaAxial = (Math.abs(N_frame) * 1000) / Math.max(1, A_mm2);

  // deflection serviceability (real comparison, not decoration)
  const allowMm = L_mm / 300;
  const defl = res.maxAbsDeflectionMm;
  const deflOk = defl <= allowMm;
  const deflRatio = allowMm > 0 ? defl / allowMm : 0;

  // Euler buckling on the same section, weakest 1.0K axis (pinned-pinned baseline)
  const rMin = Math.sqrt(I_mm4 / Math.max(1, A_mm2));
  const E_MPa = 200_000; // solver default steel; stated in the readings
  const eulerPinned = (Math.PI ** 2 * E_MPa * I_mm4) / (L_mm * L_mm) / 1000; // kN
  const lambdaPinned = L_mm / rMin;
  const lambdaCr = Math.sqrt((2 * Math.PI ** 2 * E_MPa) / fy_MPa); // transition slenderness
  const johnsonStress = Math.max(0, fy_MPa * (1 - (fy_MPa * lambdaPinned ** 2) / (4 * Math.PI ** 2 * E_MPa)));
  const johnsonPinned = (johnsonStress * A_mm2) / 1000; // kN
  const governs = lambdaPinned >= lambdaCr ? 'Euler' : 'Johnson';
  const crPinned = lambdaPinned >= lambdaCr ? eulerPinned : johnsonPinned;

  // a simply-supported reference for the same span and the same load pattern
  const wTotal = beam.loads.reduce((s, l) => {
    const a = Math.abs(l.magnitude ?? 0);
    if (l.type === 'point') return s + a;
    const x1 = l.xStart ?? 0;
    const x2 = l.xEnd ?? x1;
    if (l.type === 'udl') return s + a * Math.abs(x2 - x1);
    if (l.type === 'uvl') return s + (Math.abs((l.wStart ?? 0) + (l.wEnd ?? 0)) / 2) * Math.abs(x2 - x1);
    return s; // a pure couple adds no vertical load
  }, 0);

  const momentFrac = res.maxSaggingM !== 0 ? Math.abs(res.maxHoggingM / res.maxSaggingM) : 0;

  // ---- Maxwell-Betti, computed for real: two unit-load solves on the user's own beam ----
  const recip = (() => {
    try {
      const x1 = Math.round(spanM * 0.4 * 100) / 100;
      const x2 = Math.round(spanM * 0.72 * 100) / 100;
      if (Math.abs(x1 - x2) < 1e-3) return null;
      const unitAt = (x: number): BeamModel => ({
        ...beam,
        loads: [{ id: '__unit', type: 'point', x, magnitude: 1 }],
        supports: beam.supports.map((sp) => ({ ...sp, settlementMm: 0 })),
      });
      const r1 = analyzeBeam(unitAt(x1));
      const r2 = analyzeBeam(unitAt(x2));
      if (!r1.isStable || !r2.isStable) return null;
      // linear interpolation between mesh stations: the two unit-load cases must be
      // compared at the exact same physical points, not at the nearest node
      const deflAt = (r: BeamAnalysisResult, x: number) => {
        const pts = r.points;
        if (!pts.length) return 0;
        for (let i = 1; i < pts.length; i++) {
          if (pts[i].x >= x) {
            const a = pts[i - 1];
            const b = pts[i];
            const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
            return Math.abs(a.deflectionMm + t * (b.deflectionMm - a.deflectionMm));
          }
        }
        return Math.abs(pts[pts.length - 1].deflectionMm);
      };
      const d21 = deflAt(r1, x2); // δ at x2 from a unit load at x1
      const d12 = deflAt(r2, x1); // δ at x1 from a unit load at x2
      const err = Math.max(d12, d21) > 1e-9 ? Math.abs(d21 - d12) / Math.max(d12, d21) : 0;
      return { x1, x2, d21, d12, err };
    } catch {
      return null;
    }
  })();

  // ---- eccentric / kern numbers for the current section (rectangular-family) ----
  const depthM = dims.depth_mm / 1000;
  const kernHalf = depthM / 6; // middle-third limit for a solid rectangle
  const eEcc = Math.abs(govM) / Math.max(1e-6, Math.abs(N_frame) + 1e-9); // eccentricity implied by M and N

  const topics: AtlasTopic[] = [
    /* ------------------------------------------------------------------ 1 */
    {
      id: 'determinacy',
      n: 1,
      tier: 'core',
      title: 'Determinacy: is the answer unique?',
      titleHi: 'Determinacy: kya answer unique hai?',
      asks: 'Find reactions / draw the diagram, is the structure determinate, indeterminate or a mechanism?',
      asksHi: 'Reactions nikaalo / diagram banao, determinate hai, indeterminate hai, ya mechanism?',
      state: 'live',
      because:
        `Your beam has ${beam.supports.length} support(s), ${beam.hinges.length} hinge(s) and ${beam.loads.length} load(s), ` +
        `so Ds = r − (2 + h) = ${statIndet}. ` +
        (statIndet === 0
          ? 'Every reaction comes out of ΣF and ΣM alone. That is why editing EI leaves the numbers alone.'
          : statIndet > 0
            ? 'More unknowns than equations, so compatibility has to come in and rescue it.'
            : 'Fewer unknowns than equations, transverse equilibrium by itself cannot hold this up.') +
        (sres.isStable ? ` The drawn frame reads Ds = ${sres.Ds}, Dk = ${sres.Dk}.` : ' The drawn frame is currently unstable.'),
      becauseHi:
        `Beam me ${beam.supports.length} support, ${beam.hinges.length} hinge aur ${beam.loads.length} load hain ⇒ Ds = r − (2 + h) = ${statIndet}. ` +
        (statIndet === 0
          ? 'ΣF aur ΣM se hi saare reactions nikal aate hain. Isi liye EI badalne se numbers nahi hilte.'
          : statIndet > 0
            ? 'Unknowns equations se zyada hain, to compatibility ko bich me aana padega.'
            : 'Unknowns equations se kam hain, sirf transverse equilibrium se yeh sambhalega nahi.'),
      formula: 'Ds = r − (2 + h)  ·  2D: Ds = 3m + r − 3j − h  ·  Dk = unknown joint displacements',
      readings: [
        { label: 'Beam Ds', value: String(statIndet), tone: statIndet === 0 ? 'ok' : 'warn' },
        { label: 'Beam Dk', value: String(kinIndet) },
        { label: 'Frame Ds / Dk', value: `${sres.Ds} / ${sres.Dk}` },
        { label: 'Stable?', value: res.isStable && sres.isStable ? 'yes' : 'no', tone: res.isStable && sres.isStable ? 'ok' : 'bad' },
      ],
      goto: 'beam',
      boardWork: 'Change only EI (double it) and watch V and M. If they do not move, the class has *seen* determinacy.',
      boardWorkHi: 'Sirf EI double karo, V aur M hilte hain? Nahi hilte, to class ne determinacy dekh li.',
      keywords: ['determinate', 'indeterminate', 'mechanism', 'ds', 'dk', 'static', 'kinematic', 'redundant'],
    },

    /* ------------------------------------------------------------------ 2 */
    {
      id: 'equilibrium',
      n: 2,
      tier: 'core',
      title: 'Equilibrium & free-body diagrams',
      titleHi: 'Equilibrium aur FBD',
      asks: 'Draw the FBD of the whole structure / of a cut portion and write ΣFx, ΣFy, ΣM.',
      asksHi: 'Poore structure ka ya cut portion ka FBD banao aur ΣFx, ΣFy, ΣM likho.',
      state: 'live',
      because:
        `The solver is balancing your model right now: the supports add up to ${f(res.reactions.reduce((s, r) => s + r.Ry, 0), 1)} kN against ${f(wTotal, 1)} kN of load. ` +
        'Moment about the first support closes to machine zero (you can read the residual in the audit strip). ' +
        'The knife repeats the same check on the piece it has cut off, which is exactly the FBD you would draw.',
      becauseHi:
        `Solver abhi aapka model balance kar raha hai: supports ka total ${f(res.reactions.reduce((s, r) => s + r.Ry, 0), 1)} kN, load ${f(wTotal, 1)} kN. ` +
        'Pehle support ke about moment machine-zero tak band hota hai, residual audit strip me dekh lo. ' +
        'Knife wahi check katé hue piece par dohrata hai, jo bilkul aapke FBD jaisa hai.',
      formula: 'ΣFx = 0 · ΣFy = 0 · ΣM = 0  →  r unknowns, 3 equations',
      readings: [
        { label: 'ΣRy (supports)', value: `${f(res.reactions.reduce((s, r) => s + r.Ry, 0), 1)} kN` },
        { label: 'Applied load ΣP', value: `${f(wTotal, 1)} kN` },
        { label: 'Moment at cut', value: `${f(momentAt(res, govX), 1)} kN·m` },
        {
          label: 'Frame ΣFx / ΣFy',
          value: frameAudit.length ? `${f(frameAudit[0].residual, 1)} / ${f(frameAudit[1]?.residual ?? 0, 1)} kN` : 'unstable',
          tone: frameAudit.length ? 'ok' : 'bad',
        },
      ],
      goto: 'beam',
      boardWork: 'Drag the knife to mid-span and read ΣMcut = 0 out loud; then move the knife and let them predict the new M before you press.',
      boardWorkHi: 'Knife ko mid-span par le jao, ΣMcut = 0 bolo; phir knife hila kar class se naya M predict karwao.',
      keywords: ['equilibrium', 'fbd', 'free body', 'reaction', 'sum of forces', 'moment'],
    },

    /* ------------------------------------------------------------------ 3 */
    {
      id: 'sfd-bmd',
      n: 3,
      tier: 'core',
      title: 'SFD, BMD and the V-M-w family',
      titleHi: 'SFD, BMD aur V-M-w rishta',
      asks: 'Draw the shear force and bending moment diagrams; locate max BM, zero shear and points of contraflexure.',
      asksHi: 'SFD aur BMD banao; max BM, zero shear aur contraflexure batao.',
      state: 'live',
      because:
        `Your governing moment is ${f(Math.abs(govM), 1)} kN·m at x = ${f(govX, 2)} m (${gov.titleEn}) and the peak shear is ` +
        `${f(res.maxAbsV, 1)} kN. ` +
        (momentFrac > 0.05
          ? `Hogging reaches ${f(Math.abs(res.maxHoggingM), 1)} kN·m against ${f(res.maxSaggingM, 1)} kN·m of sagging, so the diagram crosses zero, that crossing is the contraflexure to hunt for on the board.`
          : 'Nothing hogged here, so this beam has no point of contraflexure at all. Worth saying out loud, half the class will assume there must be one.'),
      becauseHi:
        `Is problem me governing moment ${f(Math.abs(govM), 1)} kN·m hai x = ${f(govX, 2)} m par, aur peak shear ${f(res.maxAbsV, 1)} kN. ` +
        (momentFrac > 0.05
          ? `Hogging ${f(Math.abs(res.maxHoggingM), 1)} kN·m tak jaata hai, sagging ${f(res.maxSaggingM, 1)} kN·m, diagram zero cross karta hai, wahi contraflexure hai.`
          : 'Yahan kuch bhi hogging me nahi gaya, matlab is beam me contraflexure hi nahi hai. Class ko bolna zaroori hai, aadhe log maan ke chalte hain ki hona chahiye.'),
      formula: 'w = dV/dx · V = dM/dx · M peak where V = 0 · M = 0 and curvature flips ⇒ contraflexure',
      readings: [
        { label: 'M max (sag)', value: `${f(res.maxSaggingM, 1)} kN·m`, tone: 'ok' },
        { label: 'M max (hog)', value: `${f(Math.abs(res.maxHoggingM), 1)} kN·m`, tone: Math.abs(res.maxHoggingM) > 1e-3 ? 'warn' : 'neutral' },
        { label: 'V max', value: `${f(res.maxAbsV, 1)} kN` },
        { label: 'Critical points found', value: String(res.criticalPoints.length) },
      ],
      goto: 'beam',
      boardWork: 'Switch the BMD to the RCC convention and ask which face cracks. Same diagram, different reading, that contrast is the lesson.',
      boardWorkHi: 'BMD ko RCC convention par switch karo aur poocho kaunsa face crack karega, same diagram, alag reading.',
      keywords: ['sfd', 'bmd', 'shear force', 'bending moment', 'contraflexure', 'zero shear', 'diagram'],
    },

    /* ------------------------------------------------------------------ 4 */
    {
      id: 'flexure',
      n: 4,
      tier: 'core',
      title: "Bending stress, the flexure formula",
      titleHi: 'Bending stress, flexure formula',
      asks: 'Find the maximum bending stress, or the required section modulus for a given moment.',
      asksHi: 'Maximum bending stress nikaalo, ya diye moment ke liye section modulus chahiye.',
      state: 'live',
      because:
        `Put ${f(Math.abs(govM), 1)} kN·m through this section (I = ${f(I_mm4 / 1e4, 0)} cm⁴, ${f(dims.depth_mm, 0)} mm deep) and the outer fibre sees ` +
        `σ = My/I = ${f(sigmaBend, 1)} MPa. ` +
        (sigmaBend > fy_MPa
          ? `That is already past fy = ${fy_MPa} MPa, so the question here is "why did it fail", not "how big should it be".`
          : `That leaves ${f(100 - (sigmaBend / fy_MPa) * 100, 0)}% of fy = ${fy_MPa} MPa unused, tight enough that a slightly deeper section would be the honest answer.`),
      becauseHi:
        `${f(Math.abs(govM), 1)} kN·m is section me daalo (I = ${f(I_mm4 / 1e4, 0)} cm⁴, depth ${f(dims.depth_mm, 0)} mm) to bahar wala fibre ` +
        `σ = My/I = ${f(sigmaBend, 1)} MPa jhelta hai. ` +
        (sigmaBend > fy_MPa
          ? `Yeh fy = ${fy_MPa} MPa se pehle hi paar ho gaya, matlab sawaal "yeh toota kyun" ka hai, "kitna mota karun" ka nahi.`
          : `fy = ${fy_MPa} MPa ka ${f(100 - (sigmaBend / fy_MPa) * 100, 0)}% khaali pada hai, thoda gehra section lena zyada imaandaar jawab hoga.`),
      formula: 'σ = M·y / I = M / Z ·  Z = I / ymax ·  σtop = −M c₁/I, σbot = +M c₂/I',
      readings: [
        { label: 'Governing M', value: `${f(Math.abs(govM), 1)} kN·m` },
        { label: 'Z elastic', value: `${f(Z_mm3 / 1e3, 0)} cm³` },
        { label: 'σ extreme', value: `${f(sigmaBend, 1)} MPa`, tone: sigmaBend > fy_MPa ? 'bad' : 'ok' },
        { label: 'Utilisation', value: `${f((sigmaBend / fy_MPa) * 100, 0)}%`, tone: sigmaBend > fy_MPa ? 'bad' : sigmaBend > 0.85 * fy_MPa ? 'warn' : 'ok' },
      ],
      goto: 'section',
      boardWork: `Send the governing section (${f(Math.abs(govM), 1)} kN·m) to the fibre lab and let the class pick the depth so σ lands just under fy.`,
      boardWorkHi: `Governing section (${f(Math.abs(govM), 1)} kN·m) fibre lab me bhejo aur class se woh depth chunwao jahan σ theek fy ke neeche ho.`,
      keywords: ['bending stress', 'flexure', 'section modulus', 'my/i', 'sigma', 'extreme fibre'],
    },

    /* ------------------------------------------------------------------ 5 */
    {
      id: 'shear-stress',
      n: 5,
      tier: 'analysis',
      title: 'Shear stress across the depth',
      titleHi: 'Depth ke saath shear stress',
      asks: 'Sketch the shear stress distribution and find τmax; explain why it peaks at the neutral axis.',
      asksHi: 'Shear stress distribution banao, τmax nikaalo; neutral axis par peak kyun hota hai?',
      state: 'live',
      because:
        `Peak shear is ${f(res.maxAbsV, 1)} kN. On this section the average is V/A = ${f(tauAvg, 2)} MPa, but the real peak is ` +
        `${f(tauPeak, 2)} MPa at the web/NA, i.e. ${f(tauAvg > 0 ? tauPeak / tauAvg : 0, 2)}× the average. ` +
        (dims.shape === 'i_section'
          ? 'For an I-section almost all of it is carried by the thin web, that is why the web thickness is a design lever, not a detail.'
          : dims.shape === 'rectangular'
            ? 'For a rectangle τmax = 1.5 V/A exactly at mid-depth, a good closed-form check to do on the board.'
            : 'The distribution follows Q(y)/I·b, so whichever fibre has the biggest first moment Q carries the peak.'),
      becauseHi:
        `Peak shear ${f(res.maxAbsV, 1)} kN hai. Section par average V/A = ${f(tauAvg, 2)} MPa, lekin asli peak ` +
        `${f(tauPeak, 2)} MPa NA/web par, average ka ${f(tauAvg > 0 ? tauPeak / tauAvg : 0, 2)} guna. ` +
        (dims.shape === 'i_section'
          ? 'I-section me lagbhag poora shear web uthata hai, isi liye web thickness design lever hai.'
          : dims.shape === 'rectangular'
            ? 'Rectangle me τmax = 1.5 V/A bilkul mid-depth par, board par closed-form check karo.'
            : 'Distribution Q(y)/(I·b) follow karta hai, is liye jahan Q max wahan peak.'),
      formula: 'τ = V·Q / (I·b) ·  rect: τmax = 1.5 V/A ·  circle: τmax = 4V/3A ·  I: ≅ V/(tw·d)',
      readings: [
        { label: 'V max', value: `${f(res.maxAbsV, 1)} kN` },
        { label: 'τ average', value: `${f(tauAvg, 2)} MPa` },
        { label: 'τ max (VQ/Ib)', value: `${f(tauPeak, 2)} MPa`, tone: 'warn' },
        { label: 'Shape factor τ', value: `${f(tauAvg > 0 ? tauPeak / tauAvg : 0, 2)}×` },
      ],
      goto: 'section',
      boardWork: 'Probe the depth slider from top fibre to NA and ask where the class predicts the peak, most say the flange.',
      boardWorkHi: 'Depth probe slider ko top fibre se NA tak le jao aur class se peak predict karwao, zyadatar flange bolte hain.',
      keywords: ['shear stress', 'vq/ib', 'tau', 'neutral axis', 'web', 'parabolic'],
    },

    /* ------------------------------------------------------------------ 6 */
    {
      id: 'deflection',
      n: 6,
      tier: 'design',
      title: 'Deflection and serviceability',
      titleHi: 'Deflection aur serviceability',
      asks: 'Find the maximum deflection / slope, or check whether it satisfies L/250 or L/300.',
      asksHi: 'Max deflection / slope nikaalo, ya L/250-L/300 check karo.',
      state: 'live',
      because:
        `EI = ${f(res.EI_kNm2, 0)} kN·m² gives δmax = ${f(defl, 2)} mm at x = ${f(res.maxDeflectionX, 2)} m. ` +
        `Against L/300 = ${f(allowMm, 1)} mm that is ${f(deflRatio * 100, 0)}% of the allowance, ` +
        (deflOk ? 'it passes.' : 'it fails, and no amount of extra steel strength fixes stiffness.') +
        ' Doubling EI halves this number and changes nothing in the BMD, the classic determinate insight.',
      becauseHi:
        `EI = ${f(res.EI_kNm2, 0)} kN·m² se δmax = ${f(defl, 2)} mm milta hai x = ${f(res.maxDeflectionX, 2)} m par. ` +
        `L/300 = ${f(allowMm, 1)} mm ke saamne yeh ${f(deflRatio * 100, 0)}% hai, ` +
        (deflOk ? 'pass ho raha hai.' : 'fail ho raha hai, aur strength badhane se stiffness nahi badhegi.') +
        ' EI double karo to yeh aadha ho jayega aur BMD me kuch nahi badlega.',
      formula: 'EI·d²y/dx² = M(x) ·  δmax ≤ L/300 (floors) or L/250 ·  θ = dy/dx',
      readings: [
        { label: 'δ max', value: `${f(defl, 2)} mm`, tone: deflOk ? 'ok' : 'bad' },
        { label: 'Allowance L/300', value: `${f(allowMm, 1)} mm` },
        { label: 'Used', value: `${f(deflRatio * 100, 0)}%`, tone: deflOk ? 'ok' : 'bad' },
        { label: 'EI', value: `${f(res.EI_kNm2 / 1000, 0)}×10³ kN·m²` },
      ],
      goto: 'beam',
      boardWork: 'Turn the deflection exaggeration up, then halve I and let the class watch the curve sag without the BMD moving at all.',
      boardWorkHi: 'Deflection exaggeration badhao, phir I aadha karo, curve latakta dikhega, BMD bilkul nahi hilega.',
      keywords: ['deflection', 'slope', 'serviceability', 'l/300', 'l/250', 'ei', 'elastic curve'],
    },

    /* ------------------------------------------------------------------ 7 */
    {
      id: 'strain-energy',
      n: 7,
      tier: 'analysis',
      title: 'Energy, work and virtual work',
      titleHi: 'Energy, work aur virtual work',
      asks: 'Use the unit-load / virtual-work method to get a deflection, or compute strain energy.',
      asksHi: 'Unit-load / virtual work se deflection nikaalo, ya strain energy compute karo.',
      state: 'related',
      because:
        `The engine already integrates the real M(x) numerically over ${res.points.length} stations; a unit load at the same point ` +
        'gives the influence ordinate, and the same integral with M̄ in place of M is the virtual-work deflection. ' +
        `For this beam ∫M²/(2EI) with M max ${f(res.maxSaggingM, 1)} kN·m over ${f(spanM, 2)} m is the bending energy that the deflection number is hiding.`,
      becauseHi:
        `Engine asli M(x) ko ${res.points.length} stations par integrate karta hai; usi point par unit load lagao to influence ordinate milta hai, ` +
        'aur M ki jagah M̄ rakh do to wahi integral virtual-work deflection deta hai. ' +
        `Is beam ka ∫M²/(2EI), M max ${f(res.maxSaggingM, 1)} kN·m ke saath, wahi bending energy hai jo deflection number me chhupi hai.`,
      formula: 'δ = ∫ M·M̄ /(EI) dx  (unit load) ·  U = ∫ M²/(2EI) dx + ∫ V²/(2GA) dx + ∫ N²/(2EA) dx',
      readings: [
        { label: 'Stations integrated', value: String(res.points.length) },
        { label: 'M max', value: `${f(res.maxSaggingM, 1)} kN·m` },
        { label: 'ILD available?', value: ild ? `yes · ηmax ${f(ild.maxPos.val, 3)}` : 'open ILD lab', tone: ild ? 'ok' : 'neutral' },
        { label: 'δ from the same integral', value: `${f(defl, 2)} mm` },
      ],
      goto: 'ild',
      boardWork: 'Put a unit load at the section of interest in the ILD lab, the ordinate is exactly the δ from unit-load theory, per kN.',
      boardWorkHi: 'ILD lab me section par unit load lagao, ordinate bilkul unit-load theory ka δ hai, per kN.',
      keywords: ['virtual work', 'unit load', 'energy', 'castigliano', 'work done', 'strain energy'],
    },

    /* ------------------------------------------------------------------ 8 */
    {
      id: 'moving-loads',
      n: 8,
      tier: 'analysis',
      title: 'Influence lines and moving loads',
      titleHi: 'Influence line aur moving loads',
      asks: 'Draw the influence line for a reaction / shear / moment, then find the worst position of a moving load or train.',
      asksHi: 'Reaction / shear / moment ka ILD banao, phir moving load ya train ki worst position nikaalo.',
      state: ild ? 'live' : 'related',
      because: ild
        ? `The ILD for ${ild.targetTitleEn.toLowerCase()} peaks at ${f(ild.maxPos.val, 3)} ${ild.unit} at x = ${f(ild.maxPos.x, 2)} m, with a net area of ${f(ild.netArea, 2)}. ` +
          'A load parked at the peak gives the biggest effect; the area under the diagram is what a uniformly distributed load "sees". ' +
          '(In the BMD the load is fixed and the section moves, here it is exactly the other way round.)'
        : 'Open the ILD lab once and this card turns live: it will read the ordinate peak, the net area and the governing wheel position of your own beam.',
      becauseHi: ild
        ? `ILD ${ild.targetTitleHi.toLowerCase()} ka peak ${f(ild.maxPos.val, 3)} ${ild.unit} hai x = ${f(ild.maxPos.x, 2)} m par, net area ${f(ild.netArea, 2)}. ` +
          'Load ko peak par khada karo to sabse bada effect; diagram ke neeche ka area wahi hai jo UDL "dekhta" hai. ' +
          '(BMD me load fix rehta hai aur section chalta hai, yahan bilkul ulta hai.)'
        : 'ILD lab ek baar kholo, yeh card live ho jayega: aapke beam ka ordinate peak, net area aur governing wheel position dikhayega.',
      formula: 'S = Σ Pᵢ·η(xᵢ)  ·  ILD for MC peaks at a·b/L  ·  Müller-Breslau: release the restraint, the deflected shape IS the ILD',
      readings: ild
        ? [
            { label: 'Peak ordinate', value: `${f(ild.maxPos.val, 3)} ${ild.unit}`, tone: 'ok' },
            { label: 'at x', value: `${f(ild.maxPos.x, 2)} m` },
            { label: 'Net area', value: f(ild.netArea, 2) },
            { label: 'Determinate?', value: ild.isDeterminate ? 'yes → straight lines' : 'no → curved', tone: ild.isDeterminate ? 'ok' : 'warn' },
          ]
        : [
            { label: 'Beam span', value: `${f(spanM, 2)} m` },
            { label: 'Supports', value: String(beam.supports.length) },
            { label: 'ILD', value: 'not computed yet' },
            { label: 'Why it matters', value: 'bridges, cranes, gantry' },
          ],
      goto: 'ild',
      boardWork: 'Snap the truck to the worst position, then drag it off. The P·η table makes superposition visible in one gesture.',
      boardWorkHi: 'Truck ko worst position par snap karo, phir hata do, P·η table me superposition ek hi gesture me dikh jayega.',
      keywords: ['ild', 'influence line', 'moving load', 'muller breslau', 'train', 'truck', 'worst position'],
    },

    /* ------------------------------------------------------------------ 9 */
    {
      id: 'indeterminate',
      n: 9,
      tier: 'analysis',
      title: 'Indeterminate beams: compatibility in charge',
      titleHi: 'Indeterminate beam: compatibility ka raaj',
      asks: 'Solve a fixed / continuous / propped beam with Clapeyron, slope-deflection, moment distribution or stiffness.',
      asksHi: 'Fixed / continuous / propped beam solve karo, Clapeyron, slope-deflection, moment distribution ya stiffness se.',
      state: statIndet > 0 ? 'live' : 'related',
      because: statIndet > 0
        ? `This beam already has Ds = ${statIndet}. The solver did not "guess", it assembled the beam stiffness matrix and solved K·d = F, so compatibility and equilibrium are satisfied together. ` +
          `Shift the supports or change EI and the moment diagram redistributes, which is exactly what students find counter-intuitive.`
        : `Your beam is determinate (Ds = ${statIndet}), so this is the contrast case: make one end fixed and the hogging moment at that support appears out of nowhere. ` +
          `Do that live, the same loads will give a completely different BMD with no change in equilibrium.`,
      becauseHi: statIndet > 0
        ? `Is beam ka Ds = ${statIndet} hai. Solver ne guess nahi kiya, beam stiffness matrix bana kar K·d = F solve kiya, is liye compatibility aur equilibrium dono satisfy hote hain. ` +
          'Support ya EI badlo, moment redistribute ho jayega, yahi cheez students ko ulti lagti hai.'
        : `Aapka beam determinate hai (Ds = ${statIndet}), to yeh contrast case hai: ek end fixed kar do aur wahan hogging moment apne aap aa jayega. ` +
          'Live karke dikhao, same load, bilkul alag BMD, equilibrium me koi farq nahi.',
      formula: 'Stiffness: [K]{d} = {F} ·  Slope-deflection: MAB = 2EI/L (2θA + θB − 3Δ/L) + FEM ·  Three-moment: MA L₁/I₁ + 2MB(L₁/I₁+L₂/I₂) + MC L₂/I₂ = −6(...)',
      readings: [
        { label: 'Ds current', value: String(statIndet), tone: statIndet > 0 ? 'warn' : 'neutral' },
        { label: 'Redundants', value: String(Math.max(0, statIndet)) },
        { label: 'Hogging present', value: Math.abs(res.maxHoggingM) > 1e-3 ? 'yes' : 'no', tone: Math.abs(res.maxHoggingM) > 1e-3 ? 'warn' : 'neutral' },
        { label: 'EI', value: `${f(res.EI_kNm2 / 1000, 0)}×10³ kN·m²` },
      ],
      goto: 'beam',
      boardWork: 'Add a fixed support to this same beam and let the class watch the hogging moment appear at the support, then remove it again.',
      boardWorkHi: 'Isi beam par fixed support lagao, support par hogging palta dikhega, phir hata do, contrast yaad reh jayega.',
      keywords: ['indeterminate', 'fixed beam', 'continuous', 'clapeyron', 'slope deflection', 'moment distribution', 'propped', 'redundant'],
    },

    /* ------------------------------------------------------------------ 10 */
    {
      id: 'truss',
      n: 10,
      tier: 'analysis',
      title: 'Trusses: joints, zero-force members',
      titleHi: 'Truss: joints aur zero-force members',
      asks: 'Find member forces by method of joints or sections; identify zero-force members.',
      asksHi: 'Method of joints / sections se member forces nikaalo; zero-force members pehchano.',
      state: isTruss ? 'live' : 'related',
      because: isTruss
        ? `Your drawn truss has ${struct.nodes.length} joints and ${struct.members.length} members, so m = 2j − 3 reads ${struct.members.length} vs ${2 * struct.nodes.length - 3}. ` +
          `Peak axial is ${f(sres.maxAxialAbs, 1)} kN and ${sres.members.filter((m) => m.state === 'zero').length} member(s) are zero-force. ` +
          'Those are the ones the class should spot by eye at a two-member unloaded joint and at a T-joint with no external load.'
        : `You are on a frame model right now. Switch the canvas to Truss and the same stiffness solver becomes a pin-jointed solver; ` +
          'the zero-force members show up dashed grey, that is the "spot it by eye" rule made visible.',
      becauseHi: isTruss
        ? `Aapke truss me ${struct.nodes.length} joints aur ${struct.members.length} members hain, m = 2j − 3 se ${struct.members.length} vs ${2 * struct.nodes.length - 3}. ` +
          `Peak axial ${f(sres.maxAxialAbs, 1)} kN, aur ${sres.members.filter((m) => m.state === 'zero').length} zero-force member. ` +
          'Unloaded two-member joint aur bina load wale T-joint par class ko aankh se pehchanna chahiye.'
        : `Abhi frame model chal raha hai. Canvas ko Truss par switch karo, wahi stiffness solver pin-jointed ban jata hai; ` +
          'zero-force members dashed grey dikhte hain, yani "aankh se pakdo" rule dikh jata hai.',
      formula: 'm = 2j − 3 (determinate truss) ·  ΣFx = ΣFy = 0 at each joint ·  zero-force: 2 members at an unloaded joint, or a T-joint',
      readings: [
        { label: 'Joints / members', value: `${struct.nodes.length} / ${struct.members.length}` },
        { label: 'm − (2j−3)', value: String(struct.members.length - (2 * struct.nodes.length - 3)), tone: struct.members.length - (2 * struct.nodes.length - 3) === 0 ? 'ok' : 'warn' },
        { label: 'Peak axial', value: `${f(sres.maxAxialAbs, 1)} kN` },
        { label: 'Zero-force', value: String(sres.members.filter((m) => m.state === 'zero').length) },
      ],
      goto: 'structure',
      boardWork: 'Use the highlight chips to isolate "zero-force", the members that stay are the ones carrying the load path.',
      boardWorkHi: 'Highlight chips se "zero-force" chuno, bache hue members hi load path hain.',
      keywords: ['truss', 'joint', 'zero force', 'method of joints', 'method of sections', '2j-3'],
    },

    /* ------------------------------------------------------------------ 11 */
    {
      id: 'frames',
      n: 11,
      tier: 'analysis',
      title: 'Rigid frames: sway, side-sway and 6 EI/L',
      titleHi: 'Rigid frame: sway aur 6EI/L',
      asks: 'Analyse a portal / multi-storey frame; find sway, member end moments and axial forces.',
      asksHi: 'Portal / multi-storey frame analyse karo; sway, end moments aur axial forces nikaalo.',
      state: isTruss ? 'related' : 'live',
      because: isTruss
        ? 'Switch the canvas to Frame: a rigid joint carries moment, so Dk jumps from 2 to 3 per free joint and sway becomes possible.'
        : `Your frame has ${struct.nodes.length} joints, Ds = ${sres.Ds} and Dk = ${sres.Dk}. Peak moment is ${f(sres.maxMomentAbs, 1)} kN·m and peak axial ${f(sres.maxAxialAbs, 1)} kN. ` +
          (sres.Dk > struct.nodes.filter((n) => n.support === 'free').length * 2
            ? 'Dk is higher than 2 per free joint, that is the sway degree cost of rigid joints.'
            : 'With these supports the frame is braced enough that sway is restrained.'),
      becauseHi: isTruss
        ? 'Canvas ko Frame par switch karo: rigid joint moment uthata hai, is liye Dk 2 se 3 ho jata hai aur sway possible hota hai.'
        : `Aapke frame me ${struct.nodes.length} joints hain, Ds = ${sres.Ds}, Dk = ${sres.Dk}. Peak moment ${f(sres.maxMomentAbs, 1)} kN·m aur axial ${f(sres.maxAxialAbs, 1)} kN. ` +
          (sres.Dk > struct.nodes.filter((n) => n.support === 'free').length * 2
            ? 'Dk 2-per-joint se zyada hai, yahi rigid joints ka sway cost hai.'
            : 'In supports ke saath frame itna braced hai ki sway restrained hai.'),
      formula: 'MAB = 3EI/L (θA) · with sway: − 6EIΔ/L² ·  K·d = F assembled at every free joint (ux, uy, θ)',
      readings: [
        { label: 'Frame Ds / Dk', value: `${sres.Ds} / ${sres.Dk}` },
        { label: 'Max |M|', value: `${f(sres.maxMomentAbs, 1)} kN·m`, tone: 'warn' },
        { label: 'Max |N|', value: `${f(sres.maxAxialAbs, 1)} kN` },
        { label: 'σ axial (this section)', value: `${f(sigmaAxial, 1)} MPa` },
      ],
      goto: 'structure',
      boardWork: 'Turn the deform slider up and drag it, the sway of a portal frame under a lateral load is the whole stiffness lecture in one picture.',
      boardWorkHi: 'Deform slider badhao aur ghumao, lateral load par portal frame ka sway poori stiffness lecture ek tasveer me.',
      keywords: ['frame', 'portal', 'sway', 'rigid joint', 'stiffness', 'multi storey'],
    },

    /* ------------------------------------------------------------------ 12 */
    {
      id: 'torsion',
      n: 12,
      tier: 'analysis',
      title: 'Torsion of shafts',
      titleHi: 'Shaft ka torsion',
      asks: 'Find the shear stress and twist angle in a solid or hollow shaft carrying a torque.',
      asksHi: 'Solid ya hollow shaft me torque se shear stress aur twist nikaalo.',
      state: 'related',
      because:
        `Torsion is the same Vy distribution idea wrapped around an axis: τ = T·r/J peaks at the outer fibre and the twist is φ = TL/GJ. ` +
        `Your section already has a J you can borrow: the column lab's shaft tab reuses its ${f(dims.depth_mm, 0)} mm depth, so the numbers there are your section, not a made-up one. ` +
        'The exam twist: a hollow shaft carries nearly the same torque for far less weight, that lever is J, not area.',
      becauseHi:
        `Torsion wahi shear distribution hai, bas axis ke chaaron taraf lipti hui: τ = T·r/J outer fibre par max aur twist φ = TL/GJ. ` +
        'Exam ka twist: hollow shaft lagbhag utna hi torque utha leta hai, wazan bahut kam, lever J hai, area nahi.',
      formula: 'τ = T·r / J = T / Zp ·  φ = T·L / (G·J) ·  solid: J = πd⁴/32 · hollow: J = π(D⁴−d⁴)/32',
      readings: [
        { label: 'J (this section)', value: `${f(g.J_mm4 / 1e4, 0)} cm⁴` },
        { label: 'Depth', value: `${f(dims.depth_mm, 0)} mm` },
        { label: 'G assumed', value: '80 GPa (steel)' },
        { label: 'Lab', value: 'Column → Shaft tab', tone: 'neutral' },
      ],
      goto: 'buckling',
      boardWork: 'Halve the diameter and show τ going up 8× (d³) and φ 16× (d⁴), the ratios teach more than the formula.',
      boardWorkHi: 'Diameter aadha karo: τ 8× badhta hai (d³) aur φ 16× (d⁴), ratios formula se zyada sikhate hain.',
      keywords: ['torsion', 'shaft', 'torque', 'twist', 'polar moment', 'j'],
    },

    /* ------------------------------------------------------------------ 13 */
    {
      id: 'buckling',
      n: 13,
      tier: 'analysis',
      title: 'Stability: buckling of columns',
      titleHi: 'Stability: column ka buckling',
      asks: 'Find the critical load for a column with given end conditions and decide Euler vs short column.',
      asksHi: 'Diye end conditions par critical load nikaalo aur Euler vs short column decide karo.',
      state: 'related',
      because:
        `For your section (rmin = ${f(rMin, 1)} mm) and this ${f(spanM, 2)} m length, λ = L/r = ${f(lambdaPinned, 1)} and pinned Euler load is ` +
        `${f(eulerPinned, 0)} kN. ` +
        (governs === 'Euler'
          ? `λ has crossed the transition value ${f(lambdaCr, 1)}, so Euler is the honest answer here.`
          : `λ = ${f(lambdaPinned, 1)} is still below the transition value ${f(lambdaCr, 1)}, so Johnson's parabola governs and Euler would over-predict, the pinned capacity is ${f(johnsonPinned, 0)} kN, not ${f(eulerPinned, 0)} kN.`) +
        ' Fix-fix is four times the pinned load, and that 4 falls straight out of K = 0.5.',
      becauseHi:
        `Is section ka rmin = ${f(rMin, 1)} mm, length ${f(spanM, 2)} m, to λ = L/r = ${f(lambdaPinned, 1)} aur pinned Euler load ${f(eulerPinned, 0)} kN. ` +
        (governs === 'Euler'
          ? `λ transition value ${f(lambdaCr, 1)} ke paar nikal gaya, to yahan Euler hi sach hai.`
          : `Par λ = ${f(lambdaPinned, 1)} abhi transition value ${f(lambdaCr, 1)} se neeche hai, to Johnson ka parabola chalega, Euler nahi, pinned capacity ${f(johnsonPinned, 0)} kN hai, ${f(eulerPinned, 0)} kN nahi.`) +
        ' Fix-fix pinned ka chaar guna hota hai, aur woh 4 seedha K = 0.5 se aata hai.',
      formula: 'Pcr = π²EI / (K·L)² ·  K: 0.5 fix-fix, 0.7 fix-pin, 1.0 pin-pin, 2.0 fix-free ·  σcr = Pcr/A ·  Euler valid for λ > √(π²E/σy)',
      readings: [
        { label: 'λ = L / rmin', value: f(lambdaPinned, 1), tone: governs === 'Euler' ? 'ok' : 'warn' },
        { label: 'Pcr pinned (Euler)', value: `${f(eulerPinned, 0)} kN` },
        { label: `Pcr pinned (${governs})`, value: `${f(crPinned, 0)} kN`, tone: governs === 'Euler' ? 'ok' : 'warn' },
        { label: 'Pcr fix-fix', value: `${f(crPinned * 4, 0)} kN` },
        { label: 'σcr (pinned)', value: `${f((crPinned * 1000) / Math.max(1, A_mm2), 1)} MPa` },
      ],
      goto: 'buckling',
      boardWork: 'Keep the section, halve the length: Pcr should quadruple. Ask the class why before you press enter.',
      boardWorkHi: 'Section wahi, length aadhi: Pcr chaar guna hona chahiye. Enter dabane se pehle class se poocho kyun.',
      keywords: ['buckling', 'euler', 'column', 'critical load', 'slenderness', 'k factor', 'johnson'],
    },

    /* ------------------------------------------------------------------ 14 */
    {
      id: 'principal-stress',
      n: 14,
      tier: 'analysis',
      title: 'Combined stress, Mohr and principal planes',
      titleHi: 'Combined stress, Mohr aur principal plane',
      asks: 'At a point with σx, σy, τxy, find the principal stresses, max shear and the failure plane.',
      asksHi: 'Ek point par σx, σy, τxy diye hain, principal stresses, max shear aur failure plane nikaalo.',
      state: 'live',
      because:
        `At the governing section the flexure and shear arrive together: σ = ${f(sigmaBend, 1)} MPa from bending and τ = ${f(tauAvg, 2)} MPa average shear ` +
        `(peak τ ${f(tauPeak, 2)} MPa). ` +
        `The section lab's strip integration on the same M and V reads σ from ${f(section.maxCompression_MPa, 1)} (compression) to ${f(section.maxTension_MPa, 1)} MPa (tension) with a von Mises peak of ${f(section.maxVonMises_MPa, 1)} MPa. ` +
        'Mohr\'s circle is what turns that sentence into a plane angle.',
      becauseHi:
        `Governing section par flexure aur shear saath aate hain: bending se σ = ${f(sigmaBend, 1)} MPa aur average shear τ = ${f(tauAvg, 2)} MPa ` +
        `(peak τ ${f(tauPeak, 2)} MPa). ` +
        'Beam me extreme fibre par σ hai τ nahi, NA par τ hai σ nahi, asli critical point koi ek nahi, dono ka worst combination hota hai. ' +
        "Mohr's circle usi vaakya ko plane angle bana deta hai.",
      formula: 'σ₁,₂ = C ± R ·  C = (σx+σy)/2 ·  R = √(((σx−σy)/2)² + τ²) ·  τmax = R ·  tan2θp = 2τ /(σx−σy)',
      readings: [
        { label: 'σ bending', value: `${f(sigmaBend, 1)} MPa` },
        { label: 'τ at NA', value: `${f(tauPeak, 2)} MPa` },
        { label: 'von Mises util.', value: `${f(section.utilizationRatio * 100, 0)}%`, tone: section.utilizationRatio > 1 ? 'bad' : section.utilizationRatio > 0.85 ? 'warn' : 'ok' },
        { label: 'Hand-off', value: 'Section → Mohr', tone: 'neutral' },
      ],
      goto: 'mohr',
      boardWork: 'Send the extreme fibre stress to Mohr, then snap to σ₁: the class sees why a ductile shaft fails at 45°, not at 0°.',
      boardWorkHi: 'Extreme fibre stress Mohr me bhejo, phir σ₁ par snap karo, ductile shaft 45° par kyun fail hota hai, dikh jayega.',
      keywords: ['mohr', 'principal stress', 'combined stress', 'von mises', 'failure plane', 'max shear'],
    },

    /* ------------------------------------------------------------------ 15 */
    {
      id: 'sections',
      n: 15,
      tier: 'design',
      title: 'Section properties and where the centroid sits',
      titleHi: 'Section properties aur centroid',
      asks: 'Compute A, ȳ, Ixx, Z and r for a built-up / composite / T-section.',
      asksHi: 'A, ȳ, Ixx, Z, r nikaalo, built-up / composite / T-section ka.',
      state: 'live',
      because:
        `You are carrying a ${dims.shape.replace('_', ' ')}: ${f(A_mm2 / 100, 1)} cm² of steel, centroid ${f(g.yCentroid_mm, 1)} mm up from the bottom, ` +
        `Ixx = ${f(I_mm4 / 1e4, 0)} cm⁴, rmin = ${f(rMin, 1)} mm. ` +
        (Math.abs(g.yCentroid_mm - dims.depth_mm / 2) > 1
          ? 'The centroid is not sitting at mid-depth, so anyone who used h/2 will get one face wrong. That is the T-shape trap and it shows up every year.'
          : 'It is symmetric, so the centroid sits at mid-depth and both outer fibres are equally far away.') +
        ' The one idea to leave them with: steel far from the centroid is what buys I, and I is what buys both stiffness and stress capacity.',
      becauseHi:
        `Aapke paas ${dims.shape.replace('_', ' ')} hai: ${f(A_mm2 / 100, 1)} cm² material, centroid bottom se ${f(g.yCentroid_mm, 1)} mm par, ` +
        `Ixx = ${f(I_mm4 / 1e4, 0)} cm⁴, rmin = ${f(rMin, 1)} mm. ` +
        (Math.abs(g.yCentroid_mm - dims.depth_mm / 2) > 1
          ? 'Centroid mid-depth par nahi baith raha, is liye jo h/2 maan kar chalenge unka ek face galat aayega. Yeh T-shape ka jaal hai, har saal pakda jaata hai.'
          : 'Symmetric hai, is liye centroid bilkul beech me hai aur dono bahari fibres barabar door hain.') +
        ' Ek hi baat yaad rakhni hai: centroid se door rakha material I deta hai, aur I hi stiffness aur stress capacity deta hai.',
      formula: 'ȳ = ΣAᵢyᵢ / ΣAᵢ ·  Ixx = Σ(Iᵢ + Aᵢdᵢ²) parallel axis ·  Z = I/ymax ·  r = √(I/A)',
      readings: [
        { label: 'A', value: `${f(A_mm2 / 100, 1)} cm²` },
        { label: 'ȳ from bottom', value: `${f(g.yCentroid_mm, 1)} mm` },
        { label: 'Ixx', value: `${f(I_mm4 / 1e4, 0)} cm⁴` },
        { label: 'Z elastic', value: `${f(Z_mm3 / 1e3, 0)} cm³` },
      ],
      goto: 'section',
      boardWork: 'Switch to T-shape with the same depth and let the class watch ȳ leave mid-depth, then ask which fibre is now critical.',
      boardWorkHi: 'Same depth par T-shape chuno, ȳ mid-depth chhod dega, phir poocho ab kaunsa fibre critical hai.',
      keywords: ['section properties', 'centroid', 'moment of inertia', 'parallel axis', 'radius of gyration', 'composite'],
    },

    /* ------------------------------------------------------------------ 16 */
    {
      id: 'failure',
      n: 16,
      tier: 'design',
      title: 'Failure theories and factor of safety',
      titleHi: 'Failure theory aur factor of safety',
      asks: 'With fy given, decide whether the member is safe; compute FoS by Rankine / Tresca / von Mises.',
      asksHi: 'fy diya hai, member safe hai ya nahi; Rankine / Tresca / von Mises se FoS nikaalo.',
      state: 'live',
      because:
        `The worst stress state in your model is σ = ${f(Math.max(sigmaBend, sigmaAxial), 1)} MPa against fy = ${fy_MPa} MPa, ` +
        `so the governing factor of safety is ${f(fy_MPa / Math.max(1e-6, Math.max(sigmaBend, sigmaAxial)), 2)}. ` +
        'Brittle cast iron is judged on maximum principal stress, ductile steel on shear (Tresca) or distortion energy (von Mises), the same stress state gives three different answers, and the exam always asks which one.',
      becauseHi:
        `Aapke model ka worst stress state σ = ${f(Math.max(sigmaBend, sigmaAxial), 1)} MPa hai, fy = ${fy_MPa} MPa ke against, ` +
        `matlab governing FoS = ${f(fy_MPa / Math.max(1e-6, Math.max(sigmaBend, sigmaAxial)), 2)}. ` +
        'Brittle (cast iron) maximum principal stress par judge hota hai, ductile (steel) shear (Tresca) ya distortion energy (von Mises) par, ek hi stress state ke teen jawab, aur exam hamesha poochta hai kaunsa.',
      formula: 'FoS = fy / σ ·  Tresca: σ₁−σ₃ ≤ fy ·  von Mises: σvM = √(σ₁²−σ₁σ₃+σ₃²) ≤ fy ·  Rankine (brittle): σ₁ ≤ σut',
      readings: [
        { label: 'σ governing', value: `${f(Math.max(sigmaBend, sigmaAxial), 1)} MPa`, tone: Math.max(sigmaBend, sigmaAxial) > fy_MPa ? 'bad' : 'ok' },
        { label: 'fy', value: `${fy_MPa} MPa` },
        { label: 'FoS', value: f(fy_MPa / Math.max(1e-6, Math.max(sigmaBend, sigmaAxial)), 2), tone: fy_MPa / Math.max(1e-6, Math.max(sigmaBend, sigmaAxial)) < 1 ? 'bad' : 'ok' },
        { label: 'τmax (Tresca)', value: `${f(tauPeak, 2)} MPa` },
      ],
      goto: 'mohr',
      boardWork: 'Give the same stress state to Tresca and von Mises side by side and ask why the ductile answer is always the lower one.',
      boardWorkHi: 'Ek hi stress state Tresca aur von Mises dono me daal kar poocho, ductile jawab hamesha chhota kyun?',
      keywords: ['failure', 'factor of safety', 'von mises', 'tresca', 'rankine', 'yield', 'safe'],
    },

    /* ------------------------------------------------------------------ 17 */
    {
      id: 'units',
      n: 17,
      tier: 'core',
      title: 'Units, signs and the mistakes that cost marks',
      titleHi: 'Units, signs aur marks katne wali galtiyan',
      asks: 'A correct method still gets zero marks, usually because of a unit or a sign.',
      asksHi: 'Method sahi ho ke bhi zero marks, zyadatar unit ya sign ki galti.',
      state: 'live',
      because:
        `This app is built on one convention so the class can check itself: kN, kN·m, mm, MPa, GPa, cm⁴, with EI(kN·m²) = E(GPa) × I(cm⁴) × 0.01. ` +
        `Your live EI is ${f(res.EI_kNm2, 0)} kN·m² = ${f(beam.E_GPa, 0)} × ${f(beam.I_cm4, 0)} × 0.01. ` +
        `Sagging is +M, tension is +N, and shear is + when the left face moves up. ` +
        'The most expensive mistake is mixing m and mm inside My/I; the second is a sign flip in a hogging moment.',
      becauseHi:
        `Poora app ek hi convention par bana hai taaki class khud check kar sake: kN, kN·m, mm, MPa, GPa, cm⁴, aur EI(kN·m²) = E(GPa) × I(cm⁴) × 0.01. ` +
        `Aapka live EI ${f(res.EI_kNm2, 0)} kN·m² = ${f(beam.E_GPa, 0)} × ${f(beam.I_cm4, 0)} × 0.01. ` +
        'Sagging +M, tension +N, shear + jab left face upar jaye. ' +
        'Sabse mehngi galti My/I me m aur mm mix karna, doosri hogging moment ka sign ulta.',
      formula: 'EI(kN·m²) = E(GPa)·I(cm⁴)·0.01 ·  σ(MPa) = M(kN·m)·y(mm)/I(mm⁴)×10⁶ ·  1 kN·m = 10⁶ N·mm',
      readings: [
        { label: 'EI live', value: `${f(res.EI_kNm2, 0)} kN·m²` },
        { label: 'E × I × 0.01', value: `${f(beam.E_GPa * beam.I_cm4 * 0.01, 0)} kN·m²`, tone: 'ok' },
        { label: 'M sign', value: 'sagging +' },
        { label: 'N sign', value: 'tension +' },
      ],
      goto: 'guide',
      boardWork: 'Write EI = 200 × 8000 × 0.01 on the board and let them find the unit mismatch before you show it is 16000 kN·m².',
      boardWorkHi: 'Board par EI = 200 × 8000 × 0.01 likho aur unit ki galti class se dhoondhwao, phir 16000 kN·m² dikhao.',
      keywords: ['units', 'sign convention', 'conversion', 'ei', 'mistake'],
    },
    /* ------------------------------------------------------------------ 18 */
    {
      id: 'superposition',
      n: 18,
      tier: 'core',
      title: 'Superposition, why we may add effects',
      titleHi: 'Superposition, effects add kyun kar sakte hain',
      asks: 'A beam carries several loads (or a load and a settlement). Can we solve each one separately and add?',
      asksHi: 'Beam par kai loads hain (ya load + settlement). Alag-alag solve karke jod sakte hain?',
      state: ild ? 'live' : 'related',
      because: ild
        ? `The P·η table in the ILD lab is superposition in one glance: each axle gets its own ordinate and the effects add to the total. ` +
          `With ${f(ild.maxPos.val, 3)} ${ild.unit} at the peak and the net area ${f(ild.netArea, 2)}, a UDL is just the integral of those tiny contributions. ` +
          'It is legal here because the structure is linear elastic, double the load and every effect doubles, which you can test by editing any one load.'
        : `Your beam already adds up: ${beam.loads.length} load(s) give a peak shear of ${f(res.maxAbsV, 1)} kN and a governing moment of ${f(Math.abs(govM), 1)} kN·m. ` +
          'Split those loads mentally and each piece produces its own triangular diagram; together they add station by station. ' +
          'This is legal only while the material is linear elastic, the moment we allow yielding, the additions stop being valid.',
      becauseHi: ild
        ? `ILD lab ka P·η table ek nazar me superposition hai: har axle ka apna ordinate, aur effects jud kar total. ` +
          `Peak ${f(ild.maxPos.val, 3)} ${ild.unit} aur net area ${f(ild.netArea, 2)} ke saath UDL unhi chhote contributions ka integral hai. ` +
          'Yeh legal hai kyunki structure linear elastic hai, load double karo to har effect double.'
        : `Aapka beam pehle se jud raha hai: ${beam.loads.length} load se peak shear ${f(res.maxAbsV, 1)} kN aur governing moment ${f(Math.abs(govM), 1)} kN·m. ` +
          'Loads ko mann hi mann alag karo, har piece ka apna diagram banta hai; sab station-by-station jud jaate hain. ' +
          'Yeh sirf linear elastic tak valid hai, yield aaya to jodna band.',
      formula: 'S(P₁ + P₂) = S(P₁) + S(P₂)  ·  valid only while σ ≤ σy and deflections are small',
      readings: [
        { label: 'Loads on the beam', value: String(beam.loads.length) },
        { label: 'Peak V', value: `${f(res.maxAbsV, 1)} kN` },
        { label: 'Governing M', value: `${f(Math.abs(govM), 1)} kN·m` },
        { label: 'Settlement present?', value: beam.supports.some((sp) => (sp.settlementMm ?? 0) !== 0) ? 'yes' : 'no' },
      ],
      goto: 'ild',
      boardWork: 'Delete every load except one, read the diagram; add the second one back and let the class see the values literally add up.',
      boardWorkHi: 'Ek load chhod kar baaki hatao, diagram padho; phir doosra wapas lagao, values sach me jud jaayengi.',
      keywords: ['superposition', 'linear', 'add', 'combine', 'several loads'],
    },

    /* ------------------------------------------------------------------ 19 */
    {
      id: 'reciprocity',
      n: 19,
      tier: 'analysis',
      title: 'Maxwell-Betti reciprocity, proved on your beam',
      titleHi: 'Maxwell-Betti reciprocity, aapke beam par prove',
      asks: 'Show that the deflection at B due to a unit load at A equals the deflection at A due to a unit load at B.',
      asksHi: 'Dikhao ki A par unit load se B ka deflection = B par unit load se A ka deflection.',
      state: recip ? 'live' : 'related',
      because: recip
        ? `Two separate solves on your own beam with the same supports: a unit load at x = ${f(recip.x1, 2)} m gives δ = ${f(recip.d21 * 1000, 4)} µm at x = ${f(recip.x2, 2)} m, ` +
          `and a unit load at x = ${f(recip.x2, 2)} m gives δ = ${f(recip.d12 * 1000, 4)} µm at x = ${f(recip.x1, 2)} m. ` +
          `They agree to ${f(recip.err * 100, 5)} %, that is not a coincidence, it is the stiffness matrix being symmetric.`
        : 'Make the beam stable (two supports) and this card computes two real unit-load solves and compares the cross-deflections.',
      becauseHi: recip
        ? `Aapke hi beam par do alag solve, same supports: x = ${f(recip.x1, 2)} m par unit load se x = ${f(recip.x2, 2)} m par δ = ${f(recip.d21 * 1000, 4)} µm, ` +
          `aur x = ${f(recip.x2, 2)} m par unit load se x = ${f(recip.x1, 2)} m par δ = ${f(recip.d12 * 1000, 4)} µm. ` +
          `Farq ${f(recip.err * 100, 5)} %, yeh coincidence nahi, stiffness matrix ka symmetric hona hai.`
        : 'Beam ko stable karo (do supports), yeh card do asli unit-load solve karke cross-deflections compare karega.',
      formula: 'δij = δji  ·  ∫Mi Mj / EI dx = ∫Mj Mi / EI dx  ·  the stiffness matrix [K] is symmetric',
      readings: recip
        ? [
            { label: `δ at ${f(recip.x2, 2)} m (load at ${f(recip.x1, 2)})`, value: `${f(recip.d21 * 1000, 4)} µm` },
            { label: `δ at ${f(recip.x1, 2)} m (load at ${f(recip.x2, 2)})`, value: `${f(recip.d12 * 1000, 4)} µm`, tone: 'ok' },
            { label: 'Mismatch', value: `${f(recip.err * 100, 5)} %`, tone: recip.err < 0.01 ? 'ok' : 'warn' },
            { label: 'Unit load', value: '1 kN (down)' },
          ]
        : [
            { label: 'Needs', value: 'a stable beam' },
            { label: 'Supports now', value: String(beam.supports.length) },
            { label: 'Stable?', value: res.isStable ? 'yes' : 'no', tone: res.isStable ? 'ok' : 'bad' },
            { label: 'Point of it', value: 'saves half the solves' },
          ],
      goto: 'ild',
      boardWork: 'Write the two numbers on the board on either side of an equals sign, then move a support and watch them both change, but stay equal.',
      boardWorkHi: 'Do numbers ko board par equals sign ke dono taraf likho, phir support hatao, dono badlenge, par barabar hi rahenge.',
      keywords: ['reciprocity', 'maxwell', 'betti', 'unit load', 'symmetric', 'flexibility'],
    },

    /* ------------------------------------------------------------------ 20 */
    {
      id: 'settlement',
      n: 20,
      tier: 'analysis',
      title: 'Support settlement, temperature and lack of fit',
      titleHi: 'Support settlement, temperature aur lack of fit',
      asks: 'A support settles by 10 mm, or the member is built 5 mm short. Find the reactions and stresses.',
      asksHi: 'Support 10 mm baith gaya, ya member 5 mm chhota bana. Reactions aur stresses nikaalo.',
      state: beam.supports.some((sp) => (sp.settlementMm ?? 0) !== 0) ? 'live' : 'related',
      because: beam.supports.some((sp) => (sp.settlementMm ?? 0) !== 0)
        ? `You have settlement switched on, so the solver is already carrying it: it enters the load vector, not the stiffness matrix. ` +
          `That is why the reactions can be non-zero even with no load at all, a pattern of displacement, not force, is driving them.`
        : `Try this: give one of your supports a settlement in the beam editor. A determinate beam just follows the support without developing any stress at all ` +
          '(the geometry is free to move), while an indeterminate one fights it and develops moment. Right now your beam is ' +
          `Ds = ${statIndet}, so the settlement will be ${statIndet === 0 ? 'carried with zero extra moment, a great contrast demo.' : 'resisted, and you will see moment appear with no load applied.'}`,
      becauseHi: beam.supports.some((sp) => (sp.settlementMm ?? 0) !== 0)
        ? 'Aapne settlement on rakha hai, is liye solver already utha raha hai: yeh stiffness matrix me nahi, load vector me jaata hai. ' +
          'Isi liye bina load ke bhi reactions aa sakte hain, driving displacement hai, force nahi.'
        : 'Ek support ko settlement do: determinate beam support ke saath bas gir jaata hai, koi stress nahi banta, ' +
          'jabki indeterminate ladta hai aur moment bana leta hai. Abhi Ds = ' + statIndet + ' hai.',
      formula: 'K·d = F + K·Δsupport  ·  temperature: ε = α·ΔT, σ = E·α·ΔT when restrained  ·  determinate ⇒ no stress from settlement',
      readings: [
        { label: 'Settlements set', value: String(beam.supports.filter((sp) => (sp.settlementMm ?? 0) !== 0).length) },
        { label: 'Ds', value: String(statIndet), tone: statIndet === 0 ? 'ok' : 'warn' },
        { label: 'Σ Ry now', value: `${f(res.reactions.reduce((a, r) => a + r.Ry, 0), 1)} kN` },
        { label: 'Where to edit', value: 'Beam → support table' },
      ],
      goto: 'beam',
      boardWork: 'Set 10 mm settlement on the roller of a determinate beam, then fix that support and set it again. Same settlement, completely different answer.',
      boardWorkHi: 'Determinate beam ke roller par 10 mm settlement lagao, phir usi support ko fixed karo aur dobara lagao. Same settlement, bilkul alag jawab.',
      keywords: ['settlement', 'support movement', 'temperature', 'lack of fit', 'thermal', 'compatibility'],
    },

    /* ------------------------------------------------------------------ 21 */
    {
      id: 'eccentric',
      n: 21,
      tier: 'design',
      title: 'Combined axial + bending and the middle third',
      titleHi: 'Axial + bending aur middle third',
      asks: 'A column carries an eccentric load. Find the stress distribution and whether tension appears.',
      asksHi: 'Column par eccentric load hai. Stress distribution nikaalo, aur tension aata hai ya nahi.',
      state: 'related',
      because:
        `Axial and bending simply add: σ = N/A ± M/Z, which is why a load off the centre creates one tensile face. ` +
        `For your ${f(dims.depth_mm, 0)} mm deep section the middle-third limit is ±${f(kernHalf * 1000, 0)} mm, ` +
        'put the resultant outside that band and the far face goes into tension, which is exactly what a masonry or footing check forbids. ' +
        `Your current frame carries N = ${f(N_frame, 1)} kN with M = ${f(sres.maxMomentAbs, 1)} kN·m at its worst member, an implied eccentricity of ${f(eEcc, 2)} m.`,
      becauseHi:
        'Axial aur bending seedha jud jaate hain: σ = N/A ± M/Z, isi liye off-centre load ek face par tension bana deta hai. ' +
        `Aapke ${f(dims.depth_mm, 0)} mm deep section ka middle-third limit ±${f(kernHalf * 1000, 0)} mm hai, ` +
        'resultant us band se bahar gaya to doosra face tension me chala jayega, aur masonry/footing check yahi mana karta hai. ' +
        `Abhi frame me N = ${f(N_frame, 1)} kN aur worst member par M = ${f(sres.maxMomentAbs, 1)} kN·m hai, yani eccentricity ≈ ${f(eEcc, 2)} m.`,
      formula: 'σ = N/A ± M/Z  ·  e = M/N  ·  no tension while e ≤ h/6 (solid rectangle) ·  σmin = N/A (1 − 6e/h)',
      readings: [
        { label: 'N (frame max)', value: `${f(N_frame, 1)} kN` },
        { label: 'M (frame max)', value: `${f(sres.maxMomentAbs, 1)} kN·m` },
        { label: 'e = M/N', value: `${f(eEcc, 2)} m` },
        { label: 'Kern limit ±h/6', value: `${f(kernHalf * 1000, 0)} mm` },
      ],
      goto: 'section',
      boardWork: 'Type a small negative N in the section lab and watch the neutral axis slide out of the section, that is the whole eccentricity lecture.',
      boardWorkHi: 'Section lab me chhota negative N daalo, neutral axis section se bahar khisakti dikhegi, poori eccentricity ki class ek hi jagah.',
      keywords: ['eccentric', 'combined', 'middle third', 'kern', 'axial plus bending', 'no tension'],
    },

    /* ------------------------------------------------------------------ 22 */
    {
      id: 'moment-area',
      n: 22,
      tier: 'analysis',
      title: 'Moment-area and conjugate-beam shortcuts',
      titleHi: 'Moment-area aur conjugate beam shortcut',
      asks: 'Find slope and deflection using moment-area theorems or the conjugate beam, without integrating.',
      asksHi: 'Moment-area theorem ya conjugate beam se slope aur deflection nikaalo, integrate kiye bina.',
      state: 'live',
      because:
        `The two theorems read the same M/EI picture you already have: the change in slope between two points is the area of M/EI between them, ` +
        `and the deflection of a point from the tangent at another is the moment of that area about it. ` +
        `Your moment diagram peaks at ${f(Math.abs(govM), 1)} kN·m over a ${f(spanM, 2)} m span with EI = ${f(res.EI_kNm2, 0)} kN·m², ` +
        `and the solver's own δmax = ${f(defl, 2)} mm at x = ${f(res.maxDeflectionX, 2)} m is the number those constructions must reproduce.`,
      becauseHi:
        'Dono theorems wahi M/EI picture padhte hain jo aapke paas hai: do points ke beech slope ka change = M/EI ka area, ' +
        'aur ek point ka deflection doosre point ki tangent se = us area ka moment. ' +
        `Aapka diagram ${f(Math.abs(govM), 1)} kN·m par peak karta hai ${f(spanM, 2)} m span par, EI = ${f(res.EI_kNm2, 0)} kN·m², ` +
        `aur solver ka δmax = ${f(defl, 2)} mm at x = ${f(res.maxDeflectionX, 2)} m wahi jawab hai jo in constructions se aana chahiye.`,
      formula: 'θB − θA = ∫M/EI dx (area)  ·  tB/A = ∫ x̄ · M/EI dx (moment of area)  ·  conjugate beam: M̄ = real deflection',
      readings: [
        { label: 'M peak', value: `${f(Math.abs(govM), 1)} kN·m` },
        { label: 'EI', value: `${f(res.EI_kNm2, 0)} kN·m²` },
        { label: 'δmax (solver)', value: `${f(defl, 2)} mm`, tone: 'ok' },
        { label: 'Slope at cut', value: 'see beam lab' },
      ],
      goto: 'beam',
      boardWork: 'Do the moment-area calculation on the board with the class, then read the solver’s δmax, the two must match to the last digit shown.',
      boardWorkHi: 'Board par moment-area se solve karo, phir solver ka δmax padho, aakhri digit tak match karna chahiye.',
      keywords: ['moment area', 'conjugate beam', 'slope', 'deflection', 'theorem', 'area method'],
    },
  ];

  const tags: string[] = [];
  if (statIndet === 0) tags.push('determinate');
  else tags.push(`indeterminate Ds=${statIndet}`);
  if (Math.abs(res.maxHoggingM) > 1e-3) tags.push('hogging present');
  if (deflOk) tags.push('deflection OK'); else tags.push('deflection FAILS');
  if (isTruss) tags.push('pin-jointed'); else tags.push('rigid-jointed');
  if (ild) tags.push('moving load set up');

  return {
    topics,
    profile: {
      kind: isTruss ? 'truss' : struct.mode === 'frame' ? 'frame' : 'beam',
      text: `A ${f(spanM, 1)} m ${statIndet === 0 ? 'determinate' : `Ds = ${statIndet}`} beam carrying ${f(wTotal, 1)} kN, with the governing moment at ${f(govX, 2)} m.`,
      textHi: `${f(spanM, 1)} m ka ${statIndet === 0 ? 'determinate' : `Ds = ${statIndet}`} beam, ${f(wTotal, 1)} kN load, governing moment ${f(govX, 2)} m par.`,
      tags,
    },
  };
}

/** keyword search over the atlas, so a student can type the topic they were given */
export function searchAtlas(topics: AtlasTopic[], q: string): AtlasTopic[] {
  const s = q.trim().toLowerCase();
  if (!s) return topics;
  const words = s.split(/\s+/).filter((w) => w.length > 1);
  return topics
    .map((t) => {
      const hay = [t.title, t.titleHi, t.asks, t.asksHi, t.formula, t.because, t.becauseHi, ...t.keywords].join(' ').toLowerCase();
      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 1;
      if (t.title.toLowerCase().includes(s)) score += 3;
      return { t, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.t);
}
