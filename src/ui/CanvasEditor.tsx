import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MousePointer2, CircleDot, Minus, Eraser, Undo2, Trash2, Crosshair, Grid3x3, Move3d } from 'lucide-react';
import { Structure2DModel } from '../engine/frameTrussEngine';
import { IconBtn, Segmented, clamp, uid } from './primitives';

export type CanvasTool = 'select' | 'node' | 'member' | 'erase';
export type PickSel = { type: 'node' | 'member'; id: string } | null;

const VW = 1200;
const VH = 700;

function extents(model: Structure2DModel) {
  if (!model.nodes.length) return { minX: 0, minY: 0, spanX: 10, spanY: 7 };
  const xs = model.nodes.map((n) => n.x);
  const ys = model.nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX: Math.min(0, minX) - 0.8,
    minY: Math.min(0, minY) - 0.8,
    spanX: Math.max(4.5, maxX - minX + 1.6),
    spanY: Math.max(3.2, maxY - minY + 1.6),
  };
}

/** only used for thumbnails, the editor fits the live available area instead */
export function makeTransform(model: Structure2DModel) {
  const e = extents(model);
  const scale = Math.min((VW - 90) / e.spanX, (VH - 90) / e.spanY, 58);
  const ox = 45 + (VW - 90 - e.spanX * scale) / 2;
  const oy = 45 + (VH - 90 - e.spanY * scale) / 2;
  return {
    scale,
    toS: (x: number, y: number) => ({ x: ox + (x - e.minX) * scale, y: oy + (e.spanY - (y - e.minY)) * scale }),
    toW: (sx: number, sy: number) => ({ x: e.minX + (sx - ox) / scale, y: e.minY + (e.spanY - (sy - oy) / scale) }),
    bounds: e,
  };
}

/* ------------------------------------------------------------------ */
/* Support + load glyphs                                              */
/* ------------------------------------------------------------------ */

const SupportGlyph: React.FC<{ x: number; y: number; s: number; kind: string }> = ({ x, y, s, kind }) => {
  const ink = 'var(--ink-2)';
  const g = 8;
  if (kind === 'free') {
    return <circle cx={x} cy={y} r={4.5} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />;
  }
  if (kind === 'pin') {
    return (
      <g>
        <path d={`M${x} ${y + 3} L${x - g} ${y + g + 8} L${x + g} ${y + g + 8} Z`} fill="var(--surface)" stroke={ink} strokeWidth={1.8} />
        <line x1={x - g - 3} y1={y + g + 8} x2={x + g + 3} y2={y + g + 8} stroke={ink} strokeWidth={2} />
        <line x1={x - g} y1={y + g + 8} x2={x - g - 4} y2={y + g + 14} stroke={ink} strokeWidth={1.4} />
        <line x1={x} y1={y + g + 8} x2={x - 3} y2={y + g + 14} stroke={ink} strokeWidth={1.4} />
        <line x1={x + g} y1={y + g + 8} x2={x + g - 4} y2={y + g + 14} stroke={ink} strokeWidth={1.4} />
      </g>
    );
  }
  if (kind === 'roller_x' || kind === 'roller_y') {
    return (
      <g>
        <path d={`M${x} ${y + 3} L${x - g} ${y + g + 6} L${x + g} ${y + g + 6} Z`} fill="var(--surface)" stroke={ink} strokeWidth={1.8} />
        <circle cx={x - 4.5} cy={y + g + 10} r={3.4} fill="var(--surface)" stroke={ink} strokeWidth={1.5} />
        <circle cx={x + 4.5} cy={y + g + 10} r={3.4} fill="var(--surface)" stroke={ink} strokeWidth={1.5} />
        <line x1={x - g - 3} y1={y + g + 14.5} x2={x + g + 3} y2={y + g + 14.5} stroke={ink} strokeWidth={2} />
        {kind === 'roller_y' && (
          <text x={x + g + 6} y={y + g + 12} fontSize={9.5} fill="var(--ink-3)" pointerEvents="none">
            ↔x
          </text>
        )}
      </g>
    );
  }
  // fixed
  return (
    <g>
      <rect x={x - 5} y={y + 2} width={10} height={g + 4} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.6} />
      <line x1={x - g - 4} y1={y + g + 6} x2={x + g + 4} y2={y + g + 6} stroke="var(--ink)" strokeWidth={2.2} />
      {[-8, -3, 2, 7].map((d, i) => (
        <line key={i} x1={x + d} y1={y + g + 6} x2={x + d - 4} y2={y + g + 12} stroke="var(--ink)" strokeWidth={1.4} />
      ))}
    </g>
  );
};

const Arrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
  head?: number;
}> = ({ x1, y1, x2, y2, color, width = 2, head = 7 }) => {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const p1 = { x: x2 - head * Math.cos(ang - 0.42), y: y2 - head * Math.sin(ang - 0.42) };
  const p2 = { x: x2 - head * Math.cos(ang + 0.42), y: y2 - head * Math.sin(ang + 0.42) };
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill={color} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Static thumbnail                                                  */
/* ------------------------------------------------------------------ */

export const StructureThumb: React.FC<{ model: Structure2DModel; height?: number }> = ({ model, height = 86 }) => {
  const t = useMemo(() => makeTransform(model), [model]);
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height }} preserveAspectRatio="xMidYMid meet">
      {model.members.map((m) => {
        const a = model.nodes.find((n) => n.id === m.startNodeId);
        const b = model.nodes.find((n) => n.id === m.endNodeId);
        if (!a || !b) return null;
        const p1 = t.toS(a.x, a.y);
        const p2 = t.toS(b.x, b.y);
        return (
          <line
            key={m.id}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={model.mode === 'truss' ? 'var(--accent)' : 'var(--sagging)'}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}
      {model.nodes.map((n) => {
        const p = t.toS(n.x, n.y);
        return <circle key={n.id} cx={p.x} cy={p.y} r={7} fill={n.support === 'free' ? 'var(--surface)' : 'var(--compression)'} stroke="var(--ink-2)" strokeWidth={2} />;
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Main interactive canvas                                            */
/* ------------------------------------------------------------------ */

interface Props {
  model: Structure2DModel;
  onChange: (m: Structure2DModel) => void;
  tool: CanvasTool;
  setTool: (t: CanvasTool) => void;
  snap?: number;
  onPick?: (sel: PickSel) => void;
  memberStates?: Record<string, 'tension' | 'compression' | 'zero'>;
  compact?: boolean;
  /** editor height in px (desktop); defaults to the compact/roomy presets */
  height?: number;
  /** multiply the on-screen size of joint labels, member tags and load tags (small panels need this) */
  labelScale?: number;
}

export const CanvasEditor: React.FC<Props> = ({
  model,
  onChange,
  tool,
  setTool,
  snap = 0.5,
  onPick,
  memberStates,
  compact,
  height,
  labelScale = 1,
}) => {
  const t = useMemo(() => makeTransform(model), [model]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<PickSel>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragMoved = useRef(false); // a drag ends with a click, that click must not create anything
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    if (!hint) return;
    const id = setTimeout(() => setHint(null), 4200);
    return () => clearTimeout(id);
  }, [hint]);
  const [pendingNode, setPendingNode] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const fitInView = true; // always frame the structure in the space actually available
  const [pxPerUnit, setPxPerUnit] = useState(1);
  const [cw, setCw] = useState(VW); // measured CSS width of the canvas box
  const wrapRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Structure2DModel[]>([]);
  const [historyLen, setHistoryLen] = useState(0);

  const commit = useCallback(
    (next: Structure2DModel, record = true) => {
      if (record) {
        historyRef.current.push(JSON.parse(JSON.stringify(model)));
        if (historyRef.current.length > 40) historyRef.current.shift();
        setHistoryLen(historyRef.current.length);
      }
      onChange(next);
    },
    [model, onChange]
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev) {
      setHistoryLen(historyRef.current.length);
      onChange(prev);
    }
  }, [onChange]);

  // keep joints & strokes physically finger-sized no matter how wide the screen is,
  // and pick the drawing aspect from the space we actually have (so the model fills the panel)
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setCw(w || VW);
      setPxPerUnit(Math.max(0.15, w / VW));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // canvas box aspect follows the drawing, so nothing is letterboxed and the panel stays compact
  const aspect = Math.min(3.0, Math.max(1.12, t.bounds.spanX / t.bounds.spanY));
  const VA = VW / aspect; // visible viewBox height
  // refit only when the drawing really changes size, dragging one joint must not zoom the world
  const fitSig = `${model.nodes.length}:${Math.round(t.bounds.spanX)}:${Math.round(t.bounds.spanY)}`;
  // reserve real screen space for joint labels and load arrows so nothing is clipped
  const vbu = 1 / pxPerUnit; // viewBox units per CSS pixel
  const hasDown = model.nodes.some((n) => n.fy && n.fy < 0);
  const hasUp = model.nodes.some((n) => n.fy && n.fy > 0);
  const padTop = (hasDown ? 82 : 30) * vbu;
  const padBot = (hasUp ? 82 : 30) * vbu;
  const fitScale = useMemo(
    () =>
      Math.max(
        4,
        Math.min(200, Math.min((VW - 48 * vbu) / t.bounds.spanX, (VA - padTop - padBot) / t.bounds.spanY))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fitSig, VA, padTop, padBot]
  );
  const tv = useMemo(() => {
    if (!fitInView) return t;
    const { spanX, spanY, minX, minY } = t.bounds;
    const ox = 24 * vbu + (VW - 48 * vbu - spanX * fitScale) / 2;
    const oy = padTop + (VA - padTop - padBot - spanY * fitScale) / 2;
    return {
      ...t,
      scale: fitScale,
      // y is up in the model, down in the viewBox
      toS: (x: number, y: number) => ({ x: ox + (x - minX) * fitScale, y: oy + (spanY - (y - minY)) * fitScale }),
      toW: (sx: number, sy: number) => ({ x: minX + (sx - ox) / fitScale, y: minY + (spanY - (sy - oy) / fitScale) }),
    };
  }, [t, fitInView, fitScale, VA]);

  // GRID units of the current view per real CSS pixel. Everything drawn or hit-tested
  // uses this, so glyphs stay finger-sized at any zoom and taps land where they look.
  const ui = 1 / tv.scale;
  // One CSS pixel expressed in viewBox units. `ui` is one drawing unit (metre) in viewBox
  // units, which is NOT the same thing, using it for glyph sizes made every label, arrow
  // and joint shrink by the same factor as the panel got narrower. pxu is the honest one.
  const pxu = Math.max(0.15, 1 / Math.max(0.05, cw / VW)) * labelScale;
  const L = (_vb: number, px: number) => px * pxu;
  const nodeR = 6 * pxu;
  const hitR = 16 * pxu; // invisible grab disc
  const strokeW = 3.4 * pxu;

  const select = (s: PickSel) => {
    setSel(s);
    onPick?.(s);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        if (sel.type === 'node') {
          if (model.nodes.length <= 2) return;
          commit({
            ...model,
            nodes: model.nodes.filter((n) => n.id !== sel.id),
            members: model.members.filter((m) => m.startNodeId !== sel.id && m.endNodeId !== sel.id),
          });
        } else {
          commit({ ...model, members: model.members.filter((m) => m.id !== sel.id) });
        }
        select(null);
      }
      if (e.key === 'Escape') {
        setPendingNode(null);
        select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const snapVal = (v: number) => Math.round(v / snap) * snap;

  /**
   * Shift+click support: find the member nearest the tapped point and split it there,
   * so a joint can be added onto an existing line instead of redrawing the frame.
   */
  const splitMemberAt = (w: { x: number; y: number }) => {
    let best: { m: (typeof model.members)[number]; t: number; d: number } | null = null;
    for (const m of model.members) {
      const a = model.nodes.find((n) => n.id === m.startNodeId);
      const b = model.nodes.find((n) => n.id === m.endNodeId);
      if (!a || !b) continue;
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const len2 = vx * vx + vy * vy;
      if (len2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((w.x - a.x) * vx + (w.y - a.y) * vy) / len2));
      if (t < 0.06 || t > 0.94) continue; // do not stack joints on an existing one
      const d = Math.hypot(a.x + t * vx - w.x, a.y + t * vy - w.y);
      if (!best || d < best.d) best = { m, t, d };
    }
    if (!best || best.d > 0.35) return null;
    const a = model.nodes.find((n) => n.id === best!.m.startNodeId)!;
    const b = model.nodes.find((n) => n.id === best!.m.endNodeId)!;
    const x = snapVal(a.x + best.t * (b.x - a.x));
    const y = snapVal(a.y + best.t * (b.y - a.y));
    if (model.nodes.some((n) => Math.abs(n.x - x) < 1e-6 && Math.abs(n.y - y) < 1e-6)) return null;
    const newNode = {
      id: 'n_' + uid(),
      label: String.fromCharCode(65 + (model.nodes.length % 26)),
      x,
      y,
      support: 'free' as const,
    };
    const { E_GPa, A_cm2, I_cm4, wPerp_kNm } = best.m;
    return {
      nodeId: newNode.id,
      label: newNode.label,
      model: {
        ...model,
        nodes: [...model.nodes, newNode],
        members: [
          ...model.members.filter((mm) => mm.id !== best!.m.id),
          { id: 'm_' + uid(), label: best.m.label, startNodeId: best.m.startNodeId, endNodeId: newNode.id, E_GPa, A_cm2, I_cm4, wPerp_kNm },
          { id: 'm_' + uid(), label: best.m.label + "'", startNodeId: newNode.id, endNodeId: best.m.endNodeId, E_GPa, A_cm2, I_cm4, wPerp_kNm },
        ],
      } as Structure2DModel,
    };
  };

  // client px → viewBox units → drawing units. The box has the same aspect as the
  // viewBox, so this is a clean ratio (the letterbox branch is belt-and-braces).
  const svgPoint = (evt: React.PointerEvent | React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const k = Math.min(rect.width / VW, rect.height / VA);
    const sx = (evt.clientX - rect.left - (rect.width - VW * k) / 2) / k;
    const sy = (evt.clientY - rect.top - (rect.height - VA * k) / 2) / k;
    return tv.toW(sx, sy);
  };

  const onBackgroundPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const w = svgPoint(e);
    const px = snapVal(w.x);
    const py = snapVal(w.y);
    if (tool === 'node') {
      if (e.shiftKey) {
        // power move: Shift+click anywhere to drop a joint on the existing line it touches
        const split = splitMemberAt(w);
        if (split) {
          commit(split.model);
          select({ type: 'node', id: split.nodeId });
          setHint(`Joint ${split.label} inserted on the line, both halves keep the same section.`);
          return;
        }
      }
      // snap onto an existing joint only if the tap is really on it
      const near = model.nodes.find((n) => Math.hypot(n.x - w.x, n.y - w.y) < 16 * ui);
      if (near) {
        select({ type: 'node', id: near.id });
        return;
      }
      const letter = String.fromCharCode(65 + (model.nodes.length % 26));
      const id = `n_${uid()}`;
      const next: Structure2DModel = {
        ...model,
        nodes: [...model.nodes, { id, label: letter, x: px, y: py, support: 'free' }],
      };
      commit(next);
      select({ type: 'node', id });
      return;
    }
    if (tool === 'member') {
      const near = model.nodes.find((n) => Math.hypot(n.x - w.x, n.y - w.y) < 16 * ui);
      if (!near) {
        // keep the anchor; a stray tap should not cancel the member, but it must not be silent either
        if (!pendingNode) setHint('Tap directly on a joint dot to start a member.');
        return;
      }

      if (!pendingNode) {
        setPendingNode(near.id);
        select({ type: 'node', id: near.id });
        return;
      }
      if (pendingNode === near.id) {
        setPendingNode(null);
        return;
      }
      const exists = model.members.some(
        (m) =>
          (m.startNodeId === pendingNode && m.endNodeId === near.id) ||
          (m.startNodeId === near.id && m.endNodeId === pendingNode)
      );
      if (!exists) {
        const mx = (model.members.length + 1).toString();
        commit({
          ...model,
          members: [
            ...model.members,
            {
              id: `m_${uid()}`,
              label: `M${mx}`,
              startNodeId: pendingNode,
              endNodeId: near.id,
              E_GPa: 200,
              A_cm2: model.mode === 'truss' ? 20 : 40,
              I_cm4: 8000,
              wPerp_kNm: 0,
            },
          ],
        });
      }
      setPendingNode(near.id);
      select({ type: 'node', id: near.id });
      return;
    }
    select(null);
    setPendingNode(null);
  };

  const onNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (tool === 'erase') {
      if (model.nodes.length <= 2) return;
      commit({
        ...model,
        nodes: model.nodes.filter((n) => n.id !== id),
        members: model.members.filter((m) => m.startNodeId !== id && m.endNodeId !== id),
      });
      return;
    }
    if (tool === 'member') {
      if (!pendingNode) {
        setPendingNode(id);
        select({ type: 'node', id });
        return;
      }
      if (pendingNode === id) {
        setPendingNode(null);
        return;
      }
      const exists = model.members.some(
        (m) =>
          (m.startNodeId === pendingNode && m.endNodeId === id) || (m.startNodeId === id && m.endNodeId === pendingNode)
      );
      if (exists) {
        setHint('Those two joints are already joined. Pick an unconnected pair.');
      } else {
        commit({
          ...model,
          members: [
            ...model.members,
            {
              id: `m_${uid()}`,
              label: `M${model.members.length + 1}`,
              startNodeId: pendingNode,
              endNodeId: id,
              E_GPa: 200,
              A_cm2: model.mode === 'truss' ? 20 : 40,
              I_cm4: 8000,
              wPerp_kNm: 0,
            },
          ],
        });
      }
      setPendingNode(id);
      select({ type: 'node', id });
      return;
    }
    select({ type: 'node', id });
    setDragging(id);
    dragMoved.current = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const w = svgPoint(e);
    setHover({ x: snapVal(w.x), y: snapVal(w.y) });
    if (!dragging) return;
    const nx = snapVal(w.x);
    const ny = snapVal(w.y);
    const cur = model.nodes.find((n) => n.id === dragging);
    if (cur && (Math.abs(cur.x - nx) > 1e-9 || Math.abs(cur.y - ny) > 1e-9)) dragMoved.current = true;
    onChange({
      ...model,
      nodes: model.nodes.map((n) => (n.id === dragging ? { ...n, x: nx, y: ny } : n)),
    });
  };

  // capture phase: swallow the click that follows a node drag, whatever the tool
  const onClickCapture = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragMoved.current) {
      e.stopPropagation();
      e.preventDefault();
      dragMoved.current = false;
    }
  };

  const onPointerUp = () => {
    if (dragging) {
      // finalize: push a snapshot for undo (state already committed live)
      historyRef.current.push(JSON.parse(JSON.stringify(model)));
      if (historyRef.current.length > 40) historyRef.current.shift();
      setHistoryLen(historyRef.current.length);
      setDragging(null);
    }
  };

  const hitStroke = 15 * pxu; // invisible click band along a member
  const isTruss = model.mode === 'truss';

  const nodeAt = (id: string) => model.nodes.find((n) => n.id === id);

  return (
    <div className="space-y-2">
      {/* tool bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented
            size="sm"
            value={tool}
            onChange={(v) => {
              setTool(v);
              setPendingNode(null);
            }}
            full
            options={[
              { value: 'select', label: <span className="flex items-center justify-center gap-1" title="Select or drag joints and members"><MousePointer2 className="w-3 h-3" />Select</span> },
              { value: 'node', label: <span className="flex items-center justify-center gap-1" title="Add a joint"><CircleDot className="w-3 h-3" />Joint</span> },
              { value: 'member', label: <span className="flex items-center justify-center gap-1" title="Add a member between two joints"><Minus className="w-3 h-3" />Member</span> },
              { value: 'erase', label: <span className="flex items-center justify-center gap-1" title="Erase a member or joint"><Eraser className="w-3 h-3" />Erase</span> },
            ]}
          />
        </div>
        <div className="flex items-center gap-1">
          <IconBtn title="Toggle grid" onClick={() => setShowGrid((s) => !s)}>
            <Grid3x3 className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn title="Undo (Ctrl+Z)" onClick={undo} className={historyLen ? '' : 'opacity-40'}>
            <Undo2 className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn
            title="Clear all members (keep nodes)"
            onClick={() => commit({ ...model, members: [] })}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </IconBtn>
        </div>
      </div>

      {/* canvas */}
      <div
        ref={wrapRef}
        className="relative rounded-xl overflow-hidden blueprint"
        style={{ border: '1px solid var(--line)', width: '100%', aspectRatio: `${aspect}`, maxHeight: `min(${height ?? (compact ? 330 : 520)}px, 62vh)` }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VA}`}
          className="w-full h-full block select-none no-hit-text"
          preserveAspectRatio="xMidYMid meet"
          style={{ touchAction: 'none', cursor: tool === 'select' ? 'default' : 'crosshair' }}
          onPointerDown={onBackgroundPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClickCapture={onClickCapture}
          onPointerLeave={() => setHover(null)}
        >
          {/* ruler grid */}
          {showGrid &&
            (() => {
              const lines: React.ReactNode[] = [];
              // grid must cover whatever the fitted/fixed transform actually shows
              const wa = tv.toW(0, VA);
              const wb = tv.toW(VW, 0);
              const x0 = Math.floor(Math.min(wa.x, wb.x));
              const x1 = Math.ceil(Math.max(wa.x, wb.x));
              const y0 = Math.floor(Math.min(wa.y, wb.y));
              const y1 = Math.ceil(Math.max(wa.y, wb.y));
              for (let x = x0; x <= x1; x++) {
                const p1 = tv.toS(x, wa.y);
                const p2 = tv.toS(x, wb.y);
                lines.push(
                  <line
                    key={`gx${x}`}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="var(--grid)"
                    strokeWidth={x % 5 === 0 ? 1.4 : 0.7}
                  />
                );
                if (x % 2 === 0) {
                  lines.push(
                    <text key={`tx${x}`} x={p1.x + 2} y={VA - 5} fontSize={12.5 * labelScale} fill="var(--ink-3)" opacity={0.75} pointerEvents="none">
                      {x}m
                    </text>
                  );
                }
              }
              for (let y = y0; y <= y1; y++) {
                const p1 = tv.toS(wb.x, y);
                const p2 = tv.toS(wa.x, y);
                lines.push(
                  <line
                    key={`gy${y}`}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="var(--grid)"
                    strokeWidth={y % 5 === 0 ? 1.4 : 0.7}
                  />
                );
              }
              return lines;
            })()}

          {/* ground line */}
          <line
            x1={0}
            y1={tv.toS(0, 0).y}
            x2={VW}
            y2={tv.toS(0, 0).y}
            stroke="var(--line-strong)"
            strokeWidth={1}
            strokeDasharray="4 6"
            opacity={0.7}
          />

          {/* members */}
          {model.members.map((m) => {
            const a = nodeAt(m.startNodeId);
            const b = nodeAt(m.endNodeId);
            if (!a || !b) return null;
            const p1 = tv.toS(a.x, a.y);
            const p2 = tv.toS(b.x, b.y);
            const st = memberStates?.[m.id];
            const color =
              st === 'tension'
                ? 'var(--tension)'
                : st === 'compression'
                  ? 'var(--compression)'
                  : st === 'zero'
                    ? 'var(--ink-3)'
                    : isTruss
                      ? 'var(--accent)'
                      : 'var(--sagging)';
            const isSel = sel?.type === 'member' && sel.id === m.id;
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
            const w = m.wPerp_kNm ?? 0;
            const nx = Math.sin((ang * Math.PI) / 180);
            const ny = -Math.cos((ang * Math.PI) / 180);
            return (
              <g key={m.id}>
                {st === 'zero' && (
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={strokeW + 2} strokeDasharray="7 7" opacity={0.75} />
                )}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={isSel ? 'var(--warn)' : color}
                  strokeWidth={isSel ? strokeW + 2 : strokeW}
                  strokeLinecap="round"
                />
                {/* hit area */}
                <line
                  data-member-hit={m.id}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="transparent"
                  strokeWidth={hitStroke}
                  style={{ cursor: tool === 'erase' ? 'not-allowed' : 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (tool === 'erase') {
                      commit({ ...model, members: model.members.filter((x) => x.id !== m.id) });
                      return;
                    }
                    select({ type: 'member', id: m.id });
                  }}
                />
                {len > 0.4 && (
                  <text
                    x={mx}
                    y={my - 9}
                    fontSize={L(11, 12.5)}
                    fontWeight={700}
                    textAnchor="middle"
                    fill="var(--ink-3)"
                    transform={`rotate(${ang > 90 || ang < -90 ? ang + 180 : ang} ${mx} ${my})`}
                    paintOrder="stroke"
                    stroke="var(--canvas)"
                    strokeWidth={4}
                  >
                    {m.label ?? ''} {st ? (st === 'tension' ? 'T' : st === 'compression' ? 'C' : '0') : ''}
                  </text>
                )}
                {/* distributed load arrows */}
                {Math.abs(w) > 1e-6 &&
                  Array.from({ length: 6 }).map((_, i) => {
                    const f = (i + 1) / 7;
                    const bx = p1.x + (p2.x - p1.x) * f;
                    const by = p1.y + (p2.y - p1.y) * f;
                    const dir = w > 0 ? 1 : -1;
                    const L = 26;
                    return (
                      <Arrow
                        key={i}
                        x1={bx - nx * L * dir}
                        y1={by - ny * L * dir}
                        x2={bx}
                        y2={by}
                        color="var(--warn)"
                        width={1.4}
                        head={5}
                      />
                    );
                  })}
              </g>
            );
          })}

          {/* pending member anchor */}
          {pendingNode &&
            (() => {
              const n = nodeAt(pendingNode);
              if (!n) return null;
              const p = tv.toS(n.x, n.y);
              return <circle cx={p.x} cy={p.y} r={nodeR * 2.4} fill="none" stroke="var(--warn)" strokeWidth={2} strokeDasharray="3 3" />;
            })()}

          {/* nodes */}
          {model.nodes.map((n) => {
            const p = tv.toS(n.x, n.y);
            const isSel = sel?.type === 'node' && sel.id === n.id;
            return (
              <g
                key={n.id}
                data-node-id={n.id}
                onPointerDown={(e) => onNodePointerDown(e, n.id)}
                style={{ cursor: tool === 'erase' ? 'not-allowed' : 'grab' }}
              >
                <g pointerEvents="none">
                  {n.support === 'free' ? (
                    <circle cx={p.x} cy={p.y} r={nodeR * 0.8} fill="var(--surface)" stroke={isSel ? 'var(--warn)' : 'var(--accent)'} strokeWidth={2.4 * pxu} />
                  ) : (
                    <rect x={p.x - nodeR * 0.8} y={p.y - nodeR * 0.8} width={nodeR * 1.6} height={nodeR * 1.6} fill={isSel ? 'var(--warn)' : 'var(--accent)'} rx={2} />
                  )}
                </g>
                <SupportGlyph x={p.x} y={p.y} s={t.scale} kind={n.support} />
                <text
                  x={p.x + nodeR * 1.4}
                  y={p.y - nodeR * 1.2}
                  fontSize={L(11.5, 12)}
                  fontWeight={800}
                  fill={isSel ? 'var(--warn)' : 'var(--ink)'}
                  paintOrder="stroke"
                  stroke="var(--canvas)"
                  strokeWidth={4}
                 pointerEvents="none">
                  {n.label}
                </text>
                {/* nodal loads, drawn on a CSS-pixel geometry so they look the same at every zoom */}
                {!!n.fy && Math.abs(n.fy) > 1e-6 && (
                  <g>
                    {(() => {
                      const px = 46 * pxu; // arrow length in world units = 46 CSS px
                      const g = tv.toS(n.x, n.y);
                      const dy = n.fy < 0 ? -1 : 1; // −y is gravity, +y pulls up
                      const rootY = g.y + dy * nodeR * 0.95;
                      const tipY = rootY + dy * px;
                      const uy = tv.toS(n.x, n.y + 1).y - g.y; // sign of "up" in screen space
                      const sgn = Math.sign(uy) || -1;
                      const head = 7 * pxu;
                      const y1 = rootY;
                      const y2 = tipY;
                      return (
                        <>
                          <line x1={g.x} y1={y1} x2={g.x} y2={y2} stroke={n.fy < 0 ? 'var(--compression)' : 'var(--ok)'} strokeWidth={2.4 * pxu} />
                          <polygon
                            points={`${g.x},${y2} ${g.x - 4 * pxu},${y2 - sgn * dy * head} ${g.x + 4 * pxu},${y2 - sgn * dy * head}`}
                            fill={n.fy < 0 ? 'var(--compression)' : 'var(--ok)'}
                          />
                        </>
                      );
                    })()}
                    <text
                      x={p.x + 8}
                      y={p.y + (n.fy < 0 ? -52 : 62) * pxu}
                      fontSize={L(11.5, 12)}
                      fontWeight={800}
                      fill={n.fy < 0 ? 'var(--compression)' : 'var(--ok)'}
                      paintOrder="stroke"
                      stroke="var(--canvas)"
                      strokeWidth={4}
                     pointerEvents="none">
                      {Math.abs(n.fy)} kN
                    </text>
                  </g>
                )}
                {!!n.fx && Math.abs(n.fx) > 1e-6 && (
                  <g>
                    <Arrow
                      x1={p.x - Math.sign(n.fx) * 52 * pxu}
                      y1={p.y}
                      x2={p.x - Math.sign(n.fx) * 12 * pxu}
                      y2={p.y}
                      color="var(--warn)"
                      width={2.4 * pxu}
                      head={7 * pxu}
                    />
                    <text
                      x={p.x + (n.fx > 0 ? -34 : 34) * pxu}
                      y={p.y - 26 * pxu}
                      fontSize={L(11.5, 12)}
                      fontWeight={800}
                      fill="var(--warn)"
                      textAnchor="middle"
                      paintOrder="stroke"
                      stroke="var(--canvas)"
                      strokeWidth={4}
                    >
                      {Math.abs(n.fx)} kN
                    </text>
                  </g>
                )}
                {!!n.mz && Math.abs(n.mz) > 2e-6 && (
                  <text x={p.x + 8 * pxu} y={p.y + 18 * pxu} fontSize={L(11.5, 12)} fontWeight={700} fill="var(--warn)" paintOrder="stroke" stroke="var(--canvas)" strokeWidth={4} pointerEvents="none">
                    M {n.mz} kN·m
                  </text>
                )}
                {/* the grab disc goes last: anything painted after it would sit on top and eat the tap */}
                <circle cx={p.x} cy={p.y} r={hitR} fill="transparent" data-hit={n.id} />
              </g>
            );
          })}

          {/* ghost line from the anchor joint to the pointer while drawing a member */}
          {tool === 'member' && pendingNode && hover && (() => {
            const n = nodeAt(pendingNode);
            if (!n) return null;
            const p = tv.toS(n.x, n.y);
            const h = tv.toS(hover.x, hover.y);
            return (
              <line
                x1={p.x}
                y1={p.y}
                x2={h.x}
                y2={h.y}
                stroke="var(--warn)"
                strokeWidth={2}
                strokeDasharray="7 5"
                pointerEvents="none"
                opacity={0.9}
              />
            );
          })()}

          {/* pending hover node preview */}
          {tool === 'node' && hover && (
            <g opacity={0.55} pointerEvents="none">
              <circle cx={tv.toS(hover.x, hover.y).x} cy={tv.toS(hover.x, hover.y).y} r={6} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="3 3" />
            </g>
          )}
        </svg>

        {/* live hint, sits outside the drawing so it can never cover a joint */}
        <div
          className="absolute -bottom-[19px] left-0 text-[10px] font-semibold pointer-events-none max-w-full truncate"
          style={{ color: 'var(--ink-3)' }}
        >
          {tool === 'select'
            ? 'Drag nodes • tap member to edit • Delete to remove'
            : tool === 'node'
              ? 'Tap empty space to drop a joint (snaps to grid)'
              : tool === 'member'
                ? pendingNode
                  ? 'Now tap the second joint'
                  : 'Tap the first joint of the member'
                : 'Tap a member or joint to erase it'}
        </div>
      </div>

      {hint && (
        <div className="text-[11px] font-semibold rounded-lg px-2 py-1" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--line)' }}>
          {hint}
        </div>
      )}
      <div data-testid="canvas-stats" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold mt-4" style={{ color: 'var(--ink-3)' }}>
        <span className="flex items-center gap-1"><Move3d className="w-3 h-3" /> {model.nodes.length} joints</span>
        <span className="flex items-center gap-1"><Minus className="w-3 h-3" /> {model.members.length} members</span>
        <span className="flex items-center gap-1"><Crosshair className="w-3 h-3" /> {isTruss ? 'Pin-jointed truss (2 DOF)' : 'Rigid frame (3 DOF)'}</span>
        <span className="num">{snap} m grid</span>
        <span className="ml-auto no-print">Ctrl+Z undo</span>
      </div>
    </div>
  );
};
