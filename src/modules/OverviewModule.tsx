import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Compass,
  EyeOff,
  GraduationCap,
  Layers,
  LayoutDashboard,
  MousePointerClick,
  Network,
  Pause,
  Play,
  Search,
  Send,
  SlidersHorizontal,
  Target,
  Truck,
  Waves,
  Zap,
} from 'lucide-react';
import { BEAM_PRESETS, STRUCTURE_2D_PRESETS } from '../engine/presets';
import { analyzeCrossSection, analyzeMohrCircle, analyzeColumnBuckling, SectionDimensions } from '../engine/sectionMohrBucklingEngine';
import type { ColumnEndCondition } from '../engine/sectionMohrBucklingEngine';
import { computeILD, interpolateILD } from '../engine/ildEngine';
import type { ILDTargetType } from '../engine/ildEngine';
import { findSection, NAMED_SECTIONS } from '../engine/sectionLib';
import { useAnalysis } from '../ui/AnalysisContext';
import { Badge, Btn, Card, Slider, fmt } from '../ui/primitives';

/* ------------------------------------------------------------------ */
/*  Concept stages the professor can put on screen                     */
/* ------------------------------------------------------------------ */

type SceneId = 'beam' | 'frame' | 'ild' | 'section' | 'mohr' | 'column';

const SCENES: Array<{ id: SceneId; label: string; icon: React.ReactNode; hue: string }> = [
  { id: 'beam', label: 'Beam', icon: <Activity className="w-3.5 h-3.5" />, hue: 'var(--accent)' },
  { id: 'frame', label: 'Frame', icon: <Network className="w-3.5 h-3.5" />, hue: 'var(--sagging)' },
  { id: 'ild', label: 'Truck', icon: <Truck className="w-3.5 h-3.5" />, hue: 'var(--warn)' },
  { id: 'section', label: 'Fibres', icon: <Layers className="w-3.5 h-3.5" />, hue: 'var(--tension)' },
  { id: 'mohr', label: 'Mohr', icon: <Compass className="w-3.5 h-3.5" />, hue: 'var(--hogging)' },
  { id: 'column', label: 'Column', icon: <Columns3 className="w-3.5 h-3.5" />, hue: '#0369a1' },
];

/* ------------------------------------------------------------------ */
/*  Scene 1, live beam, SFD and BMD                                   */
/* ------------------------------------------------------------------ */

const BeamScene: React.FC<{ L: number; res: ReturnType<typeof import('../engine/beamEngine').analyzeBeam>; hideValues?: boolean }> = ({ L, res, hideValues }) => {
  const W = 720;
  const originX = 58;
  const usable = W - originX * 2;
  const px = (x: number) => originX + (Math.max(0, Math.min(L, x)) / L) * usable;
  const beamY = 128;
  const baseV = 238;
  const baseM = 344;
  const maxV = Math.max(1e-6, res.maxAbsV);
  const maxM = Math.max(1e-6, res.maxAbsM);
  const sfd = res.points.map((p) => `${px(p.x).toFixed(1)},${(baseV - (p.V / maxV) * 30).toFixed(1)}`).join(' ');
  const bmd = res.points.map((p) => `${px(p.x).toFixed(1)},${(baseM - (p.M / maxM) * 30).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} 380`} className="w-full block" aria-label="Live beam, shear force and bending moment preview">
      {/* subtitles sit in reserved bands, not on top of the curves */}
      <text x={originX} y={14} fontSize={9} fontWeight={800} fill="var(--ink-3)" letterSpacing="1.4">SFD (kN)</text>
      <text x={W - originX} y={14} fontSize={9} fontWeight={800} fill="var(--ink-3)" letterSpacing="1.4" textAnchor="end">BMD (kN·m)</text>

      {/* datum lines */}
      {[baseV, baseM].map((y, i) => (
        <g key={i}>
          <line x1={originX} y1={y} x2={W - originX} y2={y} stroke="var(--line-strong)" strokeWidth={0.8} opacity={0.8} />
          <text x={originX - 6} y={y + 3} fontSize={8} textAnchor="end" fill="var(--ink-3)" fontWeight={700}>0</text>
        </g>
      ))}

      {/* SFD area */}
      <polygon points={`${originX},${baseV} ${sfd} ${W - originX},${baseV}`} fill="var(--accent)" opacity={0.12} />
      <polyline points={sfd} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" className="reel-draw" />

      {/* BMD area */}
      <polygon points={`${originX},${baseM} ${bmd} ${W - originX},${baseM}`} fill="var(--sagging)" opacity={0.13} />
      <polyline points={bmd} fill="none" stroke="var(--sagging)" strokeWidth={2} strokeLinejoin="round" className="reel-draw" />

      {/* beam */}
      <rect x={originX} y={beamY - 5} width={usable} height={10} rx={2} fill="var(--ink)" opacity={0.9} />
      {[0, L].map((x, i) => (
        <g key={i}>
          <polygon points={`${px(x)},${beamY + 7} ${px(x) - 9},${beamY + 19} ${px(x) + 9},${beamY + 19}`} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.5} />
          <line x1={px(x) - 11} y1={beamY + 19} x2={px(x) + 11} y2={beamY + 19} stroke="var(--ink)" strokeWidth={1.5} />
          <text x={px(x)} y={beamY - 12} fontSize={10} fontWeight={800} textAnchor="middle" fill="var(--ink)">{i === 0 ? 'A' : 'B'}</text>
        </g>
      ))}
      <DeflectCurve px={px} L={L} y={beamY + 18} amp={22} />
      <text x={originX} y={beamY + 52} fontSize={8.5} fill="var(--ink-3)" fontWeight={600}>exaggerated elastic curve</text>

      {/* load arrow */}
      <g>
        <line x1={px(L / 2)} y1={36} x2={px(L / 2)} y2={beamY - 9} stroke="var(--compression)" strokeWidth={2.4} />
        <polygon points={`${px(L / 2)},${beamY - 2} ${px(L / 2) - 5},${beamY - 14} ${px(L / 2) + 5},${beamY - 14}`} fill="var(--compression)" />
        <text x={px(L / 2) + 7} y={48} fontSize={10} fontWeight={800} fill="var(--compression)">P</text>
      </g>

      {/* knife sweeping across the span */}
      <g>
        <line x1={px(L / 2)} y1={22} x2={px(L / 2)} y2={baseM + 30} stroke="var(--warn)" strokeWidth={0.9} strokeDasharray="3 4" opacity={0.75} />
        <circle cx={px(L / 2)} cy={beamY} r={4.5} fill="var(--warn)" stroke="var(--surface)" strokeWidth={1.4} />
        <animateTransform attributeName="transform" type="translate" values={`${-px(L / 2) + originX + 18} 0; ${W - originX - px(L / 2) - 18} 0; ${-px(L / 2) + originX + 18} 0`} dur="9s" repeatCount="indefinite" />
      </g>

      {/* peak callouts, clear of the curve */}
      <text x={W - originX} y={baseV - 36} fontSize={9.5} textAnchor="end" fontWeight={800} fill="var(--accent)">|V|max {hideValues ? '•••' : fmt(res.maxAbsV, 1)} kN</text>
      <text x={W - originX} y={baseM - 38} fontSize={9.5} textAnchor="end" fontWeight={800} fill="var(--sagging)">|M|max {hideValues ? '•••' : fmt(res.maxAbsM, 1)} kN·m</text>
    </svg>
  );
};

const DeflectCurve: React.FC<{ px: (x: number) => number; L: number; y: number; amp: number }> = ({ px, L, y, amp }) => {
  const n = 24;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const x = (i / n) * L;
    const s = Math.sin((Math.PI * x) / L);
    return `${px(x).toFixed(1)},${(y + s * amp).toFixed(1)}`;
  }).join(' ');
  return <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1.7} strokeDasharray="5 4" opacity={0.9} />;
};

/* ------------------------------------------------------------------ */
/*  Scene 2, portal frame with sway                                   */
/* ------------------------------------------------------------------ */

const FrameScene: React.FC = () => {
  const { structRes: r, struct: st } = useAnalysis();
  const present = st.members.filter((m) => st.nodes.some((n) => n.id === m.startNodeId) && st.nodes.some((n) => n.id === m.endNodeId));
  const maxX = Math.max(...st.nodes.map((n) => n.x), 1);
  const maxY = Math.max(...st.nodes.map((n) => n.y), 1);
  const ox = 160;
  const oy = 318;
  const sc = Math.min(330 / maxX, 236 / Math.max(1, maxY));
  const P = (x: number, y: number) => ({ x: ox + x * sc, y: oy - y * sc });

  return (
    <svg viewBox="0 0 720 380" className="w-full block" aria-label="Portal frame deformation preview">
      <text x={58} y={14} fontSize={9} fontWeight={800} fill="var(--ink-3)" letterSpacing="1.4">FRAME · SWAY</text>

      {/* ghost of the undeformed frame */}
      {present.map((m) => {
        const a = st.nodes.find((n) => n.id === m.startNodeId)!;
        const b = st.nodes.find((n) => n.id === m.endNodeId)!;
        const p1 = P(a.x, a.y);
        const p2 = P(b.x, b.y);
        return <line key={`g${m.id}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--line-strong)" strokeWidth={1.3} strokeDasharray="5 5" />;
      })}

      {/* swaying deformed trace */}
      <g className="frame-sway">
        {present.map((m) => {
          const a = st.nodes.find((n) => n.id === m.startNodeId)!;
          const b = st.nodes.find((n) => n.id === m.endNodeId)!;
          const p1 = P(a.x, a.y);
          const p2 = P(b.x, b.y);
          const horizontal = Math.abs(a.y - b.y) < 0.05;
          const cx = (p1.x + p2.x) / 2 + (horizontal ? 0 : 10);
          const cy = (p1.y + p2.y) / 2 - (horizontal ? 16 : 0);
          return (
            <path
              key={`d${m.id}`}
              d={`M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`}
              fill="none"
              stroke="var(--sagging)"
              strokeWidth={2.4}
              strokeLinecap="round"
              opacity={0.8}
            />
          );
        })}
      </g>

      {/* coloured members + joints */}
      {r.members.map((m) => {
        const md = st.members.find((x) => x.id === m.id)!;
        if (!md) return null;
        const a = st.nodes.find((n) => n.id === md.startNodeId)!;
        const b = st.nodes.find((n) => n.id === md.endNodeId)!;
        const p1 = P(a.x, a.y);
        const p2 = P(b.x, b.y);
        const col = m.state === 'tension' ? 'var(--tension)' : m.state === 'compression' ? 'var(--compression)' : 'var(--ink-3)';
        return <line key={m.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={col} strokeWidth={3.4} strokeLinecap="round" />;
      })}

      {st.nodes.map((n) => {
        const p = P(n.x, n.y);
        return (
          <g key={n.id}>
            {n.support === 'fixed' ? (
              <>
                <line x1={p.x - 15} y1={p.y + 10} x2={p.x + 15} y2={p.y + 10} stroke="var(--ink-2)" strokeWidth={2} />
                {[-11, -4, 3, 10].map((d, i) => (
                  <line key={i} x1={p.x + d} y1={p.y + 10} x2={p.x + d - 4} y2={p.y + 17} stroke="var(--ink-2)" strokeWidth={1.2} />
                ))}
              </>
            ) : n.support === 'free' ? null : (
              <polygon points={`${p.x},${p.y + 5} ${p.x - 7},${p.y + 15} ${p.x + 7},${p.y + 15}`} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.5} />
            )}
            <rect x={p.x - 4} y={p.y - 4} width={8} height={8} rx={1.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.2} />
            <text x={p.x + 8} y={p.y - 8} fontSize={10} fontWeight={800} fill="var(--ink)">{n.label}</text>
          </g>
        );
      })}

      {/* wind arrows */}
      <g>
        {[0, 1, 2].map((i) => (
          <g key={i} className="wind-pulse" style={{ animationDelay: `${i * 0.25}s` }}>
            <line x1={38} y1={110 + i * 34} x2={92} y2={110 + i * 34} stroke="var(--warn)" strokeWidth={1.6} />
            <polygon points={`${92},${110 + i * 34} ${84},${106 + i * 34} ${84},${114 + i * 34}`} fill="var(--warn)" />
          </g>
        ))}
        <text x={38} y={92} fontSize={8.5} fontWeight={800} fill="var(--warn)">wind / sway</text>
      </g>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Scene 3, Mohr circle                                              */
/* ------------------------------------------------------------------ */

const MohrScene: React.FC<{ s1: number; s2: number; tau: number; center: number; radius: number; hideValues?: boolean }> = ({ s1, s2, tau, center, radius, hideValues }) => {
  const cx = 380;
  const cy = 186;
  // draw a stable, readable circle: a wide stress range must not push the circle
  // off the stage, and a tiny one must not collapse to a dot
  const drawR = Math.min(126, Math.max(26, radius * 0.85));
  return (
    <svg viewBox="0 0 720 380" className="w-full block" aria-label="Mohr circle preview">
      <text x={58} y={14} fontSize={9} fontWeight={800} fill="var(--ink-3)" letterSpacing="1.4">MOHR · LIVE σ-τ</text>
      <line x1={cx - 170} y1={cy} x2={cx + 170} y2={cy} stroke="var(--line-strong)" strokeWidth={1} />
      <line x1={cx} y1={cy - 154} x2={cx} y2={cy + 154} stroke="var(--line-strong)" strokeWidth={1} />

      <circle cx={cx} cy={cy} r={drawR} fill="color-mix(in srgb, var(--accent) 8%, transparent)" stroke="var(--accent)" strokeWidth={2} className="reel-glow" />

      {/* rotating diameter, one degree on the element = two on the circle */}
      <g className="mohr-spin" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cx - drawR} y1={cy} x2={cx + drawR} y2={cy} stroke="var(--warn)" strokeWidth={1.4} strokeDasharray="4 3" />
        <circle cx={cx + drawR} cy={cy} r={4} fill="var(--warn)" />
      </g>

      {/* principal markers */}
      <circle cx={cx - drawR} cy={cy} r={4.5} fill="var(--hogging)" stroke="var(--surface)" strokeWidth={1.4} />
      <circle cx={cx + drawR} cy={cy} r={4.5} fill="var(--sagging)" stroke="var(--surface)" strokeWidth={1.4} />
      <text x={cx - drawR - 8} y={cy - 12} fontSize={10} fontWeight={800} fill="var(--hogging)" textAnchor="end">σ₂ {hideValues ? '•••' : fmt(s2, 1)}</text>
      <text x={cx + drawR + 8} y={cy - 12} fontSize={10} fontWeight={800} fill="var(--sagging)">σ₁ {hideValues ? '•••' : fmt(s1, 1)}</text>
      <text x={cx} y={cy - drawR - 10} fontSize={9.5} fontWeight={800} fill="var(--warn)" textAnchor="middle">τmax {hideValues ? '•••' : fmt(tau, 1)} MPa</text>
      <text x={cx} y={cy + drawR + 18} fontSize={9} fontWeight={700} fill="var(--ink-3)" textAnchor="middle">centre σavg = {hideValues ? '•••' : fmt(center, 1)} MPa</text>

      {/* stress element */}
      <g transform={`translate(${92},${cy - 46})`}>
        <rect x={0} y={0} width={78} height={78} rx={2} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.5} />
        <line x1={39} y1={-14} x2={39} y2={78} stroke="var(--line-strong)" strokeWidth={0.8} strokeDasharray="3 3" />
        {[[-14, 0, -8, 0], [0, -14, 0, -8], [0, 92, 0, 86], [92, 0, 86, 0]].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--warn)" strokeWidth={1.5} />
        ))}
        <text x={39} y={104} fontSize={8} textAnchor="middle" fill="var(--ink-3)">stress element</text>
      </g>
      <text x={630} y={cy + drawR + 44} fontSize={8.5} textAnchor="end" fill="var(--ink-3)" fontStyle="italic">diameter turns 2θ</text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Scene 4, section fibre stress                                     */
/* ------------------------------------------------------------------ */

const SectionScene: React.FC<{ dims: SectionDimensions; maxT: number; maxC: number; hideValues?: boolean }> = ({ dims, maxT, maxC, hideValues }) => {
  const isCirc = dims.shape === 'circular' || dims.shape === 'hollow_circular';
  const H = isCirc ? dims.outerDia_mm : dims.depth_mm;
  const B = isCirc ? dims.outerDia_mm : dims.width_mm;
  const scale = 190 / Math.max(1, H);
  const w = B * scale;
  const h = H * scale;
  const x0 = 190 - w / 2;
  const y0 = 72;
  const strips = 26;
  return (
    <svg viewBox="0 0 720 380" className="w-full block" aria-label="Section stress gradient preview">
      <text x={58} y={14} fontSize={9} fontWeight={800} fill="var(--ink-3)" letterSpacing="1.4">FIBRES · σ(y)</text>
      {/* I-section silhouette */}
      <g>
        <rect x={x0} y={y0} width={w} height={h} rx={2} fill="var(--surface-3)" stroke="var(--ink-2)" strokeWidth={1.6} />
        {!isCirc && (
          <>
            <rect x={x0 + w * 0.34} y={y0 + h * 0.16} width={w * 0.32} height={h * 0.68} fill="var(--canvas)" stroke="var(--ink-2)" strokeWidth={1.1} />
          </>
        )}
        {isCirc && <circle cx={x0 + w / 2} cy={y0 + h / 2} r={w * 0.34} fill="var(--canvas)" stroke="var(--ink-2)" strokeWidth={1.1} strokeDasharray="4 3" />}
      </g>

      {/* stress gradient strips */}
      {Array.from({ length: strips }).map((_, i) => {
        const yy = y0 + (i / strips) * h;
        const f = 1 - (2 * i) / strips;
        const col = f > 0 ? `color-mix(in srgb, var(--tension) ${18 + 66 * f}%, transparent)` : `color-mix(in srgb, var(--compression) ${18 + 66 * -f}%, transparent)`;
        return <rect key={i} x={280} y={yy} width={Math.max(6, Math.abs(f) * 90)} height={h / strips} fill={col} />;
      })}
      {/* profile line: tension right, compression left */}
      <line x1={280} y1={y0} x2={280} y2={y0 + h} stroke="var(--ink-3)" strokeWidth={1} />
      <line x1={280 + 90} y1={y0} x2={280 + 90} y2={y0 + h} stroke="var(--line)" strokeWidth={1} strokeDasharray="4 4" />
      <line x1={280 - 90} y1={y0 + h / 2} x2={280 + 90} y2={y0 + h / 2} stroke="var(--line-strong)" strokeWidth={1} strokeDasharray="5 4" />
      <text x={280} y={y0 + h / 2 - 6} fontSize={8.5} textAnchor="middle" fill="var(--ink-3)" fontWeight={700}>NA</text>
      <text x={280 + 96} y={y0 + 10} fontSize={9} fill="var(--tension)" fontWeight={800}>+σt {hideValues ? '•••' : fmt(maxT, 1)}</text>
      <text x={280 - 96} y={y0 + h - 4} fontSize={9} fill="var(--compression)" fontWeight={800} textAnchor="end">−σc {hideValues ? '•••' : fmt(maxC, 1)}</text>

      {/* probe sweeping down the depth */}
      <g>
        <line x1={280 - 100} y1={y0 + h * 0.5} x2={280 + 110} y2={y0 + h * 0.5} stroke="var(--warn)" strokeWidth={1.2} className="probe-sweep" />
        <circle cx={280 + 45} cy={y0 + h * 0.5} r={4} fill="var(--warn)" className="probe-sweep" />
      </g>
      <text x={620} y={y0 + 18} fontSize={9} fill="var(--ink-3)" fontWeight={700}>σ = N/A − M·y/I</text>
      <text x={620} y={y0 + 34} fontSize={9} fill="var(--ink-3)" fontWeight={700}>τ = VQ / I·b</text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Scene 5, column buckling                                          */
/* ------------------------------------------------------------------ */

const ColumnScene: React.FC<{ lambda: number; pcr: number; columnLength: number; k: number; hideValues?: boolean }> = ({ lambda, pcr, columnLength, k, hideValues }) => (
  <svg viewBox="0 0 720 380" className="w-full block" aria-label="Column buckling preview">
    <text x={58} y={14} fontSize={9} fontWeight={800} fill="var(--ink-3)" letterSpacing="1.4">COLUMN · Leff = K·L</text>
    {[
      { k: 2, x: 160 },
      { k: 1, x: 310 },
      { k: 0.7, x: 460 },
      { k: 0.5, x: 610 },
    ].map((c, i) => {
      const top = 80;
      const bot = 292;
      const amp = i === 1 ? 30 : 20;
      const d = `M ${c.x} ${bot} C ${c.x - amp} ${bot - 62}, ${c.x + amp} ${top + 62}, ${c.x} ${top}`;
      return (
        <g key={c.k}>
          <line x1={c.x} y1={top} x2={c.x} y2={bot} stroke="var(--line-strong)" strokeWidth={1.1} strokeDasharray="4 4" />
          <path d={d} fill="none" stroke={i === 1 ? 'var(--accent)' : 'var(--ink-3)'} strokeWidth={i === 1 ? 3 : 2.2} strokeLinecap="round">
            {i === 1 && (
              <animate
                attributeName="d"
                dur="4.5s"
                repeatCount="indefinite"
                values={`${d};M ${c.x} ${bot} C ${c.x - amp * 1.65} ${bot - 62}, ${c.x + amp * 1.65} ${top + 62}, ${c.x} ${top};${d}`}
              />
            )}
          </path>
          <line x1={c.x - 22} y1={bot + 3} x2={c.x + 22} y2={bot + 3} stroke="var(--ok)" strokeWidth={2.4} />
          {c.k !== 2 && <line x1={c.x - 20} y1={top - 3} x2={c.x + 20} y2={top - 3} stroke="var(--ok)" strokeWidth={2} />}
          <text x={c.x} y={top - 16} fontSize={10} textAnchor="middle" fontWeight={800} fill={i === 1 ? 'var(--accent)' : 'var(--ink-2)'}>K = {c.k}</text>
          <text x={c.x} y={bot + 24} fontSize={9} textAnchor="middle" fill="var(--ink-3)" fontWeight={700}>Leff {(columnLength * c.k).toFixed(2)} m</text>
        </g>
      );
    })}
    <text x={58} y={348} fontSize={9.5} fontWeight={700} fill="var(--ink-3)">current · K = {fmt(k, 2)} · λ = {hideValues ? '•••' : fmt(lambda, 0)} → Pcr = {hideValues ? '•••' : fmt(pcr, 0)} kN</text>
    <text x={662} y={348} fontSize={9.5} fontWeight={700} fill="var(--warn)" textAnchor="end">longer → weaker</text>
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Scene 6 - truck on the bridge, with the influence line underneath  */
/* ------------------------------------------------------------------ */

const IldScene: React.FC<{
  L: number;
  points: Array<{ x: number; ordinate: number }>;
  xTarget: number;
  maxPos: { x: number; val: number };
  unit: string;
  effectUnit: string;
  pos: number;
  effect: number;
  targetLabel: string;
  hideValues?: boolean;
}> = ({ L, points, xTarget, maxPos, unit, effectUnit, pos, effect, targetLabel, hideValues }) => {
  const W = 720;
  const padL = 54;
  const usable = W - padL * 2;
  const X = (x: number) => padL + (Math.max(0, Math.min(L, x)) / Math.max(0.1, L)) * usable;
  const deckY = 118;
  const baseY = 306;
  const amp = 96;
  const maxAbs = Math.max(1e-9, Math.max(Math.abs(maxPos.val), ...points.map((p) => Math.abs(p.ordinate))));
  const curve = points.map((p) => `${X(p.x).toFixed(1)},${(baseY - (p.ordinate / maxAbs) * amp).toFixed(1)}`).join(' ');
  const area = `${X(0)},${baseY} ${curve} ${X(L)},${baseY}`;
  const wheelbase = 3;
  const rawX = (x: number) => padL + (x / Math.max(0.1, L)) * usable;
  const truckX = rawX(pos);
  const rearX = rawX(pos - wheelbase);
  const frontOn = pos >= -1e-9 && pos <= L + 1e-9;
  const rearOn = pos - wheelbase >= -1e-9 && pos - wheelbase <= L + 1e-9;

  return (
    <svg viewBox="0 0 720 380" className="w-full block" aria-label="Truck on a bridge with its influence line">
      <text x={padL} y={14} fontSize={9} fontWeight={800} fill="var(--ink-3)" letterSpacing="1.4">BRIDGE · TRUCK POSITION</text>
      <text x={W - padL} y={14} fontSize={9} fontWeight={800} fill="var(--warn)" textAnchor="end" letterSpacing="1.2">{targetLabel.toUpperCase()}</text>

      {/* deck and supports */}
      <line x1={padL} y1={deckY} x2={W - padL} y2={deckY} stroke="var(--ink)" strokeWidth={4} />
      <path d={`M${padL} ${deckY} l-9 15 h18 z`} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.3} />
      <path d={`M${W - padL} ${deckY} l-9 15 h18 z`} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.3} />
      <line x1={padL - 14} y1={deckY + 18} x2={padL + 14} y2={deckY + 18} stroke="var(--ink-2)" strokeWidth={1.2} />
      <line x1={W - padL - 14} y1={deckY + 18} x2={W - padL + 14} y2={deckY + 18} stroke="var(--ink-2)" strokeWidth={1.2} />
      {/* section where the effect is measured */}
      <line x1={X(xTarget)} y1={deckY + 22} x2={X(xTarget)} y2={baseY + 10} stroke="var(--sagging)" strokeWidth={1.1} strokeDasharray="4 4" />
      <circle cx={X(xTarget)} cy={deckY} r={3.4} fill="var(--sagging)" stroke="var(--surface)" strokeWidth={1.2} />
      <text x={X(xTarget) + 7} y={deckY + 32} fontSize={9.5} fontWeight={800} fill="var(--sagging)">section</text>

      {/* two axle truck. The chassis spans the real 3 m wheelbase, so both wheels
          sit where the solver puts them, not as a decorative icon. */}
      <g>
        <line x1={rearX} y1={deckY - 11} x2={truckX} y2={deckY - 11} stroke="var(--warn)" strokeWidth={2.4} />
        <rect x={Math.min(rearX, truckX) + 4} y={deckY - 34} width={Math.max(26, Math.abs(truckX - rearX) - 14)} height={22} rx={3} fill="var(--warn)" opacity={0.85} />
        <rect x={truckX - 19} y={deckY - 30} width={17} height={17} rx={2} fill="var(--warn)" opacity={0.55} />
        <line x1={rearX} y1={deckY - 10} x2={rearX} y2={deckY} stroke="var(--compression)" strokeWidth={2} />
        <line x1={truckX} y1={deckY - 10} x2={truckX} y2={deckY} stroke="var(--compression)" strokeWidth={2} />
        <circle cx={rearX} cy={deckY - 6} r={5.5} fill="var(--ink)" />
        <circle cx={truckX} cy={deckY - 6} r={5.5} fill="var(--ink)" />
        {rearOn && <text x={rearX} y={deckY - 40} fontSize={8.5} fontWeight={800} fill="var(--warn)" textAnchor="middle">120 kN</text>}
        {frontOn && <text x={truckX} y={deckY - 40} fontSize={8.5} fontWeight={800} fill="var(--warn)" textAnchor="middle">60 kN</text>}
        <text x={(rearX + truckX) / 2} y={deckY - 58} fontSize={8} fontWeight={700} fill="var(--ink-3)" textAnchor="middle">3 m wheelbase</text>
      </g>
      <line x1={truckX} y1={deckY - 44} x2={X(pos)} y2={baseY} stroke="var(--warn)" strokeWidth={0.9} strokeDasharray="3 5" opacity={0.55} />

      {/* influence line */}
      <polygon points={area} fill="var(--accent)" opacity={0.1} />
      <polyline points={curve} fill="none" stroke="var(--accent)" strokeWidth={2.1} strokeLinejoin="round" />
      <line x1={padL} y1={baseY} x2={W - padL} y2={baseY} stroke="var(--line-strong)" strokeWidth={0.8} />
      <text x={padL} y={baseY + 13} fontSize={8.5} fill="var(--ink-3)" fontWeight={700}>0</text>
      <text x={W - padL} y={baseY + 13} fontSize={8.5} fill="var(--ink-3)" fontWeight={700} textAnchor="end">{hideValues ? '•••' : `${fmt(L, 1)} m`}</text>

      {/* current ordinate */}
      <circle cx={X(pos)} cy={baseY - (interpolateILD(points, pos, L) / maxAbs) * amp} r={4} fill="var(--warn)" stroke="var(--surface)" strokeWidth={1.4} />
      <text x={X(pos) + 8} y={baseY - (interpolateILD(points, pos, L) / maxAbs) * amp + 15} fontSize={9} fontWeight={800} fill="var(--warn)">
        {hideValues ? 'η = •••' : `η = ${fmt(interpolateILD(points, pos, L), 2)}`}
      </text>

      {/* peak */}
      <circle cx={X(maxPos.x)} cy={baseY - (maxPos.val / maxAbs) * amp} r={3.2} fill="var(--accent)" />
      <text x={X(maxPos.x)} y={baseY - (maxPos.val / maxAbs) * amp - 24} fontSize={9} fontWeight={800} fill="var(--accent)" textAnchor="middle">
        {hideValues ? 'peak •••' : `peak ${fmt(maxPos.val, 2)} ${unit}`}
      </text>

      <text x={padL} y={372} fontSize={9.5} fontWeight={700} fill="var(--ink-3)">
        effect now = {hideValues ? '•••' : fmt(effect, 2)} {effectUnit}
      </text>
      <text x={W - padL} y={372} fontSize={9.5} fontWeight={700} fill="var(--warn)" textAnchor="end">move the truck, watch η</text>
    </svg>
  );
};



/* ------------------------------------------------------------------ */
/*  Small lab previews used by the module grid                         */
/* ------------------------------------------------------------------ */

const Mini: React.FC<{ kind: string }> = ({ kind }) => {
  const common = { fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 260 96" className="w-full block" aria-hidden>
      {kind === 'beam' && (
        <>
          <line x1="18" y1="54" x2="242" y2="54" stroke="var(--ink)" strokeWidth="4" />
          <path d="M40 60 L34 70 M40 60 L46 70 M210 60 L204 70 M210 60 L216 70" stroke="var(--ink-2)" strokeWidth="1.5" />
          <line x1="130" y1="16" x2="130" y2="48" stroke="var(--compression)" strokeWidth="2" />
          <path d="M130 48 L125 40 L135 40 Z" fill="var(--compression)" />
          <path d="M18 54 Q130 76 242 54" {...common} stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="4 3" />
          <path d="M18 72 L73 72 L187 72 L242 72" {...common} stroke="var(--accent)" strokeWidth="1" opacity="0.3" />
          <path d="M18 92 L73 92 L130 68 L187 92 L242 92" {...common} stroke="var(--sagging)" strokeWidth="1.8" />
        </>
      )}
      {kind === 'frame' && (
        <>
          <path d="M50 84 V24 H210 V84" {...common} stroke="var(--accent)" strokeWidth="3" />
          <path d="M50 84 L42 90 M50 84 L58 90 M210 84 L202 90 M210 84 L218 90" stroke="var(--ink-2)" strokeWidth="1.4" />
          <path d="M50 84 V24 H210 V84" {...common} stroke="var(--sagging)" strokeWidth="1.6" strokeDasharray="4 3" transform="translate(5 0)" opacity="0.8" />
          <path d="M50 24 Q130 42 210 24" {...common} stroke="var(--sagging)" strokeWidth="1.4" opacity="0.7" />
          <line x1="20" y1="30" x2="38" y2="30" stroke="var(--warn)" strokeWidth="1.5" />
          <path d="M38 30 L32 27 L32 33 Z" fill="var(--warn)" />
          <line x1="130" y1="10" x2="130" y2="20" stroke="var(--compression)" strokeWidth="1.5" />
        </>
      )}
      {kind === 'ild' && (
        <>
          <line x1="18" y1="72" x2="242" y2="72" stroke="var(--ink)" strokeWidth="3" />
          <path d="M18 72 L130 20 L242 72" {...common} stroke="var(--accent)" strokeWidth="2" />
          <path d="M18 72 L130 20 L242 72 Z" fill="var(--accent)" opacity="0.1" />
          <rect x="91" y="56" width="26" height="11" rx="2" fill="var(--warn)" />
          <circle cx="97" cy="69" r="3" fill="var(--warn)" />
          <circle cx="111" cy="69" r="3" fill="var(--warn)" />
          <line x1="130" y1="20" x2="130" y2="86" stroke="var(--warn)" strokeWidth="0.8" strokeDasharray="3 3" />
        </>
      )}
      {kind === 'section' && (
        <>
          <path d="M32 18 H96 V34 H72 V66 H96 V82 H32 V66 H56 V34 H32 Z" fill="var(--surface-3)" stroke="var(--ink-2)" strokeWidth="1.4" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={140} y={18 + i * 11} width={90 - i * 12} height={10} fill={i < 3 ? 'var(--compression)' : 'var(--tension)'} opacity={0.22 + i * 0.1} />
          ))}
          <line x1="140" y1="51" x2="230" y2="51" stroke="var(--ink-3)" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="140" y1="18" x2="140" y2="84" stroke="var(--ink-3)" strokeWidth="0.8" />
        </>
      )}
      {kind === 'mohr' && (
        <>
          <circle cx="130" cy="50" r="32" {...common} stroke="var(--accent)" strokeWidth="1.8" />
          <line x1="82" y1="50" x2="178" y2="50" stroke="var(--ink-3)" strokeWidth="0.8" />
          <line x1="130" y1="12" x2="130" y2="88" stroke="var(--ink-3)" strokeWidth="0.8" />
          <line x1="98" y1="50" x2="162" y2="50" stroke="var(--warn)" strokeWidth="1.4" />
          <circle cx="98" cy="50" r="3" fill="var(--hogging)" />
          <circle cx="162" cy="50" r="3" fill="var(--sagging)" />
          <path d="M130 50 L156 32" stroke="var(--warn)" strokeWidth="1.3" />
        </>
      )}
      {kind === 'buckling' && (
        <>
          <line x1="70" y1="86" x2="190" y2="86" stroke="var(--ink)" strokeWidth="2" />
          <line x1="70" y1="10" x2="70" y2="86" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 3" />
          <path d="M70 86 C40 58 100 38 70 10" {...common} stroke="var(--accent)" strokeWidth="2.6" />
          <line x1="58" y1="86" x2="82" y2="86" stroke="var(--ok)" strokeWidth="2" />
          <line x1="58" y1="10" x2="82" y2="10" stroke="var(--ok)" strokeWidth="2" />
          <text x="208" y="36" fontSize="9" fill="var(--ink-3)" fontWeight="700">K·L</text>
          <path d="M198 44 Q188 50 198 56" {...common} stroke="var(--warn)" strokeWidth="1.2" />
        </>
      )}
      {kind === 'atlas' && (
        <>
          <circle cx="70" cy="52" r="12" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
          <circle cx="142" cy="26" r="9" fill="none" stroke="var(--sagging)" strokeWidth="1.6" />
          <circle cx="168" cy="72" r="9" fill="none" stroke="var(--warn)" strokeWidth="1.6" />
          <circle cx="210" cy="38" r="7" fill="none" stroke="var(--hogging)" strokeWidth="1.6" />
          <line x1="80" y1="46" x2="133" y2="30" stroke="var(--line-strong)" strokeWidth="1.2" />
          <line x1="80" y1="58" x2="159" y2="69" stroke="var(--line-strong)" strokeWidth="1.2" />
          <line x1="151" y1="30" x2="203" y2="36" stroke="var(--line-strong)" strokeWidth="1.2" />
          <line x1="175" y1="65" x2="204" y2="44" stroke="var(--line-strong)" strokeWidth="1.2" />
          <text x="70" y="86" fontSize="9" textAnchor="middle" fill="var(--ink-3)" fontWeight="700">22 ideas · your numbers</text>
        </>
      )}
      {kind === 'guide' && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <circle cx={42 + i * 58} cy={48} r={13} fill={i < 2 ? 'var(--accent)' : 'var(--surface-3)'} stroke="var(--line-strong)" strokeWidth="1" />
              <text x={42 + i * 58} y={52} fontSize="9" textAnchor="middle" fontWeight="800" fill={i < 2 ? '#fff' : 'var(--ink-3)'}>{i + 1}</text>
              {i < 3 && <line x1={55 + i * 58} y1={48} x2={87 + i * 58} y2={48} stroke="var(--line-strong)" strokeWidth="1.4" strokeDasharray="3 3" />}
            </g>
          ))}
          <text x="130" y="82" fontSize="9" textAnchor="middle" fill="var(--ink-3)" fontWeight="700">build → solve → explain</text>
        </>
      )}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Lecture console: stage, controls and teaching notes                */
/* ------------------------------------------------------------------ */

type Lesson = {
  title: string;
  hook: string;
  board: string;
  ask: string;
  mistake: string;
  cues: string[];
  formula: string;
};

const LESSONS: Record<SceneId, { hi: Lesson; en: Lesson }> = {
  beam: {
    hi: {
      title: 'Load se SFD, SFD se BMD',
      hook: 'Slab ka load pehle shear banata hai, phir moment. Support ke paas shear zyada, beech me moment zyada.',
      board: 'Point load ke neeche SFD me jump kyun aata hai?',
      ask: 'Load ko support ke paas le jayein to max moment kya hoga?',
      mistake: 'SFD ka area BMD nahi hota. BMD ka slope shear hota hai. Sign convention sabse zyada galti yahin hoti hai.',
      cues: ['Reaction upar', 'Load par SFD jump', 'M max jahan V zero'],
      formula: 'dV/dx = -w  ·  dM/dx = V',
    },
    en: {
      title: 'Load to SFD, SFD to BMD',
      hook: 'The slab load becomes shear first, then moment. Shear is high near supports, moment is high near midspan.',
      board: 'Why does the SFD jump at a point load?',
      ask: 'Move the load toward a support. What happens to the peak moment?',
      mistake: 'The SFD area is not the BMD. The slope of the BMD is the shear. Most sign errors start here.',
      cues: ['Reaction acts up', 'SFD jumps at load', 'M peaks where V is zero'],
      formula: 'dV/dx = -w  ·  dM/dx = V',
    },
  },
  frame: {
    hi: {
      title: 'Frame load ko kaise baant-ta hai',
      hook: 'Building me slab se beam, beam se column, column se footing. Rigid joint moment bhi utaar-ta hai.',
      board: 'Portal frame ke beam ends par hogging moment kyun hota hai?',
      ask: 'Lateral load badhao. Kaunsa column tension me jaata hai?',
      mistake: 'Truss joint moment nahi le sakta, frame le sakta hai. Member table se state check karo.',
      cues: ['Blue tension, red compression', 'Sway right', 'Grey member zero force'],
      formula: 'K u = F  ·  M = EI d²v/dx²',
    },
    en: {
      title: 'How a frame shares the load',
      hook: 'Slab to beam, beam to column, column to footing. A rigid joint carries moment as well as force.',
      board: 'Why do the beam ends of a portal frame carry hogging moment?',
      ask: 'Increase the lateral load. Which column goes into tension?',
      mistake: 'A truss joint cannot carry moment, a frame joint can. Check the member state table.',
      cues: ['Blue tension, red compression', 'Sway to the right', 'Grey member carries zero force'],
      formula: 'K u = F  ·  M = EI d²v/dx²',
    },
  },
  ild: {
    hi: {
      title: 'Truck ke har position ka effect',
      hook: 'Bridge par truck chalta hai, section par moment badalta rehta hai. ILD har position ka answer pehle se draw karta hai.',
      board: 'Truck kis position par midspan moment maximum dega?',
      ask: 'Do axle aage peeche hain. Kya dono ka peak ek hi waqt aayega?',
      mistake: 'ILD fixed load ka diagram nahi hai. Ye 1 kN unit load ka effect batata hai.',
      cues: ['Truck position', 'ILD ordinate η', 'P times η superposition'],
      formula: 'Effect = Σ P η(x)',
    },
    en: {
      title: 'One truck, every position',
      hook: 'As the truck crosses, the section moment keeps changing. The influence line already holds the answer for every position.',
      board: 'Where should the truck stand for maximum midspan moment?',
      ask: 'The two axles are apart. Do both peaks occur at the same instant?',
      mistake: 'An influence line is not a fixed-load diagram. It is the effect of a 1 kN unit load.',
      cues: ['Truck position', 'ILD ordinate η', 'Superposition P times η'],
      formula: 'Effect = Σ P η(x)',
    },
  },
  section: {
    hi: {
      title: 'Section ke andar stress',
      hook: 'I-beam ka flange bending jhelta hai, patla web shear. Isi liye shape I jaisa hota hai.',
      board: 'Neutral axis par normal stress kitna hota hai?',
      ask: 'Depth double kar dein to section modulus kaise badlega?',
      mistake: 'σ = My/I me y neutral axis se naapo, top se nahi.',
      cues: ['Compression top', 'Tension bottom', 'τ max at neutral axis'],
      formula: 'σ = My/I  ·  τ = VQ/(Ib)',
    },
    en: {
      title: 'Stress inside the section',
      hook: 'The flange carries bending, the thin web carries shear. That is why an I-beam looks like an I.',
      board: 'What is the normal stress on the neutral axis?',
      ask: 'Double the depth. How does the section modulus change?',
      mistake: 'In σ = My/I, y is measured from the neutral axis, not from the top.',
      cues: ['Compression on top', 'Tension at bottom', 'τ peaks at the neutral axis'],
      formula: 'σ = My/I  ·  τ = VQ/(Ib)',
    },
  },
  mohr: {
    hi: {
      title: 'Stress ko circle me dekho',
      hook: 'Ek hi stress state ko alag planes par dekho. Circle ghoomta hai, principal stresses wahi rehte hain.',
      board: 'Circle ka radius kis stress ko dikhata hai?',
      ask: 'Pure shear me principal planes 45° par kyun hote hain?',
      mistake: 'Circle par angle 2θ hota hai, θ nahi. Isi liye 90° circle par 45° element ke barabar hai.',
      cues: ['Center = average stress', 'Radius = τmax', '90° on circle = 45° on element'],
      formula: 'σ1,2 = (σx + σy)/2 ± R',
    },
    en: {
      title: 'See the stress as a circle',
      hook: 'Look at one stress state on different planes. The circle turns, the principal stresses stay the same.',
      board: 'What does the radius of the circle represent?',
      ask: 'Why are principal planes at 45° in pure shear?',
      mistake: 'The circle uses 2θ, not θ. That is why 90° on the circle matches 45° on the element.',
      cues: ['Center = average stress', 'Radius = τmax', '90° on circle = 45° on element'],
      formula: 'σ1,2 = (σx + σy)/2 ± R',
    },
  },
  column: {
    hi: {
      title: 'Column length se tootta hai',
      hook: 'Same section, same material. Sirf length ya end condition badlo, critical load badal jaata hai.',
      board: 'Length double karne par Pcr kitna bachega?',
      ask: 'Fixed-fixed column pin-pin se kitna strong hai?',
      mistake: 'Slenderness λ = Le/r hota hai, sirf L/r nahi.',
      cues: ['K 0.5 se 2 tak', 'Leff = K L', 'Euler long, Johnson intermediate'],
      formula: 'Pcr = π²EI/(K L)²',
    },
    en: {
      title: 'A column fails by length',
      hook: 'Same section, same material. Change only the length or the end condition, and the critical load changes.',
      board: 'Double the length. What is left of Pcr?',
      ask: 'How much stronger is a fixed-fixed column than a pin-pin column?',
      mistake: 'Slenderness is λ = Le/r, not L/r.',
      cues: ['K from 0.5 to 2', 'Leff = K L', 'Euler long, Johnson intermediate'],
      formula: 'Pcr = π²EI/(K L)²',
    },
  },
};

const MINI_KIND: Record<SceneId, string> = {
  beam: 'beam',
  frame: 'frame',
  ild: 'ild',
  section: 'section',
  mohr: 'mohr',
  column: 'buckling',
};

const StageView: React.FC<{
  scene: SceneId;
  onOpen: () => void;
  hideAnswers: boolean;
  L: number;
  beamRes: ReturnType<typeof import('../engine/beamEngine').analyzeBeam>;
  structRes: ReturnType<typeof import('../engine/frameTrussEngine').analyzeStructure2D>;
  sectionDims: SectionDimensions;
  fibre: ReturnType<typeof analyzeCrossSection>;
  mohr: ReturnType<typeof analyzeMohrCircle>;
  column: ReturnType<typeof analyzeColumnBuckling>;
  columnApplied: number;
  columnLength: number;
  ild: ReturnType<typeof computeILD> | null;
  ildPos: number;
  ildEffect: number;
  ildLabel: string;
  sectionName: string;
}> = ({ scene, onOpen, hideAnswers, L, beamRes, structRes, sectionDims, fibre, mohr, column, columnApplied, columnLength, ild, ildPos, ildEffect, ildLabel, sectionName }) => {
  const active = SCENES.find((s) => s.id === scene) ?? SCENES[0];
  const ildEffectUnit = ild?.unit.includes('kN·m') ? 'kN·m' : ild?.unit.includes('mm') ? 'mm' : 'kN';
  const ildOrdUnit = ild?.unit.includes('kN·m') ? 'm' : ild?.unit.includes('mm') ? 'mm/kN' : 'kN/kN';
  const meta = (() => {
    if (scene === 'beam') {
      return `L = ${fmt(L, 2)} m · |M|max = ${hideAnswers ? '•••' : fmt(beamRes.maxAbsM, 1)} kN·m · δmax = ${hideAnswers ? '•••' : fmt(beamRes.maxAbsDeflectionMm, 2)} mm`;
    }
    if (scene === 'frame') {
      return `${structRes.members.length} members · max sway ${hideAnswers ? '•••' : fmt(structRes.maxDisp_mm, 2)} mm · Ds ${structRes.Ds}`;
    }
    if (scene === 'ild') {
      return `${ildLabel} · effect now ${hideAnswers ? '•••' : fmt(ildEffect, 2)} ${ildEffectUnit} · two axle truck`;
    }
    if (scene === 'section') {
      return `${sectionName} · σt ${hideAnswers ? '•••' : fmt(fibre.maxTension_MPa, 1)} MPa · σc ${hideAnswers ? '•••' : fmt(fibre.maxCompression_MPa, 1)} MPa`;
    }
    if (scene === 'mohr') {
      return `σ1 ${hideAnswers ? '•••' : fmt(mohr.sigma1, 1)} MPa · σ2 ${hideAnswers ? '•••' : fmt(mohr.sigma2, 1)} MPa · τmax ${hideAnswers ? '•••' : fmt(mohr.tauMaxInPlane, 1)} MPa`;
    }
    return `λ ${hideAnswers ? '•••' : fmt(column.slenderness, 0)} · Pcr ${hideAnswers ? '•••' : fmt(column.governingCriticalLoad_kN, 0)} kN · applied ${hideAnswers ? '•••' : fmt(columnApplied, 0)} kN`;
  })();

  return (
    <div className="card overflow-hidden flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="relative flex w-1.5 h-1.5 shrink-0">
            <span className="absolute inline-flex w-full h-full rounded-full opacity-70" style={{ background: 'var(--ok)', animation: 'ping 2.2s ease-out infinite' }} />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ok)' }} />
          </span>
          <span className="text-[9.5px] font-extrabold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>Lecture stage</span>
          <span className="text-[9.5px] font-bold whitespace-nowrap" style={{ color: active.hue }}>· {active.label}</span>
        </div>
        <button onClick={onOpen} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--accent)' }}>
          Full lab <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      <div className="relative blueprint" style={{ minHeight: 356 }}>
        <div key={scene} className="scene-in">
          {scene === 'beam' && <BeamScene L={L} res={beamRes} hideValues={hideAnswers} />}
          {scene === 'frame' && <FrameScene />}
          {scene === 'ild' && ild && ild.points.length > 0 && (
            <IldScene
              L={L}
              points={ild.points}
              xTarget={ild.xTarget}
              maxPos={ild.maxPos}
              unit={ildOrdUnit}
              effectUnit={ildEffectUnit}
              pos={ildPos}
              effect={ildEffect}
              targetLabel={ildLabel}
              hideValues={hideAnswers}
            />
          )}
          {scene === 'section' && <SectionScene dims={sectionDims} maxT={fibre.maxTension_MPa} maxC={fibre.maxCompression_MPa} hideValues={hideAnswers} />}
          {scene === 'mohr' && <MohrScene s1={mohr.sigma1} s2={mohr.sigma2} tau={mohr.tauMaxInPlane} center={mohr.center} radius={mohr.radius} hideValues={hideAnswers} />}
          {scene === 'column' && <ColumnScene lambda={column.slenderness} pcr={column.governingCriticalLoad_kN} columnLength={columnLength} k={column.K_theoretical} hideValues={hideAnswers} />}
        </div>
      </div>

      <div className="px-3 py-2 text-[9.5px] font-semibold num leading-tight" style={{ color: 'var(--ink-3)', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
        {meta}
      </div>
    </div>
  );
};

const ControlRail: React.FC<{
  scene: SceneId;
  lang: 'hinglish' | 'english';
  beam: ReturnType<typeof import('../engine/beamEngine').analyzeBeam> extends never ? never : import('../engine/beamEngine').BeamModel;
  setBeam: (b: import('../engine/beamEngine').BeamModel) => void;
  beamRes: ReturnType<typeof import('../engine/beamEngine').analyzeBeam>;
  loadBeamPreset: (id: string) => void;
  resizeBeam: (L: number) => void;
  setPrimaryLoad: (patch: { magnitude?: number; x?: number; xEnd?: number }) => void;
  structRes: ReturnType<typeof import('../engine/frameTrussEngine').analyzeStructure2D>;
  loadStructPreset: (id: string) => void;
  windPct: number;
  setFrameWind: (v: number) => void;
  ildTarget: ILDTargetType;
  setIldTarget: (t: ILDTargetType) => void;
  ildPos: number;
  setIldPos: (v: number) => void;
  ildPlaying: boolean;
  setIldPlaying: (v: boolean) => void;
  ildWorst: () => void;
  ildWorstX: number;
  sectionKey: string;
  setSectionKey: (k: string) => void;
  fibreM: number;
  setFibreM: (v: number) => void;
  fibreV: number;
  setFibreV: (v: number) => void;
  syncFibre: () => void;
  openFibre: () => void;
  mohrX: number;
  setMohrX: (v: number) => void;
  mohrY: number;
  setMohrY: (v: number) => void;
  mohrT: number;
  setMohrT: (v: number) => void;
  useFibreStress: () => void;
  mohrPreset: (kind: 'uniaxial' | 'shear' | 'biaxial') => void;
  colL: number;
  setColL: (v: number) => void;
  colK: ColumnEndCondition;
  setColK: (k: ColumnEndCondition) => void;
  colP: number;
  setColP: (v: number) => void;
  openColumn: () => void;
}> = (p) => {
  const hi = p.lang === 'hinglish';
  const primary = p.beam.loads[0];
  const isPoint = primary?.type === 'point' || primary?.type === 'moment';
  const loadLabel = primary?.type === 'udl' ? (hi ? 'UDL w' : 'UDL w') : primary?.type === 'uvl' ? (hi ? 'Load w' : 'Load w') : (hi ? 'Load P' : 'Load P');

  return (
    <Card title={hi ? 'Stage controls' : 'Stage controls'} sub={hi ? 'Yahin se poora lecture chalega' : 'Drive the whole lecture from here'} right={<SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />}>
      {p.scene === 'beam' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: 'ss_center_point', label: hi ? 'Simply supported' : 'Simply supported' },
              { id: 'cantilever_combo', label: hi ? 'Cantilever' : 'Cantilever' },
              { id: 'double_overhang', label: hi ? 'Overhang' : 'Overhang' },
              { id: 'propped_cantilever', label: hi ? 'Propped' : 'Propped' },
            ].map((b) => (
              <button key={b.id} onClick={() => p.loadBeamPreset(b.id)} className="rounded-lg px-2 py-1.5 text-[10.5px] font-bold text-left" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                {b.label}
              </button>
            ))}
          </div>
          <Slider label={hi ? 'Span' : 'Span'} value={p.beam.length} min={2} max={16} step={0.5} suffix="m" onChange={p.resizeBeam} />
          {primary ? (
            <>
              <Slider label={loadLabel} value={primary.magnitude ?? 0} min={0} max={primary.type === 'udl' ? 80 : 160} step={1} suffix={primary.type === 'udl' ? 'kN/m' : 'kN'} onChange={(v) => p.setPrimaryLoad({ magnitude: v })} />
              {isPoint && <Slider label={hi ? 'Load position' : 'Load position'} value={primary.x ?? 0} min={0} max={p.beam.length} step={0.1} suffix="m" onChange={(v) => p.setPrimaryLoad({ x: v })} />}
            </>
          ) : (
            <Btn size="sm" onClick={() => p.setPrimaryLoad({ magnitude: 40, x: p.beam.length / 2 })}>{hi ? 'Add a point load' : 'Add a point load'}</Btn>
          )}
          <div className="rounded-lg px-2 py-1.5 num text-[10px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
            {hi ? 'Ds' : 'Ds'} {p.beamRes.Ds} · {p.beamRes.isStable ? (hi ? 'stable' : 'stable') : (hi ? 'mechanism' : 'mechanism')} · {hi ? 'reactions balanced' : 'reactions balanced'}
          </div>
        </div>
      )}

      {p.scene === 'frame' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: 'portal_gravity', label: hi ? 'Portal gravity' : 'Portal gravity' },
              { id: 'portal_sway', label: hi ? 'Portal sway' : 'Portal sway' },
              { id: 'two_story_frame', label: hi ? '2-storey' : '2-storey' },
              { id: 'warren_roof', label: hi ? 'Roof truss' : 'Roof truss' },
            ].map((b) => (
              <button key={b.id} onClick={() => p.loadStructPreset(b.id)} className="rounded-lg px-2 py-1.5 text-[10.5px] font-bold text-left" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                {b.label}
              </button>
            ))}
          </div>
          <Slider label={hi ? 'Lateral load' : 'Lateral load'} value={p.windPct} min={0} max={200} step={5} suffix="%" onChange={p.setFrameWind} />
          <div className="rounded-lg px-2 py-1.5 num text-[10px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
            {p.structRes.members.length} {hi ? 'members' : 'members'} · max sway {fmt(p.structRes.maxDisp_mm, 2)} mm
          </div>
        </div>
      )}

      {p.scene === 'ild' && (
        <div className="space-y-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-3)' }}>{hi ? 'Kya measure karein' : 'What to measure'}</div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: 'moment' as ILDTargetType, label: hi ? 'Moment M' : 'Moment M' },
                { id: 'shear' as ILDTargetType, label: hi ? 'Shear V' : 'Shear V' },
                { id: 'reaction' as ILDTargetType, label: hi ? 'Reaction R' : 'Reaction R' },
                { id: 'deflection' as ILDTargetType, label: hi ? 'Deflection δ' : 'Deflection δ' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => p.setIldTarget(t.id)}
                  className="rounded-lg py-1.5 px-1 text-[10.5px] font-extrabold"
                  style={{
                    background: p.ildTarget === t.id ? 'var(--accent)' : 'var(--surface-2)',
                    color: p.ildTarget === t.id ? '#fff' : 'var(--ink-2)',
                    border: '1px solid var(--line)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Slider label={hi ? 'Truck position' : 'Truck position'} value={p.ildPos} min={0} max={p.beam.length} step={0.05} suffix="m" onChange={p.setIldPos} />
          <div className="grid grid-cols-2 gap-1">
            <Btn size="sm" icon={p.ildPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} onClick={() => p.setIldPlaying(!p.ildPlaying)}>
              {p.ildPlaying ? (hi ? 'Pause' : 'Pause') : (hi ? 'Drive' : 'Drive')}
            </Btn>
            <Btn size="sm" icon={<Target className="w-3.5 h-3.5" />} onClick={p.ildWorst}>
              {hi ? 'Worst case' : 'Worst case'}
            </Btn>
          </div>
          <div className="rounded-lg px-2 py-1.5 num text-[10px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
            {hi ? 'Worst at' : 'Worst at'} {fmt(p.ildWorstX, 2)} m · {hi ? 'two axle truck' : 'two axle truck'}
          </div>
        </div>
      )}

      {p.scene === 'section' && (
        <div className="space-y-2">
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-3)' }}>{hi ? 'Section' : 'Section'}</span>
            <select value={p.sectionKey} onChange={(e) => p.setSectionKey(e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-[11.5px] font-semibold" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)', color: 'var(--ink)' }}>
              {NAMED_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </label>
          <Slider label={hi ? 'Bending M' : 'Bending M'} value={p.fibreM} min={-140} max={140} step={5} suffix="kN·m" onChange={p.setFibreM} />
          <Slider label={hi ? 'Shear V' : 'Shear V'} value={p.fibreV} min={-120} max={120} step={5} suffix="kN" onChange={p.setFibreV} />
          <div className="grid grid-cols-2 gap-1">
            <Btn size="sm" icon={<Waves className="w-3.5 h-3.5" />} onClick={p.syncFibre}>{hi ? 'Beam peak' : 'Beam peak'}</Btn>
            <Btn size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={p.openFibre}>{hi ? 'Full lab' : 'Full lab'}</Btn>
          </div>
        </div>
      )}

      {p.scene === 'mohr' && (
        <div className="space-y-2">
          <Slider label="σx" value={p.mohrX} min={-120} max={140} step={5} suffix="MPa" onChange={p.setMohrX} />
          <Slider label="σy" value={p.mohrY} min={-90} max={90} step={5} suffix="MPa" onChange={p.setMohrY} />
          <Slider label="τxy" value={p.mohrT} min={-90} max={90} step={5} suffix="MPa" onChange={p.setMohrT} />
          <div className="grid grid-cols-3 gap-1">
            <Btn size="sm" onClick={() => p.mohrPreset('uniaxial')}>{hi ? 'Tension' : 'Tension'}</Btn>
            <Btn size="sm" onClick={() => p.mohrPreset('shear')}>{hi ? 'Shear' : 'Shear'}</Btn>
            <Btn size="sm" onClick={() => p.mohrPreset('biaxial')}>{hi ? 'Biaxial' : 'Biaxial'}</Btn>
          </div>
          <Btn size="sm" icon={<Waves className="w-3.5 h-3.5" />} onClick={p.useFibreStress}>{hi ? 'Use fibre stress' : 'Use fibre stress'}</Btn>
        </div>
      )}

      {p.scene === 'column' && (
        <div className="space-y-2">
          <Slider label={hi ? 'Length L' : 'Length L'} value={p.colL} min={1} max={8} step={0.25} suffix="m" onChange={p.setColL} />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-3)' }}>{hi ? 'End condition K' : 'End condition K'}</div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'fixed_free' as ColumnEndCondition, label: '2' },
                { id: 'pinned_pinned' as ColumnEndCondition, label: '1' },
                { id: 'fixed_pinned' as ColumnEndCondition, label: '0.7' },
                { id: 'fixed_fixed' as ColumnEndCondition, label: '0.5' },
              ].map((k) => (
                <button key={k.id} onClick={() => p.setColK(k.id)} className="rounded-lg py-1.5 text-[11px] font-extrabold" style={{ background: p.colK === k.id ? 'var(--accent)' : 'var(--surface-2)', color: p.colK === k.id ? '#fff' : 'var(--ink-2)', border: '1px solid var(--line)' }}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <Slider label={hi ? 'Applied P' : 'Applied P'} value={p.colP} min={0} max={1400} step={25} suffix="kN" onChange={p.setColP} />
          <Btn size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={p.openColumn}>{hi ? 'Open column lab' : 'Open column lab'}</Btn>
        </div>
      )}
    </Card>
  );
};

const TeachRail: React.FC<{ scene: SceneId; lang: 'hinglish' | 'english'; sceneName: string; guided: boolean; step: number; total: number; onPrev: () => void; onNext: () => void; onExit: () => void }> = ({ scene, lang, sceneName, guided, step, total, onPrev, onNext, onExit }) => {
  const lesson = LESSONS[scene][lang === 'hinglish' ? 'hi' : 'en'];
  const hi = lang === 'hinglish';
  return (
    <div className="space-y-2 min-w-0 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0 xl:block xl:space-y-2">
      {guided && (
        <div className="card p-2.5 flex items-center gap-2 lg:col-span-2 xl:col-span-1">
          <button onClick={onPrev} disabled={step === 0} className="w-7 h-7 grid place-items-center rounded-lg disabled:opacity-30" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }} aria-label="Previous concept"><ChevronLeft className="w-4 h-4" /></button>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>{hi ? 'Guided lecture' : 'Guided lecture'} {step + 1}/{total}</div>
            <div className="text-[11.5px] font-bold truncate">{sceneName}</div>
          </div>
          <button onClick={onNext} disabled={step === total - 1} className="w-7 h-7 grid place-items-center rounded-lg disabled:opacity-30" style={{ background: 'var(--accent)', color: '#fff' }} aria-label="Next concept"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={onExit} className="text-[9.5px] font-bold px-1.5 py-1 rounded-md" style={{ color: 'var(--ink-3)' }}>{hi ? 'Exit' : 'Exit'}</button>
        </div>
      )}

      <Card title={hi ? 'Board par' : 'On the board'} sub={lesson.title} right={<Badge tone="blue">{hi ? 'teaching note' : 'teaching note'}</Badge>}>
        <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{lesson.hook}</p>
        <div className="mt-2 rounded-lg px-2.5 py-2 num text-[12.5px] font-extrabold text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--accent)' }}>
          {lesson.formula}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          <div className="rounded-lg p-2" style={{ background: 'color-mix(in srgb, var(--accent) 7%, var(--surface))', border: '1px solid var(--line)' }}>
            <div className="text-[9px] font-extrabold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>{hi ? 'Class se poochho' : 'Ask the class'}</div>
            <div className="text-[10.5px] font-semibold leading-snug mt-0.5">{lesson.ask}</div>
          </div>
          <div className="rounded-lg p-2" style={{ background: 'color-mix(in srgb, var(--warn) 7%, var(--surface))', border: '1px solid var(--line)' }}>
            <div className="text-[9px] font-extrabold uppercase tracking-wide" style={{ color: 'var(--warn)' }}>{hi ? 'Yahan galti hoti hai' : 'Common mistake'}</div>
            <div className="text-[10.5px] leading-snug mt-0.5">{lesson.mistake}</div>
          </div>
        </div>
      </Card>

      <Card title={hi ? 'Picture me kya dekhein' : 'What to point at'} right={<span className="text-[9px] font-bold" style={{ color: 'var(--ink-3)' }}>{sceneName}</span>}>
        <div className="rounded-lg overflow-hidden mb-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
          <Mini kind={MINI_KIND[scene]} />
        </div>
        <ol className="space-y-1">
          {lesson.cues.map((c, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[10.5px] leading-snug">
              <span className="num w-4 h-4 rounded-full grid place-items-center text-[9px] font-extrabold shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{i + 1}</span>
              <span style={{ color: 'var(--ink-2)' }}>{c}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Module                                                                */
/* ------------------------------------------------------------------ */
export const OverviewModule: React.FC = () => {
  const {
    beam,
    setBeam,
    beamRes,
    struct,
    setStruct,
    structRes,
    sectionKey,
    setSectionKey,
    sectionGeometry,
    sectionDims,
    fy_MPa,
    goto,
    toast,
    hideAnswers,
    setHideAnswers,
    setAtlasQuery,
    setToSection,
    lang,
  } = useAnalysis();

  const [scene, setScene] = useState<SceneId>('beam');
  const [guided, setGuided] = useState(false);
  const [step, setStep] = useState(0);
  const [windPct, setWindPct] = useState(100);
  const [ildTarget, setIldTarget] = useState<ILDTargetType>('moment');
  const [ildPos, setIldPos] = useState(3);
  const [ildPlaying, setIldPlaying] = useState(false);
  const [fibreM, setFibreM] = useState(40);
  const [fibreV, setFibreV] = useState(30);
  const [mohrX, setMohrX] = useState(80);
  const [mohrY, setMohrY] = useState(20);
  const [mohrT, setMohrT] = useState(40);
  const [colL, setColL] = useState(3);
  const [colK, setColK] = useState<ColumnEndCondition>('pinned_pinned');
  const [colP, setColP] = useState(150);
  const [query, setQuery] = useState('');

  const named = findSection(sectionKey);
  const L = Math.max(0.5, beam.length);
  const hi = lang === 'hinglish';

  const fibre = useMemo(
    () => analyzeCrossSection(sectionGeometry, { M_kNm: fibreM, V_kN: fibreV, N_kN: 0, fy_MPa }),
    [sectionGeometry, fibreM, fibreV, fy_MPa]
  );
  const mohr = useMemo(
    () => analyzeMohrCircle({ sigmaX: mohrX, sigmaY: mohrY, tauXY: mohrT, thetaDeg: 0 }),
    [mohrX, mohrY, mohrT]
  );
  const column = useMemo(
    () =>
      analyzeColumnBuckling({
        endCondition: colK,
        length_m: colL,
        E_GPa: named.E_GPa,
        fy_MPa: named.fy_MPa,
        area_cm2: sectionDims.A_cm2,
        Imin_cm4: sectionDims.I_cm4,
        appliedLoad_kN: colP,
      }),
    [colK, colL, named.E_GPa, named.fy_MPa, sectionDims.A_cm2, sectionDims.I_cm4, colP]
  );
  const ild = useMemo(
    () => computeILD(beam, { type: ildTarget, supportId: beam.supports[0]?.id, xSection: L * 0.5 }),
    [beam, ildTarget, L]
  );

  // Two axles, 3 m apart: 60 kN leading and 120 kN trailing. The effect is the
  // sum of P times the influence ordinate under each axle.
  const ildEffect = useMemo(() => {
    if (!ild || ild.points.length === 0) return 0;
    const axles = [{ x: ildPos, p: 60 }, { x: ildPos - 3, p: 120 }];
    return axles.reduce((sum, a) => {
      if (a.x < -1e-9 || a.x > L + 1e-9) return sum;
      return sum + a.p * interpolateILD(ild.points, Math.max(0, Math.min(L, a.x)), L);
    }, 0);
  }, [ild, ildPos, L]);

  const ildLabel =
    ildTarget === 'moment'
      ? hi ? 'Moment at midspan' : 'Moment at midspan'
      : ildTarget === 'shear'
      ? hi ? 'Shear at midspan' : 'Shear at midspan'
      : ildTarget === 'deflection'
      ? hi ? 'Deflection at midspan' : 'Deflection at midspan'
      : hi ? 'Support reaction' : 'Support reaction';

  useEffect(() => {
    if (!ildPlaying) return;
    const id = window.setInterval(() => {
      setIldPos((p) => (p >= L - 0.05 ? 0 : Math.min(L, p + 0.06)));
    }, 60);
    return () => window.clearInterval(id);
  }, [ildPlaying, L]);

  const pickScene = (id: SceneId) => {
    setScene(id);
    setStep(Math.max(0, SCENES.findIndex((s) => s.id === id)));
    if (id !== 'ild') setIldPlaying(false);
  };

  const openSceneLab = () => {
    const map: Record<SceneId, string> = { beam: 'beam', frame: 'structure', ild: 'ild', section: 'section', mohr: 'mohr', column: 'buckling' };
    goto(map[scene]);
  };

  const loadBeamPreset = (id: string) => {
    const p = BEAM_PRESETS.find((x) => x.id === id);
    if (!p) return;
    const model = JSON.parse(JSON.stringify(p.model)) as typeof beam;
    setBeam(model);
    setIldPos(model.length * 0.55);
    pickScene('beam');
    toast(`${p.nameEn} loaded on the stage.`, 'ok');
  };

  const loadStructPreset = (id: string) => {
    const p = STRUCTURE_2D_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setStruct(JSON.parse(JSON.stringify(p.model)));
    setWindPct(100);
    pickScene('frame');
    toast(`${p.model.nameEn} loaded on the stage.`, 'ok');
  };

  const resizeBeam = (nextL: number) => {
    if (!Number.isFinite(nextL) || nextL <= 0) return;
    const k = nextL / Math.max(0.1, beam.length);
    setBeam({
      ...beam,
      length: nextL,
      supports: beam.supports.map((s) => ({ ...s, x: Math.min(nextL, s.x * k) })),
      hinges: beam.hinges.map((h) => ({ ...h, x: Math.min(nextL, h.x * k) })),
      loads: beam.loads.map((l) => ({
        ...l,
        x: l.x !== undefined ? Math.min(nextL, l.x * k) : undefined,
        xStart: l.xStart !== undefined ? Math.min(nextL, l.xStart * k) : undefined,
        xEnd: l.xEnd !== undefined ? Math.min(nextL, l.xEnd * k) : undefined,
      })),
    });
    setIldPos(nextL * 0.55);
  };

  const setPrimaryLoad = (patch: { magnitude?: number; x?: number; xEnd?: number }) => {
    if (beam.loads.length === 0) {
      setBeam({
        ...beam,
        loads: [{ id: 'l_stage', type: 'point', x: patch.x ?? beam.length / 2, magnitude: patch.magnitude ?? 40 }],
      });
      return;
    }
    setBeam({ ...beam, loads: beam.loads.map((l, i) => (i === 0 ? { ...l, ...patch } : l)) });
  };

  const setFrameWind = (next: number) => {
    const old = windPct <= 0 ? 100 : windPct;
    const factor = next / old;
    setStruct({ ...struct, nodes: struct.nodes.map((n) => ({ ...n, fx: (n.fx ?? 0) * factor })) });
    setWindPct(next);
  };

  const syncFibre = () => {
    setFibreM(Math.abs(beamRes.maxAbsM));
    setFibreV(Math.abs(beamRes.maxAbsV));
    toast(hi ? 'Beam ke peak M aur V stage par aa gaye.' : 'Beam peak M and V copied to the stage.', 'info');
  };

  const openFibre = () => {
    setToSection({ M: fibreM, V: fibreV, N: 0, x: beam.length / 2, source: 'Lecture stage' });
    goto('section');
  };

  const useFibreStress = () => {
    setMohrX(fibre.maxTension_MPa);
    setMohrY(-Math.abs(fibre.maxCompression_MPa));
    setMohrT(fibre.maxShear_MPa);
    toast(hi ? 'Fibre ka stress Mohr stage par aa gaya.' : 'Fibre stress copied to the Mohr stage.', 'info');
  };

  const mohrPreset = (kind: 'uniaxial' | 'shear' | 'biaxial') => {
    if (kind === 'uniaxial') { setMohrX(100); setMohrY(0); setMohrT(0); }
    else if (kind === 'shear') { setMohrX(0); setMohrY(0); setMohrT(60); }
    else { setMohrX(80); setMohrY(40); setMohrT(0); }
  };

  const openConcept = (q: string) => {
    setAtlasQuery(q);
    goto('atlas');
  };

  const labs = [
    {
      id: 'beam' as const,
      n: 1,
      title: 'Beam: SFD / BMD',
      desc: 'Supports, loads and the section knife on one drawing. Four curves stay together.',
      metric: hideAnswers ? 'answers hidden' : `|M|max ${fmt(beamRes.maxAbsM, 1)} kN·m`,
      icon: <Activity className="w-4 h-4" />,
      kind: 'beam',
      color: 'var(--accent)',
    },
    {
      id: 'structure' as const,
      n: 2,
      title: '2D Frame & Truss',
      desc: 'Draw joint by joint, or generate a portal frame or roof truss from numbers.',
      metric: hideAnswers ? 'answers hidden' : structRes.isStable ? `Ds ${structRes.Ds} · stable` : 'mechanism',
      icon: <Network className="w-4 h-4" />,
      kind: 'frame',
      color: 'var(--sagging)',
    },
    {
      id: 'ild' as const,
      n: 3,
      title: 'Moving loads (ILD)',
      desc: 'Drive a truck across the bridge and watch P times eta build the worst case.',
      metric: `L = ${fmt(beam.length, 1)} m bridge`,
      icon: <Truck className="w-4 h-4" />,
      kind: 'ild',
      color: 'var(--warn)',
    },
    {
      id: 'section' as const,
      n: 4,
      title: 'Section fibres (σ, τ)',
      desc: `${named.name}: every depth strip checked against the closed form.`,
      metric: hideAnswers ? 'answers hidden' : `σt ${fmt(fibre.maxTension_MPa, 1)} MPa`,
      icon: <Layers className="w-4 h-4" />,
      kind: 'section',
      color: 'var(--tension)',
    },
    {
      id: 'mohr' as const,
      n: 5,
      title: "Mohr's circle",
      desc: 'The element and the circle turn together. One angle on the face is two on the circle.',
      metric: hideAnswers ? 'answers hidden' : `τmax ${fmt(mohr.tauMaxInPlane, 1)} MPa`,
      icon: <Compass className="w-4 h-4" />,
      kind: 'mohr',
      color: 'var(--hogging)',
    },
    {
      id: 'buckling' as const,
      n: 6,
      title: 'Buckling & torsion',
      desc: 'Four end conditions side by side, then a stepped shaft with T(x) and twist.',
      metric: `A ${fmt(sectionDims.A_cm2, 0)} cm² · I ${fmt(sectionDims.I_cm4, 0)} cm⁴`,
      icon: <Columns3 className="w-4 h-4" />,
      kind: 'buckling',
      color: '#0369a1',
    },
    {
      id: 'atlas' as const,
      n: 7,
      title: 'Concept atlas',
      desc: '22 ideas wired to this model, so a student question becomes a worked answer.',
      metric: '22 topics · live',
      icon: <BookMarked className="w-4 h-4" />,
      kind: 'atlas',
      color: '#7c3aed',
    },
    {
      id: 'guide' as const,
      n: 8,
      title: 'Lecture kit & guide',
      desc: 'A 30 minute script, the six idea pipeline, and the misconceptions students bring.',
      metric: '30 min script',
      icon: <GraduationCap className="w-4 h-4" />,
      kind: 'guide',
      color: 'var(--ink-2)',
    },
  ];

  const presetBeams = ['ss_point_udl', 'cantilever_combo', 'double_overhang', 'propped_cantilever'];
  const presetStructs = ['portal_gravity', 'portal_sway', 'two_story_frame', 'warren_roof'];
  const activeScene = SCENES.find((s) => s.id === scene) ?? SCENES[0];

  return (
    <div className="space-y-2.5">
      {/* console header */}
      <section className="card p-3 sm:p-4 reveal">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge tone="blue"><LayoutDashboard className="w-3 h-3" /> Lecture studio</Badge>
              <Badge tone={hideAnswers ? 'amber' : 'green'}>{hideAnswers ? (hi ? 'answers hidden' : 'answers hidden') : (hi ? 'answers on screen' : 'answers on screen')}</Badge>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--ink-3)' }}>{hi ? '6 concepts · 8 labs · ek hi model' : '6 concepts · 8 labs · one model'}</span>
            </div>
            <h1 className="mt-2 text-[22px] sm:text-[27px] leading-tight font-black tracking-tight">
              {hi ? <>Ek screen, poora lecture. <span style={{ color: 'var(--accent)' }}>Stage live chalega.</span></> : <>One screen, the whole lecture. <span style={{ color: 'var(--accent)' }}>The stage stays live.</span></>}
            </h1>
            <p className="mt-1 max-w-[78ch] text-[11.5px] sm:text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {hi
                ? 'Concept chuno. Stage, controls aur board notes saath rehte hain. Neeche se koi lab kholni ho to ek click.'
                : 'Pick a concept. The stage, controls and board notes stay together. Open any full lab with one click when you need it.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Btn variant="primary" size="md" icon={guided ? <ChevronLeft className="w-4 h-4" /> : <Play className="w-4 h-4" />} onClick={() => { if (guided) { setGuided(false); } else { setGuided(true); pickScene('beam'); } }}>
              {guided ? (hi ? 'Guided mode band karo' : 'Exit guided lecture') : (hi ? 'Guided lecture shuru karo' : 'Start guided lecture')}
            </Btn>
            <Btn
              size="md"
              icon={hideAnswers ? <EyeOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              onClick={() => {
                setHideAnswers(!hideAnswers);
                toast(hideAnswers ? (hi ? 'Answers wapas on hain.' : 'Answers are back on.') : (hi ? 'Answers hidden. Pehle board par solve karo.' : 'Answers hidden. Solve on the board first.'), 'info');
              }}
            >
              {hideAnswers ? (hi ? 'Answers dikhao' : 'Show answers') : (hi ? 'Answers chhupao' : 'Hide answers')}
            </Btn>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap sm:flex-nowrap items-center gap-1 sm:overflow-x-auto scroll-x pb-0.5">
          {SCENES.map((s) => {
            const on = s.id === scene;
            return (
              <button
                key={s.id}
                onClick={() => pickScene(s.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors"
                style={{
                  background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: on ? 'var(--accent)' : 'var(--ink-2)',
                  border: `1px solid ${on ? 'color-mix(in srgb, var(--accent) 38%, transparent)' : 'var(--line)'}`,
                }}
              >
                <span style={{ color: on ? 'var(--accent)' : s.hue }}>{s.icon}</span>
                {s.label}
              </button>
            );
          })}
          <span className="ml-auto hidden sm:block text-[9.5px] font-semibold whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>
            {hi ? 'Keyboard: 0 se 8, H answers, F fullscreen' : 'Keyboard: 0 to 8, H answers, F fullscreen'}
          </span>
        </div>
      </section>

      {/* stage + controls + notes */}
      <section className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_300px] gap-2.5 items-start reveal" style={{ animationDelay: '50ms' }}>
        <div className="order-2 lg:order-1 xl:order-1 min-w-0">
          <ControlRail
            scene={scene}
            lang={lang}
            beam={beam}
            setBeam={setBeam}
            beamRes={beamRes}
            loadBeamPreset={loadBeamPreset}
            resizeBeam={resizeBeam}
            setPrimaryLoad={setPrimaryLoad}
            structRes={structRes}
            loadStructPreset={loadStructPreset}
            windPct={windPct}
            setFrameWind={setFrameWind}
            ildTarget={ildTarget}
            setIldTarget={setIldTarget}
            ildPos={ildPos}
            setIldPos={setIldPos}
            ildPlaying={ildPlaying}
            setIldPlaying={setIldPlaying}
            ildWorst={() => setIldPos(ild?.maxPos.x ?? L / 2)}
            ildWorstX={ild?.maxPos.x ?? L / 2}
            sectionKey={sectionKey}
            setSectionKey={setSectionKey}
            fibreM={fibreM}
            setFibreM={setFibreM}
            fibreV={fibreV}
            setFibreV={setFibreV}
            syncFibre={syncFibre}
            openFibre={openFibre}
            mohrX={mohrX}
            setMohrX={setMohrX}
            mohrY={mohrY}
            setMohrY={setMohrY}
            mohrT={mohrT}
            setMohrT={setMohrT}
            useFibreStress={useFibreStress}
            mohrPreset={mohrPreset}
            colL={colL}
            setColL={setColL}
            colK={colK}
            setColK={setColK}
            colP={colP}
            setColP={setColP}
            openColumn={() => goto('buckling')}
          />

          <div className="mt-2.5">
            <Card
              title={hi ? 'Lecture flow' : 'Lecture flow'}
              sub={hi ? 'Chhe ideas, ek hi screen par' : 'Six ideas, one screen'}
              right={<Badge tone={guided ? 'green' : 'neutral'}>{guided ? (hi ? 'guided' : 'guided') : `${SCENES.length} steps`}</Badge>}
            >
              <ol className="space-y-1">
                {SCENES.map((s, i) => {
                  const on = s.id === scene;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => pickScene(s.id)}
                        className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
                        style={{
                          background: on ? 'var(--accent-soft)' : 'transparent',
                          border: `1px solid ${on ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'transparent'}`,
                        }}
                      >
                        <span
                          className="num w-4 h-4 rounded-full grid place-items-center text-[9px] font-extrabold shrink-0"
                          style={{ background: on ? 'var(--accent)' : 'var(--surface-3)', color: on ? '#fff' : 'var(--ink-3)' }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-[11px] font-bold flex-1 min-w-0 truncate" style={{ color: on ? 'var(--accent)' : 'var(--ink-2)' }}>
                          {s.label}
                        </span>
                        {on && <span className="text-[8.5px] font-extrabold uppercase tracking-wide shrink-0" style={{ color: 'var(--accent)' }}>{hi ? 'stage par' : 'on stage'}</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2 rounded-lg px-2 py-1.5 text-[9.5px] leading-snug" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
                {hi ? 'Har step par board notes saath badalte hain. Guided mode poora screen saaf rakhta hai.' : 'Board notes follow every step. Guided mode keeps the projector screen clean.'}
              </div>
            </Card>
          </div>
        </div>

        <div className="order-1 lg:order-2 xl:order-2 min-w-0">
          <StageView
            scene={scene}
            onOpen={openSceneLab}
            hideAnswers={hideAnswers}
            L={L}
            beamRes={beamRes}
            structRes={structRes}
            sectionDims={sectionGeometry}
            fibre={fibre}
            mohr={mohr}
            column={column}
            columnApplied={colP}
            columnLength={colL}
            ild={ild}
            ildPos={ildPos}
            ildEffect={ildEffect}
            ildLabel={ildLabel}
            sectionName={named.name}
          />
        </div>

        <div className="order-3 lg:col-span-2 xl:col-span-1 min-w-0">
          <TeachRail
            scene={scene}
            lang={lang}
            sceneName={activeScene.label}
            guided={guided}
            step={step}
            total={SCENES.length}
            onPrev={() => pickScene(SCENES[Math.max(0, step - 1)].id)}
            onNext={() => pickScene(SCENES[Math.min(SCENES.length - 1, step + 1)].id)}
            onExit={() => setGuided(false)}
          />
        </div>
      </section>

      {!guided && (
        <>
          {/* all labs */}
          <section className="reveal" style={{ animationDelay: '80ms' }}>
            <div className="flex flex-wrap items-end justify-between gap-2 mb-1.5">
              <div>
                <h2 className="text-[15px] font-extrabold tracking-tight">{hi ? 'Poora workspace, jab detail chahiye' : 'The full workspace, when you need detail'}</h2>
                <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {hi ? 'Har preview isi model se bana hai. Koi screenshot nahi.' : 'Every preview comes from the same model. Nothing is a screenshot.'}
                </p>
              </div>
              <Badge tone="neutral">{hi ? 'card kholo' : 'open a card'}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {labs.map((l) => (
                <button key={l.id} onClick={() => goto(l.id)} className="lab-card card text-left overflow-hidden group" style={{ padding: 0 }}>
                  <div className="flex items-start gap-2 p-3 pb-1.5">
                    <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${l.color} 12%, var(--surface))`, border: `1px solid color-mix(in srgb, ${l.color} 30%, transparent)`, color: l.color }}>
                      {l.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="num text-[9px] font-extrabold" style={{ color: 'var(--ink-3)' }}>0{l.n}</span>
                        <span className="text-[12.5px] font-extrabold leading-tight truncate">{l.title}</span>
                      </div>
                      <div className="text-[10px] mt-0.5 num truncate" style={{ color: l.color }}>{l.metric}</div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: l.color }} />
                  </div>
                  <div className="px-2">
                    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                      <Mini kind={l.kind} />
                    </div>
                  </div>
                  <p className="px-3 pt-1.5 pb-3 text-[10.5px] leading-snug" style={{ color: 'var(--ink-2)' }}>{l.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* presets + search */}
          <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2.5 reveal" style={{ animationDelay: '110ms' }}>
            <Card
              title={hi ? 'Ready problems' : 'Ready problems'}
              sub={hi ? 'Ek click me stage par load ho jaata hai. Lecture ke beech me typing nahi.' : 'One click loads a complete problem on the stage. No typing in front of the class.'}
              right={<Badge tone="blue">{hi ? 'live presets' : 'live presets'}</Badge>}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {presetBeams.map((id) => {
                  const p = BEAM_PRESETS.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <button key={id} onClick={() => loadBeamPreset(id)} className="preset-card">
                      <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                        <Activity className="w-3 h-3" /> {p.tag}
                      </span>
                      <span className="block text-[11.5px] font-bold leading-tight mt-0.5">{p.nameEn}</span>
                      <span className="block text-[9.5px] num mt-0.5" style={{ color: 'var(--ink-3)' }}>{p.model.length} m · {p.model.loads.length} loads</span>
                    </button>
                  );
                })}
                {presetStructs.map((id) => {
                  const p = STRUCTURE_2D_PRESETS.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <button key={id} onClick={() => loadStructPreset(id)} className="preset-card">
                      <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide" style={{ color: 'var(--sagging)' }}>
                        <Network className="w-3 h-3" /> {p.tag}
                      </span>
                      <span className="block text-[11.5px] font-bold leading-tight mt-0.5">{p.model.nameEn}</span>
                      <span className="block text-[9.5px] num mt-0.5" style={{ color: 'var(--ink-3)' }}>{p.model.nodes.length} joints · {p.model.members.length} members</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Btn
                  size="sm"
                  icon={<Waves className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setBeam({ ...beam, loads: [{ id: 'l_udl', type: 'udl', xStart: 0, xEnd: beam.length, magnitude: 20 }] });
                    pickScene('beam');
                    toast(hi ? 'Full span UDL stage par hai. V ka slope aur M ka parabola dekho.' : 'Full span UDL on stage. Watch the V slope and the M parabola.', 'info');
                  }}
                >
                  {hi ? 'Mere beam par full UDL' : 'Full UDL on my beam'}
                </Btn>
                <Btn size="sm" icon={<MousePointerClick className="w-3.5 h-3.5" />} onClick={() => goto('structure')}>{hi ? 'Structure banao' : 'Draw a structure'}</Btn>
                <Btn size="sm" icon={<BookOpen className="w-3.5 h-3.5" />} onClick={() => goto('guide')}>{hi ? 'Lecture script' : 'Lecture script'}</Btn>
              </div>
            </Card>

            <Card title={hi ? 'Student ka doubt, seedha jawab' : 'A student doubt, straight answer'}>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                {hi ? 'Chapter ka naam nahi, doubt likho. Atlas 22 ideas me se matching concept nikaal ke aapke model ke numbers ke saath dikhata hai.' : 'Type the doubt, not the chapter name. The atlas finds the matching idea and quotes your model numbers.'}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  openConcept(query);
                }}
                className="mt-2 flex gap-1.5"
              >
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={hi ? 'jaise: mohr, truss, settlement, energy…' : 'e.g. mohr, truss, settlement, energy…'}
                  className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[12px] outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)', color: 'var(--ink)' }}
                />
                <Btn variant="primary" size="md" type="submit" icon={<Search className="w-4 h-4" />}>{hi ? 'Search' : 'Search'}</Btn>
              </form>
              <div className="mt-2 flex flex-wrap gap-1">
                {['SFD', 'Mohr', 'truss', 'settlement', 'torsion', 'energy', 'zero force', 'deflection'].map((q) => (
                  <button key={q} onClick={() => openConcept(q)} className="rounded-full px-2 py-1 text-[10px] font-bold transition-colors" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                    {q}
                  </button>
                ))}
              </div>
              <div className="mt-2 rounded-lg p-2 text-[10px] leading-relaxed" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
                <CheckCircle2 className="w-3 h-3 inline mr-1" style={{ color: 'var(--ok)' }} />
                {hi ? 'Har number solver se aata hai. Close the Wi-Fi and it still works.' : 'Every number comes from the solver. Close the Wi-Fi and it still works.'}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
};
