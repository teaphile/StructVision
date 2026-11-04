import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Brush, Layers, MoveRight, PencilRuler, Plus, Scissors, Trash2, Wand2, Wind } from 'lucide-react';
import { NodeSupport2D, Structure2DModel } from '../engine/frameTrussEngine';
import { auditStructureEquilibrium, inspectFrameMember } from '../engine/shared';
import { STRUCTURE_2D_PRESETS } from '../engine/presets';
import { DEFAULT_SPEC, PARAMETRIC_PRESETS, ParametricSpec, buildParametric } from '../engine/parametric';
import { useAnalysis } from '../ui/AnalysisContext';
import { CanvasEditor, CanvasTool, PickSel, makeTransform } from '../ui/CanvasEditor';
import { Plot } from '../ui/DiagramPlot';
import { Acc, Badge, Btn, Card, Field, Hint, NumInput, Segmented, Slider, Stat, Toggle, fmt, uid } from '../ui/primitives';

const VW = 1200;
const VH = 700;

/* ------------------------------------------------------------------ */
/*  Result overlay: deformed shape + load path + frame BMD            */
/* ------------------------------------------------------------------ */

const ResultView: React.FC<{
  onPick: (s: PickSel) => void;
  sel: PickSel;
  showBMD: boolean;
  showFlow: boolean;
  deformScale: number;
  showReactions: boolean;
  showLabels: boolean;
  filter: 'all' | 'tension' | 'compression' | 'zero';
}> = ({ onPick, sel, showBMD, showFlow, deformScale, showReactions, showLabels, filter }) => {
  const { struct, structRes: res, hideAnswers } = useAnalysis();
  const q = (v: React.ReactNode) => (hideAnswers ? '•••' : v);
  const base = useMemo(() => makeTransform(struct), [struct]);
  const nodeMap = useMemo(() => new Map(struct.nodes.map((n) => [n.id, n])), [struct]);
  const maxDisp = Math.max(1e-6, res.maxDisp_mm);
  const maxReaction = Math.max(1, ...res.nodes.map((n) => Math.max(Math.abs(n.Rx), Math.abs(n.Ry))));
  // The viewBox is fixed at 1200 x 700, so every fixed-size glyph has to be converted
  // through the real rendered width, otherwise a phone gets 4 px labels.
  const boxRef = useRef<SVGSVGElement>(null);
  const [cssW, setCssW] = useState(VW);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setCssW(el.getBoundingClientRect().width || VW);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const u = Math.max(1, VW / Math.max(120, cssW)); // viewBox units per CSS pixel
  // Displacements are millimetres on a metre-scale drawing, so they need an honest exaggeration.
  // deform x1 ⇒ the largest displacement is drawn as 5% of the span; the slider multiplies that.
  // (The old code divided by maxDisp, which cancelled the displacement out and left it invisible.)
  const exag = (deformScale * 0.012 * base.bounds.spanX) / Math.max(1e-9, maxDisp / 1000);

  // zoom the result to the drawing (labels + reactions need breathing room)
  const t = useMemo(() => {
    const b = base.bounds;
    const scale = Math.max(8, Math.min(200, Math.min((VW - 150) / b.spanX, (VH - 190) / b.spanY)));
    const ox = 75 + (VW - 150 - b.spanX * scale) / 2;
    const oy = 95 + (VH - 190 - b.spanY * scale) / 2;
    return {
      ...base,
      scale,
      toS: (x: number, y: number) => ({ x: ox + (x - b.minX) * scale, y: oy + (b.spanY - (y - b.minY)) * scale }),
    };
  }, [base]);

  // labels, reactions and arrow heads are drawn at a constant screen size:
  // the 1200-unit viewBox is rendered ≈1000 CSS px wide ⇒ ~1.2 viewBox units per CSS pixel
  const F = (px: number) => px * u;

  return (
    <svg ref={boxRef} viewBox={`0 0 ${VW} ${VH}`} className="w-full block select-none no-hit-text" style={{ maxHeight: 480, touchAction: 'manipulation' }}>
      {/* undeformed reference, the true geometry, so bow and sway are read against it */}
      {struct.members.map((m) => {
        const a = nodeMap.get(m.startNodeId);
        const b = nodeMap.get(m.endNodeId);
        if (!a || !b) return null;
        const p1 = t.toS(a.x, a.y);
        const p2 = t.toS(b.x, b.y);
        return <line key={`u${m.id}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--line-strong)" strokeWidth={1.2} strokeDasharray="5 5" opacity={0.75} />;
      })}

      {/* deformed shape, drawn first, thicker than the axial colour line so sway is visible */}
      {res.members.map((m) => {
        const pts = m.samples.map((s2) => t.toS(s2.xOrig + s2.dx_m * exag, s2.yOrig + s2.dy_m * exag));
        const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        const dimmed = filter !== 'all' && m.state !== filter;
        return (
          <path
            key={`def${m.id}`}
            d={d}
            fill="none"
            stroke="var(--sagging)"
            strokeWidth={F(2.4)}
            strokeDasharray="1 0"
            strokeLinecap="round"
            opacity={showBMD ? 0.16 : dimmed ? 0.1 : 0.62}
          />
        );
      })}

      {/* members with state colour */}
      {res.members.map((m) => {
        const md = struct.members.find((x) => x.id === m.id)!;
        if (!md) return null;
        const isSel = sel?.type === 'member' && sel.id === m.id;
        const dimmed = filter !== 'all' && m.state !== filter;
        const col = m.state === 'tension' ? 'var(--tension)' : m.state === 'compression' ? 'var(--compression)' : 'var(--ink-3)';
        const pts = m.samples.map((s) => t.toS(s.xOrig, s.yOrig));
        const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        return (
          <g key={m.id} opacity={dimmed ? 0.16 : 1}>
            {showFlow && !dimmed && (
              <path d={d} fill="none" stroke={col} strokeWidth={F(9)} opacity={showBMD ? 0.07 : 0.18} className="flow" />
            )}
            <path
              d={d}
              fill="none"
              stroke={isSel ? 'var(--warn)' : col}
              strokeWidth={F(isSel ? 6.5 : m.state === 'zero' ? 2.6 : 3.6)}
              strokeDasharray={m.state === 'zero' ? '8 7' : undefined}
              strokeLinecap="round"
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPick({ type: 'member', id: m.id });
              }}
            />
            {m.state === 'zero' && pts.length > 0 && (
              <text x={(pts[0].x + pts[pts.length - 1].x) / 2} y={(pts[0].y + pts[pts.length - 1].y) / 2 - F(5)} fontSize={F(11)} fontWeight={800} textAnchor="middle" fill="var(--ink-3)" pointerEvents="none">
                zero-force
              </text>
            )}
            {/* axial load arrows */}
            {Math.abs(m.axial_kN) > 1e-4 && !showBMD && m.samples.length > 4 && (() => {
              const mid = m.samples[Math.floor(m.samples.length / 2)];
              const p = t.toS(mid.xOrig, mid.yOrig);
              const ang = (Math.atan2(t.toS(mid.xOrig + 1, mid.yOrig + Math.tan((m.angleDeg * Math.PI) / 180)).y - p.y, t.toS(mid.xOrig + 1, mid.yOrig).x - p.x) * 180) / Math.PI;
              const mag = Math.min(46, Math.abs(m.axial_kN) * (44 / Math.max(1, res.maxAxialAbs)));
              const dir = m.state === 'tension' ? 1 : -1;
              return (
                <g transform={`rotate(${ang} ${p.x} ${p.y})`} opacity={0.95}>
                  <line x1={p.x - dir * 10} y1={p.y} x2={p.x - dir * (10 + mag)} y2={p.y} stroke={col} strokeWidth={2} />
                  <polygon points={`${p.x - dir * (10 + mag)},${p.y} ${p.x - dir * (10 + mag) + dir * 8},${p.y - 4} ${p.x - dir * (10 + mag) + dir * 8},${p.y + 4}`} fill={col} />
                  <line x1={p.x + dir * 10} y1={p.y} x2={p.x + dir * (10 + mag)} y2={p.y} stroke={col} strokeWidth={2} />
                  <polygon points={`${p.x + dir * (10 + mag)},${p.y} ${p.x + dir * (10 + mag) - dir * 8},${p.y - 4} ${p.x + dir * (10 + mag) - dir * 8},${p.y + 4}`} fill={col} />
                </g>
              );
            })()}
            {showLabels && !hideAnswers && (
              <text
                x={(pts[0].x + pts[pts.length - 1].x) / 2}
                y={(pts[0].y + pts[pts.length - 1].y) / 2 + 14}
                fontSize={F(11.5)}
                fontWeight={800}
                textAnchor="middle"
                fill={col}
                paintOrder="stroke"
                stroke="var(--canvas)"
                strokeWidth={F(4)}
               pointerEvents="none">
                {m.label} {Math.abs(m.axial_kN) > 1e-4 ? `${fmt(Math.abs(m.axial_kN), 1)} kN` : ''}
              </text>
            )}
          </g>
        );
      })}

      {/* frame BMD overlay */}
      {showBMD && res.maxMomentAbs > 1e-6 &&
        res.members.map((m) => {
          if (m.maxAbsM < 1e-6) return null;
          const md = struct.members.find((x) => x.id === m.id)!;
          const scale = F(30) / res.maxMomentAbs;
          const angle = (Math.atan2(
            (nodeMap.get(md.endNodeId)?.y ?? 0) - (nodeMap.get(md.startNodeId)?.y ?? 0),
            (nodeMap.get(md.endNodeId)?.x ?? 0) - (nodeMap.get(md.startNodeId)?.x ?? 0)
          ) * 180) / Math.PI;
          const nx = Math.sin((angle * Math.PI) / 180);
          const ny = -Math.cos((angle * Math.PI) / 180);
          const pts = m.samples.map((s) => {
            const o = t.toS(s.xOrig, s.yOrig);
            return { x: o.x + nx * s.M * scale, y: o.y + ny * s.M * scale };
          });
          const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          const base = m.samples.map((s) => {
            const o = t.toS(s.xOrig, s.yOrig);
            return o;
          });
          const area = `${d} L ${base[base.length - 1].x.toFixed(1)} ${base[base.length - 1].y.toFixed(1)} L ${base[0].x.toFixed(1)} ${base[0].y.toFixed(1)} Z`;
          return (
            <g key={`bmd${m.id}`}>
              <path d={area} fill="var(--sagging)" opacity={0.1} />
              <path d={d} fill="none" stroke="var(--sagging)" strokeWidth={F(1.6)} opacity={0.85} />
            </g>
          );
        })}

      {/* sway callout, the number everyone asks for when a frame is pushed sideways */}
      {(() => {
        if (hideAnswers) return null;
        const free = struct.nodes.filter((n) => n.support === 'free');
        if (!free.length) return null;
        const withU = free
          .map((n) => ({ n, nr: res.nodes.find((x) => x.id === n.id) }))
          .filter((x) => x.nr);
        if (!withU.length) return null;
        const worst = withU.reduce((a, b) => (Math.abs(b.nr!.ux_mm) > Math.abs(a.nr!.ux_mm) ? b : a));
        if (Math.abs(worst.nr!.ux_mm) < 0.05) return null;
        const p = t.toS(worst.n.x, worst.n.y);
        const q = t.toS(worst.n.x - worst.nr!.ux_mm / 1000, worst.n.y);
        const rightHalf = p.x > VW / 2;
        const ty = Math.max(F(13), Math.min(VH - F(10), p.y - F(22)));
        return (
          <g opacity={0.95}>
            {/* the drift itself, magnified by the same factor as the deformed trace */}
            <line x1={p.x} y1={p.y} x2={q.x} y2={p.y} stroke="var(--warn)" strokeWidth={F(1.6)} />
            <line x1={p.x} y1={p.y - F(5)} x2={p.x} y2={p.y + F(5)} stroke="var(--warn)" strokeWidth={F(1.3)} />
            <line x1={q.x} y1={p.y - F(5)} x2={q.x} y2={p.y + F(5)} stroke="var(--warn)" strokeWidth={F(1.3)} />
            <line x1={p.x} y1={p.y - F(6)} x2={p.x} y2={ty + F(3)} stroke="var(--warn)" strokeWidth={F(0.8)} strokeDasharray="2 3" opacity={0.75} />
            <text
              x={p.x + (rightHalf ? -F(5) : F(5))}
              y={ty}
              fontSize={F(10)}
              fontWeight={800}
              textAnchor={rightHalf ? 'end' : 'start'}
              fill="var(--warn)"
              paintOrder="stroke"
              stroke="var(--canvas)"
              strokeWidth={F(3.4)}
             pointerEvents="none">
              sway {fmt(Math.abs(worst.nr!.ux_mm), 2)} mm (×{fmt(deformScale, 1)} exaggerated)
            </text>
          </g>
        );
      })()}

      {/* nodes + supports + loads */}
      {struct.nodes.map((n) => {
        const nr = res.nodes.find((x) => x.id === n.id)!;
        const p = t.toS(n.x, n.y);
        const isSel = sel?.type === 'node' && sel.id === n.id;
        return (
          <g key={n.id}>
            <rect x={p.x - 5} y={p.y - 5} width={10} height={10} rx={2} fill={isSel ? 'var(--warn)' : 'var(--accent)'} stroke="var(--canvas)" strokeWidth={1.5} />
            {n.support !== 'free' && (
              <g opacity={0.95}>
                {n.support === 'fixed' ? (
                  <>
                    <line x1={p.x - 14} y1={p.y + 12} x2={p.x + 14} y2={p.y + 12} stroke="var(--ink-2)" strokeWidth={2} />
                    {[-11, -5, 1, 7].map((d, i) => (
                      <line key={i} x1={p.x + d} y1={p.y + 12} x2={p.x + d - 4} y2={p.y + 18} stroke="var(--ink-2)" strokeWidth={1.2} />
                    ))}
                  </>
                ) : n.support === 'pin' ? (
                  <>
                    <polygon points={`${p.x},${p.y + 6} ${p.x - 7},${p.y + 16} ${p.x + 7},${p.y + 16}`} fill="var(--canvas)" stroke="var(--ink-2)" strokeWidth={1.6} />
                    <line x1={p.x - 9} y1={p.y + 16} x2={p.x + 9} y2={p.y + 16} stroke="var(--ink-2)" strokeWidth={1.8} />
                  </>
                ) : (
                  <>
                    <polygon points={`${p.x},${p.y + 6} ${p.x - 7},${p.y + 14} ${p.x + 7},${p.y + 14}`} fill="var(--canvas)" stroke="var(--ink-2)" strokeWidth={1.6} />
                    <circle cx={p.x - 3.5} cy={p.y + 17} r={2.8} fill="var(--canvas)" stroke="var(--ink-2)" strokeWidth={1.3} />
                    <circle cx={p.x + 3.5} cy={p.y + 17} r={2.8} fill="var(--canvas)" stroke="var(--ink-2)" strokeWidth={1.3} />
                  </>
                )}
              </g>
            )}
            <text x={p.x + F(9)} y={p.y - F(8)} fontSize={F(12)} fontWeight={800} fill={isSel ? 'var(--warn)' : 'var(--ink)'} paintOrder="stroke" stroke="var(--canvas)" strokeWidth={F(4)} pointerEvents="none">
              {n.label}
            </text>
            {showReactions && (Math.abs(nr.Rx) > 1e-3 || Math.abs(nr.Ry) > 1e-3 || Math.abs(nr.Mz) > 1e-3) && (
              <g>
                {Math.abs(nr.Ry) > 1e-3 && (() => {
                  // Positive Ry pushes the joint up: arrow tail below, head at the
                  // support. Drawn outside the support glyph so nothing is covered.
                  const len = F(16 + Math.min(1, Math.abs(nr.Ry) / Math.max(1, maxReaction)) * 26);
                  const yTip = p.y + 22;
                  const up = nr.Ry > 0;
                  return (
                    <g>
                      <line x1={p.x} y1={up ? yTip + len : yTip} x2={p.x} y2={up ? yTip : yTip + len} stroke="var(--ok)" strokeWidth={F(2)} strokeLinecap="round" />
                      <polygon
                        points={
                          up
                            ? `${p.x},${yTip} ${p.x - F(4)},${yTip + F(8)} ${p.x + F(4)},${yTip + F(8)}`
                            : `${p.x},${yTip + len} ${p.x - F(4)},${yTip + len - F(8)} ${p.x + F(4)},${yTip + len - F(8)}`
                        }
                        fill="var(--ok)"
                      />
                      <text x={p.x + F(6)} y={yTip + len / 2 + F(3)} fontSize={F(10.5)} fontWeight={800} fill="var(--ok)" paintOrder="stroke" stroke="var(--canvas)" strokeWidth={F(3)} pointerEvents="none">
                        {q(fmt(nr.Ry, 1))}
                      </text>
                    </g>
                  );
                })()}
                {Math.abs(nr.Rx) > 1e-3 && (() => {
                  const len = F(16 + Math.min(1, Math.abs(nr.Rx) / Math.max(1, maxReaction)) * 22);
                  const x0 = p.x + 22;
                  const right = nr.Rx > 0;
                  const xTip = right ? x0 + len : x0 - len;
                  return (
                    <g>
                      <line x1={x0} y1={p.y} x2={xTip} y2={p.y} stroke="var(--ok)" strokeWidth={F(2)} strokeLinecap="round" />
                      <polygon
                        points={
                          right
                            ? `${xTip},${p.y} ${xTip - F(8)},${p.y - F(4)} ${xTip - F(8)},${p.y + F(4)}`
                            : `${xTip},${p.y} ${xTip + F(8)},${p.y - F(4)} ${xTip + F(8)},${p.y + F(4)}`
                        }
                        fill="var(--ok)"
                      />
                      <text x={right ? xTip + F(3) : xTip - F(3)} y={p.y - F(8)} fontSize={F(10.5)} fontWeight={800} fill="var(--ok)" textAnchor={right ? 'start' : 'end'} paintOrder="stroke" stroke="var(--canvas)" strokeWidth={F(3)} pointerEvents="none">
                        {q(fmt(nr.Rx, 1))}
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */

const MODE_PRESETS = STRUCTURE_2D_PRESETS;

export const StructureModule: React.FC = () => {
  const { struct, setStruct, structRes: res, lang, setToSection, goto, toast, sectionDims, hideAnswers } = useAnalysis();
  const q = (v: string) => (hideAnswers ? '•••' : v);
  const [tool, setTool] = useState<CanvasTool>('select');
  const [sel, setSel] = useState<PickSel>(null);
  const [showBMD, setShowBMD] = useState(true);
  const [showFlow, setShowFlow] = useState(true);
  const [showReactions, setShowReactions] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [deformScale, setDeformScale] = useState(2);
  const [sRatio, setSRatio] = useState(0.5);
  const [mobileTab, setMobileTab] = useState<'model' | 'result'>('result');
  const [gen, setGen] = useState<ParametricSpec>(DEFAULT_SPEC);
  const [filter, setFilter] = useState<'all' | 'tension' | 'compression' | 'zero'>('all');

  const memberStates = useMemo(() => {
    const map: Record<string, 'tension' | 'compression' | 'zero'> = {};
    res.members.forEach((m) => (map[m.id] = m.state));
    return map;
  }, [res]);

  const selMemberData = sel?.type === 'member' ? struct.members.find((m) => m.id === sel.id) : undefined;
  const selNodeData = sel?.type === 'node' ? struct.nodes.find((n) => n.id === sel.id) : undefined;

  // hand-off always has a member to work on: the selected one, else the first drawn
  const cutMemberId = sel?.type === 'member' ? sel.id : struct.members[0]?.id;
  const cutIsFallback = sel?.type !== 'member';
  const cut = useMemo(
    () => (cutMemberId ? inspectFrameMember(struct, res, cutMemberId, sRatio) : null),
    [struct, res, cutMemberId, sRatio]
  );

  const patchNode = (id: string, p: Partial<(typeof struct.nodes)[number]>) =>
    setStruct({ ...struct, nodes: struct.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) });
  const patchMember = (id: string, p: Partial<(typeof struct.members)[number]>) =>
    setStruct({ ...struct, members: struct.members.map((m) => (m.id === id ? { ...m, ...p } : m)) });

  const audit = useMemo(() => auditStructureEquilibrium(struct, res), [struct, res]);

  const loadPreset = (id: string) => {
    const p = MODE_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setStruct(JSON.parse(JSON.stringify(p.model)));
    setSel(null);
    setTool('select');
    toast(`Loaded “${p.model.nameEn}”, drag any joint to make it your own.`, 'ok');
  };

  const blank = (mode: 'truss' | 'frame') => {
    const base: Structure2DModel = {
      nameEn: mode === 'truss' ? 'Blank truss' : 'Blank frame',
      nameHi: mode === 'truss' ? 'Khaali truss' : 'Khaali frame',
      mode,
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0, support: 'pin' },
        { id: 'n2', label: 'B', x: 6, y: 0, support: 'pin' },
        { id: 'n3', label: 'C', x: 3, y: 3, support: 'free', fy: -20 },
      ],
      members: [
        { id: 'm1', label: 'M1', startNodeId: 'n1', endNodeId: 'n3', E_GPa: 200, A_cm2: 20, I_cm4: 5000 },
        { id: 'm2', label: 'M2', startNodeId: 'n3', endNodeId: 'n2', E_GPa: 200, A_cm2: 20, I_cm4: 5000 },
      ],
    };
    setStruct(base);
    setSel(null);
    toast(`Blank ${mode} skeleton, tap “Add Node” then “Add Member” to build your own roof / panel.`, 'info');
  };

  const applySectionProps = () => {
    const A = sectionDims.A_cm2;
    const I = sectionDims.I_cm4;
    setStruct({ ...struct, members: struct.members.map((m) => ({ ...m, A_cm2: Math.round(A), I_cm4: Math.round(I) })) });
    toast(`All members now use A = ${Math.round(A)} cm², I = ${Math.round(I)} cm⁴ (from the section lab).`, 'ok');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(280px,330px)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,375px)_minmax(0,1fr)] gap-3">
      <div className="md:hidden -mb-1">
        <Segmented
          full
          value={mobileTab}
          onChange={setMobileTab}
          options={[
            { value: 'model', label: '① Draw & edit' },
            { value: 'result', label: '② Forces & diagram' },
          ]}
        />
      </div>

      {/* LEFT */}
      <div className={`space-y-2.5 ${mobileTab === 'model' ? 'block' : 'hidden md:block'}`}>
        <Card
          title="Draw the structure yourself"
          sub={lang === 'hinglish' ? 'Grid par tap karke joint daalein, phir joint-to-joint member kheench dein' : 'Tap the grid to drop joints, then link joints with members'}
          right={
            <Segmented
              size="sm"
              value={struct.mode}
              onChange={(m) => setStruct({ ...struct, mode: m })}
              options={[
                { value: 'truss', label: 'Truss' },
                { value: 'frame', label: 'Frame' },
              ]}
            />
          }
        >
          <CanvasEditor
            model={struct}
            onChange={setStruct}
            tool={tool}
            setTool={setTool}
            onPick={setSel}
            memberStates={memberStates}
            snap={0.5}
            compact
            height={400}
            labelScale={1}
          />
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Btn onClick={() => blank(struct.mode)} icon={<Brush className="w-3.5 h-3.5" />}>
              Blank canvas
            </Btn>
            <Btn onClick={() => loadPreset(MODE_PRESETS[0].id)} icon={<Wand2 className="w-3.5 h-3.5" />}>
              Load a template
            </Btn>
          </div>
        </Card>

        <Card
          title="Generate a structure from numbers"
          sub="Panels, height and loads in, a complete, editable frame or truss out"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Segmented
                size="sm"
                wrap
                value={gen.kind}
                onChange={(k) => setGen({ ...gen, kind: k })}
                options={PARAMETRIC_PRESETS.map((p) => ({ value: p.id, label: p.label, title: p.hint }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Bays / panels" hint="Repeats the bay sideways; each bay adds joints and members"><NumInput value={gen.bays} step={1} min={1} max={6} onChange={(v) => setGen({ ...gen, bays: Math.max(1, Math.min(6, Math.round(v))) })} /></Field>
              <Field label="Bay width" hint="Span of one bay, sets member length and the moment from P"><NumInput value={gen.bayWidth_m} step={0.5} min={1} onChange={(v) => setGen({ ...gen, bayWidth_m: Math.max(1, v) })} suffix="m" /></Field>
              <Field label={gen.kind === 'storey' ? 'Total height' : 'Height'}><NumInput value={gen.height_m} step={0.5} min={1} onChange={(v) => setGen({ ...gen, height_m: Math.max(1, v) })} suffix="m" /></Field>
              <Field label="Joint load P" hint="Gravity load applied at each loaded joint, downward"><NumInput value={gen.load_kN} step={5} min={0} onChange={(v) => setGen({ ...gen, load_kN: Math.max(0, v) })} suffix="kN" /></Field>
              <Field label="Lateral wind" hint="Horizontal push at the top, this is what makes a frame sway"><NumInput value={gen.wind_kN} step={2} min={0} onChange={(v) => setGen({ ...gen, wind_kN: Math.max(0, v) })} suffix="kN" /></Field>
              {gen.kind === 'roof' && (
                <Field label="Roof rise" hint="Height of the ridge above the eaves; 0 gives a flat truss"><NumInput value={gen.rise_m} step={0.2} min={0} onChange={(v) => setGen({ ...gen, rise_m: Math.max(0, v) })} suffix="m" /></Field>
              )}
            </div>
            <Toggle checked={gen.brace} onChange={(v) => setGen({ ...gen, brace: v })} label="Add one diagonal brace" hint="Try the same structure with and without it, Ds and sway both change" />
            <div className="flex flex-wrap gap-1.5">
              <Btn
                variant="primary"
                size="md"
                icon={<PencilRuler className="w-4 h-4" />}
                onClick={() => {
                  const m = buildParametric(gen);
                  setStruct(m);
                  setSel(null);
                  setTool('select');
                  toast(`Generated “${m.nameEn}”, ${m.nodes.length} joints, ${m.members.length} members. Drag any joint to customise.`, 'ok');
                }}
              >
                Generate this structure
              </Btn>
              <Btn onClick={() => setGen(DEFAULT_SPEC)}>Reset inputs</Btn>
            </div>
            <div className="text-[10px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              {PARAMETRIC_PRESETS.find((p) => p.id === gen.kind)?.hint}
            </div>
          </div>
        </Card>

        {/* inspector of current pick */}
        {selNodeData && (
          <Card title={`Joint ${selNodeData.label}`} sub="Coordinates, support & nodal load">
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Label">
                <input
                  value={selNodeData.label}
                  onChange={(e) => patchNode(selNodeData.id, { label: e.target.value })}
                  className="num w-full rounded-lg px-2 py-1.5 text-[12px] font-bold"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)' }}
                />
              </Field>
              <Field label="Support">
                <select
                  value={selNodeData.support}
                  onChange={(e) => patchNode(selNodeData.id, { support: e.target.value as NodeSupport2D })}
                  className="w-full rounded-lg px-1.5 py-1.5 text-[11.5px] font-semibold"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)' }}
                >
                  {(['free', 'pin', 'roller_x', 'roller_y', 'fixed'] as NodeSupport2D[]).map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="x (m)">
                <NumInput value={selNodeData.x} step={0.5} onChange={(v) => patchNode(selNodeData.id, { x: v })} />
              </Field>
              <Field label="y (m)">
                <NumInput value={selNodeData.y} step={0.5} onChange={(v) => patchNode(selNodeData.id, { y: v })} />
              </Field>
              <Field label="Px (kN →+)" hint="Lateral / wind / seismic push">
                <NumInput value={selNodeData.fx ?? 0} step={5} onChange={(v) => patchNode(selNodeData.id, { fx: v })} />
              </Field>
              <Field label="Py (kN ↑+)" hint="Use negative for gravity">
                <NumInput value={selNodeData.fy ?? 0} step={5} onChange={(v) => patchNode(selNodeData.id, { fy: v })} />
              </Field>
            </div>
            <div className="mt-1.5 rounded-lg p-2 text-[10.5px] num" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
              {(() => {
                const nr = res.nodes.find((n) => n.id === selNodeData.id);
                if (!nr) return 'Solve unavailable';
                return (
                  <>
                    δx = {fmt(nr.ux_mm, 2)} mm · δy = {fmt(nr.uy_mm, 2)} mm · θ = {fmt(nr.theta_mrad, 2)} mrad
                    <br />
                    Rx = {fmt(nr.Rx, 2)} kN · Ry = {fmt(nr.Ry, 2)} kN · M = {fmt(nr.Mz, 2)} kN·m
                  </>
                );
              })()}
            </div>
          </Card>
        )}

        {selMemberData && (
          <Card title={`Member ${selMemberData.label ?? ''}`} sub="Section stiffness & distributed load">
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="E (GPa)" hint="Per-member override, one weak member redistributes the whole force pattern">
                <NumInput value={selMemberData.E_GPa ?? 200} step={5} onChange={(v) => patchMember(selMemberData.id, { E_GPa: v })} />
              </Field>
              <Field label="A (cm²)" hint="Carries the axial force; σ = N/A is what shows in the member roll-up">
                <NumInput value={selMemberData.A_cm2 ?? 40} step={5} onChange={(v) => patchMember(selMemberData.id, { A_cm2: Math.max(1, v) })} />
              </Field>
              <Field label="I (cm⁴)" hint={struct.mode === 'truss' ? 'Ignored in truss' : 'Bending stiffness'}>
                <NumInput value={selMemberData.I_cm4 ?? 8000} step={500} onChange={(v) => patchMember(selMemberData.id, { I_cm4: Math.max(10, v) })} />
              </Field>
              <Field label="w ⊥ member (kN/m)" hint="Downward on horizontal members">
                <NumInput value={selMemberData.wPerp_kNm ?? 0} step={1} onChange={(v) => patchMember(selMemberData.id, { wPerp_kNm: v })} />
              </Field>
            </div>
            {(() => {
              const mr = res.members.find((m) => m.id === selMemberData.id);
              if (!mr) return null;
              return (
                <div className="mt-1.5 rounded-lg p-2 text-[10.5px] num" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                  L = {fmt(mr.length_m, 2)} m · θ = {fmt(mr.angleDeg, 1)}° ·{' '}
                  <strong style={{ color: mr.state === 'tension' ? 'var(--tension)' : mr.state === 'compression' ? 'var(--compression)' : 'var(--ink-3)' }}>
                    N = {fmt(mr.axial_kN, 2)} kN ({mr.state})
                  </strong>
                  <br />
                  σ = N/A = {fmt(mr.stress_MPa, 1)} MPa · Mstart = {fmt(mr.M_start, 1)} · Mend = {fmt(mr.M_end, 1)} kN·m
                </div>
              );
            })()}
          </Card>
        )}

        <Acc title="Templates: trusses, portal frames, roof truss" sub="All editable, nothing locked" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-1.5">
            {MODE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => loadPreset(p.id)}
                className="text-left rounded-lg p-1.5 text-[10.5px] font-semibold leading-tight"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
              >
                <span className="block" style={{ color: 'var(--accent)' }}>{p.model.mode === 'truss' ? 'TRUSS' : 'FRAME'}</span>
                {p.model.nameEn}
              </button>
            ))}
          </div>
        </Acc>

        <Card title="Hand off" sub="Forces at the section you pick travel with you">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex-1 min-w-[190px]">
                <Slider label={cut ? `Section position on member ${cut.memberLabel}` : 'Section position on member'} value={sRatio} min={0.02} max={0.98} step={0.01} onChange={setSRatio} />
              </div>
              {cutIsFallback && cut && <Badge tone="amber">auto: member {cut.memberLabel}</Badge>}
            </div>
            <Btn
              variant="primary"
              size="md"
              icon={<Layers className="w-4 h-4" />}
              disabled={!cut}
              onClick={() => {
                if (!cut) return;
                setToSection({
                  M: cut.M_kNm,
                  V: cut.V_kN,
                  N: cut.N_kN,
                  x: cut.sRatio * cut.length_m,
                  source: `Member ${cut.memberLabel} at ${(cut.sRatio * 100).toFixed(0)}% (${cut.state})`,
                });
                goto('section');
                toast(`Member ${cut.memberLabel}: N = ${fmt(cut.N_kN, 1)} kN, M = ${fmt(cut.M_kNm, 1)} kN·m sent to the fibre lab.`, 'ok');
              }}
            >
              {cut
                ? `Send N ${q(fmt(cut.N_kN, 1))} / M ${q(fmt(cut.M_kNm, 1))} / V ${q(fmt(cut.V_kN, 1))}`
                : 'Select a member first'}
            </Btn>
            <Btn size="md" icon={<MoveRight className="w-4 h-4" />} onClick={applySectionProps}>
              Apply section lab A = {q(fmt(sectionDims.A_cm2, 0))} cm², I = {q(fmt(sectionDims.I_cm4, 0))} cm⁴ to all members
            </Btn>
          </div>
        </Card>
      </div>

      {/* RIGHT */}
      <div className={`space-y-2.5 ${mobileTab === 'result' ? 'block' : 'hidden md:block'}`}>
        {!res.isStable ? (
          <Card title="Structure is unstable (mechanism)">
            <Hint tone="warn">
              {lang === 'hinglish' ? res.instabilityMessageHi : res.instabilityMessageEn}
              <div className="mt-1 num">{res.determinacyFormula}</div>
            </Hint>
          </Card>
        ) : (
          <>
            <Card
              title="Deformed shape, axial state & load path"
              sub="Blue = tension, red = compression, dashed grey = zero-force member"
              right={
                <div className="flex items-center gap-1">
                  <Badge tone={res.Ds === 0 ? 'green' : 'amber'}>{res.Ds === 0 ? 'Determinate' : `Ds = ${res.Ds}`}</Badge>
                  <Badge tone="neutral">max δ {hideAnswers ? '•••' : fmt(res.maxDisp_mm, 2)} mm</Badge>
                </div>
              }
              pad={false}
            >
              <div className="p-1.5">
                <ResultView onPick={setSel} sel={sel} showBMD={showBMD} showFlow={showFlow} deformScale={deformScale} showReactions={showReactions} showLabels={showLabels} filter={filter} />
              </div>
              <div className="flex flex-wrap items-center gap-1 px-2.5 pb-1.5">
                <span className="text-[9.5px] font-bold uppercase tracking-wide mr-1" style={{ color: 'var(--ink-3)' }}>highlight</span>
                {([
                  ['all', 'all members'],
                  ['tension', `tension (${res.members.filter((m) => m.state === 'tension').length})`],
                  ['compression', `compression (${res.members.filter((m) => m.state === 'compression').length})`],
                  ['zero', `zero-force (${res.members.filter((m) => m.state === 'zero').length})`],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: filter === k ? 'var(--accent-soft)' : 'var(--surface-2)',
                      border: `1px solid ${filter === k ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--line)'}`,
                      color: filter === k ? 'var(--accent)' : 'var(--ink-2)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 pb-2">
                <Segmented
                  size="sm"
                  value={struct.mode}
                  onChange={(m) => setStruct({ ...struct, mode: m })}
                  options={[
                    { value: 'truss', label: 'Pin truss' },
                    { value: 'frame', label: 'Rigid frame' },
                  ]}
                />
                {[
                  { on: showBMD, set: setShowBMD, label: 'frame BMD' },
                  { on: showFlow, set: setShowFlow, label: 'load flow' },
                  { on: showReactions, set: setShowReactions, label: 'reactions' },
                  { on: showLabels, set: setShowLabels, label: 'labels' },
                ].map((c) => (
                  <label key={c.label} className="flex items-center gap-1 text-[10.5px] font-semibold cursor-pointer" style={{ color: 'var(--ink-2)' }}>
                    <input type="checkbox" checked={c.on} onChange={(e) => c.set(e.target.checked)} /> {c.label}
                  </label>
                ))}
                <div className="min-w-[130px] flex-1 sm:max-w-[190px]">
                  <Slider label="Deform ×" value={deformScale} min={0.5} max={12} step={0.5} onChange={setDeformScale} />
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <Stat label="Determinacy" value={res.determinacyFormula.split('=').pop()?.trim() ?? 'n/a'} unit="" tone={res.Ds === 0 ? 'ok' : 'warn'} />
              <Stat label="Dk (free DOF)" value={res.Dk} />
              <Stat label="Max |N|" value={fmt(res.maxAxialAbs, 1)} unit="kN" tone="accent" />
              <Stat label="Max |M|" value={fmt(res.maxMomentAbs, 1)} unit="kN·m" tone="warn" />
            </div>

            {/* member table */}
            <Card title="Member force table" sub="Tap any row to inspect it on the drawing">
              <div className="scroll-x">
                <table className="w-full text-[11px] num border-collapse">
                  <thead>
                    <tr style={{ color: 'var(--ink-3)' }}>
                      {['Member', 'L (m)', 'N (kN)', 'State', 'σ (MPa)', 'Mstart', 'Mend', '|M|max'].map((h) => (
                        <th key={h} className="text-left font-bold px-1.5 py-1 whitespace-nowrap border-b" style={{ borderColor: 'var(--line)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {res.members.map((m) => {
                      const on = sel?.type === 'member' && sel.id === m.id;
                      return (
                        <tr
                          key={m.id}
                          onClick={() => setSel({ type: 'member', id: m.id })}
                          className="cursor-pointer"
                          style={{ background: on ? 'var(--accent-soft)' : undefined }}
                        >
                          <td className="px-1.5 py-1 font-bold whitespace-nowrap">{m.label}</td>
                          <td className="px-1.5 py-1">{q(fmt(m.length_m, 2))}</td>
                          <td className="px-1.5 py-1 font-bold" style={{ color: m.state === 'tension' ? 'var(--tension)' : m.state === 'compression' ? 'var(--compression)' : 'var(--ink-3)' }}>
                            {q(fmt(m.axial_kN, 2))}
                          </td>
                          <td className="px-1.5 py-1">
                            <Badge tone={m.state === 'tension' ? 'blue' : m.state === 'compression' ? 'rose' : 'neutral'}>
                              {m.state === 'tension' ? 'T' : m.state === 'compression' ? 'C' : '0'}
                            </Badge>
                          </td>
                          <td className="px-1.5 py-1">{q(fmt(m.stress_MPa, 1))}</td>
                          <td className="px-1.5 py-1">{q(fmt(m.M_start, 1))}</td>
                          <td className="px-1.5 py-1">{q(fmt(m.M_end, 1))}</td>
                          <td className="px-1.5 py-1 font-bold">{q(fmt(m.maxAbsM, 1))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* member inspector */}
            {cut && (
              <Card
                title={`Member ${cut.memberLabel}, internal actions at any point`}
                sub="The beam lab, but along a rotated member of your drawn frame"
                right={<Badge tone="blue">s = {(cut.sRatio * 100).toFixed(0)}%</Badge>}
              >
                <div className="space-y-2">
                  <Slider label="Position along member" value={sRatio} min={0.02} max={0.98} step={0.01} onChange={setSRatio} />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <Stat label="N (axial)" value={fmt(cut.N_kN, 2)} unit="kN" tone={cut.state === 'tension' ? 'ok' : 'bad'} />
                    <Stat label="V (shear)" value={fmt(cut.V_kN, 2)} unit="kN" tone="accent" />
                    <Stat label="M (bending)" value={fmt(cut.M_kNm, 2)} unit="kN·m" tone="warn" />
                    <Stat label="w ⊥ member" value={fmt(cut.w, 1)} unit="kN/m" />
                  </div>
                  <Plot
                    points={res.members.find((m) => m.id === cut.memberId)!.samples.map((s) => ({ x: s.sRatio * cut.length_m, y: s.M }))}
                    L={cut.length_m}
                    title={`Bending moment along ${cut.memberLabel} (kN·m)`}
                    unit="kN·m"
                    color="var(--sagging)"
                    height={110}
                    cursorX={cut.sRatio * cut.length_m}
                    onCursor={(x) => setSRatio(Math.max(0.02, Math.min(0.98, x / cut.length_m)))}
                    hideValues={hideAnswers}
                  />
                </div>
              </Card>
            )}

            <Card
              title={
                <span className="flex items-center gap-1.5">
                  <BadgeCheck className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} /> Equilibrium audit & solver detail
                </span>
              }
              sub="Reactions are read from the assembled stiffness matrix, these checks are recomputed from scratch"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {audit.map((a) => (
                  <div key={a.label} className="rounded-lg p-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                    <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--ink-3)' }}>{a.label}</div>
                    <div className="num text-[12px] font-extrabold">{fmt(a.reacted, 3)} {a.unit}</div>
                    <div className="num text-[10px] font-bold" style={{ color: Math.abs(a.residual) < 0.05 ? 'var(--ok)' : 'var(--compression)' }}>
                      residual {a.residual.toExponential(1)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 text-[10.5px] num" style={{ color: 'var(--ink-3)' }}>
                {res.determinacyFormula} · DOF per node = {struct.mode === 'truss' ? 2 : 3} · k<sub>m</sub> built from EA/L, 12EI/L³, 6EI/L², 4EI/L, 2EI/L · solved with Gaussian elimination with scaled partial pivoting.
              </div>
            </Card>

            <Card title="Teaching prompts" sub={lang === 'hinglish' ? 'Lecture me poochhne ke liye' : 'Questions to ask the class'}>
              <ul className="space-y-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {(lang === 'hinglish'
                  ? [
                      'Kaunse members zero-force hain? Joint par sirf 2 member aur koi load nahi → dono zero (agar collinear nahi hain).',
                      'Truss mode aur Frame mode switch karke dekho, kaunse member ka moment 0 se non-zero hota hai? Kyun?',
                      'Wind load (Px) badhao, frame sway karta hai, columns me double curvature aata hai. Truss me sway kam kyun?',
                      'Ds = m + r − 2j se ginein, phir table se verify karein ki kaunsa member fail hoga (N/A se stress).',
                    ]
                  : [
                      'Which members are zero-force? A two-member joint with no external load gives zero in both (if not collinear).',
                      'Toggle truss ↔ frame: which members suddenly pick up moment, and why can a pin joint not carry it?',
                      'Increase lateral Px, observe frame sway and column double curvature. Why is a truss far stiffer in sway?',
                      'Check Ds = m + r − 2j by hand, then read N/A from the table to see which bar is closest to yield.',
                    ]
                ).map((t, i) => (
                  <li key={i} className="flex gap-1.5">
                    <PencilRuler className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Btn icon={<Wind className="w-3.5 h-3.5" />} onClick={() => {
                  const top = struct.nodes.reduce((a, b) => (b.y > a.y ? b : a), struct.nodes[0]);
                  patchNode(top.id, { fx: (top.fx ?? 0) + 10 });
                  toast(`Added 10 kN lateral wind at joint ${top.label}.`, 'ok');
                }}>
                  Add wind at top joint
                </Btn>
                <Btn icon={<Plus className="w-3.5 h-3.5" />} onClick={() => {
                  const maxX = Math.max(...struct.nodes.map((n) => n.x));
                  const baseY = Math.min(...struct.nodes.map((n) => n.y));
                  const topY = Math.max(...struct.nodes.map((n) => n.y));
                  const newNodes = [
                    ...struct.nodes,
                    { id: `n_${uid()}`, label: `N${struct.nodes.length + 1}`, x: maxX + 4, y: baseY, support: 'pin' as const },
                    { id: `n_${uid()}`, label: `N${struct.nodes.length + 2}`, x: maxX + 4, y: topY, support: 'free' as const },
                  ];
                  setStruct({
                    ...struct,
                    nodes: newNodes,
                    members: [
                      ...struct.members,
                      { id: `m_${uid()}`, label: `M${struct.members.length + 1}`, startNodeId: struct.nodes.find((n) => n.x === maxX && n.y === baseY)?.id ?? struct.nodes[0].id, endNodeId: newNodes[2].id, E_GPa: 200, A_cm2: 40, I_cm4: 8000 },
                      { id: `m_${uid()}`, label: `M${struct.members.length + 2}`, startNodeId: newNodes[2].id, endNodeId: newNodes[3].id, E_GPa: 200, A_cm2: 40, I_cm4: 8000 },
                      { id: `m_${uid()}`, label: `M${struct.members.length + 3}`, startNodeId: newNodes[3].id, endNodeId: struct.nodes.find((n) => n.x === maxX && n.y === topY)?.id ?? struct.nodes[0].id, E_GPa: 200, A_cm2: 40, I_cm4: 8000 },
                    ],
                  });
                  toast('Added a new bay, every joint is draggable.', 'ok');
                }}>
                  Add a bay
                </Btn>
                <Btn icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => { setSel(null); toast('Selection cleared. Use Erase tool to remove parts.', 'info'); }}>
                  Clear selection
                </Btn>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
