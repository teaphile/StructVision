import { analyzeBeam, BeamAnalysisResult, BeamModel } from './beamEngine';
import { Structure2DModel, Structure2DResult } from './frameTrussEngine';

/* ------------------------------------------------------------------ */
/*  Equilibrium audit, the "no fake numbers" proof                    */
/* ------------------------------------------------------------------ */

export interface EquilibriumCheck {
  label: string;
  applied: number;
  reacted: number;
  residual: number;
  unit: string;
}

export function auditBeamEquilibrium(model: BeamModel, res: BeamAnalysisResult): EquilibriumCheck[] {
  if (!res.isStable) return [];
  let appliedFy = 0;
  let appliedM = 0;
  for (const l of model.loads) {
    if (l.type === 'point' && l.x !== undefined) {
      appliedFy -= l.magnitude ?? 0; // downward positive input => negative Fy
      appliedM -= (l.magnitude ?? 0) * l.x; // moment about x=0 (CCW +) for downward load
    } else if (l.type === 'udl' && l.xStart !== undefined && l.xEnd !== undefined) {
      const w = l.magnitude ?? 0;
      const b = l.xEnd - l.xStart;
      appliedFy -= w * b;
      appliedM -= w * b * (l.xStart + b / 2);
    } else if (l.type === 'uvl' && l.xStart !== undefined && l.xEnd !== undefined) {
      const b = l.xEnd - l.xStart;
      const w1 = l.wStart ?? 0;
      const w2 = l.wEnd ?? 0;
      const total = 0.5 * (w1 + w2) * b;
      const xc = l.xStart + (b * (w1 + 2 * w2)) / (3 * (w1 + w2) || 1);
      appliedFy -= total;
      appliedM -= total * xc;
    } else if (l.type === 'moment' && l.x !== undefined) {
      // input CW + => CCW contribution -M
      appliedM -= l.magnitude ?? 0;
    }
  }
  appliedFy = -appliedFy; // report as total downward load magnitude
  const reactedFy = res.reactions.reduce((s, r) => s + r.Ry, 0);
  const reactedM = res.reactions.reduce((s, r) => s + (r.Mz + r.Ry * r.x), 0);
  // Reaction moment about x=0 (CCW +) = Σ (Mz + Ry*x); applied moment about x=0 (CCW+) = appliedM
  const appliedMomentAbout0 = appliedM;
  return [
    {
      label: 'Σ Vertical force',
      applied: appliedFy,
      reacted: reactedFy,
      residual: reactedFy - appliedFy,
      unit: 'kN',
    },
    {
      label: 'Σ Moment @ x = 0',
      applied: appliedMomentAbout0,
      reacted: reactedM,
      residual: reactedM + appliedMomentAbout0,
      unit: 'kN·m',
    },
  ];
}

export function auditStructureEquilibrium(
  model: Structure2DModel,
  res: Structure2DResult
): EquilibriumCheck[] {
  if (!res.isStable) return [];
  const apFx = model.nodes.reduce((s, n) => s + (n.fx ?? 0), 0);
  const apFy = model.nodes.reduce((s, n) => s + (n.fy ?? 0), 0);
  let apM = 0;
  for (const n of model.nodes) {
    apM += (n.mz ?? 0) + (n.fy ?? 0) * n.x - (n.fx ?? 0) * n.y;
  }
  const rx = res.nodes.reduce((s, n) => s + n.Rx, 0);
  const ry = res.nodes.reduce((s, n) => s + n.Ry, 0);
  const rm = res.nodes.reduce((s, n) => s + n.Mz + n.Ry * n.x - n.Rx * n.y, 0);
  return [
    { label: 'Σ Fx', applied: apFx, reacted: rx, residual: rx + apFx, unit: 'kN' },
    { label: 'Σ Fy', applied: apFy, reacted: ry, residual: ry + apFy, unit: 'kN' },
    { label: 'Σ M @ origin', applied: apM, reacted: rm, residual: rm + apM, unit: 'kN·m' },
  ];
}

/* ------------------------------------------------------------------ */
/*  Frame / truss member section inspector                            */
/* ------------------------------------------------------------------ */

export interface FrameMemberCut {
  memberId: string;
  memberLabel: string;
  sRatio: number;
  x: number;
  y: number;
  N_kN: number;
  V_kN: number;
  M_kNm: number;
  T_kNm: number;
  M_start: number;
  M_end: number;
  V_start: number;
  V_end: number;
  w: number;
  length_m: number;
  angleDeg: number;
  state: 'tension' | 'compression' | 'zero';
}

export function inspectFrameMember(
  model: Structure2DModel,
  res: Structure2DResult,
  memberId: string,
  sRatioRaw: number
): FrameMemberCut | null {
  const m = res.members.find((x) => x.id === memberId);
  const md = model.members.find((x) => x.id === memberId);
  if (!m || !md) return null;
  const s = Math.max(0, Math.min(1, sRatioRaw));
  const ns = m.samples.length;
  const idx = Math.max(0, Math.min(ns - 1, Math.round(s * (ns - 1))));
  const sample = m.samples[idx];
  const w = md.wPerp_kNm ?? 0;
  const xi = s * m.length_m;
  // exact internal actions along the member (same relations the engine uses)
  const V = m.V_start - w * xi;
  const M = m.M_start + m.V_start * xi - 0.5 * w * xi * xi;
  return {
    memberId,
    memberLabel: m.label,
    sRatio: s,
    x: sample.xOrig,
    y: sample.yOrig,
    N_kN: m.axial_kN,
    V_kN: Math.abs(V) < 1e-6 ? 0 : V,
    M_kNm: Math.abs(M) < 1e-6 ? 0 : M,
    T_kNm: 0,
    M_start: m.M_start,
    M_end: m.M_end,
    V_start: m.V_start,
    V_end: m.V_end,
    w,
    length_m: m.length_m,
    angleDeg: m.angleDeg,
    state: m.state,
  };
}

/* ------------------------------------------------------------------ */
/*  Beam → section transfer (axial force & torsion reported honestly)  */
/* ------------------------------------------------------------------ */

export function inspectBeamAt(model: BeamModel, xCut: number) {
  const res = analyzeBeam(model);
  let idx = 0;
  let best = Infinity;
  res.points.forEach((p, i) => {
    const d = Math.abs(p.x - xCut);
    if (d < best) {
      best = d;
      idx = i;
    }
  });
  const p = res.points[idx];
  return { res, point: p };
}
