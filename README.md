# Token Meter

Codex と Claude Code のトークン使用量を確認するためのダッシュボードです。

公開版:

https://token-meterz.vercel.app/?guest=1

## 社員向けセットアップ

公開版だけでは、各自のPC内にある Codex / Claude Code のローカルログを直接読むことはできません。

自分の使用量を表示するには、各自のPCでローカル版 Token Meter を裏側で起動しておく必要があります。

一度だけ自動起動を登録しておけば、次回以降はターミナルを開かなくても使えます。

公開版は、ブラウザ経由でその人のPCの `http://127.0.0.1:8766/api/usage` を読みます。

## Mac の手順

1. Python 3 を入れる

https://www.python.org/downloads/macos/

2. このリポジトリを取得する

```bash
git clone https://github.com/skylandvc/token-meter.git
cd token-meter
```

3. 自動起動を登録する

Finder で `install-mac-autostart.command` をダブルクリックします。

登録後は、Macへログインした時に Token Meter が裏側で自動起動します。

今すぐ起動したい場合は、以下を実行します。

```bash
PORT=8766 python3 server.py
```

Finder から `start.command` をダブルクリックして起動することもできます。

4. 公開版を開く

https://token-meterz.vercel.app/?guest=1

5. `ローカル版から取得` を押す

自動起動を解除したい場合は、`uninstall-mac-autostart.command` をダブルクリックします。

## Windows の手順

1. Python 3 を入れる

https://www.python.org/downloads/windows/

2. このリポジトリを取得する

```powershell
git clone https://github.com/skylandvc/token-meter.git
cd token-meter
```

3. 自動起動を登録する

Explorer で `install-windows-startup.bat` をダブルクリックします。

登録後は、Windowsへログインした時に Token Meter が裏側で自動起動します。

今すぐ起動したい場合は、以下を実行します。

```powershell
$env:PORT=8766
python server.py
```

Explorer から `start-windows.bat` をダブルクリックして起動することもできます。

4. 公開版を開く

https://token-meterz.vercel.app/?guest=1

5. `ローカル版から取得` を押す

自動起動を解除したい場合は、`uninstall-windows-startup.bat` をダブルクリックします。

## 常時使うための考え方

Vercel版だけで、各自のPC内にある Codex / Claude Code のログを直接読むことはできません。

そのため、常時使う方法は次のどちらかです。

- 各PCでローカル版 Token Meter を自動起動する
- 将来的に、ローカル集計結果だけを Notion DB や別DBへ同期して公開版で読む

現在は前者の方式です。会話本文やraw JSONLログは公開サーバーへ送りません。

## ローカル版だけで見る場合

```bash
python3 server.py
```

ブラウザで開きます。

```text
http://127.0.0.1:8765
```

8766番ポートで起動したい場合:

```bash
PORT=8766 python3 server.py
```

## 読み取るログ

- Codex: `~/.codex/sessions/**/*.jsonl`
- Codex: `~/.codex/archived_sessions/**/*.jsonl`
- Claude Code: `~/.claude/projects/**/*.jsonl`

ローカル版は、上記のJSONLログを読み、日次・週次・月次・平均日次・最近のイベント・Codexのrate limit情報を集計します。

会話本文やrawログを公開サーバーへ送る設計にはしていません。

## Vercel の設定

Googleログインを使う場合は、Vercel の Environment Variables に以下を設定します。

```text
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
ALLOWED_EMAIL_DOMAINS=skyland.vc
ALLOWED_EMAILS=
PUBLIC_ACCESS=false
```

ログインなしで見られるようにする場合:

```text
PUBLIC_ACCESS=true
```

Google OAuth の Redirect URI:

```text
https://token-meterz.vercel.app/api/auth/callback/google
```

## 開発者向け

Next.js の公開版をローカルで起動します。

```bash
npm install
npm run dev
```

Python版のローカルAPIを起動します。

```bash
PORT=8766 python3 server.py
```

## 注意

このアプリはローカルファーストです。

公開版で各自の使用量を出す場合も、ブラウザが各自のPCの `127.0.0.1:8766` を読むだけです。raw JSONLログをVercelへアップロードする設計ではありません。

将来的にNotion DB同期を入れる場合も、保存するのは集計済みスナップショットに限定する方針です。
