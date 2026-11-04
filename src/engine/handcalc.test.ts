/**
 * Independent hand-calculation audit.
 *
 * Nothing in this file uses the app's reporting helpers or cached values: every
 * expected number is the textbook closed-form solution that a student would
 * write on the board, and it is compared with the value the solver produced.
 * If any of these drift, the app is wrong, not the test.
 */
import { describe, it, expect } from 'vitest';
import { analyzeBeam, BeamModel } from './beamEngine';
import { analyzeStructure2D, Structure2DModel } from './frameTrussEngine';
import { analyzeCrossSection, analyzeColumnBuckling, analyzeMohrCircle, analyzeShaftTorsion } from './sectionMohrBucklingEngine';
import { analyticSection } from './sectionLib';

const near = (actual: number, expected: number, tolPct = 0.5) => {
  const err = Math.abs(actual - expected) / Math.max(1e-9, Math.abs(expected));
  return err <= tolPct / 100;
};

const close = (name: string, actual: number, expected: number, tolPct = 0.5) =>
  expect(
    near(actual, expected, tolPct),
    `${name}: solver ${actual.toFixed(5)} vs hand calc ${expected.toFixed(5)}`
  ).toBe(true);

const base = (over: Partial<BeamModel>): BeamModel => ({
  length: 6,
  E_GPa: 200,
  I_cm4: 8000,
  supports: [],
  hinges: [],
  loads: [],
  ...over,
});

describe('BEAM, textbook formulas against the FEM solver', () => {
  const E = 200; // GPa
  const Icm4 = 8000; // cm^4
  const EI = E * Icm4 * 0.01; // kN·m²  (200 GPa × 8000 cm⁴ = 16000 kN·m²)
  const L = 6;

  it('simply supported + UDL  (R = wL/2, M = wL²/8, δ = 5wL⁴/384EI, θ = wL³/24EI)', () => {
    const w = 15;
    const res = analyzeBeam(
      base({
        supports: [
          { id: 'A', x: 0, type: 'pin', label: 'A' },
          { id: 'B', x: L, type: 'roller', label: 'B' },
        ],
        loads: [{ id: 'w', type: 'udl', xStart: 0, xEnd: L, magnitude: w }],
      })
    );
    close('R_A', res.reactions[0].Ry, (w * L) / 2);
    close('R_B', res.reactions[1].Ry, (w * L) / 2);
    close('M_max', res.maxSaggingM, (w * L * L) / 8);
    close('δ_max', res.maxAbsDeflectionMm, ((5 * w * L ** 4) / (384 * EI)) * 1000, 0.8);
    const endSlope = res.points.find((p) => Math.abs(p.x) < 1e-9)!.slopeRad;
    // θ at a simply supported end = wL³/(24EI), positive CCW at the left end means downward slope
    close('θ_end', Math.abs((endSlope * 180) / Math.PI), ((w * L ** 3) / (24 * EI)) * (180 / Math.PI), 1.5);
    expect(res.maxHoggingM).toBeGreaterThan(-1e-6);
    expect(res.Ds).toBe(0);
    expect(res.Dk).toBe(2);
  });

  it('simply supported + central point load  (PL/4, PL³/48EI)', () => {
    const P = 40;
    const res = analyzeBeam(
      base({
        supports: [
          { id: 'A', x: 0, type: 'pin', label: 'A' },
          { id: 'B', x: L, type: 'roller', label: 'B' },
        ],
        loads: [{ id: 'P', type: 'point', x: L / 2, magnitude: P }],
      })
    );
    close('R_A', res.reactions[0].Ry, P / 2);
    close('M_max', res.maxSaggingM, (P * L) / 4);
    close('δ_max', res.maxAbsDeflectionMm, ((P * L ** 3) / (48 * EI)) * 1000, 0.8);
    close('V_left', Math.max(...res.points.map((p) => p.V)), P / 2);
    // the SFD must jump from +P/2 to −P/2 exactly at midspan
    const atMid = res.points.filter((p) => Math.abs(p.x - L / 2) < 1e-6);
    close('V jump', Math.abs(atMid[0].V - atMid[atMid.length - 1].V), P);
  });

  it('cantilever + tip load  (M = −PL, δ = PL³/3EI)', () => {
    const P = 25;
    const res = analyzeBeam(
      base({
        supports: [{ id: 'A', x: 0, type: 'fixed', label: 'A' }],
        loads: [{ id: 'P', type: 'point', x: L, magnitude: P }],
      })
    );
    close('R_A', res.reactions[0].Ry, P);
    close('M_A (hogging)', Math.abs(res.reactions[0].Mz), P * L);
    close('M at wall', Math.abs(res.maxHoggingM), P * L);
    close('δ_tip', res.maxAbsDeflectionMm, ((P * L ** 3) / (3 * EI)) * 1000, 0.8);
    // a cantilever is statically determinate: 2 transverse restraints, 2 equilibrium equations
    expect(res.Ds).toBe(0);
  });

  it('propped cantilever + UDL  (R_prop = 3wL/8, R_fixed = 5wL/8, M_fixed = wL²/8)', () => {
    const w = 12;
    const res = analyzeBeam(
      base({
        supports: [
          { id: 'A', x: 0, type: 'fixed', label: 'A' },
          { id: 'B', x: L, type: 'roller', label: 'B' },
        ],
        loads: [{ id: 'w', type: 'udl', xStart: 0, xEnd: L, magnitude: w }],
      })
    );
    close('R_fixed', res.reactions[0].Ry, (5 * w * L) / 8, 1);
    close('R_prop', res.reactions[1].Ry, (3 * w * L) / 8, 1);
    close('M_fixed', Math.abs(res.reactions[0].Mz), (w * L * L) / 8, 1);
    close('δ_max', res.maxAbsDeflectionMm, ((w * L ** 4) / (185 * EI)) * 1000, 2);
    expect(res.Ds).toBe(1);
    // contraflexure must exist somewhere in the span (at x = L/4 for this case)
    const cf = res.criticalPoints.filter((c) => c.kind === 'contraflexure');
    expect(cf.length).toBeGreaterThan(0);
    close('contraflexure x', cf[0].x, L / 4, 6);
  });

  it('fixed-fixed + UDL  (Mend = wL²/12, M_mid = wL²/24, δ = wL⁴/384EI)', () => {
    const w = 12;
    const res = analyzeBeam(
      base({
        supports: [
          { id: 'A', x: 0, type: 'fixed', label: 'A' },
          { id: 'B', x: L, type: 'fixed', label: 'B' },
        ],
        loads: [{ id: 'w', type: 'udl', xStart: 0, xEnd: L, magnitude: w }],
      })
    );
    close('Mend', Math.abs(res.reactions[0].Mz), (w * L * L) / 12, 1);
    close('M_mid', res.maxSaggingM, (w * L * L) / 24, 1);
    close('δ_max', res.maxAbsDeflectionMm, ((w * L ** 4) / (384 * EI)) * 1000, 2);
    expect(res.Ds).toBe(2);
    // the end moment reaction must equal the hogging peak at the support
    close('M_hog', Math.abs(res.maxHoggingM), (w * L * L) / 12, 1);
  });

  it('cantilever + UDL  (M = wL²/2, δ = wL⁴/8EI)', () => {
    const w = 10;
    const res = analyzeBeam(
      base({
        supports: [{ id: 'A', x: 0, type: 'fixed', label: 'A' }],
        loads: [{ id: 'w', type: 'udl', xStart: 0, xEnd: L, magnitude: w }],
      })
    );
    close('M_wall', Math.abs(res.maxHoggingM), (w * L * L) / 2, 0.5);
    close('δ_tip', res.maxAbsDeflectionMm, ((w * L ** 4) / (8 * EI)) * 1000, 0.8);
  });

  it('triangular UVL on simply supported span  (R_A = wL/6, R_B = wL/3, M_max = wL²/9√3)', () => {
    const w = 30;
    const res = analyzeBeam(
      base({
        supports: [
          { id: 'A', x: 0, type: 'pin', label: 'A' },
          { id: 'B', x: L, type: 'roller', label: 'B' },
        ],
        loads: [{ id: 'u', type: 'uvl', xStart: 0, xEnd: L, wStart: 0, wEnd: w }],
      })
    );
    close('R_A', res.reactions[0].Ry, (w * L) / 6, 1);
    close('R_B', res.reactions[1].Ry, (w * L) / 3, 1);
    close('M_max', res.maxSaggingM, (w * L * L) / (9 * Math.sqrt(3)), 1.5);
  });

  it('internal hinge (Gerber), M = 0 at the hinge and slope kinks', () => {
    const res = analyzeBeam(
      base({
        length: 8,
        supports: [
          { id: 'A', x: 0, type: 'pin', label: 'A' },
          { id: 'B', x: 4, type: 'roller', label: 'B' },
          { id: 'C', x: 8, type: 'roller', label: 'C' },
        ],
        hinges: [{ id: 'h', x: 6 }],
        loads: [{ id: 'P', x: 6, type: 'point', magnitude: 20 }],
      })
    );
    expect(res.isStable).toBe(true);
    expect(res.Ds).toBe(0); // r − (2 + c) = 4 − (2 + 1) = 1 ... see note
    const atHinge = res.points.filter((p) => Math.abs(p.x - 6) < 1e-6);
    atHinge.forEach((p) => expect(Math.abs(p.M)).toBeLessThan(1e-3));
    const left = atHinge[0].slopeRad;
    const right = atHinge[atHinge.length - 1].slopeRad;
    expect(Math.abs(left - right)).toBeGreaterThan(1e-4);
  });

  it('spring support settles by R/k', () => {
    const k = 5000; // kN/m
    const res = analyzeBeam(
      base({
        supports: [
          { id: 'A', x: 0, type: 'pin', label: 'A' },
          { id: 'S', x: L, type: 'spring', label: 'S', springK: k },
        ],
        loads: [{ id: 'P', x: L / 2, type: 'point', magnitude: 30 }],
      })
    );
    const R = res.reactions.find((r) => r.supportId === 'S')!.Ry;
    const atSpring = res.points.reduce((a, b) => (Math.abs(b.x - L) < Math.abs(a.x - L) ? b : a));
    close('spring deflection', Math.abs(atSpring.deflectionMm), (R / k) * 1000, 2);
  });
});

describe('ILD, influence ordinates against closed form', () => {
  it('moment ILD of a simply supported beam peaks at ab/L', async () => {
    const { computeILD } = await import('./ildEngine');
    const L = 10;
    const a = 4;
    const model = base({
      length: L,
      supports: [
        { id: 'A', x: 0, type: 'pin', label: 'A' },
        { id: 'B', x: L, type: 'roller', label: 'B' },
      ],
    });
    const ild = computeILD(model, { type: 'moment', xSection: a });
    close('η at C', ild.maxPos.val, (a * (L - a)) / L, 1);
    close('η at C position', ild.maxPos.x, a, 1);
    // ordinate at x = 0 and x = L must vanish
    const ends = ild.points.filter((p) => p.x < 1e-6 || p.x > L - 1e-6);
    ends.forEach((p) => expect(Math.abs(p.ordinate)).toBeLessThan(1e-4));
  });

  it('reaction ILD is a straight line from 1.0 to 0.0', async () => {
    const { computeILD } = await import('./ildEngine');
    const L = 8;
    const model = base({
      length: L,
      supports: [
        { id: 'A', x: 0, type: 'pin', label: 'A' },
        { id: 'B', x: L, type: 'roller', label: 'B' },
      ],
    });
    const ild = computeILD(model, { type: 'reaction', supportId: 'A' });
    close('η_A at 0', ild.points[0].ordinate, 1, 0.5);
    close('η_A at L', ild.points[ild.points.length - 1].ordinate, 0, 1);
    close('η_A at mid', ild.points.find((p) => Math.abs(p.x - L / 2) < 0.05)!.ordinate, 0.5, 2);
  });
});

describe('2D FRAME, hand-checkable cases', () => {
  const mk = (nodes: Structure2DModel['nodes'], members: Structure2DModel['members'], mode: 'truss' | 'frame'): Structure2DModel => ({
    nameEn: 't',
    nameHi: 't',
    mode,
    nodes,
    members,
  });

  it('portal frame, symmetric gravity load: R_A = R_B = P/2', () => {
    const model = mk(
      [
        { id: 'A', label: 'A', x: 0, y: 0, support: 'pin' },
        { id: 'B', label: 'B', x: 6, y: 0, support: 'pin' },
        { id: 'C', label: 'C', x: 0, y: 4, support: 'free', fy: -20 },
        { id: 'D', label: 'D', x: 6, y: 4, support: 'free', fy: -20 },
      ],
      [
        { id: '1', label: 'AC', startNodeId: 'A', endNodeId: 'C' },
        { id: '2', label: 'CD', startNodeId: 'C', endNodeId: 'D' },
        { id: '3', label: 'DB', startNodeId: 'D', endNodeId: 'B' },
      ],
      'frame'
    );
    const r = analyzeStructure2D(model);
    close('R_A', r.nodes.find((n) => n.id === 'A')!.Ry, 20, 1);
    close('R_B', r.nodes.find((n) => n.id === 'B')!.Ry, 20, 1);
    expect(Math.abs(r.nodes.find((n) => n.id === 'A')!.Rx)).toBeLessThan(2);
  });

  it('closed triangle truss under a central load: statics by hand', () => {
    // A(0,0) pin, B(2,0) roller, C(1,1) with 10 kN down.
    // Hand solution: R_Ay = R_By = 5 kN, AC = BC = -7.071 kN (compression), AB = +5 kN (tension)
    const model = mk(
      [
        { id: 'A', label: 'A', x: 0, y: 0, support: 'pin' },
        { id: 'B', label: 'B', x: 2, y: 0, support: 'roller_x' },
        { id: 'C', label: 'C', x: 1, y: 1, support: 'free', fy: -10 },
      ],
      [
        { id: 'a', label: 'AC', startNodeId: 'A', endNodeId: 'C' },
        { id: 'b', label: 'BC', startNodeId: 'C', endNodeId: 'B' },
        { id: 'c', label: 'AB', startNodeId: 'A', endNodeId: 'B' },
      ],
      'truss'
    );
    const r = analyzeStructure2D(model);
    expect(r.isStable).toBe(true);
    expect(r.Ds).toBe(0);
    close('N_AC', r.members.find((m) => m.label === 'AC')!.axial_kN, -7.0711, 0.6);
    close('N_BC', r.members.find((m) => m.label === 'BC')!.axial_kN, -7.0711, 0.6);
    close('N_AB', r.members.find((m) => m.label === 'AB')!.axial_kN, 5, 1);
    close('R_Ay', r.nodes.find((n) => n.id === 'A')!.Ry, 5, 1);
    close('R_By', r.nodes.find((n) => n.id === 'B')!.Ry, 5, 1);

    // and the open two-bar linkage must be reported as a mechanism, not silently "solved"
    const mech = analyzeStructure2D({ ...model, members: model.members.filter((m) => m.label !== 'AB') });
    expect(mech.isStable).toBe(false);
  });
});

describe('SECTION, MOHR, COLUMN, SHAFT, closed form', () => {
  it('rect 200×300: A = 60000 mm², Ixx = 4.5e8 mm⁴, σ = M/Z', () => {
    const d = { shape: 'rectangular' as const, width_mm: 200, depth_mm: 300, flangeThick_mm: 10, webThick_mm: 8, outerDia_mm: 200, innerDia_mm: 0 };
    const res = analyzeCrossSection(d, { M_kNm: 40, V_kN: 30, N_kN: 0, fy_MPa: 250 });
    close('A', res.area_mm2, 60000, 0.2);
    close('Ixx', res.Ixx_mm4, (200 * 300 ** 3) / 12, 0.2);
    const ex = analyticSection(d);
    close('Z exact', ex.Ztop_mm3, (200 * 300 ** 2) / 6, 0.05);
    // σ = M·y/I at the extreme fibre y = 150 mm
    close('σtop', res.maxCompression_MPa, -(40e6 * 150) / ((200 * 300 ** 3) / 12), 1);
    close('τ at NA (3V/2A)', res.maxShear_MPa, (1.5 * 30e3) / 60000, 1.5);
  });

  it("Mohr: σx = 100, σy = 0, τ = 60 ⇒ C = 50, R = 78.10, σ₁ = 128.10, σ₂ = −28.10", () => {
    const m = analyzeMohrCircle({ sigmaX: 100, sigmaY: 0, tauXY: 60, thetaDeg: 0 });
    close('C', m.center, 50, 0.1);
    close('R', m.radius, Math.hypot(50, 60), 0.1);
    close('σ₁', m.sigma1, 50 + Math.hypot(50, 60), 0.1);
    close('σ₂', m.sigma2, 50 - Math.hypot(50, 60), 0.3);
    // at the principal plane the shear on the rotated face must vanish
    const atP1 = analyzeMohrCircle({ sigmaX: 100, sigmaY: 0, tauXY: 60, thetaDeg: m.thetaP1Deg });
    expect(Math.abs(atP1.tauXPrimeYPrime)).toBeLessThan(1e-9);
    expect(Math.abs(m.tauAbsMax3D - Math.max(m.radius, Math.abs(m.sigma1) / 2))).toBeLessThan(1e-9);
  });

  it('Euler pin-pin column: Pcr = π²EI/L²', () => {
    const r = analyzeColumnBuckling({
      endCondition: 'pinned_pinned',
      length_m: 4,
      E_GPa: 200,
      fy_MPa: 250,
      area_cm2: 40,
      Imin_cm4: 2000,
      appliedLoad_kN: 100,
    });
    // π² × 200000 N/mm² × 2e7 mm⁴ / (4000 mm)² = 2.467e6 N = 2467 kN
    close('P(Euler)', r.eulerCriticalLoad_kN, (Math.PI ** 2 * 200000 * 2000e4) / 4000 ** 2 / 1000, 0.2);
    close('r', r.radiusGyration_mm, Math.sqrt(2e7 / 4000), 0.2);
    // fixed-fixed must be four times stiffer than pin-pin
    const ff = analyzeColumnBuckling({
      endCondition: 'fixed_fixed',
      length_m: 4,
      E_GPa: 200,
      fy_MPa: 250,
      area_cm2: 40,
      Imin_cm4: 2000,
      appliedLoad_kN: 100,
    });
    close('K=0.5 ⇒ 4×', ff.eulerCriticalLoad_kN / r.eulerCriticalLoad_kN, 4, 0.5);
  });

  it('solid shaft torsion: τ = Tc/J and φ = TL/GJ', () => {
    const segs = [{ id: 's', label: 's', length_m: 1, outerDia_mm: 80, innerDia_mm: 0, G_GPa: 77, endTorque_kNm: 4 }];
    const r = analyzeShaftTorsion(segs, 600);
    const J = (Math.PI * 80 ** 4) / 32; // mm^4
    close('τ', r.maxShearStress_MPa, (4e6 * 40) / J, 0.2);
    close('φ', r.maxTwistDeg, (((4e6 * 1000) / (77000 * J)) * 180) / Math.PI, 0.3);
    close('power', r.powerAtRpm_kW, (2 * Math.PI * 600 * 4) / 60, 0.5);
  });
});
