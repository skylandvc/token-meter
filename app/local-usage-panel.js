"use client";

import { useEffect, useMemo, useState } from "react";

const LOCAL_USAGE_URLS = [
  "http://127.0.0.1:8766/api/usage",
  "http://127.0.0.1:8765/api/usage",
];
const LOCAL_HEALTH_URLS = [
  "http://127.0.0.1:8766/health",
  "http://127.0.0.1:8765/health",
];
const DEFAULT_LOCAL_USAGE_URL = LOCAL_USAGE_URLS[0];
const CACHE_KEY = "token-meter-local-usage";
const SHARE_URL = "https://token-meterz.vercel.app/?guest=1";

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

function formatShareDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke = "#dde3ea", lineWidth = 1) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawText(ctx, text, x, y, options = {}) {
  const {
    size = 24,
    weight = 600,
    color = "#111827",
    align = "left",
    baseline = "top",
  } = options;
  ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

function drawGauge(ctx, x, y, width, value, scale, color, accent) {
  drawRoundRect(ctx, x, y, width, 10, 5, "#e5e7eb", null);
  const filled = Math.max(4, Math.min(width, Math.round(width * (scale ? value / scale : 0))));
  drawRoundRect(ctx, x, y, filled, 10, 5, color, null);
  if (accent && filled > 32) {
    drawRoundRect(ctx, x + filled - 32, y, 32, 10, 5, accent, null);
  }
}

function drawMetricCard(ctx, x, y, width, label, value, note, ratio, color, accent) {
  drawRoundRect(ctx, x, y, width, 122, 8, "#ffffff");
  drawText(ctx, label, x + 22, y + 20, { size: 20, color: "#667085" });
  drawText(ctx, note, x + width - 22, y + 20, { size: 18, color: "#2f6fec", align: "right" });
  drawText(ctx, formatTokens(value), x + 22, y + 52, { size: 46, weight: 800 });
  drawGauge(ctx, x + 22, y + 98, width - 44, ratio, 100, color, accent);
}

function drawCapacityCard(ctx, x, y, width, title, label, plan, windows, tone) {
  const color = tone === "claude" ? "#f0a429" : "#2f6fec";
  drawRoundRect(ctx, x, y, width, 214, 8, "#ffffff");
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 5);
  drawText(ctx, label.toUpperCase(), x + 28, y + 34, { size: 16, weight: 800, color: "#2f6fec" });
  drawText(ctx, plan || "--", x + width - 28, y + 34, { size: 18, color: "#667085", align: "right" });
  drawText(ctx, title, x + 28, y + 60, { size: 36, weight: 800 });

  (windows || []).slice(0, 2).forEach((item, index) => {
    const top = y + 112 + index * 62;
    const hasPercent = typeof item.usedPercent === "number";
    drawText(ctx, item.label, x + 28, top, { size: 18, weight: 800 });
    drawText(ctx, formatResetDetail(item), x + 28, top + 24, { size: 16, color: "#667085" });
    drawGauge(ctx, x + 230, top + 12, 220, hasPercent ? item.usedPercent : 0, 100, color, tone === "claude" ? "#23a36b" : null);
    drawText(ctx, formatCapacityLabel(item), x + width - 28, top + 6, { size: 18, weight: 800, align: "right" });
  });
}

function drawAgentPanel(ctx, x, y, width, title, label, source, tone, activeDays) {
  const color = tone === "claude" ? "#f0a429" : "#2f6fec";
  const usage = usageWithAverage(source || {}, activeDays);
  const scale = Math.max(
    usage.today.total || 0,
    usage.week.total || 0,
    usage.month.total || 0,
    usage.averageDay.total || 0,
    1
  );
  drawRoundRect(ctx, x, y, width, 208, 8, "#ffffff");
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 5);
  drawText(ctx, label.toUpperCase(), x + 22, y + 24, { size: 16, weight: 800, color: "#2f6fec" });
  drawText(ctx, `${usage.all.events || 0} events`, x + width - 22, y + 24, { size: 18, color: "#667085", align: "right" });
  drawText(ctx, title, x + 22, y + 48, { size: 34, weight: 800 });

  const metrics = [
    ["日次", usage.today.total, color],
    ["週次", usage.week.total, color],
    ["月次", usage.month.total, color],
    ["平均日次", usage.averageDay.total, "#0891b2"],
  ];
  metrics.forEach(([metric, value, metricColor], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cardX = x + 22 + col * ((width - 58) / 2 + 14);
    const cardY = y + 92 + row * 58;
    const cardW = (width - 58) / 2;
    drawRoundRect(ctx, cardX, cardY, cardW, 48, 6, "#fbfdff");
    drawText(ctx, metric, cardX + 14, cardY + 14, { size: 14, color: "#667085" });
    drawText(ctx, formatTokens(value), cardX + cardW - 14, cardY + 10, { size: 28, weight: 800, align: "right" });
    drawGauge(ctx, cardX + 14, cardY + 36, cardW - 28, value, scale, metricColor, tone === "claude" ? "#23a36b" : null);
  });
}

function createShareImage(usage) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1320;
  const ctx = canvas.getContext("2d");
  const totals = usage.totals || {};
  const today = totals.today || {};
  const week = totals.week || {};
  const month = totals.month || {};
  const avg = totals.averageDay || {};
  const sources = usage.sources || {};
  const claudeToday = sources.claude?.today || {};
  const codexToday = sources.codex?.today || {};
  const scale = Math.max(today.total || 0, week.total || 0, month.total || 0, avg.total || 0, 1);
  const activeDays = usage.periods?.activeDays || 1;

  ctx.fillStyle = "#eef3f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawRoundRect(ctx, 24, 24, 1152, 92, 8, "#ffffff");
  drawText(ctx, "PUBLIC DASHBOARD", 48, 44, { size: 14, weight: 800, color: "#2f6fec" });
  drawText(ctx, "Token Meter", 48, 64, { size: 42, weight: 800 });
  drawText(ctx, "このPCのローカルログだけを集計", 1148, 68, { size: 20, color: "#667085", align: "right" });

  drawRoundRect(ctx, 24, 140, 1152, 54, 6, "#ffffff");
  drawText(ctx, `ローカル使用量を表示中 / 更新 ${formatClock(usage.generatedAt)} / ${SHARE_URL}`, 48, 160, {
    size: 17,
    color: "#667085",
  });

  drawCapacityCard(ctx, 24, 218, 564, "Claude Code Capacity", "Claude Code", usage.capacity?.claude?.planType, usage.capacity?.claude?.windows, "claude");
  drawCapacityCard(ctx, 612, 218, 564, "Codex Capacity", "Codex", usage.capacity?.codex?.planType, usage.capacity?.codex?.windows, "codex");

  drawRoundRect(ctx, 24, 456, 1152, 260, 8, "#ffffff");
  drawText(ctx, "今日の消費量", 72, 508, { size: 20, color: "#667085" });
  drawText(ctx, formatTokens(today.total), 72, 548, { size: 86, weight: 800 });
  drawText(ctx, `Codex + Claude Code / ${today.events || 0} events`, 72, 646, { size: 18, color: "#667085" });
  drawText(ctx, "この画面を開いているPCのローカルログだけを集計しています。", 72, 676, {
    size: 17,
    color: "#667085",
  });

  drawRoundRect(ctx, 484, 568, 304, 112, 6, "#fbfdff");
  ctx.fillStyle = "#f0a429";
  ctx.fillRect(484, 568, 304, 4);
  drawText(ctx, "Claude Code", 508, 590, { size: 17, weight: 800 });
  drawText(ctx, formatTokens(claudeToday.total), 508, 620, { size: 46, weight: 800 });
  drawText(ctx, `このPC / ${claudeToday.events || 0} events`, 508, 664, { size: 15 });

  drawRoundRect(ctx, 808, 568, 304, 112, 6, "#fbfdff");
  ctx.fillStyle = "#2f6fec";
  ctx.fillRect(808, 568, 304, 4);
  drawText(ctx, "Codex", 832, 590, { size: 17, weight: 800 });
  drawText(ctx, formatTokens(codexToday.total), 832, 620, { size: 46, weight: 800 });
  drawText(ctx, `このPC / ${codexToday.events || 0} events`, 832, 664, { size: 15 });

  drawMetricCard(ctx, 24, 740, 270, "日次", today.total, ratioLabel(today.total, scale, "相対"), percent(today.total, scale), "#2f6fec", "#f0a429");
  drawMetricCard(ctx, 318, 740, 270, "週次", week.total, ratioLabel(week.total, scale), percent(week.total, scale), "#2f6fec", "#f0a429");
  drawMetricCard(ctx, 612, 740, 270, "月次", month.total, ratioLabel(month.total, scale), percent(month.total, scale), "#2f6fec", "#f0a429");
  drawMetricCard(ctx, 906, 740, 270, "平均日次", avg.total, `${activeDays}日`, percent(avg.total, scale), "#0891b2");

  drawAgentPanel(ctx, 24, 886, 564, "Claude Code Usage", "Claude Code", sources.claude, "claude", activeDays);
  drawAgentPanel(ctx, 612, 886, 564, "Codex Usage", "Codex", sources.codex, "codex", activeDays);

  drawText(ctx, "Token Meter", 48, 1248, { size: 22, weight: 800, color: "#667085" });
  drawText(ctx, SHARE_URL, 1148, 1248, { size: 20, color: "#667085", align: "right" });
  return canvas;
}

function downloadCanvas(canvas, fileName) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function buildTweetText() {
  return `Token Meterを使ってみた #TokenMeter ${SHARE_URL}`;
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
        <p className="scope-note">
          この画面を開いているPCのローカルログだけを集計しています。別PCや他メンバーの使用量は含みません。
        </p>
      </div>
      <div className="today-split">
        <article className="today-source today-source--claude">
          <span>Claude Code</span>
          <strong>{formatTokens(claudeToday.total)}</strong>
          <small>このPC / {claudeToday.events || 0} events</small>
        </article>
        <article className="today-source today-source--codex">
          <span>Codex</span>
          <strong>{formatTokens(codexToday.total)}</strong>
          <small>このPC / {codexToday.events || 0} events</small>
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
  const [connectedUrl, setConnectedUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  const updatedAt = useMemo(() => formatClock(usage?.generatedAt), [usage]);

  async function loadLocalUsage() {
    setStatus("loading");
    setError("");
    try {
      let data = null;
      let activeUrl = "";
      let lastError = null;

      for (const url of LOCAL_USAGE_URLS) {
        try {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.json();
          activeUrl = url;
          break;
        } catch (caught) {
          lastError = caught;
        }
      }

      if (!data) throw lastError || new Error("Local Token Meter is not reachable");

      setUsage(data);
      setConnectedUrl(activeUrl);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      setStatus("ready");
    } catch {
      setStatus("error");
      setError(
        usage
          ? "ローカル版に接続できないため、最後に取得した使用量を表示しています。"
          : "ローカル版の自動起動が未設定か、ブラウザから127.0.0.1:8766 / 8765へ接続できません。"
      );
    }
  }

  function shareToX() {
    if (!usage) return;
    const canvas = createShareImage(usage);
    downloadCanvas(canvas, `token-meter-${formatShareDate()}.png`);
    const params = new URLSearchParams({
      text: buildTweetText(usage),
      url: SHARE_URL,
    });
    window.open(`https://twitter.com/intent/tweet?${params.toString()}`, "_blank", "noopener,noreferrer");
    setShareStatus("PNGを保存しました。Xの投稿画面で画像を添付してください。");
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
          <div className="local-toolbar__copy">
            <span>
              {error ||
                `ローカル使用量を表示中 / 更新 ${updatedAt}${
                  connectedUrl ? ` / ${connectedUrl.replace("/api/usage", "")}` : ""
                }`}
            </span>
            {shareStatus && <small>{shareStatus}</small>}
          </div>
          <div className="local-toolbar__actions">
            <button className="button button--light" onClick={shareToX} type="button">
              スクショをXで投稿
            </button>
            <button className="button button--light" onClick={loadLocalUsage} type="button">
              {status === "loading" ? "読み込み中" : "再取得"}
            </button>
          </div>
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
        既定の接続先は <code>{DEFAULT_LOCAL_USAGE_URL}</code> です。
        8766が見つからない場合は <code>{LOCAL_USAGE_URLS[1]}</code> も自動で試します。
      </p>
      {error && (
        <div className="diagnostic-box">
          <p className="error-text">{error}</p>
          <p>
            別PCでは、そのPC自身でローカル版 Token Meter を起動する必要があります。
            まず同じブラウザで確認URLを開いて、<code>{"{\"ok\": true}"}</code> が出るか確認してください。
          </p>
          <div className="diagnostic-actions">
            <a className="button button--light" href={LOCAL_HEALTH_URLS[0]} rel="noreferrer" target="_blank">
              8766を確認
            </a>
            <a className="button button--light" href={LOCAL_HEALTH_URLS[1]} rel="noreferrer" target="_blank">
              8765を確認
            </a>
            <a
              className="button button--light"
              href="https://github.com/skylandvc/token-meter#セットアップ"
              rel="noreferrer"
              target="_blank"
            >
              セットアップ手順
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
