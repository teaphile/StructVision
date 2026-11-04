import React, { useMemo, useState } from 'react';
import { CheckCircle2, Compass, Crosshair, Layers, Ruler } from 'lucide-react';
import { SectionDimensions, SectionShapeType, analyzeCrossSection } from '../engine/sectionMohrBucklingEngine';
import { NAMED_SECTIONS, NamedSection, analyticSection, dimsSummary } from '../engine/sectionLib';
import { useAnalysis } from '../ui/AnalysisContext';
import { Badge, Btn, Card, Field, Hint, NumInput, Segmented, Slider, Stat, fmt } from '../ui/primitives';

/* ------------------------------------------------------------------ */
/*  Section drawing                                                   */
/* ------------------------------------------------------------------ */

const BOX = 240;

/* round an axis maximum up to 1 / 2 / 2.5 / 5 x 10^n so the ticks land on readable numbers */
function niceCeil(v: number) {
  if (!isFinite(v) || v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return step * p;
}

export const SectionShapeSvg: React.FC<{
  dims: SectionDimensions;
  probeY?: number;
  showDims?: boolean;
  height?: number;
  highlight?: boolean;
}> = ({ dims, probeY, showDims = true, height = 250 }) => {
  const isCirc = dims.shape === 'circular' || dims.shape === 'hollow_circular';
  const b = dims.width_mm;
  const h = isCirc ? dims.outerDia_mm : dims.depth_mm;
  const scale = Math.min((BOX - 54) / Math.max(b, h), (BOX - 54) / Math.max(b, h));
  const W = b * scale;
  const Hh = h * scale;
  const x0 = (BOX - W) / 2;
  const y0 = (BOX - Hh) / 2;
  const tf = dims.flangeThick_mm * scale;
  const tw = dims.webThick_mm * scale;
  const cy = y0 + Hh / 2;

  const fill = 'var(--accent-soft)';
  const stroke = 'var(--accent)';

  let body: React.ReactNode = null;
  if (dims.shape === 'rectangular') {
    body = <rect x={x0} y={y0} width={W} height={Hh} fill={fill} stroke={stroke} strokeWidth={1.6} />;
  } else if (dims.shape === 'i_section') {
    body = (
      <path
        d={`M${x0},${y0} h${W} v${tf} h${-(W - tw) / 2} v${Hh - 2 * tf} h${(W - tw) / 2} v${tf} h${-W} v${-tf} h${(W - tw) / 2} v${-(Hh - 2 * tf)} h${-(W - tw) / 2} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.6}
      />
    );
  } else if (dims.shape === 't_section') {
    body = (
      <path
        d={`M${x0},${y0} h${W} v${tf} h${-(W - tw) / 2} v${Hh - tf} h${-tw} v${-(Hh - tf)} h${-(W - tw) / 2} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.6}
      />
    );
  } else if (dims.shape === 'box_section') {
    body = (
      <>
        <rect x={x0} y={y0} width={W} height={Hh} fill={fill} stroke={stroke} strokeWidth={1.6} />
        <rect x={x0 + tw} y={y0 + tf} width={W - 2 * tw} height={Hh - 2 * tf} fill="var(--canvas)" stroke={stroke} strokeWidth={1.1} />
      </>
    );
  } else if (dims.shape === 'circular') {
    body = <circle cx={BOX / 2} cy={cy} r={W / 2} fill={fill} stroke={stroke} strokeWidth={1.6} />;
  } else {
    const r = (dims.innerDia_mm / dims.outerDia_mm) * (W / 2);
    body = (
      <>
        <circle cx={BOX / 2} cy={cy} r={W / 2} fill={fill} stroke={stroke} strokeWidth={1.6} />
        <circle cx={BOX / 2} cy={cy} r={r} fill="var(--canvas)" stroke={stroke} strokeWidth={1.1} />
      </>
    );
  }

  return (
    <svg viewBox={`0 0 ${BOX} ${BOX}`} className="w-full block" style={{ maxHeight: height }}>
      {body}
      {/* centroid / neutral axis */}
      <line x1={x0 - 12} y1={cy} x2={x0 + W + 12} y2={cy} stroke="var(--hogging)" strokeWidth={1.4} strokeDasharray="6 4" />
      <text x={x0 + W + 14} y={cy + 3} fontSize={8.5} fontWeight={800} fill="var(--hogging)">
        NA
      </text>
      {/* probe */}
      {probeY !== undefined && (() => {
        const yy = y0 + Hh - (probeY / h) * Hh;
        return (
          <g>
            <line x1={x0 - 6} y1={yy} x2={x0 + W + 6} y2={yy} stroke="var(--warn)" strokeWidth={1.8} />
            <circle cx={x0 + W + 6} cy={yy} r={3.6} fill="var(--warn)" />
            <text x={x0 - 8} y={yy + 3} fontSize={8} fontWeight={800} textAnchor="end" fill="var(--warn)">
              y={fmt(probeY, 0)}
            </text>
          </g>
        );
      })()}
      {/* dimensions, the vertical one lives on the left so it can never sit under the probe tag */}
      {showDims && (
        <>
          <line x1={x0} y1={y0 - 14} x2={x0 + W} y2={y0 - 14} stroke="var(--ink-3)" strokeWidth={0.9} />
          <line x1={x0 - 3} y1={y0 - 17.5} x2={x0 + 3} y2={y0 - 10.5} stroke="var(--ink-3)" strokeWidth={0.9} />
          <line x1={x0 + W - 3} y1={y0 - 17.5} x2={x0 + W + 3} y2={y0 - 10.5} stroke="var(--ink-3)" strokeWidth={0.9} />
          <text x={x0 + W / 2} y={y0 - 18} fontSize={8.5} textAnchor="middle" fill="var(--ink-3)" fontWeight={700}>
            {isCirc ? `Ø${dims.outerDia_mm}` : b} mm
          </text>
          <line x1={x0 - 16} y1={y0} x2={x0 - 16} y2={y0 + Hh} stroke="var(--ink-3)" strokeWidth={0.9} />
          <line x1={x0 - 19} y1={y0} x2={x0 - 13} y2={y0} stroke="var(--ink-3)" strokeWidth={0.9} />
          <line x1={x0 - 19} y1={y0 + Hh} x2={x0 - 13} y2={y0 + Hh} stroke="var(--ink-3)" strokeWidth={0.9} />
          <text
            x={x0 - 20}
            y={y0 + Hh / 2}
            fontSize={8.5}
            fill="var(--ink-3)"
            fontWeight={700}
            transform={`rotate(-90 ${x0 - 20} ${y0 + Hh / 2})`}
            textAnchor="middle"
          >
            {h} mm
          </text>
        </>
      )}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Vertical stress profile (σ or τ vs height)                         */
/* ------------------------------------------------------------------ */

const ProfileSvg: React.FC<{
  fibers: Array<{ yFromBottom_mm: number; value: number }>;
  H: number;
  title: string;
  unit: string;
  color: string;
  probeY?: number;
  probeValue?: number;
  /** draw the neutral axis where the curve crosses zero (σ only, τ is never zero at the NA) */
  markNA?: boolean;
  /** draw a marker at the largest value (τ max) */
  markPeak?: boolean;
  hideValues?: boolean;
}> = ({ fibers, H, title, unit, color, probeY, probeValue, markNA = true, markPeak = false, hideValues = false }) => {
  const w = 300;
  const h = 250;
  const padT = 18;
  const padB = 30;
  const padL = 34;
  const padR = 16;
  const midX = padL + (w - padL - padR) / 2;
  const halfW = (w - padL - padR) / 2;
  const plotH = h - padT - padB;
  const Y = (y: number) => padT + (1 - y / H) * plotH;
  const raw = Math.max(1e-6, ...fibers.map((f) => Math.abs(f.value)));
  const maxAbs = niceCeil(raw);
  const X = (v: number) => midX + (v / maxAbs) * halfW;
  const path = fibers.map((f, i) => `${i ? 'L' : 'M'} ${X(f.value).toFixed(1)} ${Y(f.yFromBottom_mm).toFixed(1)}`).join(' ');
  const area = `${path} L ${midX} ${Y(H)} L ${midX} ${Y(0)} Z`;
  const hasNeg = fibers.some((f) => f.value < -raw * 0.02);
  const hasPos = fibers.some((f) => f.value > raw * 0.02);
  const ticks = hasNeg ? [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs] : [0, maxAbs / 2, maxAbs];
  const top = fibers.reduce((a, c) => (Math.abs(c.yFromBottom_mm - H) < Math.abs(a.yFromBottom_mm - H) ? c : a), fibers[0]);
  const bot = fibers.reduce((a, c) => (Math.abs(c.yFromBottom_mm) < Math.abs(a.yFromBottom_mm) ? c : a), fibers[0]);
  const peak = fibers.reduce((a, c) => (Math.abs(c.value) > Math.abs(a.value) ? c : a), fibers[0]);

  let naY: number | null = null;
  if (markNA) {
    if (hasNeg && hasPos) {
      for (let i = 1; i < fibers.length; i++) {
        if (fibers[i - 1].value * fibers[i].value < 0) {
          const a = fibers[i - 1];
          const c = fibers[i];
          naY = a.yFromBottom_mm + (Math.abs(a.value) / (Math.abs(a.value) + Math.abs(c.value))) * (c.yFromBottom_mm - a.yFromBottom_mm);
          break;
        }
      }
    } else {
      naY = H / 2;
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <span className="text-[10.5px] font-bold whitespace-nowrap" style={{ color }}>{title}</span>
        <span className="text-[9px] num text-right leading-tight min-w-0" style={{ color: 'var(--ink-3)' }}>
          {hideValues ? (
            <>values hidden, read the curve</>
          ) : markPeak ? (
            <>
              peak <strong style={{ color }}>{fmt(peak.value, 1)}</strong> {unit} at y = {fmt(peak.yFromBottom_mm, 0)} mm
            </>
          ) : (
            <>
              top <strong style={{ color }}>{fmt(top.value, 1)}</strong> · bottom <strong style={{ color }}>{fmt(bot.value, 1)}</strong> {unit}
            </>
          )}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full block" style={{ maxHeight: 236 }}>
        <rect x={padL} y={padT} width={w - padL - padR} height={plotH} fill="none" stroke="var(--line)" strokeWidth={0.8} />
        {ticks.map((t) => (
          <g key={`t${t}`}>
            <line
              x1={X(t)} y1={padT} x2={X(t)} y2={padT + plotH}
              stroke="var(--line)" strokeWidth={t === 0 ? 1 : 0.55} opacity={t === 0 ? 1 : 0.5}
            />
            <text x={X(t)} y={padT + plotH + 9} fontSize={7} textAnchor="middle" fill="var(--ink-3)" fontWeight={700}>
              {t === 0 ? '0' : fmt(t, maxAbs < 10 ? 1 : 0)}
            </text>
          </g>
        ))}
        <path d={area} fill={color} opacity={0.15} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />

        {/* depth axis, outside the plot so nothing can overlap the curves */}
        <text x={padL - 4} y={Y(0) + 3} fontSize={7.5} textAnchor="end" fill="var(--ink-3)" fontWeight={700}>0</text>
        <text x={padL - 4} y={Y(H) + 3} fontSize={7.5} textAnchor="end" fill="var(--ink-3)" fontWeight={700}>{fmt(H, 0)}</text>
        <text x={padL - 4} y={(Y(0) + Y(H)) / 2 + 3} fontSize={6.5} textAnchor="end" fill="var(--ink-3)">mm</text>

        {naY !== null && (
          <g>
            <line x1={padL} y1={Y(naY)} x2={w - padR} y2={Y(naY)} stroke="var(--hogging)" strokeWidth={1} strokeDasharray="5 3" opacity={0.8} />
            <text x={w - padR - 2} y={Y(naY) - 3} fontSize={7} fontWeight={800} textAnchor="end" fill="var(--hogging)">NA</text>
          </g>
        )}

        {markPeak && (
          <g>
            <circle cx={X(peak.value)} cy={Y(peak.yFromBottom_mm)} r={2.6} fill={color} stroke="var(--surface)" strokeWidth={1.2} />
            <text
              x={X(peak.value) + 5} y={Y(peak.yFromBottom_mm) + 3} fontSize={7.5} fontWeight={800} fill={color}
              paintOrder="stroke" stroke="var(--surface)" strokeWidth={2.2}
            >
              peak
            </text>
          </g>
        )}

        {probeY !== undefined && (
          <g>
            <line x1={padL} y1={Y(probeY)} x2={w - padR} y2={Y(probeY)} stroke="var(--warn)" strokeWidth={1.2} strokeDasharray="3 2" />
            <circle cx={X(probeValue ?? 0)} cy={Y(probeY)} r={3} fill="var(--warn)" stroke="var(--surface)" strokeWidth={1.2} />
          </g>
        )}
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const SHAPE_OPTIONS: Array<{ value: SectionShapeType; label: string }> = [
  { value: 'i_section', label: 'I' },
  { value: 'rectangular', label: '▭' },
  { value: 't_section', label: 'T' },
  { value: 'box_section', label: '☐' },
  { value: 'circular', label: '●' },
  { value: 'hollow_circular', label: '◍' },
];

export const SectionModule: React.FC<{
  dims: SectionDimensions;
  onDims: (d: SectionDimensions) => void;
  analytic: ReturnType<typeof analyticSection>;
  named: NamedSection;
  baseRes: ReturnType<typeof analyzeCrossSection>;
  /** material yield is app-wide state so the atlas and this lab never disagree */
  fy: number;
  onFy: (v: number) => void;
}> = ({ dims, onDims, analytic, named, fy, onFy }) => {
  const { toSection, setToSection, setToMohr, goto, toast, sectionKey, setSectionKey, lang, hideAnswers } = useAnalysis();
  const q = (v: React.ReactNode) => (hideAnswers ? '•••' : v);
  const [M, setM] = useState(toSection?.M ?? 40);
  const [V, setV] = useState(toSection?.V ?? 30);
  const [N, setN] = useState(toSection?.N ?? 0);
  const setFy = onFy;
  const [probeY, setProbeY] = useState<number | null>(null);
  const [linked, setLinked] = useState(!!toSection);
  const [mtab, setMtab] = useState<'model' | 'result'>('result');

  const loads = useMemo(() => ({ M_kNm: M, V_kN: V, N_kN: N, fy_MPa: fy }), [M, V, N, fy]);
  const res = useMemo(() => analyzeCrossSection(dims, loads), [dims, loads]);

  const H = res.totalDepth_mm;
  const probe = probeY ?? H / 2;
  const fiber = useMemo(() => {
    let best = res.fibers[0];
    for (const f of res.fibers) if (Math.abs(f.yFromBottom_mm - probe) < Math.abs(best.yFromBottom_mm - probe)) best = f;
    return best;
  }, [res.fibers, probe]);

  const sigmaFibers = res.fibers.map((f) => ({ yFromBottom_mm: f.yFromBottom_mm, value: f.sigma_MPa }));
  const tauFibers = res.fibers.map((f) => ({ yFromBottom_mm: f.yFromBottom_mm, value: f.tau_MPa }));

  const setDim = (patch: Partial<SectionDimensions>) => onDims({ ...dims, ...patch });

  const errPct = (a: number, b: number) => (Math.abs(b) < 1e-9 ? 0 : Math.abs((a - b) / b) * 100);
  const checks = [
    { label: 'Area A', engine: res.area_mm2, exact: analytic.area_mm2, unit: 'mm²', fmt: 0 },
    { label: 'Ixx', engine: res.Ixx_mm4, exact: analytic.Ixx_mm4, unit: 'mm⁴', fmt: 0 },
    { label: 'ȳ from bottom', engine: res.yCentroid_mm, exact: analytic.yCentroid_mm, unit: 'mm', fmt: 2 },
    { label: 'Z top', engine: res.Ztop_mm3, exact: analytic.Ztop_mm3, unit: 'mm³', fmt: 0 },
    { label: 'Z bottom', engine: res.Zbot_mm3, exact: analytic.Zbot_mm3, unit: 'mm³', fmt: 0 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(280px,330px)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,370px)_minmax(0,1fr)] gap-3">
      {/* LEFT */}
      <div className="space-y-2.5">
        <Card title="Section" sub={dimsSummary(dims)} right={<Badge tone="blue">{named.family}</Badge>}>
          <div className="space-y-2">
            <Field label="Catalogue section" hint="Or edit the dimensions below, every input is live">
              <select
                value={sectionKey}
                onChange={(e) => setSectionKey(e.target.value)}
                className="w-full rounded-lg px-2 py-1.5 text-[12px] font-semibold"
                style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)' }}
              >
                {NAMED_SECTIONS.map((s) => (
                  <option key={s.key} value={s.key}>{s.name}</option>
                ))}
              </select>
            </Field>
            <div>
              <span className="block text-[10.5px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-3)' }}>Shape</span>
              <Segmented full size="sm" value={dims.shape} onChange={(s) => setDim({ shape: s })} options={SHAPE_OPTIONS} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(dims.shape === 'circular' || dims.shape === 'hollow_circular') ? (
                <>
                  <Field label="Outer Ø (mm)" hint="Sets J and the extreme fibre distance c = D/2">
                    <NumInput value={dims.outerDia_mm} step={5} min={20} onChange={(v) => setDim({ outerDia_mm: Math.max(20, v) })} />
                  </Field>
                  {dims.shape === 'hollow_circular' && (
                    <Field label="Inner Ø (mm)" hint="0 = solid. Wall thickness decides how much weight you save for the same τ">
                      <NumInput value={dims.innerDia_mm} step={5} min={0} onChange={(v) => setDim({ innerDia_mm: Math.max(0, Math.min(v, dims.outerDia_mm - 5)) })} />
                    </Field>
                  )}
                </>
              ) : (
                <>
                  <Field label={dims.shape === 't_section' ? 'Flange width bf' : 'Width b (mm)'} hint="Only the part far from the centroid really adds I">
                    <NumInput value={dims.width_mm} step={5} min={10} onChange={(v) => setDim({ width_mm: Math.max(10, v) })} />
                  </Field>
                  <Field label="Depth h (mm)" hint="Doubling h multiplies I by eight, the strongest single lever here">
                    <NumInput value={dims.depth_mm} step={5} min={20} onChange={(v) => setDim({ depth_mm: Math.max(20, v) })} />
                  </Field>
                  {(dims.shape === 'i_section' || dims.shape === 't_section' || dims.shape === 'box_section') && (
                    <>
                      <Field label="Flange tf (mm)" hint="Drives the plastic modulus and local buckling, not Ixx much">
                        <NumInput value={dims.flangeThick_mm} step={1} min={2} onChange={(v) => setDim({ flangeThick_mm: Math.max(2, v) })} />
                      </Field>
                      <Field label="Web tw (mm)" hint="Almost all the shear comes down this strip">
                        <NumInput value={dims.webThick_mm} step={1} min={2} onChange={(v) => setDim({ webThick_mm: Math.max(2, v) })} />
                      </Field>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="text-[10px] num rounded-lg px-2 py-1" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}>
              {analytic.formulaNote}
            </div>
          </div>
        </Card>

        <Card
          title="Internal forces at the cut"
          sub="Feed these from the beam or frame lab, or type your own textbook values"
          right={toSection ? <Badge tone="green">linked</Badge> : undefined}
        >
          <div className="space-y-2">
            {toSection && (
              <div className="rounded-lg p-2 text-[10.5px] leading-snug" style={{ background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', color: 'var(--ink-2)' }}>
                Received: <strong>{toSection.source}</strong>
                <div className="mt-1 flex gap-1">
                  <Btn size="sm" onClick={() => { setM(toSection.M); setV(toSection.V); setN(toSection.N); setLinked(true); }}>
                    Use latest handoff
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => { setToSection(null); setLinked(false); }}>
                    Clear
                  </Btn>
                </div>
              </div>
            )}
            <Slider label="Bending moment M (sagging +)" value={M} min={-200} max={200} step={1} onChange={setM} suffix="kN·m" />
            <Slider label="Shear force V" value={V} min={-200} max={200} step={1} onChange={setV} suffix="kN" />
            <Slider label="Axial force N (tension +)" value={N} min={-400} max={400} step={5} onChange={setN} suffix="kN" />
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="M exact" hint="Type the textbook value instead of dragging">
                <NumInput value={M} step={1} onChange={setM} suffix="kN·m" />
              </Field>
              <Field label="V exact" hint="Shear at the same cut as M">
                <NumInput value={V} step={1} onChange={setV} suffix="kN" />
              </Field>
              <Field label="N exact" hint="Negative = compression (columns), positive = tension">
                <NumInput value={N} step={5} onChange={setN} suffix="kN" />
              </Field>
              <Field label="fy of material" hint="Yield / characteristic strength">
                <NumInput value={fy} step={5} onChange={(v) => setFy(Math.max(5, v))} suffix="MPa" />
              </Field>
            </div>
            <div className="flex gap-1.5">
              <Btn onClick={() => { setM(0); setV(0); setN(0); }}>Zero forces</Btn>
              <Btn
                onClick={() => {
                  setM(40);
                  setV(30);
                  setN(0);
                  toast('Typical classroom load set: M = 40 kN·m, V = 30 kN.', 'info');
                }}
              >
                Typical set
              </Btn>
            </div>
            {linked && <div className="text-[10px]" style={{ color: 'var(--ink-3)' }}>Values stay editable, handoff only seeds them.</div>}
          </div>
        </Card>

        <Card title="Continue the chain">
          <div className="space-y-1.5">
            <Btn
              variant="primary"
              size="md"
              icon={<Compass className="w-4 h-4" />}
              onClick={() => {
                setToMohr({
                  sigmaX: fiber.sigma_MPa,
                  tauXY: fiber.tau_MPa,
                  label: `y = ${fmt(probe, 0)} mm fibre (σ ${fmt(fiber.sigma_MPa, 1)} MPa, τ ${fmt(fiber.tau_MPa, 1)} MPa)`,
                });
                goto('mohr');
                toast('This exact fibre stress state is now the Mohr-circle input.', 'ok');
              }}
            >
              Send probe fibre stress to Mohr's circle
            </Btn>
            <Btn size="md" icon={<Ruler className="w-4 h-4" />} onClick={() => goto('buckling')}>
              Use A, I & material for column buckling
            </Btn>
          </div>
        </Card>
      </div>

      {/* RIGHT */}
      <div className={`space-y-2.5 ${mtab === 'result' ? 'block' : 'hidden md:block'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <Stat label="Area" value={fmt(res.area_mm2 / 100, 0)} unit="cm²" />
          <Stat label="Ixx" value={fmt(res.Ixx_cm4, 0)} unit="cm⁴" tone="accent" />
          <Stat
            label={Math.abs(res.yCentroid_mm - H / 2) > 0.5 ? 'ȳ (unsymmetric!)' : 'ȳ (from bottom)'}
            value={fmt(res.yCentroid_mm, 1)}
            unit="mm"
            tone={Math.abs(res.yCentroid_mm - H / 2) > 0.5 ? 'warn' : 'neutral'}
          />
          <Stat label="rmin" value={fmt(analytic.rMin_mm, 1)} unit="mm" />
        </div>

        <Card
          title="Fibre stress through the depth"
          sub="σ from N/A − My/I, τ from VQ/Ib (the engine integrates 1000 strips; compare below)"
          right={<Badge tone={res.isSafe ? 'green' : 'rose'}>{res.isSafe ? 'σvM ≤ fy' : 'yield exceeded'}</Badge>}
        >
          <div className="grid grid-cols-1 xl:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)] gap-2 items-start">
            <div>
              <SectionShapeSvg dims={dims} probeY={probe} height={210} />
              <div className="mt-1 flex items-center justify-between gap-1">
                <span className="text-[9.5px] font-bold" style={{ color: 'var(--ink-3)' }}>probe y</span>
                <input
                  type="range"
                  min={0}
                  max={H}
                  step={1}
                  value={probe}
                  onChange={(e) => setProbeY(parseFloat(e.target.value))}
                />
              </div>
            </div>
            <ProfileSvg fibers={sigmaFibers} H={H} title="Normal stress σ(y)" unit="MPa" color="var(--sagging)" probeY={probe} probeValue={fiber.sigma_MPa} hideValues={hideAnswers} />
            <ProfileSvg fibers={tauFibers} H={H} title="Shear stress τ(y)" unit="MPa" color="var(--accent)" probeY={probe} probeValue={fiber.tau_MPa} markNA={false} markPeak hideValues={hideAnswers} />
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            <Stat label="σ at probe" value={fmt(fiber.sigma_MPa, 2)} unit="MPa" tone={fiber.sigma_MPa >= 0 ? 'ok' : 'bad'} />
            <Stat label="τ at probe" value={fmt(fiber.tau_MPa, 2)} unit="MPa" tone="accent" />
            <Stat label="σvM" value={fmt(fiber.vonMises_MPa, 2)} unit="MPa" tone={fiber.vonMises_MPa > fy ? 'bad' : 'neutral'} />
            <Stat label="max σt" value={fmt(res.maxTension_MPa, 1)} unit="MPa" tone="ok" />
            <Stat label="max σc" value={fmt(res.maxCompression_MPa, 1)} unit="MPa" tone="bad" />
          </div>

          <div className="mt-2 rounded-lg p-2 text-[10.5px] leading-relaxed num" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
            <div>
              σ = N/A − M·y/I = {fmt(N, 1)}/{fmt(res.area_mm2, 0)} − ({fmt(M, 1)}×10⁶)·({fmt(fiber.yFromCentroid_mm, 1)})/{fmt(res.Ixx_mm4, 0)} ={' '}
              <strong style={{ color: fiber.sigma_MPa >= 0 ? 'var(--ok)' : 'var(--compression)' }}>{q(`${fmt(fiber.sigma_MPa, 3)} MPa`)}</strong>
            </div>
            <div>
              τ = V·Q/(I·b) = {fmt(V, 1)}×10³ × {fmt(fiber.Q_mm3, 0)} / ({fmt(res.Ixx_mm4, 0)} × {fmt(fiber.width_mm, 1)}) ={' '}
              <strong style={{ color: 'var(--accent)' }}>{q(`${fmt(fiber.tau_MPa, 3)} MPa`)}</strong>
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: 'var(--ink-3)' }}>
              y is measured from the centroid (+ upward). Sagging M puts the top fibre in compression and the bottom in tension.
              {Math.abs(N) > 1e-6 && res.yShiftedNA_mm !== null
                ? ` With N = ${fmt(N, 0)} kN the axial strain moves the true neutral axis to y = ${fmt(res.yShiftedNA_mm, 1)} mm from the centroid.`
                : ' With N = 0 the neutral axis coincides with the centroid (pure bending).'}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
          <Card
            title={
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} /> Precision check: numeric vs closed form
              </span>
            }
            sub="The visualiser uses strip integration so any shape works; here it is verified against textbook formulas"
          >
            <div className="space-y-1">
              {checks.map((c) => {
                const e = errPct(c.engine, c.exact);
                return (
                  <div key={c.label} className="flex items-center gap-2 text-[10.5px] num rounded-md px-1.5 py-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                    <span className="w-[92px] font-bold" style={{ color: 'var(--ink-2)' }}>{c.label}</span>
                    <span className="flex-1 text-right">{q(fmt(c.engine, c.fmt))}</span>
                    <span className="flex-1 text-right" style={{ color: 'var(--ink-3)' }}>{q(fmt(c.exact, c.fmt))}</span>
                    <span className="w-[52px] text-right font-bold" style={{ color: e < 0.6 ? 'var(--ok)' : 'var(--warn)' }}>
                      {hideAnswers ? 'n/a' : `${e.toFixed(2)}%`}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase px-1.5" style={{ color: 'var(--ink-3)' }}>
                <span className="w-[92px]" />
                <span className="flex-1 text-right">strip engine</span>
                <span className="flex-1 text-right">closed form</span>
                <span className="w-[52px] text-right">error</span>
              </div>
            </div>
            <div className="mt-1.5 text-[10px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              {analytic.formulaNote} · J = {fmt(analytic.J_mm4 / 1e4, 1)} cm⁴ (used by the torsion lab)
            </div>
          </Card>

          <Card title="What to say while this is on the projector">
            <ul className="space-y-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {(lang === 'hinglish'
                ? [
                    'Flange (upar/neeche) bending jhelta hai; patla web shear jhelta hai, isliye I-beam ka shape aisa hai.',
                    'Neutral axis par normal stress ZERO hota hai, par shear stress MAX hota hai (Q max).',
                    'T-section me N.A. centroid se nahi, area-weighted average se aata hai, ȳ formula board par likhein.',
                    'Sagging M me neeche tension aata hai, RCC me sariya neeche. Hogging me ulta. Isi liye "tension side" BMD design ke liye useful hai.',
                  ]
                : [
                    'Flanges carry the bending couple; the thin web carries shear, that is why an I-section looks the way it does.',
                    'Normal stress is zero at the neutral axis, but shear stress peaks there because Q is maximum.',
                    'In a T-section the neutral axis is not at mid-depth: it is the area-weighted centroid (ȳ).',
                    'Sagging puts the bottom in tension, exactly where RCC rebar goes. Hogging flips it.',
                  ]
              ).map((t, i) => (
                <li key={i} className="flex gap-1.5">
                  <Crosshair className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <Hint tone={res.isSafe ? 'info' : 'warn'}>
                Utilisation = σvM,max / fy = {q(fmt(res.maxVonMises_MPa, 1))} / {q(fmt(fy, 0))} ={' '}
                <strong>{q(`${(res.utilizationRatio * 100).toFixed(1)}%`)}</strong>.{' '}
                {res.isSafe ? 'Section survives this load combination.' : 'Section would yield, deepen it or reduce the force.'}
              </Hint>
            </div>
          </Card>
        </div>

        <Card title="Full fibre table" sub="Every value the heat-map uses, copy into Excel or the lab record">
          <div className="scroll-x max-h-[240px] overflow-y-auto">
            <table className="w-full text-[10.5px] num border-collapse">
              <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
                <tr style={{ color: 'var(--ink-3)' }}>
                  {['y from bottom', 'y from NA', 'width b', 'Q (mm³)', 'σ (MPa)', 'τ (MPa)', 'σvM'].map((h) => (
                    <th key={h} className="text-left px-1.5 py-1 border-b font-bold whitespace-nowrap" style={{ borderColor: 'var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {res.fibers.filter((_, i) => i % Math.max(1, Math.floor(res.fibers.length / 24)) === 0).map((f, i) => (
                  <tr key={i} style={{ background: Math.abs(f.yFromBottom_mm - probe) < H / 30 ? 'var(--accent-soft)' : undefined }}>
                    <td className="px-1.5 py-0.5">{q(fmt(f.yFromBottom_mm, 1))}</td>
                    <td className="px-1.5 py-0.5">{q(fmt(f.yFromCentroid_mm, 1))}</td>
                    <td className="px-1.5 py-0.5">{q(fmt(f.width_mm, 1))}</td>
                    <td className="px-1.5 py-0.5">{q(fmt(f.Q_mm3, 0))}</td>
                    <td className="px-1.5 py-0.5 font-bold" style={{ color: f.sigma_MPa >= 0 ? 'var(--ok)' : 'var(--compression)' }}>{q(fmt(f.sigma_MPa, 2))}</td>
                    <td className="px-1.5 py-0.5">{q(fmt(f.tau_MPa, 2))}</td>
                    <td className="px-1.5 py-0.5">{q(fmt(f.vonMises_MPa, 2))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-1 text-[10px] flex items-center gap-1" style={{ color: 'var(--ink-3)' }}>
            <Layers className="w-3 h-3" /> {res.fibers.length} strips integrated · Q(y) uses flange/web step probes so the corner jumps are exact
          </div>
        </Card>
      </div>
    </div>
  );
};
