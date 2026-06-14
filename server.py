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
DEFAULT_ALLOWED_ORIGINS = [
    "https://token-meterz.vercel.app",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:8765",
    "http://127.0.0.1:8766",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8765",
    "http://localhost:8766",
]

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
CURSOR_DAILY_LIMIT = int(os.environ.get("TOKEN_METER_CURSOR_DAILY_LIMIT", "0") or "0")
CURSOR_WEEKLY_LIMIT = int(os.environ.get("TOKEN_METER_CURSOR_WEEKLY_LIMIT", "0") or "0")
CURSOR_MONTHLY_LIMIT = int(os.environ.get("TOKEN_METER_CURSOR_MONTHLY_LIMIT", "0") or "0")
CORS_ALLOWED_ORIGINS = {
    origin.strip().rstrip("/")
    for origin in os.environ.get(
        "TOKEN_METER_ALLOWED_ORIGINS", ",".join(DEFAULT_ALLOWED_ORIGINS)
    ).split(",")
    if origin.strip()
}

cache = {"expires_at": 0.0, "payload": None}


def request_origin(handler):
    origin = handler.headers.get("Origin")
    return origin.strip().rstrip("/") if origin else ""


def is_allowed_origin(origin):
    return not origin or origin in CORS_ALLOWED_ORIGINS


def send_cors_headers(handler, origin):
    if origin:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Private-Network", "true")


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


codex_session_cache = {}


def display_project_name(project_path):
    if not project_path:
        return "Unknown project"
    text = str(project_path).rstrip("/")
    if not text:
        return "Unknown project"
    return Path(text).name or text


def decoded_claude_project_dir(path):
    try:
        project_dir = path.relative_to(HOME / ".claude" / "projects").parts[0]
    except (ValueError, IndexError):
        return ""
    if not project_dir.startswith("-"):
        return project_dir
    parts = [part for part in project_dir.split("-") if part]
    if not parts:
        return project_dir
    return "/" + "/".join(parts)


def compact_title(text, fallback):
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip()
    if not cleaned:
        return fallback
    return cleaned[:56] + ("..." if len(cleaned) > 56 else "")


def extract_message_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                parts.append(item.get("text") or item.get("input_text") or "")
        return " ".join(part for part in parts if part)
    return ""


def codex_session_meta(path):
    cached = codex_session_cache.get(path)
    if cached:
        return cached
    project_path = ""
    session_id = ""
    first_user_text = ""
    try:
        handle = path.open("r", encoding="utf-8")
    except OSError:
        codex_session_cache[path] = {}
        return codex_session_cache[path]
    with handle:
        for line in handle:
            if '"cwd"' not in line and '"session_meta"' not in line and '"role":"user"' not in line and '"user_message"' not in line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            payload = item.get("payload") or {}
            if item.get("type") == "session_meta" or payload.get("id"):
                session_id = session_id or payload.get("id") or item.get("id") or ""
            if not project_path:
                project_path = (
                    payload.get("cwd")
                    or item.get("cwd")
                    or (payload.get("turn_context") or {}).get("cwd")
                    or ""
                )
            if not first_user_text:
                message = payload.get("message") or item.get("message") or {}
                if isinstance(message, dict) and message.get("role") == "user":
                    first_user_text = extract_message_text(message.get("content"))
                elif payload.get("type") == "user_message":
                    first_user_text = payload.get("message") or ""
            if project_path and session_id and first_user_text:
                break
    fallback_id = session_id or path.stem.replace("rollout-", "")[:8]
    meta = {
        "projectPath": project_path or "",
        "project": display_project_name(project_path),
        "sessionId": session_id or fallback_id,
        "threadTitle": compact_title(first_user_text, f"Codex chat {fallback_id[:8]}"),
    }
    codex_session_cache[path] = meta
    return meta


def event_payload(
    source,
    timestamp,
    usage,
    file_path,
    model="",
    session_id="",
    project_path="",
    thread_title="",
):
    project = display_project_name(project_path)
    return {
        "source": source,
        "timestamp": timestamp,
        "usage": usage,
        "file": str(file_path),
        "model": model,
        "sessionId": session_id,
        "project": project,
        "projectPath": str(project_path or ""),
        "threadTitle": thread_title or "",
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


def discover_cursor_files():
    root = HOME / ".cursor" / "projects"
    if root.exists():
        yield from root.rglob("agent-transcripts/**/*.jsonl")


def cursor_project_from_path(path):
    try:
        parts = path.relative_to(HOME / ".cursor" / "projects").parts
    except ValueError:
        return "Unknown project", ""
    if not parts:
        return "Unknown project", ""
    raw = parts[0]
    if raw == "empty-window":
        return "empty-window", ""
    if raw.startswith("Users-"):
        project_path = "/" + raw.replace("-", "/")
        return display_project_name(project_path), project_path
    return raw, raw


def estimate_text_tokens(text):
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip()
    if not cleaned:
        return 0
    ascii_chars = sum(1 for char in cleaned if ord(char) < 128)
    non_ascii_chars = len(cleaned) - ascii_chars
    return max(1, round(ascii_chars / 4 + non_ascii_chars / 1.8))


def estimate_cursor_usage(message):
    usage = empty_usage()
    content = (message or {}).get("content")
    if not isinstance(content, list):
        content = [content]
    for item in content:
        if isinstance(item, str):
            usage["input"] += estimate_text_tokens(item)
            continue
        if not isinstance(item, dict):
            continue
        if item.get("type") == "text":
            usage["input"] += estimate_text_tokens(item.get("text"))
        elif item.get("type") == "tool_use":
            usage["input"] += estimate_text_tokens(json.dumps(item.get("input") or {}, ensure_ascii=False))
            usage["output"] += estimate_text_tokens(item.get("name"))
        elif item.get("type") == "tool_result":
            usage["output"] += estimate_text_tokens(item.get("content"))
        else:
            usage["input"] += estimate_text_tokens(json.dumps(item, ensure_ascii=False))
    usage["total"] = usage["input"] + usage["output"]
    return usage if usage["total"] > 0 else None


def parse_cursor_timestamp(item, fallback):
    timestamp = item.get("timestamp") or item.get("createdAt") or item.get("time")
    if timestamp:
        parsed = parse_timestamp(timestamp)
        if parsed:
            return parsed
    message = item.get("message") or {}
    text = extract_message_text(message.get("content"))
    match = re.search(r"<timestamp>(.*?)</timestamp>", text, re.DOTALL)
    if match:
        parsed = parse_timestamp(match.group(1).strip())
        if parsed:
            return parsed
    return fallback


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
                    item.get("cwd") or decoded_claude_project_dir(path),
                )


def iter_codex_events():
    for path in discover_codex_files():
        meta = codex_session_meta(path)
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
                yield event_payload(
                    "codex",
                    timestamp,
                    usage,
                    path,
                    session_id=meta.get("sessionId", ""),
                    project_path=meta.get("projectPath", ""),
                    thread_title=meta.get("threadTitle", ""),
                )


def iter_cursor_events():
    for path in discover_cursor_files():
        try:
            fallback_time = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).astimezone(JST)
        except OSError:
            fallback_time = datetime.now(JST)
        project, project_path = cursor_project_from_path(path)
        session_id = path.stem
        try:
            handle = path.open("r", encoding="utf-8")
        except OSError:
            continue
        with handle:
            for line in handle:
                if '"message"' not in line:
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                usage = estimate_cursor_usage(item.get("message") or {})
                if not usage:
                    continue
                timestamp = parse_cursor_timestamp(item, fallback_time)
                yield event_payload(
                    "cursor",
                    timestamp,
                    usage,
                    path,
                    session_id=session_id,
                    project_path=project_path,
                    thread_title=f"Cursor transcript {session_id[:8]}",
                ) | {"project": project}


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


def build_project_summary(events, today, week_start, month_start):
    projects = {}
    for event in events:
        key = event.get("projectPath") or event.get("project") or "Unknown project"
        if key not in projects:
            projects[key] = {
                "name": event.get("project") or display_project_name(key),
                "path": event.get("projectPath") or "",
                "today": empty_usage(),
                "week": empty_usage(),
                "month": empty_usage(),
                "all": empty_usage(),
                "sources": {},
                "latestAt": None,
            }
        project = projects[key]
        source = event["source"]
        day = event["timestamp"].date()
        usage = event["usage"]
        add_usage(project["all"], usage)
        if day == today:
            add_usage(project["today"], usage)
        if day >= week_start:
            add_usage(project["week"], usage)
        if day >= month_start:
            add_usage(project["month"], usage)
        if source not in project["sources"]:
            project["sources"][source] = empty_usage()
        add_usage(project["sources"][source], usage)
        latest_at = event["timestamp"]
        if project["latestAt"] is None or latest_at > project["latestAt"]:
            project["latestAt"] = latest_at

    items = []
    for item in projects.values():
        items.append(
            {
                **item,
                "latestAt": item["latestAt"].isoformat() if item["latestAt"] else None,
            }
        )
    items.sort(key=lambda item: (item["month"]["total"], item["all"]["total"]), reverse=True)
    max_total = max([item["month"]["total"] for item in items] + [1])
    return {"items": items[:30], "maxMonth": max_total}


def build_thread_summary(events, today, week_start, month_start):
    threads = {}
    for event in events:
        if event.get("source") != "codex":
            continue
        key = event.get("file") or event.get("sessionId") or "unknown"
        session_id = event.get("sessionId") or ""
        if key not in threads:
            threads[key] = {
                "title": event.get("threadTitle")
                or f"Codex chat {(session_id or key)[:8]}",
                "sessionId": session_id,
                "file": event.get("file") or "",
                "project": event.get("project") or "Unknown project",
                "projectPath": event.get("projectPath") or "",
                "today": empty_usage(),
                "week": empty_usage(),
                "month": empty_usage(),
                "all": empty_usage(),
                "latestAt": None,
            }
        thread = threads[key]
        day = event["timestamp"].date()
        usage = event["usage"]
        add_usage(thread["all"], usage)
        if day == today:
            add_usage(thread["today"], usage)
        if day >= week_start:
            add_usage(thread["week"], usage)
        if day >= month_start:
            add_usage(thread["month"], usage)
        latest_at = event["timestamp"]
        if thread["latestAt"] is None or latest_at > thread["latestAt"]:
            thread["latestAt"] = latest_at

    items = []
    for item in threads.values():
        items.append(
            {
                **item,
                "latestAt": item["latestAt"].isoformat() if item["latestAt"] else None,
            }
        )
    items.sort(key=lambda item: (item["month"]["total"], item["all"]["total"]), reverse=True)
    max_total = max([item["month"]["total"] for item in items] + [1])
    return {"items": items[:50], "maxMonth": max_total}


def build_cursor_summary(events, today, week_start, month_start):
    totals = {
        "today": empty_usage(),
        "week": empty_usage(),
        "month": empty_usage(),
        "all": empty_usage(),
    }
    transcripts = {}
    daily_totals = defaultdict(int)
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

        key = event.get("file") or event.get("sessionId") or "unknown"
        if key not in transcripts:
            transcripts[key] = {
                "title": event.get("threadTitle") or f"Cursor transcript {(event.get('sessionId') or key)[:8]}",
                "sessionId": event.get("sessionId") or "",
                "file": event.get("file") or "",
                "project": event.get("project") or "Unknown project",
                "projectPath": event.get("projectPath") or "",
                "today": empty_usage(),
                "week": empty_usage(),
                "month": empty_usage(),
                "all": empty_usage(),
                "latestAt": None,
            }
        transcript = transcripts[key]
        add_usage(transcript["all"], usage)
        if day == today:
            add_usage(transcript["today"], usage)
        if day >= week_start:
            add_usage(transcript["week"], usage)
        if day >= month_start:
            add_usage(transcript["month"], usage)
        if transcript["latestAt"] is None or event["timestamp"] > transcript["latestAt"]:
            transcript["latestAt"] = event["timestamp"]

    active_days = max(1, (today - (first_day or today)).days + 1)
    totals["averageDay"] = {
        **empty_usage(),
        "total": round(totals["all"]["total"] / active_days),
        "events": round(totals["all"]["events"] / active_days, 2),
    }
    items = []
    for item in transcripts.values():
        items.append(
            {
                **item,
                "latestAt": item["latestAt"].isoformat() if item["latestAt"] else None,
            }
        )
    items.sort(key=lambda item: (item["month"]["total"], item["all"]["total"]), reverse=True)
    max_daily = max(daily_totals.values() or [0])
    daily_limit = cursor_limit(CURSOR_DAILY_LIMIT, max(max_daily, totals["today"]["total"]))
    weekly_limit = cursor_limit(
        CURSOR_WEEKLY_LIMIT,
        max(totals["week"]["total"], max_daily * 7, totals["averageDay"]["total"] * 7),
    )
    monthly_limit = cursor_limit(
        CURSOR_MONTHLY_LIMIT,
        max(totals["month"]["total"], max_daily * 30, totals["averageDay"]["total"] * 30),
    )
    return {
        "source": "estimated_from_cursor_agent_transcripts",
        "note": "Cursor の agent transcript から文字量ベースで推定したトークン数です。公式Usageではありません。",
        "files": len(list(discover_cursor_files())),
        "activeDays": active_days,
        "totals": totals,
        "capacity": {
            "source": "manual_env_or_observed_peak_estimate",
            "note": "Cursor公式の上限ではなく、手入力上限または過去ログ最大値から推定したキャパです。",
            "daily": {
                "usedTokens": totals["today"]["total"],
                "usedPercent": usage_percent(totals["today"]["total"], daily_limit["limitTokens"]),
                **daily_limit,
            },
            "weekly": {
                "usedTokens": totals["week"]["total"],
                "usedPercent": usage_percent(totals["week"]["total"], weekly_limit["limitTokens"]),
                **weekly_limit,
            },
            "monthly": {
                "usedTokens": totals["month"]["total"],
                "usedPercent": usage_percent(totals["month"]["total"], monthly_limit["limitTokens"]),
                **monthly_limit,
            },
        },
        "series": build_series(daily_totals, today),
        "items": items[:50],
        "maxMonth": max([item["month"]["total"] for item in items] + [1]),
    }


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


def round_capacity(value):
    if value <= 0:
        return 0
    magnitude = 10 ** max(0, len(str(int(value))) - 2)
    return int(((value + magnitude - 1) // magnitude) * magnitude)


def cursor_limit(manual_limit, observed_value):
    if manual_limit:
        return {
            "limitTokens": manual_limit,
            "basis": "manual",
        }
    estimated = round_capacity(max(1, observed_value) * 1.25)
    return {
        "limitTokens": estimated,
        "basis": "estimated_from_observed_peak",
    }


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
    cursor_events = list(iter_cursor_events())
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
        "projects": build_project_summary(events, today, week_start, month_start),
        "threads": build_thread_summary(events, today, week_start, month_start),
        "cursor": build_cursor_summary(cursor_events, today, week_start, month_start),
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
            "cursor": len(list(discover_cursor_files())),
        },
    }
    return payload


def json_response(handler, payload, status=200):
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    origin = request_origin(handler)
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.send_header("Cache-Control", "no-store")
    if is_allowed_origin(origin):
        send_cors_headers(handler, origin)
    handler.end_headers()
    handler.wfile.write(encoded)


class TokenMeterHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_OPTIONS(self):
        origin = request_origin(self)
        if not is_allowed_origin(origin):
            self.send_response(403)
            self.end_headers()
            return
        self.send_response(204)
        send_cors_headers(self, origin)
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/usage":
            origin = request_origin(self)
            if not is_allowed_origin(origin):
                json_response(self, {"error": "origin_not_allowed"}, 403)
                return
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
