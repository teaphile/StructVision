import { describe, it, expect } from 'vitest';
import { analyzeBeam, inspectBeamSection } from './beamEngine';
import { computeILD, evaluateMovingVehicle } from './ildEngine';
import { analyzeStructure2D } from './frameTrussEngine';
import {
  analyzeCrossSection,
  analyzeMohrCircle,
  analyzeColumnBuckling,
  analyzeShaftTorsion,
} from './sectionMohrBucklingEngine';

describe('StructVision Core Mechanics Engine Verification', () => {
  it('solves Simply Supported Beam with central point load (PL/4 & PL^3/48EI) to textbook accuracy', () => {
    const res = analyzeBeam({
      length: 6,
      E_GPa: 200,
      I_cm4: 8000, // EI = 200 * 8000 * 0.01 = 16000 kN*m^2
      supports: [
        { id: 'A', x: 0, type: 'pin' },
        { id: 'B', x: 6, type: 'roller' },
      ],
      hinges: [],
      loads: [{ id: 'P1', type: 'point', x: 3, magnitude: 40 }],
    });

    expect(res.isStable).toBe(true);
    expect(res.Ds).toBe(0);
    expect(res.reactions[0].Ry).toBeCloseTo(20, 4);
    expect(res.reactions[1].Ry).toBeCloseTo(20, 4);
    expect(res.maxSaggingM).toBeCloseTo((40 * 6) / 4, 3); // 60 kN*m
    // Deflection = P*L^3 / (48*EI) = 40 * 216 / (48 * 16000) m = 0.01125 m = 11.25 mm
    expect(res.maxAbsDeflectionMm).toBeCloseTo(11.25, 2);
  });

  it('solves Propped Cantilever with full UDL (3wL/8, 5wL/8, -wL^2/8, contraflexure at L/4)', () => {
    const L = 6;
    const w = 20;
    const res = analyzeBeam({
      length: L,
      E_GPa: 200,
      I_cm4: 10000,
      supports: [
        { id: 'A', x: 0, type: 'fixed' },
        { id: 'B', x: L, type: 'roller' },
      ],
      hinges: [],
      loads: [{ id: 'U1', type: 'udl', xStart: 0, xEnd: L, magnitude: w }],
    });

    expect(res.isStable).toBe(true);
    expect(res.Ds).toBe(1);
    expect(res.reactions[0].Ry).toBeCloseTo((5 * w * L) / 8, 3); // 75 kN
    expect(res.reactions[1].Ry).toBeCloseTo((3 * w * L) / 8, 3); // 45 kN
    expect(res.maxHoggingM).toBeCloseTo(-(w * L * L) / 8, 2); // -90 kN*m
    // Max sagging = 9*w*L^2 / 128 = 50.625 kN*m
    expect(res.maxSaggingM).toBeCloseTo((9 * w * L * L) / 128, 2);
    const contra = res.criticalPoints.find((c) => c.kind === 'contraflexure');
    expect(contra).toBeDefined();
    expect(contra!.x).toBeCloseTo(L / 4, 2); // 1.50 m
  });

  it('solves Fixed-Fixed Beam with UDL (-wL^2/12 at ends, +wL^2/24 at center)', () => {
    const res = analyzeBeam({
      length: 6,
      E_GPa: 200,
      I_cm4: 10000,
      supports: [
        { id: 'A', x: 0, type: 'fixed' },
        { id: 'B', x: 6, type: 'fixed' },
      ],
      hinges: [],
      loads: [{ id: 'U1', type: 'udl', xStart: 0, xEnd: 6, magnitude: 24 }],
    });
    expect(res.maxHoggingM).toBeCloseTo(-72, 2);
    expect(res.maxSaggingM).toBeCloseTo(36, 2);
  });

  it('enforces M = 0 at Internal Hinge in Gerber Beam and matches Left-Cut FBD', () => {
    const model = {
      length: 10,
      E_GPa: 200,
      I_cm4: 12000,
      supports: [
        { id: 'A', x: 0, type: 'fixed' as const },
        { id: 'B', x: 10, type: 'roller' as const },
      ],
      hinges: [{ id: 'h1', x: 4 }],
      loads: [{ id: 'l1', type: 'udl' as const, xStart: 4, xEnd: 10, magnitude: 20 }],
    };
    const res = analyzeBeam(model);
    expect(res.isStable).toBe(true);
    expect(res.Ds).toBe(0);
    // Suspended span [4..10] of 6m with UDL 20 kN/m => RB = 60 kN, shear transferred to cantilever tip at x=4 is 60 kN!
    expect(res.reactions[1].Ry).toBeCloseTo(60, 2);
    expect(res.reactions[0].Ry).toBeCloseTo(60, 2);
    // Fixed moment at x=0: -60 * 4 = -240 kN*m
    expect(res.maxHoggingM).toBeCloseTo(-240, 1);

    const cutAtHinge = inspectBeamSection(model, res, 4);
    expect(cutAtHinge.M).toBeCloseTo(0, 2);
  });

  it('computes exact ILD peak ab/L and Shear step jump = 1.00', () => {
    const ssModel = {
      length: 10,
      E_GPa: 200,
      I_cm4: 15000,
      supports: [
        { id: 'A', x: 0, type: 'pin' as const },
        { id: 'B', x: 10, type: 'roller' as const },
      ],
      hinges: [],
      loads: [],
    };
    const ildM = computeILD(ssModel, { type: 'moment', xSection: 4 });
    expect(ildM.maxPos.val).toBeCloseTo((4 * 6) / 10, 3); // 2.4 m

    const ildV = computeILD(ssModel, { type: 'shear', xSection: 4 });
    expect(ildV.maxNeg.val).toBeCloseTo(-0.4, 3);
    expect(ildV.maxPos.val).toBeCloseTo(0.6, 3);

    const mv = evaluateMovingVehicle(
      ssModel,
      ildM,
      {
        type: 'two_axle',
        singleLoad_kN: 100,
        axle1_kN: 80,
        axle2_kN: 160,
        wheelbase_m: 2,
        udl_kNm: 20,
        udlLength_m: 4,
      },
      6,
      false
    );
    // Heavy rear wheel (160 kN) at x = 4 (ordinate 2.4), front wheel (80 kN) at x = 6 (ordinate 4*4/10 = 1.6) => 160*2.4 + 80*1.6 = 384 + 128 = 512 kN*m!
    expect(mv.totalResponse).toBeCloseTo(512, 1);
  });

  it('detects Zero-Force Members and solves 2D Truss & Frame accurately', () => {
    const truss = analyzeStructure2D({
      nameEn: 'Simple Triangle + Zero Member',
      nameHi: 'Simple Truss',
      mode: 'truss',
      nodes: [
        { id: '1', label: 'A', x: 0, y: 0, support: 'pin' },
        { id: '2', label: 'B', x: 4, y: 0, support: 'roller_x' },
        { id: '3', label: 'C', x: 2, y: 2, support: 'free', fy: -40 },
        { id: '4', label: 'D', x: 2, y: 0, support: 'free' }, // unloaded collinear bottom joint!
      ],
      members: [
        { id: 'm1', startNodeId: '1', endNodeId: '4' },
        { id: 'm2', startNodeId: '4', endNodeId: '2' },
        { id: 'm3', startNodeId: '1', endNodeId: '3' },
        { id: 'm4', startNodeId: '2', endNodeId: '3' },
        { id: 'm5', startNodeId: '4', endNodeId: '3' }, // Zero force vertical!
      ],
    });
    expect(truss.isStable).toBe(true);
    const m5 = truss.members.find((m) => m.id === 'm5')!;
    expect(m5.state).toBe('zero');
    expect(m5.axial_kN).toBeCloseTo(0, 4);
  });

  it('verifies Cross-Section Ixx, Mohr Circle, Buckling & Shaft Torsion', () => {
    // Rectangular 100x200 mm: Ixx = 100 * 200^3 / 12 = 66,666,667 mm^4
    const sec = analyzeCrossSection(
      {
        shape: 'rectangular',
        width_mm: 100,
        depth_mm: 200,
        flangeThick_mm: 20,
        webThick_mm: 10,
        outerDia_mm: 200,
        innerDia_mm: 100,
      },
      { M_kNm: 20, V_kN: 40, N_kN: 0, fy_MPa: 250 }
    );
    expect(sec.Ixx_mm4 / 1e6).toBeCloseTo(66.667, 1);
    // Max bending stress = M*c/I = 20e6 * 100 / 66.6667e6 = 30 MPa
    expect(sec.maxTension_MPa).toBeCloseTo(30, 1);
    // Max rectangular shear stress = 1.5 * V / A = 1.5 * 40000 / 20000 = 3.0 MPa
    expect(sec.maxShear_MPa).toBeCloseTo(3.0, 1);

    const mohr = analyzeMohrCircle({ sigmaX: 80, sigmaY: -20, tauXY: 50, thetaDeg: 0 });
    // Center = 30, R = sqrt(50^2 + 50^2) = 70.7107
    expect(mohr.center).toBeCloseTo(30, 4);
    expect(mohr.sigma1).toBeCloseTo(30 + Math.SQRT2 * 50, 3);

    const buck = analyzeColumnBuckling({
      endCondition: 'fixed_fixed',
      length_m: 4,
      E_GPa: 200,
      fy_MPa: 250,
      area_cm2: 40,
      Imin_cm4: 2000,
      appliedLoad_kN: 500,
    });
    expect(buck.effectiveLength_m).toBeCloseTo(2.0, 4);

    const shaft = analyzeShaftTorsion([
      { id: 's1', label: 'Seg 1', length_m: 1, outerDia_mm: 80, innerDia_mm: 0, G_GPa: 80, endTorque_kNm: 5 },
    ]);
    // tau_max = 16 * T / (pi * D^3) = 16 * 5e6 / (pi * 512000) = 49.736 MPa
    expect(shaft.maxShearStress_MPa).toBeCloseTo(49.736, 2);
  });
});
