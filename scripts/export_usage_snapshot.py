#!/usr/bin/env python3
import json
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

import server


def scrub_path(value):
    text = str(value or "")
    if not text:
        return ""
    home = str(Path.home())
    return text.replace(home, "~")


def scrub_project(project):
    return {
        **project,
        "path": scrub_path(project.get("path")),
    }


def scrub_thread(thread):
    session_id = str(thread.get("sessionId") or "")
    return {
        **thread,
        "sessionId": session_id[:8],
        "projectPath": scrub_path(thread.get("projectPath")),
    }


def scrub_cursor_item(item):
    session_id = str(item.get("sessionId") or "")
    return {
        **item,
        "sessionId": session_id[:8],
        "file": scrub_path(item.get("file")),
        "projectPath": scrub_path(item.get("projectPath")),
    }


def public_snapshot(usage):
    projects = usage.get("projects") or {}
    threads = usage.get("threads") or {}
    cursor = usage.get("cursor") or {}
    return {
        "generatedAt": usage.get("generatedAt"),
        "snapshotMode": "vercel_static",
        "projects": {
            "maxMonth": projects.get("maxMonth", 1),
            "items": [scrub_project(item) for item in projects.get("items", [])],
        },
        "threads": {
            "maxMonth": threads.get("maxMonth", 1),
            "items": [scrub_thread(item) for item in threads.get("items", [])],
        },
        "cursor": {
            "source": cursor.get("source"),
            "note": cursor.get("note"),
            "files": cursor.get("files", 0),
            "activeDays": cursor.get("activeDays", 1),
            "maxMonth": cursor.get("maxMonth", 1),
            "totals": cursor.get("totals"),
            "capacity": cursor.get("capacity"),
            "series": cursor.get("series"),
            "items": [scrub_cursor_item(item) for item in cursor.get("items", [])],
        },
    }


def main():
    output_path = project_root / "public" / "usage-snapshot.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    usage = public_snapshot(server.scan_usage())
    output_path.write_text(
        json.dumps(usage, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
