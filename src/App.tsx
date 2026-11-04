import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeBeam, BeamModel } from './engine/beamEngine';
import { analyzeStructure2D, Structure2DModel } from './engine/frameTrussEngine';
import { analyzeCrossSection, SectionDimensions } from './engine/sectionMohrBucklingEngine';
import { findSection, NAMED_SECTIONS, analyticSection } from './engine/sectionLib';
import { AccentId, ActiveModule, decodeShareUrl, encodeShareUrl, ExplainLang, ThemeMode, ShareableAppState } from './types/appTypes';
import { AnalysisContext, AnalysisCtx, BeamHandoff } from './ui/AnalysisContext';
import { Shell } from './ui/Shell';
import { BeamModule } from './modules/BeamModule';
import { StructureModule } from './modules/StructureModule';
import { ILDModule } from './modules/ILDModule';
import { SectionModule } from './modules/SectionModule';
import { MohrModule } from './modules/MohrModule';
import { BucklingModule } from './modules/BucklingModule';
import { GuideModule } from './modules/GuideModule';
import { ConceptAtlasModule } from './modules/ConceptModule';
import { OverviewModule } from './modules/OverviewModule';
import { Inspector } from './modules/Inspector';
import { ShortcutsDialog } from './ui/ShortcutsDialog';
import { PickSel } from './ui/CanvasEditor';
import { Badge } from './ui/primitives';

/* ------------------------------------------------------------------ */
/*  First-load state: intentionally the simplest editable classroom    */
/*  starter, never a locked "example", press Blank to start empty.    */
/* ------------------------------------------------------------------ */

export const STARTER_BEAM: BeamModel = {
  length: 6,
  E_GPa: 200,
  I_cm4: 8000,
  supports: [
    { id: 'sA', x: 0, type: 'pin', label: 'A' },
    { id: 'sB', x: 6, type: 'roller', label: 'B' },
  ],
  hinges: [],
  loads: [{ id: 'l1', type: 'point', x: 3, magnitude: 40 }],
};

export const STARTER_STRUCT: Structure2DModel = {
  nameEn: 'Two-bay portal frame',
  nameHi: 'Do bay ka portal frame',
  mode: 'frame',
  nodes: [
    { id: 'n1', label: 'A', x: 0, y: 0, support: 'fixed' },
    { id: 'n2', label: 'B', x: 6, y: 0, support: 'fixed' },
    { id: 'n3', label: 'C', x: 0, y: 4, support: 'free', fy: -30 },
    { id: 'n4', label: 'D', x: 6, y: 4, support: 'free', fx: 20 },
  ],
  members: [
    { id: 'm1', label: 'M1', startNodeId: 'n1', endNodeId: 'n3', E_GPa: 200, A_cm2: 60, I_cm4: 12000 },
    { id: 'm2', label: 'M2', startNodeId: 'n3', endNodeId: 'n4', E_GPa: 200, A_cm2: 60, I_cm4: 12000, wPerp_kNm: 8 },
    { id: 'm3', label: 'M3', startNodeId: 'n4', endNodeId: 'n2', E_GPa: 200, A_cm2: 60, I_cm4: 12000 },
  ],
};

const LS_KEY = 'structvision.v2';

export default function App() {
  const shared = useMemo(() => decodeShareUrl(), []);
  const saved = useMemo(() => {
    try {
      return shared ? null : (JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') as ShareableAppState | null);
    } catch {
      return null;
    }
  }, [shared]);

  const [active, setActive] = useState<ActiveModule>(shared?.mod ?? saved?.mod ?? 'overview');
  const [lang, setLang] = useState<ExplainLang>(shared?.lang ?? saved?.lang ?? 'hinglish');
  const [theme, setTheme] = useState<ThemeMode>(shared?.theme ?? saved?.theme ?? 'light');
  const [accent, setAccent] = useState<AccentId>(shared?.accent ?? saved?.accent ?? 'blue');

  const [beam, setBeam] = useState<BeamModel>(shared?.beam ?? saved?.beam ?? STARTER_BEAM);
  const [struct, setStruct] = useState<Structure2DModel>(shared?.struct ?? saved?.struct ?? STARTER_STRUCT);
  const [fy_MPa, setFy_MPa] = useState<number>(250);
  const [sectionKey, setSectionKey] = useState<string>(shared?.section?.name ?? saved?.section?.name ?? 'ismb200');
  const [customDims, setCustomDims] = useState<SectionDimensions | null>(shared?.section?.dims ?? saved?.section?.dims ?? null);

  const [toSection, setToSection] = useState<BeamHandoff | null>(null);
  const [toMohr, setToMohr] = useState<{ sigmaX: number; tauXY: number; label: string } | null>(null);
  const [tool, setTool] = useState<'select' | 'node' | 'member' | 'erase'>('select');
  const [pick, setPick] = useState<PickSel>(null);
  const [ildResult, setIldResult] = useState<ReturnType<typeof import('./engine/ildEngine').computeILD> | null>(null);
  const [inspect, setInspect] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [atlasQuery, setAtlasQuery] = useState('');
  const [hideAnswers, setHideAnswers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; tone: 'ok' | 'warn' | 'info'; id: number } | null>(null);
  /** the keyboard handler is installed once; the ref keeps it pointed at the latest share closure */
  const onShareRef = useRef<(() => void) | null>(null);

  const toast = useCallback((msg: string, tone: 'ok' | 'warn' | 'info' = 'info') => {
    setToastMsg({ msg, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
  }, [accent]);

  // Every lab opens at its own top: switching module mid-page should never leave
  // the class staring at the middle of the next diagram.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [active]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast('Full-screen is blocked by this browser, try F11 instead.', 'warn');
    }
  }, [toast]);

  // Global teaching shortcuts. They stay out of the way of every input field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable);
      if (typing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === '?') {
        e.preventDefault();
        setShortcuts((s) => !s);
        return;
      }
      if (e.key === 'Escape') {
        setShortcuts(false);
        setInspect(false);
        return;
      }
      if (k === 'd') setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
      else if (k === 'h') setHideAnswers((v) => !v);
      else if (k === 'f') void toggleFullscreen();
      else if (k === 'b') setActive('beam');
      else if (k === 's') void onShareRef.current?.();
      else if (/^[0-8]$/.test(e.key)) {
        const map: ActiveModule[] = ['overview', 'beam', 'structure', 'ild', 'section', 'mohr', 'buckling', 'atlas', 'guide'];
        const mod = map[Number(e.key)];
        if (mod) setActive(mod);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen]);

  const beamRes = useMemo(() => analyzeBeam(beam), [beam]);
  const structRes = useMemo(() => analyzeStructure2D(struct), [struct]);
  const named = findSection(sectionKey);
  const dims = customDims ?? named.dims;
  const analytic = useMemo(() => analyticSection(dims), [dims]);
  const sectionRes = useMemo(
    () => analyzeCrossSection(dims, { M_kNm: 0, V_kN: 0, N_kN: 0, fy_MPa: named.fy_MPa }),
    [dims, named.fy_MPa]
  );

  // persist
  useEffect(() => {
    const state: ShareableAppState = {
      v: 2,
      mod: active,
      beam,
      struct,
      section: { name: sectionKey, dims, E_GPa: named.E_GPa, fy_MPa: named.fy_MPa },
      lang,
      theme,
      accent,
    };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* storage may be blocked, app still fully works */
    }
  }, [active, beam, struct, sectionKey, dims, named, lang, theme, accent]);

  const onShare = async () => {
    const url = encodeShareUrl({
      v: 2,
      mod: active,
      beam,
      struct,
      section: { name: sectionKey, dims, E_GPa: named.E_GPa, fy_MPa: named.fy_MPa },
      lang,
      theme,
      accent,
    });
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied, paste in WhatsApp / Classroom. It restores beam + frame + section + theme.', 'ok');
    } catch {
      toast('Link is in the address bar, copy it from there (clipboard blocked).', 'info');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  onShareRef.current = onShare;

  const resetWorkspace = () => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore blocked storage */
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setBeam(STARTER_BEAM);
    setStruct(STARTER_STRUCT);
    setSectionKey('ismb200');
    setCustomDims(null);
    setFy_MPa(250);
    setActive('overview');
    setHideAnswers(false);
    toast('Workspace reset to the classroom starter. Your link is unchanged.', 'ok');
  };

  const ctx: AnalysisCtx = {
    lang,
    theme,
    beam,
    setBeam,
    beamRes,
    struct,
    setStruct,
    structRes,
    toSection,
    setToSection,
    toMohr,
    setToMohr,
    sectionKey,
    setSectionKey: (k: string) => {
      setSectionKey(k);
      setCustomDims(null);
    },
    sectionDims: {
      E_GPa: named.E_GPa,
      A_cm2: analytic.area_mm2 / 100,
      I_cm4: analytic.Ixx_mm4 / 1e4,
      yMax_mm: dims.shape === 'circular' || dims.shape === 'hollow_circular' ? dims.outerDia_mm / 2 : dims.depth_mm / 2,
    },
    sectionGeometry: dims,
    fy_MPa,
    setFy_MPa,
    tool,
    setTool,
    pick,
    setPick,
    ildResult,
    setIldResult,
    hideAnswers,
    setHideAnswers,
    atlasQuery,
    setAtlasQuery,
    goto: (m: string) => setActive(m as ActiveModule),
    toast,
  };

  const statusNote = (
    <div className="flex items-center gap-1.5 ml-auto">
      {hideAnswers && <Badge tone="amber">answers hidden</Badge>}
      {!beamRes.isStable && active === 'beam' && <Badge tone="rose">beam mechanism</Badge>}
      {!structRes.isStable && active === 'structure' && <Badge tone="rose">structure unstable</Badge>}
      <Badge tone="green">live solve</Badge>
    </div>
  );

  return (
    <AnalysisContext.Provider value={ctx}>
      <Shell
        active={active}
        setActive={setActive}
        the={theme}
        setThe={setTheme}
        lang={lang}
        setLang={setLang}
        onShare={onShare}
        copied={copied}
        onInspector={() => setInspect(true)}
        onShortcuts={() => setShortcuts(true)}
        accent={accent}
        setAccent={setAccent}
        fullscreen={fullscreen}
        onFullscreen={() => void toggleFullscreen()}
        onReset={resetWorkspace}
        onPrint={() => window.print()}
        hideAnswers={hideAnswers}
        setHideAnswers={setHideAnswers}
        statusNote={statusNote}
      >
        <div key={active} className="module-enter">
        {active === 'overview' && <OverviewModule />}
        {active === 'beam' && <BeamModule />}
        {active === 'structure' && <StructureModule />}
        {active === 'ild' && <ILDModule />}
        {active === 'section' && (
          <SectionModule
            dims={dims}
            onDims={(d) => setCustomDims(d)}
            analytic={analytic}
            named={named}
            baseRes={sectionRes}
            fy={fy_MPa}
            onFy={setFy_MPa}
          />
        )}
        {active === 'mohr' && <MohrModule />}
        {active === 'buckling' && <BucklingModule />}
        {active === 'guide' && <GuideModule />}
        {active === 'atlas' && <ConceptAtlasModule />}
        </div>
      </Shell>

      <Inspector open={inspect} onClose={() => setInspect(false)} />
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />

      {toastMsg && (
        <div
          key={toastMsg.id}
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] max-w-[92vw] rounded-xl px-3 py-2 text-[11.5px] font-semibold shadow-lg pop no-print"
          style={{
            background: 'var(--surface)',
            border: `1px solid ${toastMsg.tone === 'ok' ? 'var(--ok)' : toastMsg.tone === 'warn' ? 'var(--warn)' : 'var(--accent)'}`,
            color: 'var(--ink)',
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
            style={{ background: toastMsg.tone === 'ok' ? 'var(--ok)' : toastMsg.tone === 'warn' ? 'var(--warn)' : 'var(--accent)' }}
          />
          {toastMsg.msg}
        </div>
      )}

      {/* hidden SEO / a11y label for the section list (keeps NAMED_SECTIONS referenced) */}
      <div className="sr-only" aria-hidden>
        {NAMED_SECTIONS.length} named sections available
      </div>
    </AnalysisContext.Provider>
  );
}
