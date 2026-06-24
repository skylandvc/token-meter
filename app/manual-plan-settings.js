"use client";

import { useEffect, useState } from "react";

export const MANUAL_PLAN_STORAGE_KEY = "token-meter-manual-plans";

const SERVICES = [
  { id: "claude", label: "Claude Code", tone: "claude" },
  { id: "codex", label: "Codex", tone: "codex" },
  { id: "cursor", label: "Cursor", tone: "cursor" },
];

const EMPTY_PLAN = { planName: "", monthlyFee: "", renewalDate: "" };

export function createEmptyManualPlans() {
  return {
    claude: { ...EMPTY_PLAN },
    codex: { ...EMPTY_PLAN },
    cursor: { ...EMPTY_PLAN },
  };
}

function normalizePlans(raw) {
  const base = createEmptyManualPlans();
  if (!raw || typeof raw !== "object") return base;
  for (const service of SERVICES) {
    const item = raw[service.id];
    if (!item || typeof item !== "object") continue;
    base[service.id] = {
      planName: typeof item.planName === "string" ? item.planName : "",
      monthlyFee: typeof item.monthlyFee === "string" ? item.monthlyFee : "",
      renewalDate: typeof item.renewalDate === "string" ? item.renewalDate : "",
    };
  }
  return base;
}

export function loadManualPlans() {
  if (typeof window === "undefined") return createEmptyManualPlans();
  try {
    const cached = localStorage.getItem(MANUAL_PLAN_STORAGE_KEY);
    if (!cached) return createEmptyManualPlans();
    return normalizePlans(JSON.parse(cached));
  } catch {
    return createEmptyManualPlans();
  }
}

export function saveManualPlans(plans) {
  localStorage.setItem(MANUAL_PLAN_STORAGE_KEY, JSON.stringify(normalizePlans(plans)));
}

function displayValue(value) {
  return value?.trim() ? value.trim() : "未設定";
}

function formatMonthlyFee(value) {
  if (!value?.trim()) return "未設定";
  const normalized = value.trim().replace(/,/g, "");
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const amount = Number(normalized);
    if (Number.isFinite(amount)) {
      return `¥${amount.toLocaleString("ja-JP")}`;
    }
  }
  return value.trim();
}

function formatRenewalDate(value) {
  if (!value?.trim()) return "未設定";
  const date = new Date(`${value.trim()}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value.trim();
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function PlanPanel({ service, plan, editing, draft, onDraftChange }) {
  const current = editing ? draft : plan;
  const planName = displayValue(current.planName);
  const monthlyFee = formatMonthlyFee(current.monthlyFee);
  const renewalDate = formatRenewalDate(current.renewalDate);

  function updateField(field, value) {
    onDraftChange({
      ...draft,
      [service.id]: {
        ...draft[service.id],
        [field]: value,
      },
    });
  }

  return (
    <article className={`pricing-panel pricing-panel--${service.tone}`}>
      <div className="pricing-panel__head">
        <div>
          <p className="eyebrow">{service.label}</p>
          <h2>{editing ? "編集中" : planName}</h2>
        </div>
        {!editing && <span>{monthlyFee}</span>}
      </div>

      {editing ? (
        <div className="manual-plan-fields">
          <label className="manual-plan-field">
            <span>プラン名</span>
            <input
              type="text"
              value={draft[service.id].planName}
              onChange={(event) => updateField("planName", event.target.value)}
              placeholder="例: Pro"
              autoComplete="off"
            />
          </label>
          <label className="manual-plan-field">
            <span>月額</span>
            <input
              type="text"
              inputMode="decimal"
              value={draft[service.id].monthlyFee}
              onChange={(event) => updateField("monthlyFee", event.target.value)}
              placeholder="例: 3000 または $20"
              autoComplete="off"
            />
          </label>
          <label className="manual-plan-field">
            <span>次回更新日</span>
            <input
              type="date"
              value={draft[service.id].renewalDate}
              onChange={(event) => updateField("renewalDate", event.target.value)}
            />
          </label>
        </div>
      ) : (
        <div className="manual-plan-display">
          <div className="manual-plan-display__row">
            <span>プラン名</span>
            <strong>{planName}</strong>
          </div>
          <div className="manual-plan-display__row">
            <span>月額</span>
            <strong>{monthlyFee}</strong>
          </div>
          <div className="manual-plan-display__row">
            <span>次回更新日</span>
            <strong>{renewalDate}</strong>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ManualPlanSettings() {
  const [plans, setPlans] = useState(createEmptyManualPlans);
  const [draft, setDraft] = useState(createEmptyManualPlans);
  const [editing, setEditing] = useState(false);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    const loaded = loadManualPlans();
    setPlans(loaded);
    setDraft(loaded);
  }, []);

  function startEditing() {
    setDraft(plans);
    setEditing(true);
    setSavedAt("");
  }

  function cancelEditing() {
    setDraft(plans);
    setEditing(false);
    setSavedAt("");
  }

  function savePlans() {
    const next = normalizePlans(draft);
    saveManualPlans(next);
    setPlans(next);
    setDraft(next);
    setEditing(false);
    setSavedAt(
      new Intl.DateTimeFormat("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())
    );
  }

  return (
    <section className="manual-plan-section" aria-label="契約プラン（手動設定）">
      <div className="section-head">
        <div>
          <p className="eyebrow">Manual settings</p>
          <h2>契約プラン（手動設定）</h2>
          <p className="pricing-note manual-plan-note">
            契約プラン・料金は自動取得されません。このブラウザに手動で入力した内容だけを表示します。
          </p>
        </div>
        <div className="manual-plan-actions">
          {editing ? (
            <>
              <button className="button button--light" onClick={cancelEditing} type="button">
                キャンセル
              </button>
              <button className="button" onClick={savePlans} type="button">
                保存
              </button>
            </>
          ) : (
            <button className="button button--light" onClick={startEditing} type="button">
              編集
            </button>
          )}
        </div>
      </div>

      <div className="pricing-grid manual-plan-grid">
        {SERVICES.map((service) => (
          <PlanPanel
            key={service.id}
            service={service}
            plan={plans[service.id]}
            editing={editing}
            draft={draft}
            onDraftChange={setDraft}
          />
        ))}
      </div>

      {savedAt && <p className="manual-plan-saved">保存しました（{savedAt}）</p>}
    </section>
  );
}
