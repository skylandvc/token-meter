"use client";

import { useEffect, useMemo, useState } from "react";

const LOCAL_USAGE_URL = "http://127.0.0.1:8766/api/usage";
const CACHE_KEY = "token-meter-local-usage";

function formatTokens(value) {
  const num = Number(value) || 0;
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(num >= 10000000000 ? 1 : 2)}B`;
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(num >= 10000000 ? 1 : 2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(num >= 100000 ? 0 : 1)}K`;
  }
  return num.toLocaleString("ja-JP");
}

function percent(value, scale) {
  if (!scale) return 0;
  return Math.max(0, Math.min(100, (Number(value || 0) / scale) * 100));
}

function ratioLabel(value, scale, prefix = "相対") {
  if (!scale) return `${prefix} --`;
  if (!value) return "なし";
  if (value >= scale * 0.995) return "最大";
  return `${prefix} ${Math.round((value / scale) * 100)}%`;
}

function formatClock(iso) {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function formatDateTime(iso) {
  if (!iso) return "--";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatCapacityLabel(item) {
  if (typeof item.usedPercent === "number") {
    return `${Math.round(item.usedPercent)}% 使用済み`;
  }
  if (item.limitTokens) {
    return `${formatTokens(item.usedTokens || 0)} / ${formatTokens(item.limitTokens)}`;
  }
  return item.usedTokens ? `${formatTokens(item.usedTokens)} 使用` : "上限未設定";
}

function formatResetDetail(item) {
  if (!item.resetsAtIso) return item.detail;
  if (new Date(item.resetsAtIso).getTime() < Date.now()) return "次回リセット確認待ち";
  return `${formatDateTime(item.resetsAtIso)} にリセット`;
}

function Bar({ value, scale, tone = "" }) {
  return (
    <div className={`bar ${tone ? `bar--${tone}` : ""}`}>
      <span style={{ width: `${percent(value, scale)}%` }} />
    </div>
  );
}

function CapacityWindow({ item, tone }) {
  const hasPercent = typeof item.usedPercent === "number";
  return (
    <div className={`capacity-window${hasPercent ? "" : " capacity-window--unknown"}`}>
      <div className="capacity-window__text">
        <strong>{item.label}</strong>
        <span>{formatResetDetail(item)}</span>
      </div>
      <b>{formatCapacityLabel(item)}</b>
      <div className={`capacity-gauge capacity-gauge--${tone}`}>
        <span style={{ width: `${hasPercent ? Math.max(0, Math.min(100, item.usedPercent)) : 0}%` }} />
      </div>
    </div>
  );
}

function CapacityCard({ title, label, capacity, tone }) {
  const windows = capacity?.windows || [];
  return (
    <article className={`capacity-card capacity-card--${tone}`}>
      <div className="capacity-card__head">
        <div>
          <p className="eyebrow">{label}</p>
          <h2>{title}</h2>
        </div>
        <span>{capacity?.planType || "--"}</span>
      </div>
      <div className="capacity-list">
        {windows.length ? (
          windows.map((item) => <CapacityWindow item={item} key={item.id} tone={tone} />)
        ) : (
          <p className="muted">{capacity?.note || "使用制限情報はまだありません。"}</p>
        )}
      </div>
    </article>
  );
}

function TodayPanel({ usage }) {
  const totals = usage.totals || {};
  const sources = usage.sources || {};
  const today = totals.today || {};
  const claudeToday = sources.claude?.today || {};
  const codexToday = sources.codex?.today || {};

  return (
    <section className="hero-panel">
      <div className="hero-copy">
        <span>今日の消費量</span>
        <strong>{formatTokens(today.total)}</strong>
        <p>Codex + Claude Code / {today.events || 0} events</p>
      </div>
      <div className="today-split">
        <article className="today-source today-source--claude">
          <span>Claude Code</span>
          <strong>{formatTokens(claudeToday.total)}</strong>
          <small>{claudeToday.events || 0} events</small>
        </article>
        <article className="today-source today-source--codex">
          <span>Codex</span>
          <strong>{formatTokens(codexToday.total)}</strong>
          <small>{codexToday.events || 0} events</small>
        </article>
      </div>
    </section>
  );
}

function MetricTiles({ usage }) {
  const totals = usage.totals || {};
  const today = totals.today || {};
  const week = totals.week || {};
  const month = totals.month || {};
  const avg = totals.averageDay || {};
  const scale = Math.max(today.total || 0, week.total || 0, month.total || 0, avg.total || 0, 1);
  const items = [
    ["日次", today.total, ratioLabel(today.total, scale, "相対"), ""],
    ["週次", week.total, ratioLabel(week.total, scale), ""],
    ["月次", month.total, ratioLabel(month.total, scale), ""],
    ["平均日次", avg.total, `${usage.periods?.activeDays || 1}日`, "calm"],
  ];

  return (
    <section className="metric-grid" aria-label="期間別使用量">
      {items.map(([label, value, note, tone]) => (
        <article className="metric-card" key={label}>
          <div className="metric-card__head">
            <span>{label}</span>
            <b>{note}</b>
          </div>
          <strong>{formatTokens(value)}</strong>
          <Bar value={value} scale={scale} tone={tone} />
        </article>
      ))}
    </section>
  );
}

function usageWithAverage(source, activeDays) {
  const all = source.all || {};
  return {
    today: source.today || {},
    week: source.week || {},
    month: source.month || {},
    averageDay: {
      total: Math.round((all.total || 0) / Math.max(1, activeDays || 1)),
      events: Math.round(((all.events || 0) / Math.max(1, activeDays || 1)) * 10) / 10,
    },
    all,
  };
}

function AgentMetric({ label, usage, scale, tone }) {
  const total = usage.total || 0;
  return (
    <div className="agent-metric">
      <div className="agent-metric__top">
        <span>{label}</span>
        <b>{formatTokens(total)}</b>
      </div>
      <Bar value={total} scale={scale} tone={tone} />
    </div>
  );
}

function AgentPanel({ title, label, source, tone, activeDays }) {
  const usage = usageWithAverage(source || {}, activeDays);
  const scale = Math.max(
    usage.today.total || 0,
    usage.week.total || 0,
    usage.month.total || 0,
    usage.averageDay.total || 0,
    1
  );
  const metrics = [
    ["日次", usage.today, tone],
    ["週次", usage.week, tone],
    ["月次", usage.month, tone],
    ["平均日次", usage.averageDay, "calm"],
  ];

  return (
    <article className={`agent-panel agent-panel--${tone}`}>
      <div className="agent-head">
        <div>
          <p className="eyebrow">{label}</p>
          <h2>{title}</h2>
        </div>
        <span>{usage.all.events || 0} events</span>
      </div>
      <div className="agent-metrics">
        {metrics.map(([metricLabel, metricUsage, metricTone]) => (
          <AgentMetric
            key={metricLabel}
            label={metricLabel}
            usage={metricUsage}
            scale={scale}
            tone={metricTone}
          />
        ))}
      </div>
    </article>
  );
}

function SourceRow({ label, source }) {
  const today = source?.today || {};
  const week = source?.week || {};
  const month = source?.month || {};
  const all = source?.all || {};
  return (
    <div className="source-row">
      <div>
        <strong>{label}</strong>
        <span>{all.events || 0} events</span>
      </div>
      <dl>
        <dt>日次</dt>
        <dd>{formatTokens(today.total)}</dd>
        <dt>週次</dt>
        <dd>{formatTokens(week.total)}</dd>
        <dt>月次</dt>
        <dd>{formatTokens(month.total)}</dd>
      </dl>
    </div>
  );
}

function SourcePanel({ usage }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Source</h2>
        <span>{usage.files?.claude || 0} Claude / {usage.files?.codex || 0} Codex</span>
      </div>
      <div className="source-list">
        <SourceRow label="Claude Code" source={usage.sources?.claude} />
        <SourceRow label="Codex" source={usage.sources?.codex} />
      </div>
    </section>
  );
}

function ChartPanel({ usage }) {
  const series = usage.series || { days: [], max: 1 };
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Last 30 Days</h2>
        <span>JST</span>
      </div>
      <div className="chart">
        {(series.days || []).map((day) => {
          const height = Math.max(3, Math.round(((day.total || 0) / (series.max || 1)) * 100));
          const date = new Date(`${day.date}T00:00:00+09:00`);
          const label = `${date.getMonth() + 1}/${date.getDate()}`;
          return (
            <div className="day" key={day.date} title={`${day.date} ${formatTokens(day.total)} tokens`}>
              <span style={{ height: `${height}%` }} />
              <b>{label}</b>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CodexLimitPanel({ usage }) {
  const limits = usage.rateLimits;
  return (
    <section className="panel panel--limit">
      <div className="panel-head">
        <h2>Codex Limit</h2>
        <span>{limits?.plan_type || "--"}</span>
      </div>
      <div className="limit-list">
        {limits ? (
          ["primary", "secondary"].map((key) => {
            const item = limits[key] || {};
            const used = Number(item.used_percent) || 0;
            return (
              <div className="limit-row" key={key}>
                <div>
                  <strong>{key === "primary" ? "Current session" : "Weekly window"}</strong>
                  <span>{item.window_minutes || "--"} min / reset {formatDateTime(item.resetsAtIso)}</span>
                </div>
                <b>{used.toFixed(0)}%</b>
                <Bar value={used} scale={100} tone="codex" />
              </div>
            );
          })
        ) : (
          <p className="muted">Codex の rate limit 情報はまだ見つかっていません。</p>
        )}
      </div>
    </section>
  );
}

function FullLocalDashboard({ usage }) {
  const activeDays = usage.periods?.activeDays || 1;
  return (
    <>
      <section className="capacity-grid">
        <CapacityCard
          title="Claude Code Capacity"
          label="Claude Code"
          capacity={usage.capacity?.claude}
          tone="claude"
        />
        <CapacityCard
          title="Codex Capacity"
          label="Codex"
          capacity={usage.capacity?.codex}
          tone="codex"
        />
      </section>
      <TodayPanel usage={usage} />
      <MetricTiles usage={usage} />
      <section className="agent-grid">
        <AgentPanel
          title="Claude Code Usage"
          label="Claude Code"
          source={usage.sources?.claude}
          tone="claude"
          activeDays={activeDays}
        />
        <AgentPanel
          title="Codex Usage"
          label="Codex"
          source={usage.sources?.codex}
          tone="codex"
          activeDays={activeDays}
        />
      </section>
      <section className="split">
        <SourcePanel usage={usage} />
        <ChartPanel usage={usage} />
      </section>
      <CodexLimitPanel usage={usage} />
    </>
  );
}

export default function LocalUsagePanel() {
  const [usage, setUsage] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const updatedAt = useMemo(() => formatClock(usage?.generatedAt), [usage]);

  async function loadLocalUsage() {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch(LOCAL_USAGE_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setUsage(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      setStatus("ready");
    } catch {
      setStatus("error");
      setError(
        usage
          ? "ローカル版に接続できないため、最後に取得した使用量を表示しています。"
          : "ローカル版の自動起動が未設定か、ブラウザから127.0.0.1:8766へ接続できません。"
      );
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        setUsage(JSON.parse(cached));
      } catch {
        localStorage.removeItem(CACHE_KEY);
      }
    }
    loadLocalUsage();
  }, []);

  if (usage) {
    return (
      <>
        <div className="local-toolbar">
          <span>{error || `ローカル使用量を表示中 / 更新 ${updatedAt}`}</span>
          <button className="button button--light" onClick={loadLocalUsage} type="button">
            {status === "loading" ? "読み込み中" : "再取得"}
          </button>
        </div>
        <FullLocalDashboard usage={usage} />
      </>
    );
  }

  return (
    <section className="panel local-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Local bridge</p>
          <h2>このPCのローカル使用量</h2>
        </div>
        <button className="button button--light" onClick={loadLocalUsage} type="button">
          {status === "loading" ? "読み込み中" : "ローカル版から取得"}
        </button>
      </div>
      <p className="muted">
        各自のPCでローカル版 Token Meter を自動起動に設定しておくと、ここに使用量が出ます。
        既定の接続先は <code>{LOCAL_USAGE_URL}</code> です。
      </p>
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
