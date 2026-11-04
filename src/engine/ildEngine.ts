import { BeamModel, BeamSupport, buildBeamFEM, analyzeBeam, BeamAnalysisResult } from './beamEngine';
import { luSolve, clamp } from './mathUtils';

export type ILDTargetType = 'reaction' | 'moment_reaction' | 'shear' | 'moment' | 'deflection';

export interface ILDTarget {
  type: ILDTargetType;
  supportId?: string; // for 'reaction' or 'moment_reaction'
  xSection?: number; // for 'shear', 'moment', 'deflection'
}

export interface ILDPoint {
  x: number; // position of 1 kN unit downward load (m)
  ordinate: number; // response per 1 kN load (kN/kN, kN*m/kN = m, or mm/kN)
  side?: 'left' | 'right' | 'continuous'; // for exact step jump at xSection in Shear ILD
}

export type VehicleType = 'unit' | 'single' | 'two_axle' | 'irc_train' | 'udl_patch';

export interface WheelAxle {
  offsetBehindLead: number; // m (>= 0; 0 is front/lead wheel)
  load_kN: number; // kN
  label: string;
}

export interface MovingVehicleConfig {
  type: VehicleType;
  singleLoad_kN: number;
  axle1_kN: number; // front wheel
  axle2_kN: number; // rear wheel
  wheelbase_m: number;
  udl_kNm: number;
  udlLength_m: number;
  reversed?: boolean;
}

export interface ActiveWheelContribution {
  label: string;
  x: number;
  load_kN: number;
  onBridge: boolean;
  ordinate: number;
  contribution: number;
}

export interface EnvelopePoint {
  xLead: number;
  totalResponse: number;
}

export interface MovingVehicleEvaluation {
  xLead: number;
  totalLength: number; // length of train/UDL
  totalResponse: number;
  unit: string;
  wheelContributions: ActiveWheelContribution[];
  udlSegmentOnBridge?: { x1: number; x2: number; areaOrdinate: number; contribution: number };
  envelope: EnvelopePoint[];
  criticalMaxPos: { xLead: number; value: number };
  criticalMaxNeg: { xLead: number; value: number };
  instantaneousBeam?: BeamAnalysisResult;
}

export interface ILDResult {
  isStable: boolean;
  isDeterminate: boolean;
  Ds: number;
  targetTitleEn: string;
  targetTitleHi: string;
  unit: string;
  xTarget: number;
  points: ILDPoint[];
  maxPos: { x: number; val: number };
  maxNeg: { x: number; val: number };
  positiveArea: number;
  negativeArea: number;
  netArea: number;
  mullerBreslauRuleEn: string;
  mullerBreslauRuleHi: string;
}

export function getVehicleAxles(cfg: MovingVehicleConfig): WheelAxle[] {
  if (cfg.type === 'unit') {
    return [{ offsetBehindLead: 0, load_kN: 1, label: '1 kN Unit' }];
  }
  if (cfg.type === 'single') {
    return [{ offsetBehindLead: 0, load_kN: cfg.singleLoad_kN, label: `${cfg.singleLoad_kN} kN` }];
  }
  if (cfg.type === 'two_axle') {
    const d = Math.max(0.2, cfg.wheelbase_m);
    const f = cfg.reversed ? cfg.axle2_kN : cfg.axle1_kN;
    const r = cfg.reversed ? cfg.axle1_kN : cfg.axle2_kN;
    return [
      { offsetBehindLead: 0, load_kN: f, label: `W₁ (${f} kN)` },
      { offsetBehindLead: d, load_kN: r, label: `W₂ (${r} kN)` },
    ];
  }
  if (cfg.type === 'irc_train') {
    const raw = [
      { offset: 0, load: 60, name: 'W₁' },
      { offset: 1.8, load: 110, name: 'W₂' },
      { offset: 3.3, load: 110, name: 'W₃' },
      { offset: 6.0, load: 80, name: 'W₄' },
    ];
    if (!cfg.reversed) {
      return raw.map((w) => ({
        offsetBehindLead: w.offset,
        load_kN: w.load,
        label: `${w.name}(${w.load}kN)`,
      }));
    }
    const maxOff = raw[raw.length - 1].offset;
    return [...raw]
      .reverse()
      .map((w, idx) => ({
        offsetBehindLead: +(maxOff - w.offset).toFixed(3),
        load_kN: w.load,
        label: `W${idx + 1}(${w.load}kN)`,
      }));
  }
  return [];
}

/**
 * Evaluates exact ILD ordinate at any load position xLoad in [0, L] by linear interpolation
 * on the precomputed high-resolution ILD curve (preserving left/right jump at xTarget).
 */
export function interpolateILD(points: ILDPoint[], xLoad: number, L: number, preferSide: 'left' | 'right' = 'right'): number {
  if (xLoad < -1e-6 || xLoad > L + 1e-6 || points.length === 0) return 0;
  const x = clamp(xLoad, 0, L);

  // Check exact match (handling Shear jump at xSection)
  const exactMatches = points.filter((p) => Math.abs(p.x - x) < 1e-4);
  if (exactMatches.length > 1) {
    return preferSide === 'left' ? exactMatches[0].ordinate : exactMatches[exactMatches.length - 1].ordinate;
  }
  if (exactMatches.length === 1) {
    return exactMatches[0].ordinate;
  }

  // Binary / bracket search
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (x >= p1.x && x <= p2.x && p2.x - p1.x > 1e-8) {
      const t = (x - p1.x) / (p2.x - p1.x);
      return p1.ordinate + t * (p2.ordinate - p1.ordinate);
    }
  }
  return points[points.length - 1].ordinate;
}

export function computeILD(baseModel: BeamModel, target: ILDTarget): ILDResult {
  const L = Math.max(0.5, baseModel.length);
  const cleanModel: BeamModel = {
    ...baseModel,
    // Zero out static loads & support settlements when computing pure Influence Line
    loads: [],
    supports: baseModel.supports.map((s) => ({ ...s, settlementMm: 0 })),
  };

  // Inject dummy zero point load at xSection so mesh is guaranteed to have an exact node right at xSection!
  const xSec = clamp(target.xSection ?? L * 0.5, 0.01 * L, 0.99 * L);
  if (target.type === 'shear' || target.type === 'moment' || target.type === 'deflection') {
    cleanModel.loads = [{ id: '__sec_node__', type: 'point', x: xSec, magnitude: 0 }];
  }

  const baseCheck = analyzeBeam(cleanModel);
  const fem = buildBeamFEM(cleanModel, 160);

  if (!fem.isStable || !baseCheck.isStable) {
    return {
      isStable: false,
      isDeterminate: baseCheck.Ds === 0,
      Ds: baseCheck.Ds,
      targetTitleEn: 'Unstable Structure',
      targetTitleHi: 'Unstable Structure',
      unit: '',
      xTarget: xSec,
      points: [],
      maxPos: { x: 0, val: 0 },
      maxNeg: { x: 0, val: 0 },
      positiveArea: 0,
      negativeArea: 0,
      netArea: 0,
      mullerBreslauRuleEn: '',
      mullerBreslauRuleHi: '',
    };
  }

  const { nodes, elements, totalDofs, K_beam, freeDofs, K_ff_lu, EI } = fem;

  // Map global DOF -> index in freeDofs (-1 if constrained)
  const dofToFreeIdx = new Int32Array(totalDofs).fill(-1);
  freeDofs.forEach((dof, idx) => {
    dofToFreeIdx[dof] = idx;
  });

  // Identify target support or section element
  let selectedSupport: BeamSupport | undefined;
  let supportLabel = 'A';
  if (target.type === 'reaction' || target.type === 'moment_reaction') {
    const sortedSups = [...cleanModel.supports].sort((a, b) => a.x - b.x);
    const idx = sortedSups.findIndex((s) => s.id === target.supportId);
    const useIdx = idx >= 0 ? idx : 0;
    selectedSupport = sortedSups[useIdx];
    supportLabel = selectedSupport?.label || String.fromCharCode(65 + useIdx);
  }

  const findNearestNodeIdx = (xVal: number): number => {
    let best = 0;
    let bestDist = Math.abs(nodes[0].x - xVal);
    for (let i = 1; i < nodes.length; i++) {
      const dist = Math.abs(nodes[i].x - xVal);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  const secNodeIdx = findNearestNodeIdx(xSec);
  const supNodeIdx = selectedSupport ? findNearestNodeIdx(selectedSupport.x) : 0;

  // Helper: evaluate target quantity when a 1 kN downward load acts at node `loadNodeIdx`
  // For shear at C when load is right AT node C, `loadJustLeftOfC` distinguishes x_C^- vs x_C^+!
  const evalAtNode = (loadNodeIdx: number, sideAtC: 'left' | 'right' | 'continuous'): number => {
    const loadDofV = nodes[loadNodeIdx].dofV;
    const freeIdx = dofToFreeIdx[loadDofV];

    const d = new Array<number>(totalDofs).fill(0);
    if (freeIdx >= 0) {
      const rhs = new Array<number>(freeDofs.length).fill(0);
      rhs[freeIdx] = -1.0; // 1 kN downward load
      const dFree = luSolve(K_ff_lu, rhs);
      for (let i = 0; i < freeDofs.length; i++) {
        d[freeDofs[i]] = dFree[i];
      }
    }

    if (target.type === 'reaction' && selectedSupport) {
      const nd = nodes[supNodeIdx];
      if (selectedSupport.type === 'spring') {
        const k = Math.max(0.001, selectedSupport.springK ?? 5000);
        return -k * d[nd.dofV];
      }
      let kd = 0;
      for (let j = 0; j < totalDofs; j++) kd += K_beam[nd.dofV][j] * d[j];
      const fExt = loadNodeIdx === supNodeIdx ? -1.0 : 0;
      return kd - fExt;
    }

    if (target.type === 'moment_reaction' && selectedSupport) {
      const nd = nodes[supNodeIdx];
      let kd = 0;
      for (let j = 0; j < totalDofs; j++) kd += K_beam[nd.dofThetaL][j] * d[j];
      return kd;
    }

    if (target.type === 'deflection') {
      return d[nodes[secNodeIdx].dofV] * 1000; // mm per kN
    }

    // For 'shear' or 'moment' at xSec:
    // Use element immediately to the RIGHT of secNodeIdx when load is strictly left of C (or sideAtC === 'left'),
    // and element immediately to the LEFT of secNodeIdx when load is strictly right of C (or sideAtC === 'right')
    // so the 1 kN load is NEVER ambiguously sitting on the cut!
    const useLeftElement =
      loadNodeIdx > secNodeIdx || (loadNodeIdx === secNodeIdx && sideAtC === 'right');

    if (useLeftElement && secNodeIdx > 0) {
      // Evaluate at right end (xi = Le) of element (secNodeIdx - 1)
      const el = elements[secNodeIdx - 1];
      const Le = el.L;
      const c = EI / (Le * Le * Le);
      const L2 = Le * Le;
      const de = el.dofs.map((idx) => d[idx]);
      // fint at node 2 (right end): row 2 is Fy2, row 3 is M2
      const fint2 = -12 * c * de[0] - 6 * Le * c * de[1] + 12 * c * de[2] - 6 * Le * c * de[3];
      const fint3 = 6 * Le * c * de[0] + 2 * L2 * c * de[1] - 6 * Le * c * de[2] + 4 * L2 * c * de[3];
      // At right face of element: downward force on right face = +Shear => V = -fint2; CCW moment on right face = +Sagging => M = +fint3
      return target.type === 'shear' ? -fint2 : fint3;
    } else if (secNodeIdx < elements.length) {
      // Evaluate at left end (xi = 0) of element secNodeIdx
      const el = elements[secNodeIdx];
      const Le = el.L;
      const c = EI / (Le * Le * Le);
      const L2 = Le * Le;
      const de = el.dofs.map((idx) => d[idx]);
      const fint0 = 12 * c * de[0] + 6 * Le * c * de[1] - 12 * c * de[2] + 6 * Le * c * de[3];
      const fint1 = 6 * Le * c * de[0] + 4 * L2 * c * de[1] - 6 * Le * c * de[2] + 2 * L2 * c * de[3];
      return target.type === 'shear' ? fint0 : -fint1;
    }
    return 0;
  };

  const points: ILDPoint[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const x = nodes[i].x;
    if (target.type === 'shear' && i === secNodeIdx && i > 0 && i < nodes.length - 1) {
      const ordLeft = evalAtNode(i, 'left');
      const ordRight = evalAtNode(i, 'right');
      points.push({ x, ordinate: Math.abs(ordLeft) < 1e-8 ? 0 : ordLeft, side: 'left' });
      points.push({ x, ordinate: Math.abs(ordRight) < 1e-8 ? 0 : ordRight, side: 'right' });
    } else {
      const ord = evalAtNode(i, 'continuous');
      points.push({ x, ordinate: Math.abs(ord) < 1e-8 ? 0 : ord, side: 'continuous' });
    }
  }

  // Stats: extrema & areas
  let maxPos = { x: 0, val: 0 };
  let maxNeg = { x: 0, val: 0 };
  let positiveArea = 0;
  let negativeArea = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.ordinate > maxPos.val) maxPos = { x: p.x, val: p.ordinate };
    if (p.ordinate < maxNeg.val) maxNeg = { x: p.x, val: p.ordinate };

    if (i > 0) {
      const pPrev = points[i - 1];
      const dx = p.x - pPrev.x;
      if (dx > 1e-8) {
        const y1 = pPrev.ordinate;
        const y2 = p.ordinate;
        if (y1 >= 0 && y2 >= 0) {
          positiveArea += 0.5 * (y1 + y2) * dx;
        } else if (y1 <= 0 && y2 <= 0) {
          negativeArea += 0.5 * (y1 + y2) * dx;
        } else {
          // Crosses zero
          const xZero = (dx * Math.abs(y1)) / (Math.abs(y1) + Math.abs(y2));
          if (y1 > 0) {
            positiveArea += 0.5 * y1 * xZero;
            negativeArea += 0.5 * y2 * (dx - xZero);
          } else {
            negativeArea += 0.5 * y1 * xZero;
            positiveArea += 0.5 * y2 * (dx - xZero);
          }
        }
      }
    }
  }

  let targetTitleEn = '';
  let targetTitleHi = '';
  let unit = 'kN/kN';
  let xTarget = xSec;
  let mbEn = '';
  let mbHi = '';

  const shapeNoteEn =
    baseCheck.Ds === 0
      ? 'Because the structure is Statically Determinate (Ds = 0), releasing one restraint creates a rigid-body mechanism, so ALL segments of the ILD are STRAIGHT LINES!'
      : `Because the structure is Statically Indeterminate (Ds = ${baseCheck.Ds}), releasing one restraint leaves a stable elastic beam, so the ILD consists of SMOOTH CUBIC ELASTIC CURVES!`;

  const shapeNoteHi =
    baseCheck.Ds === 0
      ? 'Kyunki beam Determinate (Ds = 0) hai, restraint hatane par beam bina mude seedhi tilt hoti hai, isliye ILD bilkul SEEDHI LINES (Straight Lines) banta hai!'
      : `Kyunki beam Indeterminate (Ds = ${baseCheck.Ds}) hai, ek restraint hatane par bhi beam mudi hui rehti hai, isliye ILD CURVED (mudavdaar) banta hai!`;

  if (target.type === 'reaction') {
    xTarget = selectedSupport?.x ?? 0;
    unit = 'kN / kN';
    targetTitleEn = `ILD for Vertical Support Reaction R${supportLabel} (at x = ${xTarget.toFixed(2)} m)`;
    targetTitleHi = `Support Reaction R${supportLabel} ka ILD (x = ${xTarget.toFixed(2)} m par)`;
    mbEn = `Müller-Breslau Rule: Remove vertical restraint at Support ${supportLabel} and lift it upward by +1 unit. The resulting deflected shape of the beam IS the exact ILD for R_${supportLabel}! ${shapeNoteEn}`;
    mbHi = `Müller-Breslau Trick: Support ${supportLabel} ka vertical lock hatao aur jack se +1 unit upar uthao! Beam jis shape mein uthegi, WAHI R${supportLabel} ka ILD hai! ${shapeNoteHi}`;
  } else if (target.type === 'moment_reaction') {
    xTarget = selectedSupport?.x ?? 0;
    unit = 'kN·m / kN';
    targetTitleEn = `ILD for Fixed-End Moment Reaction M${supportLabel} (at x = ${xTarget.toFixed(2)} m)`;
    targetTitleHi = `Fixed Moment Reaction M${supportLabel} ka ILD`;
    mbEn = `Müller-Breslau Rule: Replace the fixed support at ${supportLabel} with a pin and apply a unit rotation Δθ = 1 rad. The deflected shape gives the ILD for M_${supportLabel}! ${shapeNoteEn}`;
    mbHi = `Müller-Breslau Trick: Fixed support ${supportLabel} par pin lagao aur 1 rad ghumao, jo deflected curve aayega wahi M_${supportLabel} ka ILD hai! ${shapeNoteHi}`;
  } else if (target.type === 'shear') {
    unit = 'kN / kN';
    targetTitleEn = `ILD for Shear Force VC at Section C (x = ${xSec.toFixed(2)} m)`;
    targetTitleHi = `Section C (x = ${xSec.toFixed(2)} m) par Shear Force VC ka ILD`;
    mbEn = `Müller-Breslau Rule: Cut section C with a parallel guided-roller slide (allowing vertical slip Δv = 1 unit while keeping left & right slopes EQUAL!). Notice the exact total step jump of 1.0 at x = ${xSec.toFixed(2)} m! ${shapeNoteEn}`;
    mbHi = `Müller-Breslau Trick: Section C ko kaat kar aisi roller-slide lagao ki dono siray parallel rahein (slope barabar!) aur +1 unit upar-neeche khiskein! Dekho C par hamesha 1.0 ka jump aata hai! ${shapeNoteHi}`;
  } else if (target.type === 'moment') {
    unit = 'kN·m / kN (m)';
    targetTitleEn = `ILD for Bending Moment MC at Section C (x = ${xSec.toFixed(2)} m)`;
    targetTitleHi = `Section C (x = ${xSec.toFixed(2)} m) par Bending Moment MC ka ILD`;
    mbEn = `Müller-Breslau Rule: Insert an internal hinge at Section C and apply unit relative rotation Δθ = θL - θR = 1 rad! For a simply supported span L, peak ordinate is a·b/L. ${shapeNoteEn}`;
    mbHi = `Müller-Breslau Trick: Section C par ek Internal Hinge (kabza) lagao aur upar ki taraf unit kink (1 rad relative angle) do! Jo tent jaisa shape banega, wahi MC ka ILD hai! ${shapeNoteHi}`;
  } else {
    unit = 'mm / kN';
    targetTitleEn = `ILD for Deflection δC at Section C (x = ${xSec.toFixed(2)} m)`;
    targetTitleHi = `Section C (x = ${xSec.toFixed(2)} m) par Deflection δC ka ILD (Maxwell Theorem)`;
    mbEn =
      'Maxwell-Betti Reciprocal Theorem: Deflection at C due to a 1 kN load at X equals the deflection at X due to a 1 kN load fixed at C!';
    mbHi =
      'Maxwell Reciprocal Theorem ka jadoo: X par 1 kN rakhne se C jitna jhukega = C par 1 kN rakhne se X jitna jhukega!';
  }

  return {
    isStable: true,
    isDeterminate: baseCheck.Ds === 0,
    Ds: baseCheck.Ds,
    targetTitleEn,
    targetTitleHi,
    unit,
    xTarget,
    points,
    maxPos,
    maxNeg,
    positiveArea,
    negativeArea,
    netArea: positiveArea + negativeArea,
    mullerBreslauRuleEn: mbEn,
    mullerBreslauRuleHi: mbHi,
  };
}

/**
 * Evaluates a moving vehicle / wheel series / UDL patch at current lead position xLead,
 * plus computes the full travel envelope and exact critical position for Max +ve and Max -ve effect!
 */
export function evaluateMovingVehicle(
  baseModel: BeamModel,
  ild: ILDResult,
  vehicle: MovingVehicleConfig,
  xLead: number,
  computeInstantBeam = true
): MovingVehicleEvaluation {
  const L = Math.max(0.5, baseModel.length);
  const axles = getVehicleAxles(vehicle);
  const totalLength =
    vehicle.type === 'udl_patch'
      ? Math.max(0.2, vehicle.udlLength_m)
      : axles.length > 0
      ? axles[axles.length - 1].offsetBehindLead
      : 0;

  const evalSinglePosition = (leadPos: number, sideHint: 'left' | 'right' = 'right'): number => {
    if (vehicle.type === 'udl_patch') {
      const x1 = Math.max(0, leadPos - totalLength);
      const x2 = Math.min(L, leadPos);
      if (x2 <= x1 + 1e-6) return 0;
      // Integrate ILD from x1 to x2 via 60-subinterval trapezoidal rule
      const nSub = 60;
      const dx = (x2 - x1) / nSub;
      let area = 0;
      let prevY = interpolateILD(ild.points, x1, L, 'right');
      for (let i = 1; i <= nSub; i++) {
        const xi = x1 + i * dx;
        const currY = interpolateILD(ild.points, xi, L, i === nSub ? 'left' : 'right');
        area += 0.5 * (prevY + currY) * dx;
        prevY = currY;
      }
      return area * vehicle.udl_kNm;
    } else {
      let sum = 0;
      for (const ax of axles) {
        const wx = leadPos - ax.offsetBehindLead;
        if (wx >= -1e-6 && wx <= L + 1e-6) {
          const ord = interpolateILD(ild.points, wx, L, sideHint);
          sum += ax.load_kN * ord;
        }
      }
      return sum;
    }
  };

  // Sweep candidate lead positions (dense grid + exact wheel-on-target alignments!)
  const candidateLeads: Array<{ xLead: number; side: 'left' | 'right' }> = [];
  const totalTravel = L + totalLength;
  const steps = 220;
  for (let i = 0; i <= steps; i++) {
    candidateLeads.push({ xLead: (totalTravel * i) / steps, side: 'right' });
  }
  // Exact critical alignments: each wheel placed right at xTarget (both left & right of Shear jump!) and at maxPos/maxNeg!
  const keyBridgeXs = [0, L, ild.xTarget, ild.maxPos.x, ild.maxNeg.x];
  for (const ax of axles) {
    for (const bx of keyBridgeXs) {
      candidateLeads.push({ xLead: bx + ax.offsetBehindLead - 1e-4, side: 'left' });
      candidateLeads.push({ xLead: bx + ax.offsetBehindLead + 1e-4, side: 'right' });
      candidateLeads.push({ xLead: bx + ax.offsetBehindLead, side: 'right' });
    }
  }
  candidateLeads.sort((a, b) => a.xLead - b.xLead);

  let criticalMaxPos = { xLead: 0, value: 0 };
  let criticalMaxNeg = { xLead: 0, value: 0 };
  const envelope: EnvelopePoint[] = [];

  for (const cand of candidateLeads) {
    if (cand.xLead < -1e-5 || cand.xLead > totalTravel + 1e-5) continue;
    const val = evalSinglePosition(cand.xLead, cand.side);
    if (val > criticalMaxPos.value) criticalMaxPos = { xLead: cand.xLead, value: val };
    if (val < criticalMaxNeg.value) criticalMaxNeg = { xLead: cand.xLead, value: val };
    if (envelope.length === 0 || cand.xLead - envelope[envelope.length - 1].xLead >= totalTravel / 240) {
      envelope.push({ xLead: cand.xLead, totalResponse: val });
    }
  }

  // Current position breakdown
  const wheelContributions: ActiveWheelContribution[] = axles.map((ax) => {
    const wx = xLead - ax.offsetBehindLead;
    const onBridge = wx >= -1e-5 && wx <= L + 1e-5;
    const ordinate = onBridge ? interpolateILD(ild.points, wx, L, 'right') : 0;
    return {
      label: ax.label,
      x: wx,
      load_kN: ax.load_kN,
      onBridge,
      ordinate,
      contribution: onBridge ? ax.load_kN * ordinate : 0,
    };
  });

  let udlSegmentOnBridge: MovingVehicleEvaluation['udlSegmentOnBridge'];
  let totalResponse = 0;

  if (vehicle.type === 'udl_patch') {
    const x1 = Math.max(0, xLead - totalLength);
    const x2 = Math.min(L, xLead);
    if (x2 > x1 + 1e-5) {
      totalResponse = evalSinglePosition(xLead, 'right');
      udlSegmentOnBridge = {
        x1,
        x2,
        areaOrdinate: vehicle.udl_kNm !== 0 ? totalResponse / vehicle.udl_kNm : 0,
        contribution: totalResponse,
      };
    }
  } else {
    totalResponse = wheelContributions.reduce((acc, w) => acc + w.contribution, 0);
  }

  // Output engineering unit (multiply kN by ILD unit)
  let outUnit = 'kN';
  if (ild.unit.includes('kN·m')) outUnit = 'kN·m';
  else if (ild.unit.includes('mm')) outUnit = 'mm';

  // Instantaneous SFD & BMD of the bridge for current vehicle position!
  let instantaneousBeam: BeamAnalysisResult | undefined;
  if (computeInstantBeam) {
    const liveLoads: BeamModel['loads'] = [];
    if (vehicle.type === 'udl_patch' && udlSegmentOnBridge) {
      liveLoads.push({
        id: 'moving_udl',
        type: 'udl',
        xStart: udlSegmentOnBridge.x1,
        xEnd: udlSegmentOnBridge.x2,
        magnitude: vehicle.udl_kNm,
      });
    } else {
      wheelContributions.forEach((wc, idx) => {
        if (wc.onBridge) {
          liveLoads.push({
            id: `wheel_${idx}`,
            type: 'point',
            x: clamp(wc.x, 0, L),
            magnitude: wc.load_kN,
          });
        }
      });
    }
    instantaneousBeam = analyzeBeam({
      ...baseModel,
      supports: baseModel.supports.map((s) => ({ ...s, settlementMm: 0 })),
      loads: liveLoads,
    });
  }

  return {
    xLead,
    totalLength,
    totalResponse,
    unit: outUnit,
    wheelContributions,
    udlSegmentOnBridge,
    envelope,
    criticalMaxPos,
    criticalMaxNeg,
    instantaneousBeam,
  };
}
