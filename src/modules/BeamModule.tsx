import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  Eye,
  EyeOff,
  GitBranch,
  Layers,
  Scissors,
  Sparkles,
  Truck,
  Wand2,
  Copy,
} from 'lucide-react';
import { BeamModel, inspectBeamSection } from '../engine/beamEngine';
import { BEAM_PRESETS } from '../engine/presets';
import { auditBeamEquilibrium } from '../engine/shared';
import { NAMED_SECTIONS, analyticSection } from '../engine/sectionLib';
import { useAnalysis } from '../ui/AnalysisContext';
import { BeamEditor } from '../ui/BeamEditor';
import { Plot } from '../ui/DiagramPlot';
import { Acc, Badge, Btn, Card, Field, Hint, NumInput, Segmented, Slider, Stat, Toggle, Wide, fmt, uid } from '../ui/primitives';

const VW = 820;
const H = 190;

/* ------------------------------------------------------------------ */
/*  Structure + reactions + elastic curve drawing                     */
/* ------------------------------------------------------------------ */

const BeamView: React.FC<{
  model: BeamModel;
  res: ReturnType<typeof import('../engine/beamEngine').analyzeBeam>;
  xCut?: number;
  onCut?: (x: number) => void;
  showReactions?: boolean;
  showCurve?: boolean;
  curveScale?: number;
  hideValues?: boolean;
}> = ({ model, res, xCut, onCut, showReactions = true, showCurve = true, curveScale = 1, hideValues = false }) => {
  const L = Math.max(0.5, model.length);
  const padL = 58;
  const padR = 58;
  const yBeam = 96;
  const plotW = VW - padL - padR;
  const X = (x: number) => padL + (Math.max(0, Math.min(L, x)) / L) * plotW;

  const maxDefl = Math.max(1e-6, res.maxAbsDeflectionMm);
  const deflAmp = 30 * curveScale;
  const curve = res.points.map((p) => ({
    x: X(p.x),
    y: yBeam - (p.deflectionMm / maxDefl) * deflAmp,
  }));
  const curvePath = curve.length
    ? curve.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    : '';

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!onCut) return;
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * VW;
    const x = ((sx - padL) / plotW) * L;
    onCut(Math.max(0, Math.min(L, Math.round(x * 100) / 100)));
  };

  const maxAbsReaction = Math.max(1, ...res.reactions.map((r) => Math.abs(r.Ry)));

  return (
    <svg
      viewBox={`0 0 ${VW} ${H}`}
      className="w-full block select-none"
      style={{ cursor: onCut ? 'ew-resize' : 'default', touchAction: 'none' }}
      onPointerMove={handleMove}
      onPointerDown={handleMove}
    >
      {/* ground */}
      <line x1={padL - 30} y1={yBeam + 34} x2={VW - padR + 30} y2={yBeam + 34} stroke="var(--line-strong)" strokeWidth={1} strokeDasharray="3 5" />

      {/* loads */}
      {model.loads.map((ld) => {
        if (ld.type === 'point' && ld.x !== undefined) {
          const px = X(ld.x);
          const down = (ld.magnitude ?? 0) >= 0;
          return (
            <g key={ld.id}>
              <line x1={px} y1={yBeam - 72} x2={px} y2={yBeam - 10} stroke="var(--compression)" strokeWidth={2.4} />
              <polygon
                points={`${px},${yBeam - 3} ${px - 5.5},${yBeam - 15} ${px + 5.5},${yBeam - 15}`}
                fill="var(--compression)"
                transform={down ? undefined : `rotate(180 ${px} ${yBeam - 10})`}
              />
              <text x={px + 5} y={yBeam - 56} fontSize={10.5} fontWeight={800} fill="var(--compression)">
                {Math.abs(ld.magnitude ?? 0)} kN
              </text>
            </g>
          );
        }
        if (ld.type === 'moment' && ld.x !== undefined) {
          const px = X(ld.x);
          const cw = (ld.magnitude ?? 0) >= 0;
          return (
            <g key={ld.id}>
              <path d={`M${px - 15} ${yBeam - 26} a 16 16 0 1 ${cw ? 1 : 0} 30 0`} fill="none" stroke="var(--warn)" strokeWidth={2.2} />
              <polygon
                points={cw ? `${px + 15},${yBeam - 31} ${px + 7},${yBeam - 31} ${px + 12},${yBeam - 22}` : `${px - 15},${yBeam - 31} ${px - 7},${yBeam - 31} ${px - 12},${yBeam - 22}`}
                fill="var(--warn)"
              />
              <text x={px} y={yBeam - 46} fontSize={10.5} fontWeight={800} fill="var(--warn)" textAnchor="middle">
                {Math.abs(ld.magnitude ?? 0)} kN·m
              </text>
            </g>
          );
        }
        if ((ld.type === 'udl' || ld.type === 'uvl') && ld.xStart !== undefined && ld.xEnd !== undefined) {
          const p1 = X(ld.xStart);
          const p2 = X(ld.xEnd);
          const wA = ld.type === 'udl' ? (ld.magnitude ?? 0) : (ld.wStart ?? 0);
          const wB = ld.type === 'udl' ? (ld.magnitude ?? 0) : (ld.wEnd ?? 0);
          const mx = Math.max(Math.abs(wA), Math.abs(wB), 1);
          const hA = 12 + (Math.abs(wA) / mx) * 34;
          const hB = 12 + (Math.abs(wB) / mx) * 34;
          const n = Math.max(4, Math.min(16, Math.round((p2 - p1) / 24)));
          return (
            <g key={ld.id}>
              <polygon points={`${p1},${yBeam - hA} ${p2},${yBeam - hB} ${p2},${yBeam - 4} ${p1},${yBeam - 4}`} fill="var(--warn)" opacity={0.1} stroke="var(--warn)" strokeWidth={1} />
              {Array.from({ length: n }).map((_, i) => {
                const f = (i + 0.5) / n;
                const px = p1 + (p2 - p1) * f;
                const hh = hA + (hB - hA) * f;
                return <line key={i} x1={px} y1={yBeam - hh} x2={px} y2={yBeam - 6} stroke="var(--warn)" strokeWidth={1.4} />;
              })}
              <text x={(p1 + p2) / 2} y={yBeam - Math.max(hA, hB) - 6} fontSize={10.5} fontWeight={800} fill="var(--warn)" textAnchor="middle">
                {ld.type === 'udl' ? `${wA} kN/m` : `${wA} → ${wB} kN/m`}
              </text>
            </g>
          );
        }
        return null;
      })}

      {/* beam */}
      <rect x={X(0)} y={yBeam - 5} width={X(L) - X(0)} height={10} rx={2} fill="var(--ink)" opacity={0.9} />

      {/* hinges */}
      {model.hinges.map((h) => (
        <g key={h.id}>
          <circle cx={X(h.x)} cy={yBeam} r={7} fill="var(--canvas)" stroke="var(--accent)" strokeWidth={2.6} />
          <circle cx={X(h.x)} cy={yBeam} r={2.2} fill="var(--accent)" />
        </g>
      ))}

      {/* supports + reactions */}
      {model.supports.map((s) => {
        const px = X(s.x);
        const r = res.reactions.find((rr) => rr.supportId === s.id);
        const ry = r?.Ry ?? 0;
        return (
          <g key={s.id}>
            {s.type === 'fixed' ? (
              <>
                <line x1={px} y1={yBeam - 26} x2={px} y2={yBeam + 26} stroke="var(--ink)" strokeWidth={3.4} />
                {Array.from({ length: 6 }).map((_, i) => (
                  <line key={i} x1={px} y1={yBeam - 22 + i * 9} x2={px - 10} y2={yBeam - 16 + i * 9} stroke="var(--ink)" strokeWidth={1.3} />
                ))}
                {showReactions && Math.abs(r?.Mz ?? 0) > 1e-4 && (
                  <text x={px + 8} y={yBeam - 30} fontSize={9.5} fontWeight={700} fill="var(--ok)">
                    M {hideValues ? '•••' : fmt(Math.abs(r?.Mz ?? 0), 1)}
                  </text>
                )}
              </>
            ) : s.type === 'spring' ? (
              <>
                <path d={`M${px} ${yBeam + 6} l0 6 l-7 3 l14 5 l-14 5 l14 5 l-7 3 l0 4`} fill="none" stroke="var(--warn)" strokeWidth={2} />
                <line x1={px - 14} y1={yBeam + 37} x2={px + 14} y2={yBeam + 37} stroke="var(--ink-2)" strokeWidth={2} />
              </>
            ) : (
              <>
                <polygon points={`${px},${yBeam + 6} ${px - 10},${yBeam + 19} ${px + 10},${yBeam + 19}`} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={2} />
                {s.type === 'roller' || s.type === 'guided' ? (
                  <>
                    <circle cx={px - 5} cy={yBeam + 23} r={3.8} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={1.5} />
                    <circle cx={px + 5} cy={yBeam + 23} r={3.8} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={1.5} />
                  </>
                ) : (
                  <line x1={px - 13} y1={yBeam + 20} x2={px + 13} y2={yBeam + 20} stroke="var(--ink)" strokeWidth={2} />
                )}
              </>
            )}
            <text x={px} y={yBeam - 12} fontSize={11} fontWeight={800} textAnchor="middle" fill="var(--ink)">
              {s.label}
            </text>
            {Math.abs(s.settlementMm ?? 0) > 1e-6 && (
              <text x={px} y={yBeam + 48} fontSize={9} textAnchor="middle" fill="var(--warn)" fontWeight={700}>
                Δ {s.settlementMm} mm
              </text>
            )}
            {showReactions && Math.abs(ry) > 1e-4 && (() => {
              // Reactions act ON the beam, so a positive (upward) reaction draws an
              // upward arrow just below the support. The tail sits below the ground
              // line and the head points at the support, which is how it is sketched
              // on the board. Negative reactions flip downward.
              const len = 10 + (Math.abs(ry) / maxAbsReaction) * 24;
              const yTip = yBeam + 38;
              const yTail = yTip + len;
              const up = ry > 0;
              return (
                <g>
                  <line x1={px} y1={up ? yTail : yTip} x2={px} y2={up ? yTip : yTail} stroke="var(--ok)" strokeWidth={2.4} strokeLinecap="round" />
                  <polygon
                    points={
                      up
                        ? `${px},${yTip} ${px - 4.5},${yTip + 9} ${px + 4.5},${yTip + 9}`
                        : `${px},${yTail} ${px - 4.5},${yTail - 9} ${px + 4.5},${yTail - 9}`
                    }
                    fill="var(--ok)"
                  />
                  <text x={px + 7} y={yTip + len / 2 + 3} fontSize={9.5} fontWeight={800} fill="var(--ok)">
                    {hideValues ? '•••' : `${fmt(ry, 1)} kN`}
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}

      {/* elastic curve */}
      {showCurve && curvePath && (
        <path d={curvePath} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeDasharray="6 4" opacity={0.9} />
      )}

      {/* knife */}
      {xCut !== undefined && (
        <g>
          <line x1={X(xCut)} y1={14} x2={X(xCut)} y2={H - 8} stroke="var(--compression)" strokeWidth={1.6} strokeDasharray="5 4" />
          <polygon points={`${X(xCut)},${yBeam - 15} ${X(xCut) - 7},${yBeam - 27} ${X(xCut) + 7},${yBeam - 27}`} fill="var(--compression)" />
          <rect x={X(xCut) - 26} y={2} width={52} height={16} rx={4} fill="var(--compression)" />
          <text x={X(xCut)} y={13} fontSize={9.5} fontWeight={800} textAnchor="middle" fill="#fff">
            x = {fmt(xCut, 2)} m
          </text>
        </g>
      )}

      <text x={padL} y={H - 3} fontSize={9} fill="var(--ink-3)" fontWeight={700}>
        0
      </text>
      <text x={X(L)} y={H - 3} fontSize={9} fill="var(--ink-3)" textAnchor="end" fontWeight={700}>
        {L} m
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Left-hand section knife FBD                                       */
/* ------------------------------------------------------------------ */

const KnifeFBD: React.FC<{ model: BeamModel; res: ReturnType<typeof import('../engine/beamEngine').analyzeBeam>; xCut: number }> = ({
  model,
  res,
  xCut,
}) => {
  const cut = useMemo(() => inspectBeamSection(model, res, xCut), [model, res, xCut]);
  const { hideAnswers } = useAnalysis();
  const q = (v: string) => (hideAnswers ? '•••' : v);
  const L = Math.max(0.5, model.length);
  const w = 470;
  const h = 156;
  const padL = 34;
  const padR = 104;
  const y = 66;
  // the cut face sits inside the frame so the V / M / N labels always fit
  const X = (x: number) => padL + (Math.max(0, Math.min(xCut, x)) / Math.max(xCut, 0.001)) * (w - padL - padR);
  const forces = cut.activeLeftForces;
  const maxF = Math.max(1, ...forces.map((f) => Math.abs(f.Fy_up)));
  const arrowMax = 34;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)] gap-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full block max-w-[640px] rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
        <rect x={X(0)} y={y - 5} width={Math.max(4, X(xCut) - X(0))} height={10} rx={2} fill="var(--ink)" opacity={0.85} />
        {/* reactions/loads on the free body */}
        {forces.map((f, i) => {
          const px = X(f.x);
          const len = (Math.abs(f.Fy_up) / maxF) * arrowMax;
          if (Math.abs(f.Fy_up) < 1e-6) {
            return (
              <g key={i}>
                <path d={`M${px - 12} ${y - 26} a 13 13 0 1 ${f.momentContributionSagging >= 0 ? 1 : 0} 24 0`} fill="none" stroke="var(--ok)" strokeWidth={2} />
                <text x={px} y={y - 32} fontSize={8.5} textAnchor="middle" fill="var(--ok)" fontWeight={800}>
                  {f.label}
                </text>
              </g>
            );
          }
          const up = f.Fy_up > 0;
          return (
            <g key={i}>
              <line x1={px} y1={y + (up ? 8 : -8)} x2={px} y2={y + (up ? 8 + len : -8 - len)} stroke={up ? 'var(--ok)' : 'var(--compression)'} strokeWidth={2} />
              <polygon
                points={
                  up
                    ? `${px},${y + 8 + len} ${px - 4},${y + 8 + len - 9} ${px + 4},${y + 8 + len - 9}`
                    : `${px},${y - 8 - len} ${px - 4},${y - 8 - len + 9} ${px + 4},${y - 8 - len + 9}`
                }
                fill={up ? 'var(--ok)' : 'var(--compression)'}
              />
              <text x={px} y={y + (up ? 12 + len : -12 - len)} fontSize={8.5} textAnchor="middle" fontWeight={800} fill={up ? 'var(--ok)' : 'var(--compression)'}>
                {q(fmt(Math.abs(f.Fy_up), 1))} kN
              </text>
            </g>
          );
        })}

        {/* internal actions at the cut */}
        <line x1={X(xCut)} y1={y - 34} x2={X(xCut)} y2={y + 34} stroke="var(--compression)" strokeWidth={2} />
        <g>
          <line x1={X(xCut)} y1={y} x2={X(xCut) + 30} y2={y} stroke="var(--accent)" strokeWidth={2.4} />
          <polygon points={`${X(xCut) + 32},${y} ${X(xCut) + 22},${y - 4.5} ${X(xCut) + 22},${y + 4.5}`} fill="var(--accent)" />
          <text x={X(xCut) + 4} y={y + 26} fontSize={9.5} fontWeight={800} fill="var(--accent)" textAnchor="start">
            V {q(fmt(cut.V, 1))} kN
          </text>
        </g>
        <g>
          <path d={`M${X(xCut) + 12} ${y - 18} a 12 12 0 1 ${cut.M >= 0 ? 0 : 1} -18 6`} fill="none" stroke="var(--sagging)" strokeWidth={2.2} />
          <text x={X(xCut) + 18} y={y - 26} fontSize={9.5} fontWeight={800} fill="var(--sagging)" textAnchor="start">
            M {q(fmt(cut.M, 1))} kN·m
          </text>
        </g>

        <text x={padL} y={h - 4} fontSize={8.5} fontWeight={700} fill="var(--ink-3)">
          Isolated left segment x ∈ [0, {fmt(xCut, 2)} m] of {fmt(L, 2)} m
        </text>
      </svg>

      <div className="rounded-lg p-2 text-[11px] leading-relaxed num" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
        {hideAnswers && (
          <div className="mb-1 font-semibold" style={{ color: 'var(--warn)' }}>
            Working out the cut by hand, numbers masked. Switch “answers hidden” off to grade it.
          </div>
        )}
        {cut.equilibriumSteps.map((s, i) => (
          <div key={i} className="flex gap-1.5">
            <span style={{ color: 'var(--ink-3)' }}>{i + 1}.</span>
            <span>
              {hideAnswers ? s.replace(/-?\d+\.?\d*/g, '▪') : s}
            </span>
          </div>
        ))}
        <div className="mt-1 pt-1 border-t flex flex-wrap gap-x-3" style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
          <span>θ = {q(fmt(cut.slopeDeg, 3))}°</span>
          <span>δ = {q(fmt(cut.deflectionMm, 2))} mm</span>
          <span>w(x) = {q(fmt(cut.qAtX, 2))} kN/m</span>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Module                                                           */
/* ------------------------------------------------------------------ */

export const BeamModule: React.FC = () => {
  const { beam, setBeam, beamRes: res, lang, goto, setToSection, toast, hideAnswers, setHideAnswers } = useAnalysis();
  const [xCut, setXCut] = useState<number>(0);
  const [convention, setConvention] = useState<'som' | 'rcc'>('som');
  const [showReactions, setShowReactions] = useState(true);
  const [showCurve, setShowCurve] = useState(true);
  const [showSteps, setShowSteps] = useState(true);
  const [step, setStep] = useState(0);
  const [mobileTab, setMobileTab] = useState<'model' | 'result'>('result');
  const [curveScale, setCurveScale] = useState(1);
  const [showCurves, setShowCurves] = useState(true);

  const L = beam.length;
  const cutX = Math.min(L, Math.max(0, xCut || L * 0.45));
  const audit = useMemo(() => auditBeamEquilibrium(beam, res), [beam, res]);
  const cut = useMemo(() => inspectBeamSection(beam, res, cutX), [beam, res, cutX]);

  const allowable = (L * 1000) / 300;
  const deflectionVerdict = res.maxAbsDeflectionMm <= allowable;

  const bmdPoints = res.points.map((p) => ({ x: p.x, y: p.M }));
  const sfdPoints = res.points.map((p) => ({ x: p.x, y: p.V }));
  const deflPoints = res.points.map((p) => ({ x: p.x, y: p.deflectionMm }));
  const slopePoints = res.points.map((p) => ({ x: p.x, y: (p.slopeRad * 180) / Math.PI }));

  const criticalMarkers = (kind: 'V' | 'M' | 'd') =>
    res.criticalPoints
      .filter((c) =>
        kind === 'V'
          ? c.kind === 'max_pos_shear' || c.kind === 'max_neg_shear'
          : kind === 'M'
            ? c.kind === 'max_sagging' || c.kind === 'max_hogging' || c.kind === 'contraflexure' || c.kind === 'zero_shear'
            : c.kind === 'max_deflection'
      )
      .map((c) => ({
        x: c.x,
        y: kind === 'V' ? (res.points.find((p) => Math.abs(p.x - c.x) < 1e-6)?.V ?? 0) : kind === 'M' ? (res.points.find((p) => Math.abs(p.x - c.x) < 1e-6)?.M ?? 0) : (res.points.find((p) => Math.abs(p.x - c.x) < 1e-6)?.deflectionMm ?? 0),
        label: kind === 'M' && c.kind === 'contraflexure' ? `CF ${fmt(c.x, 1)}m` : `${fmt(c.value, 1)}`,
        tone: (c.kind === 'contraflexure' ? 'diamond' : c.kind === 'zero_shear' ? 'ring' : 'dot') as 'diamond' | 'ring' | 'dot',
      }));

  const loadPreset = (id: string) => {
    const p = BEAM_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setBeam(JSON.parse(JSON.stringify(p.model)));
    setXCut(0);
    toast(`Loaded template “${p.nameEn}”, now edit anything you like.`, 'ok');
  };

  const blank = () => {
    setBeam({
      length: 6,
      E_GPa: 200,
      I_cm4: 8000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 6, type: 'roller', label: 'B' },
      ],
      hinges: [],
      loads: [],
    });
    toast('Blank simply-supported span, add your own loads.', 'info');
  };

  const applySection = (key: string) => {
    const s = NAMED_SECTIONS.find((x) => x.key === key);
    if (!s) return;
    // Use the true Ixx of the selected section (bending about the strong axis)
    const I = analyticSection(s.dims).Ixx_mm4;
    setBeam({ ...beam, E_GPa: s.E_GPa, I_cm4: Math.round((I / 1e4) * 10) / 10 });
    toast(`Beam EI updated from ${s.name}: I = ${(I / 1e4).toFixed(0)} cm⁴, E = ${s.E_GPa} GPa.`, 'ok');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(300px,352px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,410px)_minmax(0,1fr)] gap-3">
      {/* mobile switch */}
      <div className="md:hidden -mb-1">
        <Segmented
          full
          value={mobileTab}
          onChange={setMobileTab}
          options={[
            { value: 'model', label: '① Build the model' },
            { value: 'result', label: '② Diagrams & working' },
          ]}
        />
      </div>

      {/* ============================ LEFT: MODEL ============================ */}
      <div className={`space-y-2.5 ${mobileTab === 'model' ? 'block' : 'hidden md:block'}`}>
        <Card
          title="Beam model"
          sub={`${beam.supports.length} supports · ${beam.loads.length} loads · ${beam.hinges.length} hinges`}
          right={
            <Btn variant="ghost" onClick={blank} title="Reset to a blank span">
              Blank
            </Btn>
          }
        >
          <BeamEditor model={beam} onChange={setBeam} />
        </Card>

        <Acc title="Beam length & material (EI)" sub={`EI = ${fmt(res.EI_kNm2, 0)} kN·m², governs deflection only`} defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Span L (m)" hint="Support spacing. Also the yardstick for the L/300 deflection check">
              <NumInput value={beam.length} step={0.5} min={1} max={40} onChange={(v) => setBeam({ ...beam, length: Math.max(1, v) })} suffix="m" />
            </Field>
            <Field label="E (GPa)" hint="Steel 200, concrete 25-30, timber 10, aluminium 70">
              <NumInput value={beam.E_GPa} step={5} min={1} onChange={(v) => setBeam({ ...beam, E_GPa: Math.max(1, v) })} suffix="GPa" />
            </Field>
            <div className="col-span-2">
              <Field label="I (cm⁴)" hint={`Flexural rigidity EI = ${fmt(beam.E_GPa)} × ${fmt(beam.I_cm4, 0)} × 0.01 = ${fmt(res.EI_kNm2, 0)} kN·m²`}>
                <NumInput value={beam.I_cm4} step={500} min={10} onChange={(v) => setBeam({ ...beam, I_cm4: Math.max(10, v) })} suffix="cm⁴" />
              </Field>
            </div>
          </div>
          <Field label="Load a real section (sets E and I)" hint="Ixx is taken about the strong axis from the exact section formulas.">
            <select
              onChange={(e) => applySection(e.target.value)}
              defaultValue=""
              className="w-full rounded-lg px-2 py-1.5 text-[12px] font-semibold"
              style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)' }}
            >
              <option value="">Choose a catalogue section…</option>
              {NAMED_SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}, {s.E_GPa} GPa
                </option>
              ))}
            </select>
          </Field>
        </Acc>

        <Acc title="Templates (optional starting points)" sub="Nothing is locked, every value stays editable">
          <div className="grid grid-cols-2 gap-1.5">
            {BEAM_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => loadPreset(p.id)}
                className="text-left rounded-lg p-1.5 text-[10.5px] font-semibold leading-tight"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
              >
                <span className="block" style={{ color: 'var(--accent)' }}>{p.tag}</span>
                {p.nameEn}
              </button>
            ))}
          </div>
        </Acc>

        <Card title="Hand this problem to…" sub="Every module reads the same live model">
          <div className="grid grid-cols-1 gap-1.5">
            <Btn
              variant="primary"
              size="md"
              icon={<Layers className="w-4 h-4" />}
              onClick={() => {
                setToSection({
                  M: cut.M,
                  V: cut.V,
                  N: 0,
                  x: cutX,
                  source: `Beam at x = ${fmt(cutX, 2)} m (${beam.loads.length} loads)`,
                });
                goto('section');
                toast('Beam cross-section handed to the fibre lab (N = 0: no axial load on a transverse beam).', 'ok');
              }}
            >
              Send M = {hideAnswers ? '•••' : fmt(cut.M, 1)} kN·m, V = {hideAnswers ? '•••' : fmt(cut.V, 1)} kN to Section lab
            </Btn>
            <Btn size="md" icon={<Truck className="w-4 h-4" />} onClick={() => goto('ild')}>
              Use this beam for the moving-load (ILD) lab
            </Btn>
            <Btn size="md" icon={<GitBranch className="w-4 h-4" />} onClick={() => goto('guide')}>
              Explain the concept flow to the class
            </Btn>
          </div>
        </Card>
      </div>

      {/* ============================ RIGHT: RESULTS ============================ */}
      <div className={`space-y-2.5 ${mobileTab === 'result' ? 'block' : 'hidden md:block'}`}>
        {!res.isStable ? (
          <Card title="This beam is a mechanism">
            <Hint tone="warn">
              <strong>Why:</strong> {lang === 'hinglish' ? res.instabilityReasonHi : res.instabilityReasonEn}
              <div className="mt-1">
                Reactions available r = {beam.supports.length} (a pin or roller counts 1 vertical restraint, a fixed/guided counts more), internal hinges c ={' '}
                {beam.hinges.length}. You need r ≥ 2 + c before the span can carry load.
              </div>
            </Hint>
          </Card>
        ) : (
          <>
            {hideAnswers && (
              <div
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-bold"
                style={{ background: 'color-mix(in srgb, var(--warn) 12%, var(--surface))', border: '1px solid color-mix(in srgb, var(--warn) 38%, transparent)', color: 'var(--warn)' }}
              >
                Answers hidden, solve it on the board first, then switch off “answers hidden”.
              </div>
            )}

            {/* structure + reactions */}
            <Card
              title="Structure, loads & reactions"
              sub="Drag horizontally on the drawing to move the virtual section knife"
              right={
                <div className="flex items-center gap-1">
                  <Badge tone={res.Ds === 0 ? 'green' : 'amber'}>Ds = {res.Ds}</Badge>
                  <Badge tone="neutral">Dk = {res.Dk}</Badge>
                </div>
              }
              pad={false}
            >
              <div className="p-1.5">
                <Wide min={460}>
                <BeamView
                  model={beam}
                  res={res}
                  xCut={cutX}
                  onCut={(x) => setXCut(x)}
                  showReactions={showReactions}
                  showCurve={showCurve}
                  curveScale={curveScale}
                  hideValues={hideAnswers}
                />
                </Wide>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 pb-2 text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={showReactions} onChange={(e) => setShowReactions(e.target.checked)} /> reactions
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={showCurve} onChange={(e) => setShowCurve(e.target.checked)} /> elastic curve
                </label>
                <span className="ml-auto hidden sm:inline">
                  δmax = {hideAnswers ? '•••' : fmt(res.maxAbsDeflectionMm, 2)} mm at x = {fmt(res.maxDeflectionX, 2)} m (curve exaggerated)
                </span>
              </div>
            </Card>

            {/* stat strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <Stat label="Σ Ry reactions" value={hideAnswers ? '•••' : fmt(res.reactions.reduce((s, r) => s + r.Ry, 0), 1)} unit="kN" tone="ok" />
              <Stat label="|V| max" value={hideAnswers ? '•••' : fmt(res.maxAbsV, 1)} unit="kN" tone="accent" />
              <Stat
                label="Max sagging BM"
                value={hideAnswers ? '•••' : fmt(res.maxSaggingM, 1)}
                unit="kN·m"
                tone="warn"
              />
              <Stat
                label="Max hogging BM"
                value={hideAnswers ? '•••' : fmt(res.maxHoggingM, 1)}
                unit="kN·m"
                tone="bad"
              />
            </div>

            {/* SECTION KNIFE */}
            <Card
              title={
                <span className="flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5" style={{ color: 'var(--compression)' }} /> Virtual section knife, method of sections
                </span>
              }
              sub="The isolated left piece, solved from equilibrium, drag the cut anywhere"
              right={<Badge tone="rose">x = {fmt(cutX, 2)} m</Badge>}
            >
              <div className="space-y-2">
                <Slider label="Cut position" value={cutX} min={0} max={L} step={L / 200} onChange={setXCut} suffix="m" />
                <Wide min={480}>
                  <KnifeFBD model={beam} res={res} xCut={cutX} />
                </Wide>
              </div>
            </Card>

            {/* diagrams */}
            <Card
              title="Synchronised diagrams"
              sub="Hover any graph to walk the knife to that section, all four graphs and the FBD follow"
              right={
                <div className="flex items-center gap-1.5">
                  <Segmented
                    size="sm"
                    value={convention}
                    onChange={(v) => setConvention(v)}
                    options={[
                      { value: 'som', label: 'SOM (+M up)' },
                      { value: 'rcc', label: 'RCC (+M down)' },
                    ]}
                  />
                  <button
                    onClick={() => setHideAnswers(!hideAnswers)}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-bold"
                    style={{ background: hideAnswers ? 'var(--accent-soft)' : 'var(--surface-2)', border: '1px solid var(--line-strong)', color: hideAnswers ? 'var(--accent)' : 'var(--ink-2)' }}
                    title="Hide the printed values so students read them off the graph"
                  >
                    {hideAnswers ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {hideAnswers ? 'Answers hidden' : 'Hide answers'}
                  </button>
                </div>
              }
            >
              <div className={showCurves ? 'space-y-1.5' : 'hidden'}>
                <Plot
                  points={sfdPoints}
                  L={L}
                  title="Shear Force V(x)"
                  unit="kN"
                  color="var(--accent)"
                  cursorX={cutX}
                  onCursor={setXCut}
                  markers={criticalMarkers('V')}
                  height={128}
                  hideValues={hideAnswers}
                />
                <Plot
                  points={bmdPoints}
                  L={L}
                  title={`Bending Moment M(x), ${convention === 'som' ? 'sagging up (SOM)' : 'sagging down (RCC)'}`}
                  unit="kN·m"
                  color="var(--sagging)"
                  flip={convention === 'rcc'}
                  cursorX={cutX}
                  onCursor={setXCut}
                  markers={criticalMarkers('M')}
                  height={142}
                  hideValues={hideAnswers}
                  refLines={
                    res.criticalPoints.filter((c) => c.kind === 'contraflexure').slice(0, 3).map((c) => ({ y: 0, label: `CF @ ${fmt(c.x, 2)} m`, color: 'var(--warn)' }))
                  }
                />
                <Plot
                  points={deflPoints}
                  L={L}
                  title="Elastic curve y(x) [mm, down is negative]"
                  unit="mm"
                  color="var(--hogging)"
                  cursorX={cutX}
                  onCursor={setXCut}
                  markers={criticalMarkers('d')}
                  height={118}
                  hideValues={hideAnswers}
                />
                <Plot
                  points={slopePoints}
                  L={L}
                  title="Slope θ(x) [degrees]"
                  unit="deg"
                  color="var(--warn)"
                  height={104}
                  showAxisLabels
                  fill={false}
                />
              </div>
              <div className="mt-2">
                <Toggle
                  checked={showCurves}
                  onChange={setShowCurves}
                  label="Show the four curves"
                  hint="Turn off to project only the drawing + numbers (lighter for slow projectors)"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold" style={{ color: 'var(--ink-3)' }}>
                <span>◈ contraflexure (M = 0)</span>
                <span>○ V = 0 (moment peak)</span>
                <span className="ml-auto num">w → V → M → θ → y integrated from the same EI = {fmt(res.EI_kNm2, 0)} kN·m²</span>
              </div>
            </Card>

            {/* critical points */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              <Card title="Critical sections" sub="Where the professor draws the red circles">
                <div className="space-y-1">
                  {res.criticalPoints.length === 0 && <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>No critical points for this load case.</div>}
                  {res.criticalPoints.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setXCut(c.x)}
                      className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
                    >
                      <span className="text-[10px] num font-bold shrink-0" style={{ color: 'var(--ink-3)' }}>
                        {fmt(c.x, 2)} m
                      </span>
                      <span className="text-[11px] font-semibold truncate">{lang === 'hinglish' ? c.titleHi : c.titleEn}</span>
                      <span className="ml-auto num text-[11px] font-extrabold shrink-0" style={{ color: 'var(--accent)' }}>
                        {hideAnswers ? '•••' : `${fmt(c.value, 2)} ${c.unit}`}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="5-step working (lecture script)" sub="Same numbers the engine used, verify them by hand">
                <div className="flex items-center justify-between mb-1.5">
                  <Badge tone="blue">step {step + 1} / {res.steps.length}</Badge>
                  <div className="flex gap-1">
                    <Btn size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))}>◀</Btn>
                    <Btn size="sm" onClick={() => setStep((s) => Math.min(res.steps.length - 1, s + 1))}>▶</Btn>
                  </div>
                </div>
                {showSteps && res.steps[step] && (
                  <div className="space-y-1.5">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                      {res.steps[step].badge}
                    </div>
                    <div className="text-[12px] font-bold leading-snug">
                      {lang === 'hinglish' ? res.steps[step].titleHi : res.steps[step].titleEn}
                    </div>
                    <div className="rounded-lg p-2 space-y-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                      {res.steps[step].formulas.map((f, i) => (
                        <div key={i} className="text-[10.5px] num leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                          {f}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                      {lang === 'hinglish' ? res.steps[step].explanationHi : res.steps[step].explanationEn}
                    </p>
                  </div>
                )}
                <div className="mt-1.5">
                  <Toggle checked={showSteps} onChange={setShowSteps} label="Show instructor notes" />
                </div>
              </Card>
            </div>

            {/* PROOF */}
            <Card
              title={
                <span className="flex items-center gap-1.5">
                  <BadgeCheck className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} /> Where every number comes from
                </span>
              }
              sub="The solver is a 4-DOF-per-element Euler-Bernoulli FEM with LU factorisation. These residuals are recomputed from your model every keystroke."
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {audit.map((a) => (
                  <div key={a.label} className="rounded-lg p-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>{a.label}</div>
                    <div className="num text-[12px] font-extrabold">
                      {hideAnswers ? '•••' : fmt(a.reacted, 3)} {a.unit}
                    </div>
                    <div className="num text-[10px] font-bold" style={{ color: Math.abs(a.residual) < 0.02 ? 'var(--ok)' : 'var(--compression)' }}>
                      residual {Math.abs(a.residual) < 0.02 ? '✓' : '✗'} {Math.abs(a.residual) < 1e-4 ? '0' : a.residual.toExponential(1)} {a.unit}
                    </div>
                  </div>
                ))}
                <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>Serviceability δ ≤ L/300</div>
                  <div className="num text-[12px] font-extrabold" style={{ color: deflectionVerdict ? 'var(--ok)' : 'var(--compression)' }}>
                    {hideAnswers ? '•••' : fmt(res.maxAbsDeflectionMm, 2)} / {hideAnswers ? '•••' : fmt(allowable, 2)} mm
                  </div>
                  <div className="text-[10px] font-bold" style={{ color: deflectionVerdict ? 'var(--ok)' : 'var(--compression)' }}>
                    {deflectionVerdict ? 'within limit' : 'exceeds limit, increase I or add support'}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                <div className="num">FEM nodes = {res.points.length} · DOF assembled = {res.Dk + 2 * res.points.length > 0 ? '4 per element' : 'n/a'}</div>
                <div className="num">EI used = {fmt(beam.E_GPa)} GPa × {fmt(beam.I_cm4, 0)} cm⁴ × 0.01 = {fmt(res.EI_kNm2, 0)} kN·m²</div>
              </div>
            </Card>

            {/* extras */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              <Card title="Exaggerate the elastic curve" sub="Use this to make a stiff beam visibly bend">
                <Slider label="Curve exaggeration" value={curveScale} min={0.5} max={6} step={0.5} onChange={setCurveScale} suffix="×" />
                <div className="mt-2">
                  <Hint>
                    Real deflection is {fmt(res.maxAbsDeflectionMm, 2)} mm, about {fmt((res.maxAbsDeflectionMm / (L * 1000)) * 100, 3)}% of the span. On a 6 m
                    beam drawn 900 px wide that is sub-pixel, so the drawing is scaled for teaching. The numbers never are.
                  </Hint>
                </div>
              </Card>

              <Card title="What the class should notice" sub={lang === 'hinglish' ? 'Hinglish me intuition' : 'Plain-English intuition'}>
                <ul className="space-y-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                  {[
                    lang === 'hinglish'
                      ? 'SFD ki height = BMD ki slope. Jahan V = 0, wahan M apna peak banata hai.'
                      : 'The SFD ordinate is the slope of the BMD. Where V = 0, M reaches a peak.',
                    lang === 'hinglish'
                      ? 'Overhang par load se hogging (-M) aata hai ya sagging? Support ke paas kaun jeetta hai, wahi sign decide karta hai.'
                      : 'Overhangs produce hogging: the cantilever action near a support pulls the top fibres into tension.',
                    lang === 'hinglish'
                      ? 'Ds = 0 hai toh EI badalne par SFD/BMD ek baat nahi badlega, sirf deflection badlega. Ye try karke dekho!'
                      : 'In a determinate (Ds = 0) beam, changing EI leaves V and M untouched, only deflections change. Try it.',
                    lang === 'hinglish'
                      ? 'Contraflexure par M = 0 aur curvature palat jaati hai, RCC me sariya upar se neeche shift hota hai.'
                      : 'At a point of contraflexure M = 0 and curvature flips, exactly where RCC rebar must switch from bottom to top.',
                  ].map((t, i) => (
                    <li key={i} className="flex gap-1.5">
                      <Sparkles className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Btn
                icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                onClick={() => {
                  const peak = res.criticalPoints.find((c) => c.kind === 'max_sagging' || c.kind === 'max_hogging');
                  const x = peak?.x ?? L / 2;
                  setXCut(x);
                  toast(`Knife moved to the governing moment section at x = ${fmt(x, 2)} m.`, 'info');
                }}
              >
                Jump knife to governing moment
              </Btn>
              <Btn
                icon={<Copy className="w-3.5 h-3.5" />}
                onClick={() => {
                  const rows = [
                    `Beam: L=${L} m, E=${beam.E_GPa} GPa, I=${beam.I_cm4} cm4`,
                    ...beam.supports.map((s) => `Support ${s.label} @ x=${s.x} m (${s.type})`),
                    ...beam.loads.map((l) => `Load ${l.type} ${JSON.stringify(l)}`),
                    ...res.reactions.map((r) => `Reaction ${r.label}: Ry=${r.Ry.toFixed(3)} kN, M=${r.Mz.toFixed(3)} kN·m`),
                    ...res.criticalPoints.map((c) => `${c.titleEn}: x=${c.x.toFixed(3)} m, ${c.value.toFixed(3)} ${c.unit}`),
                  ].join('\n');
                  navigator.clipboard?.writeText(rows).then(
                    () => toast('Full solution table copied to clipboard.', 'ok'),
                    () => toast('Clipboard blocked, select values manually.', 'warn')
                  );
                }}
              >
                Copy solution table
              </Btn>
              <Btn icon={<BookOpen className="w-3.5 h-3.5" />} onClick={() => goto('guide')}>
                Teaching flow for this beam
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
