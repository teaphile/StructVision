import React, { useMemo, useState } from 'react';
import { CheckCircle2, Columns3, Plus, RotateCw, Trash2 } from 'lucide-react';
import { ColumnEndCondition, analyzeColumnBuckling, analyzeShaftTorsion, ShaftSegment } from '../engine/sectionMohrBucklingEngine';
import { analyticSection, findSection } from '../engine/sectionLib';
import { useAnalysis } from '../ui/AnalysisContext';
import { Acc, Badge, Btn, Card, Field, Hint, NumInput, Segmented, Slider, Stat, fmt } from '../ui/primitives';

const END_CONDS: Array<{ id: ColumnEndCondition; label: string; K: number; note: string }> = [
  { id: 'fixed_free', label: 'Fixed-Free (flag pole)', K: 2.0, note: 'cantilever, weakest' },
  { id: 'pinned_pinned', label: 'Pin-Pin (hinged)', K: 1.0, note: 'classroom Euler case' },
  { id: 'fixed_pinned', label: 'Fixed-Pin', K: 0.7, note: 'common in frames' },
  { id: 'fixed_fixed', label: 'Fixed-Fixed', K: 0.5, note: 'strongest, 4× the pin-pin Euler load' },
];

export const BucklingModule: React.FC = () => {
  const { sectionDims, sectionKey, lang, goto, hideAnswers } = useAnalysis();
  const q = (v: React.ReactNode) => (hideAnswers ? '•••' : v);
  const [sub, setSub] = useState<'column' | 'torsion'>('column');
  const named = findSection(sectionKey);
  const exact = analyticSection(named.dims);

  /* ---------------- column ---------------- */
  const [L, setL] = useState(3);
  const [E, setE] = useState(sectionDims.E_GPa);
  const [fy, setFy] = useState(named.fy_MPa);
  const [A, setA] = useState(sectionDims.A_cm2);
  const [I, setI] = useState(sectionDims.I_cm4);
  const [Papp, setPapp] = useState(150);
  const [cond, setCond] = useState<ColumnEndCondition>('pinned_pinned');

  const results = useMemo(
    () =>
      END_CONDS.map((c) => ({
        ...c,
        res: analyzeColumnBuckling({ endCondition: c.id, length_m: L, E_GPa: E, fy_MPa: fy, area_cm2: A, Imin_cm4: I, appliedLoad_kN: Papp }),
      })),
    [L, E, fy, A, I, Papp]
  );

  const sel = results.find((r) => r.id === cond) ?? results[1];

  /* ---------------- torsion ---------------- */
  const [segs, setSegs] = useState<ShaftSegment[]>([
    { id: 's1', label: 'Motor', length_m: 1.2, outerDia_mm: 70, innerDia_mm: 0, G_GPa: 80, endTorque_kNm: 0 },
    { id: 's2', label: 'Step', length_m: 1.5, outerDia_mm: 55, innerDia_mm: 0, G_GPa: 80, endTorque_kNm: 6 },
    { id: 's3', label: 'Pulley', length_m: 1.0, outerDia_mm: 55, innerDia_mm: 38, G_GPa: 80, endTorque_kNm: -3.5 },
  ]);
  const [rpm, setRpm] = useState(600);
  const shaft = useMemo(() => analyzeShaftTorsion(segs, rpm), [segs, rpm]);

  const patchSeg = (id: string, p: Partial<ShaftSegment>) => setSegs((arr) => arr.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="md"
          value={sub}
          onChange={setSub}
          options={[
            { value: 'column', label: 'A · Column buckling' },
            { value: 'torsion', label: 'B · Shaft torsion' },
          ]}
        />
        <span className="text-[10.5px] ml-auto" style={{ color: 'var(--ink-3)' }}>
          from section lab: <strong style={{ color: 'var(--ink-2)' }}>{named.name}</strong> · A = {fmt(A, 1)} cm² · Imin = {fmt(I, 1)} cm⁴
        </span>
      </div>

      {sub === 'column' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-3">
            <div className="space-y-2.5">
              <Card title="Column" sub="Change any value, all four end conditions re-solve immediately">
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="Length L (m)" hint="Double L → quarter Pcr"><NumInput value={L} step={0.25} onChange={(v) => setL(Math.max(0.2, v))} suffix="m" /></Field>
                  <Field label="E (GPa)" hint="Steel 200 · Al 70 · timber 10"><NumInput value={E} step={5} onChange={(v) => setE(Math.max(1, v))} suffix="GPa" /></Field>
                  <Field label="fy (MPa)" hint="Sets the Euler↔Johnson switch"><NumInput value={fy} step={10} onChange={(v) => setFy(Math.max(20, v))} suffix="MPa" /></Field>
                  <Field label="Area A (cm²)" hint="Enters only as r = √(I/A)"><NumInput value={Math.round(A * 10) / 10} step={1} onChange={(v) => setA(Math.max(1, v))} suffix="cm²" /></Field>
                  <Field label="Imin (cm⁴)" hint="weak axis governs"><NumInput value={Math.round(I * 10) / 10} step={100} onChange={(v) => setI(Math.max(10, v))} suffix="cm⁴" /></Field>
                  <Field label="Applied P (kN)" hint="Checked against all four K values"><NumInput value={Papp} step={10} onChange={(v) => setPapp(Math.max(0, v))} suffix="kN" /></Field>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <Btn
                    onClick={() => {
                      setA(Math.round(exact.area_mm2 / 100));
                      setI(Math.round(exact.Ixx_mm4 / 1e4));
                      setE(named.E_GPa);
                      setFy(named.fy_MPa);
                    }}
                  >
                    Re-import {named.name}
                  </Btn>
                  <Btn variant="ghost" onClick={() => goto('section')}>Open section lab</Btn>
                </div>
                <div className="mt-1.5 text-[10.5px] num rounded-lg px-2 py-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
                  rmin = √(Imin/A) = √({fmt(I, 0)} / {fmt(A, 0)}) cm = {fmt(Math.sqrt((I * 1e4) / (A * 100)), 2)} mm
                </div>
              </Card>

              <Card title="Boundary condition to analyse" sub="Same column, four ways of holding it">
                <div className="space-y-1">
                  {END_CONDS.map((c) => {
                    const r = results.find((x) => x.id === c.id)!;
                    const on = cond === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setCond(c.id)}
                        className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                        style={{ background: on ? 'var(--accent-soft)' : 'var(--surface-2)', border: `1px solid ${on ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--line)'}` }}
                      >
                        <span className="num text-[10px] font-extrabold w-8" style={{ color: on ? 'var(--accent)' : 'var(--ink-3)' }}>K={c.K}</span>
                        <span className="min-w-0">
                          <span className="block text-[11px] font-bold leading-tight">{c.label}</span>
                          <span className="block text-[9px] num" style={{ color: r.res.isBuckled ? 'var(--compression)' : 'var(--ink-3)' }}>
                            Pcr {q(fmt(r.res.governingCriticalLoad_kN, 0))} kN · {c.note}
                          </span>
                        </span>
                        <span className="ml-auto text-[9px] font-extrabold" style={{ color: r.res.isBuckled ? 'var(--compression)' : 'var(--ok)' }}>
                          {r.res.isBuckled ? 'FAIL' : 'OK'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <Stat label="λ = KL/r" value={fmt(sel.res.slenderness, 0)} tone={sel.res.classification === 'long' ? 'warn' : 'neutral'} />
                <Stat label="Pcr governing" value={fmt(sel.res.governingCriticalLoad_kN, 0)} unit="kN" tone="accent" />
                <Stat label="σcr" value={fmt(sel.res.governingStress_MPa, 1)} unit="MPa" />
                <Stat label="P applied / Pcr" value={`${(sel.res.appliedRatio * 100).toFixed(0)}`} unit="%" tone={sel.res.isBuckled ? 'bad' : 'ok'} />
              </div>

              <Card
                title="Four columns, same material, watch where they bow"
                sub="Cyan trace = the effective half-sine Leff = K·L that actually buckles"
                right={<Badge tone={sel.res.classification === 'long' ? 'blue' : sel.res.classification === 'intermediate' ? 'amber' : 'green'}>{sel.res.classification} column</Badge>}
              >
                {/* the column drawings only need 200 units of height; the card above them used
                    the full 300 and left a band of dead space, so the box is drawn to fit */}
                <svg viewBox="0 0 760 236" className="w-full block" style={{ maxHeight: 250 }}>
                  {results.map((c, idx) => {
                    const baseX = 70 + idx * 180;
                    const topY = 30;
                    const botY = 178;
                    const amp = c.res.isBuckled ? 26 : 20;
                    const pts = c.res.modeShape;
                    const path = pts
                      .map((p, i) => {
                        const y = botY - p.yRatio * (botY - topY);
                        const x = baseX + p.lateralNorm * amp;
                        return `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                      })
                      .join(' ');
                    const eff = pts
                      .filter((p) => p.inEffectiveWave)
                      .map((p, i) => {
                        const y = botY - p.yRatio * (botY - topY);
                        const x = baseX + p.lateralNorm * amp;
                        return `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                      })
                      .join(' ');
                    const on = sel.id === c.id;
                    return (
                      <g key={c.id}>
                        <rect x={baseX - 68} y={8} width={136} height={196} rx={10} fill={on ? 'var(--accent-soft)' : 'transparent'} stroke={on ? 'var(--accent)' : 'var(--line)'} strokeWidth={on ? 1.4 : 1} />
                        <line x1={baseX} y1={topY} x2={baseX} y2={botY} stroke="var(--line-strong)" strokeWidth={1.2} strokeDasharray="4 4" />
                        <path d={path} fill="none" stroke="var(--ink-3)" strokeWidth={2.4} />
                        {eff && <path d={eff} fill="none" stroke={c.res.isBuckled ? 'var(--compression)' : 'var(--accent)'} strokeWidth={3.4} />}
                        <line x1={baseX - 22} y1={botY + 2} x2={baseX + 22} y2={botY + 2} stroke="var(--ok)" strokeWidth={2.6} />
                        {c.id !== 'fixed_free' && <line x1={baseX - 20} y1={topY - 2} x2={baseX + 20} y2={topY - 2} stroke="var(--ok)" strokeWidth={2.2} />}
                        <text x={baseX} y={21} fontSize={10} textAnchor="middle" fontWeight={800} fill={on ? 'var(--accent)' : 'var(--ink-2)'}>
                          K = {c.K}
                        </text>
                        <text x={baseX} y={196} fontSize={8.8} textAnchor="middle" fill="var(--ink-3)" fontWeight={700}>
                          Leff {q(fmt(c.res.effectiveLength_m, 2))} m
                        </text>
                        <text x={baseX} y={221} fontSize={9} textAnchor="middle" fontWeight="800" fill={c.res.isBuckled ? 'var(--compression)' : 'var(--ok)'}>
                          {q(fmt(c.res.governingCriticalLoad_kN, 0))} kN
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </Card>

              <Card
                title="σcr vs slenderness, Johnson parabola meets Euler hyperbola"
                sub={`Transition at λc = √(2π²E/fy) = ${fmt(sel.res.criticalSlenderness, 1)}`}
              >
                {(() => {
                  const W = 720;
                  const H = 286;
                  const padL = 56;
                  const padR = 22;
                  const padT = 20;
                  const padB = 40;
                  const maxLam = Math.max(220, sel.res.slenderness * 1.15);
                  const maxSig = fy * 1.15;
                  const X = (l: number) => padL + (Math.min(l, maxLam) / maxLam) * (W - padL - padR);
                  const Y = (s: number) => padT + (1 - Math.min(s, maxSig) / maxSig) * (H - padT - padB);
                  const curve = sel.res.curve;
                  const designPath = curve.map((c, i) => `${i ? 'L' : 'M'} ${X(c.slenderness).toFixed(1)} ${Y(c.designStress_MPa).toFixed(1)}`).join(' ');
                  const eulerPath = curve.map((c, i) => `${i ? 'L' : 'M'} ${X(c.slenderness).toFixed(1)} ${Y(c.eulerStress_MPa).toFixed(1)}`).join(' ');
                  const ox = X(sel.res.slenderness);
                  const oy = Y(sel.res.governingStress_MPa);
                  const lamTicks = [0, 50, 100, 150, 200].filter((l) => l <= maxLam);
                  const sigTicks = [0, fy / 2, fy];
                  const labelRight = ox > (padL + W - padR) * 0.62;
                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ maxHeight: 300 }}>
                      {/* the two regimes, shaded so the eye knows which curve is in charge */}
                      <rect x={padL} y={padT} width={X(sel.res.criticalSlenderness) - padL} height={H - padT - padB} fill="color-mix(in srgb, var(--compression) 6%, transparent)" />
                      <rect x={X(sel.res.criticalSlenderness)} y={padT} width={W - padR - X(sel.res.criticalSlenderness)} height={H - padT - padB} fill="color-mix(in srgb, var(--accent) 6%, transparent)" />
                      <text x={padL + 6} y={padT + 12} fontSize={8} fontWeight={800} fill="var(--compression)" opacity={0.85}>JOHNSON · crushing dominates</text>
                      <text x={W - padR - 6} y={padT + 12} fontSize={8} fontWeight={800} textAnchor="end" fill="var(--accent)" opacity={0.95}>EULER · buckling dominates</text>

                      {/* axes + ticks */}
                      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--ink-3)" strokeWidth={1.1} />
                      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--ink-3)" strokeWidth={1.1} />
                      {lamTicks.map((l) => (
                        <g key={`lx${l}`}>
                          <line x1={X(l)} y1={H - padB} x2={X(l)} y2={H - padB + 4} stroke="var(--ink-3)" strokeWidth={0.9} />
                          <text x={X(l)} y={H - padB + 13} fontSize={7.5} textAnchor="middle" fill="var(--ink-3)" fontWeight={700} className="num">{l}</text>
                        </g>
                      ))}
                      {sigTicks.map((v) => (
                        <g key={`sy${v}`}>
                          <line x1={padL - 4} y1={Y(v)} x2={padL} y2={Y(v)} stroke="var(--ink-3)" strokeWidth={0.9} />
                          <text x={padL - 7} y={Y(v) + 3} fontSize={7.5} textAnchor="end" fill="var(--ink-3)" fontWeight={700} className="num">{fmt(v, 0)}</text>
                        </g>
                      ))}

                      <line x1={padL} y1={Y(fy)} x2={W - padR} y2={Y(fy)} stroke="var(--compression)" strokeWidth={1} strokeDasharray="4 4" />
                      <text x={W - padR - 2} y={Y(fy) - 4} fontSize={8} fill="var(--compression)" fontWeight={800} textAnchor="end">fy = {fmt(fy, 0)} MPa (squash limit)</text>
                      <line x1={X(sel.res.criticalSlenderness)} y1={padT} x2={X(sel.res.criticalSlenderness)} y2={H - padB} stroke="var(--warn)" strokeWidth={1} strokeDasharray="4 4" />
                      <text x={X(sel.res.criticalSlenderness) + 4} y={H - padB - 5} fontSize={8} fill="var(--warn)" fontWeight={800} textAnchor="start">λc = {q(fmt(sel.res.criticalSlenderness, 0))}</text>

                      <path d={eulerPath} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} strokeDasharray="5 4" opacity={0.85} />
                      <path d={designPath} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinejoin="round" />

                      {/* which curve is which, written on the curve itself */}
                      <text x={X(maxLam * 0.82)} y={Y(fy * 0.30) + 4} fontSize={8} fontWeight={800} fill="var(--ink-3)" textAnchor="middle">Euler alone (unsafe)</text>
                      <text x={X(maxLam * 0.55)} y={Y(fy * 0.34) + 4} fontSize={8} fontWeight={800} fill="var(--accent)" textAnchor="middle">design σcr</text>

                      <circle cx={ox} cy={oy} r={5.5} fill="var(--warn)" stroke="var(--canvas)" strokeWidth={1.4} />
                      <line x1={ox} y1={oy} x2={ox} y2={H - padB} stroke="var(--warn)" strokeWidth={0.9} strokeDasharray="2 3" opacity={0.7} />
                      <text
                        x={labelRight ? ox - 9 : ox + 9}
                        y={oy < Y(fy) + 16 ? oy + 17 : oy - 8}
                        fontSize={9}
                        fontWeight={800}
                        fill="var(--warn)"
                        textAnchor={labelRight ? 'end' : 'start'}
                        paintOrder="stroke"
                        stroke="var(--surface)"
                        strokeWidth={2.6}
                      >
                        this column · λ {q(fmt(sel.res.slenderness, 0))} → {q(fmt(sel.res.governingStress_MPa, 0))} MPa
                      </text>
                      <text x={(padL + W - padR) / 2} y={H - 6} fontSize={9} textAnchor="middle" fill="var(--ink-3)" fontWeight={700}>
                        slenderness λ = K·L / r →
                      </text>
                      <text x={13} y={padT + (H - padT - padB) / 2} fontSize={9} fill="var(--ink-3)" fontWeight={700} transform={`rotate(-90 13 ${padT + (H - padT - padB) / 2})`} textAnchor="middle">
                        σcr (MPa)
                      </text>
                    </svg>
                  );
                })()}
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                <Card title="The numbers, with the formula beside them">
                  <div className="space-y-1 text-[10.5px] num" style={{ color: 'var(--ink-2)' }}>
                    {[
                      `Leff = K·L = ${sel.K} × ${fmt(L, 2)} = ${fmt(sel.res.effectiveLength_m, 3)} m`,
                      `r = √(I/A) = ${fmt(sel.res.radiusGyration_mm, 2)} mm`,
                      `λ = Leff/r = ${fmt(sel.res.slenderness, 1)}  (λc = ${fmt(sel.res.criticalSlenderness, 1)})`,
                      `P(Euler) = π²EI/Leff² = ${fmt(sel.res.eulerCriticalLoad_kN, 1)} kN`,
                      `P(Johnson) = A·fy·[1 − fy/(4π²E)·λ²] = ${fmt(sel.res.johnsonCriticalLoad_kN, 1)} kN`,
                      `P(crush) = A·fy = ${fmt(sel.res.crushingLoad_kN, 1)} kN`,
                      `Governing = min(Euler, Johnson) = ${fmt(sel.res.governingCriticalLoad_kN, 1)} kN`,
                      `Applied ${fmt(Papp, 0)} kN → utilisation ${(sel.res.appliedRatio * 100).toFixed(0)}%`,
                    ].map((t, i) => (
                      <div key={i} className="rounded-md px-1.5 py-0.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>{q(t)}</div>
                    ))}
                  </div>
                </Card>
                <Card title="Teach it like this">
                  <ul className="space-y-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {(lang === 'hinglish'
                      ? [
                          'Column apni strength se nahi, LENGTH se tootta hai. Same section, L double → Pcr quarter!',
                          'K ka matlab: hawa mein kitni door tak column "free" hai. Dono sirre pakde → chhota Leff, zyada load.',
                          'Euler lamba column ke liye hai; chhote dabbe column me material pehle crush hota hai (Johnson).',
                          'Design me hamesha Imin (weak axis) use hota hai, kyunki column sabse pehle wahi jhukta hai.',
                        ]
                      : [
                          'A column fails on slenderness, not just strength: double L and Pcr drops to one quarter.',
                          'K measures how much length is free to wobble; restrain both ends and the same steel carries far more.',
                          'Euler applies to long columns; in a stubby column the material crushes first, Johnson blends the two.',
                          'Always use Imin (weak axis) in design: that is the direction the column bows first.',
                        ]
                    ).map((t, i) => (
                      <li key={i} className="flex gap-1.5">
                        <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <Hint tone={sel.res.isBuckled ? 'warn' : 'info'}>
                      {sel.res.isBuckled
                        ? `The applied ${hideAnswers ? '•••' : fmt(Papp, 0)} kN is above the governing ${hideAnswers ? '•••' : fmt(sel.res.governingCriticalLoad_kN, 0)} kN, the column would buckle.`
                        : `Safe by ${hideAnswers ? '•••' : (100 - sel.res.appliedRatio * 100).toFixed(0)}% against the governing ${hideAnswers ? '•••' : fmt(sel.res.governingCriticalLoad_kN, 0)} kN.`}
                    </Hint>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </>
      )}

      {sub === 'torsion' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] gap-3">
          <div className="space-y-2.5">
            <Card
              title="Shaft segments"
              sub="Torque applied at each segment end; the wall at x = 0 reacts"
              right={
                <Btn onClick={() => setSegs((p) => [...p, { id: `s_${Date.now()}`, label: `Seg ${p.length + 1}`, length_m: 1, outerDia_mm: 60, innerDia_mm: 0, G_GPa: 80, endTorque_kNm: 2 }])} icon={<Plus className="w-3.5 h-3.5" />}>
                  Add
                </Btn>
              }
            >
              <div className="space-y-1.5">
                <Field label="Shaft speed (RPM), converts torque to power">
                  <NumInput value={rpm} step={50} onChange={(v) => setRpm(Math.max(1, v))} suffix="rpm" />
                </Field>
                {segs.map((s) => (
                  <div key={s.id} className="rounded-lg p-1.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <input
                        value={s.label}
                        onChange={(e) => patchSeg(s.id, { label: e.target.value })}
                        className="text-[11px] font-bold bg-transparent outline-none border-b flex-1"
                        style={{ borderColor: 'var(--line-strong)' }}
                      />
                      <button onClick={() => setSegs((p) => p.filter((x) => x.id !== s.id))} style={{ color: 'var(--compression)' }} title="Delete segment">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <Field label="L (m)" hint="Segment length, twists add up along the shaft"><NumInput compact value={s.length_m} step={0.1} onChange={(v) => patchSeg(s.id, { length_m: Math.max(0.05, v) })} /></Field>
                      <Field label="D (mm)" hint="Outer diameter: τ ∝ 1/D³, twist ∝ 1/D⁴"><NumInput compact value={s.outerDia_mm} step={5} onChange={(v) => patchSeg(s.id, { outerDia_mm: Math.max(10, v) })} /></Field>
                      <Field label="d (mm)" hint="Bore. 0 keeps it solid"><NumInput compact value={s.innerDia_mm} step={5} onChange={(v) => patchSeg(s.id, { innerDia_mm: Math.max(0, Math.min(v, s.outerDia_mm - 2)) })} /></Field>
                      <Field label="G (GPa)" hint="Shear modulus ≈ 80 GPa for steel"><NumInput compact value={s.G_GPa} step={5} onChange={(v) => patchSeg(s.id, { G_GPa: Math.max(1, v) })} /></Field>
                      <div className="col-span-2">
                        <Field label="Torque at end (kN·m)"><NumInput compact value={s.endTorque_kNm} step={0.5} onChange={(v) => patchSeg(s.id, { endTorque_kNm: v })} /></Field>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Power relation" sub="P = 2πNT / 60">
              <div className="text-[11px] num space-y-0.5" style={{ color: 'var(--ink-2)' }}>
                <div>N = {fmt(rpm, 0)} rpm</div>
                <div>Σ applied torque = {fmt(segs.reduce((a, s) => a + s.endTorque_kNm, 0), 2)} kN·m</div>
                <div>Wall reaction T₀ = {fmt(-shaft.wallReactionTorque_kNm, 2)} kN·m (equal and opposite) ✓</div>
                <div>Peak power ≈ {fmt(shaft.powerAtRpm_kW, 1)} kW at the peak internal torque</div>
              </div>
            </Card>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <Stat label="Total length" value={fmt(shaft.totalLength_m, 2)} unit="m" mask={false} />
              <Stat label="τ max" value={fmt(shaft.maxShearStress_MPa, 1)} unit="MPa" tone="accent" />
              <Stat label="Total twist" value={fmt(shaft.maxTwistDeg, 2)} unit="°" tone="warn" />
              <Stat label="J (seg 1)" value={fmt(shaft.polarJFirst_cm4, 0)} unit="cm⁴" mask={false} />
            </div>

            <Card title="Shaft drawing, torque diagram and twist diagram" sub="All three share one x-axis, the twist slope is the torque divided by GJ">
              <svg viewBox="0 0 760 260" className="w-full block" style={{ maxHeight: 300 }}>
                {(() => {
                  const padL = 46;
                  const padR = 20;
                  const plotW = 760 - padL - padR;
                  const xScale = plotW / Math.max(0.001, shaft.totalLength_m);
                  const maxT = Math.max(1e-6, ...shaft.samples.map((s) => Math.abs(s.internalTorque_kNm)));
                  const maxPhi = Math.max(1e-6, shaft.maxTwistDeg);
                  const yShaft = 56;
                  const dScale = 22 / Math.max(...segs.map((s) => s.outerDia_mm));
                  return (
                    <g>
                      {/* axis line */}
                      <line x1={padL} y1={yShaft} x2={padL + plotW} y2={yShaft} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 4" />
                      {/* wall */}
                      <line x1={padL} y1={yShaft - 26} x2={padL} y2={yShaft + 26} stroke="var(--ink)" strokeWidth={3} />
                      {segs.map((s, i) => {
                        const x0 = segs.slice(0, i).reduce((a, b) => a + b.length_m, 0);
                        const px0 = padL + x0 * xScale;
                        const px1 = padL + (x0 + s.length_m) * xScale;
                        const R = (s.outerDia_mm / 2) * dScale;
                        const r = (s.innerDia_mm / 2) * dScale;
                        return (
                          <g key={s.id}>
                            <rect x={px0} y={yShaft - R} width={px1 - px0} height={2 * R} fill="var(--accent)" opacity={0.12} stroke="var(--accent)" strokeWidth={1.1} />
                            {r > 0 && <rect x={px0} y={yShaft - r} width={px1 - px0} height={2 * r} fill="var(--canvas)" stroke="var(--accent)" strokeWidth={0.8} strokeDasharray="3 2" />}
                            {Math.abs(s.endTorque_kNm) > 1e-6 && (
                              <g>
                                <path d={`M${px1 - 10} ${yShaft - R - 12} a 11 11 0 1 1 14 0`} fill="none" stroke="var(--warn)" strokeWidth={1.8} />
                                <text x={px1 + 8} y={yShaft - R - 10} fontSize={8.5} fill="var(--warn)" fontWeight={800}>
                                  {q(`${s.endTorque_kNm} kN·m`)}
                                </text>
                              </g>
                            )}
                            <text x={(px0 + px1) / 2} y={yShaft + R + 12} fontSize={8.5} textAnchor="middle" fill="var(--ink-3)" fontWeight={700}>
                              {s.label} · Ø{s.outerDia_mm}
                            </text>
                          </g>
                        );
                      })}

                      {/* torque diagram */}
                      <g>
                        <line x1={padL} y1={150} x2={padL + plotW} y2={150} stroke="var(--ink-3)" strokeWidth={1} />
                        <text x={padL - 4} y={122} fontSize={8.5} textAnchor="end" fill="var(--ink-3)" fontWeight={800}>T</text>
                        {shaft.segmentSummaries.map((sg, i) => {
                          const px0 = padL + sg.xStart * xScale;
                          const px1 = padL + sg.xEnd * xScale;
                          const h = (sg.T_kNm / maxT) * 34;
                          return (
                            <g key={i}>
                              <rect x={px0} y={150 - Math.max(0, h)} width={px1 - px0} height={Math.abs(h)} fill={sg.T_kNm >= 0 ? 'var(--accent)' : 'var(--compression)'} opacity={0.35} stroke={sg.T_kNm >= 0 ? 'var(--accent)' : 'var(--compression)'} strokeWidth={1} />
                              <text x={(px0 + px1) / 2} y={150 - h - 4} fontSize={8.5} textAnchor="middle" fontWeight={800} fill="var(--accent)">
                                {q(fmt(sg.T_kNm, 2))}
                              </text>
                            </g>
                          );
                        })}
                      </g>

                      {/* twist diagram */}
                      <g>
                        <line x1={padL} y1={228} x2={padL + plotW} y2={228} stroke="var(--ink-3)" strokeWidth={1} />
                        <text x={padL - 4} y={200} fontSize={8.5} textAnchor="end" fill="var(--ink-3)" fontWeight={800}>φ</text>
                        <path
                          d={shaft.samples
                            .map((s, i) => `${i ? 'L' : 'M'} ${padL + s.x_m * xScale} ${228 - (s.twistDeg / maxPhi) * 30}`)
                            .join(' ')}
                          fill="none"
                          stroke="var(--warn)"
                          strokeWidth={2.2}
                        />
                        <text x={padL + plotW} y={200} fontSize={8.5} textAnchor="end" fontWeight={800} fill="var(--warn)">
                          {q(fmt(maxPhi, 2))}°
                        </text>
                      </g>
                      <text x={padL + plotW / 2} y={254} fontSize={8.5} textAnchor="middle" fill="var(--ink-3)" fontWeight={700}>
                        x along shaft (m) →
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </Card>

            <Card title="Segment results" sub="τ = T·r/J, Δφ = T·L/(G·J)">
              <div className="scroll-x">
                <table className="w-full text-[10.5px] num border-collapse">
                  <thead>
                    <tr style={{ color: 'var(--ink-3)' }}>
                      {['Segment', 'x range', 'T (kN·m)', 'J (cm⁴)', 'τmax (MPa)', 'Δφ (°)'].map((h) => (
                        <th key={h} className="text-left px-1.5 py-1 border-b font-bold whitespace-nowrap" style={{ borderColor: 'var(--line)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shaft.segmentSummaries.map((s) => (
                      <tr key={s.id}>
                        <td className="px-1.5 py-1 font-bold">{s.label}</td>
                        <td className="px-1.5 py-1">{q(fmt(s.xStart, 2))} - {q(fmt(s.xEnd, 2))}</td>
                        <td className="px-1.5 py-1" style={{ color: s.T_kNm >= 0 ? 'var(--accent)' : 'var(--compression)' }}>{q(fmt(s.T_kNm, 2))}</td>
                        <td className="px-1.5 py-1">{q(fmt(s.J_mm4 / 1e4, 1))}</td>
                        <td className="px-1.5 py-1 font-bold">{q(fmt(s.tauMax_MPa, 2))}</td>
                        <td className="px-1.5 py-1">{q(fmt(s.deltaPhiDeg, 3))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <Hint>
                  A hollow shaft rivals a solid one at a fraction of the mass: J depends on D⁴ − d⁴, so the outer skin does nearly all the work.
                </Hint>
                <Hint tone="warn">
                  Twist accumulates from the wall: φ(x) = ∫T/(GJ)dx. Note the slope changes when the diameter steps, same torque, smaller J, bigger twist rate.
                </Hint>
              </div>
              <div className="mt-1.5">
                <Acc title="Hand proof (last segment)" sub="Check one row by hand">
                  <div className="text-[10.5px] num space-y-0.5" style={{ color: 'var(--ink-2)' }}>
                    {(() => {
                      const s = segs[segs.length - 1];
                      const ss = shaft.segmentSummaries[shaft.segmentSummaries.length - 1];
                      if (!s || !ss) return <div>Add a segment.</div>;
                      const r = s.outerDia_mm / 2000;
                      const ro = s.outerDia_mm / 2;
                      const ri = s.innerDia_mm / 2;
                      const J = (Math.PI * (ro ** 4 - ri ** 4)) / 32;
                      return (
                        <>
                          <div>J = π(D⁴ − d⁴)/32 = π({s.outerDia_mm}⁴ − {s.innerDia_mm}⁴)/32 = {fmt(J, 0)} mm⁴</div>
                          <div>τ = T·r/J = ({fmt(ss.T_kNm, 2)}×10⁶ N·mm)({fmt(ro, 1)} mm)/{fmt(J, 0)} = {fmt((ss.T_kNm * 1e6 * ro) / J, 2)} MPa</div>
                          <div>Δφ = T·L/(G·J) = {fmt(((ss.T_kNm * 1e6 * s.length_m * 1000) / (s.G_GPa * 1000 * J) * 180) / Math.PI, 3)}°</div>
                          <div style={{ color: 'var(--ink-3)' }}>(the engine integrates r = D/2, so τ above is the outer-fibre value)</div>
                        </>
                      );
                    })()}
                  </div>
                </Acc>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
