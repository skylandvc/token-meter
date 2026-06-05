import json
import os
import re
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
HOME = Path.home()
JST = timezone(timedelta(hours=9))
CACHE_TTL_SECONDS = 15

DEFAULT_LIMITS = {
    "daily": int(os.environ.get("TOKEN_METER_DAILY_LIMIT", "1000000")),
    "weekly": int(os.environ.get("TOKEN_METER_WEEKLY_LIMIT", "7000000")),
    "monthly": int(os.environ.get("TOKEN_METER_MONTHLY_LIMIT", "30000000")),
}

CLAUDE_SESSION_LIMIT = int(os.environ.get("TOKEN_METER_CLAUDE_SESSION_LIMIT", "0") or "0")
CLAUDE_WEEKLY_LIMIT = int(os.environ.get("TOKEN_METER_CLAUDE_WEEKLY_LIMIT", "0") or "0")
CLAUDE_SESSION_WINDOW_MINUTES = int(
    os.environ.get("TOKEN_METER_CLAUDE_SESSION_WINDOW_MINUTES", "300") or "300"
)

cache = {"expires_at": 0.0, "payload": None}


def parse_timestamp(value, fallback=None):
    if not value:
        return fallback
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc).astimezone(JST)
    text = str(value).strip()
    if not text:
        return fallback
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return fallback
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(JST)


def int_value(value):
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    return 0


def sum_usage(usage):
    if not isinstance(usage, dict):
        return None
    input_tokens = int_value(usage.get("input_tokens"))
    cached_tokens = int_value(usage.get("cached_input_tokens")) + int_value(
        usage.get("cache_read_input_tokens")
    )
    cache_creation_tokens = int_value(usage.get("cache_creation_input_tokens"))
    output_tokens = int_value(usage.get("output_tokens"))
    reasoning_tokens = int_value(usage.get("reasoning_output_tokens"))
    total_tokens = int_value(usage.get("total_tokens"))
    if not total_tokens:
        total_tokens = (
            input_tokens
            + cached_tokens
            + cache_creation_tokens
            + output_tokens
            + reasoning_tokens
        )
    if total_tokens <= 0:
        return None
    return {
        "input": input_tokens,
        "cached": cached_tokens,
        "cacheCreation": cache_creation_tokens,
        "output": output_tokens,
        "reasoning": reasoning_tokens,
        "total": total_tokens,
    }


def empty_usage():
    return {
        "input": 0,
        "cached": 0,
        "cacheCreation": 0,
        "output": 0,
        "reasoning": 0,
        "total": 0,
        "events": 0,
    }


def add_usage(target, usage):
    for key in ("input", "cached", "cacheCreation", "output", "reasoning", "total"):
        target[key] += usage.get(key, 0)
    target["events"] += 1


def event_payload(source, timestamp, usage, file_path, model="", session_id=""):
    return {
        "source": source,
        "timestamp": timestamp,
        "usage": usage,
        "file": str(file_path),
        "model": model,
        "sessionId": session_id,
    }


def discover_claude_files():
    roots = [HOME / ".claude" / "projects"]
    for root in roots:
        if root.exists():
            yield from root.rglob("*.jsonl")


def discover_codex_files():
    roots = [
        HOME / ".codex" / "sessions",
        HOME / ".codex" / "archived_sessions",
    ]
    for root in roots:
        if root.exists():
            yield from root.rglob("*.jsonl")


def iter_claude_events():
    seen_request_usage = set()
    for path in discover_claude_files():
        try:
            handle = path.open("r", encoding="utf-8")
        except OSError:
            continue
        with handle:
            for line in handle:
                if '"usage"' not in line:
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                message = item.get("message") or {}
                usage = sum_usage(message.get("usage"))
                timestamp = parse_timestamp(item.get("timestamp"))
                if not usage or not timestamp:
                    continue
                request_id = item.get("requestId") or message.get("id") or item.get("uuid")
                usage_signature = (request_id, usage["total"])
                if usage_signature in seen_request_usage:
                    continue
                seen_request_usage.add(usage_signature)
                yield event_payload(
                    "claude",
                    timestamp,
                    usage,
                    path,
                    message.get("model", ""),
                    item.get("sessionId", ""),
                )


def iter_codex_events():
    for path in discover_codex_files():
        try:
            handle = path.open("r", encoding="utf-8")
        except OSError:
            continue
        with handle:
            for line in handle:
                if '"token_count"' not in line or '"last_token_usage"' not in line:
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                payload = item.get("payload") or {}
                if payload.get("type") != "token_count":
                    continue
                info = payload.get("info") or {}
                usage = sum_usage(info.get("last_token_usage"))
                timestamp = parse_timestamp(item.get("timestamp"))
                if not usage or not timestamp:
                    continue
                yield event_payload("codex", timestamp, usage, path)


def period_keys(now):
    today = now.date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    return today, week_start, month_start


def build_series(daily_totals, today):
    days = []
    max_total = 1
    for offset in range(29, -1, -1):
        day = today - timedelta(days=offset)
        total = daily_totals.get(day.isoformat(), 0)
        max_total = max(max_total, total)
        days.append({"date": day.isoformat(), "total": total})
    return {"max": max_total, "days": days}


def source_summary(events, today, week_start, month_start):
    summary = {}
    for source in ("codex", "claude"):
        summary[source] = {
            "today": empty_usage(),
            "week": empty_usage(),
            "month": empty_usage(),
            "all": empty_usage(),
        }
    for event in events:
        source = event["source"]
        usage = event["usage"]
        day = event["timestamp"].date()
        add_usage(summary[source]["all"], usage)
        if day == today:
            add_usage(summary[source]["today"], usage)
        if day >= week_start:
            add_usage(summary[source]["week"], usage)
        if day >= month_start:
            add_usage(summary[source]["month"], usage)
    return summary


def latest_rate_limit(events):
    latest = None
    for path in discover_codex_files():
        try:
            handle = path.open("r", encoding="utf-8")
        except OSError:
            continue
        with handle:
            for line in handle:
                if '"token_count"' not in line or '"rate_limits"' not in line:
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                payload = item.get("payload") or {}
                if payload.get("type") != "token_count":
                    continue
                timestamp = parse_timestamp(item.get("timestamp"))
                if not timestamp:
                    continue
                if latest is None or timestamp > latest["timestamp"]:
                    latest = {
                        "timestamp": timestamp,
                        "rateLimits": payload.get("rate_limits") or {},
                    }
    if not latest:
        return None
    rate_limits = latest["rateLimits"]
    for key in ("primary", "secondary"):
        window = rate_limits.get(key) or {}
        if window.get("resets_at"):
            window["resetsAtIso"] = parse_timestamp(window["resets_at"]).isoformat()
    rate_limits["observedAt"] = latest["timestamp"].isoformat()
    return rate_limits


def usage_total_for(events, source, start_at):
    total = 0
    count = 0
    for event in events:
        if event["source"] != source:
            continue
        if event["timestamp"] < start_at:
            continue
        total += event["usage"]["total"]
        count += 1
    return total, count


def usage_percent(total, limit):
    if not limit:
        return None
    return min(100, round((total / limit) * 100, 1))


def build_claude_capacity(events, now, week_start):
    session_start = now - timedelta(minutes=CLAUDE_SESSION_WINDOW_MINUTES)
    session_total, session_events = usage_total_for(events, "claude", session_start)
    week_start_dt = datetime.combine(week_start, datetime.min.time(), tzinfo=JST)
    week_total, week_events = usage_total_for(events, "claude", week_start_dt)
    return {
        "planType": "Claude Code",
        "source": "estimated_from_local_usage",
        "note": "Claude Code の公式使用制限率はローカルログから未検出です。上限は環境変数で設定できます。",
        "windows": [
            {
                "id": "session",
                "label": "現在のセッション",
                "detail": f"直近{round(CLAUDE_SESSION_WINDOW_MINUTES / 60, 1):g}時間の推定使用量",
                "usedTokens": session_total,
                "events": session_events,
                "limitTokens": CLAUDE_SESSION_LIMIT or None,
                "usedPercent": usage_percent(session_total, CLAUDE_SESSION_LIMIT),
                "resetsAtIso": None,
            },
            {
                "id": "weekly",
                "label": "週間使用量",
                "detail": "今週のローカルログ集計",
                "usedTokens": week_total,
                "events": week_events,
                "limitTokens": CLAUDE_WEEKLY_LIMIT or None,
                "usedPercent": usage_percent(week_total, CLAUDE_WEEKLY_LIMIT),
                "resetsAtIso": None,
            },
        ],
    }


def build_codex_capacity(rate_limits):
    if not rate_limits:
        return {
            "planType": "Codex",
            "source": "not_found",
            "note": "Codex の使用制限ログはまだ見つかっていません。",
            "windows": [],
        }
    labels = {
        "primary": "現在のセッション",
        "secondary": "週間制限",
    }
    windows = []
    for key in ("primary", "secondary"):
        item = rate_limits.get(key) or {}
        if not item:
            continue
        windows.append(
            {
                "id": key,
                "label": labels[key],
                "detail": f"{item.get('window_minutes') or '--'}分ウィンドウ",
                "usedTokens": None,
                "events": None,
                "limitTokens": None,
                "usedPercent": item.get("used_percent"),
                "resetsAtIso": item.get("resetsAtIso"),
            }
        )
    return {
        "planType": rate_limits.get("plan_type") or "Codex",
        "source": "codex_rate_limits",
        "note": "Codex の token_count ログに含まれる rate limit 情報です。",
        "observedAt": rate_limits.get("observedAt"),
        "windows": windows,
    }


def scan_usage():
    now = datetime.now(JST)
    today, week_start, month_start = period_keys(now)
    events = list(iter_codex_events()) + list(iter_claude_events())
    daily_totals = defaultdict(int)
    totals = {
        "today": empty_usage(),
        "week": empty_usage(),
        "month": empty_usage(),
        "all": empty_usage(),
    }
    latest_events = []
    first_day = None
    for event in events:
        usage = event["usage"]
        day = event["timestamp"].date()
        first_day = day if first_day is None else min(first_day, day)
        daily_totals[day.isoformat()] += usage["total"]
        add_usage(totals["all"], usage)
        if day == today:
            add_usage(totals["today"], usage)
        if day >= week_start:
            add_usage(totals["week"], usage)
        if day >= month_start:
            add_usage(totals["month"], usage)
        latest_events.append(event)

    active_days = max(1, (today - (first_day or today)).days + 1)
    totals["averageDay"] = {
        **empty_usage(),
        "total": round(totals["all"]["total"] / active_days),
        "events": round(totals["all"]["events"] / active_days, 2),
    }
    latest_events.sort(key=lambda item: item["timestamp"], reverse=True)
    rate_limits = latest_rate_limit(events)

    payload = {
        "generatedAt": now.isoformat(),
        "timezone": "Asia/Tokyo",
        "limits": DEFAULT_LIMITS,
        "periods": {
            "today": today.isoformat(),
            "weekStart": week_start.isoformat(),
            "monthStart": month_start.isoformat(),
            "activeDays": active_days,
        },
        "totals": totals,
        "sources": source_summary(events, today, week_start, month_start),
        "series": build_series(daily_totals, today),
        "recent": [
            {
                "source": item["source"],
                "timestamp": item["timestamp"].isoformat(),
                "total": item["usage"]["total"],
                "input": item["usage"]["input"],
                "cached": item["usage"]["cached"] + item["usage"]["cacheCreation"],
                "output": item["usage"]["output"],
                "reasoning": item["usage"]["reasoning"],
                "model": item["model"],
                "sessionId": item["sessionId"],
                "fileName": Path(item["file"]).name,
            }
            for item in latest_events[:20]
        ],
        "capacity": {
            "codex": build_codex_capacity(rate_limits),
            "claude": build_claude_capacity(events, now, week_start),
        },
        "rateLimits": rate_limits,
        "files": {
            "claude": len(list(discover_claude_files())),
            "codex": len(list(discover_codex_files())),
        },
    }
    return payload


def json_response(handler, payload, status=200):
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(encoded)


class TokenMeterHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/usage":
            now = time.time()
            if cache["payload"] is None or now >= cache["expires_at"]:
                cache["payload"] = scan_usage()
                cache["expires_at"] = now + CACHE_TTL_SECONDS
            json_response(self, cache["payload"])
            return
        if parsed.path == "/health":
            json_response(self, {"ok": True})
            return
        return super().do_GET()

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/usage"):
            return
        super().log_message(fmt, *args)


def main():
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), TokenMeterHandler)
    print(f"Token Meter running at http://127.0.0.1:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
