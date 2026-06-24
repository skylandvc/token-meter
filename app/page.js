import LocalUsagePanel from "./local-usage-panel";

function Dashboard() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Public dashboard</p>
          <h1>Token Meter</h1>
        </div>
        <div className="account">
          <span>ログインなしで利用できます</span>
          <a
            className="button button--light"
            href="/projects"
          >
            プロジェクト別
          </a>
          <a
            className="button button--light"
            href="/threads"
          >
            チャット別
          </a>
          <a
            className="button button--light"
            href="/cursor"
          >
            Cursor
          </a>
          <a
            className="text-link"
            href="https://github.com/skylandvc/token-meter"
            rel="noreferrer"
            target="_blank"
          >
            README
          </a>
        </div>
      </header>

      <LocalUsagePanel />
    </main>
  );
}

export default function Page() {
  return <Dashboard />;
}
