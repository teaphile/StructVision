import React, { useMemo, useRef } from 'react';
import { fmt } from './primitives';

export interface PlotPoint {
  x: number;
  y: number;
}

interface PlotProps {
  points: PlotPoint[];
  L: number;
  title: string;
  unit: string;
  color: string;
  /** draw area filled under (or over) the baseline */
  fill?: boolean;
  /** BMD only: positive plotted downward (RCC tension-side convention) */
  flip?: boolean;
  /** smooth curve or step-preserving line */
  step?: boolean;
  cursorX?: number;
  onCursor?: (x: number) => void;
  height?: number;
  markers?: Array<{ x: number; y: number; label: string; tone?: 'dot' | 'diamond' | 'ring' }>;
  /** extra horizontal reference lines in data units */
  refLines?: Array<{ y: number; label: string; color?: string; dash?: string }>;
  /** force the value axis symmetric range */
  symmetric?: boolean;
  className?: string;
  yFmtDigits?: number;
  showAxisLabels?: boolean;
  hideValues?: boolean;
  /** optional second series drawn behind (e.g. worst-case envelope under the live diagram) */
  ghost?: { points: Array<{ x: number; y: number }>; color: string; label?: string };
}

const VW = 780;

export const Plot: React.FC<PlotProps> = ({
  points,
  L,
  title,
  unit,
  color,
  fill = true,
  flip = false,
  step = false,
  cursorX,
  onCursor,
  height = 132,
  markers = [],
  refLines = [],
  symmetric = false,
  className = '',
  yFmtDigits = 2,
  showAxisLabels = true,
  hideValues = false,
  ghost,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const padL = 44;
  const padR = 14;
  const midY = height / 2;
  const half = height / 2 - 16;
  const plotW = VW - padL - padR;

  const { maxAbs, path, areaPath, minY, maxY, minX, maxX, ghostPath } = useMemo(() => {
    if (!points.length) return { maxAbs: 1, path: '', areaPath: '', minY: 0, maxY: 0, minX: 0, maxX: 0, ghostPath: '' };
    let m = 0;
    let mn = 0;
    let mx = 0;
    let minXv = Infinity;
    let maxXv = -Infinity;
    let minYi = 0;
    let maxYi = 0;
    for (const p of points) {
      if (Math.abs(p.y) > m) m = Math.abs(p.y);
      if (p.y < mn) {
        mn = p.y;
        minYi = p.x;
      }
      if (p.y > mx) {
        mx = p.y;
        maxYi = p.x;
      }
      if (p.x < minXv) minXv = p.x;
      if (p.x > maxXv) maxXv = p.x;
    }
    for (const r of refLines) m = Math.max(m, Math.abs(r.y));
    for (const g of ghost?.points ?? []) m = Math.max(m, Math.abs(g.y));
    const scale = m > 1e-9 ? m : 1;
    const px = (x: number) => padL + (Math.max(0, Math.min(L, x)) / L) * plotW;
    const py = (v: number) => midY - ((flip ? -v : v) / scale) * half;

    let d = '';
    let prevX = -1;
    let prevY = 0;
    points.forEach((p, i) => {
      const X = px(p.x);
      const Y = py(p.y);
      if (i === 0) {
        d += `M ${X.toFixed(2)} ${Y.toFixed(2)}`;
      } else if (step && Math.abs(p.x - prevX) > 1e-9) {
        d += ` L ${X.toFixed(2)} ${prevY.toFixed(2)} L ${X.toFixed(2)} ${Y.toFixed(2)}`;
      } else if (Math.abs(p.y) > 1e-9 && Math.abs((p.y - (points[i - 1]?.y ?? 0)) / scale) > 0.22) {
        // jump detection at coincident x (point load / couple)
        d += ` L ${X.toFixed(2)} ${Y.toFixed(2)}`;
      } else {
        d += ` L ${X.toFixed(2)} ${Y.toFixed(2)}`;
      }
      prevX = p.x;
      prevY = Y;
    });
    const first = points[0];
    const last = points[points.length - 1];
    const area = `${d} L ${px(last.x).toFixed(2)} ${midY} L ${px(first.x).toFixed(2)} ${midY} Z`;
    const gp = (ghost?.points ?? [])
      .map((p, i) => `${i ? 'L' : 'M'} ${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)}`)
      .join(' ');
    return { maxAbs: scale, path: d, areaPath: area, minY: mn, maxY: mx, minX: minYi, maxX: maxYi, ghostPath: gp };
  }, [points, L, flip, step, refLines, plotW, midY, half, ghost]);

  const hoverVal = useMemo(() => {
    if (cursorX === undefined) return null;
    let best = points[0];
    for (const p of points) if (Math.abs(p.x - cursorX) < Math.abs((best?.x ?? 0) - cursorX)) best = p;
    return best ?? null;
  }, [cursorX, points]);

  const gid = `gp-${color.replace(/[^a-z0-9]/gi, '')}-${title.replace(/[^a-z0-9]/gi, '')}`;

  const handleMove = (e: React.PointerEvent) => {
    if (!onCursor || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * VW;
    const x = ((sx - padL) / plotW) * L;
    onCursor(Math.max(0, Math.min(L, x)));
  };

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-0.5 gap-2">
        <span className="text-[11px] font-bold tracking-tight truncate" style={{ color }}>
          {title}
        </span>
        <span className="text-[9.5px] font-semibold shrink-0 num" style={{ color: 'var(--ink-3)' }}>
          {hideValues ? 'peak hidden, read it off the axis' : `max |${fmt(symmetric ? maxAbs : Math.max(Math.abs(minY), Math.abs(maxY)), yFmtDigits)}| ${unit}`}
        </span>
      </div>
      <div className="overflow-x-auto overscroll-x-contain -mx-0.5 px-0.5">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${height}`}
          className="w-full block"
          style={{ minWidth: 540, maxHeight: height * 1.5, touchAction: 'pan-x pan-y', cursor: onCursor ? 'crosshair' : 'default' }}
          onPointerMove={handleMove}
          onPointerDown={handleMove}
        >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="100%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* baseline & frame */}
        <rect x={padL} y={4} width={plotW} height={height - 20} fill="none" stroke="var(--line)" strokeWidth={0.8} />
        <line x1={padL} y1={midY} x2={padL + plotW} y2={midY} stroke="var(--ink-3)" strokeWidth={1.1} />

        {ghostPath && (
          <path d={ghostPath} fill="none" stroke={ghost?.color ?? 'var(--warn)'} strokeWidth={1.6} strokeDasharray="5 4" opacity={0.85} strokeLinejoin="round" />
        )}
        {fill && <path d={areaPath} fill={`url(#${gid})`} stroke="none" />}
        <path d={path} fill="none" stroke={color} strokeWidth={2.1} strokeLinejoin="round" strokeLinecap="round" />
        {ghostPath && ghost?.label && (
          <text x={padL + plotW - 4} y={12} fontSize={9} textAnchor="end" fontWeight={800} fill={ghost.color} paintOrder="stroke" stroke="var(--surface)" strokeWidth={3}>
            {ghost.label}
          </text>
        )}

        {refLines.map((r, i) => {
          const y = midY - ((flip ? -r.y : r.y) / maxAbs) * half;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke={r.color ?? 'var(--warn)'} strokeWidth={1} strokeDasharray={r.dash ?? '4 4'} opacity={0.8} />
              <text x={padL + plotW - 2} y={y - 3} fontSize={9.5} textAnchor="end" fill={r.color ?? 'var(--warn)'} fontWeight={700}>
                {r.label}
              </text>
            </g>
          );
        })}

        {/* markers */}
        {!hideValues && markers.map((m, i) => {
          const X = padL + (Math.max(0, Math.min(L, m.x)) / L) * plotW;
          const Y = midY - ((flip ? -m.y : m.y) / maxAbs) * half;
          return (
            <g key={i}>
              {m.tone === 'diamond' ? (
                <rect x={X - 3.6} y={Y - 3.6} width={7.2} height={7.2} transform={`rotate(45 ${X} ${Y})`} fill="var(--warn)" stroke="var(--canvas)" strokeWidth={1.2} />
              ) : m.tone === 'ring' ? (
                <circle cx={X} cy={Y} r={4} fill="none" stroke="var(--ink-2)" strokeWidth={1.6} />
              ) : (
                <circle cx={X} cy={Y} r={3.6} fill={color} stroke="var(--canvas)" strokeWidth={1.4} />
              )}
              <text
                x={X}
                y={Y - 7}
                fontSize={10}
                textAnchor={X > VW - 90 ? 'end' : 'middle'}
                fontWeight={800}
                fill="var(--ink-2)"
                paintOrder="stroke"
                stroke="var(--canvas)"
                strokeWidth={3}
              >
                {m.label}
              </text>
            </g>
          );
        })}

        {/* cursor */}
        {cursorX !== undefined && hoverVal && (
          <g pointerEvents="none">
            <line
              x1={padL + (cursorX / L) * plotW}
              y1={4}
              x2={padL + (cursorX / L) * plotW}
              y2={height - 16}
              stroke="var(--warn)"
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
            <circle
              cx={padL + (cursorX / L) * plotW}
              cy={midY - ((flip ? -hoverVal.y : hoverVal.y) / maxAbs) * half}
              r={4}
              fill="var(--warn)"
              stroke="var(--canvas)"
              strokeWidth={1.5}
            />
          </g>
        )}

        {/* axis text */}
        {showAxisLabels && (
          <>
            <text x={padL - 4} y={midY + 3} fontSize={10} textAnchor="end" fill="var(--ink-3)" fontWeight={700}>
              0
            </text>
            <text x={padL - 4} y={midY - half + 8} fontSize={10} textAnchor="end" fill="var(--ink-3)" fontWeight={700}>
              {flip ? '-' : '+'}
              {fmt(maxAbs, yFmtDigits)}
            </text>
            <text x={padL - 4} y={midY + half - 2} fontSize={10} textAnchor="end" fill="var(--ink-3)" fontWeight={700}>
              {flip ? '+' : '-'}
              {fmt(maxAbs, yFmtDigits)}
            </text>
            <text x={padL} y={height - 3} fontSize={10} fill="var(--ink-3)" fontWeight={700}>
              0
            </text>
            <text x={padL + plotW} y={height - 3} fontSize={10} fill="var(--ink-3)" textAnchor="end" fontWeight={700}>
              x = {fmt(L, 2)} m
            </text>
            <text x={padL + plotW / 2} y={height - 3} fontSize={10} fill="var(--ink-3)" textAnchor="middle" fontWeight={600} opacity={0.85}>
              x (m)
            </text>
          </>
        )}
      </svg>
      </div>
    </div>
  );
};
