import { describe, it, expect } from 'vitest';
import { buildParametric, ParametricKind, DEFAULT_SPEC } from './parametric';
import { analyzeStructure2D } from './frameTrussEngine';

describe('parametric generator', () => {
  const kinds: ParametricKind[] = ['portal', 'storey', 'warren', 'roof', 'hoarding'];
  for (const kind of kinds) {
    for (const bays of [1, 2, 4]) {
      for (const brace of [true, false]) {
        it(`${kind} bays=${bays} brace=${brace}`, () => {
          const m = buildParametric({ ...DEFAULT_SPEC, kind, bays, brace });
          const r = analyzeStructure2D(m);
          expect(r.isStable, `${kind} should be stable: ${r.instabilityMessageEn}`).toBe(true);
          expect(r.Ds).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(r.maxAxialAbs)).toBe(true);
          r.nodes.forEach((n) => expect(Number.isFinite(n.Ry)).toBe(true));
        });
      }
    }
  }
});
