import { auth, signIn, signOut } from "../auth";

const CONTRACTS = [
  {
    service: "Claude Code",
    plan: "Pro",
    price: "$20 / month",
    renewal: "未設定",
    tone: "claude",
  },
  {
    service: "Codex",
    plan: "Plus",
    price: "$20 / month",
    renewal: "未設定",
    tone: "codex",
  },
];

async function loginWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

async function logout() {
  "use server";
  await signOut({ redirectTo: "/" });
}

function LoginPage() {
  return (
    <main className="login">
      <section className="login-card">
        <div>
          <p className="eyebrow">Token Meter</p>
          <h1>Googleログイン</h1>
        </div>
        <p>
          社員メールだけがアクセスできます。許可するメールドメインは
          Vercel の環境変数 <code>ALLOWED_EMAIL_DOMAINS</code> で管理します。
        </p>
        <form action={loginWithGoogle}>
          <button className="button" type="submit">
            Googleでログイン
          </button>
        </form>
      </section>
    </main>
  );
}

function ContractPanel({ contract }) {
  return (
    <article className={`panel panel--${contract.tone}`}>
      <div className="contract">
        <div>
          <p className="eyebrow">{contract.service}</p>
          <strong>{contract.plan}</strong>
          <p className="muted">次回更新日 {contract.renewal}</p>
        </div>
        <b>{contract.price}</b>
      </div>
    </article>
  );
}

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    return <LoginPage />;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Authenticated dashboard</p>
          <h1>Token Meter</h1>
        </div>
        <div className="account">
          <span>{session.user.email}</span>
          <form action={logout}>
            <button className="button button--light" type="submit">
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <section className="grid" aria-label="契約中プラン">
        {CONTRACTS.map((contract) => (
          <ContractPanel key={contract.service} contract={contract} />
        ))}
      </section>

      <section className="metric-grid" aria-label="公開版データ">
        <article className="metric-card">
          <span>Data Source</span>
          <strong>Notion</strong>
        </article>
        <article className="metric-card">
          <span>Access</span>
          <strong>Google</strong>
        </article>
        <article className="metric-card">
          <span>Sync</span>
          <strong>準備中</strong>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>公開版の方針</h2>
        <p className="muted">
          Vercel版はGoogleログインで保護します。ローカルのCodex / Claude Codeログは
          ブラウザから直接読めないため、次の段階でローカル集計結果をNotion DBへ同期し、
          この画面からNotion DBの最新スナップショットを表示します。
        </p>
      </section>
    </main>
  );
}
