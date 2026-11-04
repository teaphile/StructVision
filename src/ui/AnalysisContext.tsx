import React, { createContext, useContext } from 'react';
import { BeamAnalysisResult, BeamModel } from '../engine/beamEngine';
import { Structure2DModel, Structure2DResult } from '../engine/frameTrussEngine';
import { ILDResult } from '../engine/ildEngine';
import { ExplainLang, ThemeMode } from '../types/appTypes';
import { SectionDimensions } from '../engine/sectionMohrBucklingEngine';
import { PickSel } from '../ui/CanvasEditor';

export interface BeamHandoff {
  M: number;
  V: number;
  N: number;
  x: number;
  source: string;
}

export interface AnalysisCtx {
  lang: ExplainLang;
  theme: ThemeMode;
  /** beam used by the ILD lab (single source of truth) */
  beam: BeamModel;
  setBeam: (b: BeamModel) => void;
  beamRes: BeamAnalysisResult;

  /** 2D structure massing / frame / truss */
  struct: Structure2DModel;
  setStruct: (m: Structure2DModel) => void;
  structRes: Structure2DResult;

  /** section forces handed into the fibre lab (M, V, N) */
  toSection: BeamHandoff | null;
  setToSection: (h: BeamHandoff | null) => void;

  /** stress-state handed into Mohr's circle */
  toMohr: { sigmaX: number; tauXY: number; label: string } | null;
  setToMohr: (m: { sigmaX: number; tauXY: number; label: string } | null) => void;

  /** section geometry shared by cross-section lab + column buckling */
  sectionKey: string;
  setSectionKey: (k: string) => void;
  sectionDims: { E_GPa: number; A_cm2: number; I_cm4: number; yMax_mm: number };
  /** full live geometry of the section being edited in module 4 */
  sectionGeometry: SectionDimensions;
  /** material yield used by the section lab (MPa) */
  fy_MPa: number;
  setFy_MPa: (v: number) => void;

  /** 2D canvas interaction */
  tool: 'select' | 'node' | 'member' | 'erase';
  setTool: (t: 'select' | 'node' | 'member' | 'erase') => void;
  pick: PickSel;
  setPick: (p: PickSel) => void;

  /** ILD lab state (shared with the section inspector) */
  ildResult: ILDResult | null;
  setIldResult: (r: ILDResult | null) => void;

  /** global "answers hidden" mode used for board work / assignments */
  hideAnswers: boolean;
  setHideAnswers: (v: boolean) => void;

  /** concept query handed from the overview search into the atlas */
  atlasQuery: string;
  setAtlasQuery: (q: string) => void;

  goto: (mod: string) => void;
  toast: (msg: string, tone?: 'ok' | 'warn' | 'info') => void;
}

export const AnalysisContext = createContext<AnalysisCtx | null>(null);

export function useAnalysis(): AnalysisCtx {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used inside AnalysisProvider');
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Presentation helpers shared across all modules                    */
/* ------------------------------------------------------------------ */

export type Verdict = { label: string; tone: 'ok' | 'warn' | 'bad'; note: string };

export function beamTheoryChecks(res: BeamAnalysisResult): Verdict[] {
  // real serviceability check on the analysed member: δmax ≤ L/300
  const spanM = res.points.length ? Math.max(...res.points.map((p) => p.x)) : 0;
  const limitMm = spanM > 0 ? (spanM * 1000) / 300 : 0;
  const defOk = limitMm > 0 ? res.maxAbsDeflectionMm <= limitMm : true;
  return [
    {
      label: 'Equilibrium',
      tone: res.isStable ? 'ok' : 'bad',
      note: res.isStable ? 'Reactions balance applied loads (see audit)' : 'Mechanism, add supports',
    },
    {
      label: '|V|max',
      tone: 'ok',
      note: `${Math.abs(res.maxAbsV).toFixed(1)} kN at shear peak`,
    },
    {
      label: '|M|max',
      tone: 'ok',
      note: `${Math.abs(res.maxAbsM).toFixed(1)} kN·m (${res.maxHoggingM < -1e-3 ? 'hogging present' : 'sagging only'})`,
    },
    {
      label: 'L/300 limit',
      tone: defOk ? 'ok' : 'warn',
      note: `δmax = ${res.maxAbsDeflectionMm.toFixed(1)} mm vs ${limitMm.toFixed(1)} mm allowance`,
    },
  ];
}

export function SectionNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] leading-relaxed rounded-lg p-2" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}>
      {children}
    </div>
  );
}
