import type {
  AgentStatus,
  CycleResponse,
  Health,
  ModelsResponse,
  PerformanceSummary,
  PositionsResponse,
  PretrainRequest,
  PretrainResponse,
  SignalBundle,
  TradesResponse,
} from "./api-types";
import {
  mockHealth,
  mockModels,
  mockPositions,
  mockSignal,
  mockStatus,
  mockSummary,
  mockTrades,
} from "./mock-data";

export const API_BASE =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

export type Source = "live" | "mock";

let lastSource: Source = "mock";
export const getLastSource = () => lastSource;

async function request<T>(path: string, init?: RequestInit, timeoutMs = 4000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    lastSource = "live";
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Calls the backend; falls back to synthetic data so the UI stays usable offline. */
async function withFallback<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(path, init);
  } catch {
    lastSource = "mock";
    return fallback;
  }
}

export const api = {
  health: () => withFallback<Health>("/health", { ...mockHealth, timestamp: new Date().toISOString() }),
  status: () => withFallback<AgentStatus>("/status", mockStatus),
  summary: () => withFallback<PerformanceSummary>("/performance/summary", mockSummary),
  positions: () => withFallback<PositionsResponse>("/positions", mockPositions),
  trades: (limit = 50) =>
    withFallback<TradesResponse>(`/performance/trades?limit=${limit}`, mockTrades),
  models: (symbol?: string) =>
    withFallback<ModelsResponse>(symbol ? `/models?symbol=${symbol}` : "/models", mockModels),
  signal: (symbol = "AAPL") =>
    withFallback<SignalBundle>(`/signal/latest?symbol=${symbol}`, { ...mockSignal, symbol }),

  start: (interval_seconds = 300) =>
    withFallback<{ status: string; loop_state: string; interval_seconds: number }>(
      "/agent/start",
      { status: "started", loop_state: "running", interval_seconds },
      { method: "POST", body: JSON.stringify({ interval_seconds }) },
    ),
  stop: () =>
    withFallback<{ status: string; loop_state: string }>(
      "/agent/stop",
      { status: "stopped", loop_state: "paused" },
      { method: "POST" },
    ),
  runCycle: (symbol: string, dry_run = false) =>
    withFallback<CycleResponse>(
      "/agent/run-cycle",
      {
        status: "success",
        cycle_id: `cyc-${Math.floor(Math.random() * 90000 + 10000)}`,
        executed_action: dry_run ? "NO_TRADE" : "BUY_CALL",
        symbol,
        expiry_selected: "15m",
        meta_conviction: Number((0.6 + Math.random() * 0.35).toFixed(2)),
        timestamp: new Date().toISOString(),
      },
      { method: "POST", body: JSON.stringify({ symbol, dry_run }) },
    ),
  pretrain: (body: PretrainRequest) =>
    withFallback<PretrainResponse>(
      "/models/pretrain",
      {
        checkpoint_id: `chk-${body.symbol.toLowerCase()}-${Math.floor(Math.random() * 90 + 10)}`,
        symbol: body.symbol,
        scope: body.scope,
        experiences_recorded: Math.round(body.num_candles / 55),
        train_steps: body.train_steps,
        final_loss: Number((0.4 / (1 + body.train_steps * 0.6)).toFixed(6)),
        metrics: {
          scaler_fitted: true,
          scaler_n_samples: Math.round(body.num_candles * 0.32),
          val_loss: Number((0.5 / (1 + body.train_steps * 0.6)).toFixed(6)),
          win_rate_pct: Number((55 + Math.random() * 20).toFixed(1)),
          sharpe: Number((0.8 + Math.random() * 1.4).toFixed(2)),
          horizon_alignment: {
            "5m": Number((0.4 + Math.random() * 0.4).toFixed(2)),
            "15m": Number((0.4 + Math.random() * 0.4).toFixed(2)),
            "30m": Number((0.4 + Math.random() * 0.4).toFixed(2)),
            "1h": Number((0.4 + Math.random() * 0.4).toFixed(2)),
          },
          loss_curve: Array.from({ length: Math.max(6, body.train_steps) }, (_, i) =>
            Number((0.42 / (1 + i * 0.5) + 0.001).toFixed(5)),
          ),
        },
      },
      { method: "POST", body: JSON.stringify(body) },
    ),
  activate: (checkpoint_id: string) =>
    withFallback<{ status: string; checkpoint_id: string }>(
      `/models/${checkpoint_id}/activate`,
      { status: "activated", checkpoint_id },
      { method: "POST" },
    ),
  remove: (checkpoint_id: string) =>
    withFallback<{ status: string; checkpoint_id: string }>(
      `/models/${checkpoint_id}`,
      { status: "deleted", checkpoint_id },
      { method: "DELETE" },
    ),
};

export const fmtMoney = (n: number, digits = 2) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

export const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
export const fmtSigned = (n: number) => `${n > 0 ? "+" : ""}${fmtMoney(n)}`;

export const fmtDuration = (sec: number) => {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

export const fmtTime = (t: string) =>
  new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

export const fmtDateTime = (t: string) =>
  new Date(t).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
