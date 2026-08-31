import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Panel } from "@/components/Panel";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const biasClass = (b: string) =>
  b === "BULLISH" ? "text-bull" : b === "BEARISH" ? "text-bear" : "text-silver";

export function SignalCard({ symbol }: { symbol: string }) {
  const { data } = useQuery({
    queryKey: ["signal", symbol],
    queryFn: () => api.signal(symbol),
    refetchInterval: 12_000,
  });
  if (!data) return null;
  const conviction = Math.round(data.meta_conviction * 100);

  return (
    <Panel title="Signal intelligence" subtitle={`Tier 1 meta-learner · ${data.symbol}`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Conviction</p>
          <p className="num mt-1 text-4xl font-semibold">{data.meta_conviction.toFixed(2)}</p>
          <p className={cn("mt-1 text-xs font-semibold tracking-[0.14em] uppercase", biasClass(data.bias))}>
            {data.bias}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Expiry</p>
          <p className="num mt-1 text-2xl font-semibold text-gold">{data.recommended_expiry}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${conviction}%` }} />
      </div>

      <div className="mt-4 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.candles}>
            <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
            <Area
              type="monotone"
              dataKey="close"
              stroke="var(--color-primary)"
              fill="var(--color-primary)"
              fillOpacity={0.12}
              strokeWidth={1.6}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.horizons.map((h) => (
          <div key={h.horizon} className="rounded-2xl border border-border/70 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{h.horizon} horizon</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full", h.score >= 0.7 ? "bg-bull" : "bg-silver")}
                  style={{ width: `${Math.round(h.score * 100)}%` }}
                />
              </div>
              <span className="num text-xs">{h.score.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Reversal risk</dt>
          <dd className="num mt-0.5 text-bear">{data.reversal_risk_pct.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expected MFE</dt>
          <dd className="num mt-0.5 text-bull">{data.expected_mfe_pips} pips</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expected MAE</dt>
          <dd className="num mt-0.5">{data.expected_mae_pips} pips</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">DXY divergence</dt>
          <dd className={cn("mt-0.5 font-semibold", biasClass(data.dxy_divergence))}>
            {data.dxy_divergence}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
