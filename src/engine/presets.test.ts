import { describe, it, expect } from 'vitest';
import { BEAM_PRESETS, ILD_BRIDGE_PRESETS, STRUCTURE_2D_PRESETS } from './presets';
import { analyzeBeam, inspectBeamSection } from './beamEngine';
import { computeILD, evaluateMovingVehicle } from './ildEngine';
import { analyzeStructure2D } from './frameTrussEngine';

describe('All Classroom Presets End-to-End Verification', () => {
  it('runs all 12 Beam Presets with finite reactions, diagrams, critical points & FBD cuts', () => {
    for (const p of BEAM_PRESETS) {
      const res = analyzeBeam(p.model);
      expect(res.isStable, `Preset ${p.id} should be stable`).toBe(true);
      expect(res.points.length).toBeGreaterThan(50);
      for (const pt of res.points) {
        expect(Number.isFinite(pt.V)).toBe(true);
        expect(Number.isFinite(pt.M)).toBe(true);
        expect(Number.isFinite(pt.deflectionMm)).toBe(true);
      }
      const cut = inspectBeamSection(p.model, res, p.model.length * 0.45);
      expect(Number.isFinite(cut.V)).toBe(true);
      expect(Number.isFinite(cut.M)).toBe(true);
    }
  });

  it('runs all 6 ILD Bridge Presets across Reaction, Shear, Moment & Deflection + Moving Vehicles', () => {
    for (const p of ILD_BRIDGE_PRESETS) {
      const supId = p.model.supports[0].id;
      for (const t of ['reaction', 'shear', 'moment', 'deflection'] as const) {
        const ild = computeILD(p.model, { type: t, supportId: supId, xSection: p.defaultSectionX });
        expect(ild.isStable, `ILD ${p.id} ${t}`).toBe(true);
        expect(ild.points.length).toBeGreaterThan(50);
        const mv = evaluateMovingVehicle(
          p.model,
          ild,
          {
            type: 'irc_train',
            singleLoad_kN: 100,
            axle1_kN: 80,
            axle2_kN: 160,
            wheelbase_m: 3,
            udl_kNm: 20,
            udlLength_m: 5,
          },
          p.model.length * 0.6,
          true
        );
        expect(Number.isFinite(mv.totalResponse)).toBe(true);
        expect(mv.instantaneousBeam?.isStable).toBe(true);
      }
    }
  });

  it('runs all 8 2D Truss & Frame Presets cleanly', () => {
    for (const p of STRUCTURE_2D_PRESETS) {
      const res = analyzeStructure2D(p.model);
      expect(res.isStable, `2D Preset ${p.id}`).toBe(true);
      expect(res.members.length).toBe(p.model.members.length);
      for (const m of res.members) {
        expect(Number.isFinite(m.axial_kN)).toBe(true);
        expect(Number.isFinite(m.maxAbsM)).toBe(true);
      }
    }
  });
});
