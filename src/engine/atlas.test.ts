import { describe, it, expect } from 'vitest';
import { buildAtlas, searchAtlas, AtlasInput } from './conceptAtlas';
import { analyzeBeam, BeamModel } from './beamEngine';
import { analyzeStructure2D, Structure2DModel } from './frameTrussEngine';
import { analyzeCrossSection, SectionDimensions } from './sectionMohrBucklingEngine';
import { analyticSection } from './sectionLib';

/**
 * The atlas is copy-with-numbers, so the thing that can silently break is the
 * numbers. These tests pin them to the same solver output the labs display,
 * and pin the two "prove it on your own model" claims (reciprocity and the
 * deflection limit) to real arithmetic.
 */

const beam: BeamModel = {
  length: 6,
  E_GPa: 200,
  I_cm4: 8000,
  supports: [
    { id: 'A', x: 0, type: 'pin', label: 'A' },
    { id: 'B', x: 6, type: 'roller', label: 'B' },
  ],
  hinges: [],
  loads: [{ id: 'p', type: 'point', x: 3, magnitude: 40 }],
};

const struct: Structure2DModel = {
  nameEn: 'portal',
  nameHi: 'portal',
  mode: 'frame',
  nodes: [
    { id: 'n1', label: 'A', x: 0, y: 0, support: 'fixed' },
    { id: 'n2', label: 'B', x: 6, y: 0, support: 'fixed' },
    { id: 'n3', label: 'C', x: 0, y: 4, support: 'free', fy: -30 },
    { id: 'n4', label: 'D', x: 6, y: 4, support: 'free', fx: 20 },
  ],
  members: [
    { id: 'm1', label: 'M1', startNodeId: 'n1', endNodeId: 'n3', E_GPa: 200, A_cm2: 60, I_cm4: 12000 },
    { id: 'm2', label: 'M2', startNodeId: 'n3', endNodeId: 'n4', E_GPa: 200, A_cm2: 60, I_cm4: 12000 },
    { id: 'm3', label: 'M3', startNodeId: 'n4', endNodeId: 'n2', E_GPa: 200, A_cm2: 60, I_cm4: 12000 },
  ],
};

const dims: SectionDimensions = {
  shape: 'rectangular',
  width_mm: 200,
  depth_mm: 400,
  flangeThick_mm: 10,
  webThick_mm: 8,
  outerDia_mm: 300,
  innerDia_mm: 200,
};

function makeInput(over: Partial<AtlasInput> = {}): AtlasInput {
  const beamRes = analyzeBeam(beam);
  const structRes = analyzeStructure2D(struct);
  const gov = beamRes.criticalPoints.find((c) => c.kind === 'max_sagging') ?? beamRes.criticalPoints[0];
  const sec = analyzeCrossSection(dims, { M_kNm: gov?.value ?? 0, V_kN: beamRes.maxAbsV, N_kN: 0, fy_MPa: 250 });
  return {
    beam,
    beamRes,
    struct,
    structRes,
    ild: null,
    dims,
    fy_MPa: 250,
    spanM: beam.length,
    section: {
      maxShear_MPa: sec.maxShear_MPa,
      maxVonMises_MPa: sec.maxVonMises_MPa,
      utilizationRatio: sec.utilizationRatio,
      maxTension_MPa: sec.maxTension_MPa,
      maxCompression_MPa: sec.maxCompression_MPa,
    },
    ...over,
  };
}

describe('concept atlas, numbers come from the solvers, not from prose', () => {
  it('quotes the same determinacy, moment and shear the beam lab shows', () => {
    const input = makeInput();
    const atlas = buildAtlas(input);
    const det = atlas.topics.find((t) => t.id === 'determinacy')!;
    expect(det.readings.find((r) => r.label === 'Beam Ds')!.value).toBe(String(input.beamRes.Ds));

    const sfd = atlas.topics.find((t) => t.id === 'sfd-bmd')!;
    // exactly what the beam module prints for this 40 kN central load
    expect(input.beamRes.maxSaggingM).toBeCloseTo(60, 6);
    expect(input.beamRes.maxAbsV).toBeCloseTo(20, 6);
    expect(sfd.readings.find((r) => r.label === 'M max (sag)')!.value).toContain('60.0');
  });

  it('serviceability verdict flips when the beam is made too slender', () => {
    const okAtlas = buildAtlas(makeInput());
    const okTopic = okAtlas.topics.find((t) => t.id === 'deflection')!;
    expect(okTopic.readings.find((r) => r.label === 'δ max')!.tone).toBe('ok');

    // same load, same span, but 20× less I → δ is 20× larger and L/300 fails
    const floppy: BeamModel = { ...beam, I_cm4: 400 };
    const floppyRes = analyzeBeam(floppy);
    expect(floppyRes.maxAbsDeflectionMm).toBeGreaterThan((beam.length * 1000) / 300);

    const badAtlas = buildAtlas(makeInput({ beam: floppy, beamRes: floppyRes }));
    const badTopic = badAtlas.topics.find((t) => t.id === 'deflection')!;
    expect(badTopic.readings.find((r) => r.label === 'δ max')!.tone).toBe('bad');
    expect(badTopic.readings.find((r) => r.label === 'Used')!.value).toMatch(/%$/);
  });

  it('Maxwell-Betti is a real equality, not a claim', () => {
    const atlas = buildAtlas(makeInput());
    const recip = atlas.topics.find((t) => t.id === 'reciprocity')!;
    const mismatch = recip.readings.find((r) => r.label === 'Mismatch')!;
    // two independent unit-load solves on the same beam must agree to solver tolerance
    expect(Number(mismatch.value.replace('%', '').replace('−', '-'))).toBeLessThan(0.01);
    expect(recip.state).toBe('live');
  });

  it('every topic stays honest about state and points at a real lab', () => {
    const atlas = buildAtlas(makeInput());
    const labs = new Set(['beam', 'structure', 'ild', 'section', 'mohr', 'buckling', 'guide', 'atlas']);
    expect(atlas.topics.length).toBeGreaterThanOrEqual(20);
    for (const t of atlas.topics) {
      expect(labs.has(t.goto)).toBe(true);
      expect(t.readings.length).toBeGreaterThanOrEqual(3);
      expect(t.formula.length).toBeGreaterThan(10);
      expect(t.because.length).toBeGreaterThan(40);
      expect(t.becauseHi.length).toBeGreaterThan(20);
      expect(['live', 'related', 'idle']).toContain(t.state);
    }
    // no placeholder text anywhere
    for (const t of atlas.topics) {
      expect(t.because).not.toMatch(/lorem|TODO|placeholder|undefined|NaN/i);
      expect(t.readings.every((r) => r.value !== 'NaN' && r.value.length > 0)).toBe(true);
    }
  });

  it('section properties quoted by the atlas match the closed form', () => {
    const atlas = buildAtlas(makeInput());
    const sec = atlas.topics.find((t) => t.id === 'sections')!;
    const A = 200 * 400; // mm²
    const I = (200 * 400 ** 3) / 12; // mm⁴
    const a = analyticSection(dims);
    expect(a.area_mm2).toBeCloseTo(A, 6);
    expect(a.Ixx_mm4).toBeCloseTo(I, 3);
    expect(sec.readings.find((r) => r.label === 'A')!.value).toContain((A / 100).toFixed(1).slice(0, 3));
  });

  it('search finds the topic by the word a student would actually use', () => {
    const atlas = buildAtlas(makeInput());
    for (const [q, id] of [
      ['mohr', 'principal-stress'],
      ['truss', 'truss'],
      ['deflection', 'deflection'],
      ['torsion', 'torsion'],
      ['euler', 'buckling'],
      ['settlement', 'settlement'],
    ] as const) {
      const hits = searchAtlas(atlas.topics, q);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].id).toBe(id);
    }
    expect(searchAtlas(atlas.topics, 'zzzz')).toHaveLength(0);
    expect(searchAtlas(atlas.topics, '')).toHaveLength(atlas.topics.length);
  });

  it('buckling card refuses to claim Euler when Johnson actually governs', () => {
    // 200 mm deep section, 6 m span, fy 250 → λ ≈ 72 < λ_transition ≈ 126
    const atlas = buildAtlas(makeInput());
    const buck = atlas.topics.find((t) => t.id === 'buckling')!;
    const num = (v: string) => parseFloat(v.replace(/[^\d.\-]/g, ''));
    const lam = num(buck.readings.find((r) => r.label === 'λ = L / rmin')!.value);
    const euler = num(buck.readings.find((r) => r.label === 'Pcr pinned (Euler)')!.value);
    // the governing row is the one that is not explicitly labelled Euler
    const govRow = buck.readings.find((r) => r.label.startsWith('Pcr pinned (') && !r.label.includes('Euler'))!;
    const govLabel = govRow.label;
    const govVal = num(govRow.value);

    expect(lam).toBeLessThan(126);
    expect(govLabel).toContain('Johnson');
    // Johnson must sit below Euler for an intermediate column, never the other way round
    expect(govVal).toBeLessThan(euler);
    expect(buck.because).toMatch(/Johnson/);
    expect(buck.because).not.toMatch(/Euler is the honest answer/);
  });

  it('a genuinely slender column flips the verdict back to Euler', () => {
    // same section, much longer span → λ crosses the transition
    const longBeam: BeamModel = { ...beam, length: 30 };
    const longRes = analyzeBeam(longBeam);
    const atlas = buildAtlas(makeInput({ beam: longBeam, beamRes: longRes, spanM: 30 }));
    const buck = atlas.topics.find((t) => t.id === 'buckling')!;
    const lam = parseFloat(buck.readings.find((r) => r.label === 'λ = L / rmin')!.value.replace(/[^\d.\-]/g, ''));
    expect(lam).toBeGreaterThan(126);
    const govRow = buck.readings.find((r) => r.label.startsWith('Pcr pinned (') && !r.label.includes('Euler'));
    // when Euler governs the extra row simply repeats Euler
    expect(govRow ? govRow.label : 'Pcr pinned (Euler)').toContain('Euler');
    expect(buck.because).toMatch(/Euler is the honest answer/);
  });

  it('an unstable model does not produce fake numbers', () => {
    const mech: BeamModel = {
      ...beam,
      supports: [{ id: 'A', x: 0, type: 'pin', label: 'A' }], // single pin = mechanism
    };
    const mechRes = analyzeBeam(mech);
    expect(mechRes.isStable).toBe(false);
    const atlas = buildAtlas(makeInput({ beam: mech, beamRes: mechRes }));
    const det = atlas.topics.find((t) => t.id === 'determinacy')!;
    expect(det.readings.find((r) => r.label === 'Stable?')!.value).toBe('no');
    expect(det.readings.find((r) => r.label !== 'Stable?')!.value).not.toBe('NaN');
  });
});
