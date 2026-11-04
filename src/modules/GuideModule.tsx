import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  CloudUpload,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  Rocket,
  Share2,
  Workflow,
} from 'lucide-react';
import { useAnalysis } from '../ui/AnalysisContext';
import { Acc, Badge, Btn, Card, Hint, Segmented, StepBar, fmt } from '../ui/primitives';

const PIPE = [
  {
    n: 1,
    title: 'Count the restraints',
    hi: 'Pehle Ds / Dk gino',
    body: 'Which supports exist? Does the structure hold itself up? Ds = 0 → equilibrium is enough. Ds > 0 → deformation compatibility is needed.',
    hiBody: 'Support ginno. Ds = 0 matlab sirf ∑F aur ∑M se kaam ho jayega; Ds > 0 matlab stiffness/compatibility lagani padegi.',
    target: 'beam',
    icon: <ClipboardList className="w-4 h-4" />,
    formula: 'Beam Ds = r − (2+c) · Truss Ds = m+r−2j · Frame Ds = 3m+r−3j',
  },
  {
    n: 2,
    title: 'Cut a section, draw the free body',
    hi: 'Section kaato, FBD banao',
    body: 'Pick a cut. Keep the simpler side. Unknown internal V and M appear at the cut; solve them from ∑Fy = 0 and ∑Mcut = 0.',
    hiBody: 'Cut lagao, chhota hissa chuno, cut par V aur M maano, aur equilibrium se nikaalo. Yahi Method of Sections hai.',
    target: 'beam',
    icon: <Layers className="w-4 h-4" />,
    formula: 'dV/dx = −w · dM/dx = V · V=0 ⇒ M peak',
  },
  {
    n: 3,
    title: 'Make it move / carry a vehicle',
    hi: 'Ab load ko chalao',
    body: 'For bridges, fix the section and walk a 1 kN load, the ordinate at x is the response at your section. Superpose real axles with P·η.',
    hiBody: 'Bridge ke liye sensor fix karo aur 1 kN load se poora span sweep karo. Har axle ka P·η jodo, bas ILD ka funda.',
    target: 'ild',
    icon: <Workflow className="w-4 h-4" />,
    formula: 'Response = Σ Pᵢ η(xᵢ) + ∫ w(x) η(x) dx',
  },
  {
    n: 4,
    title: 'Follow the load into the material',
    hi: 'Load ko material ke andar le jao',
    body: 'N, V and M at your cut become A, Q and I demands in the section: σ = N/A − My/I, τ = VQ/Ib.',
    hiBody: 'Cut ke N, V, M ko section me daalo: σ = N/A − My/I, τ = VQ/Ib. Flange bending jhelta hai, web shear.',
    target: 'section',
    icon: <Layers className="w-4 h-4" />,
    formula: 'σ = N/A − My/I · τ = VQ/(Ib) · σvM = √(σ² + 3τ²)',
  },
  {
    n: 5,
    title: 'Rotate to find the real failure plane',
    hi: 'Failure plane dhoondo (Mohr)',
    body: 'The element sees σx, σy, τxy. Principal stresses and maximum shear tell you the plane on which the material actually gives up.',
    hiBody: 'Mohr circle ghumao aur σ₁, σ₂, τmax nikaalo, material tirche plane par fail hota hai.',
    target: 'mohr',
    icon: <HelpCircle className="w-4 h-4" />,
    formula: 'σ₁,₂ = C ± R · R = √(((σx−σy)/2)² + τ²)',
  },
  {
    n: 6,
    title: 'Check stability & serviceability',
    hi: 'Stability aur deflection check karo',
    body: 'A structure can be strong yet fail: a slender column buckles, a flexible beam deflects past L/250 or L/300, a shaft twists too much.',
    hiBody: 'Strong hone se kaam nahi chalta: patla column buckle hota hai, flexible beam L/300 se zyada jhukta hai, shaft zyada mudta hai.',
    target: 'buckling',
    icon: <GraduationCap className="w-4 h-4" />,
    formula: 'Pcr = π²EI/(KL)² · δmax ≤ L/300 · φ ≤ 1°/m',
  },
];

const MYTHS = [
  {
    q: 'ILD aur BMD ek hi cheez hain',
    a: 'Nahi. BMD me load FIXED rehta hai aur section x badalta hai. ILD me section FIX aur load x badalta hai. Isliye ILD ka unit “per kN” hota hai.',
    qEn: 'Is the ILD just the bending moment diagram?',
    aEn: 'No. In the BMD the load is fixed and the section moves. In an ILD the section is fixed and the load moves. That is why ILDs are dimensionless.',
  },
  {
    q: 'V = 0 ka matlab moment zero',
    a: 'Ulta! V = 0 par moment ka peak hota hai (dM/dx = 0). Moment zero (contraflexure) wahan hota hai jahan curvature palat jaati hai.',
    qEn: 'Does V = 0 mean M = 0?',
    aEn: 'Exactly the opposite: V = 0 is where M peaks. M = 0 is a point of contraflexure, where curvature flips.',
  },
  {
    q: 'Beam moti karne se reactions badal jayenge',
    a: 'Determinate (Ds = 0) me EI badalne se V, M, reactions nahi badalte, sirf deflection badalta hai. Indeterminate me stiffer member zyada moment khincha hai.',
    qEn: 'If I make the beam stiffer, do the reactions change?',
    aEn: 'In a determinate structure: no, only deflections change. In an indeterminate one: yes, stiffness attracts moment.',
  },
  {
    q: 'Hinge par deflection zero hota hai',
    a: 'Internal hinge par M = 0 hota hai aur slope me kink aata hai, lekin vertical deflection share hota hai, usually zero nahi.',
    qEn: 'Is deflection zero at an internal hinge?',
    aEn: 'No. M = 0 and the slope jumps; the vertical deflection is continuous and usually non-zero.',
  },
  {
    q: 'Neutral axis hamesha centroid se guzarti hai',
    a: 'Sirf pure bending me. Axial force N bhi lage to neutral axis shift ho jaati hai, section lab me yNA dikhta hai.',
    qEn: 'Does the neutral axis always pass through the centroid?',
    aEn: 'Only under pure bending. Add axial force N and the neutral axis moves, the section lab computes the shifted N.A.',
  },
  {
    q: 'SOM aur RCC ke professor BMD ulta kyun banate hain',
    a: 'SOM sagging upar (+) banata hai. RCC design me BMD tension side par banate hain taaki rebar kahan dalna hai turant dikhe. Module 1 me dono ke button hain.',
    qEn: 'Why do two professors draw the BMD upside down?',
    aEn: 'SOM plots sagging upward. Detailing plots it on the tension side so rebar placement is obvious. Module 1 has a toggle for both.',
  },
];

export const GuideModule: React.FC = () => {
  const { goto, beamRes, structRes, beam, struct, lang, setToSection, toast, hideAnswers, setHideAnswers } = useAnalysis();
  const [tab, setTab] = useState<'pipeline' | 'lecture' | 'myths' | 'deploy'>('pipeline');
  const [lectStep, setLectStep] = useState(0);
  const [assignment, setAssignment] = useState('');

  const lecture = useMemo(
    () => [
      {
        t: '0-2 min · Set the scene',
        title: 'Same beam, three questions',
        body: 'Project module 1. Ask: “Where does this beam break?” Let them guess, then reveal the BMD peak. Then ask “how far does it sag?” and reveal the elastic curve.',
        action: () => goto('beam'),
        cta: 'Open beam lab',
      },
      {
        t: '2-6 min · Build intuition with the knife',
        title: 'Live free-body at a cut',
        body: 'Drag the section knife to mid-span, then to the support. Watch V and M in the FBD change sign. Do not give the formula yet.',
        action: () => goto('beam'),
        cta: 'Open knife',
      },
      {
        t: '6-10 min · Indeterminacy twist',
        title: 'Add a third support',
        body: 'Add a roller in module 1. Reactions change, Ds becomes 1, and the BMD redistributes. Point out that EI now matters.',
        action: () => goto('beam'),
        cta: 'Add support',
      },
      {
        t: '10-15 min · Bridges move',
        title: 'Drive a truck on the influence line',
        body: 'Module 3: fix section C at mid-span, then drive a two-axle truck. Pause at the critical position. Show P·η table.',
        action: () => goto('ild'),
        cta: 'Drive truck',
      },
      {
        t: '15-20 min · Into the material',
        title: 'From moment to fibre stress',
        body: 'Send the governing section to module 4. Probe the top fibre and bottom fibre. Ask which one cracks in RCC.',
        action: () => {
          const c = beamRes.criticalPoints.find((x) => x.kind === 'max_sagging') ?? beamRes.criticalPoints[0];
          if (c) setToSection({ M: c.value, V: beamRes.maxAbsV, N: 0, x: c.x, source: 'Lecture script handoff' });
          goto('section');
        },
        cta: 'Send to section lab',
      },
      {
        t: '20-25 min · Failure planes',
        title: 'Mohr circle in 60 seconds',
        body: 'Send a fibre to module 5 and snap to σ₁. Emphasise why a ductile bar fails in shear at 45°.',
        action: () => goto('mohr'),
        cta: 'Open Mohr',
      },
      {
        t: '25-30 min · Stability',
        title: 'Short column vs long column',
        body: 'Module 6: same section, four end conditions. Halve the length and ask what happens to Pcr. Then show Johnson vs Euler.',
        action: () => goto('buckling'),
        cta: 'Open buckling',
      },
    ],
    [goto, beamRes, setToSection]
  );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={tab}
          onChange={setTab}
          size="md"
          wrap
          options={[
            { value: 'pipeline', label: 'Concept pipeline' },
            { value: 'lecture', label: '30-min lecture script' },
            { value: 'myths', label: 'Confusions busted' },
            { value: 'deploy', label: 'Share & deploy' },
          ]}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <Badge tone="blue">beam Ds = {beamRes.Ds}</Badge>
          <Badge tone={structRes.Ds === 0 ? 'green' : 'amber'}>2D Ds = {structRes.Ds}</Badge>
        </div>
      </div>

      {tab === 'pipeline' && (
        <>
          <Card
            title="The six ideas that solve every SOM / structural problem"
            sub="Click any card to open the live engine for that idea, the same model follows you across modules"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {PIPE.map((p) => (
                <button
                  key={p.n}
                  onClick={() => goto(p.target)}
                  className="text-left rounded-xl p-2.5 card"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-6 h-6 rounded-lg grid place-items-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      {p.icon}
                    </span>
                    <span className="text-[9.5px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--ink-3)' }}>
                      idea {p.n}
                    </span>
                  </div>
                  <div className="text-[12.5px] font-extrabold leading-tight">{lang === 'hinglish' ? p.hi : p.title}</div>
                  <div className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {lang === 'hinglish' ? p.hiBody : p.body}
                  </div>
                  <div className="mt-1.5 text-[9.5px] num rounded-md px-1.5 py-1" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
                    {p.formula}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--accent)' }}>
                    open engine <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
            <Card title="What the board is showing right now" sub="Every lab reads this same model, nothing is stored separately">
              <div className="grid grid-cols-2 gap-1.5 text-[11px] num">
                <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                  <div className="text-[9.5px] font-bold uppercase" style={{ color: 'var(--ink-3)' }}>Beam</div>
                  <div>L = {fmt(beam.length, 2)} m</div>
                  <div>supports = {beam.supports.length} · loads = {beam.loads.length}</div>
                  <div>Ds = {beamRes.Ds} · max|M| = {fmt(beamRes.maxAbsM, 1)} kN·m</div>
                  <div>δmax = {fmt(beamRes.maxAbsDeflectionMm, 2)} mm</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                  <div className="text-[9.5px] font-bold uppercase" style={{ color: 'var(--ink-3)' }}>2D structure</div>
                  <div>{struct.mode} · {struct.nodes.length} joints · {struct.members.length} members</div>
                  <div>Ds = {structRes.Ds} · Dk = {structRes.Dk}</div>
                  <div>max|N| = {fmt(structRes.maxAxialAbs, 1)} kN</div>
                  <div>max|M| = {fmt(structRes.maxMomentAbs, 1)} kN·m</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Btn icon={<Layers className="w-3.5 h-3.5" />} onClick={() => goto('beam')}>Beam lab</Btn>
                <Btn icon={<Workflow className="w-3.5 h-3.5" />} onClick={() => goto('structure')}>Frame / truss lab</Btn>
                <Btn icon={<BookOpen className="w-3.5 h-3.5" />} onClick={() => setTab('lecture')}>Lecture script</Btn>
              </div>
            </Card>

            <Card title="Getting it onto the college network" sub="It is a folder of static files; nothing runs on a server">
              <div className="space-y-1.5 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                <div className="flex gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} /> Every calculation in this app runs in the browser. No API, no database.</div>
                <div className="flex gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} /> Vercel: import the repo, build = <code className="num">npm run build</code>, output = <code className="num">dist</code>. Done.</div>
                <div className="flex gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} /> GitHub Pages: the included workflow builds and publishes on every push.</div>
                <div className="flex gap-1.5"><Share2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} /> The Share button encodes your beam + frame + section + theme into the URL hash, students open the exact same problem offline.</div>
              </div>
              <div className="mt-2">
                <Btn size="md" variant="primary" icon={<CloudUpload className="w-4 h-4" />} onClick={() => setTab('deploy')}>
                  Put this online (10 minutes)
                </Btn>
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === 'lecture' && (
        <Card
          title="A ready 30-minute lecture, click by click"
          sub="Each step opens the right module with your current model, speak, don't type during class"
          right={<Badge tone="amber">{lecture[lectStep].t}</Badge>}
        >
          <div className="space-y-2">
            <StepBar steps={lecture.map((l) => l.title.split(' ')[0] + '…')} step={lectStep} onJump={setLectStep} progress={(lectStep + 1) / lecture.length} />
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <div className="text-[10px] font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
                {lecture[lectStep].t}
              </div>
              <div className="text-[14px] font-extrabold leading-tight">{lecture[lectStep].title}</div>
              <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {lecture[lectStep].body}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Btn variant="primary" onClick={lecture[lectStep].action} icon={<Rocket className="w-3.5 h-3.5" />}>
                  {lecture[lectStep].cta}
                </Btn>
                <Btn onClick={() => setLectStep((s) => Math.max(0, s - 1))} disabled={lectStep === 0}>◀ Previous</Btn>
                <Btn onClick={() => setLectStep((s) => Math.min(lecture.length - 1, s + 1))} disabled={lectStep === lecture.length - 1}>Next ▶</Btn>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <div className="rounded-xl p-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                <div className="text-[10.5px] font-bold mb-1">Board-work checklist</div>
                <ul className="text-[11px] space-y-0.5" style={{ color: 'var(--ink-2)' }}>
                  {['Draw the FBD before writing any equation', 'State the sign convention out loud', 'Mark Ds on the board', 'Predict before revealing', 'Ask one why-question per diagram'].map((t) => (
                    <li key={t} className="flex gap-1.5"><CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} />{t}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl p-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                <div className="text-[10.5px] font-bold mb-1">Homework / assignment pack</div>
                <label className="flex items-center gap-2 text-[11px] mb-1.5 cursor-pointer">
                  <input type="checkbox" checked={hideAnswers} onChange={(e) => setHideAnswers(e.target.checked)} />
                  Hide all answers (board-work mode), applies inside the beam lab too
                </label>
                <input
                  value={assignment}
                  onChange={(e) => setAssignment(e.target.value)}
                  placeholder="e.g. Find the max BM and the section of contraflexure"
                  className="w-full rounded-lg px-2 py-1.5 text-[11.5px]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)' }}
                />
                <div className="mt-1.5 flex gap-1.5">
                  <Btn
                    onClick={() => {
                      const txt = `Assignment: ${assignment || 'Solve the current beam'}\nBeam: L=${beam.length} m, E=${beam.E_GPa} GPa, I=${beam.I_cm4} cm4\nSupports: ${beam.supports.map((s) => `${s.label}@${s.x}m(${s.type})`).join(', ')}\nLoads: ${beam.loads.map((l) => `${l.type}${l.magnitude !== undefined ? ' ' + l.magnitude : ''}`).join(', ')}\n${hideAnswers ? '(Answers hidden in class build)' : `Answers: max|V|=${beamRes.maxAbsV.toFixed(2)} kN, max|M|=${beamRes.maxAbsM.toFixed(2)} kN.m, max deflection=${beamRes.maxAbsDeflectionMm.toFixed(2)} mm`}`;
                      navigator.clipboard?.writeText(txt).then(
                        () => toast('Assignment text copied.', 'ok'),
                        () => toast('Clipboard blocked.', 'warn')
                      );
                    }}
                  >
                    Copy assignment
                  </Btn>
                  <Btn onClick={() => goto('beam')}>Create in beam lab</Btn>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === 'myths' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {MYTHS.map((m, i) => (
            <Card key={i} title={<span className="flex items-start gap-1.5"><Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} /> {lang === 'hinglish' ? m.q : m.qEn}</span>}>
              <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {lang === 'hinglish' ? m.a : m.aEn}
              </p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'deploy' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
          <Card title="Host it on Vercel" sub="Free tier, no card, no backend">
            <ol className="text-[11.5px] space-y-1.5 list-decimal pl-4" style={{ color: 'var(--ink-2)' }}>
              <li>Push this project to a GitHub repository.</li>
              <li>In Vercel → <strong>Add New Project</strong> → import that repository (or drag this folder into the Vercel dashboard with the CLI: <code className="num">npx vercel</code>).</li>
              <li>Framework preset: Vite. Build command <code className="num">npm run build</code>, output <code className="num">dist</code>.</li>
              <li>Deploy. You get an <code className="num">https://your-app.vercel.app</code> link for students.</li>
              <li>Every later push redeploys automatically. No environment variables at all.</li>
              <li>Before you go live, run <code className="num">npm run build</code> locally once, it finishes in ~10 s and proves the static bundle is clean.</li>
            </ol>
            <div className="mt-2">
              <Hint>Included <code className="num">vercel.json</code> pins the build + SPA rewrite, so deep links work out of the box.</Hint>
            </div>
          </Card>
          <Card title="Host it on GitHub Pages" sub="Good option if the department already has a repo">
            <ol className="text-[11.5px] space-y-1.5 list-decimal pl-4" style={{ color: 'var(--ink-2)' }}>
              <li>Push to GitHub, branch <code className="num">main</code>.</li>
              <li>Repository → Settings → Pages → Source: <strong>GitHub Actions</strong>.</li>
              <li>The included workflow builds <code className="num">dist</code> and publishes it.</li>
              <li>Site lives at <code className="num">https://user.github.io/repo/</code>, relative asset paths make the sub-path work.</li>
            </ol>
            <div className="mt-2">
              <Hint>No backend, no database, no paid plan. Excel-free, install-free, works on a phone browser.</Hint>
            </div>
          </Card>
          <Card title="Sending one problem to the class" sub="The Share button does the job of a database">
            <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              Press <strong>Share</strong> in the header. The current beam, frame/truss, section and theme are packed into the URL hash. Paste that link in
              WhatsApp or Classroom: whoever opens it sees exactly your model and can keep editing. Nothing is uploaded anywhere.
            </p>
            <div className="mt-2">
              <Btn
                onClick={async () => {
                  const url = window.location.href;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast('Current state link copied.', 'ok');
                  } catch {
                    toast('Copy the link from the address bar.', 'info');
                  }
                }}
              >
                Copy current link
              </Btn>
            </div>
          </Card>
          <Card title="Offline / classroom PC" sub="No internet needed once loaded">
            <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              After the first load the app runs entirely from cached assets. Copy the <code className="num">dist</code> folder to a pen drive, open{' '}
              <code className="num">index.html</code> through a tiny static server, and project from any laptop, no login, no data plan.
            </p>
            <div className="mt-2">
              <Acc title="Which files should I never edit by hand?" sub="Answer: none of the maths">
                <div className="text-[11px] space-y-1" style={{ color: 'var(--ink-2)' }}>
                  <div><code className="num">src/engine/</code>, the solvers (beam FEM, ILD, 2D stiffness, section, buckling, torsion).</div>
                  <div><code className="num">src/modules/</code>, the seven teaching screens.</div>
                  <div><code className="num">public/favicon.svg</code>, the logo.</div>
                </div>
              </Acc>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
