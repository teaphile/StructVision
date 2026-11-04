import { solveLinearSystem } from './mathUtils';

export type Structure2DMode = 'truss' | 'frame';
export type NodeSupport2D = 'free' | 'pin' | 'roller_x' | 'roller_y' | 'fixed';

export interface Node2D {
  id: string;
  label: string;
  x: number; // m (right +)
  y: number; // m (up +)
  support: NodeSupport2D;
  fx?: number; // Nodal load Fx (kN, right +)
  fy?: number; // Nodal load Fy (kN, up +; e.g. -40 means 40 kN downward)
  mz?: number; // Nodal moment Mz (kN*m, CCW +; frame mode)
}

export interface Member2D {
  id: string;
  label?: string;
  startNodeId: string;
  endNodeId: string;
  E_GPa?: number; // default 200 GPa
  A_cm2?: number; // default 40 cm^2
  I_cm4?: number; // default 8000 cm^4 (frame mode)
  wPerp_kNm?: number; // Distributed load perpendicular (-y' local, e.g. + downward on left->right horizontal member)
}

export interface Structure2DModel {
  nameEn: string;
  nameHi: string;
  mode: Structure2DMode;
  nodes: Node2D[];
  members: Member2D[];
}

export interface Node2DResult {
  id: string;
  label: string;
  x: number;
  y: number;
  ux_mm: number;
  uy_mm: number;
  theta_mrad: number;
  Rx: number; // kN
  Ry: number; // kN
  Mz: number; // kN*m
}

export interface MemberSamplePoint {
  sRatio: number; // 0..1
  xOrig: number;
  yOrig: number;
  dx_m: number; // unscaled global displacement x (m)
  dy_m: number; // unscaled global displacement y (m)
  V: number; // kN
  M: number; // kN*m
}

export interface Member2DResult {
  id: string;
  label: string;
  startNodeId: string;
  endNodeId: string;
  length_m: number;
  angleDeg: number;
  axial_kN: number; // + = Tension, - = Compression
  state: 'tension' | 'compression' | 'zero';
  stress_MPa: number;
  V_start: number;
  V_end: number;
  M_start: number;
  M_end: number;
  maxAbsM: number;
  samples: MemberSamplePoint[];
}

export interface Structure2DResult {
  isStable: boolean;
  instabilityMessageEn?: string;
  instabilityMessageHi?: string;
  Ds: number;
  Dk: number;
  determinacyFormula: string;
  nodes: Node2DResult[];
  members: Member2DResult[];
  maxAxialAbs: number;
  maxMomentAbs: number;
  maxDisp_mm: number;
}

export function analyzeStructure2D(model: Structure2DModel): Structure2DResult {
  const isTruss = model.mode === 'truss';
  const dofPerNode = isTruss ? 2 : 3;
  const jCount = model.nodes.length;
  const mCount = model.members.length;

  let rCount = 0;
  for (const nd of model.nodes) {
    if (nd.support === 'roller_x' || nd.support === 'roller_y') {
      rCount += 1;
    } else if (nd.support === 'pin') {
      rCount += 2;
    } else if (nd.support === 'fixed') {
      rCount += isTruss ? 2 : 3;
    }
  }

  const Ds = isTruss ? mCount + rCount - 2 * jCount : 3 * mCount + rCount - 3 * jCount;
  const Dk = dofPerNode * jCount - rCount;
  const determinacyFormula = isTruss
    ? `Ds = m + r - 2j = ${mCount} + ${rCount} - 2(${jCount}) = ${Ds}`
    : `Ds = 3m + r - 3j = 3(${mCount}) + ${rCount} - 3(${jCount}) = ${Ds}`;

  if (jCount < 2 || mCount < 1) {
    return {
      isStable: false,
      instabilityMessageEn: 'Add at least 2 nodes and 1 member.',
      instabilityMessageHi: 'Kam se kam 2 nodes aur 1 member jodiye.',
      Ds,
      Dk,
      determinacyFormula,
      nodes: [],
      members: [],
      maxAxialAbs: 0,
      maxMomentAbs: 0,
      maxDisp_mm: 0,
    };
  }

  const nodeIndexMap = new Map<string, number>();
  model.nodes.forEach((nd, idx) => nodeIndexMap.set(nd.id, idx));

  const totalDofs = jCount * dofPerNode;
  const K = Array.from({ length: totalDofs }, () => new Array<number>(totalDofs).fill(0));
  const F = new Array<number>(totalDofs).fill(0);

  // Nodal external loads
  model.nodes.forEach((nd, idx) => {
    const base = idx * dofPerNode;
    F[base] += nd.fx ?? 0;
    F[base + 1] += nd.fy ?? 0;
    if (!isTruss) {
      F[base + 2] += nd.mz ?? 0;
    }
  });

  // Member stiffness & equivalent nodal loads
  for (const mem of model.members) {
    const i1 = nodeIndexMap.get(mem.startNodeId);
    const i2 = nodeIndexMap.get(mem.endNodeId);
    if (i1 === undefined || i2 === undefined || i1 === i2) continue;

    const n1 = model.nodes[i1];
    const n2 = model.nodes[i2];
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) continue;

    const c = dx / L;
    const s = dy / L;
    const E = (mem.E_GPa ?? 200) * 1e6; // kN/m^2
    const A = (mem.A_cm2 ?? 40) * 1e-4; // m^2
    const EA_L = (E * A) / L;

    if (isTruss) {
      const dofs = [i1 * 2, i1 * 2 + 1, i2 * 2, i2 * 2 + 1];
      const cc = c * c * EA_L;
      const cs = c * s * EA_L;
      const ss = s * s * EA_L;
      const ke = [
        [cc, cs, -cc, -cs],
        [cs, ss, -cs, -ss],
        [-cc, -cs, cc, cs],
        [-cs, -ss, cs, ss],
      ];
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          K[dofs[a]][dofs[b]] += ke[a][b];
        }
      }
    } else {
      const I = (mem.I_cm4 ?? 8000) * 1e-8; // m^4
      const EI = E * I;
      const cFlex = EI / (L * L * L);
      const L2 = L * L;

      const kLoc = [
        [EA_L, 0, 0, -EA_L, 0, 0],
        [0, 12 * cFlex, 6 * L * cFlex, 0, -12 * cFlex, 6 * L * cFlex],
        [0, 6 * L * cFlex, 4 * L2 * cFlex, 0, -6 * L * cFlex, 2 * L2 * cFlex],
        [-EA_L, 0, 0, EA_L, 0, 0],
        [0, -12 * cFlex, -6 * L * cFlex, 0, 12 * cFlex, -6 * L * cFlex],
        [0, 6 * L * cFlex, 2 * L2 * cFlex, 0, -6 * L * cFlex, 4 * L2 * cFlex],
      ];

      const T = [
        [c, s, 0, 0, 0, 0],
        [-s, c, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
        [0, 0, 0, c, s, 0],
        [0, 0, 0, -s, c, 0],
        [0, 0, 0, 0, 0, 1],
      ];

      // kGlob = T^T * kLoc * T
      const tmp = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
      for (let r = 0; r < 6; r++) {
        for (let col = 0; col < 6; col++) {
          let sum = 0;
          for (let k = 0; k < 6; k++) sum += kLoc[r][k] * T[k][col];
          tmp[r][col] = sum;
        }
      }
      const kGlob = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
      for (let r = 0; r < 6; r++) {
        for (let col = 0; col < 6; col++) {
          let sum = 0;
          for (let k = 0; k < 6; k++) sum += T[k][r] * tmp[k][col];
          kGlob[r][col] = sum;
        }
      }

      const dofs = [i1 * 3, i1 * 3 + 1, i1 * 3 + 2, i2 * 3, i2 * 3 + 1, i2 * 3 + 2];
      for (let a = 0; a < 6; a++) {
        for (let b = 0; b < 6; b++) {
          K[dofs[a]][dofs[b]] += kGlob[a][b];
        }
      }

      const w = mem.wPerp_kNm ?? 0;
      if (Math.abs(w) > 1e-10) {
        const feqLoc = [0, (-w * L) / 2, (-w * L * L) / 12, 0, (-w * L) / 2, (w * L * L) / 12];
        for (let a = 0; a < 6; a++) {
          let fGlob = 0;
          for (let k = 0; k < 6; k++) fGlob += T[k][a] * feqLoc[k];
          F[dofs[a]] += fGlob;
        }
      }
    }
  }

  // Constrained DOFs
  const constrained = new Set<number>();
  model.nodes.forEach((nd, idx) => {
    const base = idx * dofPerNode;
    if (nd.support === 'pin') {
      constrained.add(base);
      constrained.add(base + 1);
    } else if (nd.support === 'roller_x') {
      // Free to roll horizontally along X, restrained vertically in Y
      constrained.add(base + 1);
    } else if (nd.support === 'roller_y') {
      // Restrained in X, free in Y (wall roller)
      constrained.add(base);
    } else if (nd.support === 'fixed') {
      constrained.add(base);
      constrained.add(base + 1);
      if (!isTruss) constrained.add(base + 2);
    }
  });

  const freeDofs: number[] = [];
  for (let d = 0; d < totalDofs; d++) {
    if (!constrained.has(d)) freeDofs.push(d);
  }

  const K_ff = freeDofs.map((ri) => freeDofs.map((ci) => K[ri][ci]));
  const F_f = freeDofs.map((ri) => F[ri]);

  const solved = solveLinearSystem(K_ff, F_f);
  if (solved.isSingular) {
    return {
      isStable: false,
      instabilityMessageEn: isTruss
        ? 'Truss is geometrically unstable (mechanism or unbraced panel: check Ds = m + r - 2j and triangulation!).'
        : 'Frame is unstable (insufficient supports or mechanism). Check boundary restraints.',
      instabilityMessageHi: isTruss
        ? 'Truss unstable hai (Mechanism)! Rectangular bina diagonal ke panel dhas jayega, triangulation ya supports check karein!'
        : 'Frame unstable hai! Supports kam hain ya structure fisal raha hai.',
      Ds,
      Dk,
      determinacyFormula,
      nodes: [],
      members: [],
      maxAxialAbs: 0,
      maxMomentAbs: 0,
      maxDisp_mm: 0,
    };
  }

  const dGlob = new Array<number>(totalDofs).fill(0);
  freeDofs.forEach((dof, i) => {
    dGlob[dof] = solved.x[i];
  });

  // Reactions R = K * dGlob - F
  const R = new Array<number>(totalDofs).fill(0);
  for (let i = 0; i < totalDofs; i++) {
    let sum = 0;
    for (let j = 0; j < totalDofs; j++) sum += K[i][j] * dGlob[j];
    R[i] = sum - F[i];
  }

  let maxDisp_mm = 0;
  const nodeResults: Node2DResult[] = model.nodes.map((nd, idx) => {
    const base = idx * dofPerNode;
    const ux_mm = dGlob[base] * 1000;
    const uy_mm = dGlob[base + 1] * 1000;
    const theta_mrad = isTruss ? 0 : dGlob[base + 2] * 1000;
    const dispMag = Math.hypot(ux_mm, uy_mm);
    if (dispMag > maxDisp_mm) maxDisp_mm = dispMag;

    const hasSup = nd.support !== 'free';
    return {
      id: nd.id,
      label: nd.label,
      x: nd.x,
      y: nd.y,
      ux_mm: Math.abs(ux_mm) < 1e-7 ? 0 : ux_mm,
      uy_mm: Math.abs(uy_mm) < 1e-7 ? 0 : uy_mm,
      theta_mrad: Math.abs(theta_mrad) < 1e-7 ? 0 : theta_mrad,
      Rx: hasSup && Math.abs(R[base]) > 1e-6 ? R[base] : 0,
      Ry: hasSup && Math.abs(R[base + 1]) > 1e-6 ? R[base + 1] : 0,
      Mz: !isTruss && hasSup && Math.abs(R[base + 2]) > 1e-6 ? R[base + 2] : 0,
    };
  });

  let maxAxialAbs = 0;
  let maxMomentAbs = 0;
  const memberResults: Member2DResult[] = [];

  model.members.forEach((mem, mIdx) => {
    const i1 = nodeIndexMap.get(mem.startNodeId);
    const i2 = nodeIndexMap.get(mem.endNodeId);
    if (i1 === undefined || i2 === undefined || i1 === i2) return;

    const n1 = model.nodes[i1];
    const n2 = model.nodes[i2];
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const L = Math.hypot(dx, dy);
    const c = dx / L;
    const s = dy / L;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    const E = (mem.E_GPa ?? 200) * 1e6;
    const A_m2 = (mem.A_cm2 ?? 40) * 1e-4;
    const EA_L = (E * A_m2) / L;

    const label = mem.label || `M${mIdx + 1}`;

    if (isTruss) {
      const u1 = dGlob[i1 * 2];
      const v1 = dGlob[i1 * 2 + 1];
      const u2 = dGlob[i2 * 2];
      const v2 = dGlob[i2 * 2 + 1];
      const axial = EA_L * (c * (u2 - u1) + s * (v2 - v1));
      const cleanN = Math.abs(axial) < 1e-4 ? 0 : axial;
      if (Math.abs(cleanN) > maxAxialAbs) maxAxialAbs = Math.abs(cleanN);

      const samples: MemberSamplePoint[] = [
        { sRatio: 0, xOrig: n1.x, yOrig: n1.y, dx_m: u1, dy_m: v1, V: 0, M: 0 },
        { sRatio: 1, xOrig: n2.x, yOrig: n2.y, dx_m: u2, dy_m: v2, V: 0, M: 0 },
      ];

      memberResults.push({
        id: mem.id,
        label,
        startNodeId: mem.startNodeId,
        endNodeId: mem.endNodeId,
        length_m: L,
        angleDeg,
        axial_kN: cleanN,
        state: cleanN > 1e-4 ? 'tension' : cleanN < -1e-4 ? 'compression' : 'zero',
        stress_MPa: (cleanN / A_m2) * 1e-3, // kN/m^2 -> MPa
        V_start: 0,
        V_end: 0,
        M_start: 0,
        M_end: 0,
        maxAbsM: 0,
        samples,
      });
    } else {
      const I_m4 = (mem.I_cm4 ?? 8000) * 1e-8;
      const EI = E * I_m4;
      const cFlex = EI / (L * L * L);
      const L2 = L * L;
      const w = mem.wPerp_kNm ?? 0;

      const dofs = [i1 * 3, i1 * 3 + 1, i1 * 3 + 2, i2 * 3, i2 * 3 + 1, i2 * 3 + 2];
      const dg = dofs.map((d) => dGlob[d]);
      const dLoc = [
        c * dg[0] + s * dg[1],
        -s * dg[0] + c * dg[1],
        dg[2],
        c * dg[3] + s * dg[4],
        -s * dg[3] + c * dg[4],
        dg[5],
      ];

      const kLoc = [
        [EA_L, 0, 0, -EA_L, 0, 0],
        [0, 12 * cFlex, 6 * L * cFlex, 0, -12 * cFlex, 6 * L * cFlex],
        [0, 6 * L * cFlex, 4 * L2 * cFlex, 0, -6 * L * cFlex, 2 * L2 * cFlex],
        [-EA_L, 0, 0, EA_L, 0, 0],
        [0, -12 * cFlex, -6 * L * cFlex, 0, 12 * cFlex, -6 * L * cFlex],
        [0, 6 * L * cFlex, 2 * L2 * cFlex, 0, -6 * L * cFlex, 4 * L2 * cFlex],
      ];
      const feqLoc = [0, (-w * L) / 2, (-w * L * L) / 12, 0, (-w * L) / 2, (w * L * L) / 12];
      const fint = new Array<number>(6).fill(0);
      for (let r = 0; r < 6; r++) {
        let sum = -feqLoc[r];
        for (let k = 0; k < 6; k++) sum += kLoc[r][k] * dLoc[k];
        fint[r] = sum;
      }

      const axial = -fint[0]; // +Tension, -Compression
      const cleanN = Math.abs(axial) < 1e-4 ? 0 : axial;
      if (Math.abs(cleanN) > maxAxialAbs) maxAxialAbs = Math.abs(cleanN);

      const V0 = fint[1];
      const M0 = -fint[2];

      const nSamples = 20;
      const samples: MemberSamplePoint[] = [];
      let memberMaxM = 0;

      for (let k = 0; k <= nSamples; k++) {
        const sr = k / nSamples;
        const xi = sr * L;
        const V = V0 - w * xi;
        const M = M0 + V0 * xi - 0.5 * w * xi * xi;
        if (Math.abs(M) > memberMaxM) memberMaxM = Math.abs(M);

        const N1 = 1 - 3 * sr * sr + 2 * sr * sr * sr;
        const N2 = L * (sr - 2 * sr * sr + sr * sr * sr);
        const N3 = 3 * sr * sr - 2 * sr * sr * sr;
        const N4 = L * (-sr * sr + sr * sr * sr);

        const uLoc = (1 - sr) * dLoc[0] + sr * dLoc[3];
        const vLoc =
          N1 * dLoc[1] +
          N2 * dLoc[2] +
          N3 * dLoc[4] +
          N4 * dLoc[5] -
          (w * xi * xi * (L - xi) * (L - xi)) / (24 * EI);

        const dx_m = c * uLoc - s * vLoc;
        const dy_m = s * uLoc + c * vLoc;

        samples.push({
          sRatio: sr,
          xOrig: n1.x + c * xi,
          yOrig: n1.y + s * xi,
          dx_m,
          dy_m,
          V: Math.abs(V) < 1e-6 ? 0 : V,
          M: Math.abs(M) < 1e-6 ? 0 : M,
        });
      }

      if (memberMaxM > maxMomentAbs) maxMomentAbs = memberMaxM;

      memberResults.push({
        id: mem.id,
        label,
        startNodeId: mem.startNodeId,
        endNodeId: mem.endNodeId,
        length_m: L,
        angleDeg,
        axial_kN: cleanN,
        state: cleanN > 1e-4 ? 'tension' : cleanN < -1e-4 ? 'compression' : 'zero',
        stress_MPa: (cleanN / A_m2) * 1e-3,
        V_start: samples[0].V,
        V_end: samples[samples.length - 1].V,
        M_start: samples[0].M,
        M_end: samples[samples.length - 1].M,
        maxAbsM: memberMaxM,
        samples,
      });
    }
  });

  return {
    isStable: true,
    Ds,
    Dk,
    determinacyFormula,
    nodes: nodeResults,
    members: memberResults,
    maxAxialAbs,
    maxMomentAbs,
    maxDisp_mm,
  };
}
