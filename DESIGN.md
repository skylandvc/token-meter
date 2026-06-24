---
colors:
  background: "#eceef3"
  surface: "#ffffff"
  surfaceMuted: "#f6f7f9"
  ink: "#1a2332"
  inkSecondary: "#4b5565"
  muted: "#6b7280"
  line: "#e2e6ec"
  codex: "#2563eb"
  claude: "#d97706"
  cursor: "#7c3aed"
  success: "#059669"
  danger: "#dc2626"
typography:
  family: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  headingWeight: 650
  labelWeight: 600
  numberWeight: 700
  eyebrowSize: "0.72rem"
  bodySize: "0.875rem"
  h1Size: "clamp(1.45rem, 2.5vw, 1.85rem)"
  metricNumberSize: "clamp(1.75rem, 3.5vw, 2.5rem)"
spacing:
  shellPadding: "24px"
  sectionGap: "20px"
  cardPadding: "18px"
  gridGap: "16px"
rounded:
  panel: "8px"
  control: "6px"
  gauge: "999px"
shadow:
  panel: "0 1px 2px rgba(16, 24, 40, 0.05), 0 4px 14px rgba(16, 24, 40, 0.04)"
  subtle: "0 1px 2px rgba(16, 24, 40, 0.04)"
components:
  accentBorderWidth: "3px"
  panelBorder: "1px solid #e2e6ec"
  buttonHeight: "36px"
  gaugeHeight: "10px"
---

# Token Meter — Operations Console

## 意図

Token Meter はランディングページではなく、毎日開く **運用コンソール（SaaS 管理画面）** として読みやすさと信頼感を優先する。数値は素早くスキャンし、説明文は控えめ。派手なグラデーションや大きなヒーロー演出は避ける。

## レイアウト

- ページ背景は薄いブルーグレー（`background`）。上部だけごく弱いトーン差があってもよいが、グラデーションは控えめ。
- コンテンツ幅は `min(1180px, 100% - 32px)`。カード間は `sectionGap` で階層を明確に。
- モバイルでは横スクロールを発生させず、グリッドは 1 列に自然に落ちる。

## パネル

- 白背景（`surface`）、`panelBorder`、角丸 `panel`、影は `shadow.panel`（軽め）。
- ネストした行・メトリックは `surfaceMuted` で区別。過度な半透明や強いドロップシャドウは使わない。

## サービス識別

アクセントは **細いトップまたは左ボーダー**（`accentBorderWidth`）のみ。面全体の色付けはしない。

| サービス | 色 | 用途 |
| --- | --- | --- |
| Codex | `codex`（青） | Capacity / Usage / Limit |
| Claude Code | `claude`（amber） | 同上 |
| Cursor | `cursor`（紫） | Cursor 画面・手動プラン |

## タイポグラフィ

- 見出し（h1/h2）: 太すぎず管理画面らしく `headingWeight`。
- 数字（今日の消費・メトリック）: `metricNumberSize` + `numberWeight` でスキャンしやすく。
- 説明・補足: `muted` + `bodySize`。eyebrow は小さく uppercase、色はサービス色または `codex` リンク色。

## 上部ナビ

- Token Meter タイトル + ナビリンクは現行構成を維持。
- ボタン（`.button` / `.button--light`）とテキストリンク（`.text-link`）の高さ・角丸・罫線を統一。
- プライマリは濃い `ink`、セカンダリは白背景 + 罫線。

## Capacity カード

- ウィンドウ行は「ラベル + 数値」→「補足」→「全幅ゲージ」の順で読む。
- Codex の公式 rate limit は `公式上限ログ N%` と表示（0% でも「未使用」と誤読しない）。
- Claude の推定上限は `推定 N%` またはトークン数表記。

## Manual plan settings

- 画面下部に配置。メイン KPI より視覚的優先度を下げる（`shadow.subtle`、やや小さめ見出し）。
- Operations Console の設定ブロックとして違和感ないフラットなカード群。

## 実装メモ

- CSS 変数は `app/globals.css` の `:root` にマッピング。`static/styles.css` は同じトークンを軽く同期。
- 新しい装飾を足すより、既存クラス名を活かしてトークンとレイアウトを調整する。
