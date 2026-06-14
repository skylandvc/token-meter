"use client";

import { useEffect, useMemo, useState } from "react";

const LOCAL_USAGE_URLS = [
  "http://127.0.0.1:8766/api/usage",
  "http://127.0.0.1:8765/api/usage",
];
const HOSTED_USAGE_URL = "/usage-snapshot.json";
const CACHE_KEY = "token-meter-cursor-usage";

function formatTokens(value) {
  const num = Number(value) || 0;
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(num >= 10000000000 ? 1 : 2)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(num >= 10000000 ? 1 : 2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 100000 ? 0 : 1)}K`;
  return num.toLocaleString("ja-JP");
}

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString("ja-JP");
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

function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function percent(value, scale) {
  if (!scale) return 0;
  return Math.max(0, Math.min(100, (Number(value || 0) / scale) * 100));
}

function truncateMiddle(text, maxLength) {
  if (!text || text.length <= maxLength) return text || "";
  const head = Math.ceil((maxLength - 1) / 2);
  const tail = Math.floor((maxLength - 1) / 2);
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}

function downloadCanvas(canvas, fileName) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke = "#dde3ea") {
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
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawText(ctx, text, x, y, options = {}) {
  const { size = 24, weight = 600, color = "#111827", align = "left" } = options;
  ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
}

function createCursorImage(usage, cursor) {
  const rows = (cursor.items || []).slice(0, 12);
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 330 + rows.length * 86;
  const ctx = canvas.getContext("2d");
  const scale = Math.max(...rows.map((item) => item.month?.total || 0), 1);

  ctx.fillStyle = "#eef3f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawRoundRect(ctx, 28, 28, 1544, 132, 8, "#ffffff");
  drawText(ctx, "CURSOR USAGE", 60, 54, { size: 16, weight: 800, color: "#2f6fec" });
  drawText(ctx, "Token Meter", 60, 80, { size: 48, weight: 800 });
  drawText(ctx, `推定 / 更新 ${formatClock(usage.generatedAt)} / ${cursor.files || 0} files`, 1540, 88, {
    size: 22,
    color: "#667085",
    align: "right",
  });

  drawRoundRect(ctx, 28, 184, 1544, canvas.height - 218, 8, "#ffffff");
  rows.forEach((item, index) => {
    const y = 220 + index * 86;
    const month = item.month?.total || 0;
    const barWidth = Math.max(6, Math.round((month / scale) * 780));
    drawText(ctx, `${index + 1}`, 60, y + 8, { size: 18, weight: 800, color: "#667085" });
    drawText(ctx, truncateMiddle(item.project || item.title, 30), 100, y, { size: 28, weight: 800 });
    drawText(ctx, truncateMiddle(item.file, 62), 100, y + 36, { size: 16, color: "#667085" });
    drawRoundRect(ctx, 520, y + 12, 800, 22, 11, "#e5e7eb", null);
    drawRoundRect(ctx, 520, y + 12, barWidth, 22, 11, "#2f6fec", null);
    drawText(ctx, formatTokens(month), 1360, y + 2, { size: 34, weight: 800, align: "right" });
    drawText(ctx, `${formatTokens(item.today?.total)} today / ${formatTokens(item.week?.total)} week`, 1540, y + 42, {
      size: 17,
      color: "#667085",
      align: "right",
    });
  });
  drawText(ctx, "Estimated from Cursor agent transcripts, not official Cursor Usage", 60, canvas.height - 44, {
    size: 18,
    weight: 800,
    color: "#667085",
  });
  return canvas;
}

function CursorMetric({ label, value, note }) {
  return (
    <article className="metric-card">
      <div className="metric-card__head">
        <span>{label}</span>
        <b>{note}</b>
      </div>
      <strong>{formatTokens(value)}</strong>
      <div className="bar bar--codex">
        <span style={{ width: "100%" }} />
      </div>
    </article>
  );
}

function CursorRow({ item, scale, rank }) {
  const month = item.month?.total || 0;
  return (
    <article className="project-row">
      <div className="project-rank">{rank}</div>
      <div className="project-main">
        <div className="project-titleline">
          <h2>{item.project || item.title}</h2>
          <strong>{formatTokens(month)}</strong>
        </div>
        <p>{item.file || item.projectPath || "Cursor transcript"}</p>
        <div className="project-bar" aria-label={`${item.project || item.title} ${formatNumber(month)} tokens`}>
          <span style={{ width: `${percent(month, scale)}%` }} />
        </div>
      </div>
      <dl className="project-stats">
        <div>
          <dt>Today</dt>
          <dd>{formatTokens(item.today?.total)}</dd>
        </div>
        <div>
          <dt>Week</dt>
          <dd>{formatTokens(item.week?.total)}</dd>
        </div>
        <div>
          <dt>All</dt>
          <dd>{formatTokens(item.all?.total)}</dd>
        </div>
        <div>
          <dt>Events</dt>
          <dd>{formatNumber(item.all?.events)}</dd>
        </div>
      </dl>
      <div className="project-sources">
        <span>推定トークン / 公式Usageではありません</span>
        <span>Latest {formatDateTime(item.latestAt)}</span>
      </div>
    </article>
  );
}

export default function CursorUsagePanel() {
  const [usage, setUsage] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [connectedUrl, setConnectedUrl] = useState("");
  const [imageStatus, setImageStatus] = useState("");
  const cursor = usage?.cursor || {};
  const items = cursor.items || [];
  const maxMonth = useMemo(() => Math.max(...items.map((item) => item.month?.total || 0), 1), [items]);

  async function fetchUsageFrom(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const candidate = await response.json();
    if (!candidate.cursor?.items) throw new Error(`${url} does not include cursor usage yet`);
    return candidate;
  }

  async function loadHostedUsage() {
    setStatus("loading");
    setError("");
    try {
      const data = await fetchUsageFrom(HOSTED_USAGE_URL);
      setUsage(data);
      setConnectedUrl("Vercel保存版");
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      setStatus("ready");
    } catch {
      setStatus("error");
      setError(
        usage
          ? "Vercel保存版に接続できないため、最後に取得したCursor使用量を表示しています。"
          : "Vercel保存版のCursorデータがまだありません。"
      );
    }
  }

  async function loadLocalUsage() {
    setStatus("loading");
    setError("");
    try {
      let data = null;
      let activeUrl = "";
      let lastError = null;
      for (const url of LOCAL_USAGE_URLS) {
        try {
          data = await fetchUsageFrom(url);
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
      setError("ローカル版に接続できないため、Vercel保存版または最後に取得したCursor使用量を表示しています。");
      loadHostedUsage();
    }
  }

  function saveImage() {
    if (!usage || !items.length) return;
    const canvas = createCursorImage(usage, cursor);
    downloadCanvas(canvas, `token-meter-cursor-${formatDate()}.png`);
    setImageStatus("PNGを保存しました。");
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

  if (!usage) {
    return (
      <section className="panel local-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Cursor</p>
            <h2>Cursor Usage</h2>
          </div>
          <button className="button button--light" onClick={loadLocalUsage} type="button">
            {status === "loading" ? "読み込み中" : "ローカル版から取得"}
          </button>
        </div>
        <p className="muted">{error || "Cursor のローカル推定使用量を読み込んでいます。"}</p>
      </section>
    );
  }

  return (
    <>
      <div className="local-toolbar">
        <div className="local-toolbar__copy">
          <span>
            {error ||
              `Cursor推定使用量を表示中 / 更新 ${formatClock(usage.generatedAt)}${
                connectedUrl ? ` / ${connectedUrl.replace("/api/usage", "")}` : ""
              }`}
          </span>
          <small>{cursor.note || "Cursor agent transcriptから推定しています。"}</small>
          {imageStatus && <small>{imageStatus}</small>}
        </div>
        <div className="local-toolbar__actions">
          <button className="button button--light" onClick={saveImage} type="button">
            PNG保存
          </button>
          <button className="button button--light" onClick={loadLocalUsage} type="button">
            {status === "loading" ? "読み込み中" : "再取得"}
          </button>
        </div>
      </div>

      <section className="project-hero">
        <div>
          <p className="eyebrow">Cursor Estimated Usage</p>
          <h2>Cursor Usage</h2>
          <p>{cursor.note}</p>
        </div>
        <strong>{formatTokens(cursor.totals?.month?.total)}</strong>
      </section>

      <section className="metric-grid" aria-label="Cursor期間別使用量">
        <CursorMetric label="日次" value={cursor.totals?.today?.total} note={`${cursor.totals?.today?.events || 0} events`} />
        <CursorMetric label="週次" value={cursor.totals?.week?.total} note={`${cursor.totals?.week?.events || 0} events`} />
        <CursorMetric label="月次" value={cursor.totals?.month?.total} note={`${cursor.files || 0} files`} />
        <CursorMetric label="平均日次" value={cursor.totals?.averageDay?.total} note={`${cursor.activeDays || 1}日`} />
      </section>

      <section className="project-list" aria-label="Cursor transcript usage">
        {items.length ? (
          items.map((item, index) => (
            <CursorRow item={item} key={item.file || item.sessionId || index} rank={index + 1} scale={maxMonth} />
          ))
        ) : (
          <section className="panel">
            <p className="muted">Cursor の agent transcript がまだ見つかっていません。</p>
          </section>
        )}
      </section>
    </>
  );
}
