import React, { useMemo, useState } from 'react';
import { Compass, Crosshair, RotateCw, Sparkles, Target } from 'lucide-react';
import { analyzeMohrCircle } from '../engine/sectionMohrBucklingEngine';
import { useAnalysis } from '../ui/AnalysisContext';
import { Badge, Btn, Card, Field, Hint, NumInput, Segmented, Slider, Stat, fmt } from '../ui/primitives';

/* ------------------------------------------------------------------ */
/*  Rotating stress element                                           */
/* ------------------------------------------------------------------ */

const StressElement: React.FC<{
  sigmaX: number;
  sigmaY: number;
  tauXY: number;
  theta: number;
  sigmaXp: number;
  sigmaYp: number;
  tauXpYp: number;
  hideValues?: boolean;
}> = ({ sigmaX, sigmaY, tauXY, theta, sigmaXp, sigmaYp, tauXpYp, hideValues = false }) => {
  const S = 250;
  const cx = S / 2;
  const cy = S / 2;
  const half = 44;
  const maxS = Math.max(1, Math.abs(sigmaX), Math.abs(sigmaY), Math.abs(sigmaXp), Math.abs(sigmaYp));
  const arrow = (v: number) => 6 + (Math.abs(v) / maxS) * 46;
  const tension = 'var(--tension)';
  const comp = 'var(--compression)';
  const shearC = 'var(--warn)';

  const faces = [
    { name: "x' face", sigma: sigmaXp, tx: -1, ty: 0 },
    { name: "y' face", sigma: sigmaYp, tx: 1, ty: 0 },
  ];

  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full block" style={{ maxHeight: 250 }} aria-label="rotating stress element">
      <g transform={`rotate(${-theta} ${cx} ${cy})`}>
        <rect x={cx - half} y={cy - half} width={half * 2} height={half * 2} fill="var(--surface-2)" stroke="var(--ink-2)" strokeWidth={1.6} />
        {/* normal stress arrows on the unrotated faces (sigmaX / sigmaY) */}
        {[0, 1].map((side) => {
          const sx = side === 0 ? cx + half : cx - half;
          const dir = side === 0 ? 1 : -1;
          const v = side === 0 ? sigmaX : sigmaX;
          const len = arrow(v);
          const col = v >= 0 ? tension : comp;
          return (
            <g key={`x${side}`}>
              <line x1={sx} y1={cy - 10} x2={sx + dir * len} y2={cy - 10} stroke={col} strokeWidth={2} />
              <polygon points={`${sx + dir * (len + 2)},${cy - 10} ${sx + dir * (len - 6)},${cy - 14.5} ${sx + dir * (len - 6)},${cy - 5.5}`} fill={col} />
            </g>
          );
        })}
        {[0, 1].map((side) => {
          const sy = side === 0 ? cy - half : cy + half;
          const dir = side === 0 ? -1 : 1;
          const v = sigmaY;
          const len = arrow(v);
          const col = v >= 0 ? tension : comp;
          return (
            <g key={`y${side}`}>
              <line x1={cx - 10} y1={sy} x2={cx - 10} y2={sy + dir * len} stroke={col} strokeWidth={2} />
              <polygon points={`${cx - 10},${sy + dir * (len + 2)} ${cx - 14.5},${sy + dir * (len - 6)} ${cx - 5.5},${sy + dir * (len - 6)}`} fill={col} />
            </g>
          );
        })}
        {/* shear couple */}
        {Math.abs(tauXY) > 1e-6 && (
          <g stroke={shearC} strokeWidth={1.8} fill="none">
            <path d={`M${cx - half - 14} ${cy + half} v-12`} />
            <path d={`M${cx + half + 14} ${cy - half} v12`} />
            <path d={`M${cx + half} ${cy - half - 14} h-12`} />
            <path d={`M${cx - half} ${cy + half + 14} h12`} />
          </g>
        )}
      </g>
      <circle cx={cx} cy={cy} r={3} fill="var(--ink-2)" />
      <text x={cx} y={S - 26} fontSize={9} textAnchor="middle" fill="var(--ink-3)" fontWeight={700}>
        element rotated {fmt(theta, 0)}° CCW
      </text>
      <text x={cx} y={S - 2} fontSize={9} textAnchor="middle" fill="var(--ink-3)" fontWeight={700}>
        blue = tension · red = compression
      </text>
      <g opacity={0}>
        {faces.map((f) => (
          <text key={f.name}>{f.sigma}</text>
        ))}
      </g>
      <text x={cx} y={S - 12} fontSize={9} textAnchor="middle" fill="var(--ink-3)">
        σx' = {hideValues ? '•••' : fmt(sigmaXp, 1)} · τx'y' = {hideValues ? '•••' : fmt(tauXpYp, 1)} MPa
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */

export const MohrModule: React.FC = () => {
  const { toMohr, setToMohr, goto, toast, lang, hideAnswers } = useAnalysis();
  const q = (v: React.ReactNode) => (hideAnswers ? '•••' : v);
  const [sigmaX, setSigmaX] = useState(toMohr?.sigmaX ?? 80);
  const [sigmaY, setSigmaY] = useState(20);
  const [tauXY, setTauXY] = useState(toMohr?.tauXY ?? 40);
  const [theta, setTheta] = useState(0);
  const [mtab, setMtab] = useState<'model' | 'result'>('result');

  const m = useMemo(() => analyzeMohrCircle({ sigmaX, sigmaY, tauXY, thetaDeg: theta }), [sigmaX, sigmaY, tauXY, theta]);

  const W = 460;
  const H = 382;
  const pad = 34;
  const allX = [m.sigma2, m.sigma1, 0, sigmaX, sigmaY];
  const minX = Math.min(...allX) - 0.18 * m.radius - 6;
  const maxX = Math.max(...allX) + 0.18 * m.radius + 6;
  const rangeX = Math.max(10, maxX - minX);
  const rangeY = Math.max(1e-6, 2 * Math.max(m.radius, Math.abs(tauXY)) * 1.25);
  const scale = Math.min((W - 2 * pad) / rangeX, (H - 2 * pad - 18) / rangeY);
  const cx0 = (W - rangeX * scale) / 2 - minX * scale;
  const cy0 = H / 2;
  const X = (s: number) => cx0 + s * scale;
  const Y = (t: number) => cy0 - t * scale; // τ plotted upward-positive on screen

  const pointA = { s: sigmaX, t: tauXY };
  const pointB = { s: sigmaY, t: -tauXY };
  const rotated = { s: m.sigmaXPrime, t: m.tauXPrimeYPrime };

  const snapTo = (deg: number) => {
    setTheta(deg);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(280px,330px)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-3">
      <div className="md:hidden -mb-1 col-span-full">
        <Segmented
          full
          value={mtab}
          onChange={setMtab}
          options={[
            { value: 'model', label: '① Stress state' },
            { value: 'result', label: '② Circle & checks' },
          ]}
        />
      </div>
      <div className={`space-y-2.5 ${mtab === 'model' ? 'block' : 'hidden md:block'}`}>
        <Card title="Stress state on the element" sub="Hand the values in or type your own" right={toMohr ? <Badge tone="green">from fibre lab</Badge> : undefined}>
          <div className="space-y-2">
            {toMohr && (
              <div className="rounded-lg p-2 text-[10.5px]" style={{ background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', color: 'var(--ink-2)' }}>
                {toMohr.label}
                <div className="mt-1 flex gap-1">
                  <Btn size="sm" onClick={() => { setSigmaX(toMohr.sigmaX); setTauXY(toMohr.tauXY); toast('Fibre stress loaded into Mohr circle.', 'ok'); }}>
                    Reload
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setToMohr(null)}>Dismiss</Btn>
                </div>
              </div>
            )}
            <Slider label="σx (tension +)" value={sigmaX} min={-150} max={250} step={1} onChange={setSigmaX} suffix="MPa" />
            <Slider label="σy" value={sigmaY} min={-150} max={250} step={1} onChange={setSigmaY} suffix="MPa" />
            <Slider label="τxy (CCW on +x face +)" value={tauXY} min={-120} max={120} step={1} onChange={setTauXY} suffix="MPa" />
            <div className="grid grid-cols-3 gap-1.5">
              <Field label="σx" hint="Normal stress on the x face"><NumInput value={sigmaX} step={5} onChange={setSigmaX} /></Field>
              <Field label="σy" hint="Normal stress on the y face"><NumInput value={sigmaY} step={5} onChange={setSigmaY} /></Field>
              <Field label="τxy" hint="Shear on the x face, CCW positive"><NumInput value={tauXY} step={5} onChange={setTauXY} /></Field>
            </div>
            <Slider label="Plane rotation θ" value={theta} min={-90} max={90} step={1} onChange={setTheta} suffix="°" />
            <div className="flex flex-wrap gap-1.5">
              <Btn onClick={() => snapTo(m.thetaP1Deg)} icon={<Target className="w-3.5 h-3.5" />}>
                Snap to σ₁ plane ({q(`${fmt(m.thetaP1Deg, 1)}°`)})
              </Btn>
              <Btn onClick={() => snapTo(m.thetaSDeg)} icon={<Crosshair className="w-3.5 h-3.5" />}>
                Snap to τmax ({q(`${fmt(m.thetaSDeg, 1)}°`)})
              </Btn>
              <Btn variant="ghost" onClick={() => snapTo(0)} icon={<RotateCw className="w-3.5 h-3.5" />}>Reset</Btn>
            </div>
          </div>
        </Card>

        <Card title="Known-answer presets" sub="Every one has a closed-form result you can check by hand">
          <div className="space-y-1">
            {[
              { label: 'Uniaxial tension σx = 100', sx: 100, sy: 0, t: 0, expect: 'σ₁ = 100, σ₂ = 0, τmax = 50' },
              { label: 'Pure shear τxy = 60', sx: 0, sy: 0, t: 60, expect: 'σ₁ = 60, σ₂ = −60, τmax = 60' },
              { label: 'Biaxial σx = 80, σy = 40', sx: 80, sy: 40, t: 0, expect: 'σ₁ = 80, σ₂ = 40, radius 20' },
              { label: 'Hydrostatic σx = σy = -50', sx: -50, sy: -50, t: 0, expect: 'radius 0, no shear' },
              { label: 'Beam fibre: σx = 120, τ = 35', sx: 120, sy: 0, t: -35, expect: 'σ₁ ≈ 129.5, σ₂ ≈ −9.5' },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => { setSigmaX(p.sx); setSigmaY(p.sy); setTauXY(p.t); setTheta(0); }}
                className="w-full text-left rounded-lg px-2 py-1.5"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
              >
                <span className="block text-[11px] font-bold">{p.label}</span>
                <span className="block text-[9.5px] num" style={{ color: 'var(--ink-3)' }}>{hideAnswers ? 'check by hand' : p.expect}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Continue">
          <div className="space-y-1.5">
            <Btn size="md" variant="primary" icon={<Compass className="w-4 h-4" />} onClick={() => goto('section')}>
              Back to section fibres
            </Btn>
            <Btn size="md" onClick={() => goto('guide')}>Explain this in class flow</Btn>
          </div>
        </Card>
      </div>

      <div className={`space-y-2.5 ${mtab === 'result' ? 'block' : 'hidden md:block'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <Stat label="σ₁ (major)" value={fmt(m.sigma1, 1)} unit="MPa" tone="ok" />
          <Stat label="σ₂ (minor)" value={fmt(m.sigma2, 1)} unit="MPa" tone="bad" />
          <Stat label="τ in-plane max" value={fmt(m.tauMaxInPlane, 1)} unit="MPa" tone="accent" />
          <Stat label="τ abs max (3D)" value={fmt(m.tauAbsMax3D, 1)} unit="MPa" tone="warn" />
        </div>

        <Card
          title="Element ↔ Mohr's circle, locked together"
          sub="Rotate the element by θ; the diameter on the circle turns by 2θ. Same state, two pictures."
          right={<Badge tone="blue">θ = {fmt(theta, 0)}° / 2θ = {fmt(2 * theta, 0)}°</Badge>}
        >
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-3 items-center">
            <StressElement
              sigmaX={sigmaX}
              sigmaY={sigmaY}
              tauXY={tauXY}
              theta={theta}
              sigmaXp={m.sigmaXPrime}
              sigmaYp={m.sigmaYPrime}
              tauXpYp={m.tauXPrimeYPrime}
              hideValues={hideAnswers}
            />
            <div>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ maxHeight: 330 }}>
                {/* axes */}
                <line x1={pad} y1={cy0} x2={W - 6} y2={cy0} stroke="var(--ink-3)" strokeWidth={1.1} />
                <line x1={X(0)} y1={8} x2={X(0)} y2={H - 18} stroke="var(--ink-3)" strokeWidth={1.1} />
                <text x={W - 8} y={cy0 - 5} fontSize={9} textAnchor="end" fill="var(--ink-3)" fontWeight={700}>σ (MPa)</text>
                <text x={X(0) + 4} y={14} fontSize={9} fill="var(--ink-3)" fontWeight={700}>τ (MPa)</text>

                {/* circle */}
                <circle cx={X(m.center)} cy={cy0} r={m.radius * scale} fill="var(--accent)" fillOpacity={0.07} stroke="var(--accent)" strokeWidth={1.8} />
                <line x1={X(m.center)} y1={cy0} x2={X(m.center)} y2={Y(m.radius)} stroke="var(--line-strong)" strokeWidth={1} strokeDasharray="3 3" />

                {/* principal points */}
                <circle cx={X(m.sigma1)} cy={Y(0)} r={4} fill="var(--ok)" />
                <circle cx={X(m.sigma2)} cy={Y(0)} r={4} fill="var(--compression)" />
                <text x={X(m.sigma1) - 4} y={cy0 + 30} fontSize={10.5} textAnchor="middle" fill="var(--ok)" fontWeight={800} paintOrder="stroke" stroke="var(--canvas)" strokeWidth={3}>
                  σ₁ {q(fmt(m.sigma1, 0))}
                </text>
                <text x={X(m.sigma2) + 4} y={cy0 + 30} fontSize={10.5} textAnchor="middle" fill="var(--compression)" fontWeight={800} paintOrder="stroke" stroke="var(--canvas)" strokeWidth={3}>
                  σ₂ {q(fmt(m.sigma2, 0))}
                </text>

                {/* max shear points */}
                <circle cx={X(m.center)} cy={Y(m.radius)} r={4} fill="var(--warn)" />
                <circle cx={X(m.center)} cy={Y(-m.radius)} r={4} fill="var(--warn)" />
                <text x={X(m.center) + 6} y={Y(m.radius) - 5} fontSize={9.5} fill="var(--warn)" fontWeight={800}>τmax</text>

                {/* diameter A-B */}
                <line x1={X(pointA.s)} y1={Y(pointA.t)} x2={X(pointB.s)} y2={Y(pointB.t)} stroke="var(--compression)" strokeWidth={1.6} />
                <circle cx={X(pointA.s)} cy={Y(pointA.t)} r={4.6} fill="var(--compression)" stroke="var(--canvas)" strokeWidth={1.3} />
                <circle cx={X(pointB.s)} cy={Y(pointB.t)} r={4.6} fill="var(--hogging)" stroke="var(--canvas)" strokeWidth={1.3} />
                <text x={X(pointA.s) + 7} y={Y(pointA.t) - 6} fontSize={9.5} fill="var(--compression)" fontWeight={800}>A (σx, τxy)</text>
                <text x={X(pointB.s) + 7} y={Y(pointB.t) + 12} fontSize={9.5} fill="var(--hogging)" fontWeight={800}>B (σy, −τxy)</text>

                {/* rotated points */}
                <line x1={X(m.center)} y1={cy0} x2={X(rotated.s)} y2={Y(rotated.t)} stroke="var(--warn)" strokeWidth={1.8} />
                <circle cx={X(rotated.s)} cy={Y(rotated.t)} r={5} fill="var(--warn)" stroke="var(--canvas)" strokeWidth={1.4} />
                {Math.abs(theta) > 2 && (
                  <text
                    x={X(rotated.s) + 9}
                    y={Y(rotated.t) + 14}
                    fontSize={9.5}
                    textAnchor="start"
                    fill="var(--warn)"
                    fontWeight={800}
                    paintOrder="stroke"
                    stroke="var(--canvas)"
                    strokeWidth={3}
                  >
                    rotated face
                  </text>
                )}

                <text x={X(m.center)} y={cy0 - Math.min(74, m.radius * scale * 0.55)} fontSize={10} textAnchor="middle" fill="var(--ink-2)" fontWeight={700} paintOrder="stroke" stroke="var(--canvas)" strokeWidth={3}>
                  C = {q(fmt(m.center, 1))} · R = {q(fmt(m.radius, 1))} MPa
                </text>
                <g>
                  <circle cx={pad + 5} cy={H - 30} r={3.2} fill="var(--compression)" />
                  <text x={pad + 12} y={H - 27} fontSize={9} fill="var(--ink-3)" fontWeight={700}>x-face</text>
                  <circle cx={pad + 55} cy={H - 30} r={3.2} fill="var(--ok)" />
                  <text x={pad + 62} y={H - 27} fontSize={9} fill="var(--ink-3)" fontWeight={700}>y-face (2θ)</text>
                  <line x1={pad + 126} y1={H - 30} x2={pad + 140} y2={H - 30} stroke="var(--warn)" strokeWidth={1.6} strokeDasharray="4 3" />
                  <text x={pad + 145} y={H - 27} fontSize={9} fill="var(--ink-3)" fontWeight={700}>radius = τmax</text>
                </g>
                <text x={2} y={H - 9} fontSize={9} fill="var(--ink-3)" fontWeight={600}>
                  vertical axis = engineering shear τ (counter-clockwise on the +x face is positive)
                </text>
              </svg>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
          <Card title="All the equations, filled with your numbers">
            <div className="space-y-1 text-[10.5px] num" style={{ color: 'var(--ink-2)' }}>
              {[
                `C = (σx + σy)/2 = (${fmt(sigmaX, 1)} + ${fmt(sigmaY, 1)})/2 = ${fmt(m.center, 2)} MPa`,
                `R = √[((σx−σy)/2)² + τxy²] = ${fmt(m.radius, 2)} MPa`,
                `σ₁ = C + R = ${fmt(m.sigma1, 2)} MPa     σ₂ = C − R = ${fmt(m.sigma2, 2)} MPa`,
                `τmax(in-plane) = R = ${fmt(m.tauMaxInPlane, 2)} MPa`,
                `τabs(max) = max(R, |σ₁|/2, |σ₂|/2) = ${fmt(m.tauAbsMax3D, 2)} MPa`,
                `θp₁ = ½·atan2(τxy, (σx−σy)/2) = ${fmt(m.thetaP1Deg, 2)}°   θp₂ = ${fmt(m.thetaP2Deg, 2)}°`,
                `σx' = C + R·cos2(θp−θ) → at θ = ${fmt(theta, 0)}°: ${fmt(m.sigmaXPrime, 2)} MPa`,
                `τx'y' = ${fmt(m.tauXPrimeYPrime, 2)} MPa on that face`,
              ].map((f, i) => (
                <div key={i} className="rounded-md px-1.5 py-0.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>{q(f)}</div>
              ))}
            </div>
          </Card>

          <Card title="Fail-safe checks & deeper insight">
            <ul className="space-y-1 text-[11px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              <li className="flex gap-1.5"><Crosshair className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} /> Invariant: σ₁ + σ₂ = σx + σy = {q(fmt(m.sigma1 + m.sigma2, 2))} ≈ {q(fmt(sigmaX + sigmaY, 2))} MPa ✓</li>
              <li className="flex gap-1.5"><Crosshair className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} /> At θ = θp₁ the shear on the rotated faces is {q(fmt(Math.abs(analyzeMohrCircle({ sigmaX, sigmaY, tauXY, thetaDeg: m.thetaP1Deg }).tauXPrimeYPrime), 3))} MPa ≈ 0 ✓</li>
              <li className="flex gap-1.5"><Sparkles className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} /> {lang === 'hinglish' ? 'Material kabhi normal stress se nahi, shear se ductile tootta hai, isliye Tresca/von Mises theory use hoti hai.' : 'Ductile metals yield in shear before tension, which is why Tresca / von Mises are used for design.'}</li>
              <li className="flex gap-1.5"><Sparkles className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} /> {lang === 'hinglish' ? 'Circle par θ ka double (2θ) dikhta hai, element 45° ghumta hai to circle par 90° movement hoti hai.' : 'The circle uses 2θ: rotating the element by 45° moves you 90° around the circle.'}</li>
            </ul>
            <div className="mt-2">
              <Hint>
                Net shear area under the whole circle is zero, pure rotation moves stress between normal and shear components, it never creates or destroys the state.
              </Hint>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
