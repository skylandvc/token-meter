"use client";

import { useEffect, useMemo, useState } from "react";

const LOCAL_USAGE_URLS = [
  "http://127.0.0.1:8766/api/usage",
  "http://127.0.0.1:8765/api/usage",
];
const HOSTED_USAGE_URL = "/usage-snapshot.json";
const CACHE_KEY = "token-meter-thread-usage";

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

function formatShortDateTime(iso) {
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

function truncateMiddle(text, maxLength) {
  if (!text || text.length <= maxLength) return text || "";
  const head = Math.ceil((maxLength - 1) / 2);
  const tail = Math.floor((maxLength - 1) / 2);
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}

function createThreadsImage(usage, threads) {
  const rows = threads.slice(0, 12);
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 300 + rows.length * 90;
  const ctx = canvas.getContext("2d");
  const scale = Math.max(...rows.map((item) => item.month?.total || 0), 1);

  ctx.fillStyle = "#eef3f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawRoundRect(ctx, 28, 28, 1544, 124, 8, "#ffffff");
  drawText(ctx, "CODEX CHAT TOKENS", 60, 54, { size: 16, weight: 800, color: "#2f6fec" });
  drawText(ctx, "Token Meter", 60, 78, { size: 48, weight: 800 });
  drawText(ctx, `更新 ${formatClock(usage.generatedAt)} / 月間トークン順`, 1540, 86, {
    size: 22,
    color: "#667085",
    align: "right",
  });

  drawRoundRect(ctx, 28, 176, 1544, canvas.height - 210, 8, "#ffffff");
  rows.forEach((thread, index) => {
    const y = 212 + index * 90;
    const month = thread.month?.total || 0;
    const barWidth = Math.max(6, Math.round((month / scale) * 760));
    drawText(ctx, `${index + 1}`, 60, y + 8, { size: 18, weight: 800, color: "#667085" });
    drawText(ctx, truncateMiddle(thread.title, 34), 100, y, { size: 28, weight: 800 });
    drawText(ctx, truncateMiddle(`${thread.project} / ${thread.projectPath || thread.sessionId}`, 58), 100, y + 36, {
      size: 16,
      color: "#667085",
    });
    drawRoundRect(ctx, 550, y + 12, 780, 22, 11, "#e5e7eb", null);
    drawRoundRect(ctx, 550, y + 12, barWidth, 22, 11, "#2f6fec", null);
    drawText(ctx, formatTokens(month), 1370, y + 2, { size: 34, weight: 800, align: "right" });
    drawText(ctx, `${formatTokens(thread.today?.total)} today / latest ${formatShortDateTime(thread.latestAt)}`, 1540, y + 42, {
      size: 17,
      color: "#667085",
      align: "right",
    });
  });

  drawText(ctx, "Token Meter / local Codex logs only", 60, canvas.height - 44, {
    size: 18,
    weight: 800,
    color: "#667085",
  });
  return canvas;
}

function ThreadRow({ thread, scale, rank }) {
  const month = thread.month?.total || 0;
  return (
    <article className="project-row thread-row">
      <div className="project-rank">{rank}</div>
      <div className="project-main">
        <div className="project-titleline">
          <h2>{thread.title}</h2>
          <strong>{formatTokens(month)}</strong>
        </div>
        <p>{thread.project} / {thread.projectPath || thread.sessionId}</p>
        <div className="project-bar" aria-label={`${thread.title} ${formatNumber(month)} tokens`}>
          <span style={{ width: `${percent(month, scale)}%` }} />
        </div>
      </div>
      <dl className="project-stats">
        <div>
          <dt>Today</dt>
          <dd>{formatTokens(thread.today?.total)}</dd>
        </div>
        <div>
          <dt>Week</dt>
          <dd>{formatTokens(thread.week?.total)}</dd>
        </div>
        <div>
          <dt>All</dt>
          <dd>{formatTokens(thread.all?.total)}</dd>
        </div>
        <div>
          <dt>Events</dt>
          <dd>{formatNumber(thread.all?.events)}</dd>
        </div>
      </dl>
      <div className="project-sources">
        <span>Latest {formatShortDateTime(thread.latestAt)}</span>
        <span>Session {String(thread.sessionId || "").slice(0, 8)}</span>
      </div>
    </article>
  );
}

export default function ThreadUsagePanel() {
  const [usage, setUsage] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [connectedUrl, setConnectedUrl] = useState("");
  const [imageStatus, setImageStatus] = useState("");
  const threads = usage?.threads?.items || [];
  const maxMonth = useMemo(
    () => Math.max(...threads.map((thread) => thread.month?.total || 0), 1),
    [threads]
  );

  async function fetchUsageFrom(url, requiredKey) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const candidate = await response.json();
    if (!candidate[requiredKey]?.items) {
      throw new Error(`${url} does not include ${requiredKey} usage yet`);
    }
    return candidate;
  }

  async function loadHostedUsage() {
    setStatus("loading");
    setError("");
    try {
      const data = await fetchUsageFrom(HOSTED_USAGE_URL, "threads");
      setUsage(data);
      setConnectedUrl("Vercel保存版");
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      setStatus("ready");
    } catch {
      setStatus("error");
      setError(
        usage
          ? "Vercel保存版に接続できないため、最後に取得したチャット別使用量を表示しています。"
          : "Vercel保存版のチャット別データがまだありません。"
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
          data = await fetchUsageFrom(url, "threads");
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
      setError("ローカル版に接続できないため、Vercel保存版または最後に取得したチャット別使用量を表示しています。");
    }
  }

  function saveImage() {
    if (!usage || !threads.length) return;
    const canvas = createThreadsImage(usage, threads);
    downloadCanvas(canvas, `token-meter-threads-${formatDate()}.png`);
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
    loadHostedUsage();
  }, []);

  if (!usage) {
    return (
      <section className="panel local-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Local bridge</p>
            <h2>チャット別使用量</h2>
          </div>
          <button className="button button--light" onClick={loadHostedUsage} type="button">
            {status === "loading" ? "読み込み中" : "Vercel保存版から取得"}
          </button>
        </div>
        <p className="muted">{error || "Vercelに保存したCodexチャット別データを取得します。"}</p>
      </section>
    );
  }

  return (
    <>
      <div className="local-toolbar">
        <div className="local-toolbar__copy">
          <span>
            {error ||
              `チャット別使用量 / 更新 ${formatClock(usage.generatedAt)}${
                connectedUrl ? ` / ${connectedUrl.replace("/api/usage", "")}` : ""
              }`}
          </span>
          {imageStatus && <small>{imageStatus}</small>}
        </div>
        <div className="local-toolbar__actions">
          <button className="button button--light" onClick={saveImage} type="button">
            PNGを保存
          </button>
          <button className="button button--light" onClick={loadLocalUsage} type="button">
            {status === "loading" ? "読み込み中" : "ローカル版で更新"}
          </button>
          <button className="button button--light" onClick={loadHostedUsage} type="button">
            Vercel保存版
          </button>
        </div>
      </div>

      <section className="project-hero">
        <div>
          <p className="eyebrow">Monthly Codex chat usage</p>
          <h2>チャット別トークン消費</h2>
          <p>Codexのローカルログをチャット単位でまとめています。タイトルは最初のユーザー発話から推定します。</p>
        </div>
        <strong>{threads.length}</strong>
      </section>

      <section className="project-list" aria-label="チャット別トークン消費">
        {threads.length ? (
          threads.map((thread, index) => (
            <ThreadRow thread={thread} rank={index + 1} scale={maxMonth} key={thread.sessionId} />
          ))
        ) : (
          <div className="panel">
            <p className="muted">チャット別に表示できるCodexログがまだありません。</p>
          </div>
        )}
      </section>
    </>
  );
}
