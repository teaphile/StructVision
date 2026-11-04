import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Info, Minus, Plus, RotateCcw } from 'lucide-react';
import { useAnalysis } from './AnalysisContext';

/* ------------------------------------------------------------------ */
/*  0.  Number helpers                                                */
/* ------------------------------------------------------------------ */

export function fmt(v: number | undefined | null, digits = 2): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return 'n/a';
  const av = Math.abs(v);
  if (av !== 0 && av < 0.01) return v.toExponential(1);
  const s = v.toFixed(digits);
  return s === '-0.00' || s === '-0' ? (0).toFixed(digits) : s;
}

export function fmtSmart(v: number): string {
  const av = Math.abs(v);
  if (av === 0) return '0';
  if (av >= 10000) return v.toExponential(2);
  if (av >= 100) return v.toFixed(1);
  return v.toFixed(2);
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const uid = () => Math.random().toString(36).slice(2, 8);

/* ------------------------------------------------------------------ */
/*  1.  Logo                                                          */
/* ------------------------------------------------------------------ */

export const Logo: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
    <defs>
      <linearGradient id="lgA" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#0ea5e9" />
      </linearGradient>
      <linearGradient id="lgB" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#0d9488" />
        <stop offset="100%" stopColor="#22c55e" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#lgA)" opacity="0.13" />
    <rect x="1" y="1" width="38" height="38" rx="11" fill="none" stroke="url(#lgA)" strokeWidth="1.6" />
    {/* portal frame in perspective */}
    <path d="M9 28 V14 L20 8 L31 14 V28" fill="none" stroke="url(#lgB)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 28 L31 28" stroke="url(#lgA)" strokeWidth="2.4" strokeLinecap="round" />
    {/* moment hook arrow */}
    <path d="M24.5 18.5 a4 4 0 1 1 -3.2 -3.4" fill="none" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M21.6 13.6 l-0.9 2.4 l2.5 0.3" fill="none" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="20" cy="22.4" r="1.5" fill="url(#lgB)" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  2.  Container primitives                                          */
/* ------------------------------------------------------------------ */

export const Card: React.FC<{
  title?: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}> = ({ title, sub, right, children, className = '', pad = true }) => (
  <section className={`card ${className}`}>
    {(title || right) && (
      <header
        className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-3 py-2.5 sm:px-4 sm:py-3 border-b"
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="min-w-[150px] flex-1">
          {title && <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>}
          {sub && (
            <p className="hidden xs:block text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-3)' }}>
              {sub}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>
    )}
    <div className={pad ? 'p-3 sm:p-4' : ''}>{children}</div>
  </section>
);

export const Segmented = <T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  full = false,
  wrap = false,
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode; title?: string }>;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  full?: boolean;
  wrap?: boolean;
}) => (
  <div
    className={`${wrap ? 'flex flex-wrap max-w-full' : 'inline-flex'} rounded-lg p-0.5 gap-0.5`}
    style={{
      background: 'var(--surface-3)',
      border: '1px solid var(--line)',
      width: full ? '100%' : undefined,
    }}
  >
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`rounded-[7px] font-semibold transition-colors ${size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[11.5px]'}`}
          style={{
            flex: full ? 1 : undefined,
            background: active ? 'var(--surface)' : 'transparent',
            color: active ? 'var(--accent)' : 'var(--ink-2)',
            boxShadow: active ? '0 1px 2px rgba(15,23,42,.12)' : 'none',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

export const Btn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost' | 'soft' | 'danger';
    size?: 'sm' | 'md';
    icon?: React.ReactNode;
  }
> = ({ variant = 'soft', size = 'sm', icon, children, className = '', ...rest }) => {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors active:translate-y-px disabled:opacity-40 disabled:pointer-events-none';
  const sizes = size === 'sm' ? 'px-2.5 py-1.5 text-[11.5px]' : 'px-3.5 py-2 text-[12.5px]';
  const style: React.CSSProperties =
    variant === 'primary'
      ? { background: 'var(--accent)', color: '#fff', border: '1px solid transparent' }
      : variant === 'danger'
        ? { background: 'transparent', color: 'var(--compression)', border: '1px solid var(--line-strong)' }
        : variant === 'ghost'
          ? { background: 'transparent', color: 'var(--ink-2)', border: '1px solid transparent' }
          : { background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--line-strong)' };
  return (
    <button className={`${base} ${sizes} ${className}`} style={style} {...rest}>
      {icon}
      {children}
    </button>
  );
};

export const IconBtn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string }
> = ({ title, children, className = '', ...rest }) => (
  <button
    title={title}
    aria-label={title}
    className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${className}`}
    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
    {...rest}
  >
    {children}
  </button>
);

export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: 'neutral' | 'blue' | 'teal' | 'rose' | 'amber' | 'green';
  className?: string;
}> = ({ children, tone = 'neutral', className = '' }) => {
  const map: Record<string, string> = {
    neutral: 'var(--ink-3)',
    blue: 'var(--accent)',
    teal: 'var(--sagging)',
    rose: 'var(--hogging)',
    amber: 'var(--warn)',
    green: 'var(--ok)',
  };
  const c = map[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold leading-none num ${className}`}
      style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 32%, transparent)` }}
    >
      {children}
    </span>
  );
};

export const Field: React.FC<{ label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode }> = ({
  label,
  children,
  hint,
}) => (
  <label className="block">
    <span className="block text-[10.5px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-3)' }}>
      {label}
    </span>
    {children}
    {hint && (
      <span className="block text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--ink-3)' }}>
        {hint}
      </span>
    )}
  </label>
);

export const NumInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  className?: string;
  compact?: boolean;
}> = ({ value, onChange, step = 1, min, max, suffix, className = '', compact }) => (
  <div
    className={`flex items-center rounded-lg overflow-hidden ${className}`}
    style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)' }}
  >
    <input
      type="number"
      className={`num w-full bg-transparent outline-none ${compact ? 'px-1.5 py-1 text-[11.5px]' : 'px-2 py-1.5 text-[12px]'}`}
      value={Number.isFinite(value) ? value : 0}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      onFocus={(e) => e.currentTarget.select()}
    />
    {suffix && (
      <span className="pr-2 pl-0.5 text-[10px] font-semibold shrink-0 num" style={{ color: 'var(--ink-3)' }}>
        {suffix}
      </span>
    )}
  </div>
);

export const Slider: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: React.ReactNode;
  suffix?: string;
  onCommit?: () => void;
}> = ({ value, onChange, min, max, step = 0.1, label, suffix, onCommit }) => (
  <div>
    {label && (
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
          {label}
        </span>
        <span className="num text-[11.5px] font-bold" style={{ color: 'var(--accent)' }}>
          {fmt(value, step < 0.1 ? 3 : 2)} {suffix}
        </span>
      </div>
    )}
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      onMouseUp={onCommit}
      onTouchEnd={onCommit}
    />
  </div>
);

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ checked, onChange, label, hint }) => (
  <button
    onClick={() => onChange(!checked)}
    className="flex items-center gap-2 text-left w-full"
    role="switch"
    aria-checked={checked}
  >
    <span
      className="relative shrink-0 rounded-full transition-colors"
      style={{ width: 32, height: 18, background: checked ? 'var(--accent)' : 'var(--line-strong)' }}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white transition-all"
        style={{ width: 14, height: 14, left: checked ? 16 : 2 }}
      />
    </span>
    <span className="min-w-0">
      <span className="block text-[12px] font-semibold leading-tight">{label}</span>
      {hint && (
        <span className="block text-[10px] leading-snug" style={{ color: 'var(--ink-3)' }}>
          {hint}
        </span>
      )}
    </span>
  </button>
);

export const Stat: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  tone?: 'neutral' | 'accent' | 'ok' | 'bad' | 'warn';
  title?: string;
  /** / hide the number when the class is working it out by hand (default true) */
  mask?: boolean;
}> = ({ label, value, unit, tone = 'neutral', title, mask = true }) => {
  const { hideAnswers } = useAnalysis();
  const c =
    tone === 'accent' ? 'var(--accent)' : tone === 'ok' ? 'var(--ok)' : tone === 'bad' ? 'var(--compression)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink)';
  return (
    <div
      className="rounded-xl px-2 py-1.5 min-w-0"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
      title={title}
    >
      <div className="text-[9.5px] font-semibold tracking-wide truncate" style={{ color: 'var(--ink-3)' }}>
        {label}
      </div>
      <div className="num text-[14px] sm:text-[15px] font-extrabold leading-tight truncate" style={{ color: c }}>
        {mask && hideAnswers ? <span style={{ color: 'var(--warn)' }}>•••</span> : value}
        {unit && <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--ink-3)' }}>{unit}</span>}
      </div>
    </div>
  );
};

export const Hint: React.FC<{ children: React.ReactNode; tone?: 'info' | 'warn' }> = ({ children, tone = 'info' }) => (
  <div
    className="flex gap-2 rounded-xl p-2.5 text-[11.5px] leading-relaxed"
    style={{
      background: tone === 'warn' ? 'color-mix(in srgb, var(--warn) 10%, var(--surface))' : 'var(--surface-2)',
      border: `1px solid ${tone === 'warn' ? 'color-mix(in srgb, var(--warn) 34%, transparent)' : 'var(--line)'}`,
      color: 'var(--ink-2)',
    }}
  >
    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: tone === 'warn' ? 'var(--warn)' : 'var(--accent)' }} />
    <div>{children}</div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  3.  Accordion / collapsible advanced settings                      */
/* ------------------------------------------------------------------ */

export const Acc: React.FC<{
  title: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
}> = ({ title, sub, children, defaultOpen = false, right }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left"
        style={{ background: open ? 'var(--surface-2)' : 'transparent' }}
      >
        <span className="min-w-0">
          <span className="block text-[11.5px] font-bold">{title}</span>
          {sub && <span className="block text-[10px]" style={{ color: 'var(--ink-3)' }}>{sub}</span>}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {right}
          <span className="text-[10px] font-bold" style={{ color: 'var(--ink-3)' }}>{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && <div className="p-2.5 space-y-2.5 fade-in" style={{ borderTop: '1px solid var(--line)' }}>{children}</div>}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  4.  Zoomable SVG stage                                            */
/* ------------------------------------------------------------------ */

export const SvgStage: React.FC<{
  vbW: number;
  vbH: number;
  children: React.ReactNode;
  className?: string;
  maxH?: number;
  label?: React.ReactNode;
  allowZoom?: boolean;
}> = ({ vbW, vbH, children, className = '', maxH = 460, label, allowZoom = true }) => {
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const vb = useMemo(() => {
    const w = vbW / zoom;
    const h = vbH / zoom;
    return `${(vbW - w) / 2} ${(vbH - h) / 2} ${w} ${h}`;
  }, [vbW, vbH, zoom]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clamp(z - Math.sign(e.deltaY) * 0.12, 1, 3));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className={`relative rounded-xl overflow-hidden blueprint ${className}`} style={{ border: '1px solid var(--line)' }}>
      <svg
        ref={wrapRef as unknown as React.RefObject<SVGSVGElement>}
        viewBox={vb}
        className="w-full block"
        style={{ maxHeight: maxH, touchAction: 'manipulation' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {children}
      </svg>
      {label && (
        <div
          className="absolute top-1.5 left-2 text-[9.5px] font-bold uppercase tracking-wider pointer-events-none"
          style={{ color: 'var(--ink-3)' }}
        >
          {label}
        </div>
      )}
      {allowZoom && (
        <div className="absolute top-1 right-1 flex gap-1 no-print">
          <IconBtn
            title="Zoom in"
            className="!w-6 !h-6"
            onClick={() => setZoom((z) => clamp(z + 0.25, 1, 3))}
          >
            <Plus className="w-3 h-3" />
          </IconBtn>
          <IconBtn title="Zoom out" className="!w-6 !h-6" onClick={() => setZoom((z) => clamp(z - 0.25, 1, 3))}>
            <Minus className="w-3 h-3" />
          </IconBtn>
          {zoom !== 1 && (
            <IconBtn title="Reset zoom" className="!w-6 !h-6" onClick={() => setZoom(1)}>
              <RotateCcw className="w-3 h-3" />
            </IconBtn>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  5.  Tutorial stepper (assignments / lecture script)                */
/* ------------------------------------------------------------------ */

export const StepBar: React.FC<{
  steps: string[];
  step: number;
  onJump?: (i: number) => void;
  progress?: number;
}> = ({ steps, step, onJump, progress }) => (
  <div>
    <div className="flex items-center gap-1 scroll-x pb-0.5">
      {steps.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <React.Fragment key={i}>
            <button
              onClick={() => onJump?.(i)}
              className="shrink-0 flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-bold transition-colors"
              style={{
                background: active ? 'var(--accent)' : done ? 'var(--accent-soft)' : 'var(--surface-3)',
                color: active ? '#fff' : done ? 'var(--accent)' : 'var(--ink-3)',
                border: `1px solid ${active || done ? 'transparent' : 'var(--line)'}`,
              }}
            >
              <span className="num">{i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < steps.length - 1 && (
              <span className="w-2 h-px shrink-0" style={{ background: 'var(--line-strong)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
    {progress !== undefined && (
      <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--surface-3)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${clamp(progress, 0, 1) * 100}%`, background: 'var(--accent)' }} />
      </div>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/*  6.  Simple CSS bar chart (responsive, no dependency)               */
/* ------------------------------------------------------------------ */

export const BarChart: React.FC<{
  data: Array<{ label: string; value: number; tone?: string }>;
  unit?: string;
  height?: number;
  signed?: boolean;
}> = ({ data, unit, height = 120, signed = false }) => {
  const max = Math.max(1e-9, ...data.map((d) => Math.abs(d.value)));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / max) * (height - 26);
        const neg = signed && d.value < 0;
        return (
          <div key={i} className="flex-1 min-w-0 flex flex-col justify-end items-center gap-1">
            <span className="num text-[9.5px] font-bold truncate max-w-full" style={{ color: 'var(--ink-2)' }}>
              {fmtSmart(d.value)}
            </span>
            <div
              className="w-full rounded-t-[3px] rounded-b-[3px] transition-all"
              style={{
                height: Math.max(2, h),
                background: neg ? 'var(--compression)' : d.tone ?? 'var(--accent)',
                opacity: 0.85,
              }}
            />
            <span className="text-[9px] font-semibold truncate max-w-full" style={{ color: 'var(--ink-3)' }}>
              {d.label}
            </span>
          </div>
        );
      })}
      {unit && <span className="sr-only">{unit}</span>}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  7.  Wide diagram wrapper, keeps SVG text legible on phones        */
/* ------------------------------------------------------------------ */

export const Wide: React.FC<{ min: number; children: React.ReactNode; className?: string }> = ({
  min,
  children,
  className = '',
}) => (
  <div className={`scroll-x ${className}`}>
    <div style={{ minWidth: min }}>{children}</div>
  </div>
);
