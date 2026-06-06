import { auth, signIn, signOut } from "../auth";
import LocalUsagePanel from "./local-usage-panel";

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

function isPublicAccessEnabled() {
  return String(process.env.PUBLIC_ACCESS || "").toLowerCase() === "true";
}

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
        <div className="login-actions">
          <form action={loginWithGoogle}>
            <button className="button" type="submit">
              Googleでログイン
            </button>
          </form>
          <a className="button button--light" href="/?guest=1">
            ログインせずに見る
          </a>
        </div>
      </section>
    </main>
  );
}

function ContractPanel({ contract }) {
  return (
    <article className={`pricing-panel pricing-panel--${contract.tone}`}>
      <div className="pricing-panel__head">
        <div>
          <p className="eyebrow">{contract.service}</p>
          <h2>My Plan & Price</h2>
        </div>
        <span>確認日 2026-06-05</span>
      </div>
      <div className="pricing-row pricing-row--current">
        <div>
          <span>{contract.service}</span>
          <strong>{contract.plan}</strong>
          <em>次回更新日 {contract.renewal}</em>
        </div>
        <b>{contract.price}</b>
      </div>
      <p className="pricing-note">現在の契約として表示しています。</p>
    </article>
  );
}

function Dashboard({ session, isPublic }) {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{isPublic ? "Public dashboard" : "Authenticated dashboard"}</p>
          <h1>Token Meter</h1>
        </div>
        <div className="account">
          <span>{isPublic ? "ログインなしで閲覧中" : session.user.email}</span>
          <a
            className="button button--light"
            href="/?guest=1"
          >
            トップページ
          </a>
          <a
            className="button button--light"
            href="https://github.com/skylandvc/token-meter#社員向けセットアップ"
            rel="noreferrer"
            target="_blank"
          >
            セットアップ手順
          </a>
          {!isPublic && (
            <form action={logout}>
              <button className="button button--light" type="submit">
                ログアウト
              </button>
            </form>
          )}
        </div>
      </header>

      <LocalUsagePanel />

      <section className="pricing-grid" aria-label="契約中プラン">
          {CONTRACTS.map((contract) => (
            <ContractPanel key={contract.service} contract={contract} />
          ))}
      </section>
    </main>
  );
}

export default async function Page({ searchParams }) {
  const params = await searchParams;
  const isPublic = isPublicAccessEnabled();
  const isGuest = params?.guest === "1";
  const session = isPublic || isGuest ? null : await auth();

  if (!isPublic && !isGuest && !session?.user) {
    return <LoginPage />;
  }

  return <Dashboard session={session} isPublic={isPublic || isGuest} />;
}
