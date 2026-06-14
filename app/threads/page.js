import ThreadUsagePanel from "./thread-usage-panel";

export default function ThreadsPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local Codex chat usage</p>
          <h1>Chat Tokens</h1>
        </div>
        <div className="account">
          <span>Codexのローカルログをチャット別に集計</span>
          <a className="button button--light" href="/">
            Dashboard
          </a>
          <a className="button button--light" href="/projects">
            Projects
          </a>
          <a className="button button--light" href="/cursor">
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
      <ThreadUsagePanel />
    </main>
  );
}
