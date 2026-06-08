"use client";

import { useEffect, useMemo, useState } from "react";

const LOCAL_USAGE_URLS = [
  "http://127.0.0.1:8766/api/usage",
  "http://127.0.0.1:8765/api/usage",
];
const HOSTED_USAGE_URL = "/usage-snapshot.json";
const CACHE_KEY = "token-meter-project-usage";

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

function sourceTotal(project, source) {
  return project.sources?.[source]?.total || 0;
}

function sourceEvents(project, source) {
  return project.sources?.[source]?.events || 0;
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

function createProjectsImage(usage, projects) {
  const rows = projects.slice(0, 12);
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 300 + rows.length * 86;
  const ctx = canvas.getContext("2d");
  const scale = Math.max(...rows.map((item) => item.month?.total || 0), 1);

  ctx.fillStyle = "#eef3f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawRoundRect(ctx, 28, 28, 1544, 124, 8, "#ffffff");
  drawText(ctx, "PROJECT TOKENS", 60, 54, { size: 16, weight: 800, color: "#2f6fec" });
  drawText(ctx, "Token Meter", 60, 78, { size: 48, weight: 800 });
  drawText(ctx, `更新 ${formatClock(usage.generatedAt)} / 月間トークン順`, 1540, 86, {
    size: 22,
    color: "#667085",
    align: "right",
  });

  drawRoundRect(ctx, 28, 176, 1544, canvas.height - 210, 8, "#ffffff");
  rows.forEach((project, index) => {
    const y = 212 + index * 86;
    const month = project.month?.total || 0;
    const barWidth = Math.max(6, Math.round((month / scale) * 780));
    drawText(ctx, `${index + 1}`, 60, y + 8, { size: 18, weight: 800, color: "#667085" });
    drawText(ctx, truncateMiddle(project.name, 30), 100, y, { size: 28, weight: 800 });
    drawText(ctx, truncateMiddle(project.path, 54), 100, y + 36, { size: 16, color: "#667085" });
    drawRoundRect(ctx, 520, y + 12, 800, 22, 11, "#e5e7eb", null);
    drawRoundRect(ctx, 520, y + 12, barWidth, 22, 11, "#2f6fec", null);
    drawText(ctx, formatTokens(month), 1360, y + 2, { size: 34, weight: 800, align: "right" });
    drawText(ctx, `${formatTokens(project.today?.total)} today / ${formatTokens(project.week?.total)} week`, 1540, y + 42, {
      size: 17,
      color: "#667085",
      align: "right",
    });
  });

  drawText(ctx, "Token Meter / local logs only", 60, canvas.height - 44, {
    size: 18,
    weight: 800,
    color: "#667085",
  });
  return canvas;
}

function ProjectRow({ project, scale, rank }) {
  const month = project.month?.total || 0;
  const codexTotal = sourceTotal(project, "codex");
  const claudeTotal = sourceTotal(project, "claude");
  return (
    <article className="project-row">
      <div className="project-rank">{rank}</div>
      <div className="project-main">
        <div className="project-titleline">
          <h2>{project.name}</h2>
          <strong>{formatTokens(month)}</strong>
        </div>
        <p>{project.path || "Project path unavailable"}</p>
        <div className="project-bar" aria-label={`${project.name} ${formatNumber(month)} tokens`}>
          <span style={{ width: `${percent(month, scale)}%` }} />
        </div>
      </div>
      <dl className="project-stats">
        <div>
          <dt>Today</dt>
          <dd>{formatTokens(project.today?.total)}</dd>
        </div>
        <div>
          <dt>Week</dt>
          <dd>{formatTokens(project.week?.total)}</dd>
        </div>
        <div>
          <dt>All</dt>
          <dd>{formatTokens(project.all?.total)}</dd>
        </div>
        <div>
          <dt>Events</dt>
          <dd>{formatNumber(project.all?.events)}</dd>
        </div>
      </dl>
      <div className="project-sources">
        <span>Codex {formatTokens(codexTotal)} / {sourceEvents(project, "codex")} events</span>
        <span>Claude {formatTokens(claudeTotal)} / {sourceEvents(project, "claude")} events</span>
      </div>
    </article>
  );
}

export default function ProjectUsagePanel() {
  const [usage, setUsage] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [connectedUrl, setConnectedUrl] = useState("");
  const [imageStatus, setImageStatus] = useState("");

  const projects = usage?.projects?.items || [];
  const maxMonth = useMemo(
    () => Math.max(...projects.map((project) => project.month?.total || 0), 1),
    [projects]
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
      const data = await fetchUsageFrom(HOSTED_USAGE_URL, "projects");
      setUsage(data);
      setConnectedUrl("Vercel保存版");
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(
        usage
          ? "Vercel保存版に接続できないため、最後に取得したプロジェクト別使用量を表示しています。"
          : "Vercel保存版のプロジェクト別データがまだありません。"
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
          data = await fetchUsageFrom(url, "projects");
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
      setError("ローカル版に接続できないため、Vercel保存版または最後に取得したプロジェクト別使用量を表示しています。");
    }
  }

  function saveImage() {
    if (!usage || !projects.length) return;
    const canvas = createProjectsImage(usage, projects);
    downloadCanvas(canvas, `token-meter-projects-${formatDate()}.png`);
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
            <h2>プロジェクト別使用量</h2>
          </div>
          <button className="button button--light" onClick={loadHostedUsage} type="button">
            {status === "loading" ? "読み込み中" : "Vercel保存版から取得"}
          </button>
        </div>
        <p className="muted">{error || "Vercelに保存したプロジェクト別データを取得します。"}</p>
      </section>
    );
  }

  return (
    <>
      <div className="local-toolbar">
        <div className="local-toolbar__copy">
          <span>
            {error ||
              `プロジェクト別使用量 / 更新 ${formatClock(usage.generatedAt)}${
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
          <p className="eyebrow">Monthly project usage</p>
          <h2>プロジェクト別トークン消費</h2>
          <p>Codex / Claude Code のローカルログをプロジェクトパスごとにまとめています。</p>
        </div>
        <strong>{projects.length}</strong>
      </section>

      <section className="project-list" aria-label="プロジェクト別トークン消費">
        {projects.length ? (
          projects.map((project, index) => (
            <ProjectRow project={project} rank={index + 1} scale={maxMonth} key={`${project.path}-${project.name}`} />
          ))
        ) : (
          <div className="panel">
            <p className="muted">プロジェクト別に表示できるログがまだありません。</p>
          </div>
        )}
      </section>
    </>
  );
}
