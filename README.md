# Token Meter

Local browser dashboard for Codex and Claude Code token usage.

## Run

### Local log dashboard

```bash
cd "/Users/yosihikokinoshita/Documents/New project/token-meter"
python3 server.py
```

Open http://127.0.0.1:8765.

To use a different local port:

```bash
PORT=8766 python3 server.py
```

The app is local-first and works without an internet connection after it is installed. Your current contract metadata is bundled in `static/app.js`, so plan names and prices remain visible offline. Update `CONTRACTS` in that file when your subscription changes.

### Authenticated Vercel app

The Vercel app uses Next.js and Auth.js with Google login. Only emails that match `ALLOWED_EMAIL_DOMAINS` or `ALLOWED_EMAILS` can sign in.

Required Vercel environment variables:

```bash
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
ALLOWED_EMAIL_DOMAINS=skyland.vc
ALLOWED_EMAILS=
PUBLIC_ACCESS=false
```

Set `PUBLIC_ACCESS=true` to allow access without login. Leave it unset or set it to `false` to require Google login.
The login screen always shows both choices: Google login or guest access.

Google OAuth redirect URI:

```text
https://token-meterz.vercel.app/api/auth/callback/google
```

For local Next.js development:

```bash
npm install
npm run dev
```

### Vercel app with each user's local data

Each employee can show their own local token data in the Vercel app by running the local bridge first:

```bash
cd "/Users/yosihikokinoshita/Documents/New project/token-meter"
PORT=8766 python3 server.py
```

Then open the Vercel app and click `ローカル版から取得`. The browser reads `http://127.0.0.1:8766/api/usage` from that employee's own machine.

## What It Reads

- Codex: `~/.codex/sessions/**/*.jsonl` and `~/.codex/archived_sessions/**/*.jsonl`
- Claude Code: `~/.claude/projects/**/*.jsonl`

The API scans local JSONL logs and returns day, week, month, average daily usage, source breakdowns, recent events, and the latest Codex rate-limit gauge when available.

## Limits

Gauge targets are local display thresholds, not billing-plan truths. Override them with environment variables:

```bash
TOKEN_METER_DAILY_LIMIT=1000000 TOKEN_METER_WEEKLY_LIMIT=7000000 TOKEN_METER_MONTHLY_LIMIT=30000000 python3 server.py
```

Codex capacity uses the latest `rate_limits` values in Codex JSONL logs. Claude Code does not expose the same official local capacity record in the logs found so far, so the dashboard shows recent local usage unless you provide display limits:

```bash
TOKEN_METER_CLAUDE_SESSION_LIMIT=50000000 TOKEN_METER_CLAUDE_WEEKLY_LIMIT=300000000 python3 server.py
```

## Public Release Notes

Before publishing, move log collection behind a small explicit importer or desktop agent. The current app is intentionally local-first because it reads private home-directory logs.

Do not send raw JSONL logs to a public server. For a hosted version, keep parsing on the user's machine and upload only explicit, anonymized aggregates.
