import { Node2D, Member2D, Structure2DModel, NodeSupport2D } from './frameTrussEngine';

/* ------------------------------------------------------------------ */
/*  Parametric generator, build a whole structure from a few numbers  */
/* ------------------------------------------------------------------ */

export type ParametricKind = 'portal' | 'storey' | 'warren' | 'roof' | 'hoarding';

export interface ParametricSpec {
  kind: ParametricKind;
  bays: number; // panels / bays
  bayWidth_m: number;
  height_m: number;
  rise_m: number; // roof rise only
  load_kN: number; // per loaded joint (downward)
  wind_kN: number; // lateral load at top
  brace: boolean;
}

export const DEFAULT_SPEC: ParametricSpec = {
  kind: 'portal',
  bays: 2,
  bayWidth_m: 4,
  height_m: 3.5,
  rise_m: 1.2,
  load_kN: 20,
  wind_kN: 10,
  brace: true,
};

const L = (i: number) => String.fromCharCode(65 + (i % 26));

function node(id: string, label: string, x: number, y: number, support: NodeSupport2D, fy = 0, fx = 0): Node2D {
  return { id, label, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, support, fy, fx };
}

function member(id: string, label: string, a: string, b: string, extra: Partial<Member2D> = {}): Member2D {
  return { id, label, startNodeId: a, endNodeId: b, E_GPa: 200, A_cm2: 40, I_cm4: 8000, wPerp_kNm: 0, ...extra };
}

export function buildParametric(spec: ParametricSpec): Structure2DModel {
  const bw = Math.max(0.5, spec.bayWidth_m);
  const h = Math.max(0.5, spec.height_m);
  const n = Math.max(1, Math.min(6, Math.round(spec.bays)));
  const nodes: Node2D[] = [];
  const members: Member2D[] = [];
  const span = bw * n;

  if (spec.kind === 'portal' || spec.kind === 'hoarding') {
    // columns at every grid line, beams along the top
    for (let i = 0; i <= n; i++) {
      const x = i * bw;
      const base = node(`b${i}`, `${L(i)}${i === 0 ? '' : `′`}`, x, 0, spec.kind === 'hoarding' && i > 0 ? 'pin' : 'fixed');
      const top = node(`t${i}`, `${L(i)}${i === 0 ? '' : `″`}`, x, h, 'free');
      nodes.push(base, top);
      members.push(member(`c${i}`, `C${i + 1}`, base.id, top.id, { I_cm4: 12000, A_cm2: 60 }));
    }
    for (let i = 0; i < n; i++) {
      members.push(member(`g${i}`, `G${i + 1}`, `t${i}`, `t${i + 1}`, { I_cm4: 12000, A_cm2: 60, wPerp_kNm: 0 }));
    }
    // gravity on the top joints
    for (let i = 0; i <= n; i++) {
      const t = nodes.find((x) => x.id === `t${i}`)!;
      t.fy = -Math.abs(spec.load_kN);
    }
    // lateral wind + optional bracing
    const last = nodes.find((x) => x.id === `t${n}`)!;
    last.fx = Math.abs(spec.wind_kN);
    if (spec.brace && n >= 1) {
      members.push(member('br0', 'BR', 'b0', 't0', { A_cm2: 24, I_cm4: 3000 }));
    }
    if (spec.kind === 'hoarding') {
      // two rails + panel diagonals to look like a hoarding
      for (let i = 0; i < n; i++) {
        members.push(member(`r${i}`, `R${i + 1}`, `c${i}`, `t${i + 1}`));
      }
    }
    return {
      nameEn: spec.kind === 'hoarding' ? `${n}-bay hoarding frame` : `${n}-bay portal frame`,
      nameHi: spec.kind === 'hoarding' ? `${n}-bay hoarding frame` : `${n}-bay portal frame`,
      mode: 'frame',
      nodes,
      members,
    };
  }

  if (spec.kind === 'storey') {
    const storeys = Math.max(1, Math.min(4, Math.round(spec.height_m / 3) || 2));
    const sh = h / storeys;
    for (let s = 0; s <= storeys; s++) {
      for (let i = 0; i <= n; i++) {
        const sup: NodeSupport2D = s === 0 ? 'fixed' : 'free';
        const nd = node(`n${s}_${i}`, `${L(i)}${s}`, i * bw, s * sh, sup);
        if (s === storeys) nd.fy = -Math.abs(spec.load_kN);
        if (s === storeys && i === n) nd.fx = Math.abs(spec.wind_kN);
        nodes.push(nd);
      }
    }
    for (let s = 0; s <= storeys; s++) {
      for (let i = 0; i <= n; i++) {
        if (s < storeys) members.push(member(`c${s}_${i}`, `C${s}${i}`, `n${s}_${i}`, `n${s + 1}_${i}`, { I_cm4: 12000, A_cm2: 60 }));
        if (i < n) members.push(member(`b${s}_${i}`, `B${s}${i}`, `n${s}_${i}`, `n${s}_${i + 1}`, { I_cm4: 12000, A_cm2: 60 }));
      }
    }
    if (spec.brace) {
      for (let s = 0; s < storeys; s++) members.push(member(`x${s}`, `X${s}`, `n${s}_0`, `n${s + 1}_0`, { A_cm2: 24, I_cm4: 3000 }));
    }
    return { nameEn: `${storeys}-storey ${n}-bay frame`, nameHi: `${storeys}-storey ${n}-bay frame`, mode: 'frame', nodes, members };
  }

  // ---------------- pitched roof truss (king/post style, always determinate) ----------------
  if (spec.kind === 'roof') {
    const rise = Math.max(0.4, spec.rise_m);
    const yAt = (x: number) => Math.max(0.25, rise * (1 - Math.abs((x / span) * 2 - 1)));
    for (let i = 0; i <= n; i++) {
      nodes.push(node(`bot${i}`, `B${i}`, i * bw, 0, i === 0 ? 'pin' : i === n ? 'roller_x' : 'free'));
    }
    for (let i = 1; i <= n - 1; i++) {
      nodes.push(node(`top${i}`, `T${i}`, i * bw, yAt(i * bw), 'free', -Math.abs(spec.load_kN)));
    }
    for (let i = 0; i < n; i++) members.push(member(`bc${i}`, `BC${i}`, `bot${i}`, `bot${i + 1}`, { A_cm2: 26, I_cm4: 2200 }));
    // rafter chain from the left support up to the ridge and down to the right support
    let prev = 'bot0';
    for (let i = 1; i <= n - 1; i++) {
      members.push(member(`rfL${i}`, `RL${i}`, prev, `top${i}`, { A_cm2: 22, I_cm4: 1800 }));
      prev = `top${i}`;
    }
    members.push(member('rfR', 'RR', prev, `bot${n}`, { A_cm2: 22, I_cm4: 1800 }));
    // verticals + diagonals
    for (let i = 1; i <= n - 1; i++) {
      members.push(member(`v${i}`, `V${i}`, `bot${i}`, `top${i}`, { A_cm2: 18, I_cm4: 1200 }));
    }
    for (let i = 1; i <= n - 2; i++) {
      members.push(member(`dg${i}`, `D${i}`, `top${i}`, `bot${i + 1}`, { A_cm2: 18, I_cm4: 1200 }));
    }
    const wind = nodes.find((x) => x.id === `top${Math.floor(n / 2)}`);
    if (wind) wind.fx = Math.abs(spec.wind_kN) * 0.5;
    return {
      nameEn: `${n}-panel pitched roof truss`,
      nameHi: `${n}-panel pitched roof truss`,
      mode: 'truss',
      nodes,
      members,
    };
  }

  // ---------------- flat Warren truss ----------------
  for (let i = 0; i <= n; i++) {
    const x = i * bw;
    nodes.push(node(`bot${i}`, `B${i}`, x, 0, i === 0 ? 'pin' : i === n ? 'roller_x' : 'free', -Math.abs(spec.load_kN) / 2));
  }
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * bw;
    nodes.push(node(`top${i}`, `T${i}`, x, h, 'free', -Math.abs(spec.load_kN) / 2));
  }
  const hTop = nodes.find((x) => x.id === 'top0');
  if (hTop) hTop.fx = Math.abs(spec.wind_kN) * 0.6;

  for (let i = 0; i < n; i++) {
    members.push(member(`bc${i}`, `BC${i}`, `bot${i}`, `bot${i + 1}`, { A_cm2: 24, I_cm4: 2000 }));
  }
  // top chord links the apexes so every panel is a closed triangle (m = 2j − 3 exactly)
  for (let i = 0; i < n - 1; i++) {
    members.push(member(`tc${i}`, `TC${i}`, `top${i}`, `top${i + 1}`, { A_cm2: 24, I_cm4: 2000 }));
  }
  for (let i = 0; i < n; i++) {
    members.push(member(`dl${i}`, `D${i}a`, `bot${i}`, `top${i}`, { A_cm2: 20, I_cm4: 1500 }));
    members.push(member(`dr${i}`, `D${i}b`, `top${i}`, `bot${i + 1}`, { A_cm2: 20, I_cm4: 1500 }));
  }
  return {
    nameEn: `${n}-panel Warren truss`,
    nameHi: `${n}-panel Warren truss`,
    mode: 'truss',
    nodes,
    members,
  };
}

export const PARAMETRIC_PRESETS: Array<{ id: ParametricKind; label: string; hint: string }> = [
  { id: 'portal', label: 'Portal frame', hint: 'Columns fixed at base, beams on top, the standard industrial shed' },
  { id: 'storey', label: 'Multi-storey frame', hint: 'Storeys = round(height / 3 m); wind at roof level' },
  { id: 'warren', label: 'Warren truss', hint: 'Flat Warren bridge girder, zig-zag diagonals' },
  { id: 'roof', label: 'Pitched roof truss', hint: 'Raised centre chord, classic workshop roof' },
  { id: 'hoarding', label: 'Hoarding / wall panel', hint: 'Cantilever column panel with rails and bracing' },
];
