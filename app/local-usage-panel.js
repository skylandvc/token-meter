"use client";

import { useMemo, useState } from "react";

const LOCAL_USAGE_URL = "http://127.0.0.1:8766/api/usage";

function formatTokens(value) {
  const num = Number(value) || 0;
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(num >= 10000000 ? 1 : 2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(num >= 100000 ? 0 : 1)}K`;
  }
  return num.toLocaleString("ja-JP");
}

function formatClock(iso) {
  if (!iso) {
    return "--";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function sourceMetric(label, source) {
  const today = source?.today || {};
  const week = source?.week || {};
  const month = source?.month || {};
  return (
    <article className="local-source">
      <span>{label}</span>
      <strong>{formatTokens(today.total)}</strong>
      <dl>
        <dt>今日</dt>
        <dd>{formatTokens(today.total)}</dd>
        <dt>今週</dt>
        <dd>{formatTokens(week.total)}</dd>
        <dt>今月</dt>
        <dd>{formatTokens(month.total)}</dd>
      </dl>
    </article>
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
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setUsage(data);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(
        "ローカル版が起動していないか、ブラウザから127.0.0.1:8766へ接続できません。"
      );
    }
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

      {!usage && (
        <p className="muted">
          各自のPCでローカル版 Token Meter を起動してから取得します。
          既定の接続先は <code>{LOCAL_USAGE_URL}</code> です。
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      {usage && (
        <>
          <div className="metric-grid metric-grid--local">
            <article className="metric-card">
              <span>今日</span>
              <strong>{formatTokens(usage.totals?.today?.total)}</strong>
            </article>
            <article className="metric-card">
              <span>今週</span>
              <strong>{formatTokens(usage.totals?.week?.total)}</strong>
            </article>
            <article className="metric-card">
              <span>更新</span>
              <strong>{updatedAt}</strong>
            </article>
          </div>
          <div className="local-sources">
            {sourceMetric("Claude Code", usage.sources?.claude)}
            {sourceMetric("Codex", usage.sources?.codex)}
          </div>
        </>
      )}
    </section>
  );
}
