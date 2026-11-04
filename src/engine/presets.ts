import { BeamModel } from './beamEngine';
import { Structure2DModel } from './frameTrussEngine';

export interface BeamPreset {
  id: string;
  category: 'Determinate' | 'Indeterminate' | 'Special';
  nameEn: string;
  nameHi: string;
  tag: string;
  model: BeamModel;
}

export const BEAM_PRESETS: BeamPreset[] = [
  {
    id: 'ss_point_udl',
    category: 'Determinate',
    nameEn: 'Simply Supported (UDL + Point Load)',
    nameHi: 'Simply Supported (UDL + Point Load)',
    tag: 'Classic SOM',
    model: {
      length: 8,
      E_GPa: 200,
      I_cm4: 12000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 8, type: 'roller', label: 'B' },
      ],
      hinges: [],
      loads: [
        { id: 'l1', type: 'udl', xStart: 0, xEnd: 5, magnitude: 16 },
        { id: 'l2', type: 'point', x: 6, magnitude: 40 },
      ],
    },
  },
  {
    id: 'ss_center_point',
    category: 'Determinate',
    nameEn: 'Simply Supported, Central Point Load (PL/4)',
    nameHi: 'Simply Supported, Beech mein Point Load',
    tag: 'PL/4 Formula',
    model: {
      length: 6,
      E_GPa: 200,
      I_cm4: 8000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 6, type: 'roller', label: 'B' },
      ],
      hinges: [],
      loads: [{ id: 'l1', type: 'point', x: 3, magnitude: 40 }],
    },
  },
  {
    id: 'ss_triangular_uvl',
    category: 'Determinate',
    nameEn: 'Simply Supported, Triangular UVL (0 → w)',
    nameHi: 'Triangular Load UVL (Hydrostatic / Sand Load)',
    tag: 'Cubic BMD',
    model: {
      length: 6,
      E_GPa: 200,
      I_cm4: 8000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 6, type: 'roller', label: 'B' },
      ],
      hinges: [],
      loads: [{ id: 'l1', type: 'uvl', xStart: 0, xEnd: 6, wStart: 0, wEnd: 30 }],
    },
  },
  {
    id: 'double_overhang',
    category: 'Determinate',
    nameEn: 'Double Overhanging Beam (Contraflexure!)',
    nameHi: 'Double Overhanging (Contraflexure Demo!)',
    tag: 'Sagging + Hogging',
    model: {
      length: 10,
      E_GPa: 200,
      I_cm4: 10000,
      supports: [
        { id: 'sA', x: 2, type: 'pin', label: 'A' },
        { id: 'sB', x: 8, type: 'roller', label: 'B' },
      ],
      hinges: [],
      loads: [
        { id: 'l1', type: 'point', x: 0, magnitude: 25 },
        { id: 'l2', type: 'udl', xStart: 2, xEnd: 8, magnitude: 20 },
        { id: 'l3', type: 'point', x: 10, magnitude: 25 },
      ],
    },
  },
  {
    id: 'cantilever_combo',
    category: 'Determinate',
    nameEn: 'Cantilever Beam (UDL + Tip Load)',
    nameHi: 'Cantilever Chhajja / Balcony Beam',
    tag: 'Pure Hogging',
    model: {
      length: 5,
      E_GPa: 200,
      I_cm4: 12000,
      supports: [{ id: 'sA', x: 0, type: 'fixed', label: 'A' }],
      hinges: [],
      loads: [
        { id: 'l1', type: 'udl', xStart: 0, xEnd: 3, magnitude: 20 },
        { id: 'l2', type: 'point', x: 5, magnitude: 25 },
      ],
    },
  },
  {
    id: 'couple_jump',
    category: 'Determinate',
    nameEn: 'Concentrated Moment / Couple Jump Trap',
    nameHi: 'Concentrated Moment (BMD Vertical Jump!)',
    tag: 'Exam Trap',
    model: {
      length: 6,
      E_GPa: 200,
      I_cm4: 8000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 6, type: 'roller', label: 'B' },
      ],
      hinges: [],
      loads: [
        { id: 'l1', type: 'moment', x: 3, magnitude: 48 },
        { id: 'l2', type: 'point', x: 1.5, magnitude: 18 },
      ],
    },
  },
  {
    id: 'propped_cantilever',
    category: 'Indeterminate',
    nameEn: 'Propped Cantilever (Ds = 1)',
    nameHi: 'Propped Cantilever (Ds = 1 Indeterminate)',
    tag: 'Ds = 1',
    model: {
      length: 6,
      E_GPa: 200,
      I_cm4: 10000,
      supports: [
        { id: 'sA', x: 0, type: 'fixed', label: 'A' },
        { id: 'sB', x: 6, type: 'roller', label: 'B' },
      ],
      hinges: [],
      loads: [{ id: 'l1', type: 'udl', xStart: 0, xEnd: 6, magnitude: 20 }],
    },
  },
  {
    id: 'fixed_fixed_beam',
    category: 'Indeterminate',
    nameEn: 'Fixed-Fixed Beam (wL²/12 & wL²/24)',
    nameHi: 'Fixed-Fixed Beam (Dono Siray Jaam, Ds = 2)',
    tag: 'Ds = 2',
    model: {
      length: 6,
      E_GPa: 200,
      I_cm4: 10000,
      supports: [
        { id: 'sA', x: 0, type: 'fixed', label: 'A' },
        { id: 'sB', x: 6, type: 'fixed', label: 'B' },
      ],
      hinges: [],
      loads: [{ id: 'l1', type: 'udl', xStart: 0, xEnd: 6, magnitude: 24 }],
    },
  },
  {
    id: 'continuous_3span',
    category: 'Indeterminate',
    nameEn: '3-Span Continuous Bridge Girder',
    nameHi: '3-Span Continuous Flyover Girder (Ds = 2)',
    tag: 'Clapeyron / MDM',
    model: {
      length: 12,
      E_GPa: 200,
      I_cm4: 15000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 4, type: 'roller', label: 'B' },
        { id: 'sC', x: 8, type: 'roller', label: 'C' },
        { id: 'sD', x: 12, type: 'roller', label: 'D' },
      ],
      hinges: [],
      loads: [
        { id: 'l1', type: 'udl', xStart: 0, xEnd: 12, magnitude: 18 },
        { id: 'l2', type: 'point', x: 6, magnitude: 45 },
      ],
    },
  },
  {
    id: 'gerber_hinge_beam',
    category: 'Special',
    nameEn: 'Gerber Compound Beam (Internal Hinge)',
    nameHi: 'Gerber Beam (Internal Hinge: M = 0 & Slope Kink!)',
    tag: 'Internal Hinge',
    model: {
      length: 10,
      E_GPa: 200,
      I_cm4: 12000,
      supports: [
        { id: 'sA', x: 0, type: 'fixed', label: 'A' },
        { id: 'sB', x: 10, type: 'roller', label: 'B' },
      ],
      hinges: [{ id: 'h1', x: 4 }],
      loads: [
        { id: 'l1', type: 'udl', xStart: 4, xEnd: 10, magnitude: 15 },
        { id: 'l2', type: 'point', x: 2, magnitude: 30 },
      ],
    },
  },
  {
    id: 'support_settlement',
    category: 'Special',
    nameEn: 'Continuous Beam + Support Sinking (Δ = 12 mm)',
    nameHi: 'Support Dhasna / Settlement (Δ = 12 mm Effect!)',
    tag: 'Settlement Δ',
    model: {
      length: 10,
      E_GPa: 200,
      I_cm4: 10000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 5, type: 'roller', label: 'B', settlementMm: 12 },
        { id: 'sC', x: 10, type: 'roller', label: 'C' },
      ],
      hinges: [],
      loads: [{ id: 'l1', type: 'udl', xStart: 0, xEnd: 10, magnitude: 10 }],
    },
  },
  {
    id: 'elastic_spring_prop',
    category: 'Special',
    nameEn: 'Cantilever Propped on Elastic Spring',
    nameHi: 'Spring Support Prop (Soil / Elastic Foundation)',
    tag: 'Spring Support',
    model: {
      length: 6,
      E_GPa: 200,
      I_cm4: 9000,
      supports: [
        { id: 'sA', x: 0, type: 'fixed', label: 'A' },
        { id: 'sB', x: 6, type: 'spring', springK: 3500, label: 'B' },
      ],
      hinges: [],
      loads: [{ id: 'l1', type: 'udl', xStart: 0, xEnd: 6, magnitude: 18 }],
    },
  },
];

export interface ILDBridgePreset {
  id: string;
  nameEn: string;
  nameHi: string;
  badge: string;
  defaultSectionX: number;
  model: BeamModel;
}

export const ILD_BRIDGE_PRESETS: ILDBridgePreset[] = [
  {
    id: 'ild_ss',
    nameEn: 'Simply Supported Bridge (12 m)',
    nameHi: 'Simply Supported Pul (12 m, Straight Line ILD)',
    badge: 'Ds = 0',
    defaultSectionX: 4.5,
    model: {
      length: 12,
      E_GPa: 200,
      I_cm4: 20000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 12, type: 'roller', label: 'B' },
      ],
      hinges: [],
      loads: [],
    },
  },
  {
    id: 'ild_overhang',
    nameEn: 'Single Overhanging Bridge (9 m + 3 m)',
    nameHi: 'Overhanging Bridge (Sign Reversal Demo!)',
    badge: 'Ds = 0',
    defaultSectionX: 4.5,
    model: {
      length: 12,
      E_GPa: 200,
      I_cm4: 20000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 9, type: 'roller', label: 'B' },
      ],
      hinges: [],
      loads: [],
    },
  },
  {
    id: 'ild_gerber',
    nameEn: 'Gerber Bridge with Internal Hinge (16 m)',
    nameHi: 'Gerber Cantilever-Suspended Bridge (Hinge @ 10m)',
    badge: 'Ds = 0 + Hinge',
    defaultSectionX: 4,
    model: {
      length: 16,
      E_GPa: 200,
      I_cm4: 25000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 8, type: 'roller', label: 'B' },
        { id: 'sC', x: 16, type: 'roller', label: 'C' },
      ],
      hinges: [{ id: 'h1', x: 10 }],
      loads: [],
    },
  },
  {
    id: 'ild_continuous_2span',
    nameEn: '2-Span Continuous Highway Bridge (8m + 8m)',
    nameHi: '2-Span Continuous Flyover (Curved ILD!)',
    badge: 'Ds = 1 Curved',
    defaultSectionX: 4,
    model: {
      length: 16,
      E_GPa: 200,
      I_cm4: 25000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 8, type: 'roller', label: 'B' },
        { id: 'sC', x: 16, type: 'roller', label: 'C' },
      ],
      hinges: [],
      loads: [],
    },
  },
  {
    id: 'ild_continuous_3span',
    nameEn: '3-Span Continuous Railway Girder (6m × 3)',
    nameHi: '3-Span Continuous Railway Bridge (Ds = 2 Curved)',
    badge: 'Ds = 2 Curved',
    defaultSectionX: 3,
    model: {
      length: 18,
      E_GPa: 200,
      I_cm4: 25000,
      supports: [
        { id: 'sA', x: 0, type: 'pin', label: 'A' },
        { id: 'sB', x: 6, type: 'roller', label: 'B' },
        { id: 'sC', x: 12, type: 'roller', label: 'C' },
        { id: 'sD', x: 18, type: 'roller', label: 'D' },
      ],
      hinges: [],
      loads: [],
    },
  },
  {
    id: 'ild_propped',
    nameEn: 'Propped Cantilever Span (10 m)',
    nameHi: 'Propped Cantilever (Ds = 1 Curved ILD)',
    badge: 'Ds = 1 Curved',
    defaultSectionX: 5,
    model: {
      length: 10,
      E_GPa: 200,
      I_cm4: 20000,
      supports: [
        { id: 'sA', x: 0, type: 'fixed', label: 'A' },
        { id: 'sB', x: 10, type: 'roller', label: 'B' },
      ],
      hinges: [],
      loads: [],
    },
  },
];

export interface Structure2DPreset {
  id: string;
  model: Structure2DModel;
  tag: string;
  descriptionEn: string;
  descriptionHi: string;
}

export const STRUCTURE_2D_PRESETS: Structure2DPreset[] = [
  {
    id: 'pratt_truss',
    tag: 'Truss • Bridge',
    descriptionEn: 'Classic 4-panel Pratt Bridge Truss: Top chord in Compression (Red), Bottom chord & Diagonals in Tension (Blue).',
    descriptionHi: 'Pratt Bridge Truss: Upar ke members Compression (Dabav - Red) mein aur tirche diagonals Tension (Khinchav - Blue) mein!',
    model: {
      nameEn: '4-Panel Pratt Bridge Truss',
      nameHi: '4-Panel Pratt Pul Truss',
      mode: 'truss',
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0, support: 'pin' },
        { id: 'n2', label: 'B', x: 3, y: 0, support: 'free', fy: -50 },
        { id: 'n3', label: 'C', x: 6, y: 0, support: 'free', fy: -80 },
        { id: 'n4', label: 'D', x: 9, y: 0, support: 'free', fy: -50 },
        { id: 'n5', label: 'E', x: 12, y: 0, support: 'roller_x' },
        { id: 'n6', label: 'F', x: 3, y: 3.5, support: 'free' },
        { id: 'n7', label: 'G', x: 6, y: 3.5, support: 'free' },
        { id: 'n8', label: 'H', x: 9, y: 3.5, support: 'free' },
      ],
      members: [
        { id: 'm1', label: 'AB', startNodeId: 'n1', endNodeId: 'n2' },
        { id: 'm2', label: 'BC', startNodeId: 'n2', endNodeId: 'n3' },
        { id: 'm3', label: 'CD', startNodeId: 'n3', endNodeId: 'n4' },
        { id: 'm4', label: 'DE', startNodeId: 'n4', endNodeId: 'n5' },
        { id: 'm5', label: 'AF', startNodeId: 'n1', endNodeId: 'n6' },
        { id: 'm6', label: 'FG', startNodeId: 'n6', endNodeId: 'n7' },
        { id: 'm7', label: 'GH', startNodeId: 'n7', endNodeId: 'n8' },
        { id: 'm8', label: 'HE', startNodeId: 'n8', endNodeId: 'n5' },
        { id: 'm9', label: 'BF', startNodeId: 'n2', endNodeId: 'n6' },
        { id: 'm10', label: 'CG', startNodeId: 'n3', endNodeId: 'n7' },
        { id: 'm11', label: 'DH', startNodeId: 'n4', endNodeId: 'n8' },
        { id: 'm12', label: 'FC', startNodeId: 'n6', endNodeId: 'n3' },
        { id: 'm13', label: 'HC', startNodeId: 'n8', endNodeId: 'n3' },
      ],
    },
  },
  {
    id: 'zero_force_trap',
    tag: 'Truss • Zero-Force',
    descriptionEn: 'Exam Classic: Spot the Zero-Force Members! Unloaded 2-member joint & unloaded 3rd member at collinear joint carry ZERO force.',
    descriptionHi: 'GATE / Semester Exam Favorite: Dashed Gray members mein ZERO force hai! Dekho bina load wale joint ka rule kaise kaam karta hai.',
    model: {
      nameEn: 'Zero-Force Member Classroom Demo',
      nameHi: 'Zero-Force Member Pehchano Demo',
      mode: 'truss',
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0, support: 'pin' },
        { id: 'n2', label: 'B', x: 4, y: 0, support: 'free' },
        { id: 'n3', label: 'C', x: 8, y: 0, support: 'free', fy: -60 },
        { id: 'n4', label: 'D', x: 12, y: 0, support: 'roller_x' },
        { id: 'n5', label: 'E', x: 4, y: 3.5, support: 'free', fx: 30 },
        { id: 'n6', label: 'F', x: 8, y: 3.5, support: 'free' },
        { id: 'n7', label: 'G', x: 12, y: 3.5, support: 'free' },
      ],
      members: [
        { id: 'm1', label: 'AB', startNodeId: 'n1', endNodeId: 'n2' },
        { id: 'm2', label: 'BC', startNodeId: 'n2', endNodeId: 'n3' },
        { id: 'm3', label: 'CD', startNodeId: 'n3', endNodeId: 'n4' },
        { id: 'm4', label: 'AE', startNodeId: 'n1', endNodeId: 'n5' },
        { id: 'm5', label: 'EF', startNodeId: 'n5', endNodeId: 'n6' },
        { id: 'm6', label: 'FG', startNodeId: 'n6', endNodeId: 'n7' },
        { id: 'm7', label: 'GD', startNodeId: 'n7', endNodeId: 'n4' },
        { id: 'm8', label: 'BE', startNodeId: 'n2', endNodeId: 'n5' },
        { id: 'm9', label: 'CF', startNodeId: 'n3', endNodeId: 'n6' },
        { id: 'm10', label: 'EC', startNodeId: 'n5', endNodeId: 'n3' },
        { id: 'm11', label: 'FD', startNodeId: 'n6', endNodeId: 'n4' },
      ],
    },
  },
  {
    id: 'cantilever_truss',
    tag: 'Truss • Bracket',
    descriptionEn: 'Cantilever Stadium Roof / Crane Truss: Notice the reversal, Top chord is in TENSION while Bottom chord is in COMPRESSION!',
    descriptionHi: 'Cantilever Bracket Truss: Yahan ulta hota hai! Upar ki chord Tension (Blue) mein khinchti hai aur neeche ki chord Compression (Red) mein dabti hai!',
    model: {
      nameEn: 'Cantilever Wall Bracket Truss',
      nameHi: 'Cantilever Chhajja / Crane Truss',
      mode: 'truss',
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 3, support: 'pin' },
        { id: 'n2', label: 'B', x: 0, y: 0, support: 'pin' },
        { id: 'n3', label: 'C', x: 3, y: 3, support: 'free', fy: -25 },
        { id: 'n4', label: 'D', x: 3, y: 0, support: 'free' },
        { id: 'n5', label: 'E', x: 6, y: 3, support: 'free', fy: -45 },
        { id: 'n6', label: 'F', x: 6, y: 1.2, support: 'free' },
        { id: 'n7', label: 'G', x: 9, y: 3, support: 'free', fy: -60 },
      ],
      members: [
        { id: 'm1', label: 'AC', startNodeId: 'n1', endNodeId: 'n3' },
        { id: 'm2', label: 'CE', startNodeId: 'n3', endNodeId: 'n5' },
        { id: 'm3', label: 'EG', startNodeId: 'n5', endNodeId: 'n7' },
        { id: 'm4', label: 'BD', startNodeId: 'n2', endNodeId: 'n4' },
        { id: 'm5', label: 'DF', startNodeId: 'n4', endNodeId: 'n6' },
        { id: 'm6', label: 'FG', startNodeId: 'n6', endNodeId: 'n7' },
        { id: 'm7', label: 'CD', startNodeId: 'n3', endNodeId: 'n4' },
        { id: 'm8', label: 'EF', startNodeId: 'n5', endNodeId: 'n6' },
        { id: 'm9', label: 'BC', startNodeId: 'n2', endNodeId: 'n3' },
        { id: 'm10', label: 'DE', startNodeId: 'n4', endNodeId: 'n5' },
      ],
    },
  },
  {
    id: 'warren_roof',
    tag: 'Truss • Roof',
    descriptionEn: 'Pitched Roof Truss under Gravity + Wind Load: Observe unsymmetrical load flow to pinned & roller supports.',
    descriptionHi: 'Factory Shed Roof Truss (Gravity + Hawa ka Load): Load kaise tirche rafters se columns tak utarta hai dekhiye.',
    model: {
      nameEn: 'Pitched Industrial Roof Truss',
      nameHi: 'Factory Roof Shed Truss',
      mode: 'truss',
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0, support: 'pin' },
        { id: 'n2', label: 'B', x: 4, y: 0, support: 'free', fy: -20 },
        { id: 'n3', label: 'C', x: 8, y: 0, support: 'free', fy: -20 },
        { id: 'n4', label: 'D', x: 12, y: 0, support: 'roller_x' },
        { id: 'n5', label: 'E', x: 3, y: 2.2, support: 'free', fx: 18, fy: -35 },
        { id: 'n6', label: 'F', x: 6, y: 4.0, support: 'free', fx: 12, fy: -45 },
        { id: 'n7', label: 'G', x: 9, y: 2.2, support: 'free', fy: -30 },
      ],
      members: [
        { id: 'm1', label: 'AB', startNodeId: 'n1', endNodeId: 'n2' },
        { id: 'm2', label: 'BC', startNodeId: 'n2', endNodeId: 'n3' },
        { id: 'm3', label: 'CD', startNodeId: 'n3', endNodeId: 'n4' },
        { id: 'm4', label: 'AE', startNodeId: 'n1', endNodeId: 'n5' },
        { id: 'm5', label: 'EF', startNodeId: 'n5', endNodeId: 'n6' },
        { id: 'm6', label: 'FG', startNodeId: 'n6', endNodeId: 'n7' },
        { id: 'm7', label: 'GD', startNodeId: 'n7', endNodeId: 'n4' },
        { id: 'm8', label: 'EB', startNodeId: 'n5', endNodeId: 'n2' },
        { id: 'm9', label: 'FB', startNodeId: 'n6', endNodeId: 'n2' },
        { id: 'm10', label: 'FC', startNodeId: 'n6', endNodeId: 'n3' },
        { id: 'm11', label: 'GC', startNodeId: 'n7', endNodeId: 'n3' },
      ],
    },
  },
  {
    id: 'portal_gravity',
    tag: 'Frame • Gravity',
    descriptionEn: 'Fixed-Base Rigid Portal Frame with Beam UDL: Rigid corners transfer hogging moment into columns, bowing them outward!',
    descriptionHi: 'Rigid Portal Frame (Gravity UDL): Beam jhukti hai toh 90° rigid joints ki wajah se dono columns bhi bahar ki taraf mudte hain!',
    model: {
      nameEn: 'Rigid Portal Frame, Gravity UDL',
      nameHi: 'Rigid Portal Frame, Chhat ka UDL',
      mode: 'frame',
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0, support: 'fixed' },
        { id: 'n2', label: 'B', x: 0, y: 4.5, support: 'free' },
        { id: 'n3', label: 'C', x: 7, y: 4.5, support: 'free' },
        { id: 'n4', label: 'D', x: 7, y: 0, support: 'fixed' },
      ],
      members: [
        { id: 'm1', label: 'Col AB', startNodeId: 'n1', endNodeId: 'n2', I_cm4: 9000 },
        { id: 'm2', label: 'Beam BC', startNodeId: 'n2', endNodeId: 'n3', I_cm4: 14000, wPerp_kNm: 28 },
        { id: 'm3', label: 'Col DC', startNodeId: 'n4', endNodeId: 'n3', I_cm4: 9000 },
      ],
    },
  },
  {
    id: 'portal_sway',
    tag: 'Frame • Lateral Sway',
    descriptionEn: 'Portal Frame under Lateral Wind/Seismic Sway + Gravity: Watch columns bend in double-curvature S-shapes while joints stay 90°!',
    descriptionHi: 'Lateral Sway Portal Frame (Bhukamp / Wind Load): Dekho columns kaise S-shape mein mudte hain par 90° joint angle intact rehta hai!',
    model: {
      nameEn: 'Sway Portal Frame (Wind + Gravity)',
      nameHi: 'Sway Portal Frame (Bhukamp + Gravity)',
      mode: 'frame',
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0, support: 'fixed' },
        { id: 'n2', label: 'B', x: 0, y: 5, support: 'free', fx: 45 },
        { id: 'n3', label: 'C', x: 7, y: 5, support: 'free' },
        { id: 'n4', label: 'D', x: 7, y: 0, support: 'fixed' },
      ],
      members: [
        { id: 'm1', label: 'Col AB', startNodeId: 'n1', endNodeId: 'n2', I_cm4: 8000 },
        { id: 'm2', label: 'Beam BC', startNodeId: 'n2', endNodeId: 'n3', I_cm4: 12000, wPerp_kNm: 14 },
        { id: 'm3', label: 'Col DC', startNodeId: 'n4', endNodeId: 'n3', I_cm4: 8000 },
      ],
    },
  },
  {
    id: 'unsym_portal',
    tag: 'Frame • Unsymmetrical',
    descriptionEn: 'Unsymmetrical Leg Frame (Different Column Heights): Even under pure vertical load, unequal column stiffnesses cause lateral sidesway!',
    descriptionHi: 'Chhota-Bada Column Frame: Sirf seedhe vertical load se bhi frame side mein khisakta (Sway karta) hai, MDM ka sabse famous question!',
    model: {
      nameEn: 'Unsymmetrical Leg Sway Frame',
      nameHi: 'Asamaan Column Sway Frame',
      mode: 'frame',
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0, support: 'fixed' },
        { id: 'n2', label: 'B', x: 0, y: 5, support: 'free' },
        { id: 'n3', label: 'C', x: 6, y: 5, support: 'free' },
        { id: 'n4', label: 'D', x: 6, y: 1.8, support: 'fixed' },
      ],
      members: [
        { id: 'm1', label: 'Long Col AB', startNodeId: 'n1', endNodeId: 'n2', I_cm4: 8000 },
        { id: 'm2', label: 'Beam BC', startNodeId: 'n2', endNodeId: 'n3', I_cm4: 11000, wPerp_kNm: 25 },
        { id: 'm3', label: 'Short Col DC', startNodeId: 'n4', endNodeId: 'n3', I_cm4: 8000 },
      ],
    },
  },
  {
    id: 'two_story_frame',
    tag: 'Frame • 2-Story',
    descriptionEn: 'Two-Story Building Frame under Seismic Lateral Forces + Floor UDLs: Visualize inter-story drift and overturning axial forces in columns!',
    descriptionHi: '2-Manzila Building Frame (Seismic + Floor Load): Bhukamp mein windward column khinchta (Tension/less compression) aur leeward column dabta hai!',
    model: {
      nameEn: '2-Story Building Frame (Seismic + Floor UDL)',
      nameHi: '2-Manzila Building Frame (Bhukamp + Load)',
      mode: 'frame',
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0, support: 'fixed' },
        { id: 'n2', label: 'B', x: 6.5, y: 0, support: 'fixed' },
        { id: 'n3', label: 'C', x: 0, y: 3.5, support: 'free', fx: 25 },
        { id: 'n4', label: 'D', x: 6.5, y: 3.5, support: 'free' },
        { id: 'n5', label: 'E', x: 0, y: 7.0, support: 'free', fx: 40 },
        { id: 'n6', label: 'F', x: 6.5, y: 7.0, support: 'free' },
      ],
      members: [
        { id: 'm1', label: 'Col1-L', startNodeId: 'n1', endNodeId: 'n3', I_cm4: 10000, A_cm2: 60 },
        { id: 'm2', label: 'Col1-R', startNodeId: 'n2', endNodeId: 'n4', I_cm4: 10000, A_cm2: 60 },
        { id: 'm3', label: 'Floor-1', startNodeId: 'n3', endNodeId: 'n4', I_cm4: 12000, wPerp_kNm: 20 },
        { id: 'm4', label: 'Col2-L', startNodeId: 'n3', endNodeId: 'n5', I_cm4: 8000, A_cm2: 50 },
        { id: 'm5', label: 'Col2-R', startNodeId: 'n4', endNodeId: 'n6', I_cm4: 8000, A_cm2: 50 },
        { id: 'm6', label: 'Roof-2', startNodeId: 'n5', endNodeId: 'n6', I_cm4: 10000, wPerp_kNm: 15 },
      ],
    },
  },
];
