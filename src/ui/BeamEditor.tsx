import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Anchor, TriangleRight, Waves, RotateCw, Link2 } from 'lucide-react';
import { BeamLoad, BeamModel, BeamSupport, SupportType } from '../engine/beamEngine';
import { fmt, uid, NumInput, Segmented, Badge } from './primitives';

const VW = 1000;
const VH = 128;
const PAD = 34;

interface Props {
  model: BeamModel;
  onChange: (m: BeamModel) => void;
  showMarks?: boolean;
}

const supportLabel = (s: BeamSupport) => s.label?.trim() || '';

export const BeamEditor: React.FC<Props> = ({ model, onChange, showMarks = true }) => {
  const L = Math.max(0.5, model.length);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<null | { kind: 'support' | 'hinge' | 'load' | 'rangeL' | 'rangeR'; id: string }>(null);

  const X = (x: number) => PAD + (Math.max(0, Math.min(L, x)) / L) * (VW - 2 * PAD);
  const toX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const r = svg.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * VW;
    const raw = ((sx - PAD) / (VW - 2 * PAD)) * L;
    // snap to 0.25 m
    return Math.round(raw * 4) / 4;
  };

  const beamY = 74;

  const setSupport = (id: string, patch: Partial<BeamSupport>) =>
    onChange({ ...model, supports: model.supports.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const setLoad = (id: string, patch: Partial<BeamLoad>) =>
    onChange({ ...model, loads: model.loads.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const addSupport = (type: SupportType) => {
    const label = String.fromCharCode(65 + (model.supports.length % 26));
    const x = model.supports.length === 0 ? 0 : model.supports.length === 1 ? L : Math.round((L / (model.supports.length + 1)) * 4) / 4;
    onChange({
      ...model,
      supports: [...model.supports, { id: `s_${uid()}`, x, type, label }],
    });
  };

  const addLoad = (type: BeamLoad['type']) => {
    const base: BeamLoad = { id: `l_${uid()}`, type };
    if (type === 'point') Object.assign(base, { x: Math.round((L / 2) * 4) / 4, magnitude: 20 });
    if (type === 'moment') Object.assign(base, { x: Math.round((L / 2) * 4) / 4, magnitude: 25 });
    if (type === 'udl') Object.assign(base, { xStart: 0, xEnd: L, magnitude: 10 });
    if (type === 'uvl') Object.assign(base, { xStart: 0, xEnd: L, wStart: 0, wEnd: 20 });
    onChange({ ...model, loads: [...model.loads, base] });
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const x = toX(e.clientX);
    if (drag.kind === 'support') setSupport(drag.id, { x: Math.max(0, Math.min(L, x)) });
    if (drag.kind === 'hinge')
      onChange({
        ...model,
        hinges: model.hinges.map((h) => (h.id === drag.id ? { ...h, x: Math.max(0.1, Math.min(L - 0.1, x)) } : h)),
      });
    if (drag.kind === 'load') setLoad(drag.id, { x: Math.max(0, Math.min(L, x)) });
    if (drag.kind === 'rangeL') {
      const ld = model.loads.find((l) => l.id === drag.id);
      if (ld) setLoad(drag.id, { xStart: Math.max(0, Math.min((ld.xEnd ?? L) - 0.25, x)) });
    }
    if (drag.kind === 'rangeR') {
      const ld = model.loads.find((l) => l.id === drag.id);
      if (ld) setLoad(drag.id, { xEnd: Math.min(L, Math.max((ld.xStart ?? 0) + 0.25, x)) });
    }
  };

  const supportGlyph = (s: BeamSupport, px: number) => {
    const y = beamY;
    if (s.type === 'fixed')
      return (
        <g>
          <line x1={px} y1={y - 22} x2={px} y2={y + 24} stroke="var(--ink)" strokeWidth={3} />
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={i} x1={px} y1={y - 18 + i * 8} x2={px - 9} y2={y - 12 + i * 8} stroke="var(--ink)" strokeWidth={1.3} />
          ))}
        </g>
      );
    if (s.type === 'spring')
      return (
        <g>
          <path
            d={`M${px} ${y + 4} l0 6 l-7 3 l14 5 l-14 5 l14 5 l-7 3 l0 5`}
            fill="none"
            stroke="var(--warn)"
            strokeWidth={2}
          />
          <line x1={px - 14} y1={y + 38} x2={px + 14} y2={y + 38} stroke="var(--ink-2)" strokeWidth={2} />
        </g>
      );
    // pin / roller / guided share a triangle
    return (
      <g>
        <path d={`M${px} ${y + 4} L${px - 11} ${y + 18} L${px + 11} ${y + 18} Z`} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} />
        {s.type === 'roller' || s.type === 'guided' ? (
          <>
            <circle cx={px - 5.5} cy={y + 23} r={4.2} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.6} />
            <circle cx={px + 5.5} cy={y + 23} r={4.2} fill="var(--surface)" stroke={s.type === 'guided' ? 'var(--accent)' : 'var(--ink)'} strokeWidth={1.6} />
            <line x1={px - 15} y1={y + 29} x2={px + 15} y2={y + 29} stroke="var(--ink)" strokeWidth={2} />
          </>
        ) : (
          <>
            <line x1={px - 15} y1={y + 19} x2={px + 15} y2={y + 19} stroke="var(--ink)" strokeWidth={2} />
            {[-10, -3, 4, 11].map((d, i) => (
              <line key={i} x1={px + d} y1={y + 19} x2={px + d - 5} y2={y + 26} stroke="var(--ink)" strokeWidth={1.3} />
            ))}
          </>
        )}
        {Math.abs(s.settlementMm ?? 0) > 1e-6 && (
          <text x={px} y={y + 44} fontSize={9.5} fill="var(--warn)" textAnchor="middle" fontWeight={700}>
            Δ{(s.settlementMm ?? 0) > 0 ? '↓' : '↑'} {Math.abs(s.settlementMm ?? 0)}mm
          </text>
        )}
      </g>
    );
  };

  const loadGlyph = (ld: BeamLoad) => {
    const y = beamY;
    if (ld.type === 'point' && ld.x !== undefined) {
      const px = X(ld.x);
      const P = Math.abs(ld.magnitude ?? 0);
      const up = (ld.magnitude ?? 0) < 0;
      return (
        <g key={ld.id} style={{ cursor: 'ew-resize' }} onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'load', id: ld.id }); }}>
          <line x1={px} y1={y - 54} x2={px} y2={y - 8} stroke={up ? 'var(--ok)' : 'var(--compression)'} strokeWidth={2.4} />
          <polygon points={`${px},${y - 2} ${px - 5},${y - 13} ${px + 5},${y - 13}`} fill={up ? 'var(--ok)' : 'var(--compression)'} transform={up ? `rotate(180 ${px} ${y - 8})` : undefined} />
          <text x={px + 4} y={y - 42} fontSize={10} fontWeight={800} fill={up ? 'var(--ok)' : 'var(--compression)'}>
            {P}kN
          </text>
          <circle cx={px} cy={y - 30} r={12} fill="transparent" />
        </g>
      );
    }
    if (ld.type === 'moment' && ld.x !== undefined) {
      const px = X(ld.x);
      const cw = (ld.magnitude ?? 0) >= 0;
      return (
        <g key={ld.id} style={{ cursor: 'ew-resize' }} onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'load', id: ld.id }); }}>
          <path
            d={`M${px - 16} ${y - 22} a 17 17 0 1 ${cw ? 1 : 0} 32 0`}
            fill="none"
            stroke="var(--warn)"
            strokeWidth={2.4}
          />
          <polygon
            points={cw ? `${px + 17},${y - 26} ${px + 9},${y - 26} ${px + 14},${y - 17}` : `${px - 17},${y - 26} ${px - 9},${y - 26} ${px - 14},${y - 17}`}
            fill="var(--warn)"
          />
          <text x={px} y={y - 42} fontSize={10} fontWeight={800} fill="var(--warn)" textAnchor="middle">
            {Math.abs(ld.magnitude ?? 0)}kN·m
          </text>
        </g>
      );
    }
    if ((ld.type === 'udl' || ld.type === 'uvl') && ld.xStart !== undefined && ld.xEnd !== undefined) {
      const p1 = X(ld.xStart);
      const p2 = X(ld.xEnd);
      const wA = ld.type === 'udl' ? (ld.magnitude ?? 0) : (ld.wStart ?? 0);
      const wB = ld.type === 'udl' ? (ld.magnitude ?? 0) : (ld.wEnd ?? 0);
      const maxW = Math.max(Math.abs(wA), Math.abs(wB), 1);
      const hA = 10 + (Math.abs(wA) / maxW) * 30;
      const hB = 10 + (Math.abs(wB) / maxW) * 30;
      const n = Math.max(3, Math.min(14, Math.round((p2 - p1) / 26)));
      return (
        <g key={ld.id}>
          <polygon
            points={`${p1},${y - hA} ${p2},${y - hB} ${p2},${y - 3} ${p1},${y - 3}`}
            fill="var(--warn)"
            opacity={0.13}
            stroke="var(--warn)"
            strokeWidth={1.2}
          />
          {Array.from({ length: n }).map((_, i) => {
            const f = n === 1 ? 0 : i / (n - 1);
            const px = p1 + (p2 - p1) * (i + 0.5) / n;
            const hh = hA + (hB - hA) * f;
            return <line key={i} x1={px} y1={y - hh} x2={px} y2={y - 5} stroke="var(--warn)" strokeWidth={1.5} />;
          })}
          <text x={(p1 + p2) / 2} y={y - Math.max(hA, hB) - 5} fontSize={10} fontWeight={800} fill="var(--warn)" textAnchor="middle">
            {ld.type === 'udl' ? `${wA} kN/m` : `${wA}→${wB} kN/m`}
          </text>
          <circle cx={p1} cy={y - hA} r={8} fill="var(--surface)" stroke="var(--warn)" strokeWidth={2} style={{ cursor: 'ew-resize' }} onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'rangeL', id: ld.id }); }} />
          <circle cx={p2} cy={y - hB} r={8} fill="var(--surface)" stroke="var(--warn)" strokeWidth={2} style={{ cursor: 'ew-resize' }} onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'rangeR', id: ld.id }); }} />
        </g>
      );
    }
    return null;
  };

  const resultant = useMemo(() => model.loads.reduce((sum, l) => {
    if (l.type === 'point') return sum + Math.abs(l.magnitude ?? 0);
    if (l.type === 'udl') return sum + Math.abs((l.magnitude ?? 0) * ((l.xEnd ?? 0) - (l.xStart ?? 0)));
    if (l.type === 'uvl') {
      const b = (l.xEnd ?? 0) - (l.xStart ?? 0);
      // area of the trapezoid = average intensity × base, not half of each end
      return sum + 0.5 * (Math.abs(l.wStart ?? 0) + Math.abs(l.wEnd ?? 0)) * b;
    }
    return sum;
  }, 0), [model.loads]);

  return (
    <div className="space-y-2.5">
      {/* mini interactive strip */}
      <div className="rounded-xl overflow-hidden blueprint" style={{ border: '1px solid var(--line)' }}>
        <div className="scroll-x">
        <div className="beamstrip" style={{ minWidth: 560 }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full block"
          style={{ touchAction: 'none' }}
          onPointerMove={onMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          {/* the member itself: drawn as a real depth, with a top face and a shadow */}
          {(() => {
            const h = 13;
            return (
              <g>
                <rect x={X(0)} y={beamY - h / 2} width={Math.max(2, X(L) - X(0))} height={h} rx={2} fill="var(--ink)" />
                <rect x={X(0)} y={beamY - h / 2} width={Math.max(2, X(L) - X(0))} height={3} rx={1.5} fill="var(--surface)" opacity={0.22} />
                <line x1={X(0)} y1={beamY + h / 2 + 2} x2={X(L)} y2={beamY + h / 2 + 2} stroke="var(--ink)" strokeWidth={1} opacity={0.16} />
              </g>
            );
          })()}
          {/* span dimension with arrow heads */}
          <g opacity={0.9}>
            <line x1={X(0)} y1={beamY + 54} x2={X(L) / 2 - 16} y2={beamY + 54} stroke="var(--ink-3)" strokeWidth={1} />
            <line x1={X(L) / 2 + 16} y1={beamY + 54} x2={X(L)} y2={beamY + 54} stroke="var(--ink-3)" strokeWidth={1} />
            <path d={`M${X(0)} ${beamY + 54} l6 -2.6 l0 5.2 Z`} fill="var(--ink-3)" />
            <path d={`M${X(L)} ${beamY + 54} l-6 -2.6 l0 5.2 Z`} fill="var(--ink-3)" />
            <line x1={X(0)} y1={beamY + 9} x2={X(0)} y2={beamY + 57} stroke="var(--ink-3)" strokeWidth={0.8} opacity={0.5} />
            <line x1={X(L)} y1={beamY + 9} x2={X(L)} y2={beamY + 57} stroke="var(--ink-3)" strokeWidth={0.8} opacity={0.5} />
          </g>
          {/* dimension */}
          <line x1={X(0)} y1={beamY + 56} x2={X(L)} y2={beamY + 56} stroke="var(--ink-3)" strokeWidth={1} markerEnd="" />
          <text x={X(L / 2)} y={beamY + 52} fontSize={10.5} fill="var(--ink-3)" textAnchor="middle" fontWeight={700}>
            L = {L} m
          </text>
          {/* hinges */}
          {model.hinges.map((h) => {
            const px = X(h.x);
            return (
              <g key={h.id} style={{ cursor: 'ew-resize' }} onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'hinge', id: h.id }); }}>
                <circle cx={px} cy={beamY} r={8} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2.4} />
                <circle cx={px} cy={beamY} r={2.6} fill="var(--accent)" />
                <text x={px} y={beamY - 12} fontSize={9} fill="var(--accent)" textAnchor="middle" fontWeight={800}>
                  hinge
                </text>
              </g>
            );
          })}
          {model.supports.map((s) => (
            <g key={s.id} style={{ cursor: 'ew-resize' }} onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'support', id: s.id }); }}>
              <rect x={X(s.x) - 14} y={beamY - 10} width={28} height={44} fill="transparent" />
              {supportGlyph(s, X(s.x))}
              <text x={X(s.x)} y={beamY - 8} fontSize={10.5} fill="var(--ink)" textAnchor="middle" fontWeight={800}>
                {supportLabel(s)}
              </text>
            </g>
          ))}
          {model.loads.map((ld) => loadGlyph(ld))}
          {model.supports.length === 0 && (
            <text x={VW / 2} y={beamY - 32} fontSize={12} fill="var(--warn)" textAnchor="middle" fontWeight={700}>
              No supports yet, add a pin + roller below to make the beam stable
            </text>
          )}
        </svg>
        </div>
        </div>
      </div>

      {/* add toolbars, each group carries its own one-line "what this does" */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide mr-1" style={{ color: 'var(--ink-3)' }}>
            Supports
          </span>
          {([
            { t: 'pin' as SupportType, tip: 'Pin: holds x and y, lets rotation through. Adds 2 unknowns.' },
            { t: 'roller' as SupportType, tip: 'Roller: holds y only. Adds 1 unknown and the beam can slide sideways.' },
            { t: 'fixed' as SupportType, tip: 'Fixed: holds x, y and rotation. Adds 3 unknowns and a hogging moment at the end.' },
            { t: 'guided' as SupportType, tip: 'Guided: holds rotation and x, allows vertical slip. Adds 2 unknowns.' },
            { t: 'spring' as SupportType, tip: 'Spring: reaction is k times the deflection, so the answer is iterative.' },
          ]).map(({ t, tip }) => (
            <button
              key={t}
              title={tip}
              onClick={() => addSupport(t)}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-semibold capitalize"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)' }}
            >
              <Plus className="w-2.5 h-2.5" /> <span className="capitalize">{t}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide mr-1" style={{ color: 'var(--ink-3)' }}>
            Loads
          </span>
          {(
            [
              { t: 'point' as const, label: 'Point', tip: 'Point load: a single force. V jumps here, M gets a kink.', icon: <TriangleRight className="w-2.5 h-2.5" /> },
              { t: 'udl' as const, label: 'UDL', tip: 'UDL: constant w over a patch. V slopes, M is a parabola, total = w × length.', icon: <Waves className="w-2.5 h-2.5" /> },
              { t: 'uvl' as const, label: 'UVL', tip: 'UVL: linearly varying w. V is a parabola and M a cubic.', icon: <Waves className="w-2.5 h-2.5" /> },
              { t: 'moment' as const, label: 'Moment', tip: 'Applied couple: M jumps, V does not move at all.', icon: <RotateCw className="w-2.5 h-2.5" /> },
            ]
          ).map((x) => (
            <button
              key={x.t}
              onClick={() => addLoad(x.t)}
              title={x.tip}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-semibold"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)', color: 'var(--warn)' }}
            >
              <Plus className="w-2.5 h-2.5" /> {x.label}
            </button>
          ))}
          <button
            onClick={() => onChange({ ...model, hinges: [...model.hinges, { id: `h_${uid()}`, x: Math.round((L / 2) * 4) / 4 }] })}
            title="Internal hinge: M = 0 there, slope is allowed to kink. Each hinge drops Ds by one."
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-semibold"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)', color: 'var(--accent)' }}
          >
            <Link2 className="w-2.5 h-2.5" /> Hinge
          </button>
        </div>
      </div>

      {/* numeric rows, each row is a two-line card so the delete control and the
          last numeric field can never be pushed outside the panel */}
      <div className="space-y-1.5">
        {model.supports.map((s, si) => (
          <div key={s.id} className="rounded-lg p-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => {
                    if (si === 0) return;
                    const arr = [...model.supports];
                    [arr[si - 1], arr[si]] = [arr[si], arr[si - 1]];
                    onChange({ ...model, supports: arr });
                  }}
                  className="text-[8px] leading-none px-1"
                  style={{ color: 'var(--ink-3)' }}
                  title="Move up"
                  aria-label="Move support up"
                >▲</button>
                <button
                  onClick={() => {
                    if (si === model.supports.length - 1) return;
                    const arr = [...model.supports];
                    [arr[si + 1], arr[si]] = [arr[si], arr[si + 1]];
                    onChange({ ...model, supports: arr });
                  }}
                  className="text-[8px] leading-none px-1"
                  style={{ color: 'var(--ink-3)' }}
                  title="Move down"
                  aria-label="Move support down"
                >▼</button>
              </div>
              <input
                value={s.label ?? ''}
                onChange={(e) => setSupport(s.id, { label: e.target.value })}
                className="num w-9 shrink-0 rounded-md bg-transparent text-[13px] font-extrabold text-center outline-none border-b-2"
                style={{ borderColor: 'var(--line-strong)' }}
                aria-label="Support name"
              />
              <select
                value={s.type}
                onChange={(e) => setSupport(s.id, { type: e.target.value as SupportType })}
                className="flex-1 min-w-0 rounded-md bg-transparent text-[11.5px] font-semibold outline-none"
                aria-label="Support type"
              >
                {(['pin', 'roller', 'fixed', 'guided', 'spring'] as SupportType[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                onClick={() => onChange({ ...model, supports: model.supports.filter((x) => x.id !== s.id) })}
                className="p-1 rounded shrink-0"
                style={{ color: 'var(--compression)' }}
                title="Delete support"
                aria-label="Delete support"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              <div>
                <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>x (m)</span>
                <NumInput compact value={s.x} step={0.25} min={0} max={L} onChange={(v) => setSupport(s.id, { x: Math.max(0, Math.min(L, v)) })} />
              </div>
              {(s.type === 'pin' || s.type === 'roller' || s.type === 'fixed' || s.type === 'guided') && (
                <div>
                  <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>Settlement (mm)</span>
                  <NumInput compact value={s.settlementMm ?? 0} step={1} onChange={(v) => setSupport(s.id, { settlementMm: v })} />
                </div>
              )}
              {s.type === 'spring' && (
                <div>
                  <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>k (kN/m)</span>
                  <NumInput compact value={s.springK ?? 2000} step={100} onChange={(v) => setSupport(s.id, { springK: Math.max(50, v) })} />
                </div>
              )}
            </div>
          </div>
        ))}

        {model.loads.map((ld, li) => {
          const udlResultant =
            ld.type === 'udl'
              ? Math.abs((ld.magnitude ?? 0) * ((ld.xEnd ?? 0) - (ld.xStart ?? 0)))
              : 0.5 * (Math.abs(ld.wStart ?? 0) + Math.abs(ld.wEnd ?? 0)) * ((ld.xEnd ?? 0) - (ld.xStart ?? 0));
          return (
            <div key={ld.id} className="rounded-lg p-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <div className="flex items-center gap-1.5">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => {
                      if (li === 0) return;
                      const arr = [...model.loads];
                      [arr[li - 1], arr[li]] = [arr[li], arr[li - 1]];
                      onChange({ ...model, loads: arr });
                    }}
                    className="text-[8px] leading-none px-1"
                    style={{ color: 'var(--ink-3)' }}
                    title="Move up"
                    aria-label="Move load up"
                  >▲</button>
                  <button
                    onClick={() => {
                      if (li === model.loads.length - 1) return;
                      const arr = [...model.loads];
                      [arr[li + 1], arr[li]] = [arr[li], arr[li + 1]];
                      onChange({ ...model, loads: arr });
                    }}
                    className="text-[8px] leading-none px-1"
                    style={{ color: 'var(--ink-3)' }}
                    title="Move down"
                    aria-label="Move load down"
                  >▼</button>
                </div>
                <Badge tone="amber">{ld.type.toUpperCase()}</Badge>
                <span className="text-[10px] num truncate" style={{ color: 'var(--ink-3)' }}>
                  {ld.type === 'point' && `${fmt(ld.magnitude ?? 0, 1)} kN`}
                  {ld.type === 'moment' && `${fmt(ld.magnitude ?? 0, 1)} kN·m`}
                  {ld.type === 'udl' && `${fmt(ld.magnitude ?? 0, 1)} kN/m`}
                  {ld.type === 'uvl' && `${fmt(ld.wStart ?? 0, 1)} → ${fmt(ld.wEnd ?? 0, 1)} kN/m`}
                </span>
                <button
                  onClick={() => onChange({ ...model, loads: model.loads.filter((x) => x.id !== ld.id) })}
                  className="ml-auto p-1 rounded shrink-0"
                  style={{ color: 'var(--compression)' }}
                  title="Delete load"
                  aria-label="Delete load"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className={`grid gap-1.5 mt-1.5 ${ld.type === 'udl' ? 'grid-cols-3' : ld.type === 'uvl' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                {(ld.type === 'point' || ld.type === 'moment') && (
                  <>
                    <div>
                      <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>x (m)</span>
                      <NumInput compact value={ld.x ?? 0} step={0.25} onChange={(v) => setLoad(ld.id, { x: Math.max(0, Math.min(L, v)) })} />
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>
                        {ld.type === 'point' ? 'P (kN ↓+)' : 'M (kN·m CW+)'}
                      </span>
                      <NumInput compact value={ld.magnitude ?? 0} step={1} onChange={(v) => setLoad(ld.id, { magnitude: v })} />
                    </div>
                  </>
                )}
                {(ld.type === 'udl' || ld.type === 'uvl') && (
                  <>
                    <div>
                      <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>from (m)</span>
                      <NumInput compact value={ld.xStart ?? 0} step={0.25} onChange={(v) => setLoad(ld.id, { xStart: Math.max(0, Math.min((ld.xEnd ?? L) - 0.25, v)) })} />
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>to (m)</span>
                      <NumInput compact value={ld.xEnd ?? L} step={0.25} onChange={(v) => setLoad(ld.id, { xEnd: Math.min(L, Math.max((ld.xStart ?? 0) + 0.25, v)) })} />
                    </div>
                    {ld.type === 'udl' ? (
                      <div>
                        <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>w (kN/m)</span>
                        <NumInput compact value={ld.magnitude ?? 0} step={1} onChange={(v) => setLoad(ld.id, { magnitude: v })} />
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>w₁ start</span>
                          <NumInput compact value={ld.wStart ?? 0} step={1} onChange={(v) => setLoad(ld.id, { wStart: v })} />
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>w₂ end</span>
                          <NumInput compact value={ld.wEnd ?? 0} step={1} onChange={(v) => setLoad(ld.id, { wEnd: v })} />
                        </div>
                        <div className="col-span-2 text-[10px] num rounded-md px-1.5 py-1" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
                          Resultant R = ½(w₁+w₂)·L = {fmt(udlResultant, 1)} kN at the trapezoid centroid
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {model.hinges.map((h) => (
          <div key={h.id} className="rounded-lg p-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <div className="flex items-center gap-1.5">
              <Badge tone="blue">INTERNAL HINGE</Badge>
              <span className="text-[10px]" style={{ color: 'var(--ink-3)' }}>M = 0 here • slope kink allowed</span>
              <button
                onClick={() => onChange({ ...model, hinges: model.hinges.filter((x) => x.id !== h.id) })}
                className="ml-auto p-1 rounded"
                style={{ color: 'var(--compression)' }}
                title="Delete hinge"
                aria-label="Delete hinge"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-1.5">
              <span className="block text-[9px] font-bold uppercase mb-0.5" style={{ color: 'var(--ink-3)' }}>x (m)</span>
              <NumInput compact value={h.x} step={0.25} onChange={(v) => onChange({ ...model, hinges: model.hinges.map((k) => (k.id === h.id ? { ...k, x: Math.max(0.1, Math.min(L - 0.1, v)) } : k)) })} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
        <span className="flex items-center gap-1"><Anchor className="w-3 h-3" /> {model.supports.length} supports</span>
        <span className="num">Σ vertical applied load ≈ {fmt(resultant, 1)} kN</span>
        {showMarks && <span className="ml-auto">Drag supports / hinges / loads directly on the diagram</span>}
      </div>
    </div>
  );
};
