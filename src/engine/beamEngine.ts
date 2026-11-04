import { luFactorize, luSolve, solveLinearSystem } from './mathUtils';
import type { LUFactorization } from './mathUtils';

export type SupportType = 'pin' | 'roller' | 'fixed' | 'guided' | 'spring';

export interface BeamSupport {
  id: string;
  x: number; // m
  type: SupportType;
  settlementMm?: number; // downward positive (mm)
  springK?: number; // kN/m (for 'spring')
  label?: string;
}

export interface InternalHinge {
  id: string;
  x: number; // m
}

export type BeamLoadType = 'point' | 'udl' | 'uvl' | 'moment';

export interface BeamLoad {
  id: string;
  type: BeamLoadType;
  x?: number; // for 'point' & 'moment' (m)
  xStart?: number; // for 'udl' & 'uvl' (m)
  xEnd?: number; // for 'udl' & 'uvl' (m)
  magnitude?: number; // kN (downward +) for 'point', kN/m (downward +) for 'udl', kN*m (CW +) for 'moment'
  wStart?: number; // kN/m (downward +) for 'uvl'
  wEnd?: number; // kN/m (downward +) for 'uvl'
  label?: string;
}

export interface BeamModel {
  length: number; // m
  E_GPa: number; // GPa (e.g. 200 for Steel)
  I_cm4: number; // cm^4 (e.g. 8000)
  supports: BeamSupport[];
  hinges: InternalHinge[];
  loads: BeamLoad[];
}

export interface SupportReaction {
  supportId: string;
  label: string;
  x: number;
  type: SupportType;
  Ry: number; // kN (upward +)
  Mz: number; // kN*m (CCW +)
}

export interface BeamDiagramPoint {
  x: number; // m
  V: number; // Shear Force (kN): Left-up / Right-down = +
  M: number; // Bending Moment (kN*m): Sagging = +, Hogging = -
  slopeRad: number; // Slope dv/dx (rad, CCW +)
  deflectionMm: number; // Vertical deflection v (mm, upward +, downward -)
  q: number; // Distributed load intensity at x (kN/m, downward +)
}

export interface CriticalPoint {
  kind:
    | 'max_pos_shear'
    | 'max_neg_shear'
    | 'max_sagging'
    | 'max_hogging'
    | 'zero_shear'
    | 'contraflexure'
    | 'max_deflection';
  x: number;
  value: number;
  unit: string;
  titleEn: string;
  titleHi: string;
}

export interface SectionCutInspection {
  x: number;
  V_left: number;
  V_right: number;
  M_left: number;
  M_right: number;
  V: number;
  M: number;
  slopeDeg: number;
  deflectionMm: number;
  qAtX: number;
  behaviorEn: string;
  behaviorHi: string;
  equilibriumSteps: string[];
  activeLeftForces: Array<{ label: string; x: number; Fy_up: number; arm: number; momentContributionSagging: number }>;
}

export interface SolutionStep {
  stepNumber: number;
  badge: string;
  titleEn: string;
  titleHi: string;
  formulas: string[];
  explanationEn: string;
  explanationHi: string;
}

export interface BeamAnalysisResult {
  isStable: boolean;
  instabilityReasonEn?: string;
  instabilityReasonHi?: string;
  Ds: number; // Static indeterminacy (transverse beam: r - (2 + hinges))
  Ds2D: number; // General 2D static indeterminacy: r_2d - (3 + hinges)
  Dk: number; // Kinematic indeterminacy (active free DOFs at key structural nodes)
  EI_kNm2: number;
  reactions: SupportReaction[];
  points: BeamDiagramPoint[];
  criticalPoints: CriticalPoint[];
  maxAbsV: number;
  maxSaggingM: number;
  maxHoggingM: number;
  maxAbsM: number;
  maxAbsDeflectionMm: number;
  maxDeflectionX: number;
  steps: SolutionStep[];
}

interface MeshNode {
  x: number;
  hasHinge: boolean;
  dofV: number;
  dofThetaL: number;
  dofThetaR: number;
}

interface MeshElement {
  x1: number;
  x2: number;
  L: number;
  dofs: [number, number, number, number]; // [v1, theta1R, v2, theta2L]
  q1: number; // downward distributed load at x1 (kN/m)
  q2: number; // downward distributed load at x2 (kN/m)
}

export interface PreparedBeamFEM {
  nodes: MeshNode[];
  elements: MeshElement[];
  totalDofs: number;
  K_beam: number[][];
  freeDofs: number[];
  prescribedMap: Map<number, number>; // dof -> prescribed displacement (m or rad)
  K_ff_lu: LUFactorization;
  EI: number;
  isStable: boolean;
}

function getSupportLabel(index: number, custom?: string): string {
  if (custom && custom.trim()) return custom.trim();
  return String.fromCharCode(65 + (index % 26));
}

export function buildBeamFEM(model: BeamModel, minSegments = 120): PreparedBeamFEM {
  const L = Math.max(0.1, model.length);
  // E in GPa = 1e6 kN/m^2; I in cm^4 = 1e-8 m^4 => E*I in kN*m^2 = E_GPa * I_cm4 * 1e-2
  const EI = Math.max(1, model.E_GPa * model.I_cm4 * 0.01);

  const rawXs: number[] = [0, L];
  for (const s of model.supports) {
    if (s.x >= 0 && s.x <= L) rawXs.push(s.x);
  }
  for (const h of model.hinges) {
    if (h.x > 1e-6 && h.x < L - 1e-6) rawXs.push(h.x);
  }
  for (const ld of model.loads) {
    if ((ld.type === 'point' || ld.type === 'moment') && ld.x !== undefined) {
      if (ld.x >= 0 && ld.x <= L) rawXs.push(ld.x);
    } else if ((ld.type === 'udl' || ld.type === 'uvl') && ld.xStart !== undefined && ld.xEnd !== undefined) {
      const a = Math.max(0, Math.min(L, Math.min(ld.xStart, ld.xEnd)));
      const b = Math.max(0, Math.min(L, Math.max(ld.xStart, ld.xEnd)));
      rawXs.push(a, b);
    }
  }
  for (let i = 1; i < minSegments; i++) {
    rawXs.push((L * i) / minSegments);
  }

  rawXs.sort((a, b) => a - b);
  const uniqueXs: number[] = [];
  for (const x of rawXs) {
    if (uniqueXs.length === 0 || Math.abs(x - uniqueXs[uniqueXs.length - 1]) > 1e-6) {
      uniqueXs.push(x);
    }
  }
  // Ensure exact L at end
  uniqueXs[uniqueXs.length - 1] = L;

  const nodes: MeshNode[] = [];
  let dofCounter = 0;

  for (const x of uniqueXs) {
    const isInterior = x > 1e-5 && x < L - 1e-5;
    const hasHinge = isInterior && model.hinges.some((h) => Math.abs(h.x - x) < 1e-4);
    const dofV = dofCounter++;
    const dofThetaL = dofCounter++;
    const dofThetaR = hasHinge ? dofCounter++ : dofThetaL;
    nodes.push({ x, hasHinge, dofV, dofThetaL, dofThetaR });
  }

  const totalDofs = dofCounter;
  const K_beam: number[][] = Array.from({ length: totalDofs }, () => new Array<number>(totalDofs).fill(0));
  const elements: MeshElement[] = [];

  for (let e = 0; e < nodes.length - 1; e++) {
    const n1 = nodes[e];
    const n2 = nodes[e + 1];
    const Le = n2.x - n1.x;
    const xm = 0.5 * (n1.x + n2.x);

    let q1 = 0;
    let q2 = 0;
    for (const ld of model.loads) {
      if (ld.type === 'udl' && ld.xStart !== undefined && ld.xEnd !== undefined) {
        const a = Math.min(ld.xStart, ld.xEnd);
        const b = Math.max(ld.xStart, ld.xEnd);
        if (b - a > 1e-7 && xm >= a - 1e-7 && xm <= b + 1e-7) {
          const w = ld.magnitude ?? 0;
          q1 += w;
          q2 += w;
        }
      } else if (ld.type === 'uvl' && ld.xStart !== undefined && ld.xEnd !== undefined) {
        const rawA = ld.xStart;
        const rawB = ld.xEnd;
        const a = Math.min(rawA, rawB);
        const b = Math.max(rawA, rawB);
        const wA = rawA <= rawB ? (ld.wStart ?? 0) : (ld.wEnd ?? 0);
        const wB = rawA <= rawB ? (ld.wEnd ?? 0) : (ld.wStart ?? 0);
        if (b - a > 1e-7 && xm >= a - 1e-7 && xm <= b + 1e-7) {
          const t1 = (n1.x - a) / (b - a);
          const t2 = (n2.x - a) / (b - a);
          q1 += wA + (wB - wA) * t1;
          q2 += wA + (wB - wA) * t2;
        }
      }
    }

    const dofs: [number, number, number, number] = [n1.dofV, n1.dofThetaR, n2.dofV, n2.dofThetaL];
    elements.push({ x1: n1.x, x2: n2.x, L: Le, dofs, q1, q2 });

    const c = EI / (Le * Le * Le);
    const L2 = Le * Le;
    const ke = [
      [12 * c, 6 * Le * c, -12 * c, 6 * Le * c],
      [6 * Le * c, 4 * L2 * c, -6 * Le * c, 2 * L2 * c],
      [-12 * c, -6 * Le * c, 12 * c, -6 * Le * c],
      [6 * Le * c, 2 * L2 * c, -6 * Le * c, 4 * L2 * c],
    ];

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        K_beam[dofs[i]][dofs[j]] += ke[i][j];
      }
    }
  }

  // Copy K_beam into K_sys to add elastic spring supports before partitioning
  const K_sys = K_beam.map((r) => [...r]);
  const prescribedMap = new Map<number, number>();

  const findNearestNode = (xVal: number): MeshNode => {
    let best = nodes[0];
    let bestDist = Math.abs(nodes[0].x - xVal);
    for (const nd of nodes) {
      const dist = Math.abs(nd.x - xVal);
      if (dist < bestDist) {
        bestDist = dist;
        best = nd;
      }
    }
    return best;
  };

  for (const sup of model.supports) {
    if (sup.x < -1e-6 || sup.x > L + 1e-6) continue;
    const nd = findNearestNode(sup.x);
    const settleM = -((sup.settlementMm ?? 0) * 1e-3); // downward mm -> negative v (m)

    if (sup.type === 'pin' || sup.type === 'roller') {
      prescribedMap.set(nd.dofV, settleM);
    } else if (sup.type === 'fixed') {
      prescribedMap.set(nd.dofV, settleM);
      prescribedMap.set(nd.dofThetaL, 0);
      prescribedMap.set(nd.dofThetaR, 0);
    } else if (sup.type === 'guided') {
      prescribedMap.set(nd.dofThetaL, 0);
      prescribedMap.set(nd.dofThetaR, 0);
    } else if (sup.type === 'spring') {
      const k = Math.max(0.001, sup.springK ?? 5000);
      K_sys[nd.dofV][nd.dofV] += k;
    }
  }

  const freeDofs: number[] = [];
  for (let d = 0; d < totalDofs; d++) {
    if (!prescribedMap.has(d)) freeDofs.push(d);
  }

  const nf = freeDofs.length;
  const K_ff: number[][] = Array.from({ length: nf }, (_, i) =>
    Array.from({ length: nf }, (__, j) => K_sys[freeDofs[i]][freeDofs[j]])
  );

  const K_ff_lu = luFactorize(K_ff);

  return {
    nodes,
    elements,
    totalDofs,
    K_beam,
    freeDofs,
    prescribedMap,
    K_ff_lu,
    EI,
    isStable: !K_ff_lu.isSingular,
  };
}

function computeDeterminacyCounts(model: BeamModel): { Ds: number; Ds2D: number; Dk: number; rTransverse: number; r2D: number; hingeCount: number } {
  const L = model.length;
  const validSupports = model.supports.filter((s) => s.x >= -1e-6 && s.x <= L + 1e-6);
  const validHinges = model.hinges.filter((h) => h.x > 1e-5 && h.x < L - 1e-5);

  let rTransverse = 0;
  let r2D = 0;
  for (const s of validSupports) {
    if (s.type === 'roller' || s.type === 'spring') {
      rTransverse += 1;
      r2D += 1;
    } else if (s.type === 'pin') {
      rTransverse += 1; // vertical restraint for pure transverse beam theory
      r2D += 2; // Rx, Ry
    } else if (s.type === 'guided') {
      rTransverse += 1; // rotational restraint
      r2D += 2;
    } else if (s.type === 'fixed') {
      rTransverse += 2; // Ry, Mz
      r2D += 3; // Rx, Ry, Mz
    }
  }

  const hingeCount = validHinges.length;
  const Ds = rTransverse - (2 + hingeCount);
  const Ds2D = r2D - (3 + hingeCount);

  // Structural key nodes for textbook Dk count (ends + supports + hinges)
  const keyXs = [0, L, ...validSupports.map((s) => s.x), ...validHinges.map((h) => h.x)].sort((a, b) => a - b);
  const uniqueKeyXs: number[] = [];
  for (const x of keyXs) {
    if (uniqueKeyXs.length === 0 || Math.abs(x - uniqueKeyXs[uniqueKeyXs.length - 1]) > 1e-4) {
      uniqueKeyXs.push(x);
    }
  }
  let Dk = 0;
  for (const x of uniqueKeyXs) {
    const supAtX = validSupports.filter((s) => Math.abs(s.x - x) < 1e-4);
    const hingeAtX = x > 1e-4 && x < L - 1e-4 && validHinges.some((h) => Math.abs(h.x - x) < 1e-4);
    const vRestrained = supAtX.some((s) => s.type === 'pin' || s.type === 'roller' || s.type === 'fixed');
    const rotRestrained = supAtX.some((s) => s.type === 'fixed' || s.type === 'guided');
    if (!vRestrained) Dk += 1;
    if (!rotRestrained) Dk += hingeAtX ? 2 : 1;
  }

  return { Ds, Ds2D, Dk, rTransverse, r2D, hingeCount };
}

export function analyzeBeam(model: BeamModel): BeamAnalysisResult {
  const counts = computeDeterminacyCounts(model);
  const fem = buildBeamFEM(model, 140);
  const { nodes, elements, totalDofs, K_beam, freeDofs, prescribedMap, K_ff_lu, EI } = fem;

  if (!fem.isStable) {
    return {
      isStable: false,
      instabilityReasonEn:
        counts.rTransverse < 2 + counts.hingeCount
          ? `Insufficient restraints (Reactions r = ${counts.rTransverse} < 2 + ${counts.hingeCount} hinges). Add a support or fix a rotation so the beam does not collapse as a mechanism.`
          : 'Geometric mechanism detected (e.g., an unsupported cantilever segment isolated by an internal hinge, or collinear hinges). Relocate supports or hinges.',
      instabilityReasonHi:
        counts.rTransverse < 2 + counts.hingeCount
          ? `Structure unstable hai (Mechanism)! Vertical/Moment restraints kam hain (r = ${counts.rTransverse} < 2 + ${counts.hingeCount} hinges). Ek aur support lagaiye ya Fixed support chuniye.`
          : 'Internal Hinge ki wajah se beam ka ek hissa bina support ke jhool raha hai (Mechanism collapse)! Hinge ya support ki position badal kar dekhiye.',
      Ds: counts.Ds,
      Ds2D: counts.Ds2D,
      Dk: counts.Dk,
      EI_kNm2: EI,
      reactions: [],
      points: [],
      criticalPoints: [],
      maxAbsV: 0,
      maxSaggingM: 0,
      maxHoggingM: 0,
      maxAbsM: 0,
      maxAbsDeflectionMm: 0,
      maxDeflectionX: 0,
      steps: [],
    };
  }

  // Assemble external & equivalent nodal load vector F_loads (upward Fy +, CCW Mz +)
  const F_loads = new Array<number>(totalDofs).fill(0);
  // Spring settlement preload if any
  const F_springPreload = new Array<number>(totalDofs).fill(0);

  for (const el of elements) {
    const { L: Le, q1, q2, dofs } = el;
    if (Math.abs(q1) > 1e-12 || Math.abs(q2) > 1e-12) {
      const feq0 = -Le * ((7 / 20) * q1 + (3 / 20) * q2);
      const feq1 = -Le * Le * ((1 / 20) * q1 + (1 / 30) * q2);
      const feq2 = -Le * ((3 / 20) * q1 + (7 / 20) * q2);
      const feq3 = Le * Le * ((1 / 30) * q1 + (1 / 20) * q2);
      F_loads[dofs[0]] += feq0;
      F_loads[dofs[1]] += feq1;
      F_loads[dofs[2]] += feq2;
      F_loads[dofs[3]] += feq3;
    }
  }

  const findNearestNode = (xVal: number): MeshNode => {
    let best = nodes[0];
    let bestDist = Math.abs(nodes[0].x - xVal);
    for (const nd of nodes) {
      const dist = Math.abs(nd.x - xVal);
      if (dist < bestDist) {
        bestDist = dist;
        best = nd;
      }
    }
    return best;
  };

  for (const ld of model.loads) {
    if (ld.type === 'point' && ld.x !== undefined) {
      const nd = findNearestNode(ld.x);
      F_loads[nd.dofV] += -(ld.magnitude ?? 0); // downward positive -> negative Fy
    } else if (ld.type === 'moment' && ld.x !== undefined) {
      const nd = findNearestNode(ld.x);
      // Clockwise external couple M0 -> negative CCW nodal moment
      F_loads[nd.dofThetaR] += -(ld.magnitude ?? 0);
    }
  }

  for (const sup of model.supports) {
    if (sup.type === 'spring') {
      const nd = findNearestNode(sup.x);
      const settleM = -((sup.settlementMm ?? 0) * 1e-3);
      const k = Math.max(0.001, sup.springK ?? 5000);
      F_springPreload[nd.dofV] += k * settleM;
    }
  }

  // Partition RHS: K_ff * d_f = F_f - K_fp * d_p
  const d = new Array<number>(totalDofs).fill(0);
  prescribedMap.forEach((val, dof) => {
    d[dof] = val;
  });

  const rhsFree = new Array<number>(freeDofs.length).fill(0);
  for (let i = 0; i < freeDofs.length; i++) {
    const fd = freeDofs[i];
    let val = F_loads[fd] + F_springPreload[fd];
    prescribedMap.forEach((pVal, pd) => {
      if (pVal !== 0) {
        val -= K_beam[fd][pd] * pVal;
      }
    });
    rhsFree[i] = val;
  }

  const dFree = luSolve(K_ff_lu, rhsFree);
  for (let i = 0; i < freeDofs.length; i++) {
    d[freeDofs[i]] = dFree[i];
  }

  // Compute total nodal reaction vector from pure beam equilibrium: R = K_beam * d - F_loads
  const R_vec = new Array<number>(totalDofs).fill(0);
  for (let i = 0; i < totalDofs; i++) {
    let kd = 0;
    for (let j = 0; j < totalDofs; j++) {
      if (K_beam[i][j] !== 0 && d[j] !== 0) {
        kd += K_beam[i][j] * d[j];
      }
    }
    R_vec[i] = kd - F_loads[i];
  }

  // Map reactions cleanly to supports (handling multiple supports if needed)
  const validSupports = model.supports
    .filter((s) => s.x >= -1e-6 && s.x <= model.length + 1e-6)
    .sort((a, b) => a.x - b.x);

  const reactions: SupportReaction[] = validSupports.map((sup, idx) => {
    const nd = findNearestNode(sup.x);
    let Ry = 0;
    let Mz = 0;
    if (sup.type === 'pin' || sup.type === 'roller') {
      Ry = R_vec[nd.dofV];
    } else if (sup.type === 'fixed') {
      Ry = R_vec[nd.dofV];
      Mz = nd.hasHinge ? R_vec[nd.dofThetaL] + R_vec[nd.dofThetaR] : R_vec[nd.dofThetaL];
    } else if (sup.type === 'guided') {
      Mz = nd.hasHinge ? R_vec[nd.dofThetaL] + R_vec[nd.dofThetaR] : R_vec[nd.dofThetaL];
    } else if (sup.type === 'spring') {
      const settleM = -((sup.settlementMm ?? 0) * 1e-3);
      const k = Math.max(0.001, sup.springK ?? 5000);
      Ry = -k * (d[nd.dofV] - settleM);
    }
    return {
      supportId: sup.id,
      label: getSupportLabel(idx, sup.label),
      x: sup.x,
      type: sup.type,
      Ry: Math.abs(Ry) < 1e-7 ? 0 : Ry,
      Mz: Math.abs(Mz) < 1e-7 ? 0 : Mz,
    };
  });

  // Recover exact element-by-element diagrams (including both left & right limits at nodes so SFD/BMD jumps are razor-sharp!)
  const points: BeamDiagramPoint[] = [];

  for (let e = 0; e < elements.length; e++) {
    const el = elements[e];
    const Le = el.L;
    const c = EI / (Le * Le * Le);
    const L2 = Le * Le;
    const ke = [
      [12 * c, 6 * Le * c, -12 * c, 6 * Le * c],
      [6 * Le * c, 4 * L2 * c, -6 * Le * c, 2 * L2 * c],
      [-12 * c, -6 * Le * c, 12 * c, -6 * Le * c],
      [6 * Le * c, 2 * L2 * c, -6 * Le * c, 4 * L2 * c],
    ];
    const de = el.dofs.map((idx) => d[idx]);
    const feq = [
      -Le * ((7 / 20) * el.q1 + (3 / 20) * el.q2),
      -Le * Le * ((1 / 20) * el.q1 + (1 / 30) * el.q2),
      -Le * ((3 / 20) * el.q1 + (7 / 20) * el.q2),
      Le * Le * ((1 / 30) * el.q1 + (1 / 20) * el.q2),
    ];
    const fint = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      let s = -feq[i];
      for (let j = 0; j < 4; j++) s += ke[i][j] * de[j];
      fint[i] = s;
    }

    const V0 = fint[0]; // Shear at xi = 0+
    const M0 = -fint[1]; // Sagging BM at xi = 0+

    const subSteps = 3;
    for (let k = 0; k <= subSteps; k++) {
      const s = k / subSteps;
      const xi = s * Le;
      const x = el.x1 + xi;

      const V = V0 - el.q1 * xi - ((el.q2 - el.q1) / (2 * Le)) * xi * xi;
      const M = M0 + V0 * xi - 0.5 * el.q1 * xi * xi - ((el.q2 - el.q1) / (6 * Le)) * xi * xi * xi;
      const q = el.q1 + (el.q2 - el.q1) * s;

      const N1 = 1 - 3 * s * s + 2 * s * s * s;
      const N2 = Le * (s - 2 * s * s + s * s * s);
      const N3 = 3 * s * s - 2 * s * s * s;
      const N4 = Le * (-s * s + s * s * s);
      const v = N1 * de[0] + N2 * de[1] + N3 * de[2] + N4 * de[3];

      const dN1 = (-6 * s + 6 * s * s) / Le;
      const dN2 = 1 - 4 * s + 3 * s * s;
      const dN3 = (6 * s - 6 * s * s) / Le;
      const dN4 = -2 * s + 3 * s * s;
      const slope = dN1 * de[0] + dN2 * de[1] + dN3 * de[2] + dN4 * de[3];

      const prevPt = points[points.length - 1];
      if (
        prevPt &&
        Math.abs(prevPt.x - x) < 1e-8 &&
        Math.abs(prevPt.V - V) < 1e-5 &&
        Math.abs(prevPt.M - M) < 1e-5 &&
        Math.abs(prevPt.slopeRad - slope) < 1e-6
      ) {
        continue;
      }

      points.push({
        x,
        V: Math.abs(V) < 1e-7 ? 0 : V,
        M: Math.abs(M) < 1e-7 ? 0 : M,
        slopeRad: Math.abs(slope) < 1e-9 ? 0 : slope,
        deflectionMm: Math.abs(v * 1000) < 1e-6 ? 0 : v * 1000,
        q,
      });
    }
  }

  // Robust zero-shear & contraflexure detection across sampled curve (handles exact nodal zeros too!)
  const zeroShearXs: Array<{ x: number; M: number }> = [];
  const contraflexureXs: number[] = [];

  let lastSigV: { x: number; V: number; M: number } | null = null;
  let lastSigM: { x: number; M: number } | null = null;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    // Smooth Zero-Shear crossing (exclude pure vertical jumps at same x)
    if (Math.abs(p.V) > 1e-4) {
      if (lastSigV && lastSigV.V * p.V < 0 && Math.abs(p.x - lastSigV.x) > 1e-5) {
        const frac = Math.abs(lastSigV.V) / (Math.abs(lastSigV.V) + Math.abs(p.V));
        const zx = lastSigV.x + frac * (p.x - lastSigV.x);
        const zM = lastSigV.M + frac * (p.M - lastSigV.M);
        if (zx > 1e-3 && zx < model.length - 1e-3 && !zeroShearXs.some((z) => Math.abs(z.x - zx) < 5e-3)) {
          zeroShearXs.push({ x: zx, M: zM });
        }
      }
      lastSigV = { x: p.x, V: p.V, M: p.M };
    }

    // Point of Contraflexure (M flips sign strictly inside span, excluding hinges)
    if (Math.abs(p.M) > 1e-4) {
      if (lastSigM && lastSigM.M * p.M < 0) {
        let cx = p.x;
        if (Math.abs(p.x - lastSigM.x) > 1e-5) {
          const frac = Math.abs(lastSigM.M) / (Math.abs(lastSigM.M) + Math.abs(p.M));
          cx = lastSigM.x + frac * (p.x - lastSigM.x);
        }
        const isAtHinge = model.hinges.some((h) => Math.abs(h.x - cx) < 5e-3);
        if (
          cx > 1e-3 &&
          cx < model.length - 1e-3 &&
          !isAtHinge &&
          !contraflexureXs.some((z) => Math.abs(z - cx) < 5e-3)
        ) {
          contraflexureXs.push(cx);
        }
      }
      lastSigM = { x: p.x, M: p.M };
    }
  }

  // Extract extrema & critical points
  let maxPosV = { x: 0, val: -Infinity };
  let maxNegV = { x: 0, val: Infinity };
  let maxSagM = { x: 0, val: -Infinity };
  let maxHogM = { x: 0, val: Infinity };
  let maxDefl = { x: 0, val: 0, signed: 0 };

  for (const pt of points) {
    if (pt.V > maxPosV.val) maxPosV = { x: pt.x, val: pt.V };
    if (pt.V < maxNegV.val) maxNegV = { x: pt.x, val: pt.V };
    if (pt.M > maxSagM.val) maxSagM = { x: pt.x, val: pt.M };
    if (pt.M < maxHogM.val) maxHogM = { x: pt.x, val: pt.M };
    if (Math.abs(pt.deflectionMm) > maxDefl.val) {
      maxDefl = { x: pt.x, val: Math.abs(pt.deflectionMm), signed: pt.deflectionMm };
    }
  }

  const criticalPoints: CriticalPoint[] = [];
  if (maxPosV.val > 1e-4) {
    criticalPoints.push({
      kind: 'max_pos_shear',
      x: maxPosV.x,
      value: maxPosV.val,
      unit: 'kN',
      titleEn: 'Max +ve Shear Force',
      titleHi: 'Max +ve Shear (Katav Bal)',
    });
  }
  if (maxNegV.val < -1e-4) {
    criticalPoints.push({
      kind: 'max_neg_shear',
      x: maxNegV.x,
      value: maxNegV.val,
      unit: 'kN',
      titleEn: 'Max -ve Shear Force',
      titleHi: 'Max -ve Shear (Katav Bal)',
    });
  }
  if (maxSagM.val > 1e-4) {
    criticalPoints.push({
      kind: 'max_sagging',
      x: maxSagM.x,
      value: maxSagM.val,
      unit: 'kN·m',
      titleEn: 'Max Sagging Moment (+BM)',
      titleHi: 'Max Sagging (+BM: Neeche Tension)',
    });
  }
  if (maxHogM.val < -1e-4) {
    criticalPoints.push({
      kind: 'max_hogging',
      x: maxHogM.x,
      value: maxHogM.val,
      unit: 'kN·m',
      titleEn: 'Max Hogging Moment (-BM)',
      titleHi: 'Max Hogging (-BM: Upar Tension)',
    });
  }
  for (const zs of zeroShearXs) {
    criticalPoints.push({
      kind: 'zero_shear',
      x: zs.x,
      value: zs.M,
      unit: 'kN·m',
      titleEn: `Zero Shear (dM/dx = 0) → Local BM Peak`,
      titleHi: `Zero Shear Point (V = 0) → Yahan BM Peak aata hai`,
    });
  }
  for (const cx of contraflexureXs) {
    criticalPoints.push({
      kind: 'contraflexure',
      x: cx,
      value: 0,
      unit: 'kN·m',
      titleEn: 'Point of Contraflexure (M = 0)',
      titleHi: 'Point of Contraflexure (Sagging ↔ Hogging Flip!)',
    });
  }
  if (maxDefl.val > 1e-5) {
    criticalPoints.push({
      kind: 'max_deflection',
      x: maxDefl.x,
      value: maxDefl.signed,
      unit: 'mm',
      titleEn: 'Maximum Deflection',
      titleHi: 'Sabse Zyada Jhukav (Max Deflection)',
    });
  }

  const maxAbsV = Math.max(Math.abs(maxPosV.val), Math.abs(maxNegV.val), 0);
  const maxSaggingM = Math.max(0, maxSagM.val);
  const maxHoggingM = Math.min(0, maxHogM.val);
  const maxAbsM = Math.max(maxSaggingM, Math.abs(maxHoggingM));

  const steps = buildSolutionSteps(model, counts, EI, reactions, criticalPoints, maxDefl);

  return {
    isStable: true,
    Ds: counts.Ds,
    Ds2D: counts.Ds2D,
    Dk: counts.Dk,
    EI_kNm2: EI,
    reactions,
    points,
    criticalPoints,
    maxAbsV,
    maxSaggingM,
    maxHoggingM,
    maxAbsM,
    maxAbsDeflectionMm: maxDefl.val,
    maxDeflectionX: maxDefl.x,
    steps,
  };
}

function buildSolutionSteps(
  model: BeamModel,
  counts: { Ds: number; Ds2D: number; Dk: number; rTransverse: number; r2D: number; hingeCount: number },
  EI: number,
  reactions: SupportReaction[],
  criticalPoints: CriticalPoint[],
  maxDefl: { x: number; val: number; signed: number }
): SolutionStep[] {
  const isDeterminate = counts.Ds === 0;
  const rxSummary = reactions
    .map((r) => {
      const parts = [`R${r.label}y = ${r.Ry.toFixed(2)} kN`];
      if (Math.abs(r.Mz) > 1e-4 || r.type === 'fixed' || r.type === 'guided') {
        parts.push(`M${r.label} = ${r.Mz.toFixed(2)} kN·m`);
      }
      return parts.join(', ');
    })
    .join('  |  ');

  const contraPts = criticalPoints.filter((c) => c.kind === 'contraflexure');
  const zeroVPts = criticalPoints.filter((c) => c.kind === 'zero_shear');
  const allowableMm = (model.length * 1000) / 300; // L/300 serviceability benchmark

  return [
    {
      stepNumber: 1,
      badge: isDeterminate ? 'Statically Determinate (Ds = 0)' : `Statically Indeterminate (Ds = ${counts.Ds})`,
      titleEn: 'Step 1: Structural Classification & Degree of Indeterminacy',
      titleHi: 'Step 1: Structure Pehchano, Determinate hai ya Indeterminate?',
      formulas: [
        `Transverse Beam: Ds = r - (2 + c) = ${counts.rTransverse} - (2 + ${counts.hingeCount}) = ${counts.Ds}`,
        `2D General Plane: Ds(2D) = r2D - (3 + c) = ${counts.r2D} - (3 + ${counts.hingeCount}) = ${counts.Ds2D}`,
        `Kinematic Indeterminacy (Active Joint DOFs): Dk = ${counts.Dk}`,
      ],
      explanationEn: isDeterminate
        ? 'Since Ds = 0, static equilibrium equations alone (∑Fy = 0, ∑M = 0, plus Mhinge = 0 at any internal hinge) uniquely determine all reactions and internal forces, independent of EI!'
        : `Since Ds = ${counts.Ds} > 0, static equilibrium equations alone are NOT enough. Compatibility of deformations (Direct Stiffness / Slope-Deflection / Moment Distribution with EI = ${EI.toFixed(0)} kN·m²) is required to solve redundant forces.`,
      explanationHi: isDeterminate
        ? 'Kyunki Ds = 0 hai, sirf Equilibrium Equations (∑Fy = 0 aur ∑M = 0) se saare support reactions nikal jayenge! Material stiffness EI badalne se SFD/BMD nahi badlega (sirf deflection badlega).'
        : `Kyunki Ds = ${counts.Ds} > 0 hai, sirf ∑Fy=0 aur ∑M=0 kaafi nahi hain! Extra unknowns nikalne ke liye beam ke jhukav ki compatibility (Stiffness Matrix [K]{d}={F} ya Moment Distribution) use hoti hai.`,
    },
    {
      stepNumber: 2,
      badge: 'Equilibrium & Reactions',
      titleEn: 'Step 2: Support Reactions & Boundary Restraints',
      titleHi: 'Step 2: Support Reactions (Zameen Beam ko Kitna Utha Rahi Hai?)',
      formulas: [
        rxSummary || 'No active reactions',
        `Vertical Check: ∑Ry = ${reactions.reduce((acc, r) => acc + r.Ry, 0).toFixed(2)} kN (balances total downward applied load)`,
      ],
      explanationEn:
        'Positive Ry (+kN) acts upward; positive wall moment Mz (+kN·m) acts counter-clockwise. Notice how loads closer to a support transfer a larger share of reaction directly to that support.',
      explanationHi:
        'Load jis support ke paas rakha hota hai, woh support sabse zyada bhaar (Reaction Ry) jhelta hai. Fixed support ghoomne bhi nahi deta, isliye wahan Moment Reaction (Mz) bhi aata hai.',
    },
    {
      stepNumber: 3,
      badge: 'Calculus Chain: w → V → M',
      titleEn: 'Step 3: Shear Force V(x) & Bending Moment M(x) Differential Relations',
      titleHi: 'Step 3: Load se SFD aur BMD Kaise Banta Hai? (Slope Logic)',
      formulas: [
        'dV/dx = -w(x)   ⇒   No load: V is Constant (0°) | UDL: V is Linear (1°) | UVL: V is Parabolic (2°)',
        'dM/dx = V(x)    ⇒   Const V: M is Linear (1°) | Linear V (UDL): M is Parabolic (2°) | Parabolic V (UVL): M is Cubic (3°)',
        'Point Load P causes vertical jump of -P in SFD; Concentrated Moment M₀ (CW) causes +M₀ jump in BMD.',
      ],
      explanationEn:
        'At every section x, the slope of the Bending Moment Diagram equals the Shear Force V(x). Wherever Shear Force crosses zero (V = 0), Bending Moment reaches a smooth local maximum or minimum!',
      explanationHi:
        'Sabse bada classroom secret: SFD ki height hi BMD ki dhalan (slope) hoti hai! Jahan SFD zero ko cross karta hai (V = 0), wahin BMD apni choti (Peak Maximum Moment) banata hai!',
    },
    {
      stepNumber: 4,
      badge: 'Critical Design Sections',
      titleEn: 'Step 4: Peak Moments, Zero-Shear & Points of Contraflexure',
      titleHi: 'Step 4: Critical Points, Kahan Steel Lagega aur Kahan Curvature Paltega?',
      formulas: [
        zeroVPts.length > 0
          ? `Zero-Shear Locations: ${zeroVPts.map((z) => `x = ${z.x.toFixed(2)} m (M = ${z.value.toFixed(2)} kN·m)`).join(', ')}`
          : 'Peak moments occur directly at point loads, supports, or concentrated couples.',
        contraPts.length > 0
          ? `Points of Contraflexure (M = 0): ${contraPts.map((c) => `x = ${c.x.toFixed(2)} m`).join(', ')}`
          : 'No interior Point of Contraflexure (beam bends in single curvature sense within spans).',
      ],
      explanationEn:
        'Sagging (+M) compresses top fibers and stretches bottom fibers. Hogging (-M) stretches top fibers and compresses bottom fibers. Points of Contraflexure (M = 0) mark the inflection points where curvature flips!',
      explanationHi:
        'Sagging (+BM) mein beam muskurati hai 😊 (neeche khinchav/tension → RCC mein sariya neeche). Hogging (-BM) mein beam udaas hoti hai ☹️ (upar tension → support ke upar sariya upar!). Contraflexure par M = 0 hota hai.',
    },
    {
      stepNumber: 5,
      badge: maxDefl.val <= allowableMm ? 'Serviceability OK (≤ L/300)' : 'High Deflection (> L/300)',
      titleEn: 'Step 5: Elastic Curve Slope θ(x) & Deflection y(x)',
      titleHi: 'Step 5: Beam Kitni Jhuki? (Slope θ aur Deflection y Check)',
      formulas: [
        `EI · d²y/dx² = M(x)   with Flexural Rigidity EI = ${EI.toFixed(1)} kN·m²`,
        `Max Deflection |y|max = ${maxDefl.val.toFixed(3)} mm at x = ${maxDefl.x.toFixed(2)} m  (Benchmark L/300 = ${allowableMm.toFixed(2)} mm)`,
      ],
      explanationEn:
        'Integrating M(x)/EI once yields slope θ(x), and integrating twice yields deflection y(x) subject to support boundary conditions (y = settlement at pins/rollers; y = 0 & θ = 0 at fixed ends).',
      explanationHi:
        'Agar deflection L/300 limit se zyada ho, toh plaster chatak sakta hai! Ise kam karne ke liye ya toh gehra I-section/beam lo (Moment of Inertia I badhao) ya beech mein support do.',
    },
  ];
}

/**
 * Computes exact Left-Cut Free Body Diagram (Method of Sections) at any xCut in [0, L].
 */
export function inspectBeamSection(
  model: BeamModel,
  analysis: BeamAnalysisResult,
  xCutRaw: number
): SectionCutInspection {
  const L = model.length;
  const xCut = Math.max(0, Math.min(L, xCutRaw));

  // Find left and right limits from points array near xCut
  let nearestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < analysis.points.length; i++) {
    const dist = Math.abs(analysis.points[i].x - xCut);
    if (dist < bestDist) {
      bestDist = dist;
      nearestIdx = i;
    }
  }

  const pt = analysis.points[nearestIdx] ?? {
    x: xCut,
    V: 0,
    M: 0,
    slopeRad: 0,
    deflectionMm: 0,
    q: 0,
  };

  // Check if there is a jump right at xCut
  const closePts = analysis.points.filter((p) => Math.abs(p.x - pt.x) < 1e-4);
  const V_left = closePts[0]?.V ?? pt.V;
  const V_right = closePts[closePts.length - 1]?.V ?? pt.V;
  const M_left = closePts[0]?.M ?? pt.M;
  const M_right = closePts[closePts.length - 1]?.M ?? pt.M;

  // Build explicit left-cut FBD terms for x < xCut (or <= xCut if xCut === L)
  const includeAtCut = xCut > L - 1e-5;
  const activeLeftForces: SectionCutInspection['activeLeftForces'] = [];

  for (const r of analysis.reactions) {
    if (r.x < xCut - 1e-5 || (includeAtCut && r.x <= xCut + 1e-5) || (xCut < 1e-5 && r.x <= 1e-5)) {
      const arm = Math.max(0, xCut - r.x);
      if (Math.abs(r.Ry) > 1e-5) {
        activeLeftForces.push({
          label: `R${r.label}y`,
          x: r.x,
          Fy_up: r.Ry,
          arm,
          momentContributionSagging: r.Ry * arm,
        });
      }
      if (Math.abs(r.Mz) > 1e-5) {
        // CCW wall moment +Mz produces hogging (-Mz) on left cut
        activeLeftForces.push({
          label: `M${r.label}`,
          x: r.x,
          Fy_up: 0,
          arm: 0,
          momentContributionSagging: -r.Mz,
        });
      }
    }
  }

  for (const ld of model.loads) {
    if (ld.type === 'point' && ld.x !== undefined) {
      if (ld.x < xCut - 1e-5 || (includeAtCut && ld.x <= xCut + 1e-5)) {
        const P = ld.magnitude ?? 0;
        const arm = Math.max(0, xCut - ld.x);
        activeLeftForces.push({
          label: `P(${P.toFixed(1)}kN)`,
          x: ld.x,
          Fy_up: -P,
          arm,
          momentContributionSagging: -P * arm,
        });
      }
    } else if (ld.type === 'moment' && ld.x !== undefined) {
      if (ld.x < xCut - 1e-5 || (includeAtCut && ld.x <= xCut + 1e-5)) {
        const M0 = ld.magnitude ?? 0; // CW + causes +Sagging
        activeLeftForces.push({
          label: `M₀(${M0.toFixed(1)}kN·m)`,
          x: ld.x,
          Fy_up: 0,
          arm: 0,
          momentContributionSagging: M0,
        });
      }
    } else if (ld.type === 'udl' && ld.xStart !== undefined && ld.xEnd !== undefined) {
      const a = Math.min(ld.xStart, ld.xEnd);
      const b = Math.min(xCut, Math.max(ld.xStart, ld.xEnd));
      if (b > a + 1e-5) {
        const w = ld.magnitude ?? 0;
        const len = b - a;
        const F = w * len;
        const xc = a + 0.5 * len;
        const arm = xCut - xc;
        activeLeftForces.push({
          label: `UDL(${w}×${len.toFixed(2)}m)`,
          x: xc,
          Fy_up: -F,
          arm,
          momentContributionSagging: -F * arm,
        });
      }
    } else if (ld.type === 'uvl' && ld.xStart !== undefined && ld.xEnd !== undefined) {
      const rawA = ld.xStart;
      const rawB = ld.xEnd;
      const a = Math.min(rawA, rawB);
      const fullB = Math.max(rawA, rawB);
      const wA = rawA <= rawB ? (ld.wStart ?? 0) : (ld.wEnd ?? 0);
      const wFullB = rawA <= rawB ? (ld.wEnd ?? 0) : (ld.wStart ?? 0);
      const b = Math.min(xCut, fullB);
      if (b > a + 1e-5 && fullB > a + 1e-5) {
        const wCut = wA + ((wFullB - wA) * (b - a)) / (fullB - a);
        const len = b - a;
        // Split trapezoid into rectangle wA + triangle (wCut - wA)
        const F_rect = wA * len;
        const arm_rect = xCut - (a + 0.5 * len);
        const F_tri = 0.5 * (wCut - wA) * len;
        const arm_tri = xCut - (a + (2 / 3) * len);
        const F_tot = F_rect + F_tri;
        const M_tot = -(F_rect * arm_rect + F_tri * arm_tri);
        activeLeftForces.push({
          label: `UVL(${len.toFixed(2)}m)`,
          x: Math.abs(F_tot) > 1e-6 ? xCut + M_tot / F_tot : a + 0.5 * len,
          Fy_up: -F_tot,
          arm: Math.abs(F_tot) > 1e-6 ? -M_tot / F_tot : 0,
          momentContributionSagging: M_tot,
        });
      }
    }
  }

  const fyTerms = activeLeftForces
    .filter((f) => Math.abs(f.Fy_up) > 1e-5)
    .map((f) => `${f.Fy_up >= 0 ? '+' : ''}${f.Fy_up.toFixed(2)} (${f.label})`);
  const mTerms = activeLeftForces
    .filter((f) => Math.abs(f.momentContributionSagging) > 1e-5)
    .map((f) => `${f.momentContributionSagging >= 0 ? '+' : ''}${f.momentContributionSagging.toFixed(2)} (${f.label})`);

  const equilibriumSteps = [
    `Cut Section at x = ${xCut.toFixed(2)} m (Left Segment [0 → ${xCut.toFixed(2)} m] Free Body Diagram):`,
    `∑Fy = 0  ⇒  V(${xCut.toFixed(2)}) = ${fyTerms.length ? fyTerms.join(' ') : '0'} = ${pt.V.toFixed(2)} kN`,
    `∑Mcut = 0  ⇒  M(${xCut.toFixed(2)}) = ${mTerms.length ? mTerms.join(' ') : '0'} = ${pt.M.toFixed(2)} kN·m`,
  ];

  let behaviorEn = 'Neutral (Unstressed in Bending)';
  let behaviorHi = 'Neutral Zone (M ≈ 0: Koi Bending Stress Nahi)';
  if (pt.M > 0.05) {
    behaviorEn = 'Sagging (+BM): Top fibers in Compression, Bottom fibers in Tension';
    behaviorHi = 'Sagging (+BM 😊): Upar Compression (Dabav), Neeche Tension (Khinchav)';
  } else if (pt.M < -0.05) {
    behaviorEn = 'Hogging (-BM): Top fibers in Tension, Bottom fibers in Compression';
    behaviorHi = 'Hogging (-BM ☹️): Upar Tension (Khinchav), Neeche Compression (Dabav)';
  }

  return {
    x: xCut,
    V_left,
    V_right,
    M_left,
    M_right,
    V: pt.V,
    M: pt.M,
    slopeDeg: (pt.slopeRad * 180) / Math.PI,
    deflectionMm: pt.deflectionMm,
    qAtX: pt.q,
    behaviorEn,
    behaviorHi,
    equilibriumSteps,
    activeLeftForces,
  };
}
