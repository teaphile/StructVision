import { SectionDimensions } from './sectionMohrBucklingEngine';

/* ------------------------------------------------------------------ */
/*  Section library: named steel / concrete sections + analytic props  */
/* ------------------------------------------------------------------ */

export interface NamedSection {
  key: string;
  name: string;
  family: 'steel' | 'concrete' | 'timber' | 'built';
  note: string;
  dims: SectionDimensions;
  fy_MPa: number;
  E_GPa: number;
}

const base = (partial: Partial<SectionDimensions>): SectionDimensions => ({
  shape: 'rectangular',
  width_mm: 200,
  depth_mm: 300,
  flangeThick_mm: 12,
  webThick_mm: 8,
  outerDia_mm: 200,
  innerDia_mm: 0,
  ...partial,
});

export const NAMED_SECTIONS: NamedSection[] = [
  {
    key: 'ismb200',
    name: 'ISMB 200 (I-beam)',
    family: 'steel',
    note: 'Standard Indian rolled beam, strong axis bending, weak web shear.',
    dims: base({ shape: 'i_section', width_mm: 100, depth_mm: 200, flangeThick_mm: 10.8, webThick_mm: 5.7 }),
    fy_MPa: 250,
    E_GPa: 200,
  },
  {
    key: 'ismb300',
    name: 'ISMB 300 (I-beam)',
    family: 'steel',
    note: 'Deeper steel beam, much higher Ixx for the same steel grade.',
    dims: base({ shape: 'i_section', width_mm: 140, depth_mm: 300, flangeThick_mm: 13.1, webThick_mm: 7.7 }),
    fy_MPa: 250,
    E_GPa: 200,
  },
  {
    key: 'rcc230x450',
    name: 'RCC 230 × 450',
    family: 'concrete',
    note: 'Typical M25 reinforced concrete beam (cracked section ignored).',
    dims: base({ shape: 'rectangular', width_mm: 230, depth_mm: 450 }),
    fy_MPa: 25,
    E_GPa: 25,
  },
  {
    key: 'rcc300x600',
    name: 'RCC 300 × 600',
    family: 'concrete',
    note: 'Heavy RCC girder size.',
    dims: base({ shape: 'rectangular', width_mm: 300, depth_mm: 600 }),
    fy_MPa: 30,
    E_GPa: 27,
  },
  {
    key: 'tee',
    name: 'T-beam (flange top)',
    family: 'concrete',
    note: 'Centroid sits high in the flange, classic classroom example of an unsymmetric section.',
    dims: base({ shape: 't_section', width_mm: 300, depth_mm: 400, flangeThick_mm: 80, webThick_mm: 120 }),
    fy_MPa: 25,
    E_GPa: 25,
  },
  {
    key: 'box',
    name: 'Hollow box 300 × 300',
    family: 'steel',
    note: 'Torsion-friendly closed section, much larger J than an open I-beam.',
    dims: base({ shape: 'box_section', width_mm: 300, depth_mm: 300, flangeThick_mm: 12, webThick_mm: 12 }),
    fy_MPa: 250,
    E_GPa: 200,
  },
  {
    key: 'pipe',
    name: 'Steel pipe 200 / 160',
    family: 'steel',
    note: 'Axisymmetric, Ixx = Iyy, so buckling direction does not matter.',
    dims: base({ shape: 'hollow_circular', outerDia_mm: 200, innerDia_mm: 160 }),
    fy_MPa: 250,
    E_GPa: 200,
  },
  {
    key: 'solid_round',
    name: 'Solid round Ø150',
    family: 'steel',
    note: 'Used for shaft torsion and column buckling demos.',
    dims: base({ shape: 'circular', outerDia_mm: 150 }),
    fy_MPa: 250,
    E_GPa: 200,
  },
];

export function findSection(key: string): NamedSection {
  return NAMED_SECTIONS.find((s) => s.key === key) ?? NAMED_SECTIONS[0];
}

/* ------------------------------------------------------------------ */
/*  Exact (closed-form) section properties, independent verification  */
/* ------------------------------------------------------------------ */

export interface AnalyticSectionProps {
  area_mm2: number;
  Ixx_mm4: number;
  Iyy_mm4: number;
  yCentroid_mm: number; // from bottom
  Ztop_mm3: number;
  Zbot_mm3: number;
  rMin_mm: number;
  J_mm4: number;
  formulaNote: string;
}

export function analyticSection(d: SectionDimensions): AnalyticSectionProps {
  const b = d.width_mm;
  const h = d.depth_mm;
  switch (d.shape) {
    case 'rectangular': {
      const A = b * h;
      const I = (b * h ** 3) / 12;
      const Iyy = (h * b ** 3) / 12;
      return {
        area_mm2: A,
        Ixx_mm4: I,
        Iyy_mm4: Iyy,
        yCentroid_mm: h / 2,
        Ztop_mm3: I / (h / 2),
        Zbot_mm3: I / (h / 2),
        rMin_mm: Math.sqrt(Iyy / A),
        J_mm4: (b * h * (b * b + h * h)) / 12,
        formulaNote: `Ixx = b·h³/12 = ${b}×${h}³/12`,
      };
    }
    case 'i_section': {
      const tf = Math.min(d.flangeThick_mm, h * 0.45);
      const tw = Math.min(d.webThick_mm, b);
      const webH = h - 2 * tf;
      const A = 2 * b * tf + tw * webH;
      const Ixx = (b * h ** 3 - (b - tw) * webH ** 3) / 12;
      const Iyy = (2 * tf * b ** 3 + webH * tw ** 3) / 12;
      return {
        area_mm2: A,
        Ixx_mm4: Ixx,
        Iyy_mm4: Iyy,
        yCentroid_mm: h / 2,
        Ztop_mm3: Ixx / (h / 2),
        Zbot_mm3: Ixx / (h / 2),
        rMin_mm: Math.sqrt(Iyy / A),
        J_mm4: (2 * b * tf ** 3 + webH * tw ** 3) / 3,
        formulaNote: 'Ixx = [bf·h³ − (bf−tw)(h−2tf)³]/12 (parallel flanges)',
      };
    }
    case 't_section': {
      const tf = Math.min(d.flangeThick_mm, h * 0.6);
      const tw = Math.min(d.webThick_mm, b);
      const webH = h - tf;
      const Af = b * tf;
      const Aw = tw * webH;
      const A = Af + Aw;
      const ybar = (Af * (h - tf / 2) + Aw * (webH / 2)) / A;
      const Ixx =
        (b * tf ** 3) / 12 + Af * (h - tf / 2 - ybar) ** 2 + (tw * webH ** 3) / 12 + Aw * (webH / 2 - ybar) ** 2;
      const Iyy = (tf * b ** 3) / 12 + (webH * tw ** 3) / 12;
      return {
        area_mm2: A,
        Ixx_mm4: Ixx,
        Iyy_mm4: Iyy,
        yCentroid_mm: ybar,
        Ztop_mm3: Ixx / (h - ybar),
        Zbot_mm3: Ixx / ybar,
        rMin_mm: Math.sqrt(Iyy / A),
        J_mm4: (b * tf ** 3 + webH * tw ** 3) / 3,
        formulaNote: 'ȳ from bottom = [Af(h−tf/2) + Aw(h−tf)/2] / A',
      };
    }
    case 'box_section': {
      const tf = Math.min(d.flangeThick_mm, h * 0.45);
      const tw = Math.min(d.webThick_mm, b * 0.45);
      const bi = b - 2 * tw;
      const hi = h - 2 * tf;
      const A = b * h - bi * hi;
      const Ixx = (b * h ** 3 - bi * hi ** 3) / 12;
      const Iyy = (h * b ** 3 - hi * bi ** 3) / 12;
      const Am = (bi + tw) * (hi + tf);
      const s = 2 * (bi + hi) + 4 * Math.min(tw, tf);
      const J = (4 * Am ** 2) / (s / Math.min(tw, tf)) / Math.min(tw, tf) || (2 * b * h * tf * tw);
      return {
        area_mm2: A,
        Ixx_mm4: Ixx,
        Iyy_mm4: Iyy,
        yCentroid_mm: h / 2,
        Ztop_mm3: Ixx / (h / 2),
        Zbot_mm3: Ixx / (h / 2),
        rMin_mm: Math.sqrt(Iyy / A),
        J_mm4: Math.max(J, 0.01),
        formulaNote: 'Ixx = (b·h³ − bi·hi³)/12 ; J ≈ 4Am²/∮ds/t',
      };
    }
    case 'circular': {
      const D = d.outerDia_mm;
      const R = D / 2;
      const A = Math.PI * R * R;
      const I = (Math.PI * R ** 4) / 4;
      return {
        area_mm2: A,
        Ixx_mm4: I,
        Iyy_mm4: I,
        yCentroid_mm: R,
        Ztop_mm3: I / R,
        Zbot_mm3: I / R,
        rMin_mm: Math.sqrt(I / A),
        J_mm4: (Math.PI * R ** 4) / 2,
        formulaNote: 'Ixx = πD⁴/64 ; J = πD⁴/32',
      };
    }
    case 'hollow_circular': {
      const D = d.outerDia_mm;
      const di = Math.min(d.innerDia_mm, D * 0.94);
      const R = D / 2;
      const r = di / 2;
      const A = Math.PI * (R * R - r * r);
      const I = (Math.PI * (R ** 4 - r ** 4)) / 4;
      return {
        area_mm2: A,
        Ixx_mm4: I,
        Iyy_mm4: I,
        yCentroid_mm: R,
        Ztop_mm3: I / R,
        Zbot_mm3: I / R,
        rMin_mm: Math.sqrt(I / A),
        J_mm4: (Math.PI * (R ** 4 - r ** 4)) / 2,
        formulaNote: 'Ixx = π(D⁴−d⁴)/64 ; J = π(D⁴−d⁴)/32',
      };
    }
  }
}

export function dimsSummary(d: SectionDimensions): string {
  switch (d.shape) {
    case 'rectangular':
      return `${d.width_mm} × ${d.depth_mm} mm`;
    case 'i_section':
      return `bf ${d.width_mm} · h ${d.depth_mm} · tf ${d.flangeThick_mm} · tw ${d.webThick_mm}`;
    case 't_section':
      return `bf ${d.width_mm} · h ${d.depth_mm} · tf ${d.flangeThick_mm} · tw ${d.webThick_mm}`;
    case 'box_section':
      return `b ${d.width_mm} · h ${d.depth_mm} · tf ${d.flangeThick_mm} · tw ${d.webThick_mm}`;
    case 'circular':
      return `Ø ${d.outerDia_mm} mm (solid)`;
    case 'hollow_circular':
      return `Ø ${d.outerDia_mm} / ${d.innerDia_mm} mm`;
  }
}
