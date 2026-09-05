import { formatUsd } from "@/lib/pricing";
import type { UsageSummary } from "@/lib/usage/server";

/** Monthly AI-spend meter. Amber at >=80% of budget, red at >=100%. */
export function BudgetBar({
  usage,
  compact = false,
}: {
  usage: UsageSummary;
  compact?: boolean;
}) {
  const pct = Math.min(usage.percent, 1) * 100;
  const barColor = usage.over
    ? "bg-danger"
    : usage.warn
      ? "bg-brand"
      : "bg-success";
  const label = usage.over
    ? "Over budget"
    : usage.warn
      ? "Approaching budget"
      : "On track";

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className={compact ? "text-muted" : "font-medium"}>
          {compact ? "AI spend this month" : "This month"}
        </span>
        <span className="tabular-nums">
          <span className="font-semibold">{formatUsd(usage.total)}</span>
          <span className="text-muted"> / {formatUsd(usage.budget)}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!compact && (
        <p
          className={`mt-1 text-xs ${
            usage.over
              ? "text-danger"
              : usage.warn
                ? "text-brand-strong"
                : "text-muted"
          }`}
        >
          {label}
          {usage.over && " — new AI features will keep working, but you may want to raise the budget or ease off."}
        </p>
      )}
    </div>
  );
}
