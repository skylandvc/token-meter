(function () {
  const POLL_MS = 10000;

  const $ = (id) => document.getElementById(id);

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

  function percent(value, limit) {
    if (!limit) {
      return 0;
    }
    return Math.max(0, Math.min(100, (value / limit) * 100));
  }

  function setBar(id, value, scale) {
    $(id).style.width = `${percent(value, scale)}%`;
  }

  function ratioLabel(value, scale, prefix = "比較") {
    if (!scale) {
      return `${prefix} --`;
    }
    if (!value) {
      return "なし";
    }
    if (value >= scale * 0.995) {
      return "最大";
    }
    return `${prefix} ${Math.round((value / scale) * 100)}%`;
  }

  function formatClock(iso) {
    if (!iso) {
      return "--:--";
    }
    return new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  }

  function formatDateTime(iso) {
    if (!iso) {
      return "--";
    }
    return new Intl.DateTimeFormat("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  function formatCapacityLabel(window) {
    if (typeof window.usedPercent === "number") {
      return `${Math.round(window.usedPercent)}% 使用済み`;
    }
    if (window.limitTokens) {
      return `${formatTokens(window.usedTokens || 0)} / ${formatTokens(window.limitTokens)}`;
    }
    return window.usedTokens ? `${formatTokens(window.usedTokens)} 使用` : "上限未設定";
  }

  function formatResetDetail(window) {
    if (!window.resetsAtIso) {
      return window.detail;
    }
    const resetDate = new Date(window.resetsAtIso);
    if (resetDate.getTime() < Date.now()) {
      return "次回リセット確認待ち";
    }
    return `${formatDateTime(window.resetsAtIso)} にリセット`;
  }

  function capacityWindow(window, tone) {
    const pct = typeof window.usedPercent === "number" ? Math.max(0, Math.min(100, window.usedPercent)) : 0;
    const reset = formatResetDetail(window);
    const emptyClass = typeof window.usedPercent === "number" ? "" : " capacity-window--unknown";
    return `<div class="capacity-window${emptyClass}">
      <div class="capacity-window__text">
        <strong>${window.label}</strong>
        <span>${reset || ""}</span>
      </div>
      <b>${formatCapacityLabel(window)}</b>
      <div class="capacity-gauge capacity-gauge--${tone}">
        <span style="width:${pct}%"></span>
      </div>
    </div>`;
  }

  function renderCapacityPanel(prefix, capacity, tone) {
    $(`${prefix}CapacityPlan`).textContent = capacity?.planType || "--";
    const windows = capacity?.windows || [];
    $(`${prefix}Capacity`).innerHTML = windows.length
      ? windows.map((window) => capacityWindow(window, tone)).join("")
      : `<p class="muted">${capacity?.note || "使用制限情報はまだありません。"}</p>`;
  }

  function renderCapacity(data) {
    const capacity = data.capacity || {};
    renderCapacityPanel("codex", capacity.codex || {}, "codex");
    renderCapacityPanel("claude", capacity.claude || {}, "claude");
  }

  function renderMetrics(data) {
    const totals = data.totals || {};
    const sources = data.sources || {};
    const today = totals.today || {};
    const week = totals.week || {};
    const month = totals.month || {};
    const avg = totals.averageDay || {};
    const codexToday = sources.codex?.today?.total || 0;
    const claudeToday = sources.claude?.today?.total || 0;
    const codexTodayEvents = sources.codex?.today?.events || 0;
    const claudeTodayEvents = sources.claude?.today?.events || 0;
    const metricScale = Math.max(
      today.total || 0,
      week.total || 0,
      month.total || 0,
      avg.total || 0,
      1
    );

    $("todayTotal").textContent = formatTokens(today.total);
    $("todaySub").textContent = `Codex + Claude Code / ${today.events || 0} events`;
    $("todayClaudeTotal").textContent = formatTokens(claudeToday);
    $("todayCodexTotal").textContent = formatTokens(codexToday);
    $("todayClaudeEvents").textContent = `${claudeTodayEvents} events`;
    $("todayCodexEvents").textContent = `${codexTodayEvents} events`;

    $("metricToday").textContent = formatTokens(today.total);
    $("metricWeek").textContent = formatTokens(week.total);
    $("metricMonth").textContent = formatTokens(month.total);
    $("metricAverage").textContent = formatTokens(avg.total);
    $("todayPercent").textContent = ratioLabel(today.total, metricScale, "相対");
    $("weekPercent").textContent = ratioLabel(week.total, metricScale, "相対");
    $("monthPercent").textContent = ratioLabel(month.total, metricScale, "相対");
    $("activeDays").textContent = `${data.periods?.activeDays || 1}日`;

    setBar("barToday", today.total, metricScale);
    setBar("barWeek", week.total, metricScale);
    setBar("barMonth", month.total, metricScale);
    setBar("barAverage", avg.total, metricScale);
  }

  function sourceRow(label, source) {
    const today = source.today || {};
    const week = source.week || {};
    const month = source.month || {};
    const all = source.all || {};
    return `
      <div class="source-row">
        <div>
          <strong>${label}</strong>
          <span>${all.events || 0} events</span>
        </div>
        <dl>
          <dt>日次</dt><dd>${formatTokens(today.total)}</dd>
          <dt>週次</dt><dd>${formatTokens(week.total)}</dd>
          <dt>月次</dt><dd>${formatTokens(month.total)}</dd>
        </dl>
      </div>
    `;
  }

  function renderSources(data) {
    const sources = data.sources || {};
    $("sourceList").innerHTML = [
      sourceRow("Claude Code", sources.claude || {}),
      sourceRow("Codex", sources.codex || {}),
    ].join("");
    $("fileCount").textContent = `${data.files?.claude || 0} Claude / ${
      data.files?.codex || 0
    } Codex`;
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

  function agentMetric(label, usage, scale, tone) {
    const total = usage.total || 0;
    return `<div class="agent-metric">
      <div class="agent-metric__top">
        <span>${label}</span>
        <b>${formatTokens(total)}</b>
      </div>
      <div class="bar bar--${tone}"><span style="width:${percent(total, scale)}%"></span></div>
    </div>`;
  }

  function renderAgentPanel(prefix, source, tone) {
    const activeDays = window.latestActiveDays || 1;
    const usage = usageWithAverage(source || {}, activeDays);
    const scale = Math.max(
      usage.today.total || 0,
      usage.week.total || 0,
      usage.month.total || 0,
      usage.averageDay.total || 0,
      1
    );
    $(`${prefix}Events`).textContent = `${usage.all.events || 0} events`;
    $(`${prefix}Metrics`).innerHTML = [
      agentMetric("日次", usage.today, scale, tone),
      agentMetric("週次", usage.week, scale, tone),
      agentMetric("月次", usage.month, scale, tone),
      agentMetric("平均日次", usage.averageDay, scale, "calm"),
    ].join("");
  }

  function renderAgentBreakdown(data) {
    window.latestActiveDays = data.periods?.activeDays || 1;
    const sources = data.sources || {};
    renderAgentPanel("codex", sources.codex || {}, "codex");
    renderAgentPanel("claude", sources.claude || {}, "claude");
  }

  function renderChart(data) {
    const series = data.series || { days: [], max: 1 };
    $("dailyChart").innerHTML = series.days
      .map((day) => {
        const height = Math.max(3, Math.round((day.total / series.max) * 100));
        const date = new Date(`${day.date}T00:00:00+09:00`);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        return `<div class="day" title="${day.date} ${formatTokens(day.total)} tokens">
          <span style="height:${height}%"></span>
          <b>${label}</b>
        </div>`;
      })
      .join("");
  }

  function renderRateLimits(data) {
    const limits = data.rateLimits;
    if (!limits) {
      $("rateLimits").innerHTML = '<p class="muted">Codex の rate limit 情報はまだ見つかっていません。</p>';
      $("planType").textContent = "--";
      return;
    }
    $("planType").textContent = limits.plan_type || "--";
    $("rateLimits").innerHTML = ["primary", "secondary"]
      .map((key) => {
        const item = limits[key] || {};
        const used = Number(item.used_percent) || 0;
        const reset = item.resetsAtIso ? formatDateTime(item.resetsAtIso) : "--";
        return `<div class="limit-row">
          <div>
            <strong>${key === "primary" ? "Current session" : "Weekly window"}</strong>
            <span>${item.window_minutes || "--"} min / reset ${reset}</span>
          </div>
          <b>${used.toFixed(0)}%</b>
          <div class="bar"><span style="width:${Math.min(100, used)}%"></span></div>
        </div>`;
      })
      .join("");
  }

  async function refresh() {
    try {
      $("scanStatus").textContent = "更新中";
      const response = await fetch("/api/usage", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      renderCapacity(data);
      renderMetrics(data);
      renderSources(data);
      renderAgentBreakdown(data);
      renderChart(data);
      renderRateLimits(data);
      $("updatedAt").textContent = formatClock(data.generatedAt);
      $("scanStatus").textContent = "Live";
    } catch (error) {
      $("scanStatus").textContent = "Error";
      $("updatedAt").textContent = error.message;
    }
  }

  refresh();
  window.setInterval(refresh, POLL_MS);
})();
