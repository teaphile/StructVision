import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ghost, Play, Pause, RotateCcw, SkipBack, SkipForward, Target, Truck } from 'lucide-react';
import { computeILD, evaluateMovingVehicle, ILDTargetType, MovingVehicleConfig, VehicleType } from '../engine/ildEngine';
import { ILD_BRIDGE_PRESETS } from '../engine/presets';
import { useAnalysis } from '../ui/AnalysisContext';
import { BeamEditor } from '../ui/BeamEditor';
import { Plot } from '../ui/DiagramPlot';
import { Acc, Badge, Btn, Card, Field, Hint, NumInput, Segmented, Slider, Stat, Toggle, Wide, fmt, clamp } from '../ui/primitives';

const VW = 820;
const VH = 318;

/* ------------------------------------------------------------------ */
/*  Bridge with vehicle + wheel projection rays                        */
/* ------------------------------------------------------------------ */

const BridgeView: React.FC<{
  model: ReturnType<typeof useAnalysis>['beam'];
  ild: ReturnType<typeof computeILD>;
  vehicle: MovingVehicleConfig;
  evalRes: ReturnType<typeof evaluateMovingVehicle>;
  xSec: number;
  mullerBreslau: boolean;
}> = ({ model, ild, vehicle, evalRes, xSec, mullerBreslau }) => {
  const L = model.length;
  const padL = 50;
  const padR = 50;
  const plotW = VW - padL - padR;
  const X = (x: number) => padL + (clamp(x, 0, L) / L) * plotW;
  const yDeck = 168;
  const maxOrd = Math.max(...ild.points.map((p) => Math.abs(p.ordinate)), 1e-6);
  const ampUp = 42;
  const ampDown = 40;
  const Y = (ord: number) => yDeck + 34 - (ord / maxOrd) * 24;

  const ildPath = ild.points.map((p, i) => `${i ? 'L' : 'M'} ${X(p.x).toFixed(1)} ${Y(p.ordinate).toFixed(1)}`).join(' ');
  const wheels = evalRes.wheelContributions;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full block select-none" style={{ touchAction: 'manipulation' }}>
      {/* pier ground */}
      <line x1={padL - 24} y1={yDeck + 60} x2={VW - padR + 24} y2={yDeck + 60} stroke="var(--line-strong)" strokeWidth={1} strokeDasharray="4 5" />

      {/* baseline */}
      <line x1={X(0)} y1={yDeck + 34} x2={X(L)} y2={yDeck + 34} stroke="var(--accent)" strokeWidth={1} opacity={0.55} />
      {/* ILD curve, the same geometry the released deck must take */}
      <path d={`${ildPath} L ${X(L)} ${yDeck + 34} L ${X(0)} ${yDeck + 34} Z`} fill="var(--accent)" opacity={0.13} />

      {!mullerBreslau && <path d={ildPath} fill="none" stroke="var(--accent)" strokeWidth={2.2} />}

      {/* deck, bends into the released path when Müller-Breslau is on */}
      {mullerBreslau ? (
        <path
          d={ild.points
            .map((p, i) => `${i ? 'L' : 'M'} ${X(p.x).toFixed(1)} ${Y(p.ordinate).toFixed(1)}`)
            .join(' ')}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.88}
        />
      ) : (
        <g>
          <rect x={X(0)} y={yDeck - 6} width={X(L) - X(0)} height={12} rx={2} fill="var(--ink)" opacity={0.92} />
          <rect x={X(0)} y={yDeck - 6} width={X(L) - X(0)} height={2.6} rx={1.3} fill="var(--surface)" opacity={0.25} />
        </g>
      )}
      {!mullerBreslau && (
        <text x={X(L / 2)} y={yDeck + 4} fontSize={9} textAnchor="middle" fill="var(--surface)" opacity={0.9} fontWeight={700}>
          BRIDGE DECK · L = {L} m
        </text>
      )}
      {mullerBreslau && (
        <path d={ildPath} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeDasharray="5 5" opacity={0.95} />
      )}

      {/* supports */}
      {model.supports.map((s) => {
        const px = X(s.x);
        const ordAt = ild.points.length
          ? ild.points[clamp(Math.round((s.x / Math.max(L, 1e-9)) * (ild.points.length - 1)), 0, ild.points.length - 1)].ordinate
          : 0;
        const ys = mullerBreslau ? Y(ordAt) : yDeck;
        return (
          <g key={s.id}>
            <polygon points={`${px},${ys + 6} ${px - 9},${ys + 18} ${px + 9},${ys + 18}`} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={1.8} />
            {s.type === 'fixed' ? (
              <line x1={px - 13} y1={ys + 19} x2={px + 13} y2={ys + 19} stroke="var(--ink)" strokeWidth={2} />
            ) : (
              <>
                <circle cx={px - 4.5} cy={ys + 22} r={3.4} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={1.4} />
                <circle cx={px + 4.5} cy={ys + 22} r={3.4} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={1.4} />
              </>
            )}
            <text x={px} y={ys + 40} fontSize={10} textAnchor="middle" fontWeight={800} fill="var(--ink-2)">
              {s.label}
            </text>
          </g>
        );
      })}

      {/* target section marker */}
      <g>
        <line x1={X(xSec)} y1={27} x2={X(xSec)} y2={yDeck + 56} stroke="var(--hogging)" strokeWidth={1.6} strokeDasharray="5 4" />
        <rect x={X(xSec) - 37} y={8} width={74} height={20} rx={5} fill="var(--hogging)" stroke="var(--surface)" strokeWidth={1.5} />
        <text x={X(xSec)} y={22} fontSize={10.5} fontWeight={800} textAnchor="middle" fill="#fff" style={{ letterSpacing: 0.2 }}>
          C · {fmt(xSec, 2)} m
        </text>
      </g>

      {/* vehicle */}
      {wheels.map((w, i) => {
        const px = X(w.x);
        const wheelY = yDeck - 22;
        return (
          <g key={i} opacity={w.onBridge ? 1 : 0.32}>
            <line x1={px} y1={wheelY + 6} x2={px} y2={yDeck - 1} stroke="var(--compression)" strokeWidth={2} />
            {/* projection ray to ILD */}
            {w.onBridge && (
              <>
                <line x1={px} y1={yDeck + 4} x2={px} y2={Y(w.ordinate)} stroke="var(--warn)" strokeWidth={1.1} strokeDasharray="3 3" opacity={0.9} />
                <circle cx={px} cy={Y(w.ordinate)} r={3.4} fill="var(--warn)" stroke="var(--canvas)" strokeWidth={1.2} />
              </>
            )}
            <circle cx={px} cy={wheelY} r={6.5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2.2} />
            <circle cx={px} cy={wheelY} r={1.8} fill="var(--ink)" />
            <text x={px} y={wheelY - 12} fontSize={9} textAnchor="middle" fontWeight={800} fill="var(--compression)">
              {w.load_kN} kN
            </text>
          </g>
        );
      })}
      {vehicle.type === 'udl_patch' && (() => {
        const x2 = clamp(evalRes.xLead, 0, L);
        const x1 = clamp(evalRes.xLead - evalRes.totalLength, 0, L);
        return (
          <g>
            <rect x={X(x1)} y={yDeck - 34} width={Math.max(1, X(x2) - X(x1))} height={22} fill="var(--warn)" opacity={0.16} stroke="var(--warn)" strokeWidth={1.2} />
            {Array.from({ length: 8 }).map((_, i) => {
              const px = X(x1) + ((X(x2) - X(x1)) * (i + 0.5)) / 8;
              return <line key={i} x1={px} y1={yDeck - 34} x2={px} y2={yDeck - 8} stroke="var(--warn)" strokeWidth={1.2} />;
            })}
            <text x={(X(x1) + X(x2)) / 2} y={yDeck - 39} fontSize={9} textAnchor="middle" fill="var(--warn)" fontWeight={800}>
              {vehicle.udl_kNm} kN/m × {vehicle.udlLength_m} m
            </text>
          </g>
        );
      })()}

      {/* one caption line, always below the deck so it can never collide with the badges */}
      <text x={padL - 14} y={VH - 10} fontSize={9.5} fontWeight={700} fill={mullerBreslau ? 'var(--warn)' : 'var(--ink-3)'}>
        {mullerBreslau
          ? `Müller-Breslau: release the restraint at C, the shape the deck springs into IS the influence line (peak ${fmt(ild.maxPos.val, 2)} ${ild.unit} at x = ${fmt(ild.maxPos.x, 2)} m)`
          : 'Influence line ordinate y(x) drawn under the deck'}
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */

export const ILDModule: React.FC = () => {
  const { beam, setBeam, lang, setIldResult, setToSection, goto, toast, hideAnswers } = useAnalysis();
  const q = (v: React.ReactNode) => (hideAnswers ? '•••' : v);
  const [target, setTarget] = useState<ILDTargetType>('moment');
  const [supId, setSupId] = useState<string>(beam.supports[0]?.id ?? '');
  const [xSec, setXSec] = useState(Math.round(beam.length * 0.4 * 100) / 100);
  const [vehType, setVehType] = useState<VehicleType>('two_axle');
  const [veh, setVeh] = useState<MovingVehicleConfig>({
    type: 'two_axle',
    singleLoad_kN: 100,
    axle1_kN: 60,
    axle2_kN: 120,
    wheelbase_m: 3,
    udl_kNm: 15,
    udlLength_m: 5,
    reversed: false,
  });
  const [xLead, setXLead] = useState(beam.length * 0.6);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [muller, setMuller] = useState(false);
  const [mobileTab, setMobileTab] = useState<'model' | 'result'>('result');
  const [compare, setCompare] = useState<'envelope' | 'instant'>('instant');
  const [overlayEnv, setOverlayEnv] = useState(false);
  const [editBeam, setEditBeam] = useState(false);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  const clampedSec = clamp(xSec, 0.02 * beam.length, 0.98 * beam.length);
  const activeSup = beam.supports.find((s) => s.id === supId)?.id ?? beam.supports[0]?.id;

  const ild = useMemo(
    () =>
      computeILD(beam, {
        type: target,
        supportId: activeSup,
        xSection: clampedSec,
      }),
    [beam, target, activeSup, clampedSec]
  );

  useEffect(() => {
    setIldResult(ild);
  }, [ild, setIldResult]);

  const evalRes = useMemo(
    () => evaluateMovingVehicle(beam, ild, veh, xLead, compare === 'instant'),
    [beam, ild, veh, xLead, compare]
  );

  const maxLead = beam.length + evalRes.totalLength;

  // animation
  useEffect(() => {
    if (!playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    const step = (t: number) => {
      const dt = last.current ? (t - last.current) / 1000 : 0.016;
      last.current = t;
      setXLead((x) => {
        const nx = x + dt * speed * Math.max(1.5, beam.length / 6);
        return nx > maxLead ? 0 : nx;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = 0;
    };
  }, [playing, speed, maxLead, beam.length]);

  // critical positions
  const snapMax = () => {
    const c = evalRes.criticalMaxPos.value >= Math.abs(evalRes.criticalMaxNeg.value) ? evalRes.criticalMaxPos : evalRes.criticalMaxNeg;
    setXLead(c.xLead);
    setPlaying(false);
    toast(`Vehicle snapped to the critical position x = ${fmt(c.xLead, 2)} m → effect ${fmt(c.value, 2)} ${ild.unit}.`, 'ok');
  };

  // honest unit display: an ILD for moment is already kN·m per kN, so the ordinate is in metres
  const ildUnit = target === 'moment' ? 'm' : target === 'deflection' ? 'mm/kN' : 'kN/kN';
  const effectUnit = target === 'moment' ? 'kN·m' : target === 'deflection' ? 'mm' : 'kN';
  const areaUnit = target === 'deflection' ? 'm·mm/kN' : target === 'moment' ? 'm²' : 'm';

  const targetLabel: Record<ILDTargetType, string> = {
    reaction: 'vertical reaction at a support',
    moment_reaction: 'fixed-end moment reaction',
    shear: 'shear force V at section C',
    moment: 'bending moment M at section C',
    deflection: 'deflection δ at section C',
  };

  const ordinates = ild.points.map((p) => ({ x: p.x, y: p.ordinate }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(280px,330px)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,375px)_minmax(0,1fr)] gap-3">
      <div className="md:hidden -mb-1">
        <Segmented
          full
          value={mobileTab}
          onChange={setMobileTab}
          options={[
            { value: 'model', label: '① Target & vehicle' },
            { value: 'result', label: '② Drive the truck' },
          ]}
        />
      </div>

      {/* LEFT */}
      <div className={`space-y-2.5 ${mobileTab === 'model' ? 'block' : 'hidden md:block'}`}>
        <Card
          title="Target: what are we tracking?"
          sub="Pick the restaurant seat, the camera stays there while the load walks past"
        >
          <div className="space-y-2">
            <Segmented
              full
              size="sm"
              value={target}
              onChange={(v) => setTarget(v)}
              options={[
                { value: 'reaction', label: 'Reaction' },
                { value: 'shear', label: 'Shear V' },
                { value: 'moment', label: 'Moment M' },
                { value: 'deflection', label: 'Deflection' },
              ]}
            />
            {(target === 'reaction' || target === 'moment_reaction') && (
              <Field label="Support">
                <select
                  value={activeSup}
                  onChange={(e) => setSupId(e.target.value)}
                  className="w-full rounded-lg px-2 py-1.5 text-[12px] font-semibold"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)' }}
                >
                  {beam.supports.map((s) => (
                    <option key={s.id} value={s.id}>
                      Support {s.label} @ x = {s.x} m ({s.type})
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {(target === 'shear' || target === 'moment' || target === 'deflection') && (
              <Slider label="Section C position" value={clampedSec} min={0.02 * beam.length} max={0.98 * beam.length} step={0.05} onChange={setXSec} suffix="m" />
            )}
            <div className="rounded-lg p-2 text-[10.5px] leading-relaxed" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
              <strong style={{ color: 'var(--accent)' }}>{ild.targetTitleEn}</strong>
              <br />
              {lang === 'hinglish' ? ild.targetTitleHi : ''}
            </div>
          </div>
        </Card>

        <Card
          title="Vehicle"
          sub={`${vehType === 'udl_patch' ? 'Distributed patch' : `${evalRes.wheelContributions.length} axle(s)`} · total length ${fmt(evalRes.totalLength, 1)} m`}
          right={
            <Segmented
              size="sm"
              value={vehType}
              onChange={(v) => {
                setVehType(v);
                setVeh((p) => ({ ...p, type: v }));
                setPlaying(false);
                setXLead(beam.length * 0.6);
              }}
              options={[
                { value: 'single', label: '1' },
                { value: 'two_axle', label: '2' },
                { value: 'irc_train', label: 'Train' },
                { value: 'udl_patch', label: 'UDL' },
              ]}
            />
          }
        >
          <div className="space-y-2">
            {vehType === 'single' && (
              <Field label="Wheel load (kN)" hint="One point load; the ordinate it lands on is the answer">
                <NumInput value={veh.singleLoad_kN} step={10} onChange={(v) => setVeh({ ...veh, singleLoad_kN: Math.max(1, v) })} suffix="kN" />
              </Field>
            )}
            {vehType === 'two_axle' && (
              <div className="grid grid-cols-2 gap-1.5">
                <Field label="Front axle W₁" hint="Leading axle, its position drives the worst-case search">
                  <NumInput value={veh.axle1_kN} step={10} onChange={(v) => setVeh({ ...veh, axle1_kN: Math.max(1, v) })} suffix="kN" />
                </Field>
                <Field label="Rear axle W₂" hint="Trailing axle; keep it lighter and R sits between the two">
                  <NumInput value={veh.axle2_kN} step={10} onChange={(v) => setVeh({ ...veh, axle2_kN: Math.max(1, v) })} suffix="kN" />
                </Field>
                <Field label="Wheelbase" hint="Axle spacing. Short spacings bunch both loads near the peak">
                  <NumInput value={veh.wheelbase_m} step={0.5} onChange={(v) => setVeh({ ...veh, wheelbase_m: Math.max(0.5, v) })} suffix="m" />
                </Field>
                <div className="flex items-end">
                  <Btn
                    onClick={() => setVeh({ ...veh, reversed: !veh.reversed })}
                    className="w-full"
                    title="Swap which axle leads"
                  >
                    {veh.reversed ? 'W₂ leads →' : 'W₁ leads →'}
                  </Btn>
                </div>
              </div>
            )}
            {vehType === 'irc_train' && (
              <Hint>
                IRC Class-A style 4-axle train: {evalRes.wheelContributions.map((w) => w.load_kN).join(' / ')} kN at 3 m spacing. The heaviest axle is in the
                middle, ask the class why that produces a bigger moment than a bigger single load.
              </Hint>
            )}
            {vehType === 'udl_patch' && (
              <div className="grid grid-cols-2 gap-1.5">
                <Field label="Intensity w" hint="Per-metre load. The area under the ILD is what it multiplies">
                  <NumInput value={veh.udl_kNm} step={1} onChange={(v) => setVeh({ ...veh, udl_kNm: Math.max(0.5, v) })} suffix="kN/m" />
                </Field>
                <Field label="Patch length" hint="How much of the span the patch covers; longer is not always worse">
                  <NumInput value={veh.udlLength_m} step={0.5} onChange={(v) => setVeh({ ...veh, udlLength_m: Math.max(0.5, v) })} suffix="m" />
                </Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5 text-[10.5px] num" style={{ color: 'var(--ink-3)' }}>
              <span>Total load = {fmt(vehType === 'udl_patch' ? veh.udl_kNm * veh.udlLength_m : evalRes.wheelContributions.reduce((s, w) => s + w.load_kN, 0), 1)} kN</span>
              <span>Critical +ve @ {fmt(evalRes.criticalMaxPos.xLead, 2)} m</span>
            </div>
            <div className="flex gap-1.5">
              <Btn onClick={snapMax} icon={<Target className="w-3.5 h-3.5" />} className="flex-1">
                Snap to worst case
              </Btn>
              <Btn
                onClick={() => {
                  const c = evalRes.criticalMaxNeg;
                  setXLead(c.xLead);
                  setPlaying(false);
                  toast(`Snapped to most negative effect at x = ${fmt(c.xLead, 2)} m.`, 'ok');
                }}
              >
                Min
              </Btn>
            </div>
            <Toggle
              checked={muller}
              onChange={setMuller}
              label="Müller-Breslau intuition overlay"
              hint="Releases the restraint at the target so the deflected path drawn is the ILD itself"
            />
          </div>
        </Card>

        <Acc title="Bridge model (same beam as module 1)" sub="Edit here or send it over from the beam lab" defaultOpen={editBeam}>
          <div className="space-y-2">
            <Btn onClick={() => setEditBeam((v) => !v)}>{editBeam ? 'Hide editor' : 'Show editor'}</Btn>
            {editBeam && <BeamEditor model={beam} onChange={setBeam} showMarks={false} />}
          </div>
        </Acc>

        <Acc title="Bridge templates" sub="Simply supported, cantilever, continuous">
          <div className="grid grid-cols-2 gap-1.5">
            {ILD_BRIDGE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setBeam(JSON.parse(JSON.stringify(p.model)));
                  setXLead(p.model.length * 0.6);
                  setXSec(p.model.length * 0.4);
                  setPlaying(false);
                  toast(`Loaded “${p.nameEn}”.`, 'ok');
                }}
                className="text-left rounded-lg p-1.5 text-[10.5px] font-semibold leading-tight"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
              >
                <span className="block" style={{ color: 'var(--accent)' }}>{p.badge}</span>
                {p.nameEn}
              </button>
            ))}
          </div>
        </Acc>
      </div>

      {/* RIGHT */}
      <div className={`space-y-2.5 ${mobileTab === 'result' ? 'block' : 'hidden md:block'}`}>
        {!ild.isStable ? (
          <Card title="Bridge model unstable">
            <Hint tone="warn">Add supports to the bridge model first (open the bridge editor on the left).</Hint>
          </Card>
        ) : (
          <>
            <Card
              title="Drive the vehicle across the bridge"
              sub={`Sensor fixed at C · ${targetLabel[target]} · ordinate = effect of 1 kN standing there`}
              right={
                <div className="flex items-center gap-1">
                  <Badge tone="amber">η max {q(fmt(Math.max(ild.maxPos.val, Math.abs(ild.maxNeg.val)), 2))}</Badge>
                  {ild.isDeterminate ? <Badge tone="green">straight ILD</Badge> : <Badge tone="blue">curved ILD</Badge>}
                </div>
              }
            >
              <div className="space-y-2">
                <Wide min={520}>
                  <BridgeView model={beam} ild={ild} vehicle={veh} evalRes={evalRes} xSec={clampedSec} mullerBreslau={muller} />
                </Wide>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Btn variant="primary" size="md" onClick={() => setPlaying((p) => !p)} icon={playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}>
                    {playing ? 'Pause' : 'Drive'}
                  </Btn>
                  <Btn onClick={() => { setPlaying(false); setXLead(0); }} icon={<RotateCcw className="w-3.5 h-3.5" />}>
                    Reset
                  </Btn>
                  <Btn onClick={() => setXLead((x) => clamp(x - 0.5, 0, maxLead))} icon={<SkipBack className="w-3.5 h-3.5" />} title="Step back 0.5 m" />
                  <Btn onClick={() => setXLead((x) => clamp(x + 0.5, 0, maxLead))} icon={<SkipForward className="w-3.5 h-3.5" />} title="Step forward 0.5 m" />
                  <div className="flex items-center gap-1 ml-1">
                    <span className="text-[10px] font-bold" style={{ color: 'var(--ink-3)' }}>speed</span>
                    <Segmented
                      size="sm"
                      value={String(speed)}
                      onChange={(v) => setSpeed(Number(v))}
                      options={[
                        { value: '0.5', label: '0.5×' },
                        { value: '1', label: '1×' },
                        { value: '2', label: '2×' },
                      ]}
                    />
                  </div>
                </div>

                <Slider label="Lead axle position from left abutment" value={xLead} min={0} max={maxLead} step={0.05} onChange={(v) => { setPlaying(false); setXLead(v); }} suffix="m" />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <Stat label="Current effect" value={fmt(evalRes.totalResponse, 2)} unit={effectUnit} tone="accent" />
                  <Stat label="Worst +ve (swept)" value={fmt(evalRes.criticalMaxPos.value, 2)} unit={effectUnit} tone="ok" />
                  <Stat label="Worst −ve (swept)" value={fmt(evalRes.criticalMaxNeg.value, 2)} unit={effectUnit} tone="bad" />
                  <Stat label="Net ILD area" value={fmt(ild.netArea, 2)} unit={areaUnit} />
                </div>

                {evalRes.wheelContributions.length > 0 && (
                  <div className="scroll-x">
                    <table className="w-full text-[10.5px] num border-collapse">
                      <thead>
                        <tr style={{ color: 'var(--ink-3)' }}>
                          {['Axle', 'x (m)', 'P (kN)', 'η at wheel', 'P·η'].map((h) => (
                            <th key={h} className="text-left px-1.5 py-1 border-b font-bold" style={{ borderColor: 'var(--line)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {evalRes.wheelContributions.map((w, i) => (
                          <tr key={i} style={{ opacity: w.onBridge ? 1 : 0.45 }}>
                            <td className="px-1.5 py-1 font-bold">{w.label}</td>
                            <td className="px-1.5 py-1">{q(fmt(w.x, 2))}</td>
                            <td className="px-1.5 py-1">{q(w.load_kN)}</td>
                            <td className="px-1.5 py-1">{q(fmt(w.ordinate, 3))}</td>
                            <td className="px-1.5 py-1 font-extrabold" style={{ color: 'var(--accent)' }}>{q(fmt(w.contribution, 2))}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={4} className="px-1.5 py-1 text-right font-bold" style={{ color: 'var(--ink-3)' }}>Σ superposition</td>
                          <td className="px-1.5 py-1 font-extrabold" style={{ color: 'var(--ok)' }}>{q(fmt(evalRes.totalResponse, 2))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>

            <Card
              title="The influence line itself"
              sub={`${ild.targetTitleEn}, ordinate at x is the response caused by a 1 kN load at x`}
              right={
                <Badge tone={ild.maxPos.val > Math.abs(ild.maxNeg.val) ? 'green' : 'rose'}>
                  peak {q(fmt(ild.maxPos.val, 3))} {ild.unit}
                </Badge>
              }
            >
              <Plot
                points={ordinates}
                L={beam.length}
                title={`ILD, ${targetLabel[target]}`}
                unit={ildUnit}
                color="var(--accent)"
                height={140}
                cursorX={xLead <= beam.length ? xLead : undefined}
                onCursor={(x) => {
                  setPlaying(false);
                  setXLead(x);
                }}
                markers={[
                  { x: ild.maxPos.x, y: ild.maxPos.val, label: hideAnswers ? 'η+' : `η+ ${fmt(ild.maxPos.val, 2)}`, tone: 'dot' },
                  { x: ild.maxNeg.x, y: ild.maxNeg.val, label: hideAnswers ? 'η−' : `η− ${fmt(ild.maxNeg.val, 2)}`, tone: 'dot' },
                ]}
                hideValues={hideAnswers}
                />
              <div className="mt-1.5">
                <Toggle checked={muller} onChange={setMuller} label="Show the Müller-Breslau virtual-release reasoning" />
              </div>
              {muller && (
                <div className="mt-1.5 rounded-lg p-2 text-[11px] leading-relaxed" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                  <Ghost className="w-3.5 h-3.5 inline mr-1" style={{ color: 'var(--accent)' }} />
                  {lang === 'hinglish' ? ild.mullerBreslauRuleHi : ild.mullerBreslauRuleEn}
                </div>
              )}
            </Card>

            <Card
              title="Moment you can design for"
              sub="Instantaneous BMD is what the truck is doing right now; the envelope is the worst over the whole journey"
              right={
                <Segmented
                  size="sm"
                  value={compare}
                  onChange={setCompare}
                  options={[
                    { value: 'instant', label: 'Now' },
                    { value: 'envelope', label: 'Envelope' },
                  ]}
                />
              }
            >
              {compare === 'instant' && evalRes.instantaneousBeam ? (
                <>
                  <Plot
                    points={evalRes.instantaneousBeam.points.map((p) => ({ x: p.x, y: p.M }))}
                    L={beam.length}
                    title="Live bending moment diagram under the moving vehicle"
                    unit="kN·m"
                    color="var(--sagging)"
                    height={128}
                    ghost={
                      overlayEnv
                        ? { points: evalRes.envelope.map((p) => ({ x: p.xLead, y: p.totalResponse })), color: 'var(--warn)', label: 'worst-case envelope' }
                        : undefined
                    }
                    hideValues={hideAnswers}
                />
                  <div className="mt-1">
                    <Toggle
                      checked={overlayEnv}
                      onChange={setOverlayEnv}
                      label="Also show the worst-case envelope"
                      hint="Overlay the peak the section ever reaches as the truck crosses every position"
                    />
                  </div>
                  <div className="text-[10.5px] mt-1 num" style={{ color: 'var(--ink-3)' }}>
                    max +M {q(fmt(evalRes.instantaneousBeam.maxSaggingM, 2))} · max −M {q(fmt(evalRes.instantaneousBeam.maxHoggingM, 2))} kN·m · all reactions from the same FEM solve
                  </div>
                </>
              ) : (
                <>
                  <Plot
                    points={evalRes.envelope.map((p) => ({ x: p.xLead, y: p.totalResponse }))}
                    L={maxLead}
                    title="Effect envelope as the vehicle sweeps the span"
                    unit={`${ildUnit} · lead axle position`}
                    color="var(--warn)"
                    height={128}
                    markers={[
                      { x: evalRes.criticalMaxPos.xLead, y: evalRes.criticalMaxPos.value, label: 'max +', tone: 'dot' },
                      { x: evalRes.criticalMaxNeg.xLead, y: evalRes.criticalMaxNeg.value, label: 'max −', tone: 'dot' },
                    ]}
                    hideValues={hideAnswers}
                />
                  <div className="mt-1.5">
                    <Btn onClick={snapMax} icon={<Target className="w-3.5 h-3.5" />}>
                      Show the vehicle at the worst position
                    </Btn>
                  </div>
                </>
              )}
            </Card>

            <Card title="Hand off" sub="Take the governing section into the fibre / Mohr labs">
              <div className="flex flex-wrap gap-1.5">
                <Btn
                  variant="primary"
                  onClick={() => {
                    if (!evalRes.instantaneousBeam) return;
                    const tgt = target === 'moment' ? clampedSec : ild.maxPos.x;
                    let best = evalRes.instantaneousBeam.points[0];
                    for (const p of evalRes.instantaneousBeam.points) if (Math.abs(p.x - tgt) < Math.abs(best.x - tgt)) best = p;
                    setToSection({ M: best.M, V: best.V, N: 0, x: best.x, source: `Moving load at x = ${fmt(xLead, 2)} m` });
                    goto('section');
                    toast(`Governing ${target === 'moment' ? 'moment' : 'shear'} section sent to the fibre lab.`, 'ok');
                  }}
                  disabled={!evalRes.instantaneousBeam}
                >
                  Send current section forces → Section lab
                </Btn>
                <Btn onClick={() => goto('beam')} icon={<Truck className="w-3.5 h-3.5" />}>
                  Compare with the static beam lab
                </Btn>
              </div>
              <div className="mt-2">
                <Hint>
                  {lang === 'hinglish'
                    ? 'ILD batata hai ki 1 kN load kahan rakhne se target par sabse zyada effect aayega. Real truck ke liye har axle ka P·η jodo, bas wahi superposition table hai.'
                    : 'The ILD answers one question: if a 1 kN load stands at x, how much response does my target section feel? For a real vehicle, add P·η for each axle, that is exactly the superposition table above.'}
                </Hint>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
