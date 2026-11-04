import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Search,
  Sparkles,
  Target,
  Compass,
  Layers,
  Activity,
  CornerDownRight,
  X,
} from 'lucide-react';
import { buildAtlas, AtlasTopic, searchAtlas } from '../engine/conceptAtlas';
import { analyzeCrossSection } from '../engine/sectionMohrBucklingEngine';
import { useAnalysis } from '../ui/AnalysisContext';
import { Badge, Btn, Card, Hint, Segmented, fmt } from '../ui/primitives';

/**
 * Concept atlas.
 *
 * The other six labs answer "what is the value?". This one answers "which idea is
 * being tested, and why does it apply to *this* problem?". Every reading is pulled
 * from the live solver, so nothing here can drift away from the diagrams.
 */


/* ------------------------------------------------------------------ */
/*  One small drawing per concept, so the atlas can be scanned by eye  */
/*  instead of read like a list. 40 x 28 box, drawn with the same ink   */
/*  as the labs.                                                        */
/* ------------------------------------------------------------------ */

const ink = 'var(--ink-2)';
const acc = 'var(--accent)';
const warm = 'var(--warn)';
const comp = 'var(--compression)';

const GLYPHS: Record<string, React.ReactNode> = {
  determinacy: (
    <>
      <line x1="4" y1="20" x2="36" y2="20" stroke={acc} strokeWidth="1.6" />
      <path d="M6 22 L3 27 L9 27 Z" fill="none" stroke={ink} strokeWidth="1" />
      <circle cx="34" cy="22.5" r="1.6" fill="none" stroke={ink} strokeWidth="1" />
      <text x="20" y="12" fontSize="9" fontWeight="800" fill={ink} textAnchor="middle">?</text>
    </>
  ),
  equilibrium: (
    <>
      <line x1="4" y1="18" x2="36" y2="18" stroke={acc} strokeWidth="1.6" />
      <path d="M20 18 L20 25 M20 25 L17.5 22 M20 25 L22.5 22" stroke={warm} strokeWidth="1.3" fill="none" />
      <path d="M8 18 L8 12 M32 18 L32 12" stroke={comp} strokeWidth="1.4" />
      <path d="M34 6 A10 10 0 0 1 26 14" fill="none" stroke={ink} strokeWidth="1" strokeDasharray="2 2" />
    </>
  ),
  'sfd-bmd': (
    <>
      <path d="M4 8 L36 8 L36 2 L4 2 Z" fill={acc} opacity="0.25" />
      <path d="M4 8 L36 8" stroke={acc} strokeWidth="1.2" />
      <path d="M4 26 L20 14 L36 26" fill="none" stroke={warm} strokeWidth="1.6" />
    </>
  ),
  flexure: (
    <>
      <rect x="4" y="4" width="32" height="20" fill="none" stroke={ink} strokeWidth="1" />
      <line x1="4" y1="14" x2="36" y2="14" stroke={ink} strokeDasharray="2 2" strokeWidth="1" />
      <path d="M4 6 L36 6" stroke={comp} strokeWidth="2.4" />
      <path d="M4 22 L36 22" stroke="var(--tension)" strokeWidth="2.4" />
    </>
  ),
  'shear-stress': (
    <>
      <path d="M4 4 L4 24 L16 27 L16 1 Z" fill={acc} opacity="0.22" stroke={acc} strokeWidth="1.2" />
      <line x1="4" y1="14" x2="36" y2="14" stroke={ink} strokeDasharray="2 2" strokeWidth="0.8" />
      <path d="M16 3 L34 5 L34 23 L16 25" fill="none" stroke={warm} strokeWidth="1.4" />
    </>
  ),
  deflection: (
    <>
      <line x1="4" y1="8" x2="36" y2="8" stroke={ink} strokeDasharray="3 3" strokeWidth="1" />
      <path d="M4 8 Q20 26 36 8" fill="none" stroke={acc} strokeWidth="1.8" />
    </>
  ),
  'strain-energy': (
    <>
      <path d="M6 22 Q20 4 34 22" fill="none" stroke={acc} strokeWidth="1.5" />
      <path d="M6 22 Q20 4 34 22 L34 26 L6 26 Z" fill={acc} opacity="0.18" />
      <text x="20" y="14" fontSize="8" fontWeight="800" fill={ink} textAnchor="middle">U</text>
    </>
  ),
  'moving-loads': (
    <>
      <line x1="4" y1="20" x2="36" y2="20" stroke={ink} strokeWidth="1" />
      <path d="M4 20 L20 6 L36 20" fill="none" stroke={acc} strokeWidth="1.6" />
      <rect x="12" y="9" width="9" height="5" rx="1" fill={warm} />
      <circle cx="14" cy="15" r="1.4" fill={warm} />
      <circle cx="20" cy="15" r="1.4" fill={warm} />
    </>
  ),
  indeterminate: (
    <>
      <line x1="4" y1="18" x2="36" y2="18" stroke={acc} strokeWidth="1.6" />
      <path d="M4 12 L4 24 M4 12 L8 18 L4 24" fill="none" stroke={ink} strokeWidth="1.2" />
      <path d="M36 12 L36 24" stroke={ink} strokeWidth="1.6" />
      <path d="M8 6 Q20 14 32 6" fill="none" stroke={warm} strokeWidth="1.1" strokeDasharray="2 2" />
    </>
  ),
  truss: (
    <>
      <path d="M4 24 L20 6 L36 24 Z" fill="none" stroke={acc} strokeWidth="1.5" />
      <path d="M12 15 L28 15" stroke={comp} strokeWidth="1.3" />
      <circle cx="4" cy="24" r="1.3" fill={ink} />
      <circle cx="20" cy="6" r="1.3" fill={ink} />
      <circle cx="36" cy="24" r="1.3" fill={ink} />
    </>
  ),
  frames: (
    <>
      <path d="M8 24 L8 6 L32 6 L32 24" fill="none" stroke={acc} strokeWidth="1.6" />
      <path d="M8 24 L2 28 M32 24 L38 28" stroke={ink} strokeWidth="1.2" />
      <path d="M8 6 Q14 14 20 6" fill="none" stroke={warm} strokeWidth="1" strokeDasharray="2 2" />
    </>
  ),
  torsion: (
    <>
      <circle cx="20" cy="14" r="9" fill="none" stroke={acc} strokeWidth="1.4" />
      <circle cx="20" cy="14" r="3.4" fill="none" stroke={ink} strokeWidth="1" strokeDasharray="2 2" />
      <path d="M28 8 A11 11 0 0 1 30 16" fill="none" stroke={warm} strokeWidth="1.3" />
      <path d="M30 16 L27 13 M30 16 L32 12" stroke={warm} strokeWidth="1.1" />
    </>
  ),
  buckling: (
    <>
      <line x1="4" y1="26" x2="36" y2="26" stroke={ink} strokeWidth="1.4" />
      <line x1="12" y1="26" x2="24" y2="26" stroke={ink} strokeWidth="1.4" />
      <path d="M20 26 Q6 14 20 4" fill="none" stroke={acc} strokeWidth="1.8" />
      <path d="M20 4 L28 4" stroke={ink} strokeWidth="1.4" />
    </>
  ),
  'principal-stress': (
    <>
      <circle cx="18" cy="16" r="8.5" fill="none" stroke={acc} strokeWidth="1.4" />
      <line x1="7" y1="16" x2="30" y2="16" stroke={ink} strokeWidth="0.9" />
      <circle cx="9.5" cy="16" r="1.6" fill={warm} />
      <circle cx="26.5" cy="16" r="1.6" fill={warm} />
      <text x="9.5" y="10" fontSize="6" fill={ink} textAnchor="middle">σ₂</text>
      <text x="26.5" y="10" fontSize="6" fill={ink} textAnchor="middle">σ₁</text>
    </>
  ),
  sections: (
    <>
      <path d="M12 4 L28 4 L28 11 L22 11 L22 24 L18 24 L18 11 L12 11 Z" fill={acc} opacity="0.22" stroke={acc} strokeWidth="1.2" />
      <line x1="6" y1="14" x2="34" y2="14" stroke={warm} strokeWidth="1" strokeDasharray="2 2" />
    </>
  ),
  failure: (
    <>
      <rect x="6" y="6" width="28" height="18" fill="none" stroke={ink} strokeWidth="1" />
      <path d="M14 6 L18 14 L13 18 L22 24" fill="none" stroke={warm} strokeWidth="1.4" />
      <text x="26" y="19" fontSize="7" fontWeight="800" fill={ink}>FoS</text>
    </>
  ),
  units: (
    <>
      <text x="20" y="14" fontSize="9" fontWeight="800" fill={acc} textAnchor="middle">kN</text>
      <text x="20" y="24" fontSize="7" fill={ink} textAnchor="middle">m · mm · MPa</text>
    </>
  ),
  superposition: (
    <>
      <path d="M4 20 Q12 10 20 20" fill="none" stroke={ink} strokeWidth="1.2" strokeDasharray="2 2" />
      <path d="M20 20 Q28 10 36 20" fill="none" stroke={ink} strokeWidth="1.2" strokeDasharray="2 2" />
      <path d="M4 24 Q20 8 36 24" fill="none" stroke={acc} strokeWidth="1.7" />
    </>
  ),
  reciprocity: (
    <>
      <line x1="6" y1="18" x2="34" y2="18" stroke={acc} strokeWidth="1.6" />
      <path d="M10 18 L10 10" stroke={warm} strokeWidth="1.2" />
      <path d="M10 18 Q22 24 30 18" fill="none" stroke={ink} strokeWidth="0.9" strokeDasharray="2 2" />
      <text x="20" y="8" fontSize="7" fontWeight="800" fill={ink} textAnchor="middle">δᵢⱼ = δⱼᵢ</text>
    </>
  ),
  settlement: (
    <>
      <line x1="4" y1="14" x2="26" y2="14" stroke={acc} strokeWidth="1.6" />
      <line x1="26" y1="20" x2="36" y2="20" stroke={acc} strokeWidth="1.6" />
      <path d="M26 14 L26 20" stroke={ink} strokeWidth="1" strokeDasharray="2 2" />
      <path d="M26 22 L26 27" stroke={warm} strokeWidth="1.3" />
      <text x="31" y="27" fontSize="6" fill={warm}>10mm</text>
    </>
  ),
  eccentric: (
    <>
      <rect x="12" y="4" width="16" height="22" fill="none" stroke={acc} strokeWidth="1.2" />
      <line x1="20" y1="4" x2="20" y2="26" stroke={ink} strokeWidth="0.8" strokeDasharray="2 2" />
      <path d="M23 1 L23 9" stroke={warm} strokeWidth="1.6" />
      <path d="M23 9 L21 6 M23 9 L25 6" stroke={warm} strokeWidth="1.1" />
      <path d="M12 6 L26 26" stroke={comp} strokeWidth="1" strokeDasharray="2 1.6" />
    </>
  ),
  'moment-area': (
    <>
      <path d="M4 22 L20 8 L36 22" fill="none" stroke={acc} strokeWidth="1.5" />
      <path d="M4 22 L20 8 L36 22 L36 26 L4 26 Z" fill={acc} opacity="0.16" />
      <text x="20" y="20" fontSize="6" fill={ink} textAnchor="middle">M/EI</text>
    </>
  ),
};

let markerDefs = 0;
const Glyph: React.FC<{ id: string }> = ({ id }) => (
  <svg viewBox="1 1 38 28" className="w-[52px] h-[38px] shrink-0" aria-hidden="true">
    {markerDefs === 0 ? null : null}
    {GLYPHS[id] ?? <circle cx="20" cy="15" r="8" fill="none" stroke={ink} />}
  </svg>
);

const TIER_META: Record<string, { label: string; sub: string; color: string }> = {
  core: { label: 'Core', sub: 'always asked', color: '#2563eb' },
  analysis: { label: 'Analysis', sub: 'the method', color: '#b45309' },
  design: { label: 'Design', sub: 'sizing & check', color: '#0f766e' },
};

const TopicCard: React.FC<{
  t: AtlasTopic;
  open: boolean;
  onToggle: () => void;
  onGo: () => void;
  lang: 'hinglish' | 'english';
}> = ({ t, open, onToggle, onGo, lang }) => {
  const meta = TIER_META[t.tier];
  const live = t.state === 'live';
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${open ? 'var(--line-strong)' : 'var(--line)'}`,
        boxShadow: open ? '0 2px 10px rgba(15,23,42,.06)' : 'none',
      }}
    >
      <button onClick={onToggle} className="w-full text-left px-3 py-2.5 flex items-start gap-2.5">
        <span
          className="shrink-0 grid place-items-center rounded-lg"
          style={{
            width: open ? 68 : 60,
            height: open ? 50 : 44,
            background: `${meta.color}14`,
            border: `1px solid ${meta.color}40`,
          }}
        >
          <Glyph id={t.id} />
        </span>
        <span
          className="shrink-0 mt-0.5 w-[22px] h-[22px] rounded-md grid place-items-center text-[10.5px] font-extrabold num"
          style={{ background: `${meta.color}14`, color: meta.color, border: `1px solid ${meta.color}33` }}
        >
          {t.n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12.5px] font-extrabold leading-tight">{lang === 'hinglish' ? t.titleHi : t.title}</span>
            {live && (
              <span className="text-[9px] font-extrabold uppercase tracking-wider px-1 py-[1px] rounded" style={{ background: 'var(--ok-soft, #ecfdf5)', color: '#047857' }}>
                in this model
              </span>
            )}
            {t.state === 'related' && (
              <span className="text-[9px] font-extrabold uppercase tracking-wider px-1 py-[1px] rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
                next step
              </span>
            )}
          </span>
          <span className="block text-[10.5px] mt-0.5 leading-snug" style={{ color: 'var(--ink-3)' }}>
            {lang === 'hinglish' ? t.asksHi : t.asks}
          </span>
        </span>
        <span className="shrink-0 text-[10px] font-bold mt-1" style={{ color: 'var(--ink-3)' }}>
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-2.5">
          <div className="rounded-lg p-2 text-[11.5px] leading-relaxed" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            {lang === 'hinglish' ? t.becauseHi : t.because}
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {t.readings.map((r) => (
              <div key={r.label} className="rounded-lg px-2 py-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
                  {r.label}
                </div>
                <div
                  className="text-[13px] font-extrabold num leading-tight"
                  style={{
                    color:
                      r.tone === 'bad' ? 'var(--bad, #be123c)' : r.tone === 'warn' ? 'var(--warn)' : r.tone === 'ok' ? 'var(--ok)' : 'var(--ink)',
                  }}
                >
                  {r.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 rounded-lg px-2 py-1.5 num text-[11px] leading-relaxed overflow-x-auto scroll-x" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {t.formula}
          </div>

          <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            <BookOpen className="w-3.5 h-3.5 mt-[2px] shrink-0" style={{ color: 'var(--ink-3)' }} />
            <span>{lang === 'hinglish' ? t.boardWorkHi : t.boardWork}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Btn size="sm" variant="primary" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={onGo}>
              Show me this in the lab
            </Btn>
            {t.keywords.slice(0, 3).map((k) => (
              <span key={k} className="text-[10px] font-semibold px-1.5 py-[2px] rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ConceptAtlasModule: React.FC = () => {
  const { beam, beamRes, struct, structRes, ildResult, sectionGeometry, fy_MPa, goto, lang, toast, atlasQuery } = useAnalysis();
  const ild = ildResult;
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<'all' | 'core' | 'analysis' | 'design'>('all');
  const [open, setOpen] = useState<string | null>('determinacy');

  // a question typed on the studio overview lands here already filtered
  useEffect(() => {
    if (!atlasQuery) return;
    setQ(atlasQuery);
    setTier('all');
    setOpen(null);
  }, [atlasQuery]);

  // governing section of the beam: the biggest |M| the class would circle
  const secRes = useMemo(() => {
    const gov = beamRes.criticalPoints.find((c) => c.kind === 'max_sagging') ?? beamRes.criticalPoints[0];
    return { M: gov?.value ?? 0, V: beamRes.maxAbsV };
  }, [beamRes]);

  const atlas = useMemo(() => {
    const dims = sectionGeometry;
    // run the same strip engine the fibre lab uses, at this beam's governing (M, V)
    const r = analyzeCrossSection(dims, { M_kNm: secRes.M, V_kN: secRes.V, N_kN: 0, fy_MPa: 250 });
    return buildAtlas({
      beam,
      beamRes,
      struct,
      structRes,
      ild,
      dims,
      fy_MPa,
      spanM: beam.length,
      section: {
        maxShear_MPa: r.maxShear_MPa,
        maxVonMises_MPa: r.maxVonMises_MPa,
        utilizationRatio: r.utilizationRatio,
        maxTension_MPa: r.maxTension_MPa,
        maxCompression_MPa: r.maxCompression_MPa,
      },
    });
  }, [beam, beamRes, struct, structRes, ild, sectionGeometry, fy_MPa, secRes]);

  const visible = useMemo(() => {
    const byTier = tier === 'all' ? atlas.topics : atlas.topics.filter((t) => t.tier === tier);
    return searchAtlas(byTier, q);
  }, [atlas, tier, q]);

  const liveCount = atlas.topics.filter((t) => t.state === 'live').length;

  return (
    <div className="space-y-2.5">
      {/* header */}
      <Card
        title="Concept atlas, every question this model can teach"
        sub={`${atlas.topics.length} ideas from determinacy to failure theories, each one wired to your own numbers`}
        right={
          <div className="flex items-center gap-1.5">
            <Badge tone="blue">{liveCount} live now</Badge>
            <Badge tone="neutral">{atlas.topics.length} topics</Badge>
          </div>
        }
      >
        <div className="rounded-xl p-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--ink-3)' }}>
            <Target className="w-3.5 h-3.5" /> your current model
          </div>
          <div className="mt-1 text-[12.5px] font-semibold leading-snug">{lang === 'hinglish' ? atlas.profile.textHi : atlas.profile.text}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {atlas.profile.tags.map((t) => (
              <span key={t} className="text-[10px] font-bold px-1.5 py-[2px] rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-[190px] rounded-lg px-2 py-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)' }}>
            <Search className="w-3.5 h-3.5" style={{ color: 'var(--ink-3)' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type the exam topic: mohr, truss, deflection, swa..."
              className="w-full bg-transparent outline-none text-[12px]"
              style={{ color: 'var(--ink)' }}
            />
            {q && (
              <button onClick={() => setQ('')} title="Clear">
                <X className="w-3.5 h-3.5" style={{ color: 'var(--ink-3)' }} />
              </button>
            )}
          </div>
          <Segmented
            size="sm"
            value={tier}
            onChange={setTier}
            options={[
              { value: 'all', label: 'All' },
              { value: 'core', label: 'Core' },
              { value: 'analysis', label: 'Analysis' },
              { value: 'design', label: 'Design' },
            ]}
          />
        </div>

        <div className="mt-1.5 text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
          {visible.length} of {atlas.topics.length} topics · every value below is read live from the same solver that draws your diagrams
        </div>
      </Card>

      {/* topic list */}
      <div className="space-y-1.5">
        {visible.map((t) => (
          <TopicCard
            key={t.id}
            t={t}
            open={open === t.id}
            lang={lang}
            onToggle={() => setOpen(open === t.id ? null : t.id)}
            onGo={() => {
              goto(t.goto);
              toast(`Opening the ${t.goto} lab with your current model.`, 'info');
            }}
          />
        ))}
        {!visible.length && (
          <Card title="Nothing matched">
            <Hint tone="warn">
              Try a shorter word, “shear”, “truss”, “mohr”, “energy”, “torsion”, “safety”. The atlas searches both the
              English and Hinglish descriptions of every topic.
            </Hint>
          </Card>
        )}
      </div>

      {/* how a teacher uses this */}
      <Card title="How to run a 10-minute doubt session with this page" sub="No typing during class, everything is already live">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
          {[
            {
              icon: <Compass className="w-4 h-4" />,
              t: '1 · They ask the doubt',
              b: 'Type the word from the question paper into the search box. The atlas narrows to the topics that contain it.',
            },
            {
              icon: <Layers className="w-4 h-4" />,
              t: '2 · Read the "because" line',
              b: 'It is not a definition, it quotes the student’s own span, moment and section, so the concept attaches to the figure instead of floating.',
            },
            {
              icon: <Sparkles className="w-4 h-4" />,
              t: '3 · Press “show me”',
              b: 'The lab opens with the same model loaded and the board-work line tells you exactly which handle to move.',
            },
          ].map((s) => (
            <div key={s.t} className="rounded-xl p-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: 'var(--accent)' }}>
                {s.icon} {s.t}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {s.b}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg px-2 py-1.5 text-[11px] leading-relaxed flex items-start gap-1.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
          <CornerDownRight className="w-3.5 h-3.5 mt-[2px] shrink-0" style={{ color: 'var(--ink-3)' }} />
          <span>
            The atlas never fabricates: if a topic does not govern your current model it says so and points to the reason (for example “no hogging on this beam, so
            there is no contraflexure”). Change a support in the beam lab and the wording changes with it.
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn size="sm" icon={<Activity className="w-3.5 h-3.5" />} onClick={() => goto('beam')}>
            Edit the beam
          </Btn>
          <Btn size="sm" icon={<Target className="w-3.5 h-3.5" />} onClick={() => goto('structure')}>
            Edit the structure
          </Btn>
          <Btn size="sm" icon={<Layers className="w-3.5 h-3.5" />} onClick={() => goto('section')}>
            Change the section
          </Btn>
        </div>
        <div className="mt-2 text-[10.5px] num" style={{ color: 'var(--ink-3)' }}>
          Governing section checked: M = {fmt(secRes.M, 2)} kN·m, V = {fmt(secRes.V, 2)} kN · section {fmt(sectionGeometry.depth_mm, 0)} mm deep,{' '}
          {fmt(sectionGeometry.width_mm, 0)} mm wide · fy = {fmt(fy_MPa, 0)} MPa
        </div>
      </Card>
    </div>
  );
};
