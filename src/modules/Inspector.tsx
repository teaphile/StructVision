import React, { useMemo, useState } from 'react';
import { Crosshair, Layers, Scissors, X } from 'lucide-react';
import { inspectBeamSection } from '../engine/beamEngine';
import { inspectFrameMember } from '../engine/shared';
import { useAnalysis } from '../ui/AnalysisContext';
import { Badge, Btn, Segmented, Slider, Stat, fmt } from '../ui/primitives';

export const Inspector: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { beam, beamRes, struct, structRes, pick, setToSection, goto, toast, hideAnswers } = useAnalysis();
  const [src, setSrc] = useState<'beam' | 'frame'>('beam');
  const [xCut, setXCut] = useState(beam.length * 0.45);
  const [memberId, setMemberId] = useState<string>(pick?.type === 'member' ? pick.id : structRes.members[0]?.id ?? '');
  const [sRatio, setSRatio] = useState(0.5);

  const beamCut = useMemo(() => (beamRes.isStable ? inspectBeamSection(beam, beamRes, Math.min(beam.length, Math.max(0, xCut))) : null), [beam, beamRes, xCut]);
  const frameCut = useMemo(() => (structRes.isStable ? inspectFrameMember(struct, structRes, memberId, sRatio) : null), [struct, structRes, memberId, sRatio]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 no-print">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-[430px] overflow-y-auto pop"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--line)' }}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <div className="leading-tight">
              <div className="text-[13px] font-extrabold">Section inspector</div>
              <div className="text-[10px]" style={{ color: 'var(--ink-3)' }}>N, V, M at any cut, ready to hand off</div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 grid place-items-center rounded-lg" style={{ border: '1px solid var(--line)' }}>
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-3 space-y-2.5">
          <Segmented full value={src} onChange={setSrc} options={[{ value: 'beam', label: 'Beam (1D)' }, { value: 'frame', label: 'Frame / truss member' }]} />

          {src === 'beam' && (
            <>
              <Slider label="Cut position x" value={xCut} min={0} max={beam.length} step={beam.length / 200} onChange={setXCut} suffix="m" />
              {beamCut ? (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Stat label="N" value={fmt(0, 1)} unit="kN" />
                    <Stat label="V" value={fmt(beamCut.V, 2)} unit="kN" tone="accent" />
                    <Stat label="M" value={fmt(beamCut.M, 2)} unit="kN·m" tone="warn" />
                  </div>
                  <div className="rounded-xl p-2 text-[10.5px] num space-y-0.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                    {beamCut.equilibriumSteps.map((s, i) => (
                      <div key={i}>{hideAnswers ? '•••' : s}</div>
                    ))}
                    <div style={{ color: 'var(--ink-3)' }}>A transverse beam has no axial force or torque, so N = 0 and T = 0 here, the section lab states this too.</div>
                  </div>
                  <Btn
                    variant="primary"
                    size="md"
                    icon={<Layers className="w-4 h-4" />}
                    onClick={() => {
                      setToSection({ M: beamCut.M, V: beamCut.V, N: 0, x: xCut, source: `Inspector · beam x = ${fmt(xCut, 2)} m` });
                      goto('section');
                      toast('Section forces sent to the fibre lab.', 'ok');
                    }}
                  >
                    Send to section lab
                  </Btn>
                  <Btn size="md" icon={<Scissors className="w-4 h-4" />} onClick={() => { goto('beam'); onClose(); }}>
                    Open knife view in module 1
                  </Btn>
                </>
              ) : (
                <div className="text-[11.5px]" style={{ color: 'var(--compression)' }}>The current beam is a mechanism, fix supports first.</div>
              )}
            </>
          )}

          {src === 'frame' && (
            <>
              <label className="block">
                <span className="block text-[10.5px] font-bold uppercase mb-1" style={{ color: 'var(--ink-3)' }}>Member</span>
                <select
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="w-full rounded-lg px-2 py-1.5 text-[12px] font-semibold"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)' }}
                >
                  {structRes.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} · N {hideAnswers ? '•••' : fmt(m.axial_kN, 1)} kN ({m.state})
                    </option>
                  ))}
                </select>
              </label>
              <Slider label="Position along member" value={sRatio} min={0.02} max={0.98} step={0.01} onChange={setSRatio} />
              {frameCut ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={frameCut.state === 'tension' ? 'blue' : frameCut.state === 'compression' ? 'rose' : 'neutral'}>
                      {frameCut.state}
                    </Badge>
                    <span className="text-[10.5px] num" style={{ color: 'var(--ink-3)' }}>
                      L = {hideAnswers ? '•••' : fmt(frameCut.length_m, 2)} m · angle {hideAnswers ? '•••' : fmt(frameCut.angleDeg, 1)}°
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Stat label="N" value={fmt(frameCut.N_kN, 2)} unit="kN" tone={frameCut.state === 'compression' ? 'bad' : 'ok'} />
                    <Stat label="V" value={fmt(frameCut.V_kN, 2)} unit="kN" tone="accent" />
                    <Stat label="M" value={fmt(frameCut.M_kNm, 2)} unit="kN·m" tone="warn" />
                  </div>
                  <Btn
                    variant="primary"
                    size="md"
                    icon={<Layers className="w-4 h-4" />}
                    onClick={() => {
                      setToSection({ M: frameCut.M_kNm, V: frameCut.V_kN, N: frameCut.N_kN, x: frameCut.sRatio * frameCut.length_m, source: `Inspector · member ${frameCut.memberLabel}` });
                      goto('section');
                      toast('Member forces sent to the fibre lab.', 'ok');
                    }}
                  >
                    Send to section lab
                  </Btn>
                </>
              ) : (
                <div className="text-[11.5px]" style={{ color: 'var(--compression)' }}>Select a valid member (or fix the structure).</div>
              )}
            </>
          )}

          <div className="rounded-xl p-2 text-[10px] leading-relaxed" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
            Sign convention used everywhere in this app: V positive when the left segment is pushed up / right segment pushed down; M positive when sagging
            (top in compression); N positive in tension. These are the signs the engines use, not re-labelled for display.
          </div>
        </div>
      </aside>
    </div>
  );
};
