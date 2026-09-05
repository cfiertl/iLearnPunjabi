"use client";

import { useState } from "react";
import type { WeekPoint } from "@/lib/stats/server";

// One series, so no legend — the heading names it. Marks use the app's indigo
// accent, the same hue as the "Right words, wrong agreement" button that
// produces this data; chrome stays in recessive text tokens.

const W = 600;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 30, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function fmtWeek(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function AgreementChart({ weeks }: { weeks: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const points = weeks.map((w, i) => {
    const rate = w.total > 0 ? w.agreement / w.total : 0;
    return {
      ...w,
      rate,
      x: PAD.left + (weeks.length === 1 ? PLOT_W / 2 : (i / (weeks.length - 1)) * PLOT_W),
      y: PAD.top + PLOT_H - rate * PLOT_H,
    };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const active = hover !== null ? points[hover] : null;
  const last = points[points.length - 1];

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let nearest = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(points[nearest].x - x)) nearest = i;
    });
    setHover(nearest);
  }

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Agreement-fail rate by week. Latest ${Math.round(last.rate * 100)} percent.`}
      >
        {/* recessive gridlines — solid hairlines, never dashed */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.top + PLOT_H - t * PLOT_H;
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--muted)"
              >
                {Math.round(t * 100)}%
              </text>
            </g>
          );
        })}

        {points.length > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Past ~26 weeks the markers would collide (they touch at 52), so the
            line carries the shape on its own and only the hovered week gets a
            dot. */}
        {points.map((p, i) =>
          points.length <= 26 || hover === i ? (
            <circle
              key={p.weekStart}
              cx={p.x}
              cy={p.y}
              r={hover === i ? 6 : 4.5}
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          ) : null,
        )}

        {/* x labels: first and last only, so they cannot collide */}
        {points.length > 0 && (
          <>
            <text
              x={points[0].x}
              y={H - 8}
              textAnchor="start"
              fontSize="11"
              fill="var(--muted)"
            >
              {fmtWeek(points[0].weekStart)}
            </text>
            {points.length > 1 && (
              <text
                x={last.x}
                y={H - 8}
                textAnchor="end"
                fontSize="11"
                fill="var(--muted)"
              >
                {fmtWeek(last.weekStart)}
              </text>
            )}
          </>
        )}

        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            stroke="var(--muted)"
            strokeWidth="1"
          />
        )}

        <rect
          x={PAD.left}
          y={PAD.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      <figcaption
        className="mt-1 min-h-[1.25rem] text-center text-xs text-muted"
        aria-live="polite"
      >
        {active ? (
          <>
            Week of {fmtWeek(active.weekStart)} —{" "}
            <span className="font-semibold text-foreground">
              {Math.round(active.rate * 100)}%
            </span>{" "}
            agreement ({active.agreement} of {active.total} reviews)
          </>
        ) : (
          "Hover a point for that week's numbers"
        )}
      </figcaption>
    </figure>
  );
}
