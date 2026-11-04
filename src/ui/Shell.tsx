import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Truck,
  Network,
  Layers,
  Compass,
  Columns3,
  GitBranch,
  Share2,
  Sun,
  Moon,
  Languages,
  Check,
  Crosshair,
  Menu,
  X,
  GraduationCap,
  PenLine,
  Search,
  BookMarked,
  LayoutDashboard,
  Keyboard,
  Maximize2,
  Minimize2,
  Printer,
  RotateCcw,
  Settings2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ACCENT_PALETTES, AccentId, ActiveModule } from '../types/appTypes';
import { Logo, Badge } from './primitives';

export const MODULE_META: Array<{
  id: ActiveModule;
  n: number;
  label: string;
  short: string;
  icon: React.ReactNode;
  group: 'Studio' | 'Design' | 'Analyse' | 'Learn';
  color: string;
}> = [
  { id: 'overview', n: 0, label: 'Lecture Studio, run the whole class from one screen', short: 'Studio', icon: <LayoutDashboard className="w-[15px] h-[15px]" />, group: 'Studio', color: '#2563eb' },
  { id: 'beam', n: 1, label: 'Beam: SFD / BMD', short: 'Beam', icon: <Activity className="w-[15px] h-[15px]" />, group: 'Design', color: '#2563eb' },
  { id: 'structure', n: 2, label: 'Frame & Truss: 2D analysis', short: 'Frame', icon: <Network className="w-[15px] h-[15px]" />, group: 'Design', color: '#0d9488' },
  { id: 'ild', n: 3, label: 'Moving Loads: influence lines', short: 'ILD', icon: <Truck className="w-[15px] h-[15px]" />, group: 'Analyse', color: '#d97706' },
  { id: 'section', n: 4, label: 'Section Fibres: stress and shear', short: 'Section', icon: <Layers className="w-[15px] h-[15px]" />, group: 'Analyse', color: '#7c3aed' },
  { id: 'mohr', n: 5, label: "Mohr's Circle: stress on any plane", short: 'Mohr', icon: <Compass className="w-[15px] h-[15px]" />, group: 'Analyse', color: '#be123c' },
  { id: 'buckling', n: 6, label: 'Columns & Shafts: buckling and torsion', short: 'Column', icon: <Columns3 className="w-[15px] h-[15px]" />, group: 'Analyse', color: '#0369a1' },
  { id: 'atlas', n: 7, label: 'Concept Atlas: explain any doubt', short: 'Atlas', icon: <BookMarked className="w-[15px] h-[15px]" />, group: 'Learn', color: '#7c3aed' },
  { id: 'guide', n: 8, label: 'Lecture Kit: script and guide', short: 'Guide', icon: <GitBranch className="w-[15px] h-[15px]" />, group: 'Learn', color: '#475569' },
];

interface ShellProps {
  active: ActiveModule;
  setActive: (m: ActiveModule) => void;
  the: 'light' | 'dark';
  setThe: (t: 'light' | 'dark') => void;
  lang: 'hinglish' | 'english';
  setLang: (l: 'hinglish' | 'english') => void;
  onShare: () => void;
  copied: boolean;
  onInspector: () => void;
  onShortcuts: () => void;
  accent: AccentId;
  setAccent: (a: AccentId) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  onReset: () => void;
  onPrint: () => void;
  hideAnswers: boolean;
  setHideAnswers: (v: boolean) => void;
  children: React.ReactNode;
  statusNote?: React.ReactNode;
}

const ShellButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string }> = ({ title, children, className = '', ...rest }) => (
  <button
    title={title}
    aria-label={title}
    className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${className}`}
    style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)', color: 'var(--ink-2)' }}
    {...rest}
  >
    {children}
  </button>
);

export const Shell: React.FC<ShellProps> = ({
  active,
  setActive,
  the,
  setThe,
  lang,
  setLang,
  onShare,
  copied,
  onInspector,
  onShortcuts,
  accent,
  setAccent,
  fullscreen,
  onFullscreen,
  onReset,
  onPrint,
  hideAnswers,
  setHideAnswers,
  children,
  statusNote,
}) => {
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDrawer(false), [active]);

  useEffect(() => {
    if (!settings) return;
    const onDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettings(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettings(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [settings]);

  const current = MODULE_META.find((m) => m.id === active)!;

  const AccentPicker = ({ compact = false }: { compact?: boolean }) => (
    <div className={compact ? 'flex gap-1.5' : 'grid grid-cols-5 gap-1.5'}>
      {ACCENT_PALETTES.map((p) => (
        <button
          key={p.id}
          onClick={() => setAccent(p.id)}
          title={p.label}
          aria-label={p.label}
          className="relative rounded-lg grid place-items-center transition-transform hover:scale-105"
          style={{
            width: compact ? 26 : '100%',
            height: compact ? 26 : 30,
            background: p.hex,
            border: `2px solid ${accent === p.id ? 'var(--ink)' : 'transparent'}`,
            boxShadow: accent === p.id ? '0 0 0 2px var(--surface) inset' : 'none',
          }}
        >
          {accent === p.id && <Check className="w-3.5 h-3.5 text-white" />}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--app)' }}>
      <header
        className="sticky top-0 z-40 no-print"
        style={{ background: 'color-mix(in srgb, var(--surface) 94%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}
      >
        <div className="mx-auto w-full max-w-[1600px] px-2.5 sm:px-4">
          <div className="flex items-center gap-2 py-2">
            {/* menu (mobile) */}
            <button
              onClick={() => setDrawer(true)}
              className="lg:hidden w-8 h-8 rounded-lg grid place-items-center shrink-0"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
              aria-label="Open modules"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button onClick={() => setActive('overview')} className="flex items-center gap-2 min-w-0 text-left" title="Back to the studio overview">
              <Logo size={32} />
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14.5px] font-extrabold tracking-tight truncate">StructVision</span>
                  <span className="hidden sm:inline">
                    <Badge tone="blue">SOM · STRUCTURES</Badge>
                  </span>
                </div>
                <div className="text-[10px] truncate hidden 2xl:block" style={{ color: 'var(--ink-3)' }}>
                  A teaching studio for mechanics, everything solves in your browser
                </div>
              </div>
            </button>

            {/* desktop module tabs */}
            <nav className="hidden lg:flex items-center gap-0.5 ml-2 flex-1 min-w-0 overflow-x-auto scroll-x">
              {MODULE_META.map((m) => {
                const on = m.id === active;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActive(m.id)}
                    className="flex shrink-0 items-center gap-1 px-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap"
                    style={{
                      background: on ? 'var(--accent-soft)' : 'transparent',
                      color: on ? 'var(--accent)' : 'var(--ink-2)',
                      border: `1px solid ${on ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'transparent'}`,
                    }}
                    title={m.label}
                  >
                    <span style={{ color: on ? 'var(--accent)' : 'var(--ink-3)' }}>{m.icon}</span>
                    <span className="hidden 2xl:inline num text-[10px] opacity-60">{m.n}</span>
                    <span className="hidden xl:inline">{m.short}</span>
                  </button>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setHideAnswers(!hideAnswers)}
                className="hidden sm:flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors"
                style={{
                  background: hideAnswers ? 'color-mix(in srgb, var(--warn) 14%, var(--surface))' : 'var(--surface-2)',
                  border: `1px solid ${hideAnswers ? 'color-mix(in srgb, var(--warn) 40%, transparent)' : 'var(--line-strong)'}`,
                  color: hideAnswers ? 'var(--warn)' : 'var(--ink-2)',
                }}
                title={hideAnswers ? 'Show every printed answer (H)' : 'Hide every printed answer for board work (H)'}
              >
                {hideAnswers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden 2xl:inline">{hideAnswers ? 'Answers off' : 'Answers on'}</span>
              </button>
              <button
                onClick={onInspector}
                className="hidden md:flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)', color: 'var(--ink-2)' }}
                title="Open the live section inspector (M, V, N at any cut)"
              >
                <Crosshair className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                <span className="hidden 2xl:inline">Inspector</span>
              </button>
              <button
                onClick={onFullscreen}
                className="hidden sm:grid w-8 h-8 rounded-lg place-items-center"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)', color: 'var(--ink-2)' }}
                title={fullscreen ? 'Leave presentation mode (F)' : 'Present full-screen (F)'}
              >
                {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setLang(lang === 'hinglish' ? 'english' : 'hinglish')}
                className="hidden xl:flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)', color: 'var(--ink-2)' }}
                title="Switch explanation language"
              >
                <Languages className="w-3.5 h-3.5" style={{ color: 'var(--warn)' }} />
                <span className="hidden 2xl:inline">{lang === 'hinglish' ? 'Hinglish' : 'English'}</span>
              </button>
              <ShellButton title={the === 'dark' ? 'Switch to projector light theme (D)' : 'Switch to dark theme (D)'} onClick={() => setThe(the === 'dark' ? 'light' : 'dark')}>
                {the === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </ShellButton>

              <div className="relative" ref={settingsRef}>
                <ShellButton title="Workspace settings" onClick={() => setSettings((s) => !s)}>
                  <Settings2 className="w-3.5 h-3.5" />
                </ShellButton>
                {settings && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-[272px] rounded-xl p-2.5 pop z-50"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 16px 48px rgba(2,6,23,.22)' }}
                  >
                    <div className="text-[9.5px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: 'var(--ink-3)' }}>
                      Accent
                    </div>
                    <AccentPicker />
                    <div className="text-[9.5px] font-extrabold uppercase tracking-widest mt-3 mb-1" style={{ color: 'var(--ink-3)' }}>
                      Classroom
                    </div>
                    <button onClick={() => { onShortcuts(); setSettings(false); }} className="settings-row">
                      <Keyboard className="w-3.5 h-3.5" /> Keyboard shortcuts <span className="ml-auto num text-[9px]" style={{ color: 'var(--ink-3)' }}>?</span>
                    </button>
                    <button onClick={() => { onFullscreen(); setSettings(false); }} className="settings-row">
                      {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />} {fullscreen ? 'Leave full-screen' : 'Present full-screen'}
                      <span className="ml-auto num text-[9px]" style={{ color: 'var(--ink-3)' }}>F</span>
                    </button>
                    <button onClick={() => { onPrint(); setSettings(false); }} className="settings-row">
                      <Printer className="w-3.5 h-3.5" /> Print this lab <span className="ml-auto num text-[9px]" style={{ color: 'var(--ink-3)' }}>Ctrl P</span>
                    </button>
                    <div className="h-px my-1.5" style={{ background: 'var(--line)' }} />
                    <button onClick={() => { onReset(); setSettings(false); }} className="settings-row" style={{ color: 'var(--compression)' }}>
                      <RotateCcw className="w-3.5 h-3.5" /> Reset workspace
                    </button>
                    <div className="text-[9.5px] leading-snug mt-1.5 px-1" style={{ color: 'var(--ink-3)' }}>
                      Reset restores the starter model only. Share links are untouched.
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={onShare}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white transition-transform active:scale-95"
                style={{ background: 'var(--accent)' }}
                title="Copy a link that restores this problem (S)"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{copied ? 'Copied' : 'Share'}</span>
              </button>
            </div>
          </div>

          {/* mobile module pill bar */}
          <div className="lg:hidden relative">
            <div className="flex gap-1 overflow-x-auto pb-2 -mx-0.5 px-0.5 scroll-x">
              {MODULE_META.map((m) => {
                const on = m.id === active;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActive(m.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-bold whitespace-nowrap shrink-0"
                    style={{
                      background: on ? 'var(--accent)' : 'var(--surface-2)',
                      color: on ? '#fff' : 'var(--ink-2)',
                      border: `1px solid ${on ? 'transparent' : 'var(--line)'}`,
                    }}
                  >
                    {m.icon}
                    {m.short}
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none absolute right-0 top-0 h-full w-8" style={{ background: 'linear-gradient(to right, transparent, var(--surface))' }} />
          </div>
        </div>
      </header>

      {/* drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/45" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[330px] p-3 overflow-y-auto fade-in" style={{ background: 'var(--surface)', borderRight: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Logo size={28} />
                <div className="leading-tight">
                  <div className="text-[13px] font-extrabold">StructVision</div>
                  <div className="text-[10px]" style={{ color: 'var(--ink-3)' }}>SOM · Structural Analysis</div>
                </div>
              </div>
              <button onClick={() => setDrawer(false)} className="w-7 h-7 grid place-items-center rounded-lg" style={{ border: '1px solid var(--line)' }} aria-label="Close menu">
                <X className="w-4 h-4" />
              </button>
            </div>
            {(['Studio', 'Design', 'Analyse', 'Learn'] as const).map((grp) => (
              <div key={grp} className="mb-3">
                <div className="text-[9.5px] font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--ink-3)' }}>
                  {grp === 'Studio' ? '0 · Lecture studio' : grp === 'Design' ? '1 · Build & visualise' : grp === 'Analyse' ? '2 · Check & explain' : '3 · Teach'}
                </div>
                {MODULE_META.filter((m) => m.group === grp).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActive(m.id)}
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-2 mb-1 text-left"
                    style={{
                      background: active === m.id ? 'var(--accent-soft)' : 'var(--surface-2)',
                      border: `1px solid ${active === m.id ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'var(--line)'}`,
                    }}
                  >
                    <span style={{ color: m.color }}>{m.icon}</span>
                    <span className="text-[12px] font-bold">{m.label}</span>
                    <span className="ml-auto num text-[10px]" style={{ color: 'var(--ink-3)' }}>0{m.n}</span>
                  </button>
                ))}
              </div>
            ))}

            <div className="text-[9.5px] font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--ink-3)' }}>Accent</div>
            <div className="mb-2"><AccentPicker compact /></div>

            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setLang(lang === 'hinglish' ? 'english' : 'hinglish')} className="drawer-btn">
                <Languages className="w-3.5 h-3.5" /> {lang === 'hinglish' ? 'Hinglish' : 'English'}
              </button>
              <button onClick={() => setThe(the === 'dark' ? 'light' : 'dark')} className="drawer-btn">
                {the === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {the === 'dark' ? 'Light' : 'Dark'}
              </button>
              <button onClick={() => { setDrawer(false); onInspector(); }} className="drawer-btn">
                <Crosshair className="w-3.5 h-3.5" /> Inspector
              </button>
              <button onClick={() => { setDrawer(false); onFullscreen(); }} className="drawer-btn">
                <Maximize2 className="w-3.5 h-3.5" /> Present
              </button>
              <button onClick={() => { setDrawer(false); onShortcuts(); }} className="drawer-btn">
                <Keyboard className="w-3.5 h-3.5" /> Shortcuts
              </button>
              <button onClick={() => { setDrawer(false); onPrint(); }} className="drawer-btn">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
            <button onClick={() => { setDrawer(false); onReset(); }} className="drawer-btn w-full mt-1.5" style={{ color: 'var(--compression)' }}>
              <RotateCcw className="w-3.5 h-3.5" /> Reset workspace
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full">
        <div className="mx-auto w-full max-w-[1600px] px-2.5 sm:px-4 py-3 sm:py-4">
          {/* context strip */}
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--ink-3)' }}>
              {current.group === 'Studio' ? <LayoutDashboard className="w-3.5 h-3.5" /> : current.group === 'Design' ? <PenLine className="w-3.5 h-3.5" /> : current.group === 'Analyse' ? <Search className="w-3.5 h-3.5" /> : <GraduationCap className="w-3.5 h-3.5" />}
              {current.group === 'Studio' ? 'Lecture studio' : `Module ${current.n} · ${current.group}`}
            </span>
            <span className="text-[12.5px] font-bold">{current.label}</span>
            {statusNote}
          </div>
          {children}
        </div>
      </main>

      <footer className="no-print border-t mt-4" style={{ borderColor: 'var(--line)' }}>
        <div className="mx-auto max-w-[1600px] px-3 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] num" style={{ color: 'var(--ink-3)' }}>
          <span>
            <strong style={{ color: 'var(--ink-2)' }}>StructVision</strong>, every number is computed live in your browser from the same
            equilibrium and stiffness equations written out on screen. Nothing is looked up, nothing is stored online.
          </span>
          <span className="flex items-center gap-2">
            <span>kN · m · MPa · mm</span>
            <span className="opacity-50">|</span>
            <span>V+ up-left, M+ sagging, N+ tension</span>
            <span className="opacity-50 hidden sm:inline">|</span>
            <button onClick={onShortcuts} className="hidden sm:inline-flex items-center gap-1 font-bold" style={{ color: 'var(--ink-2)' }} title="Keyboard shortcuts">
              <Keyboard className="w-3 h-3" /> press ?
            </button>
          </span>
        </div>
      </footer>
    </div>
  );
};
