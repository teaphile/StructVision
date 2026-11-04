import { BeamModel } from '../engine/beamEngine';
import { Structure2DModel } from '../engine/frameTrussEngine';
import { SectionDimensions } from '../engine/sectionMohrBucklingEngine';

export type ActiveModule = 'overview' | 'beam' | 'structure' | 'ild' | 'section' | 'mohr' | 'buckling' | 'guide' | 'atlas';

export type ExplainLang = 'hinglish' | 'english';
export type ThemeMode = 'light' | 'dark';
export type AccentId = 'blue' | 'teal' | 'violet' | 'rose' | 'amber';

export const ACCENT_PALETTES: Array<{ id: AccentId; label: string; hex: string }> = [
  { id: 'blue', label: 'Lecture blue', hex: '#2563eb' },
  { id: 'teal', label: 'Lab teal', hex: '#0d9488' },
  { id: 'violet', label: 'Mohr violet', hex: '#7c3aed' },
  { id: 'rose', label: 'Alert rose', hex: '#be123c' },
  { id: 'amber', label: 'Site amber', hex: '#b45309' },
];

export interface TransferredSectionForces {
  M_kNm: number;
  V_kN: number;
  N_kN: number;
  sourceLabel: string;
}

export interface SectionModel {
  name: string;
  dims: SectionDimensions;
  E_GPa: number;
  fy_MPa: number;
}

export interface ClassAssignment {
  /** the board state is frozen; students solve it by hand first */
  frozen: boolean;
  /** model snapshot used by the lecture */
  beam: BeamModel;
  struct: Structure2DModel;
  title: string;
}

export interface ShareableAppState {
  v: 2;
  mod: ActiveModule;
  beam?: BeamModel;
  struct?: Structure2DModel;
  section?: SectionModel;
  lang?: ExplainLang;
  theme?: ThemeMode;
  accent?: AccentId;
  assignment?: { frozen: boolean; title: string };
}

/* ---------------- base64url helpers (unicode safe) ---------------- */

function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeShareUrl(state: ShareableAppState): string {
  try {
    const json = JSON.stringify(state);
    const encoded = toB64(json);
    const url = new URL(window.location.href);
    url.hash = `s=${encoded}`;
    return url.toString();
  } catch {
    return window.location.href;
  }
}

export function decodeShareUrl(): ShareableAppState | null {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#s=')) return null;
    const parsed = JSON.parse(fromB64(hash.slice(3))) as ShareableAppState;
    if (!parsed || typeof parsed.mod !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
