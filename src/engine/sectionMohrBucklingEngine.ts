// Cross-Section Stress (σ = My/I, τ = VQ/Ib), 2D Mohr's Circle, Euler/Johnson Buckling & Shaft Torsion Engines

export type SectionShapeType =
  | 'rectangular'
  | 'i_section'
  | 't_section'
  | 'box_section'
  | 'circular'
  | 'hollow_circular';

export interface SectionDimensions {
  shape: SectionShapeType;
  width_mm: number; // b or bf (mm)
  depth_mm: number; // h or overall D (mm)
  flangeThick_mm: number; // tf (mm)
  webThick_mm: number; // tw (mm)
  outerDia_mm: number; // D (mm) for circular
  innerDia_mm: number; // d (mm) for hollow circular
}

export interface SectionLoads {
  M_kNm: number; // Sagging + (top compression, bottom tension)
  V_kN: number; // Transverse vertical shear
  N_kN: number; // Axial force (+ = Tension, - = Compression)
  fy_MPa: number; // Material yield strength (e.g. 250 MPa for Mild Steel Fe250)
}

export interface SectionFiberSample {
  yFromBottom_mm: number;
  yFromCentroid_mm: number;
  width_mm: number;
  Q_mm3: number;
  sigma_MPa: number; // + = Tension, - = Compression
  tau_MPa: number;
  vonMises_MPa: number;
}

export interface SectionAnalysisResult {
  totalDepth_mm: number;
  area_mm2: number;
  yCentroid_mm: number; // from bottom extreme fiber
  Ixx_mm4: number;
  Ixx_cm4: number;
  Ztop_mm3: number;
  Zbot_mm3: number;
  radiusGyration_mm: number;
  yShiftedNA_mm: number | null; // Neutral axis under combined N + M
  maxTension_MPa: number;
  maxCompression_MPa: number;
  maxShear_MPa: number;
  maxVonMises_MPa: number;
  utilizationRatio: number; // maxVonMises / fy
  isSafe: boolean;
  fibers: SectionFiberSample[];
}

function getWidthAtY(dim: SectionDimensions, yFromBot: number, H: number): number {
  const eps = 1e-6;
  if (yFromBot < -eps || yFromBot > H + eps) return 0;
  const y = Math.max(0, Math.min(H, yFromBot));

  switch (dim.shape) {
    case 'rectangular':
      return dim.width_mm;
    case 'i_section': {
      const tf = Math.min(dim.flangeThick_mm, H * 0.45);
      const tw = Math.min(dim.webThick_mm, dim.width_mm);
      if (y <= tf || y >= H - tf) return dim.width_mm;
      return tw;
    }
    case 't_section': {
      const tf = Math.min(dim.flangeThick_mm, H * 0.6);
      const tw = Math.min(dim.webThick_mm, dim.width_mm);
      if (y >= H - tf) return dim.width_mm;
      return tw;
    }
    case 'box_section': {
      const tf = Math.min(dim.flangeThick_mm, H * 0.45);
      const tw = Math.min(dim.webThick_mm, dim.width_mm * 0.45);
      if (y <= tf || y >= H - tf) return dim.width_mm;
      return 2 * tw;
    }
    case 'circular': {
      const R = H / 2;
      const dy = y - R;
      const inside = Math.max(0, R * R - dy * dy);
      return 2 * Math.sqrt(inside);
    }
    case 'hollow_circular': {
      const R = H / 2;
      const r = Math.min(dim.innerDia_mm / 2, R * 0.92);
      const dy = y - R;
      const outHalf = Math.sqrt(Math.max(0, R * R - dy * dy));
      const inHalf = Math.abs(dy) < r ? Math.sqrt(Math.max(0, r * r - dy * dy)) : 0;
      return 2 * Math.max(0, outHalf - inHalf);
    }
  }
}

export function analyzeCrossSection(dim: SectionDimensions, loads: SectionLoads): SectionAnalysisResult {
  const isCirc = dim.shape === 'circular' || dim.shape === 'hollow_circular';
  const H = Math.max(20, isCirc ? dim.outerDia_mm : dim.depth_mm);

  // High-accuracy numerical strips (1000 strips) for universal Area, Centroid, Ixx & Q(y)
  const nStrips = 1000;
  const dy = H / nStrips;
  let area = 0;
  let firstMomBot = 0;

  for (let i = 0; i < nStrips; i++) {
    const ym = (i + 0.5) * dy;
    const b = getWidthAtY(dim, ym, H);
    const dA = b * dy;
    area += dA;
    firstMomBot += dA * ym;
  }

  const yCentroid = area > 0 ? firstMomBot / area : H / 2;

  let Ixx = 0;
  for (let i = 0; i < nStrips; i++) {
    const ym = (i + 0.5) * dy;
    const b = getWidthAtY(dim, ym, H);
    const yRel = ym - yCentroid;
    Ixx += b * dy * yRel * yRel + (b * dy * dy * dy) / 12;
  }

  const cTop = H - yCentroid;
  const cBot = yCentroid;
  const Ztop = cTop > 0 ? Ixx / cTop : 1;
  const Zbot = cBot > 0 ? Ixx / cBot : 1;
  const rGyr = area > 0 ? Math.sqrt(Ixx / area) : 1;

  // Build sample y coordinates including exact step-change junctions (flange-web interfaces!)
  const sampleYs: Array<{ y: number; probeY: number }> = [];
  const nGrid = 120;
  for (let i = 0; i <= nGrid; i++) {
    const y = (H * i) / nGrid;
    sampleYs.push({ y, probeY: y });
  }

  // Add exact left/right of flange-web jumps for I, T, Box sections so shear stress jump renders razor-sharp!
  const tf = Math.min(dim.flangeThick_mm, H * 0.45);
  if (dim.shape === 'i_section' || dim.shape === 'box_section') {
    sampleYs.push({ y: tf, probeY: tf - 1e-4 });
    sampleYs.push({ y: tf, probeY: tf + 1e-4 });
    sampleYs.push({ y: H - tf, probeY: H - tf - 1e-4 });
    sampleYs.push({ y: H - tf, probeY: H - tf + 1e-4 });
  } else if (dim.shape === 't_section') {
    const tfT = Math.min(dim.flangeThick_mm, H * 0.6);
    sampleYs.push({ y: H - tfT, probeY: H - tfT - 1e-4 });
    sampleYs.push({ y: H - tfT, probeY: H - tfT + 1e-4 });
  }
  sampleYs.push({ y: yCentroid, probeY: yCentroid });

  sampleYs.sort((a, b) => a.probeY - b.probeY);

  // Convert loads to N and mm: M in N*mm = kN*m * 1e6; V in N = kN * 1e3; N in N = kN * 1e3
  const M_Nmm = loads.M_kNm * 1e6;
  const V_N = loads.V_kN * 1e3;
  const N_N = loads.N_kN * 1e3;

  let maxTension = 0;
  let maxCompression = 0;
  let maxShear = 0;
  let maxVonMises = 0;

  const fibers: SectionFiberSample[] = [];
  for (const item of sampleYs) {
    const y = Math.max(0, Math.min(H, item.y));
    const bAtProbe = getWidthAtY(dim, Math.max(0, Math.min(H, item.probeY)), H);
    const yRel = y - yCentroid;

    // Integrate Q(y) = integral from y to H of (y' - yCentroid) * b(y') dy'
    const remH = H - y;
    let Q = 0;
    if (remH > 1e-6 && y > 1e-6) {
      const mSub = 160;
      const dSub = remH / mSub;
      for (let k = 0; k < mSub; k++) {
        const ySub = y + (k + 0.5) * dSub;
        const bSub = getWidthAtY(dim, ySub, H);
        Q += bSub * dSub * (ySub - yCentroid);
      }
      Q = Math.abs(Q);
    }

    // Sagging (+M): top (yRel > 0) is Compression (-), bottom (yRel < 0) is Tension (+)
    const sigma = (N_N / area) - (M_Nmm * yRel) / Ixx;
    const tau = bAtProbe > 1e-3 && y > 1e-5 && y < H - 1e-5 ? (Math.abs(V_N) * Q) / (Ixx * bAtProbe) : 0;
    const vm = Math.sqrt(sigma * sigma + 3 * tau * tau);

    if (sigma > maxTension) maxTension = sigma;
    if (sigma < maxCompression) maxCompression = sigma;
    if (tau > maxShear) maxShear = tau;
    if (vm > maxVonMises) maxVonMises = vm;

    const prev = fibers[fibers.length - 1];
    if (
      prev &&
      Math.abs(prev.yFromBottom_mm - y) < 1e-4 &&
      Math.abs(prev.tau_MPa - tau) < 1e-3 &&
      Math.abs(prev.sigma_MPa - sigma) < 1e-3
    ) {
      continue;
    }

    fibers.push({
      yFromBottom_mm: y,
      yFromCentroid_mm: yRel,
      width_mm: bAtProbe,
      Q_mm3: Q,
      sigma_MPa: sigma,
      tau_MPa: tau,
      vonMises_MPa: vm,
    });
  }

  // Neutral axis where sigma(y) = 0 => y - yCentroid = (N_N / area) * Ixx / M_Nmm
  let yShiftedNA: number | null = yCentroid;
  if (Math.abs(M_Nmm) > 1e-3) {
    yShiftedNA = yCentroid + ((N_N / area) * Ixx) / M_Nmm;
  } else if (Math.abs(N_N) > 1e-3) {
    yShiftedNA = null; // Pure axial load -> no neutral axis inside finite depth
  }

  const fy = Math.max(1, loads.fy_MPa);
  const utilizationRatio = maxVonMises / fy;

  return {
    totalDepth_mm: H,
    area_mm2: area,
    yCentroid_mm: yCentroid,
    Ixx_mm4: Ixx,
    Ixx_cm4: Ixx * 1e-4,
    Ztop_mm3: Ztop,
    Zbot_mm3: Zbot,
    radiusGyration_mm: rGyr,
    yShiftedNA_mm: yShiftedNA,
    maxTension_MPa: maxTension,
    maxCompression_MPa: maxCompression,
    maxShear_MPa: maxShear,
    maxVonMises_MPa: maxVonMises,
    utilizationRatio,
    isSafe: utilizationRatio <= 1.0,
    fibers,
  };
}

// ============================================================================
// 2D STRESS TRANSFORMATION & MOHR'S CIRCLE ENGINE
// ============================================================================

export interface MohrInput {
  sigmaX: number; // MPa (+ Tension, - Compression)
  sigmaY: number; // MPa (+ Tension, - Compression)
  tauXY: number; // MPa (+ upward on +X face / rightward on +Y face)
  thetaDeg: number; // Plane rotation CCW from X-axis (deg)
}

export interface MohrResult {
  center: number; // sigma_avg (MPa)
  radius: number; // R = tau_max_inplane (MPa)
  sigma1: number; // Major principal stress (MPa)
  sigma2: number; // Minor principal stress (MPa)
  tauMaxInPlane: number; // R (MPa)
  tauAbsMax3D: number; // Absolute 3D max shear considering sigma3 = 0
  thetaP1Deg: number; // Principal angle 1 (deg, -90..90)
  thetaP2Deg: number; // Principal angle 2 (deg)
  thetaSDeg: number; // Max shear plane angle (deg)
  sigmaXPrime: number; // Normal stress on rotated x' face
  sigmaYPrime: number; // Normal stress on rotated y' face
  tauXPrimeYPrime: number; // Shear stress on rotated x' face
  poleX: number; // Origin of planes (Pole) sigma coordinate
  poleY: number; // Origin of planes (Pole) tau coordinate (Mohr downward-CW or standard)
}

export function analyzeMohrCircle(inp: MohrInput): MohrResult {
  const { sigmaX, sigmaY, tauXY, thetaDeg } = inp;
  const center = 0.5 * (sigmaX + sigmaY);
  const diffHalf = 0.5 * (sigmaX - sigmaY);
  const radius = Math.hypot(diffHalf, tauXY);

  const sigma1 = center + radius;
  const sigma2 = center - radius;
  const tauMaxInPlane = radius;
  const tauAbsMax3D = Math.max(
    radius,
    0.5 * Math.abs(sigma1),
    0.5 * Math.abs(sigma2)
  );

  const twoThetaP = Math.atan2(tauXY, diffHalf);
  const thetaP1Deg = (0.5 * twoThetaP * 180) / Math.PI;
  const thetaP2Deg = thetaP1Deg >= 0 ? thetaP1Deg - 90 : thetaP1Deg + 90;
  const thetaSDeg = thetaP1Deg - 45;

  const rad2 = (2 * thetaDeg * Math.PI) / 180;
  const sigmaXPrime = center + diffHalf * Math.cos(rad2) + tauXY * Math.sin(rad2);
  const sigmaYPrime = center - diffHalf * Math.cos(rad2) - tauXY * Math.sin(rad2);
  const tauXPrimeYPrime = -diffHalf * Math.sin(rad2) + tauXY * Math.cos(rad2);

  return {
    center,
    radius,
    sigma1,
    sigma2,
    tauMaxInPlane,
    tauAbsMax3D,
    thetaP1Deg,
    thetaP2Deg,
    thetaSDeg,
    sigmaXPrime,
    sigmaYPrime,
    tauXPrimeYPrime,
    poleX: sigmaY,
    poleY: tauXY,
  };
}

// ============================================================================
// EULER & JOHNSON COLUMN BUCKLING ENGINE
// ============================================================================

export type ColumnEndCondition = 'pinned_pinned' | 'fixed_fixed' | 'fixed_pinned' | 'fixed_free';

export interface ColumnBucklingInput {
  endCondition: ColumnEndCondition;
  length_m: number;
  E_GPa: number;
  fy_MPa: number;
  area_cm2: number;
  Imin_cm4: number;
  appliedLoad_kN: number;
}

export interface BucklingCurvePoint {
  slenderness: number;
  eulerStress_MPa: number;
  designStress_MPa: number; // Crushing / Johnson Parabolic / Euler transition
}

export interface ColumnBucklingResult {
  K_theoretical: number;
  effectiveLength_m: number;
  radiusGyration_mm: number;
  slenderness: number; // KL / r
  criticalSlenderness: number; // sqrt(2 * pi^2 * E / fy)
  classification: 'short' | 'intermediate' | 'long';
  eulerCriticalLoad_kN: number;
  johnsonCriticalLoad_kN: number;
  crushingLoad_kN: number;
  governingCriticalLoad_kN: number;
  governingStress_MPa: number;
  appliedRatio: number; // appliedLoad / governingCriticalLoad
  isBuckled: boolean;
  modeShape: Array<{ yRatio: number; lateralNorm: number; inEffectiveWave: boolean }>;
  curve: BucklingCurvePoint[];
}

export function analyzeColumnBuckling(inp: ColumnBucklingInput): ColumnBucklingResult {
  const L_mm = Math.max(200, inp.length_m * 1000);
  const E_MPa = Math.max(1000, inp.E_GPa * 1000); // 1 GPa = 1000 MPa (N/mm^2)
  const fy = Math.max(20, inp.fy_MPa);
  const A_mm2 = Math.max(10, inp.area_cm2 * 100);
  const I_mm4 = Math.max(100, inp.Imin_cm4 * 1e4);

  let K = 1.0;
  if (inp.endCondition === 'pinned_pinned') K = 1.0;
  else if (inp.endCondition === 'fixed_fixed') K = 0.5;
  else if (inp.endCondition === 'fixed_pinned') K = 0.7; // exact 0.6992, standard IS/textbook ~0.70 / 1/sqrt(2)=0.707
  else if (inp.endCondition === 'fixed_free') K = 2.0;

  const Le_mm = K * L_mm;
  const r_mm = Math.sqrt(I_mm4 / A_mm2);
  const slenderness = Le_mm / r_mm;
  const criticalSlenderness = Math.sqrt((2 * Math.PI * Math.PI * E_MPa) / fy);

  const eulerCriticalLoad_N = (Math.PI * Math.PI * E_MPa * I_mm4) / (Le_mm * Le_mm);
  const eulerCriticalLoad_kN = eulerCriticalLoad_N * 1e-3;
  const crushingLoad_kN = (fy * A_mm2) * 1e-3;

  // Johnson parabolic formula for intermediate columns: sigma_cr = fy * (1 - (fy * lambda^2) / (4 * pi^2 * E))
  const johnsonStress = Math.max(
    0,
    fy * (1 - (fy * slenderness * slenderness) / (4 * Math.PI * Math.PI * E_MPa))
  );
  const johnsonCriticalLoad_kN = (johnsonStress * A_mm2) * 1e-3;

  let classification: ColumnBucklingResult['classification'] = 'long';
  let governingCriticalLoad_kN = eulerCriticalLoad_kN;
  if (slenderness < 15) {
    classification = 'short';
    governingCriticalLoad_kN = Math.min(crushingLoad_kN, johnsonCriticalLoad_kN);
  } else if (slenderness < criticalSlenderness) {
    classification = 'intermediate';
    governingCriticalLoad_kN = johnsonCriticalLoad_kN;
  } else {
    classification = 'long';
    governingCriticalLoad_kN = eulerCriticalLoad_kN;
  }

  const governingStress_MPa = (governingCriticalLoad_kN * 1e3) / A_mm2;
  const appliedRatio = inp.appliedLoad_kN / Math.max(1e-6, governingCriticalLoad_kN);

  // Mode shape s in [0, 1] from bottom (s=0) to top (s=1)
  const modeShape: ColumnBucklingResult['modeShape'] = [];
  const nPts = 80;
  let maxLat = 1e-9;
  const rawLat: number[] = [];

  for (let i = 0; i <= nPts; i++) {
    const s = i / nPts;
    let w = 0;
    if (inp.endCondition === 'pinned_pinned') {
      w = Math.sin(Math.PI * s);
    } else if (inp.endCondition === 'fixed_fixed') {
      w = 0.5 * (1 - Math.cos(2 * Math.PI * s));
    } else if (inp.endCondition === 'fixed_pinned') {
      // Bottom fixed (s=0: w=0, w'=0), top pinned (s=1: w=0)
      const kL = 4.4934094579;
      w = Math.cos(kL * s) - 1 + (Math.sin(kL * s) - kL * s) * ((1 - Math.cos(kL)) / (Math.sin(kL) - kL));
    } else {
      // fixed at bottom (s=0), free at top (s=1)
      w = 1 - Math.cos(0.5 * Math.PI * s);
    }
    rawLat.push(w);
    if (Math.abs(w) > maxLat) maxLat = Math.abs(w);
  }

  for (let i = 0; i <= nPts; i++) {
    const s = i / nPts;
    let inEff = true;
    if (inp.endCondition === 'fixed_fixed') {
      inEff = s >= 0.25 && s <= 0.75; // Half-sine wave between inflection points!
    } else if (inp.endCondition === 'fixed_pinned') {
      inEff = s >= 0.301 && s <= 1.0; // Inflection point at s ≈ 0.301 from fixed base!
    }
    modeShape.push({
      yRatio: s,
      lateralNorm: rawLat[i] / maxLat,
      inEffectiveWave: inEff,
    });
  }

  // Design curve lambda = 5 .. 220
  const curve: BucklingCurvePoint[] = [];
  for (let lam = 5; lam <= 220; lam += 5) {
    const sigEuler = (Math.PI * Math.PI * E_MPa) / (lam * lam);
    const sigDesign =
      lam <= criticalSlenderness
        ? fy * (1 - (fy * lam * lam) / (4 * Math.PI * Math.PI * E_MPa))
        : sigEuler;
    curve.push({
      slenderness: lam,
      eulerStress_MPa: Math.min(sigEuler, fy * 2.4),
      designStress_MPa: sigDesign,
    });
  }

  return {
    K_theoretical: K,
    effectiveLength_m: Le_mm / 1000,
    radiusGyration_mm: r_mm,
    slenderness,
    criticalSlenderness,
    classification,
    eulerCriticalLoad_kN,
    johnsonCriticalLoad_kN,
    crushingLoad_kN,
    governingCriticalLoad_kN,
    governingStress_MPa,
    appliedRatio,
    isBuckled: appliedRatio >= 1.0,
    modeShape,
    curve,
  };
}

// ============================================================================
// MULTI-SEGMENT CIRCULAR & HOLLOW SHAFT TORSION ENGINE (T/J = τ/r = Gθ/L)
// ============================================================================

export interface ShaftSegment {
  id: string;
  label: string;
  length_m: number;
  outerDia_mm: number;
  innerDia_mm: number; // 0 for solid shaft
  G_GPa: number; // Shear modulus (e.g. 80 GPa for steel)
  endTorque_kNm: number; // Concentrated external torque applied at right end of segment (+ CCW looking from right)
}

export interface ShaftSamplePoint {
  x_m: number;
  internalTorque_kNm: number;
  tauMax_MPa: number;
  twistDeg: number;
}

export interface ShaftAnalysisResult {
  totalLength_m: number;
  wallReactionTorque_kNm: number; // Left wall reaction at x = 0
  maxShearStress_MPa: number;
  maxTwistDeg: number;
  polarJFirst_cm4: number;
  weightSavingPercentFirst: number;
  powerAtRpm_kW: number;
  samples: ShaftSamplePoint[];
  segmentSummaries: Array<{
    id: string;
    label: string;
    xStart: number;
    xEnd: number;
    T_kNm: number;
    J_mm4: number;
    tauMax_MPa: number;
    deltaPhiDeg: number;
  }>;
}

export function analyzeShaftTorsion(segments: ShaftSegment[], rpm = 600): ShaftAnalysisResult {
  if (segments.length === 0) {
    return {
      totalLength_m: 0,
      wallReactionTorque_kNm: 0,
      maxShearStress_MPa: 0,
      maxTwistDeg: 0,
      polarJFirst_cm4: 0,
      weightSavingPercentFirst: 0,
      powerAtRpm_kW: 0,
      samples: [],
      segmentSummaries: [],
    };
  }

  // Left end (x = 0) fixed wall, right end free!
  // Internal torque T(x) in segment i equals sum of external torques from i to N-1!
  const n = segments.length;
  const segTorques = new Array<number>(n).fill(0);
  let runningT = 0;
  for (let i = n - 1; i >= 0; i--) {
    runningT += segments[i].endTorque_kNm;
    segTorques[i] = runningT;
  }

  const wallReactionTorque_kNm = -runningT;

  let xCursor = 0;
  let twistRad = 0;
  let maxShearStress_MPa = 0;
  let maxTwistDeg = 0;
  const samples: ShaftSamplePoint[] = [];
  const segmentSummaries: ShaftAnalysisResult['segmentSummaries'] = [];

  segments.forEach((seg, idx) => {
    const D = Math.max(10, seg.outerDia_mm);
    const d = Math.max(0, Math.min(D * 0.92, seg.innerDia_mm));
    const J_mm4 = (Math.PI / 32) * (Math.pow(D, 4) - Math.pow(d, 4));
    const G_MPa = Math.max(1000, seg.G_GPa * 1000);
    const L_mm = Math.max(50, seg.length_m * 1000);
    const T_Nmm = segTorques[idx] * 1e6;

    const tauMax = (Math.abs(T_Nmm) * (D / 2)) / J_mm4;
    const dPhiRad = (T_Nmm * L_mm) / (G_MPa * J_mm4);

    if (tauMax > maxShearStress_MPa) maxShearStress_MPa = tauMax;

    const subSteps = 20;
    for (let k = 0; k <= subSteps; k++) {
      const frac = k / subSteps;
      const x = xCursor + frac * seg.length_m;
      const phiDeg = ((twistRad + frac * dPhiRad) * 180) / Math.PI;
      if (Math.abs(phiDeg) > maxTwistDeg) maxTwistDeg = Math.abs(phiDeg);
      samples.push({
        x_m: x,
        internalTorque_kNm: segTorques[idx],
        tauMax_MPa: tauMax,
        twistDeg: phiDeg,
      });
    }

    segmentSummaries.push({
      id: seg.id,
      label: seg.label,
      xStart: xCursor,
      xEnd: xCursor + seg.length_m,
      T_kNm: segTorques[idx],
      J_mm4,
      tauMax_MPa: tauMax,
      deltaPhiDeg: (dPhiRad * 180) / Math.PI,
    });

    xCursor += seg.length_m;
    twistRad += dPhiRad;
  });

  const first = segments[0];
  const D0 = Math.max(10, first.outerDia_mm);
  const d0 = Math.max(0, Math.min(D0 * 0.92, first.innerDia_mm));
  const J0_cm4 = ((Math.PI / 32) * (Math.pow(D0, 4) - Math.pow(d0, 4))) * 1e-4;
  const weightSavingPercentFirst = ((d0 * d0) / (D0 * D0)) * 100;
  const maxAbsT_kNm = Math.max(...segTorques.map((t) => Math.abs(t)), 0);
  // P (kW) = 2 * pi * N * T(kN*m) / 60
  const powerAtRpm_kW = (2 * Math.PI * rpm * maxAbsT_kNm) / 60;

  return {
    totalLength_m: xCursor,
    wallReactionTorque_kNm,
    maxShearStress_MPa,
    maxTwistDeg,
    polarJFirst_cm4: J0_cm4,
    weightSavingPercentFirst,
    powerAtRpm_kW,
    samples,
    segmentSummaries,
  };
}
